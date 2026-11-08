import 'package:flutter/material.dart';

import '../../app/off_theme.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';

/// "OFF Network Status": os dois caminhos e qual está em uso.
class NetworkStatusCard extends StatelessWidget {
  const NetworkStatusCard({super.key, required this.snapshot, this.simulated = false});

  final ConnectivitySnapshot snapshot;

  /// Mostra o selo "SIMULADO" enquanto a rede não for detectada de verdade.
  final bool simulated;

  @override
  Widget build(BuildContext context) {
    final peers = snapshot.meshPeers;
    return Row(children: [
      Expanded(
        child: _PathTile(
          key: const Key('path-online'),
          icon: Icons.public,
          title: 'ONLINE',
          subtitle: snapshot.internetAvailable ? 'Internet disponível' : 'Sem internet',
          active: snapshot.mode == NetworkMode.online,
          available: snapshot.internetAvailable,
          color: OffColors.online,
        ),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: _PathTile(
          key: const Key('path-mesh'),
          icon: Icons.hub_outlined,
          title: 'MESH',
          subtitle: switch (peers) {
            0 => 'Nenhum aparelho próximo',
            1 => '1 aparelho conectado',
            _ => '$peers aparelhos conectados',
          },
          active: snapshot.mode == NetworkMode.mesh,
          available: peers > 0,
          color: OffColors.mesh,
          badge: simulated ? 'SIMULADO' : null,
        ),
      ),
    ]);
  }
}

class _PathTile extends StatelessWidget {
  const _PathTile({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.active,
    required this.available,
    required this.color,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  /// Caminho em uso agora.
  final bool active;

  /// Caminho existe (pode estar disponível sem ser o escolhido).
  final bool available;
  final Color color;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final c = available ? color : OffColors.muted;
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: OffColors.panel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: active ? color : OffColors.line, width: active ? 1.6 : 1),
      ),
      child: Row(children: [
        Icon(icon, color: c, size: 20),
        const SizedBox(width: 8),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(title, style: TextStyle(fontWeight: FontWeight.w900, color: c, fontSize: 11, letterSpacing: 1)),
              if (active)
                Text('EM USO',
                    style: TextStyle(fontSize: 8, color: color, fontWeight: FontWeight.bold, letterSpacing: 1)),
            ]),
            const SizedBox(height: 2),
            Text(subtitle,
                style: const TextStyle(fontSize: 10.5, color: OffColors.muted),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            if (badge != null)
              Text(badge!,
                  style: const TextStyle(
                      fontSize: 8, color: OffColors.simulation, fontWeight: FontWeight.bold, letterSpacing: 1)),
          ]),
        ),
      ]),
    );
  }
}
