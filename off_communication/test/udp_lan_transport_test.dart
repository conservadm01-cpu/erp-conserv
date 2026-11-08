import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/contracts/communication_transport.dart';
import 'package:off_communication/communication/protocol/mesh_packet.dart';
import 'package:off_communication/communication/transports/lan/udp_lan_transport.dart';
import 'package:off_communication/core/config/lan_config.dart';

/// Teste de socket real em loopback (127.0.0.1). Não substitui o teste entre
/// aparelhos físicos no mesmo roteador.
void main() {
  final now = DateTime.now().toUtc();
  MeshPacket packet(String id) => MeshPacket(
        messageId: id,
        originPeerId: 'peer-a',
        channelId: 'canal-1',
        messageType: MessageType.text,
        createdAt: now,
        expiresAt: now.add(const Duration(minutes: 1)),
        hopLimit: 3,
        payload: utf8.encode('teste $id'),
      );

  test('envia e recebe pelo loopback, descarta lixo e reinicia após stop()', () async {
    final probe = await RawDatagramSocket.bind(InternetAddress.loopbackIPv4, 0);
    final port = probe.port;
    probe.close();

    final t = UdpLanTransport(config: LanConfig(port: port));
    await t.start();
    expect(t.currentStatus.available, isTrue);

    var received = Completer<InboundPacket>();
    final sub = t.inbound.listen((p) => received.complete(p));

    // Lixo na mesma porta não derruba o receptor.
    final junk = await RawDatagramSocket.bind(InternetAddress.loopbackIPv4, 0);
    junk.send(utf8.encode('lixo'), InternetAddress.loopbackIPv4, port);

    expect(await t.send(packet('m1'), neighborId: '127.0.0.1'), SendOutcome.sent);
    final got = await received.future.timeout(const Duration(seconds: 3));
    expect(got.packet.messageId, 'm1');
    expect(got.fromNeighbor, '127.0.0.1');
    expect(t.rejectedCount, 1);

    await t.stop();
    expect(t.currentStatus.available, isFalse);
    expect(await t.send(packet('m2'), neighborId: '127.0.0.1'), SendOutcome.noRoute);

    await t.start();
    received = Completer<InboundPacket>();
    expect(await t.send(packet('m3'), neighborId: '127.0.0.1'), SendOutcome.sent);
    expect((await received.future.timeout(const Duration(seconds: 3))).packet.messageId, 'm3');

    expect(await t.send(packet('m4'), neighborId: 'não-é-ip'), SendOutcome.noRoute);

    junk.close();
    await sub.cancel();
    await t.dispose();
  });
}
