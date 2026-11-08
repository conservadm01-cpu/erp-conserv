import 'package:flutter/material.dart';

import '../../app/off_colors.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';
import '../channels/channel_repository.dart';
import '../network_status/network_status_card.dart';
import '../network_status/simulated_connectivity.dart';
import '../ptt/ptt_button.dart';
import '../ptt/ptt_controller.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.coordinator,
    required this.channels,
    this.simulation,
  });

  final ConnectivityCoordinator coordinator;
  final ChannelRepository channels;

  /// Painel de simulação (Fase A). Nulo quando houver transportes reais.
  final SimulatedConnectivity? simulation;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final PttController _ptt = PttController(widget.coordinator);
  List<OffChannel> _channels = const [];
  OffChannel? _selected;

  @override
  void initState() {
    super.initState();
    widget.channels.listChannels().then((list) {
      if (!mounted) return;
      setState(() {
        _channels = list;
        _selected = list.isEmpty ? null : list.first;
      });
    });
  }

  @override
  void dispose() {
    _ptt.dispose();
    super.dispose();
  }

  Future<void> _pickChannel() async {
    final picked = await showModalBottomSheet<OffChannel>(
      context: context,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            const ListTile(title: Text('Canais', style: TextStyle(fontWeight: FontWeight.bold))),
            for (final c in _channels)
              ListTile(
                leading: Icon(c.isPrivate ? Icons.lock_outline : Icons.radio),
                title: Text(c.name),
                subtitle: const Text('Canal de demonstração'),
                selected: c.id == _selected?.id,
                onTap: () => Navigator.pop(context, c),
              ),
          ],
        ),
      ),
    );
    if (picked != null) setState(() => _selected = picked);
  }

  void _notYet(String feature) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text('$feature: ainda não implementado (próximas fases).')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: OffColors.brand,
        foregroundColor: Colors.white,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('OFF COMMUNICATION', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 1.1)),
            Text('INTERNET OU MESH • SEMPRE O MELHOR CAMINHO', style: TextStyle(fontSize: 10, letterSpacing: 1.2)),
          ],
        ),
      ),
      body: StreamBuilder<ConnectivitySnapshot>(
        stream: widget.coordinator.snapshots,
        initialData: widget.coordinator.current,
        builder: (context, snap) {
          final connectivity = snap.data ?? widget.coordinator.current;
          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            children: [
              const Text('Minha comunicação', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              NetworkStatusCard(snapshot: connectivity),
              const SizedBox(height: 10),
              Card(
                child: ListTile(
                  key: const Key('channel-picker'),
                  leading: CircleAvatar(child: Icon(_selected?.isPrivate == true ? Icons.lock_outline : Icons.radio)),
                  title: Text('Canal: ${_selected?.name ?? '—'}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('Toque para trocar de canal'),
                  trailing: const Icon(Icons.expand_more),
                  onTap: _channels.isEmpty ? null : _pickChannel,
                ),
              ),
              const SizedBox(height: 24),
              Center(
                child: AnimatedBuilder(animation: _ptt, builder: (context, _) => PttButton(controller: _ptt)),
              ),
              const SizedBox(height: 14),
              AnimatedBuilder(
                animation: _ptt,
                builder: (context, _) => Text(
                  _pttHint(_ptt),
                  key: const Key('ptt-hint'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: Colors.black87),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _QuickAction(icon: Icons.mic_none, label: 'Gravar voz', onTap: () => _notYet('Gravar voz')),
                  _QuickAction(
                      icon: Icons.people_outline, label: 'Participantes', onTap: () => _notYet('Participantes')),
                  _QuickAction(icon: Icons.sos, label: 'SOS', onTap: () => _notYet('SOS')),
                ],
              ),
              if (widget.simulation != null) ...[
                const SizedBox(height: 16),
                _SimulationPanel(simulation: widget.simulation!, snapshot: connectivity),
              ],
              const SizedBox(height: 14),
              const Text(
                'Protótipo Fase A • rede simulada • áudio, malha e criptografia ainda não implementados',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 10, color: Colors.black54),
              ),
            ],
          );
        },
      ),
    );
  }

  static String _pttHint(PttController ptt) {
    final route = ptt.route;
    switch (ptt.state) {
      case PttState.idle:
        return 'Segure o botão para falar no canal.';
      case PttState.pressed:
        final via = route?.route == RouteKind.online ? 'ONLINE (WebRTC)' : 'MESH (rede local)';
        return 'Rota escolhida: $via — ${route?.reason}.\nTransmissão de áudio ainda não implementada.';
      case PttState.noRoute:
        return '${route?.reason}.\nVoz ao vivo indisponível; use "Gravar voz" para deixar na fila.';
    }
  }
}

class _SimulationPanel extends StatelessWidget {
  const _SimulationPanel({required this.simulation, required this.snapshot});

  final SimulatedConnectivity simulation;
  final ConnectivitySnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFFFFF7E6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('SIMULAÇÃO DE REDE (teste da interface)',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
            ),
            SwitchListTile(
              key: const Key('sim-internet'),
              contentPadding: EdgeInsets.zero,
              title: const Text('Internet disponível'),
              value: snapshot.internetAvailable,
              onChanged: simulation.setInternet,
            ),
            Row(
              children: [
                const Expanded(child: Text('Aparelhos próximos')),
                IconButton(
                  key: const Key('sim-peers-minus'),
                  onPressed: snapshot.meshPeers == 0 ? null : () => simulation.setMeshPeers(snapshot.meshPeers - 1),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('${snapshot.meshPeers}', style: const TextStyle(fontWeight: FontWeight.bold)),
                IconButton(
                  key: const Key('sim-peers-plus'),
                  onPressed: () => simulation.setMeshPeers(snapshot.meshPeers + 1),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(children: [
            Icon(icon, size: 26),
            const SizedBox(height: 5),
            Text(label, style: const TextStyle(fontSize: 11)),
          ]),
        ),
      );
}
