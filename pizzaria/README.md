# App de Pizzaria

Cardápio online com pedidos, entrega acompanhada por GPS e painel da loja.
Mesmo stack do ERP da confecção: Vite + React, e os dados ficam no Supabase.

## O que tem

| Área | Endereço | O que faz |
|---|---|---|
| **Cliente** | `/#/` | Catálogo por categoria, busca, tamanhos, pizza meio a meio, sacola, checkout |
| | `/#/pedido/<id>` | Acompanhamento: linha do tempo, mapa com o motoboy ao vivo e tempo estimado |
| | `/#/pedidos` | Histórico de pedidos do cliente |
| | `/#/carteira` | Saldo, cashback, extrato e endereços salvos |
| **Loja** (PIN) | `/#/loja` | Quadro de pedidos, mapa ao vivo dos motoboys, produtos, promoções, motoboys, clientes e configurações |
| **Motoboy** (nome + PIN) | `/#/motoboy` | Entregas atribuídas, pegar entregas prontas, rota no Google Maps, envio do GPS, repasse do dia |

### Regras principais

- **Cadastro de produtos**: categoria, descrição, foto (link), vários tamanhos/preços, opção meio a meio (cobra o sabor mais caro) e pausar.
- **Meios de pagamento**: Pix (mostra a chave), crédito, débito, dinheiro (com troco), vale-refeição e saldo da carteira. Cada um liga/desliga em Configurações. Os pagamentos com cartão são na maquininha, na entrega; o app não integra gateway de pagamento online.
- **Carteira do cliente**: o cliente se identifica pelo celular. O cashback (padrão 5%) cai na carteira quando o pedido é entregue. A loja pode lançar créditos e débitos manuais. Se o pedido é cancelado, o saldo usado volta para a carteira.
- **Promoções**: automáticas ou por cupom. O desconto pode ser em %, em R$ ou frete grátis; vale para o pedido, uma categoria ou um produto. Dá para definir pedido mínimo, dias da semana, período e limite de usos.
- **Valor da entrega**: `taxa base + (km além dos inclusos × R$/km)`. A distância é calculada em linha reta e multiplicada pelo "fator de rota" (1,3) para se aproximar do caminho pelas ruas. Existe um raio máximo de atendimento.
- **Entrega dedicada (plus)**: o motoboy sai direto, sem outras paradas. Cobra um adicional fixo e/ou um % sobre a taxa. Aparece destacada para a loja e para o motoboy, e o motoboy recebe um bônus no repasse. O frete grátis zera só a taxa normal; o adicional dedicado continua sendo cobrado.
- **Geolocalização**: o motoboy envia a posição a cada ~5 s enquanto tem entrega. O cliente e a loja veem o motoboy no mapa (OpenStreetMap) com o tempo estimado de chegada. O endereço de entrega pode ser buscado por texto, pela localização atual do aparelho ou ajustado tocando no mapa.

## Rodar localmente

```bash
cd pizzaria
npm install
npm run dev
```

Sem configurar nada, o app abre em **modo demonstração**: os dados ficam no
navegador. Abas do mesmo navegador compartilham esses dados, então dá para
testar cliente, loja e motoboy ao mesmo tempo. Em **Loja → Produtos** há um
botão que cria cardápio, promoções e um motoboy de exemplo (motoboy
"Carlos", PIN 1111). O PIN inicial da loja é **1234**.

## Usar de verdade (Supabase + Vercel)

1. Use o mesmo projeto Supabase do ERP (a tabela `app_storage` já existe;
   as chaves da pizzaria começam com `pz:` e não se misturam com as da
   confecção) ou crie um novo e rode `supabase/schema.sql`.
2. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`.
3. No Vercel, crie um **novo projeto** a partir deste repositório e defina
   **Root Directory = `pizzaria`**. Adicione as mesmas duas variáveis de
   ambiente e faça o deploy.
4. Em **Loja → Configurações**: troque o PIN, marque o endereço da pizzaria
   no mapa (o frete é calculado a partir dele), informe a chave Pix e
   ajuste as taxas.

## Limitações conhecidas

- **Segurança**: é igual ao ERP. A chave anônima do Supabase fica no
  navegador, então alguém técnico consegue ler e alterar os dados direto
  pela API. Os PINs da loja e do motoboy só identificam quem está usando;
  eles não protegem os dados. Antes de abrir para o público em geral, o
  ideal é mover as gravações para funções no servidor com Supabase Auth.
- **GPS do motoboy**: o navegador só envia a localização com a tela do app
  aberta (o app pede para manter a tela acesa). Para rastrear em segundo
  plano seria preciso um app nativo.
- **Busca de endereço** usa o Nominatim (OpenStreetMap), que é gratuito,
  mas tem limite de uso (cerca de 1 busca por segundo). Para volume alto,
  vale trocar pela API do Google Maps.
- As telas se atualizam a cada 5 s (*polling*). Dá para trocar pelo
  Supabase Realtime se precisar de atualização instantânea.
