import 'package:flutter/services.dart';

/// Retorno local do PTT (som/vibração) ao começar, terminar e quando o canal
/// está ocupado. Interface separada para testes não chamarem a plataforma.
abstract interface class PttFeedback {
  Future<void> talkStarted();
  Future<void> talkEnded();
  Future<void> denied();
}

/// Usa o som de clique e a vibração do sistema.
///
/// Limitações: o clique de sistema depende das configurações do aparelho
/// (modo silencioso, "sons ao tocar"), e no iOS o `SystemSound.click` pode não
/// tocar. Os bipes próprios de rádio (início/fim) entram junto com o pipeline
/// de áudio, porque precisam respeitar a sessão de áudio e o Bluetooth.
class SystemPttFeedback implements PttFeedback {
  const SystemPttFeedback();

  @override
  Future<void> talkStarted() async {
    await HapticFeedback.heavyImpact();
    await SystemSound.play(SystemSoundType.click);
  }

  @override
  Future<void> talkEnded() async {
    await HapticFeedback.lightImpact();
    await SystemSound.play(SystemSoundType.click);
  }

  @override
  Future<void> denied() => HapticFeedback.vibrate();
}

/// Sem som nem vibração; registra chamadas (testes).
class RecordingPttFeedback implements PttFeedback {
  final calls = <String>[];

  @override
  Future<void> talkStarted() async => calls.add('start');

  @override
  Future<void> talkEnded() async => calls.add('end');

  @override
  Future<void> denied() async => calls.add('denied');
}
