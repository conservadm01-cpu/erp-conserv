import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/coordinator/connectivity_coordinator.dart';
import 'package:off_communication/communication/floor/floor_control.dart';
import 'package:off_communication/features/network_status/simulated_connectivity.dart';
import 'package:off_communication/features/ptt/ptt_controller.dart';
import 'package:off_communication/features/ptt/ptt_feedback.dart';

void main() {
  late ConnectivityCoordinator coordinator;
  late SimulatedConnectivity sim;
  late LocalFloorArbiter arbiter;
  late RecordingPttFeedback feedback;
  late PttController ptt;

  PttController make({Duration maxTalk = const Duration(seconds: 60)}) {
    arbiter = LocalFloorArbiter(maxTalk: maxTalk);
    return PttController(
      coordinator: coordinator,
      arbiter: arbiter,
      localPeerId: 'eu',
      localName: 'Eu',
      channelId: 'c1',
      feedback: feedback,
    );
  }

  Future<void> settle() => Future<void>.delayed(Duration.zero);

  setUp(() {
    coordinator = ConnectivityCoordinator();
    sim = SimulatedConnectivity(coordinator);
    feedback = RecordingPttFeedback();
    ptt = make();
  });

  tearDown(() async {
    ptt.dispose();
    await arbiter.dispose();
    await coordinator.dispose();
  });

  test('sem rota: noRoute, vibra e não pede a palavra', () async {
    await ptt.press();
    expect(ptt.state, PttState.noRoute);
    expect(arbiter.holderOf('c1'), isNull);
    expect(feedback.calls, ['denied']);
    await ptt.release();
    expect(ptt.state, PttState.idle);
  });

  test('com rota: ganha a palavra, toca início e fim, libera ao soltar', () async {
    sim.setMeshPeers(2);
    await ptt.press();
    expect(ptt.state, PttState.talking);
    expect(ptt.route?.route, RouteKind.mesh);
    expect(arbiter.holderOf('c1')?.holderId, 'eu');
    await ptt.release();
    expect(ptt.state, PttState.idle);
    expect(arbiter.holderOf('c1'), isNull);
    expect(feedback.calls, ['start', 'end']);
    expect(ptt.lastEnd, TalkEndReason.released);
  });

  test('canal ocupado: busy com o nome de quem fala; vê o canal liberar', () async {
    sim.setInternet(true);
    await arbiter.request(channelId: 'c1', peerId: 'carlos', displayName: 'Carlos');
    await settle();
    expect(ptt.channelBusy, isTrue);
    await ptt.press();
    expect(ptt.state, PttState.busy);
    expect(ptt.currentSpeaker?.holderName, 'Carlos');
    expect(feedback.calls, ['denied']);
    await ptt.release();
    await arbiter.release(arbiter.holderOf('c1')!);
    await settle();
    expect(ptt.channelBusy, isFalse);
    await ptt.press();
    expect(ptt.state, PttState.talking);
  });

  test('perder toda rede durante a fala encerra e libera o canal', () async {
    sim.setInternet(true);
    await ptt.press();
    expect(ptt.state, PttState.talking);
    sim.setInternet(false);
    await settle();
    expect(ptt.state, PttState.noRoute);
    expect(ptt.lastEnd, TalkEndReason.routeLost);
    expect(arbiter.holderOf('c1'), isNull);
  });

  test('ONLINE -> MESH durante a fala continua falando', () async {
    sim.setInternet(true);
    sim.setMeshPeers(1);
    await ptt.press();
    expect(ptt.route?.route, RouteKind.online);
    sim.setInternet(false);
    await settle();
    expect(ptt.state, PttState.talking);
    expect(ptt.route?.route, RouteKind.mesh);
  });

  test('limite de fala encerra sozinho', () async {
    ptt.dispose();
    await arbiter.dispose();
    ptt = make(maxTalk: const Duration(milliseconds: 40));
    sim.setInternet(true);
    await ptt.press();
    expect(ptt.state, PttState.talking);
    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(ptt.state, PttState.idle);
    expect(ptt.lastEnd, TalkEndReason.maxTalk);
    expect(feedback.calls, ['start', 'end']);
  });

  test('trocar de canal falando libera o canal anterior', () async {
    sim.setInternet(true);
    await ptt.press();
    await ptt.selectChannel('c2');
    expect(arbiter.holderOf('c1'), isNull);
    expect(ptt.state, PttState.idle);
    expect(ptt.channelId, 'c2');
    expect(ptt.lastEnd, TalkEndReason.channelChanged);
  });

  test('press repetido não pede a palavra duas vezes', () async {
    sim.setInternet(true);
    await ptt.press();
    await ptt.press();
    await ptt.release();
    await ptt.release();
    expect(feedback.calls, ['start', 'end']);
  });
}
