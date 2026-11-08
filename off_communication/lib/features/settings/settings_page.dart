import 'package:flutter/material.dart';

import '../../app/off_services.dart';
import '../../app/off_theme.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';
import '../common/off_header.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.services});
  final OffServices services;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  OffServices get s => widget.services;

  Future<void> _toggleDemoSpeaker(bool on) async {
    if (on) {
      final ok = await s.demoSpeaker.start(s.ptt.channelId);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('O canal já está ocupado. Solte o PTT e tente de novo.')));
      }
    } else {
      await s.demoSpeaker.stop();
    }
    if (mounted) setState(() {});
  }

  void _soon(String title) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('$title: módulo previsto para as próximas etapas.')));
  }

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(20), children: [
      OffHeader(coordinator: s.coordinator),
      const SizedBox(height: 26),
      const Text('CONFIGURAÇÕES', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
      const SizedBox(height: 15),
      _LabCard(services: s, onToggleSpeaker: _toggleDemoSpeaker),
      const SizedBox(height: 15),
      _item(Icons.person_outline, 'Meu perfil', 'Nome, foto e identificação'),
      _item(Icons.lock_outline, 'Privacidade e segurança', 'Permissões e criptografia'),
      _item(Icons.notifications_none, 'Notificações', 'Alertas de chamadas e mensagens'),
      _item(Icons.storage_outlined, 'Armazenamento offline', 'Mensagens e mapas baixados'),
      _item(Icons.battery_saver_outlined, 'Repetição e bateria', 'Quando este aparelho retransmite para outros'),
      _item(Icons.info_outline, 'Sobre o OFF', 'Versão de protótipo 0.3.0'),
      const SizedBox(height: 16),
      const Text('OFF COMMUNICATION • MVP 0.3',
          style: TextStyle(color: OffColors.muted, fontSize: 9, letterSpacing: 1.2)),
    ]);
  }

  Widget _item(IconData icon, String title, String subtitle) => Card(
        child: ListTile(
          leading: Icon(icon, color: OffColors.lime),
          title: Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
          subtitle: Text(subtitle, style: const TextStyle(fontSize: 10, color: OffColors.muted)),
          trailing: const Icon(Icons.chevron_right, color: OffColors.muted),
          onTap: () => _soon(title),
        ),
      );
}

/// Laboratório de teste: substitui a chave manual online/offline da v0.2.
/// Na versão final o modo é detectado sozinho; aqui ele é simulado.
class _LabCard extends StatelessWidget {
  const _LabCard({required this.services, required this.onToggleSpeaker});

  final OffServices services;
  final ValueChanged<bool> onToggleSpeaker;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: OffColors.simulation.withValues(alpha: .07),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: OffColors.simulation.withValues(alpha: .4)),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
        child: StreamBuilder<ConnectivitySnapshot>(
          stream: services.coordinator.snapshots,
          initialData: services.coordinator.current,
          builder: (context, snap) {
            final c = snap.data ?? services.coordinator.current;
            return AnimatedBuilder(
              animation: services.ptt,
              builder: (context, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('LABORATÓRIO DE TESTE (SIMULAÇÃO)',
                    style: TextStyle(
                        fontSize: 10.5, fontWeight: FontWeight.w900, letterSpacing: 1.2, color: OffColors.simulation)),
                const SizedBox(height: 2),
                const Text('O modo de rede é escolhido sozinho pelo app. Aqui você simula as condições.',
                    style: TextStyle(fontSize: 10.5, color: OffColors.muted)),
                SwitchListTile(
                  key: const Key('sim-internet'),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Internet disponível', style: TextStyle(fontSize: 13)),
                  value: c.internetAvailable,
                  onChanged: services.simulation.setInternet,
                ),
                Row(children: [
                  const Expanded(child: Text('Aparelhos próximos (malha)', style: TextStyle(fontSize: 13))),
                  IconButton(
                    key: const Key('sim-peers-minus'),
                    tooltip: 'Menos aparelhos',
                    onPressed: c.meshPeers == 0 ? null : () => services.simulation.setMeshPeers(c.meshPeers - 1),
                    icon: const Icon(Icons.remove_circle_outline),
                  ),
                  Text('${c.meshPeers}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  IconButton(
                    key: const Key('sim-peers-plus'),
                    tooltip: 'Mais aparelhos',
                    onPressed: () => services.simulation.setMeshPeers(c.meshPeers + 1),
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ]),
                SwitchListTile(
                  key: const Key('sim-speaker'),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Carlos falando no canal ativo', style: TextStyle(fontSize: 13)),
                  subtitle: const Text('Testa "canal ocupado": um transmissor por vez',
                      style: TextStyle(fontSize: 10, color: OffColors.muted)),
                  value: services.demoSpeaker.isTalkingOn(services.ptt.channelId),
                  onChanged: onToggleSpeaker,
                ),
              ]),
            );
          },
        ),
      ),
    );
  }
}
