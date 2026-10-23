# VIAJAR+ (nome provisório)

Aplicativo web em português para **planejar viagens, pesquisar e comparar preços, montar o orçamento, controlar despesas e criar um diário multimídia** — com guia local (restaurantes, bares, culinária, locais religiosos, mirantes instagramáveis), linha do tempo, editor de fotos e vídeos e o **book da viagem** em PDF.

> **Situação:** MVP funcional. Veja [docs/STATUS.md](docs/STATUS.md) para a lista exata do que funciona, do que depende de credenciais externas e do que falta para produção.

## Tecnologias

| Camada | Escolha |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, Radix UI (diálogos e abas acessíveis), lucide-react |
| Formulários | React Hook Form + Zod (mesmos esquemas no cliente e nas rotas de API) |
| Gráficos | Recharts |
| Dados | Supabase (PostgreSQL + Auth + Storage, com RLS) **ou** modo demonstração local (IndexedDB) |
| Mapas | Leaflet + OpenStreetMap |
| Exportação | CSV próprio, ExcelJS, jsPDF + jspdf-autotable |
| Mídia | Canvas/OffscreenCanvas (fotos), MediaRecorder + WebAudio (vídeo), exifr (data/GPS) |
| Testes | Vitest + jsdom + fake-indexeddb |
| PWA | manifest + service worker (app shell offline) |

## Executar localmente

Requisitos: Node.js 20 ou superior.

```bash
cd viajar-plus
npm install
cp .env.example .env.local   # opcional: sem variáveis, roda em modo demonstração
npm run dev                  # http://localhost:3000
```

**Sem nenhuma variável configurada** o app abre em **modo demonstração local**: não há login, os dados ficam somente no IndexedDB do navegador e a viagem demonstrativa *El Calafate (10–15/12/2026, 4 adultos + 1 criança de 8 anos, saída de Guarulhos)* é criada automaticamente. Os valores dessa viagem são **estimativas fictícias**, marcadas como tal — não são cotações.

Outros comandos:

```bash
npm test            # testes unitários e de integração (Vitest)
npm run typecheck   # verificação de tipos
npm run build       # build de produção
npm start           # servir o build
```

## Configurar o Supabase (produção)

Passo a passo completo em [docs/SUPABASE.md](docs/SUPABASE.md). Resumo:

1. Crie um projeto no Supabase.
2. Rode, em ordem, os arquivos de `supabase/migrations/` no SQL Editor (ou `supabase db push` com a CLI).
3. Opcional: `supabase/seed.sql` e `select seed_demo_trip('<seu user id>');` para a viagem demonstrativa.
4. Em *Authentication → URL Configuration*, cadastre `https://SEU_DOMINIO/auth/callback`.
5. Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e (somente no servidor) `SUPABASE_SERVICE_ROLE_KEY`.

Com Supabase configurado, o app exige login, aplica as permissões por viagem/papel via **RLS**, guarda mídia em **buckets privados** com **URLs assinadas** (1 h) e valida os uploads no servidor.

## Integrações (APIs de terceiros)

Detalhes, termos de uso e como obter credenciais em [docs/INTEGRACOES.md](docs/INTEGRACOES.md). O status de cada uma aparece em **Configurações**.

- **Funcionam sem chave** (dados públicos, com atribuição): OpenStreetMap/Overpass (guia local), Nominatim (geocodificação), Open-Meteo (clima), ExchangeRate-API e Frankfurter (câmbio).
- **Exigem credenciais**: Amadeus (voos, hotéis, atividades), Duffel (voos).
- **Sem API pública**: locação de carros e Airbnb → links de pesquisa externa + registro manual de cotação.

O app **nunca inventa tarifas, disponibilidade, avaliações ou históricos** e **nunca simula compra concluída**. Sem credenciais, a tela informa que a consulta real está indisponível e oferece links de pesquisa externa. Provedores fictícios existem só com `NODE_ENV=development` e `ENABLE_MOCK_PROVIDERS=true`, sempre rotulados.

## Deploy (Vercel)

1. Importe o repositório na Vercel e defina **Root Directory = `viajar-plus`**.
2. Configure as variáveis de ambiente de `.env.example` (as secretas sem o prefixo `NEXT_PUBLIC_`).
3. Faça o deploy. Ajuste a URL de callback no Supabase para o domínio final.

> O repositório também contém, na raiz, o ERP de confecção existente (Vite). O VIAJAR+ é um projeto independente nesta pasta e não altera aquele app.

## Estrutura

```
viajar-plus/
├── src/
│   ├── app/                  # rotas (pt-BR) e rotas de API
│   │   ├── page.tsx          # Painel
│   │   ├── viagens/          # Minhas viagens, nova, detalhes, participantes
│   │   ├── pesquisar/        # voos, comparador, guia local, análise de experiências, clima/câmbio
│   │   ├── hospedagem/ veiculos/ passeios/
│   │   ├── orcamento/        # gerador de budget
│   │   ├── reservas/ roteiro/
│   │   ├── diario/ linha-do-tempo/
│   │   ├── midia/            # galeria, editor de foto (foto/[id]) e de vídeo (video)
│   │   ├── book/             # álbuns/book da viagem e exportação PDF
│   │   ├── relatorios/ configuracoes/ login/ privacidade/ termos/ convite/
│   │   └── api/              # search/*, places, geocode, weather, fx, media/upload, account/*, invites
│   ├── components/           # UI acessível e componentes por módulo
│   ├── lib/
│   │   ├── types.ts          # modelo de domínio (= colunas SQL)
│   │   ├── data/             # Repo: Supabase (RLS) ou IndexedDB local
│   │   ├── budget/           # cálculos, categorias e exportação (núcleo financeiro)
│   │   ├── providers/        # adaptadores de APIs (servidor)
│   │   ├── media/ photo/ video/ album/   # upload seguro, edição, vídeo, PDF
│   │   ├── itinerary/ reservations/ notifications/ diary/ guide/ quotes/
│   │   └── server/           # auth, rate limit, logs sem segredos
│   └── proxy.ts              # renovação de sessão e proteção de rotas (Supabase)
├── supabase/migrations/      # schema, RLS, storage
├── supabase/seed.sql         # viagem demonstrativa
├── tests/                    # Vitest
└── docs/                     # STATUS, SUPABASE, INTEGRACOES
```

## Princípios do orçamento

- **Previsto, cotado, reservado e pago são campos separados.** Reserva é compromisso; só pagamento registrado conta como realizado.
- **Sem dupla contagem:** saldo a pagar = reservado − pago; estimativa restante só para itens não reservados; projeção = realizado + compromissos pendentes + estimativas.
- Pagamentos parciais, estornos, moedas e câmbio por lançamento, despesas compartilhadas, rateio por participante (igual, selecionados, pesos, individual) e acerto de contas.
- Alertas configuráveis (padrão 70 %, 90 %, 100 %) sobre o realizado e sobre a projeção.
- Todos os totais são recalculados pelo sistema (centavos inteiros), inclusive nas exportações CSV, Excel e PDF.
