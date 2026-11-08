class LanConfig {
  const LanConfig({
    this.port = 40444,
    this.broadcastAddress = '255.255.255.255',
    this.heartbeatInterval = const Duration(seconds: 2),
    this.peerTimeout = const Duration(seconds: 7),
  });

  /// Porta UDP única para descoberta (heartbeat) e dados no protótipo.
  final int port;

  /// Endereço de broadcast. Em redes com broadcast limitado bloqueado, usar o
  /// broadcast da sub-rede (ex.: 192.168.43.255).
  final String broadcastAddress;

  /// Intervalo do HELLO/heartbeat de descoberta (Fase B).
  final Duration heartbeatInterval;

  /// Sem heartbeat por este tempo, o peer é considerado fora de alcance.
  final Duration peerTimeout;
}
