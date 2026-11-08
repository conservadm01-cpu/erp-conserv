import '../../communication/coordinator/connectivity_coordinator.dart';

/// SIMULAÇÃO para a Fase A: permite alternar internet e quantidade de peers
/// na interface, para validar a troca de modo. Não detecta rede real.
/// Será substituída pelos transportes reais na Fase B (LAN) e C (online).
class SimulatedConnectivity {
  SimulatedConnectivity(this.coordinator);

  final ConnectivityCoordinator coordinator;

  void setInternet(bool available) {
    final c = coordinator.current;
    coordinator.update(ConnectivitySnapshot(
        internetAvailable: available, localNetworkAvailable: c.localNetworkAvailable, meshPeers: c.meshPeers));
  }

  void setMeshPeers(int peers) {
    final c = coordinator.current;
    final n = peers < 0 ? 0 : peers;
    coordinator.update(
        ConnectivitySnapshot(internetAvailable: c.internetAvailable, localNetworkAvailable: n > 0, meshPeers: n));
  }
}
