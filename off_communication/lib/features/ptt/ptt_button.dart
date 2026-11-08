import 'package:flutter/material.dart';

import '../../app/off_colors.dart';
import 'ptt_controller.dart';

/// Botão PTT. Usa [Listener] (ponteiro baixo/cima) em vez de long-press,
/// para reagir no instante do toque — sem o atraso de ~500 ms do gesto de
/// pressionar e segurar — e soltar mesmo se o dedo sair do botão.
class PttButton extends StatelessWidget {
  const PttButton({super.key, required this.controller, this.size = 210});

  final PttController controller;
  final double size;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (controller.state) {
      PttState.idle => (OffColors.pttIdle, 'SEGURE\nPARA FALAR'),
      PttState.pressed => (OffColors.pttActive, 'PRESSIONADO'),
      PttState.noRoute => (OffColors.pttNoRoute, 'SEM ROTA'),
    };

    return Semantics(
      button: true,
      label: 'Botão push-to-talk. Segure para falar.',
      child: Listener(
        key: const Key('ptt-button'),
        onPointerDown: (_) => controller.press(),
        onPointerUp: (_) => controller.release(),
        onPointerCancel: (_) => controller.release(),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: color,
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 22, offset: const Offset(0, 10)),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(controller.state == PttState.noRoute ? Icons.mic_off : Icons.mic, color: Colors.white, size: 54),
              const SizedBox(height: 10),
              Text(label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1)),
            ],
          ),
        ),
      ),
    );
  }
}
