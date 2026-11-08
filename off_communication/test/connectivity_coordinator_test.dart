import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/contracts/communication_transport.dart';
import 'package:off_communication/communication/coordinator/connectivity_coordinator.dart';

void main() {
  group('política de rota (fluxograma do PTT)', () {
    test('internet disponível → ONLINE, mesmo com peers próximos', () {
      final c = ConnectivityCoordinator(
          initial: const ConnectivitySnapshot(internetAvailable: true, localNetworkAvailable: true, meshPeers: 3));
      expect(c.current.mode, NetworkMode.online);
      expect(c.routeForLiveVoice().route, RouteKind.online);
      expect(c.routeForLiveVoice().transport, TransportKind.online);
    });

    test('sem internet, com celular próximo → MESH', () {
      final c = ConnectivityCoordinator(
          initial: const ConnectivitySnapshot(internetAvailable: false, localNetworkAvailable: true, meshPeers: 2));
      expect(c.current.mode, NetworkMode.mesh);
      expect(c.routeForLiveVoice().route, RouteKind.mesh);
      expect(c.routeForStoredMessage().route, RouteKind.mesh);
    });

    test('sem internet e sem peers → voz ao vivo indisponível, mensagem vai para a fila', () {
      final c = ConnectivityCoordinator();
      expect(c.current.mode, NetworkMode.isolated);
      expect(c.routeForLiveVoice().route, RouteKind.unavailable);
      expect(c.routeForStoredMessage().route, RouteKind.storeAndForward);
    });

    test('rede local sem nenhum peer OFF não conta como MESH', () {
      final c = ConnectivityCoordinator(
          initial: const ConnectivitySnapshot(internetAvailable: false, localNetworkAvailable: true, meshPeers: 0));
      expect(c.current.mode, NetworkMode.isolated);
    });
  });

  test('emite snapshot só quando o estado muda', () async {
    final c = ConnectivityCoordinator();
    final seen = <NetworkMode>[];
    final sub = c.snapshots.listen((s) => seen.add(s.mode));
    const online = ConnectivitySnapshot(internetAvailable: true, localNetworkAvailable: false, meshPeers: 0);
    c.update(online);
    c.update(online);
    c.update(const ConnectivitySnapshot(internetAvailable: false, localNetworkAvailable: true, meshPeers: 1));
    await Future<void>.delayed(Duration.zero);
    expect(seen, [NetworkMode.online, NetworkMode.mesh]);
    await sub.cancel();
    await c.dispose();
  });

  test('agrega estado de vários transportes e ignora os indisponíveis', () {
    final c = ConnectivityCoordinator();
    c.updateFromTransports(const [
      TransportStatus.unavailable(TransportKind.online),
      TransportStatus(kind: TransportKind.lan, available: true, reachablePeers: 2),
      TransportStatus(kind: TransportKind.directAndroid, available: true, reachablePeers: 1),
      TransportStatus(kind: TransportKind.directIos, available: false, reachablePeers: 5),
    ]);
    expect(c.current.internetAvailable, isFalse);
    expect(c.current.localNetworkAvailable, isTrue);
    expect(c.current.meshPeers, 3);
    expect(c.current.mode, NetworkMode.mesh);
  });
}
