import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/coordinator/connectivity_coordinator.dart';
import 'package:off_communication/features/network_status/simulated_connectivity.dart';
import 'package:off_communication/features/ptt/ptt_controller.dart';

void main() {
  late ConnectivityCoordinator coordinator;
  late SimulatedConnectivity sim;
  late PttController ptt;

  setUp(() {
    coordinator = ConnectivityCoordinator();
    sim = SimulatedConnectivity(coordinator);
    ptt = PttController(coordinator);
  });

  tearDown(() async {
    ptt.dispose();
    await coordinator.dispose();
  });

  test('pressionar sem rota → noRoute; soltar → idle', () {
    ptt.press();
    expect(ptt.state, PttState.noRoute);
    expect(ptt.route?.route, RouteKind.unavailable);
    ptt.release();
    expect(ptt.state, PttState.idle);
    expect(ptt.route, isNull);
  });

  test('pressionar com internet → pressed via ONLINE', () {
    sim.setInternet(true);
    ptt.press();
    expect(ptt.state, PttState.pressed);
    expect(ptt.route?.route, RouteKind.online);
  });

  test('perder internet com o botão pressionado troca para MESH sem soltar', () async {
    sim.setInternet(true);
    sim.setMeshPeers(2);
    ptt.press();
    expect(ptt.route?.route, RouteKind.online);
    sim.setInternet(false);
    await Future<void>.delayed(Duration.zero);
    expect(ptt.state, PttState.pressed);
    expect(ptt.route?.route, RouteKind.mesh);
  });

  test('press repetido não notifica de novo', () {
    var notifications = 0;
    ptt.addListener(() => notifications++);
    ptt.press();
    ptt.press();
    ptt.release();
    ptt.release();
    expect(notifications, 2);
  });
}
