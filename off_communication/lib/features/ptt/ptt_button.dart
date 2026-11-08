import 'package:flutter/material.dart';

import '../../app/off_theme.dart';
import 'ptt_controller.dart';

/// Botão hold-to-talk. Usa [Listener] (ponteiro baixo/cima/cancelado) para
/// reagir no instante do toque, sem o atraso de gestos de toque/long-press, e
/// para sempre soltar a palavra se o sistema cancelar o toque.
class PttButton extends StatelessWidget {
  const PttButton({super.key, required this.controller, this.size = 190});

  final PttController controller;
  final double size;

  @override
  Widget build(BuildContext context) {
    final s = controller.state;
    final talking = s == PttState.talking;
    final (fill, accent, icon, label) = switch (s) {
      PttState.talking => (OffColors.lime, OffColors.ink, Icons.mic, 'FALANDO'),
      PttState.requesting => (OffColors.panelHigh, OffColors.lime, Icons.mic, 'AGUARDE'),
      PttState.busy => (OffColors.busy.withValues(alpha: .18), OffColors.busy, Icons.voice_over_off, 'OCUPADO'),
      PttState.noRoute => (OffColors.panelHigh, OffColors.isolated, Icons.mic_off, 'SEM ROTA'),
      PttState.idle when controller.channelBusy => (OffColors.panelHigh, OffColors.busy, Icons.hearing, 'OUVINDO'),
      PttState.idle => (OffColors.panelHigh, OffColors.lime, Icons.mic, 'SEGURE'),
    };
    final ring = s == PttState.idle && !controller.channelBusy ? OffColors.lime : accent;
    final grow = talking ? size * 1.08 : size;

    return Semantics(
      button: true,
      label: 'Push-to-talk. Segure para falar, solte para ouvir.',
      value: label,
      child: Listener(
        key: const Key('ptt-button'),
        onPointerDown: (_) => controller.press(),
        onPointerUp: (_) => controller.release(),
        onPointerCancel: (_) => controller.release(),
        child: SizedBox(
          width: size * 1.1,
          height: size * 1.1,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: grow,
              height: grow,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: fill,
                border: Border.all(color: ring.withValues(alpha: .75), width: 2),
                boxShadow: [
                  BoxShadow(
                    color: (talking ? OffColors.lime : ring).withValues(alpha: talking ? .28 : .08),
                    blurRadius: talking ? 42 : 20,
                    spreadRadius: talking ? 7 : 2,
                  ),
                ],
              ),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(icon, size: 54, color: talking ? OffColors.ink : accent),
                const SizedBox(height: 8),
                Text(label,
                    key: const Key('ptt-label'),
                    style: TextStyle(
                        color: talking ? OffColors.ink : Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
