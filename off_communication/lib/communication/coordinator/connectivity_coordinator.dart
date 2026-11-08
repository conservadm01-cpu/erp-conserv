import 'dart:async';

import '../contracts/communication_transport.dart';

/// Modo de rede apresentado ao usuário.
enum NetworkMode {
  /// Internet disponível: alcance sem limite geográfico.
  online,

  /// Sem internet, mas há aparelhos OFF próximos (malha local).
  mesh,

  /// Sem internet e sem aparelhos próximos: só é possível guardar mensagens.
  isolated,
}

/// Rota escolhida para um envio.
enum RouteKind { online, mesh, storeAndForward, unavailable }

class RouteDecision {
  const RouteDecision(this.route, this.reason, {this.transport});
  final RouteKind route;
  final TransportKind? transport;
  final String reason;
}

/// Fotografia do estado de conectividade.
class ConnectivitySnapshot {
  const ConnectivitySnapshot({
    required this.internetAvailable,
    required this.localNetworkAvailable,
    required this.meshPeers,
  });

  static const initial = ConnectivitySnapshot(internetAvailable: false, localNetworkAvailable: false, meshPeers: 0);

  final bool internetAvailable;
  final bool localNetworkAvailable;
  final int meshPeers;

  NetworkMode get mode {
    if (internetAvailable) return NetworkMode.online;
    if (meshPeers > 0) return NetworkMode.mesh;
    return NetworkMode.isolated;
  }

  @override
  bool operator ==(Object other) =>
      other is ConnectivitySnapshot &&
      other.internetAvailable == internetAvailable &&
      other.localNetworkAvailable == localNetworkAvailable &&
      other.meshPeers == meshPeers;

  @override
  int get hashCode => Object.hash(internetAvailable, localNetworkAvailable, meshPeers);
}

/// Decide o melhor caminho disponível (ver ADR-005).
///
/// Política explícita, nesta ordem:
/// 1. Internet disponível → ONLINE (WebRTC/SFU).
/// 2. Sem internet, com peer próximo → MESH (LAN / direto, com retransmissão).
/// 3. Sem caminho → voz ao vivo indisponível; mensagem gravada vai para a
///    fila store-and-forward e é sincronizada quando houver rota.
///
/// Esta classe é lógica pura: os transportes reais informam seu estado por
/// [update] e a UI apenas observa [snapshots].
class ConnectivityCoordinator {
  ConnectivityCoordinator({ConnectivitySnapshot initial = ConnectivitySnapshot.initial}) : _current = initial;

  final _controller = StreamController<ConnectivitySnapshot>.broadcast();
  ConnectivitySnapshot _current;

  ConnectivitySnapshot get current => _current;
  Stream<ConnectivitySnapshot> get snapshots => _controller.stream;

  void update(ConnectivitySnapshot next) {
    if (next == _current) return;
    _current = next;
    _controller.add(next);
  }

  /// Agrega o estado de vários transportes num único snapshot.
  void updateFromTransports(Iterable<TransportStatus> statuses) {
    var internet = false;
    var local = false;
    var peers = 0;
    for (final s in statuses) {
      if (!s.available) continue;
      if (s.kind == TransportKind.online) {
        internet = true;
      } else {
        local = true;
        peers += s.reachablePeers;
      }
    }
    update(ConnectivitySnapshot(internetAvailable: internet, localNetworkAvailable: local, meshPeers: peers));
  }

  /// Rota para voz ao vivo (PTT). Voz ao vivo não é armazenada por padrão.
  RouteDecision routeForLiveVoice() {
    switch (_current.mode) {
      case NetworkMode.online:
        return const RouteDecision(RouteKind.online, 'Internet disponível', transport: TransportKind.online);
      case NetworkMode.mesh:
        return RouteDecision(RouteKind.mesh, '${_current.meshPeers} aparelho(s) próximo(s)',
            transport: TransportKind.lan);
      case NetworkMode.isolated:
        return const RouteDecision(RouteKind.unavailable, 'Nenhum caminho: sem internet e sem aparelhos próximos');
    }
  }

  /// Rota para mensagem de voz gravada / texto: sempre há um destino, mesmo
  /// que seja a fila local.
  RouteDecision routeForStoredMessage() {
    final live = routeForLiveVoice();
    if (live.route != RouteKind.unavailable) return live;
    return const RouteDecision(RouteKind.storeAndForward, 'Guardada na fila até existir rota');
  }

  Future<void> dispose() => _controller.close();
}
