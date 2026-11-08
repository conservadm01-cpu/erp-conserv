# Protocolo de controle de fala (floor control)

Regra: **half-duplex**, um transmissor por canal de cada vez.
PTT: **hold-to-talk** (segurar para falar, soltar para ouvir), com som e
vibração locais ao começar e ao terminar.

Implementação de referência: `lib/communication/floor/floor_control.dart`
(`FloorArbiter`, `LocalFloorArbiter`, `resolveFloorCollision`) e
`lib/features/ptt/ptt_controller.dart`.

## Temporizadores

| Regra | Valor | Por quê |
|---|---|---|
| Limite de fala | 60 s | Ninguém prende o canal. Ao estourar, o canal é liberado e o falante recebe o aviso |
| Liberação ao cair | = limite de fala no MVP. Na Fase C, heartbeat de 2 s e liberação após 5 s sem sinal | Um aparelho que some não deixa o canal ocupado |
| Janela de simultaneidade (malha) | 300 ms | Relógios dos celulares não são sincronizados |

O app também libera a palavra quando: o dedo sai do botão, o sistema cancela
o toque, o usuário troca de canal ou de aba, o app vai para segundo plano, ou
toda rota de rede some durante a fala.

## Modo ONLINE — servidor é a autoridade

1. Cliente envia `request_floor` para o canal.
2. Servidor verifica associação ao canal e se o canal está livre.
3. Livre: responde `floor_granted` com `floor_token` curto ligado a usuário e
   canal, e `expires_at`.
4. Cliente começa a captura e envia áudio por WebRTC.
5. Ao soltar: `release_floor` com o token. Servidor libera e envia `floor_state`.
6. Ocupado: `floor_denied` com quem está falando.
7. Sem `release_floor` (queda): o servidor libera por timeout.

O `LocalFloorArbiter` aplica exatamente essas regras em memória. Ele serve de
especificação executável para o servidor e é o que a v0.3 usa na interface.

### Mensagens

- `request_floor`: channel_id, user_id, request_id
- `floor_granted`: channel_id, user_id, floor_token, expires_at
- `floor_denied`: channel_id, current_speaker
- `release_floor`: channel_id, floor_token
- `floor_state`: channel_id, current_speaker, state

## Modo MESH — sem servidor

Sem internet não há autoridade central, e o estado local de um aparelho não
basta para arbitrar os outros. Proposta para a Fase B:

1. Ao apertar, o aparelho envia `FLOOR_CLAIM` (peerId, channelId, claimedAt)
   para a malha. A mensagem usa o envelope `MeshPacket` com tipo `control` e
   limite de saltos baixo.
2. Quem recebe marca o canal como ocupado por esse peer e recusa localmente o
   próprio PTT ("canal ocupado").
3. Se dois pedidos colidirem, todos aplicam `resolveFloorCollision`:
   - diferença ≥ 300 ms: vence o pedido mais antigo;
   - diferença menor: vence o menor `peerId`.

   A regra é determinística, então todos os aparelhos chegam ao mesmo
   vencedor. O perdedor para de transmitir e ouve.
4. O falante repete o `FLOOR_CLAIM` a cada 2 s enquanto fala (heartbeat).
   Sem heartbeat por 5 s, o canal volta a livre.
5. Ao soltar: `FLOOR_RELEASE`.

Limite conhecido: numa malha particionada, cada parte pode ter o seu falante.
Ao se reconectarem, a regra do item 3 decide qual deles continua.

## Segurança

- Autenticar o usuário antes de permitir transmissão (online) e assinar
  `FLOOR_CLAIM` com a chave do aparelho (malha), para ninguém falsificar
  "canal ocupado".
- Token de fala curto, aleatório (`Random.secure`) e ligado a usuário + canal.
- Validar no servidor a associação ao canal.
- Registrar só eventos mínimos de diagnóstico. Nunca gravar áudio sem
  consentimento.

## Retorno ao usuário

| Estado | Botão | Vibração/som |
|---|---|---|
| Livre | SEGURE (contorno verde) | — |
| Outra pessoa falando | OUVINDO (vermelho), nome no canal | — |
| Pedindo a vez | AGUARDE | — |
| Com a palavra | FALANDO (verde cheio) | impacto forte + clique |
| Negado | OCUPADO | vibração |
| Sem rota | SEM ROTA (laranja) | vibração |
| Fim da fala | volta a SEGURE | impacto leve + clique |

O clique de sistema depende das configurações do aparelho e pode não tocar no
iOS. Bipes próprios de rádio entram com o pipeline de áudio.
