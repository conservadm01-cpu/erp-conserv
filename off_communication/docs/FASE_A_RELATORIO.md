# Relatório — Fase A (base executável)

Data: 2026-11-08 · Flutter 3.47.9 / Dart 3.13.7 (Linux, sem Android SDK/Xcode)

## Estado inicial encontrado

Starter com tela PTT de interface, `LanTransport` UDP e `OffPacket` soltos,
sem pastas `android/`/`ios/`, sem testes. Problemas corrigidos:

| Problema | Correção |
|---|---|
| PTT usava long-press: só reagia após ~500 ms e toques curtos eram ignorados | `PttButton` com `Listener` (toque/soltar/cancelar) |
| `LanTransport.dispose()` fechava o stream para sempre; `start()` depois falhava | `UdpLanTransport`: `stop()`/`start()` reutilizáveis; `dispose()` separado |
| `discoveryPort` declarado e nunca usado | Removido; porta única até a descoberta da Fase B |
| Pacote sem `messageId`, TTL, hop limit, expiração ou limite de tamanho | Novo `MeshPacket` (campos do prompt mestre §4) com validação |
| Supabase: dono não via a organização que criou e não podia virar membro | Política de leitura inclui `owner_id`; trigger adiciona o dono como `owner` |
| Dependências sem uso (`sqflite`, `uuid`, `path`, `permission_handler`) | Removidas até a fase que as usa (ADR-008) |
| `withOpacity` obsoleto | `withValues(alpha:)` |

## Entregue

- `CommunicationTransport` — contrato comum (LAN, online, diretos).
- `ConnectivityCoordinator` — política de rota híbrida (ADR-005), lógica pura.
- `PttController` — estados `idle` / `pressed` / `noRoute`; reavalia a rota
  se a rede mudar com o botão pressionado. **Não transmite áudio.**
- Tela "Minha comunicação": card ONLINE/MESH, seletor de canal, PTT, ações
  rápidas (avisam "ainda não implementado") e **painel de simulação de rede**.
- `UdpLanTransport` (experimental, fora da UI) e `OnlineTransport` (stub).
- Contratos: `AudioCapture`, `AudioCodec`, `AudioOutput`, `IdentityStore`,
  `MessageRepository`, `SeenPacketStore`, `ChannelRepository`.
- Projetos `android/` e `ios/` gerados com permissões de rede local,
  multicast, microfone e Bonjour.

## Comandos executados e resultados reais

```text
flutter pub get        → Got dependencies!
flutter analyze        → No issues found!
flutter test           → 24 testes, All tests passed!
```

Testes: protocolo (8), coordenador (6), controlador PTT (4), tela (5),
transporte UDP em loopback 127.0.0.1 com reinício e descarte de lixo (1).

Migration Supabase executada num PostgreSQL 16 local com `auth.uid()`
simulado: dono cria organização → vê 1, vira membro `owner`; outro usuário
→ vê 0.

## Não verificado

- `flutter build apk` / `flutter build ios`: este ambiente não tem Android
  SDK nem Xcode. Rodar localmente: `flutter run` num Android e num iPhone.
- Nenhum teste em aparelho físico.
- O print `fase_a_tela_inicial.png` vem de um build web temporário usado só
  para visualizar a interface; o projeto não tem alvo web.

## Limitações conhecidas

- Estado de rede é simulado; nada detecta internet ou peers reais ainda.
- Sem áudio, sem Mesh, sem fila persistida, sem criptografia.

## Próximo incremento proposto — Fase B (aguardando aprovação)

1. Identidade local (ID pseudônimo persistido) e SQLite com as tabelas do §6.
2. Descoberta por heartbeat UDP + tabela de vizinhos com expiração → alimenta
   o `ConnectivityCoordinator` com dados reais (remove a simulação).
3. Texto em canal pela LAN; tela Participantes.
4. Malha: `SeenPacketStore`, encaminhamento com `hopLimit`, sem devolver ao
   vizinho de origem; modo de topologia forçada para o teste A–B–C.
5. Fila store-and-forward com ACK, reenvio limitado e expiração.
6. Só então: áudio PTT ao vivo na LAN (seleção da biblioteca Opus).

Handshake autenticado (item B.2 do prompt mestre) depende da escolha da
biblioteca criptográfica; proposta: decidir junto do item 1.
