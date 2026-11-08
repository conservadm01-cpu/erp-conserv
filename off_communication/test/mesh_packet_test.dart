import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/protocol/mesh_packet.dart';

void main() {
  final now = DateTime.utc(2026, 11, 8, 12);

  MeshPacket sample(
          {int hopLimit = 4, int hopCount = 0, List<int>? payload, Duration ttl = const Duration(minutes: 5)}) =>
      MeshPacket(
        messageId: 'msg-1',
        originPeerId: 'peer-a',
        channelId: 'canal-1',
        messageType: MessageType.text,
        createdAt: now,
        expiresAt: now.add(ttl),
        hopLimit: hopLimit,
        hopCount: hopCount,
        payload: payload ?? utf8.encode('olá'),
      );

  test('codifica e decodifica preservando todos os campos', () {
    final p = sample();
    final back = MeshPacket.decode(p.encode(), now: now);
    expect(back.messageId, 'msg-1');
    expect(back.originPeerId, 'peer-a');
    expect(back.channelId, 'canal-1');
    expect(back.destinationPeerId, isNull);
    expect(back.messageType, MessageType.text);
    expect(back.createdAt, now);
    expect(back.expiresAt, now.add(const Duration(minutes: 5)));
    expect(back.hopLimit, 4);
    expect(back.hopCount, 0);
    expect(utf8.decode(back.payload), 'olá');
  });

  test('rejeita pacote expirado', () {
    final bytes = sample().encode();
    expect(
      () => MeshPacket.decode(bytes, now: now.add(const Duration(minutes: 5))),
      throwsA(isA<PacketRejectedException>().having((e) => e.reason, 'reason', PacketRejection.expired)),
    );
  });

  test('rejeita versão desconhecida', () {
    final map = sample().toJson()..['v'] = 99;
    expect(
      () => MeshPacket.decode(utf8.encode(jsonEncode(map)), now: now),
      throwsA(isA<PacketRejectedException>().having((e) => e.reason, 'reason', PacketRejection.unsupportedVersion)),
    );
  });

  test('rejeita lixo e campos com tipo errado sem lançar outra exceção', () {
    for (final bytes in [
      utf8.encode('não é json'),
      utf8.encode('[1,2,3]'),
      utf8.encode(jsonEncode(sample().toJson()..['hl'] = 'x')),
      utf8.encode(jsonEncode(sample().toJson()..['t'] = 'inexistente')),
      utf8.encode(jsonEncode(sample().toJson()..['len'] = 999)),
      [0xff, 0xfe, 0x00],
    ]) {
      expect(() => MeshPacket.decode(bytes, now: now), throwsA(isA<PacketRejectedException>()));
    }
  });

  test('rejeita payload grande demais', () {
    expect(
      () => sample(payload: List.filled(MeshPacket.maxPayloadBytes + 1, 1)),
      throwsA(isA<PacketRejectedException>().having((e) => e.reason, 'reason', PacketRejection.tooLarge)),
    );
    // O maior payload permitido ainda cabe no datagrama.
    expect(sample(payload: List.filled(MeshPacket.maxPayloadBytes, 1)).encode().length,
        lessThanOrEqualTo(MeshPacket.maxEncodedBytes));
  });

  test('exige destino (peer ou canal)', () {
    expect(
      () => MeshPacket(
        messageId: 'x',
        originPeerId: 'a',
        messageType: MessageType.text,
        createdAt: now,
        expiresAt: now,
        hopLimit: 1,
        payload: const [],
      ),
      throwsA(isA<PacketRejectedException>().having((e) => e.reason, 'reason', PacketRejection.missingDestination)),
    );
  });

  test('retransmissão incrementa hopCount e para no hopLimit', () {
    var p = sample(hopLimit: 2);
    p = p.forwarded();
    expect(p.hopCount, 1);
    p = p.forwarded();
    expect(p.hopCount, 2);
    expect(p.canForward, isFalse);
    expect(() => p.forwarded(), throwsA(isA<PacketRejectedException>()));
  });

  test('rejeita hopCount acima do hopLimit vindo da rede', () {
    final map = sample(hopLimit: 2).toJson()..['hc'] = 3;
    expect(
      () => MeshPacket.decode(utf8.encode(jsonEncode(map)), now: now),
      throwsA(isA<PacketRejectedException>().having((e) => e.reason, 'reason', PacketRejection.hopLimitExhausted)),
    );
  });
}
