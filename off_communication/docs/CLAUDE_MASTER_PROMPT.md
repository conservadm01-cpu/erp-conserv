# PROMPT MESTRE — OFF COMMUNICATION

Você é o engenheiro principal responsável por implementar o OFF Communication, um aplicativo multiplataforma de comunicação PTT híbrida (online + offline). Trabalhe sobre o repositório existente, preserve as decisões arquiteturais abaixo e entregue código executável, testes e documentação. Não responda apenas com sugestões: inspecione os arquivos, implemente em etapas e mostre claramente o que foi realmente concluído.

## 1. Visão do produto

OFF Communication é um aplicativo para Android e iOS com dois modos transparentes:

1. **ONLINE:** quando houver internet, usuários de um canal podem conversar por voz ao vivo e trocar mensagens/áudios através de infraestrutura de internet.
2. **OFFLINE:** sem internet, dispositivos próximos podem descobrir-se e trocar mensagens/áudio através de conexões locais. Os dispositivos participantes podem encaminhar pacotes para outros dispositivos, formando uma rede multi-hop quando o sistema operacional e o transporte permitirem.
3. **STORE-AND-FORWARD:** se não existir rota até o destinatário, mensagens de voz gravadas são armazenadas localmente e encaminhadas quando uma rota voltar a existir.
4. **RECOVERY:** ao retornar a internet, sincronizar metadados e mensagens pendentes, sem duplicar entregas.

O produto deve ser honesto sobre limitações: não prometa alcance fixo em metros ou quilômetros. Alcance depende de rádio, antena, obstáculos, densidade de nós e aparelhos. Não afirme que iOS/Android permitem repetição contínua em background em todos os cenários.

## 2. Decisões de produto e arquitetura

- Nome de trabalho: **OFF Communication**.
- Plataformas: Android e iOS desde o início.
- Estratégia: MVP econômico (lean).
- Hardware: começar compatível com equipamentos prontos; arquitetura preparada para gateways/repetidores próprios no futuro.
- Interface: português brasileiro.
- Experiência: botão PTT grande, canais, membros, status de conectividade e histórico de mensagens.
- App deve priorizar operação local e não depender de login/cloud para um teste LAN básico.

### Stack preferencial

- Flutter/Dart para interface e lógica compartilhada.
- Kotlin/Android e Swift/iOS via platform channels ou plugins para capacidades nativas de rede, áudio e background.
- SQLite/Drift ou alternativa local bem justificada para persistência.
- Opus para codec de voz, se houver implementação multiplataforma madura e compatível. Não invente APIs de codec; documente dependências e licenças.
- Supabase opcional para autenticação, cadastro, canais e sincronização de metadados.
- Para mídia online, avaliar WebRTC com SFU. Não enviar áudio contínuo pelo banco Supabase. Escolha uma implementação concreta apenas após verificar compatibilidade, manutenção, custo e requisitos; se não houver acesso à internet para verificar, registre a decisão como pendente em vez de inventar versões/API.
- Transporte offline inicial: rede Wi-Fi local/LAN com descoberta de serviço e sockets. A primeira prova deve funcionar com celulares conectados ao mesmo roteador ou hotspot sem acesso à internet. Depois criar adaptadores nativos para descoberta/conexão direta Android e iOS.
- Não tratar Wi-Fi Direct Android como solução universal para iPhone. Isolar cada tecnologia em adaptadores por plataforma.

## 3. Escopo do MVP — ordem obrigatória

### Fase A — Base executável
1. Inspecione o repositório e rode `flutter doctor`, `flutter pub get`, `flutter analyze` e testes disponíveis.
2. Corrija erros de compilação e dependências.
3. Entregue app Flutter que inicia em Android/iOS com tela inicial, canais demonstrativos, botão PTT e status da rede.
4. Separe UI, domínio, persistência e transporte. Não coloque sockets diretamente em widgets.

### Fase B — LAN offline
1. Implementar descoberta de peers na LAN (mDNS/NSD/Bonjour, com implementação adequada em cada plataforma) ou alternativa documentada.
2. Implementar handshake autenticado entre peers.
3. Implementar transporte de pacotes com enquadramento, versão de protocolo, limite de tamanho e timeout.
4. Implementar envio/recebimento de mensagens de texto primeiro.
5. Implementar encaminhamento multi-hop com TTL/hop limit, message ID, deduplicação e cache de vistos.
6. Implementar fila store-and-forward persistida localmente.
7. Só então integrar áudio PTT ao vivo pela LAN.

### Fase C — Online
1. Criar abstração `CommunicationTransport` com implementações `LanTransport` e `OnlineTransport`.
2. Integrar voz online com WebRTC e servidor SFU apropriado; sinalização separada da mídia.
3. Tratar troca de rede, reconexão, mute, permissões e encerramento de sessão.
4. Cloud é opcional para o funcionamento offline local.

### Fase D — Híbrido
1. Criar `ConnectivityCoordinator` que detecta rotas disponíveis.
2. Priorizar caminho de menor custo/latência conforme política explícita.
3. Ao perder internet, manter a sessão local quando possível; informar mudança de modo sem interromper desnecessariamente.
4. Ao voltar internet, sincronizar mensagens pendentes com idempotência.
5. Nunca retransmitir indefinidamente; TTL, expiração, limites de armazenamento e backoff obrigatórios.

### Fase E — testes reais e hardening
1. Testes unitários do protocolo, deduplicação, TTL, filas e troca de rota.
2. Testes de integração em pelo menos dois Androids e dois iPhones reais.
3. Testar app em primeiro plano, tela bloqueada, retomada, bateria baixa, permissões negadas e alternância Wi-Fi/dados móveis.
4. Documentar limitações específicas de iOS e Android. Não declarar suporte a background relay sem prova em aparelhos reais.

## 4. Requisitos do protocolo Mesh

Defina um envelope de pacote versionado com, no mínimo:

- `protocolVersion`
- `messageId` (UUID aleatório)
- `originPeerId`
- `destinationPeerId` ou `channelId`
- `messageType` (text, voice_chunk, voice_message, ack, control)
- `createdAt`
- `expiresAt`
- `hopLimit` e `hopCount`
- `payloadLength`
- `payload` binário
- autenticação/integridade criptográfica

Regras:
- Rejeitar pacote expirado, inválido, grande demais ou com hop limit esgotado.
- Deduplicar por `messageId`.
- Não encaminhar de volta para o peer de origem quando conhecido.
- Usar ACK e política de reenvio limitada para mensagens armazenadas.
- Não armazenar áudio PTT ao vivo por padrão; store-and-forward é para mensagens gravadas, salvo escolha explícita do usuário.
- Aplicar limites de fila por usuário, canal e dispositivo.
- Criptografia ponta a ponta: gateways/retransmissores não devem precisar descriptografar conteúdo. Definir gestão de chaves e rotação; não criar criptografia própria.

## 5. Segurança e privacidade

- Usar bibliotecas criptográficas reconhecidas; nunca implementar algoritmos próprios.
- Identidade de peer com chave pública e pareamento/convite explícito para canais privados.
- TLS para serviços online e criptografia ponta a ponta para conteúdo quando aplicável.
- Não transmitir localização por padrão. SOS/localização exigem consentimento e controles claros.
- Logs não podem conter áudio, tokens, chaves privadas ou conteúdo sensível.
- Permissões de microfone, Bluetooth, localização (somente se exigida pelo sistema para descoberta) e rede devem ser explicadas ao usuário.
- Criar threat model resumido e política de retenção local.

## 6. Modelo de dados local

Implemente migrations e repositórios para:

- `peers`: peer_id, display_name, public_key, platform, last_seen_at.
- `channels`: channel_id, name, privacy_mode, created_at.
- `channel_members`: channel_id, peer_id, role, joined_at.
- `messages`: message_id, channel_id, sender_peer_id, message_type, local_path/payload_ref, created_at, expires_at, delivery_state, hop_count.
- `seen_packets`: message_id, first_seen_at, expires_at.
- `pending_deliveries`: message_id, next_attempt_at, attempt_count, last_error.
- `network_links`: peer_id, transport_type, last_success_at, quality_metrics.

Use índices, constraints, expiração/limpeza e transações. Não grave arquivos de áudio grandes diretamente em colunas SQL; use armazenamento local seguro e referência no banco.

## 7. Modelo Supabase

Cloud opcional, com tabelas para profiles, channels, channel_members, device_registrations e message_sync_metadata. Configure RLS por usuário/membro do canal. Nunca exponha `service_role` no app. Não use Supabase Realtime/Database como transporte de áudio ao vivo. Forneça migrations SQL e instruções de configuração via `.env.example`, sem segredos reais.

## 8. UX mínima

Telas:
- Onboarding e permissões.
- Home com status ONLINE / OFFLINE / MESH.
- Lista de canais.
- Tela do canal com PTT, membros e qualidade do link.
- Mensagens de voz gravadas e estado: pendente, encaminhando, entregue, expirado.
- Configurações de privacidade, armazenamento e repetição.

A interface deve mostrar quando o aparelho está retransmitindo e oferecer modo econômico de bateria. Não exibir distância estimada sem método confiável de medição.

## 9. Estrutura sugerida do repositório

```text
lib/
  app/
  core/
    config/
    errors/
    security/
    storage/
  features/
    channels/
    peers/
    ptt/
    voice_messages/
    network_status/
  communication/
    contracts/
    coordinator/
    protocol/
    transports/
      lan/
      online/
      direct_android/
      direct_ios/
    mesh/
    store_forward/
  platform/
    audio/
    permissions/
    background/
  data/
    local/
    remote/
  main.dart
android/
ios/
supabase/migrations/
docs/
test/
integration_test/
```

Adapte o repositório existente sem apagar código útil. Se alterar a estrutura, explique por quê.

## 10. Regras de execução do trabalho

- Trabalhe em incrementos pequenos e compiláveis.
- Antes de editar, liste arquivos e identifique o estado atual.
- Não invente resultados de testes. Informe comandos executados e saída real.
- Não use APIs fictícias, placeholders apresentados como implementação concluída ou pseudocódigo sem identificação.
- Se uma funcionalidade exigir aparelho físico, credenciais, serviço externo ou hardware, implemente a interface e um stub claramente identificado, e forneça passos para validação.
- Não adicionar serviços pagos sem apresentar alternativa e custo aproximado.
- Não colocar credenciais no repositório.
- Atualize README e docs com setup, arquitetura, decisões, limitações e próximos passos.
- Ao final de cada etapa, apresentar: arquivos criados/alterados, comandos de teste executados, resultados, limitações conhecidas e próximo incremento.

## 11. Primeira tarefa agora

Comece pela **Fase A**. Inspecione o repositório atual. Corrija o que impedir o app de compilar. Em seguida implemente uma base Flutter funcional com tela inicial OFF Communication, estado de conectividade simulado/abstraído, lista de canais de demonstração e botão PTT com estados pressionado/solto. Não simule transmissão real como se estivesse funcionando. Crie interfaces para os serviços que serão implementados nas fases seguintes. Execute análise e testes e reporte os resultados reais.

Depois da Fase A, pare e apresente o relatório antes de avançar para a Fase B.
