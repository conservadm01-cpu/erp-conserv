import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:off_communication/app/app.dart';
import 'package:off_communication/app/off_services.dart';
import 'package:off_communication/features/ptt/ptt_feedback.dart';

void main() {
  late OffServices services;

  Future<void> pumpApp(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.75;
    addTearDown(tester.view.reset);
    services = OffServices(feedback: RecordingPttFeedback());
    addTearDown(services.dispose);
    await tester.pumpWidget(OffCommunicationApp(services: services));
    await tester.pumpAndSettle();
  }

  Future<void> tapKey(WidgetTester tester, String key) async {
    final f = find.byKey(Key(key));
    await tester.ensureVisible(f);
    await tester.pumpAndSettle();
    await tester.tap(f);
    await tester.pumpAndSettle();
  }

  Future<void> goTab(WidgetTester tester, String label) async {
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  String pttLabel(WidgetTester tester) => tester.widget<Text>(find.byKey(const Key('ptt-label'))).data!;

  Future<TestGesture> holdPtt(WidgetTester tester) async {
    final gesture = await tester.startGesture(tester.getCenter(find.byKey(const Key('ptt-button'))));
    await tester.pump();
    return gesture;
  }

  testWidgets('aba Rádio: canal, PTT e status SEM REDE', (tester) async {
    await pumpApp(tester);
    expect(find.text('Equipe OFF'), findsOneWidget);
    expect(pttLabel(tester), 'SEGURE');
    expect(find.text('SEM REDE'), findsOneWidget);
    expect(find.text('SIMULADO'), findsOneWidget);
  });

  testWidgets('sem rede o PTT mostra SEM ROTA e volta ao soltar', (tester) async {
    await pumpApp(tester);
    final g = await holdPtt(tester);
    expect(pttLabel(tester), 'SEM ROTA');
    await g.up();
    await tester.pump();
    expect(pttLabel(tester), 'SEGURE');
  });

  testWidgets('laboratório em Ajustes muda o modo; PTT fala via MESH', (tester) async {
    await pumpApp(tester);
    await goTab(tester, 'Ajustes');
    await tapKey(tester, 'sim-peers-plus');
    await tapKey(tester, 'sim-peers-plus');
    await goTab(tester, 'Rádio');
    expect(find.text('MESH'), findsWidgets);
    expect(find.text('2 aparelhos conectados'), findsOneWidget);
    final g = await holdPtt(tester);
    await tester.pump();
    expect(pttLabel(tester), 'FALANDO');
    expect(find.textContaining('Rota MESH'), findsOneWidget);
    await g.up();
    await tester.pumpAndSettle();
    expect(pttLabel(tester), 'SEGURE');
  });

  testWidgets('outro participante falando: OUVINDO e PTT negado', (tester) async {
    await pumpApp(tester);
    await goTab(tester, 'Ajustes');
    await tapKey(tester, 'sim-internet');
    await tapKey(tester, 'sim-speaker');
    await goTab(tester, 'Rádio');
    expect(pttLabel(tester), 'OUVINDO');
    expect(find.text('Carlos falando'), findsOneWidget);
    final g = await holdPtt(tester);
    await tester.pump();
    expect(pttLabel(tester), 'OCUPADO');
    expect(find.textContaining('Carlos está falando'), findsOneWidget);
    await g.up();
    await tester.pumpAndSettle();
    await goTab(tester, 'Ajustes');
    await tapKey(tester, 'sim-speaker');
    await goTab(tester, 'Rádio');
    expect(pttLabel(tester), 'SEGURE');
  });

  testWidgets('Grupos abre o canal escolhido na aba Rádio', (tester) async {
    await pumpApp(tester);
    await goTab(tester, 'Grupos');
    await tester.tap(find.text('Viagem'));
    await tester.pumpAndSettle();
    expect(tester.widget<Text>(find.byKey(const Key('channel-name'))).data, 'Viagem');
  });

  testWidgets('localização começa desligada e pede confirmação', (tester) async {
    await pumpApp(tester);
    await goTab(tester, 'Localização');
    final sw = find.byKey(const Key('share-location'));
    expect(tester.widget<SwitchListTile>(sw).value, isFalse);
    await tester.tap(sw);
    await tester.pumpAndSettle();
    expect(find.text('Compartilhar localização?'), findsOneWidget);
    await tester.tap(find.text('Agora não'));
    await tester.pumpAndSettle();
    expect(tester.widget<SwitchListTile>(sw).value, isFalse);
    await tester.tap(sw);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Compartilhar'));
    await tester.pumpAndSettle();
    expect(tester.widget<SwitchListTile>(sw).value, isTrue);
  });

  testWidgets('trocar canal pela lista', (tester) async {
    await pumpApp(tester);
    await tester.tap(find.byKey(const Key('channel-picker')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Canal 02'));
    await tester.pumpAndSettle();
    expect(tester.widget<Text>(find.byKey(const Key('channel-name'))).data, 'Canal 02');
  });

  testWidgets('cabe em celular pequeno (360x640) em todas as abas e estados', (tester) async {
    tester.view.physicalSize = const Size(720, 1280);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    services = OffServices(feedback: RecordingPttFeedback());
    addTearDown(services.dispose);
    services.simulation.setInternet(true);
    services.simulation.setMeshPeers(12);
    await tester.pumpWidget(OffCommunicationApp(services: services));
    await tester.pumpAndSettle();
    final g = await holdPtt(tester);
    await tester.pump();
    expect(pttLabel(tester), 'FALANDO');
    await g.up();
    await tester.pumpAndSettle();
    for (final tab in ['Grupos', 'Localização', 'Ajustes', 'Rádio']) {
      await goTab(tester, tab);
      expect(tester.takeException(), isNull, reason: 'aba $tab');
    }
  });
}
