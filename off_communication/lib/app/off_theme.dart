import 'package:flutter/material.dart';

/// Identidade visual da v0.2 (fundo escuro + verde-limão), com cores de
/// estado separadas para ONLINE / MESH / SEM REDE / ocupado.
abstract final class OffColors {
  static const ink = Color(0xFF101820);
  static const panel = Color(0xFF1A2732);
  static const panelHigh = Color(0xFF263844);
  static const nav = Color(0xFF15212B);
  static const lime = Color(0xFFB8F34A);
  static const muted = Color(0xFF9AA8B3);
  static const line = Color(0x1AFFFFFF);

  static const online = lime;
  static const mesh = Color(0xFF5CD6C0);
  static const isolated = Color(0xFFFFA94D);
  static const busy = Color(0xFFFF6B5E);
  static const simulation = Color(0xFFFFD166);
}

ThemeData buildOffTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: OffColors.lime, brightness: Brightness.dark).copyWith(
    primary: OffColors.lime,
    onPrimary: OffColors.ink,
    surface: OffColors.ink,
  );
  return ThemeData(
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: OffColors.ink,
    useMaterial3: true,
    cardTheme: const CardThemeData(color: OffColors.panel, margin: EdgeInsets.only(bottom: 9)),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: OffColors.nav,
      indicatorColor: OffColors.lime.withValues(alpha: .16),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? OffColors.ink : null),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? OffColors.lime : null),
    ),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: OffColors.panel),
  );
}

/// Rótulo pequeno em caixa-alta usado nas seções.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(color: OffColors.muted, fontSize: 10, letterSpacing: 1.8, fontWeight: FontWeight.bold),
      );
}
