/// Contratos de persistência local (implementação SQLite na Fase B, conforme
/// o modelo de dados do docs/CLAUDE_MASTER_PROMPT.md §6).
library;

/// Identidade local do aparelho. Na fase de segurança passa a guardar o par
/// de chaves (chave privada no Keystore/Keychain, nunca em SQLite).
abstract interface class IdentityStore {
  /// ID pseudônimo, gerado uma vez por instalação.
  Future<String> localPeerId();
}

enum DeliveryState { pending, forwarding, delivered, expired, failed }

class StoredMessage {
  const StoredMessage({
    required this.messageId,
    required this.channelId,
    required this.senderPeerId,
    required this.createdAt,
    required this.expiresAt,
    required this.state,
    this.payloadRef,
    this.hopCount = 0,
  });

  final String messageId;
  final String channelId;
  final String senderPeerId;
  final DateTime createdAt;
  final DateTime expiresAt;
  final DeliveryState state;

  /// Caminho do arquivo de áudio (nunca o áudio dentro do banco).
  final String? payloadRef;
  final int hopCount;
}

/// Mensagens e fila store-and-forward.
abstract interface class MessageRepository {
  /// Idempotente por [StoredMessage.messageId]: gravar duas vezes não duplica.
  Future<void> upsert(StoredMessage message);

  Future<List<StoredMessage>> pendingForChannel(String channelId);

  Future<void> markState(String messageId, DeliveryState state);

  /// Remove mensagens expiradas e aplica limites de armazenamento.
  Future<int> purgeExpired(DateTime now);
}

/// Cache de pacotes já vistos, para deduplicação na malha.
abstract interface class SeenPacketStore {
  /// Retorna `true` se o ID é novo (e o registra); `false` se já foi visto.
  Future<bool> markSeen(String messageId, DateTime expiresAt);
}
