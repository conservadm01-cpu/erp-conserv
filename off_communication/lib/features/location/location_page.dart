import 'package:flutter/material.dart';

import '../../app/off_services.dart';
import '../../app/off_theme.dart';
import '../common/off_header.dart';

/// OFF Location — só interface. Compartilhamento DESLIGADO por padrão:
/// localização exige consentimento explícito (prompt mestre §5).
class LocationPage extends StatefulWidget {
  const LocationPage({super.key, required this.services});
  final OffServices services;

  @override
  State<LocationPage> createState() => _LocationPageState();
}

class _LocationPageState extends State<LocationPage> {
  bool _share = false;

  Future<void> _toggle(bool value) async {
    if (!value) {
      setState(() => _share = false);
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: OffColors.panel,
        title: const Text('Compartilhar localização?'),
        content: const Text(
          'Os participantes do canal ativo poderão ver sua posição enquanto esta opção estiver ligada. '
          'Você pode desligar a qualquer momento.\n\n'
          'Protótipo: a localização ainda não é lida nem enviada.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Agora não')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Compartilhar')),
        ],
      ),
    );
    if (ok == true && mounted) setState(() => _share = true);
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(slivers: [
      SliverFillRemaining(
        hasScrollBody: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            OffHeader(coordinator: widget.services.coordinator),
            const SizedBox(height: 24),
            const Text('OFF LOCATION', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Sua equipe no mapa. Mapas offline e posição pela malha estão planejados.',
                style: TextStyle(color: OffColors.muted)),
            const SizedBox(height: 18),
            Expanded(
              child: Container(
                constraints: const BoxConstraints(minHeight: 220),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: OffColors.panel,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: OffColors.line),
                ),
                child: Stack(children: [
                  Positioned.fill(child: CustomPaint(painter: _MapGridPainter())),
                  const Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.map_outlined, size: 58, color: OffColors.lime),
                      SizedBox(height: 12),
                      Text('MAPA OFFLINE', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                      SizedBox(height: 6),
                      Text('A área do mapa será baixada\napós configurar a região',
                          textAlign: TextAlign.center, style: TextStyle(color: OffColors.muted, fontSize: 11)),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            SwitchListTile(
              key: const Key('share-location'),
              contentPadding: const EdgeInsets.symmetric(horizontal: 4),
              value: _share,
              onChanged: _toggle,
              title: const Text('Compartilhar minha localização',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text(
                _share ? 'Ligado para o canal ativo (simulação)' : 'Desligado • só com sua autorização',
                style: const TextStyle(color: OffColors.muted, fontSize: 10),
              ),
            ),
            const Text(
              'Frequência pretendida: a cada 10 s com o app aberto, sujeita às permissões e à economia de bateria do sistema.',
              style: TextStyle(color: OffColors.muted, fontSize: 10),
            ),
          ]),
        ),
      ),
    ]);
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = Colors.white.withValues(alpha: .045)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 34) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), p);
    }
    for (double y = 0; y < size.height; y += 34) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), p);
    }
    final road = Paint()
      ..color = OffColors.lime.withValues(alpha: .10)
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(Offset(size.width * .1, size.height * .8), Offset(size.width * .45, size.height * .48), road);
    canvas.drawLine(Offset(size.width * .45, size.height * .48), Offset(size.width * .85, size.height * .22), road);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
