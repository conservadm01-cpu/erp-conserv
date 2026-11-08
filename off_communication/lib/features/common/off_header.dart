import 'package:flutter/material.dart';

import '../../app/off_theme.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';

/// Cabeçalho com a marca e o modo de rede atual (automático, não é chave).
class OffHeader extends StatelessWidget {
  const OffHeader({super.key, required this.coordinator});

  final ConnectivityCoordinator coordinator;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(color: OffColors.lime, borderRadius: BorderRadius.circular(13)),
        child: const Icon(Icons.graphic_eq, color: OffColors.ink, size: 27),
      ),
      const SizedBox(width: 12),
      const Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('OFF', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 2)),
          Text('COMMUNICATION',
              style: TextStyle(fontSize: 9, letterSpacing: 2.1, color: OffColors.muted, fontWeight: FontWeight.bold)),
        ]),
      ),
      StreamBuilder<ConnectivitySnapshot>(
        stream: coordinator.snapshots,
        initialData: coordinator.current,
        builder: (context, snap) => ModePill(mode: (snap.data ?? coordinator.current).mode),
      ),
    ]);
  }
}

class ModePill extends StatelessWidget {
  const ModePill({super.key, required this.mode});
  final NetworkMode mode;

  static (String, Color) style(NetworkMode mode) => switch (mode) {
        NetworkMode.online => ('ONLINE', OffColors.online),
        NetworkMode.mesh => ('MESH', OffColors.mesh),
        NetworkMode.isolated => ('SEM REDE', OffColors.isolated),
      };

  @override
  Widget build(BuildContext context) {
    final (label, color) = style(mode);
    return Semantics(
      label: 'Rede ativa: $label',
      child: Container(
        key: const Key('mode-pill'),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(color: color.withValues(alpha: .13), borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.circle, size: 7, color: color),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        ]),
      ),
    );
  }
}
