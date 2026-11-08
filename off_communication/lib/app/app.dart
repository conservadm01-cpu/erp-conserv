import 'package:flutter/material.dart';

import '../communication/coordinator/connectivity_coordinator.dart';
import '../features/channels/channel_repository.dart';
import '../features/home/home_screen.dart';
import '../features/network_status/simulated_connectivity.dart';
import 'off_colors.dart';

class OffCommunicationApp extends StatefulWidget {
  const OffCommunicationApp({super.key});

  @override
  State<OffCommunicationApp> createState() => _OffCommunicationAppState();
}

class _OffCommunicationAppState extends State<OffCommunicationApp> {
  // Fase A: estado de rede simulado. Na Fase B/C o coordenador passa a ser
  // alimentado por LanTransport/OnlineTransport via updateFromTransports().
  final _coordinator = ConnectivityCoordinator();
  late final _simulation = SimulatedConnectivity(_coordinator);

  @override
  void dispose() {
    _coordinator.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OFF Communication',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: OffColors.brand),
        useMaterial3: true,
        scaffoldBackgroundColor: OffColors.background,
      ),
      home: HomeScreen(
        coordinator: _coordinator,
        channels: const DemoChannelRepository(),
        simulation: _simulation,
      ),
    );
  }
}
