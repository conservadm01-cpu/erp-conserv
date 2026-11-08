import 'package:flutter/material.dart';

import '../../app/off_services.dart';
import '../../app/off_theme.dart';
import '../channels/channel_repository.dart';
import '../groups/groups_page.dart';
import '../location/location_page.dart';
import '../radio/radio_page.dart';
import '../settings/settings_page.dart';

/// Abas Rádio, Grupos, Localização e Ajustes.
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.services});
  final OffServices services;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tab = 0;
  List<OffChannel> _channels = const [];

  OffServices get s => widget.services;

  @override
  void initState() {
    super.initState();
    s.channels.listChannels().then((list) {
      if (mounted) setState(() => _channels = list);
    });
  }

  Future<void> _pickChannel() async {
    final picked = await showModalBottomSheet<OffChannel>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Padding(
            padding: EdgeInsets.all(18),
            child: Text('Selecionar canal', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          ),
          for (final c in _channels)
            ListTile(
              leading: Icon(c.id == s.ptt.channelId ? Icons.radio_button_checked : Icons.radio_button_off,
                  color: OffColors.lime),
              title: Text(c.name),
              trailing: c.isPrivate ? const Icon(Icons.lock_outline, size: 18, color: OffColors.muted) : null,
              onTap: () => Navigator.pop(context, c),
            ),
          const SizedBox(height: 12),
        ]),
      ),
    );
    if (picked != null) await s.ptt.selectChannel(picked.id);
  }

  Future<void> _openChannel(OffChannel c) async {
    await s.ptt.selectChannel(c.id);
    if (mounted) setState(() => _tab = 0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(index: _tab, children: [
          RadioPage(services: s, channels: _channels, onPickChannel: _pickChannel),
          GroupsPage(services: s, channels: _channels, onOpenChannel: _openChannel),
          LocationPage(services: s),
          SettingsPage(services: s),
        ]),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (v) {
          // Trocar de aba com o dedo no PTT não deve deixar a palavra presa.
          s.ptt.release();
          setState(() => _tab = v);
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.radio), label: 'Rádio'),
          NavigationDestination(icon: Icon(Icons.groups_2_outlined), label: 'Grupos'),
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Localização'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), label: 'Ajustes'),
        ],
      ),
    );
  }
}
