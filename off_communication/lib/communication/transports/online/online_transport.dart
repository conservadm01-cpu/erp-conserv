import 'dart:async';

import '../../contracts/communication_transport.dart';
import '../../protocol/mesh_packet.dart';

/// STUB da Fase C. Representa o caminho ONLINE (sinalização + WebRTC/SFU).
/// Hoje sempre reporta indisponível e nunca envia nada.
///
/// A escolha concreta de SFU/sinalização está pendente (ver DECISIONS.md,
/// ADR-006): precisa ser verificada quanto a manutenção, custo e suporte
/// Flutter Android/iOS antes de entrar no projeto.
class OnlineTransport implements CommunicationTransport {
  final _status = StreamController<TransportStatus>.broadcast();
  final _inbound = StreamController<InboundPacket>.broadcast();

  static const _stubStatus = TransportStatus.unavailable(TransportKind.online, 'Não implementado (Fase C)');

  @override
  TransportKind get kind => TransportKind.online;

  @override
  TransportStatus get currentStatus => _stubStatus;

  @override
  Stream<TransportStatus> get status => _status.stream;

  @override
  Stream<InboundPacket> get inbound => _inbound.stream;

  @override
  Future<void> start() async {}

  @override
  Future<void> stop() async {}

  @override
  Future<SendOutcome> send(MeshPacket packet, {String? neighborId}) async => SendOutcome.noRoute;
}
