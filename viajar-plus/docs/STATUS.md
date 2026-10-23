# VIAJAR+ — situação do MVP

Atualizado em 23/10/2026. Este documento separa o que **foi executado e verificado** do que depende de credenciais externas e do que falta para produção. Nada aqui é afirmado sem teste correspondente.

## Como foi verificado

| Verificação | Resultado |
|---|---|
| `npm run typecheck` (TypeScript estrito, projeto inteiro) | 0 erros |
| `npm test` (Vitest) | **20 arquivos, 207 testes passando** |
| `npm run build` (Next.js 16, produção) | Sucesso — 19 páginas + 13 rotas de API |
| Teste de ponta a ponta no Chromium contra `next start` (modo demonstração) | Todos os passos aprovados, **0 erros de console** (detalhes abaixo) |
| Migrations SQL + RLS + seed em **PostgreSQL 16 real** (cluster temporário com stubs de `auth`/`storage`) | Aplicam sem erro; RLS testado com 3 usuários |
| Chamadas reais às APIs públicas | Nominatim, ExchangeRate-API e Frankfurter OK; Overpass e Open-Meteo falharam nesta rede (ver abaixo) |

### Fluxo de ponta a ponta executado no navegador

1. Painel abre com a viagem demonstrativa El Calafate criada automaticamente.
2. As 19 páginas abrem sem erro (`/`, viagens, pesquisar, hospedagem, veículos, passeios, reservas, roteiro, diário, linha do tempo, fotos, vídeo, book, relatórios, configurações, nova viagem, privacidade, termos, login).
3. Orçamento: item novo com previsto 1.000, cotado 900 e reservado 850 → pagamento parcial de 300 → status "Pago parcial" e saldo a pagar 550 (correto).
4. Exportação do orçamento em Excel (12 KB), PDF (41 KB) e CSV (2 KB).
5. Upload de foto JPEG → assistente "Registre o melhor do momento" abre com perguntas contextuais → respostas salvas no diário do dia.
6. Editor: moldura Polaroid aplicada → "Salvar versão" grava nova versão sem alterar o original.
7. Book: criado com páginas sugeridas automaticamente → PDF de 5 páginas (capa, sumário, roteiro, fotos, histórias) com rodapé e numeração.
8. Celular (390 px): Painel, Orçamento, Fotos e Linha do tempo sem rolagem horizontal.

## Funcional (verificado)

- **Viagens:** cadastro completo (destino, origem, datas, adultos/crianças com idades, orçamento total e por pessoa sincronizados, preferências, ritmo, acessibilidade, restrições, experiências desejadas, status); viajantes e responsáveis; participantes com papéis e permissões; exclusão em cascata (registros e arquivos).
- **Orçamento (módulo central):** 13 categorias + personalizadas; previsto/cotado/reservado/pago/saldo separados; câmbio por item e por pagamento; pagamentos parciais e estornos; item quitado ou cancelado; rateio (todos, selecionados, pesos, individual) e acerto de contas; custo por viajante e por dia; projeção; alertas configuráveis 70/90/100 % (realizado e projeção); gráficos previsto × realizado, por categoria, evolução, por pessoa e saldo; comprovantes anexados; exportação CSV (padrão BR, proteção contra fórmulas), Excel (5 abas) e PDF. Sem dupla contagem (testado).
- **Pesquisa e comparador:** formulários de voos, hospedagem, carros e passeios; sem credenciais, a API responde "consulta real indisponível" + links externos preenchidos (verificado); cotações manuais com fonte, URL, data/hora; comparação por pessoa/unidade/grupo; cotações vencidas e "precisa nova consulta"; tendência só com ≥ 3 pontos; conversão de cotação em item do orçamento como **cotado** (não pago).
- **Guia local e análise de experiências:** analisador por regras do texto "experiências desejadas" (gastronomia, bares, culinária, religioso, instagramáveis etc.); busca de restaurantes, bares, cafés, locais religiosos e mirantes no OpenStreetMap; salvar e adicionar ao roteiro.
- **Roteiro:** dias da viagem, arrastar e soltar (mouse, toque e teclado), conflitos de horário, deslocamento improvável, horário de funcionamento e dia cheio conforme o ritmo; "reservado" só com reserva confirmada (também garantido por CHECK no banco).
- **Reservas e documentos:** central com confirmação, datas, cancelamento, valores; anexos privados; bloqueio de número de cartão (Luhn), senha e CVV; vínculo ao orçamento como compromisso, nunca como pagamento.
- **Alertas:** check-in/out, prazos de cancelamento, vencimentos com saldo e horários do roteiro (sino no topo e Painel).
- **Diário:** registros por dia, local, participante; avaliação; humor, etiquetas, pessoas; gastos do dia lançados no orçamento; fotos vinculadas; rascunhos offline com detecção e resolução de conflito (testado).
- **Linha do tempo:** viagens em sequência; dia a dia unindo roteiro, diário e fotos; lugares instagramáveis; nascer/pôr do sol e horário dourado calculados localmente (conferido com São Paulo e El Calafate); "Conte a história deste dia"; mapa de memórias.
- **Fotos:** upload múltiplo sem limite de quantidade; validação por assinatura binária (recusa SVG, HTML disfarçado, executáveis); miniaturas; EXIF (data; GPS só com consentimento); busca e filtros; favoritos e instagramáveis; perguntas a cada upload.
- **Editor de fotos:** recorte com proporções, girar, espelhar, redimensionar; brilho, contraste, saturação, temperatura e nitidez (em Worker); 7 molduras editáveis; texto, data e local; desfazer/refazer; restaurar original; versões sem sobrescrever; exportar JPEG/PNG/WebP; colagem.
- **Book da viagem:** formatos A4, quadrado, vertical e horizontal; margens/espaçamentos; capa, sumário, roteiro, histórias, orçamento; layouts e molduras por página; incluir/excluir páginas; salvar e reabrir; PDF paginado com imagens inteiras (~300 dpi).
- **Editor de vídeo:** linha do tempo de clipes, cortar, dividir, remover trecho, títulos/legendas, transição fade, proporções 9:16/1:1/16:9, volume/mudo, trilha própria, montagem curta automática, exportação pelo navegador (MediaRecorder).
- **Segurança e privacidade:** RLS em todas as tabelas; buckets privados com URL assinada (1 h); validação de upload no servidor; rate limit; logs sem segredos; CSP e cabeçalhos de segurança; exportação e exclusão de dados (LGPD); páginas de privacidade e termos.
- **PWA e acessibilidade:** manifest, service worker (app shell offline), tema claro/escuro, foco visível, rótulos ARIA, navegação por teclado, layout responsivo.

## Depende de credenciais externas (não testado com dados reais)

| Item | O que falta | Comportamento sem credenciais |
|---|---|---|
| Supabase (login, sincronização, compartilhamento, armazenamento) | Criar projeto, rodar migrations, configurar variáveis | Modo demonstração local (IndexedDB) |
| Voos — Duffel | `DUFFEL_ACCESS_TOKEN` | Aviso + links Google Voos, Skyscanner, Kayak, Decolar |
| Voos, hotéis, atividades — Amadeus | Contrato Enterprise (o Self-Service foi encerrado em 17/07/2026, conforme a pesquisa registrada em INTEGRACOES.md; confirme com a Amadeus) | Aviso + links externos |
| Exclusão de conta (LGPD) no Supabase | `SUPABASE_SERVICE_ROLE_KEY` no servidor | Rota responde explicando a pendência |

Os adaptadores Amadeus e Duffel foram testados **apenas com respostas simuladas** (normalização, erros, timeout, 429, cache). Nenhuma chamada real foi feita a eles.

## Limitações conhecidas

- **Overpass e Open-Meteo** falharam nesta rede de desenvolvimento (timeout e limite diário do IP compartilhado). O app mostra o erro com clareza; em produção, use `OVERPASS_URL` (instância própria) e verifique os limites do Open-Meteo.
- **Supabase real** não foi testado (Auth, PostgREST, Storage); o SQL foi validado em PostgreSQL 16 com stubs.
- **Editor de vídeo** só teve a lógica da linha do tempo testada; a exportação depende de MediaRecorder, roda em tempo real e exige a aba visível; Safari/iOS tem suporte limitado. Processamento no servidor está documentado, não implementado.
- **Render em canvas e Worker** do editor de fotos foram verificados no navegador apenas no fluxo de moldura + salvar versão.
- **Rate limit e cache** ficam em memória (por instância). Em várias instâncias, use Redis/Upstash.
- **Alertas lidos** ficam no `localStorage`; não há push nem e-mail.
- **Tempo de deslocamento** do roteiro é estimado por distância em linha reta (sem API de rotas).
- **PDF** usa fontes padrão: acentos funcionam; emojis e "★" são omitidos.
- **HEIC** só é exibido em navegadores que suportam o formato.
- Tabelas `flight_options`, `lodging_options`, `rental_options` existem no SQL, mas o app guarda a opção completa em `quotes.details`.

## Passos para produção

1. Criar projeto Supabase, rodar `supabase/migrations/*` e configurar URLs de autenticação ([SUPABASE.md](SUPABASE.md)).
2. Configurar variáveis na Vercel (Root Directory `viajar-plus`).
3. Testar login, convite, upload e URLs assinadas no Supabase real.
4. Contratar/configurar provedores de voos/hotéis (Duffel; Amadeus Enterprise se disponível) e validar com chamadas reais.
5. Instância própria do Overpass e provedor comercial de tiles de mapa para tráfego maior.
6. Rate limit compartilhado (Redis), monitoramento de erros e backups.
7. Testar exportação de vídeo e editor de fotos em iOS/Safari e Android.
8. Revisão jurídica dos termos e da política de privacidade.
