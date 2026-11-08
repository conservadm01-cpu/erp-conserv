import 'package:flutter/material.dart';

import '../../app/off_colors.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';

/// "OFF Network Status": mostra qual rede está ativa e os dois caminhos.
class NetworkStatusCard extends StatelessWidget {
  const NetworkStatusCard({super.key, required this.snapshot});

  final ConnectivitySnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final mode = snapshot.mode;
    final (label, color) = switch (mode) {
      NetworkMode.online => ('ONLINE', OffColors.online),
      NetworkMode.mesh => ('MESH', OffColors.mesh),
      NetworkMode.isolated => ('SEM REDE', OffColors.isolated),
    };
    final peers = snapshot.meshPeers;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Rede ativa', style: TextStyle(fontSize: 12, color: Colors.black54)),
            const SizedBox(height: 4),
            Text(label,
                key: const Key('network-mode'),
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 2, color: color)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _PathTile(
                    icon: Icons.public,
                    title: 'ONLINE',
                    subtitle: snapshot.internetAvailable ? 'Internet disponível' : 'Sem internet',
                    active: snapshot.internetAvailable,
                    color: OffColors.online,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _PathTile(
                    icon: Icons.hub_outlined,
                    title: 'MESH',
                    subtitle: switch (peers) {
                      0 => 'Nenhum aparelho próximo',
                      1 => '1 aparelho conectado',
                      _ => '$peers aparelhos conectados',
                    },
                    active: peers > 0,
                    color: OffColors.mesh,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PathTile extends StatelessWidget {
  const _PathTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.active,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool active;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = active ? color : Colors.black38;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.withValues(alpha: 0.5)),
        color: c.withValues(alpha: active ? 0.08 : 0.03),
      ),
      child: Row(
        children: [
          Icon(icon, color: c),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(fontWeight: FontWeight.w800, color: c, fontSize: 12)),
                Text(subtitle, style: const TextStyle(fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
