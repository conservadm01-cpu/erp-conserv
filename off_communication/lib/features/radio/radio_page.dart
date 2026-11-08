import 'package:flutter/material.dart';

import '../../app/off_services.dart';
import '../../app/off_theme.dart';
import '../../communication/coordinator/connectivity_coordinator.dart';
import '../channels/channel_repository.dart';
import '../common/off_header.dart';
import '../network_status/network_status_card.dart';
import '../ptt/ptt_button.dart';
import '../ptt/ptt_controller.dart';

class RadioPage extends StatelessWidget {
  const RadioPage({super.key, required this.services, required this.channels, required this.onPickChannel});

  final OffServices services;
  final List<OffChannel> channels;
  final VoidCallback onPickChannel;

  @override
  Widget build(BuildContext context) {
    final ptt = services.ptt;
    return CustomScrollView(slivers: [
      SliverFillRemaining(
        hasScrollBody: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
          child: AnimatedBuilder(
            animation: ptt,
            builder: (context, _) {
              final channel = channels.where((c) => c.id == ptt.channelId).firstOrNull;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                OffHeader(coordinator: services.coordinator),
                const SizedBox(height: 22),
                const SectionLabel('CANAL ATIVO'),
                const SizedBox(height: 9),
                _ChannelTile(channel: channel, onTap: onPickChannel, busySpeaker: ptt.currentSpeaker?.holderName),
                const SizedBox(height: 18),
                Expanded(
                  child: Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Text(
                        _headline(ptt),
                        style: TextStyle(
                            color: _headlineColor(ptt), fontSize: 11, letterSpacing: 2, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 14),
                      PttButton(controller: ptt),
                      const SizedBox(height: 14),
                      Text(
                        _status(ptt),
                        key: const Key('ptt-status'),
                        textAlign: TextAlign.center,
                        style: TextStyle(color: _headlineColor(ptt), fontSize: 11.5),
                      ),
                      const SizedBox(height: 5),
                      const Text('Um participante por vez • segure para falar • limite de 60 s',
                          textAlign: TextAlign.center, style: TextStyle(color: OffColors.muted, fontSize: 10)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),
                StreamBuilder<ConnectivitySnapshot>(
                  stream: services.coordinator.snapshots,
                  initialData: services.coordinator.current,
                  builder: (context, snap) => NetworkStatusCard(
                    snapshot: snap.data ?? services.coordinator.current,
                    simulated: true,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Protótipo v0.3 • rede simulada em Ajustes • a voz ainda não é captada nem enviada',
                  style: TextStyle(fontSize: 9.5, color: OffColors.muted),
                ),
              ]);
            },
          ),
        ),
      ),
    ]);
  }

  static String _headline(PttController p) => switch (p.state) {
        PttState.talking => 'COM A PALAVRA',
        PttState.requesting => 'PEDINDO A VEZ…',
        PttState.busy => 'CANAL OCUPADO',
        PttState.noRoute => 'SEM ROTA',
        PttState.idle when p.channelBusy => 'OUVINDO',
        PttState.idle => 'APERTE PARA FALAR',
      };

  static Color _headlineColor(PttController p) => switch (p.state) {
        PttState.talking => OffColors.lime,
        PttState.busy => OffColors.busy,
        PttState.noRoute => OffColors.isolated,
        PttState.idle when p.channelBusy => OffColors.busy,
        _ => OffColors.muted,
      };

  static String _status(PttController p) {
    final route = p.route;
    final speaker = p.currentSpeaker?.holderName;
    switch (p.state) {
      case PttState.talking:
        final via = route?.route == RouteKind.online ? 'ONLINE' : 'MESH';
        return 'Rota $via • ${route?.reason}.\nSimulação: a voz ainda não é transmitida.';
      case PttState.requesting:
        return 'Pedindo a vez no canal…';
      case PttState.busy:
        return '${speaker ?? 'Outra pessoa'} está falando. Solte e aguarde o canal liberar.';
      case PttState.noRoute:
        final lost = p.lastEnd == TalkEndReason.routeLost ? 'A rede caiu durante a fala. ' : '';
        return '$lost${route?.reason ?? 'Sem rota'}.\nVoz ao vivo indisponível.';
      case PttState.idle:
        if (speaker != null) return '$speaker está falando agora.';
        if (p.lastEnd == TalkEndReason.maxTalk) return 'Tempo máximo de fala atingido. Aperte de novo para continuar.';
        return 'Canal livre';
    }
  }
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({required this.channel, required this.onTap, this.busySpeaker});

  final OffChannel? channel;
  final VoidCallback onTap;
  final String? busySpeaker;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: OffColors.panel,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: const Key('channel-picker'),
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: OffColors.line)),
          child: Row(children: [
            Container(
              width: 44,
              height: 44,
              decoration:
                  BoxDecoration(color: OffColors.lime.withValues(alpha: .14), borderRadius: BorderRadius.circular(13)),
              child: Icon(channel?.isPrivate == true ? Icons.lock_outline : Icons.campaign, color: OffColors.lime),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(channel?.name ?? '—',
                    key: const Key('channel-name'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 3),
                Text(
                  busySpeaker != null ? '$busySpeaker falando' : 'Toque para trocar de canal',
                  style: TextStyle(color: busySpeaker != null ? OffColors.busy : OffColors.muted, fontSize: 11),
                ),
              ]),
            ),
            const Icon(Icons.keyboard_arrow_down, color: OffColors.muted),
          ]),
        ),
      ),
    );
  }
}
