import '../communication/coordinator/connectivity_coordinator.dart';
import '../communication/floor/floor_control.dart';
import '../features/channels/channel_repository.dart';
import '../features/network_status/simulated_connectivity.dart';
import '../features/ptt/ptt_controller.dart';
import '../features/ptt/ptt_feedback.dart';

/// Serviços do app montados em um só lugar (injeção simples, sem pacote).
/// Os testes criam a própria instância com relógio/feedback controlados.
class OffServices {
  OffServices({
    ConnectivityCoordinator? coordinator,
    FloorArbiter? arbiter,
    PttFeedback feedback = const SystemPttFeedback(),
    this.channels = const DemoChannelRepository(),
    this.localPeerId = 'local-demo',
    this.localName = 'Você',
  })  : coordinator = coordinator ?? ConnectivityCoordinator(),
        arbiter = arbiter ?? LocalFloorArbiter() {
    simulation = SimulatedConnectivity(this.coordinator);
    ptt = PttController(
      coordinator: this.coordinator,
      arbiter: this.arbiter,
      localPeerId: localPeerId,
      localName: localName,
      channelId: DemoChannelRepository.channels.first.id,
      feedback: feedback,
    );
    demoSpeaker = DemoSpeaker(this.arbiter);
  }

  final ConnectivityCoordinator coordinator;
  final FloorArbiter arbiter;
  final ChannelRepository channels;
  final String localPeerId;
  final String localName;

  /// SIMULAÇÃO (v0.3): estado de rede controlado pela tela Ajustes.
  late final SimulatedConnectivity simulation;
  late final PttController ptt;

  /// SIMULAÇÃO (v0.3): outro participante pegando a palavra no canal.
  late final DemoSpeaker demoSpeaker;

  Future<void> dispose() async {
    ptt.dispose();
    await demoSpeaker.stop();
    final a = arbiter;
    if (a is LocalFloorArbiter) await a.dispose();
    await coordinator.dispose();
  }
}

/// Simula outra pessoa falando, pelo mesmo árbitro — assim o fluxo de
/// "canal ocupado" é o real, não um booleano local.
class DemoSpeaker {
  DemoSpeaker(this._arbiter);

  final FloorArbiter _arbiter;
  FloorGrant? _grant;

  static const peerId = 'demo-carlos';
  static const name = 'Carlos';

  /// Está falando no canal [channelId] agora?
  bool isTalkingOn(String channelId) {
    final g = _grant;
    return g != null && g.channelId == channelId && _arbiter.holderOf(channelId)?.token == g.token;
  }

  /// Retorna `false` se o canal já estava ocupado (por você, por exemplo).
  Future<bool> start(String channelId) async {
    await stop();
    final r = await _arbiter.request(channelId: channelId, peerId: peerId, displayName: name);
    if (r is FloorGranted) {
      _grant = r.grant;
      return true;
    }
    return false;
  }

  Future<void> stop() async {
    final g = _grant;
    _grant = null;
    if (g != null) await _arbiter.release(g);
  }
}
