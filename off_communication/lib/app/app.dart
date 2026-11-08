import 'package:flutter/material.dart';

import '../features/shell/main_shell.dart';
import 'off_services.dart';
import 'off_theme.dart';

class OffCommunicationApp extends StatefulWidget {
  const OffCommunicationApp({super.key, this.services});

  /// Injetável para testes; por padrão cria os serviços reais/simulados.
  final OffServices? services;

  @override
  State<OffCommunicationApp> createState() => _OffCommunicationAppState();
}

class _OffCommunicationAppState extends State<OffCommunicationApp> with WidgetsBindingObserver {
  late final OffServices _services = widget.services ?? OffServices();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // App indo para segundo plano libera a palavra: não prender o canal.
    if (state != AppLifecycleState.resumed) _services.ptt.release();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (widget.services == null) _services.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OFF Communication',
      debugShowCheckedModeBanner: false,
      theme: buildOffTheme(),
      home: MainShell(services: _services),
    );
  }
}
