# Decisões de arquitetura (ADRs)

## ADR-001: Prova inicial em LAN multiplataforma

Decisão: provar primeiro Android + iOS no mesmo access point local, sem WAN.
Motivo: rede IP comum e previsível; não presumir que Wi-Fi Direct (Android) e
os frameworks peer-to-peer do iOS interoperam.

## ADR-002: Cloud é plano de controle — *revisada pela ADR-005*

Supabase cuida de cadastro, grupos, autenticação e sincronização de
metadados. Nunca transporta áudio em tempo real e nunca é requisito para o
modo offline.

## ADR-003: Gateway para longo alcance

10 km+ é meta de engenharia de rádio/gateway, não promessa de alcance só com
celulares. Validar linha de visada e regulamentação antes de escolher hardware.

## ADR-004: Voz ao vivo e mensagens são transportes diferentes

Voz ao vivo usa datagramas de baixa latência e tolera perda; **não é
armazenada** por padrão. Mensagens gravadas usam transferência confiável com
ACK, reenvio limitado e expiração.

## ADR-005: Rede híbrida como arquitetura definitiva (2026-11-08)

Decisão: o app usa automaticamente o melhor caminho disponível, sem o usuário
trocar de modo.

Política de rota (implementada em `ConnectivityCoordinator`):

1. Internet disponível → **ONLINE** (WebRTC/SFU).
2. Sem internet, com aparelho OFF próximo → **MESH** (LAN/direto, multi-hop).
3. Sem caminho → voz ao vivo indisponível; mensagem gravada vai para a fila
   **store-and-forward**.
4. Internet ou rota volta → sincronizar pendências com idempotência
   (deduplicação por `messageId`).

Cada celular pode ser emissor, receptor, repetidor e armazenador temporário.
Retransmissão sempre com `hopLimit`, expiração, cache de vistos, limites de
fila e backoff — nunca indefinida.

Consequências: PTT e malha só conversam com `CommunicationTransport`; trocar
LAN por adaptador direto ou online não muda a UI. A troca de rota com o botão
pressionado é reavaliada sem soltar o PTT.

## ADR-006: Infraestrutura de mídia online — PENDENTE

WebRTC + SFU é a direção. A escolha concreta (SFU self-hosted ou gerenciado,
plugin WebRTC para Flutter, serviço de sinalização, TURN) fica pendente até
verificar manutenção, licença, custo e suporte Android/iOS. Não adicionar
serviço pago sem alternativa e custo estimado.

## ADR-007: Envelope do protocolo em JSON na fase de prova

O `MeshPacket` é JSON + base64 para facilitar depuração. Limites: payload ≤
900 bytes, datagrama ≤ 1400 bytes (cabe na MTU Wi-Fi), `hopLimit` ≤ 8. Antes
do áudio em produção, migrar para codificação binária compacta (mantendo
`protocolVersion`) e preencher `authTag` com autenticação de biblioteca
auditada (ex.: libsodium).

## ADR-008: Dependências só quando usadas

Na Fase A foram removidas do `pubspec.yaml` `sqflite`, `uuid`, `path` e
`permission_handler`, que ainda não tinham uso. Voltam junto com o código que
as usa (Fase B).

## ADR-009: Mensagens gravadas usam "guardar, carregar e repassar" (2026-11-08)

Descoberto no simulador (`tools/off_lab.html`): uma fila só no aparelho de
origem não basta. Se a origem ainda alcança algum vizinho, a mensagem sai
para ele e nunca chega a quem entrar em alcance depois. Decisão para a
Fase B: todo aparelho guarda mensagens gravadas e de texto válidas (dentro
de `expiresAt` e de `hopLimit`) e, ao surgir um enlace novo, os dois lados
trocam a lista de `messageId` e enviam só o que o outro não tem. Com
internet, a mesma troca é feita com o servidor, que guarda a mensagem para
quem estiver desligado. Voz ao vivo continua fora disso (ADR-004).

## ADR-010: v0.2 incorporada sobre a arquitetura da Fase A (2026-11-08)

Da v0.2 ficam a identidade visual (escuro + verde-limão), as 4 abas, o PTT
hold-to-talk com retorno sonoro/háptico e a regra de um transmissor por vez.
A estrutura de arquivo único e a chave manual online/offline não ficam: o modo
continua automático (ADR-005), e a simulação vai para um laboratório em Ajustes.

"Canal ocupado" passa a vir de um `FloorArbiter`, nunca de um booleano local:

- online: o servidor é a autoridade;
- malha: arbitragem distribuída e determinística (FLOOR_CONTROL.md).

Localização fica desligada por padrão e exige confirmação.
