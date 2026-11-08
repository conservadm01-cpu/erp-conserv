import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/communication/floor/floor_control.dart';

void main() {
  group('LocalFloorArbiter', () {
    late DateTime now;
    late LocalFloorArbiter arbiter;

    setUp(() {
      now = DateTime.utc(2026, 11, 8, 12);
      arbiter = LocalFloorArbiter(maxTalk: const Duration(seconds: 60), clock: () => now);
    });
    tearDown(() => arbiter.dispose());

    Future<FloorResult> ask(String peer, [String ch = 'c1']) =>
        arbiter.request(channelId: ch, peerId: peer, displayName: peer);

    test('canal livre concede; segundo pedido é negado com quem está falando', () async {
      final a = await ask('ana');
      expect(a, isA<FloorGranted>());
      final b = await ask('bruno');
      expect(b, isA<FloorDenied>());
      expect((b as FloorDenied).current.holderId, 'ana');
    });

    test('canais diferentes são independentes', () async {
      expect(await ask('ana', 'c1'), isA<FloorGranted>());
      expect(await ask('bruno', 'c2'), isA<FloorGranted>());
    });

    test('liberar devolve o canal; token errado é ignorado', () async {
      final g = (await ask('ana') as FloorGranted).grant;
      final fake = FloorGrant(
        channelId: 'c1',
        holderId: 'ana',
        holderName: 'ana',
        token: 'outro',
        grantedAt: now,
        expiresAt: now,
      );
      await arbiter.release(fake);
      expect(arbiter.holderOf('c1')?.holderId, 'ana');
      await arbiter.release(g);
      expect(arbiter.holderOf('c1'), isNull);
      expect(await ask('bruno'), isA<FloorGranted>());
    });

    test('o mesmo dono pedindo de novo mantém a concessão', () async {
      final g1 = (await ask('ana') as FloorGranted).grant;
      final g2 = (await ask('ana') as FloorGranted).grant;
      expect(g2.token, g1.token);
    });

    test('limite de fala libera o canal sem release', () async {
      await ask('ana');
      now = now.add(const Duration(seconds: 60));
      expect(arbiter.holderOf('c1'), isNull);
      expect(await ask('bruno'), isA<FloorGranted>());
    });

    test('emite mudanças de dono', () async {
      final events = <String?>[];
      final sub = arbiter.changes.listen((c) => events.add(c.holder?.holderId));
      final g = (await ask('ana') as FloorGranted).grant;
      await arbiter.release(g);
      await Future<void>.delayed(Duration.zero);
      expect(events, ['ana', null]);
      await sub.cancel();
    });

    test('tokens são diferentes a cada concessão', () async {
      final g1 = (await ask('ana') as FloorGranted).grant;
      await arbiter.release(g1);
      final g2 = (await ask('ana') as FloorGranted).grant;
      expect(g2.token, isNot(g1.token));
      expect(g2.token.length, 32);
    });
  });

  group('resolveFloorCollision (malha, sem servidor)', () {
    final t = DateTime.utc(2026, 11, 8, 12);
    FloorClaim claim(String peer, int ms) =>
        FloorClaim(peerId: peer, channelId: 'c1', claimedAt: t.add(Duration(milliseconds: ms)));

    test('quem pediu claramente antes vence', () {
      expect(resolveFloorCollision(claim('zeca', 0), claim('ana', 500)).peerId, 'zeca');
      expect(resolveFloorCollision(claim('ana', 500), claim('zeca', 0)).peerId, 'zeca');
    });

    test('pedidos quase simultâneos: menor peerId vence, nos dois sentidos', () {
      expect(resolveFloorCollision(claim('zeca', 0), claim('ana', 120)).peerId, 'ana');
      expect(resolveFloorCollision(claim('ana', 120), claim('zeca', 0)).peerId, 'ana');
    });

    test('canais diferentes não colidem', () {
      expect(
        () => resolveFloorCollision(claim('a', 0), FloorClaim(peerId: 'b', channelId: 'c2', claimedAt: t)),
        throwsArgumentError,
      );
    });
  });
}
