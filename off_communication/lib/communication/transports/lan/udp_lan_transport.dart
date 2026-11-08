import 'dart:async';
import 'dart:io';

import '../../../core/config/lan_config.dart';
import '../../contracts/communication_transport.dart';
import '../../protocol/mesh_packet.dart';

/// Transporte UDP experimental para aparelhos no mesmo Wi-Fi local.
///
/// Estado: EXPERIMENTAL, ainda não ligado à interface. Envia e recebe
/// [MeshPacket] por UDP (broadcast ou unicast por IP). Falta, para a Fase B:
/// descoberta de peers (heartbeat/mDNS), tabela de vizinhos, handshake
/// autenticado e retransmissão. Por isso [TransportStatus.reachablePeers] é
/// sempre 0 por enquanto.
///
/// Neste protótipo, `neighborId` é o endereço IPv4 do vizinho.
/// Recepção de broadcast varia por roteador e sistema: validar em aparelhos.
class UdpLanTransport implements CommunicationTransport {
  UdpLanTransport({this.config = const LanConfig(), DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final LanConfig config;
  final DateTime Function() _clock;

  // Os streams vivem enquanto o objeto viver: start()/stop() podem ser
  // chamados várias vezes (ex.: app vai para segundo plano e volta).
  final _inbound = StreamController<InboundPacket>.broadcast();
  final _status = StreamController<TransportStatus>.broadcast();
  RawDatagramSocket? _socket;
  TransportStatus _current = const TransportStatus.unavailable(TransportKind.lan, 'Parado');
  int _rejected = 0;

  /// Datagramas descartados por validação (métrica local, sem conteúdo).
  int get rejectedCount => _rejected;

  @override
  TransportKind get kind => TransportKind.lan;

  @override
  TransportStatus get currentStatus => _current;

  @override
  Stream<TransportStatus> get status => _status.stream;

  @override
  Stream<InboundPacket> get inbound => _inbound.stream;

  @override
  Future<void> start() async {
    if (_socket != null) return;
    final socket = await RawDatagramSocket.bind(InternetAddress.anyIPv4, config.port, reuseAddress: true);
    socket.broadcastEnabled = true;
    socket.listen((event) {
      if (event != RawSocketEvent.read) return;
      final datagram = socket.receive();
      if (datagram == null) return;
      try {
        final packet = MeshPacket.decode(datagram.data, now: _clock());
        _inbound.add(InboundPacket(packet: packet, fromNeighbor: datagram.address.address, via: TransportKind.lan));
      } on PacketRejectedException {
        _rejected++;
      } catch (_) {
        // Nunca derrubar o loop de recepção por um datagrama inválido.
        _rejected++;
      }
    });
    _socket = socket;
    _setStatus(const TransportStatus(kind: TransportKind.lan, available: true, detail: 'Socket UDP ativo'));
  }

  @override
  Future<void> stop() async {
    _socket?.close();
    _socket = null;
    _setStatus(const TransportStatus.unavailable(TransportKind.lan, 'Parado'));
  }

  @override
  Future<SendOutcome> send(MeshPacket packet, {String? neighborId}) async {
    final socket = _socket;
    if (socket == null) return SendOutcome.noRoute;
    final InternetAddress destination;
    if (neighborId == null) {
      destination = InternetAddress(config.broadcastAddress);
    } else {
      final parsed = InternetAddress.tryParse(neighborId);
      if (parsed == null) return SendOutcome.noRoute;
      destination = parsed;
    }
    final List<int> bytes;
    try {
      bytes = packet.encode();
    } on PacketRejectedException {
      return SendOutcome.failed;
    }
    final written = socket.send(bytes, destination, config.port);
    return written == bytes.length ? SendOutcome.sent : SendOutcome.failed;
  }

  /// Libera definitivamente os recursos. Depois disso o objeto não é reutilizável.
  Future<void> dispose() async {
    await stop();
    await _inbound.close();
    await _status.close();
  }

  void _setStatus(TransportStatus s) {
    _current = s;
    if (!_status.isClosed) _status.add(s);
  }
}
