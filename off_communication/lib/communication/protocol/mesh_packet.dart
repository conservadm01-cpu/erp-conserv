import 'dart:convert';
import 'dart:typed_data';

/// Tipos de mensagem do protocolo OFF (ver docs/TECHNICAL_ARCHITECTURE.md §6).
enum MessageType { text, voiceChunk, voiceMessage, ack, control }

/// Motivos pelos quais um pacote recebido é rejeitado.
enum PacketRejection {
  malformed,
  unsupportedVersion,
  tooLarge,
  expired,
  hopLimitExhausted,
  missingDestination,
}

class PacketRejectedException implements Exception {
  const PacketRejectedException(this.reason, [this.detail]);
  final PacketRejection reason;
  final String? detail;

  @override
  String toString() => 'PacketRejectedException($reason${detail == null ? '' : ': $detail'})';
}

/// Envelope versionado do protocolo OFF.
///
/// ATENÇÃO: nesta fase o envelope NÃO é autenticado nem criptografado.
/// O campo [authTag] está reservado para a autenticação criptográfica
/// (Fase C de segurança); hoje ele não é verificado por ninguém.
class MeshPacket {
  MeshPacket({
    required this.messageId,
    required this.originPeerId,
    required this.messageType,
    required this.createdAt,
    required this.expiresAt,
    required this.hopLimit,
    required List<int> payload,
    this.destinationPeerId,
    this.channelId,
    this.hopCount = 0,
    this.authTag,
  }) : payload = Uint8List.fromList(payload) {
    if (destinationPeerId == null && channelId == null) {
      throw const PacketRejectedException(
          PacketRejection.missingDestination, 'destinationPeerId ou channelId é obrigatório');
    }
    if (hopLimit < 0 || hopLimit > maxHopLimit) {
      throw PacketRejectedException(PacketRejection.malformed, 'hopLimit fora do intervalo: $hopLimit');
    }
    if (hopCount < 0 || hopCount > hopLimit) {
      throw PacketRejectedException(PacketRejection.hopLimitExhausted, 'hopCount=$hopCount hopLimit=$hopLimit');
    }
    if (this.payload.length > maxPayloadBytes) {
      throw PacketRejectedException(PacketRejection.tooLarge, '${this.payload.length} bytes');
    }
  }

  static const int protocolVersion = 1;

  /// Limite conservador para caber num datagrama UDP sem fragmentação IP
  /// típica em Wi-Fi (MTU 1500) depois do overhead JSON/base64.
  static const int maxPayloadBytes = 900;

  /// Limite absoluto do datagrama codificado.
  static const int maxEncodedBytes = 1400;

  static const int maxHopLimit = 8;

  final String messageId;
  final String originPeerId;
  final String? destinationPeerId;
  final String? channelId;
  final MessageType messageType;
  final DateTime createdAt;
  final DateTime expiresAt;
  final int hopLimit;
  final int hopCount;
  final Uint8List payload;
  final List<int>? authTag;

  int get payloadLength => payload.length;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);

  /// Pode ser retransmitido mais uma vez?
  bool get canForward => hopCount < hopLimit;

  /// Cópia para retransmissão, com um salto a mais.
  MeshPacket forwarded() {
    if (!canForward) {
      throw const PacketRejectedException(PacketRejection.hopLimitExhausted);
    }
    return MeshPacket(
      messageId: messageId,
      originPeerId: originPeerId,
      destinationPeerId: destinationPeerId,
      channelId: channelId,
      messageType: messageType,
      createdAt: createdAt,
      expiresAt: expiresAt,
      hopLimit: hopLimit,
      hopCount: hopCount + 1,
      payload: payload,
      authTag: authTag,
    );
  }

  Map<String, Object?> toJson() => {
        'v': protocolVersion,
        'id': messageId,
        'from': originPeerId,
        if (destinationPeerId != null) 'to': destinationPeerId,
        if (channelId != null) 'ch': channelId,
        't': messageType.name,
        'c': createdAt.toUtc().millisecondsSinceEpoch,
        'e': expiresAt.toUtc().millisecondsSinceEpoch,
        'hl': hopLimit,
        'hc': hopCount,
        'len': payload.length,
        'p': base64Encode(payload),
        if (authTag != null) 'tag': base64Encode(authTag!),
      };

  Uint8List encode() {
    final bytes = utf8.encode(jsonEncode(toJson()));
    if (bytes.length > maxEncodedBytes) {
      throw PacketRejectedException(PacketRejection.tooLarge, 'datagrama com ${bytes.length} bytes');
    }
    return bytes;
  }

  /// Decodifica e valida um datagrama recebido. Lança
  /// [PacketRejectedException] para qualquer pacote que deva ser descartado.
  static MeshPacket decode(List<int> bytes, {required DateTime now}) {
    if (bytes.length > maxEncodedBytes) {
      throw PacketRejectedException(PacketRejection.tooLarge, 'datagrama com ${bytes.length} bytes');
    }
    final Object? decoded;
    try {
      decoded = jsonDecode(utf8.decode(bytes));
    } on FormatException catch (e) {
      throw PacketRejectedException(PacketRejection.malformed, e.message);
    }
    if (decoded is! Map<String, dynamic>) {
      throw const PacketRejectedException(PacketRejection.malformed, 'envelope não é objeto');
    }
    if (decoded['v'] != protocolVersion) {
      throw PacketRejectedException(PacketRejection.unsupportedVersion, '${decoded['v']}');
    }

    try {
      final type = MessageType.values.byName(decoded['t'] as String);
      final payload = base64Decode(decoded['p'] as String);
      if (decoded['len'] != payload.length) {
        throw const PacketRejectedException(PacketRejection.malformed, 'payloadLength divergente');
      }
      final tag = decoded['tag'];
      final packet = MeshPacket(
        messageId: decoded['id'] as String,
        originPeerId: decoded['from'] as String,
        destinationPeerId: decoded['to'] as String?,
        channelId: decoded['ch'] as String?,
        messageType: type,
        createdAt: DateTime.fromMillisecondsSinceEpoch(decoded['c'] as int, isUtc: true),
        expiresAt: DateTime.fromMillisecondsSinceEpoch(decoded['e'] as int, isUtc: true),
        hopLimit: decoded['hl'] as int,
        hopCount: decoded['hc'] as int,
        payload: payload,
        authTag: tag == null ? null : base64Decode(tag as String),
      );
      if (packet.isExpired(now)) {
        throw const PacketRejectedException(PacketRejection.expired);
      }
      return packet;
    } on PacketRejectedException {
      rethrow;
    } on TypeError catch (e) {
      throw PacketRejectedException(PacketRejection.malformed, e.toString());
    } on FormatException catch (e) {
      throw PacketRejectedException(PacketRejection.malformed, e.message);
    } on ArgumentError catch (e) {
      throw PacketRejectedException(PacketRejection.malformed, e.toString());
    }
  }
}
