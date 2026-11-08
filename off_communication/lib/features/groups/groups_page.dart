import 'package:flutter/material.dart';

import '../../app/off_services.dart';
import '../../app/off_theme.dart';
import '../channels/channel_repository.dart';
import '../common/off_header.dart';

class GroupsPage extends StatelessWidget {
  const GroupsPage({super.key, required this.services, required this.channels, required this.onOpenChannel});

  final OffServices services;
  final List<OffChannel> channels;
  final ValueChanged<OffChannel> onOpenChannel;

  // Dados de demonstração até existir descoberta de peers (Fase B).
  static const _demoMembers = {'demo-equipe-off': 5, 'demo-canal-02': 3, 'demo-viagem': 4, 'demo-privado': 8};
  static const _demoContacts = [
    ('Carlos', 'Disponível'),
    ('Mariana', 'Em deslocamento'),
    ('Equipe 03', 'Visto há 2 min'),
  ];

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(20), children: [
      OffHeader(coordinator: services.coordinator),
      const SizedBox(height: 26),
      const SectionLabel('SEUS GRUPOS'),
      const SizedBox(height: 12),
      for (final c in channels)
        Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: const Color(0xFF344A38),
              child: Icon(c.isPrivate ? Icons.lock_outline : Icons.groups, color: OffColors.lime),
            ),
            title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(
              '${_demoMembers[c.id] ?? 0} participantes${c.isPrivate ? ' • privado' : ''}',
              style: const TextStyle(color: OffColors.muted, fontSize: 11),
            ),
            trailing: const Icon(Icons.chevron_right, color: OffColors.muted),
            onTap: () => onOpenChannel(c),
          ),
        ),
      const SizedBox(height: 18),
      const SectionLabel('CONTATOS'),
      const SizedBox(height: 4),
      for (final (name, status) in _demoContacts)
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: CircleAvatar(
            backgroundColor: OffColors.panel,
            child:
                Text(name.substring(0, 1), style: const TextStyle(color: OffColors.lime, fontWeight: FontWeight.bold)),
          ),
          title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(status, style: const TextStyle(color: OffColors.muted, fontSize: 11)),
        ),
      const SizedBox(height: 8),
      const Text(
        'Grupos e contatos de demonstração. A presença real dos aparelhos entra com a descoberta na rede local.',
        style: TextStyle(color: OffColors.muted, fontSize: 10),
      ),
    ]);
  }
}
