import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../communication/coordinator/connectivity_coordinator.dart';
import '../../communication/floor/floor_control.dart';
import 'ptt_feedback.dart';

enum PttState {
  /// Botão solto.
  idle,

  /// Botão pressionado, aguardando o árbitro conceder a palavra.
  requesting,

  /// Com a palavra. A captura/envio de áudio AINDA NÃO existe: o estado
  /// indica rota e permissão de fala, não transmissão real.
  talking,

  /// Pressionado, mas outra pessoa está falando no canal.
  busy,

  /// Pressionado, mas não há rota para voz ao vivo.
  noRoute,
}

/// Por que a última fala terminou.
enum TalkEndReason { none, released, maxTalk, routeLost, channelChanged }

/// Estado do PTT: hold-to-talk, um transmissor por canal.
/// Não acessa microfone nem rede; consulta o [ConnectivityCoordinator] para a
/// rota e o [FloorArbiter] para a palavra.
class PttController extends ChangeNotifier {
  PttController({
    required ConnectivityCoordinator coordinator,
    required FloorArbiter arbiter,
    required this.localPeerId,
    required this.localName,
    required String channelId,
    PttFeedback feedback = const SystemPttFeedback(),
  })  : _coordinator = coordinator,
        _arbiter = arbiter,
        _feedback = feedback,
        _channelId = channelId {
    _connSub = _coordinator.snapshots.listen((_) => _onConnectivity());
    _floorSub = _arbiter.changes.listen(_onFloorChange);
    _speaker = _otherHolder(_arbiter.holderOf(channelId));
  }

  final ConnectivityCoordinator _coordinator;
  final FloorArbiter _arbiter;
  final PttFeedback _feedback;
  final String localPeerId;
  final String localName;
  late final StreamSubscription<ConnectivitySnapshot> _connSub;
  late final StreamSubscription<FloorChange> _floorSub;

  String _channelId;
  PttState _state = PttState.idle;
  RouteDecision? _route;
  FloorGrant? _grant;
  FloorGrant? _speaker;
  bool _held = false;
  TalkEndReason _lastEnd = TalkEndReason.none;
  bool _disposed = false;

  String get channelId => _channelId;
  PttState get state => _state;
  bool get isHeld => _held;
  RouteDecision? get route => _route;

  /// Concessão atual deste aparelho (quando [state] é [PttState.talking]).
  FloorGrant? get grant => _grant;

  /// Outra pessoa falando no canal selecionado, se houver.
  FloorGrant? get currentSpeaker => _speaker;
  bool get channelBusy => _speaker != null;
  TalkEndReason get lastEnd => _lastEnd;

  Future<void> press() async {
    if (_held) return;
    _held = true;
    _lastEnd = TalkEndReason.none;
    final route = _coordinator.routeForLiveVoice();
    _route = route;
    if (route.route == RouteKind.unavailable) {
      _set(PttState.noRoute);
      unawaited(_feedback.denied());
      return;
    }
    _set(PttState.requesting);
    final result = await _arbiter.request(channelId: _channelId, peerId: localPeerId, displayName: localName);
    if (_disposed) return;
    switch (result) {
      case FloorGranted(:final grant):
        if (!_held || _state != PttState.requesting) {
          // Soltou antes da resposta: devolve a palavra.
          await _arbiter.release(grant);
          return;
        }
        _grant = grant;
        _set(PttState.talking);
        unawaited(_feedback.talkStarted());
      case FloorDenied(:final current):
        if (!_held) return;
        _speaker = current;
        _set(PttState.busy);
        unawaited(_feedback.denied());
    }
  }

  Future<void> release() async {
    if (!_held) return;
    _held = false;
    if (_state == PttState.talking) {
      await _endTalk(TalkEndReason.released);
      return;
    }
    _route = null;
    _set(PttState.idle);
  }

  /// Troca de canal. Se estiver falando, encerra a fala antes.
  Future<void> selectChannel(String channelId) async {
    if (channelId == _channelId) return;
    if (_state == PttState.talking) await _endTalk(TalkEndReason.channelChanged);
    _held = false;
    _channelId = channelId;
    _speaker = _otherHolder(_arbiter.holderOf(channelId));
    _route = null;
    _set(PttState.idle);
  }

  Future<void> _endTalk(TalkEndReason reason) async {
    final g = _grant;
    _grant = null;
    _lastEnd = reason;
    _route = null;
    if (reason != TalkEndReason.released) _held = false;
    _set(reason == TalkEndReason.routeLost ? PttState.noRoute : PttState.idle);
    unawaited(_feedback.talkEnded());
    if (g != null) await _arbiter.release(g);
  }

  void _onConnectivity() {
    if (_state != PttState.talking && _state != PttState.requesting) return;
    final route = _coordinator.routeForLiveVoice();
    if (route.route == RouteKind.unavailable) {
      if (_state == PttState.talking) {
        unawaited(_endTalk(TalkEndReason.routeLost));
      } else {
        _route = route;
        _set(PttState.noRoute);
      }
      return;
    }
    // ONLINE <-> MESH: continua falando, só muda o caminho.
    _route = route;
    notifyListeners();
  }

  void _onFloorChange(FloorChange change) {
    if (change.channelId != _channelId) return;
    final holder = change.holder;
    final mine = _grant;
    if (holder == null) {
      _speaker = null;
      if (mine != null && _state == PttState.talking) {
        // O árbitro encerrou nossa fala (limite de tempo).
        _grant = null;
        _held = false;
        _lastEnd = TalkEndReason.maxTalk;
        _route = null;
        _set(PttState.idle);
        unawaited(_feedback.talkEnded());
        return;
      }
      // Se estava em "busy", continua assim até soltar: falar exige novo aperto.
      notifyListeners();
      return;
    }
    if (holder.holderId == localPeerId) return;
    _speaker = holder;
    notifyListeners();
  }

  FloorGrant? _otherHolder(FloorGrant? g) => g == null || g.holderId == localPeerId ? null : g;

  void _set(PttState s) {
    _state = s;
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _connSub.cancel();
    _floorSub.cancel();
    final g = _grant;
    if (g != null) unawaited(_arbiter.release(g));
    super.dispose();
  }
}
