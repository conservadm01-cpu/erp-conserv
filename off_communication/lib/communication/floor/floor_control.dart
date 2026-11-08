import 'dart:async';
import 'dart:math';

/// Controle de fala (floor control): um transmissor por canal (half-duplex).
/// Ver docs/FLOOR_CONTROL.md.

/// Quem está com a palavra num canal.
class FloorGrant {
  const FloorGrant({
    required this.channelId,
    required this.holderId,
    required this.holderName,
    required this.token,
    required this.grantedAt,
    required this.expiresAt,
  });

  final String channelId;
  final String holderId;
  final String holderName;

  /// Token curto, ligado a usuário + canal. Só quem tem o token libera.
  final String token;
  final DateTime grantedAt;

  /// Limite de fala: depois disso o canal é liberado mesmo sem `release`.
  final DateTime expiresAt;

  bool isExpired(DateTime now) => !now.isBefore(expiresAt);
}

sealed class FloorResult {
  const FloorResult();
}

class FloorGranted extends FloorResult {
  const FloorGranted(this.grant);
  final FloorGrant grant;
}

class FloorDenied extends FloorResult {
  const FloorDenied(this.current);

  /// Quem está falando agora.
  final FloorGrant current;
}

/// Mudança de dono da palavra num canal ([holder] nulo = canal livre).
class FloorChange {
  const FloorChange(this.channelId, this.holder);
  final String channelId;
  final FloorGrant? holder;
}

/// Árbitro da palavra. Online: o servidor de sinalização é a autoridade.
/// Offline (malha): arbitragem distribuída, ver [resolveFloorCollision].
/// O app nunca decide sozinho a partir de estado local quando há outros
/// aparelhos.
abstract interface class FloorArbiter {
  Future<FloorResult> request({required String channelId, required String peerId, required String displayName});

  /// Libera a palavra. Ignorado se o token não for o atual.
  Future<void> release(FloorGrant grant);

  FloorGrant? holderOf(String channelId);

  Stream<FloorChange> get changes;
}

/// Árbitro em memória, autoridade única. Usado na Fase A/v0.3 para a
/// interface e como referência da lógica que o servidor deve aplicar.
/// NÃO coordena aparelhos diferentes.
class LocalFloorArbiter implements FloorArbiter {
  LocalFloorArbiter({
    this.maxTalk = const Duration(seconds: 60),
    DateTime Function()? clock,
    Random? random,
  })  : _clock = clock ?? DateTime.now,
        _random = random ?? Random.secure();

  final Duration maxTalk;
  final DateTime Function() _clock;
  final Random _random;
  final _holders = <String, FloorGrant>{};
  final _timers = <String, Timer>{};
  final _changes = StreamController<FloorChange>.broadcast();

  @override
  Stream<FloorChange> get changes => _changes.stream;

  @override
  FloorGrant? holderOf(String channelId) {
    final h = _holders[channelId];
    if (h != null && h.isExpired(_clock())) {
      _clear(channelId);
      return null;
    }
    return h;
  }

  @override
  Future<FloorResult> request({required String channelId, required String peerId, required String displayName}) async {
    final current = holderOf(channelId);
    if (current != null) {
      // O próprio dono pedindo de novo mantém a mesma concessão.
      if (current.holderId == peerId) return FloorGranted(current);
      return FloorDenied(current);
    }
    final now = _clock();
    final grant = FloorGrant(
      channelId: channelId,
      holderId: peerId,
      holderName: displayName,
      token: _newToken(),
      grantedAt: now,
      expiresAt: now.add(maxTalk),
    );
    _holders[channelId] = grant;
    _timers[channelId]?.cancel();
    _timers[channelId] = Timer(maxTalk, () {
      if (identical(_holders[channelId], grant)) _clear(channelId);
    });
    _emit(FloorChange(channelId, grant));
    return FloorGranted(grant);
  }

  @override
  Future<void> release(FloorGrant grant) async {
    final current = _holders[grant.channelId];
    if (current == null || current.token != grant.token) return;
    _clear(grant.channelId);
  }

  void _clear(String channelId) {
    _timers.remove(channelId)?.cancel();
    if (_holders.remove(channelId) != null) _emit(FloorChange(channelId, null));
  }

  void _emit(FloorChange c) {
    if (!_changes.isClosed) _changes.add(c);
  }

  String _newToken() => List.generate(16, (_) => _random.nextInt(256).toRadixString(16).padLeft(2, '0')).join();

  Future<void> dispose() async {
    for (final t in _timers.values) {
      t.cancel();
    }
    _timers.clear();
    await _changes.close();
  }
}

/// Pedido de palavra anunciado na malha (sem servidor).
class FloorClaim {
  const FloorClaim({required this.peerId, required this.channelId, required this.claimedAt});
  final String peerId;
  final String channelId;
  final DateTime claimedAt;
}

/// Desempate quando dois aparelhos começam a falar quase juntos na malha.
///
/// Os relógios dos celulares não são sincronizados, então pedidos com
/// diferença menor que [simultaneity] contam como simultâneos e o desempate é
/// pelo `peerId` (menor vence) — determinístico: todos os aparelhos que veem
/// os dois pedidos chegam ao mesmo vencedor. O perdedor para de transmitir e
/// passa a mostrar "canal ocupado".
FloorClaim resolveFloorCollision(
  FloorClaim a,
  FloorClaim b, {
  Duration simultaneity = const Duration(milliseconds: 300),
}) {
  if (a.channelId != b.channelId) {
    throw ArgumentError('Pedidos de canais diferentes não colidem');
  }
  final diff = a.claimedAt.difference(b.claimedAt);
  if (diff.abs() >= simultaneity) return diff.isNegative ? a : b;
  return a.peerId.compareTo(b.peerId) <= 0 ? a : b;
}
