import 'dart:async';

import '../protocol/mesh_packet.dart';

/// Tipo de caminho físico/lógico usado por um transporte.
enum TransportKind {
  /// Internet (Wi-Fi com WAN ou dados móveis): sinalização + WebRTC/SFU.
  online,

  /// Rede local sem internet (mesmo roteador/hotspot), base da malha OFF.
  lan,

  /// Conexão direta Android (Wi-Fi Direct / Nearby) — fase posterior.
  directAndroid,

  /// Conexão direta iOS (Multipeer / Network framework) — fase posterior.
  directIos,
}

/// Estado observável de um transporte.
class TransportStatus {
  const TransportStatus({
    required this.kind,
    required this.available,
    this.reachablePeers = 0,
    this.detail,
  });

  const TransportStatus.unavailable(this.kind, [this.detail])
      : available = false,
        reachablePeers = 0;

  final TransportKind kind;

  /// O caminho existe (ex.: há internet; há rede local ativa).
  final bool available;

  /// Peers OFF alcançáveis diretamente por este transporte.
  final int reachablePeers;

  final String? detail;
}

/// Pacote recebido, com o peer vizinho que o entregou (não necessariamente a
/// origem: em malha, [fromNeighbor] pode ser um repetidor).
class InboundPacket {
  const InboundPacket({required this.packet, required this.fromNeighbor, required this.via});
  final MeshPacket packet;
  final String fromNeighbor;
  final TransportKind via;
}

enum SendOutcome { sent, noRoute, failed }

/// Contrato comum a LAN, online e adaptadores diretos. O PTT e a malha
/// conversam apenas com esta interface — nunca com sockets diretamente.
abstract interface class CommunicationTransport {
  TransportKind get kind;

  Stream<TransportStatus> get status;
  TransportStatus get currentStatus;

  Stream<InboundPacket> get inbound;

  Future<void> start();
  Future<void> stop();

  /// Envia para um vizinho específico ou, se [neighborId] for nulo, para
  /// todos os vizinhos alcançáveis por este transporte.
  Future<SendOutcome> send(MeshPacket packet, {String? neighborId});
}
