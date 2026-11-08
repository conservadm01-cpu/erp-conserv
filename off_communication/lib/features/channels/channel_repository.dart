enum ChannelPrivacy { open, private }

class OffChannel {
  const OffChannel({required this.id, required this.name, this.privacy = ChannelPrivacy.open});

  final String id;
  final String name;
  final ChannelPrivacy privacy;

  bool get isPrivate => privacy == ChannelPrivacy.private;
}

/// Fonte de canais. A implementação persistida (SQLite) entra na Fase B.
abstract interface class ChannelRepository {
  Future<List<OffChannel>> listChannels();
}

/// Canais de demonstração, apenas em memória.
class DemoChannelRepository implements ChannelRepository {
  const DemoChannelRepository();

  static const channels = [
    OffChannel(id: 'demo-equipe-off', name: 'Equipe OFF'),
    OffChannel(id: 'demo-canal-02', name: 'Canal 02'),
    OffChannel(id: 'demo-viagem', name: 'Viagem'),
    OffChannel(id: 'demo-privado', name: 'Coordenação', privacy: ChannelPrivacy.private),
  ];

  @override
  Future<List<OffChannel>> listChannels() async => channels;
}
