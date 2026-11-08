import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/app/app.dart';

void main() {
  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const OffCommunicationApp());
    await tester.pumpAndSettle();
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    final f = find.byKey(Key(key));
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
    await tester.tap(f);
    await tester.pumpAndSettle();
  }

  Future<TestGesture> holdPtt(WidgetTester tester) async {
    final f = find.byKey(const Key('ptt-button'));
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
    final gesture = await tester.startGesture(tester.getCenter(f));
    await tester.pump();
    return gesture;
  }

  String modeText(WidgetTester tester) => tester.widget<Text>(find.byKey(const Key('network-mode'))).data!;

  testWidgets('tela inicial mostra status, canal e PTT', (tester) async {
    await pumpApp(tester);
    expect(find.text('Minha comunicação'), findsOneWidget);
    expect(modeText(tester), 'SEM REDE');
    expect(find.text('Canal: Equipe OFF'), findsOneWidget);
    expect(find.text('SEGURE\nPARA FALAR'), findsOneWidget);
  });

  testWidgets('simulação altera o modo ONLINE / MESH / SEM REDE', (tester) async {
    await pumpApp(tester);

    await tapKey(tester, 'sim-peers-plus');
    await tapKey(tester, 'sim-peers-plus');
    await tapKey(tester, 'sim-peers-plus');
    expect(modeText(tester), 'MESH');
    expect(find.text('3 aparelhos conectados'), findsOneWidget);

    await tapKey(tester, 'sim-internet');
    expect(modeText(tester), 'ONLINE');
    expect(find.text('Internet disponível'), findsWidgets);
  });

  testWidgets('PTT reage no toque e volta ao soltar', (tester) async {
    await pumpApp(tester);
    final gesture = await holdPtt(tester);
    expect(find.text('SEM ROTA'), findsOneWidget);
    expect(find.textContaining('Voz ao vivo indisponível'), findsOneWidget);
    await gesture.up();
    await tester.pump();
    expect(find.text('SEGURE\nPARA FALAR'), findsOneWidget);
  });

  testWidgets('PTT com rede mostra a rota e deixa claro que o áudio não existe ainda', (tester) async {
    await pumpApp(tester);
    await tapKey(tester, 'sim-peers-plus');
    final gesture = await holdPtt(tester);
    expect(find.text('PRESSIONADO'), findsOneWidget);
    expect(find.textContaining('MESH (rede local)'), findsOneWidget);
    expect(find.textContaining('ainda não implementada'), findsOneWidget);
    await gesture.up();
    await tester.pumpAndSettle();
  });

  testWidgets('troca de canal pela lista', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byKey(const Key('channel-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Viagem'));
    await tester.pumpAndSettle();
    expect(find.text('Canal: Viagem'), findsOneWidget);
  });
}
