import 'dart:typed_data';

/// Contratos do pipeline de áudio (Fase B, depois do transporte de texto):
/// microfone → PCM → Opus (mono, 16/24 kHz, frames de 20 ms) → rede →
/// jitter buffer → Opus decode → alto-falante.
///
/// Nenhuma implementação existe ainda. A biblioteca Opus será escolhida após
/// verificar maturidade, licença e suporte Android/iOS (ver DECISIONS.md).

class AudioFormat {
  const AudioFormat({this.sampleRate = 16000, this.channels = 1, this.frameMs = 20});
  final int sampleRate;
  final int channels;
  final int frameMs;

  int get samplesPerFrame => sampleRate * frameMs ~/ 1000;
}

abstract interface class AudioCapture {
  /// Frames PCM 16-bit little-endian, cada um com [AudioFormat.frameMs].
  Stream<Int16List> start(AudioFormat format);
  Future<void> stop();
}

abstract interface class AudioCodec {
  Uint8List encode(Int16List pcmFrame);

  /// [encoded] nulo = frame perdido (o codec deve fazer ocultação de perda).
  Int16List decode(Uint8List? encoded);
}

abstract interface class AudioOutput {
  Future<void> start(AudioFormat format);
  void play(Int16List pcmFrame);
  Future<void> stop();
}
