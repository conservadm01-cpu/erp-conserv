import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../communication/coordinator/connectivity_coordinator.dart';

enum PttState {
  /// Botão solto.
  idle,

  /// Botão pressionado e existe rota. A transmissão de áudio AINDA NÃO está
  /// implementada (Fase B/C); o estado apenas indica a rota que seria usada.
  pressed,

  /// Botão pressionado, mas não há rota para voz ao vivo.
  noRoute,
}

/// Estado de PTT da interface. Não acessa microfone nem rede: recebe a
/// decisão de rota do [ConnectivityCoordinator].
class PttController extends ChangeNotifier {
  PttController(this._coordinator) {
    _sub = _coordinator.snapshots.listen((_) => _refreshRoute());
  }

  final ConnectivityCoordinator _coordinator;
  late final StreamSubscription<ConnectivitySnapshot> _sub;

  PttState _state = PttState.idle;
  RouteDecision? _route;

  PttState get state => _state;
  bool get isPressed => _state != PttState.idle;

  /// Rota avaliada no momento do aperto (atualizada se a rede mudar enquanto
  /// o botão estiver pressionado).
  RouteDecision? get route => _route;

  void press() {
    if (isPressed) return;
    _evaluate();
  }

  void release() {
    if (!isPressed) return;
    _state = PttState.idle;
    _route = null;
    notifyListeners();
  }

  void _refreshRoute() {
    if (isPressed) _evaluate();
  }

  void _evaluate() {
    final decision = _coordinator.routeForLiveVoice();
    _route = decision;
    _state = decision.route == RouteKind.unavailable ? PttState.noRoute : PttState.pressed;
    notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
