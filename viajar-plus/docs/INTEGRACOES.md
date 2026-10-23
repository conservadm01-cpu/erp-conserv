# Integrações do VIAJAR+

Todas as integrações rodam **somente no servidor** (rotas `src/app/api/**`). O navegador nunca recebe chaves.
Cada adaptador (em `src/lib/providers/`) valida parâmetros com Zod, normaliza o resultado para um modelo comum
(`{ provider, queried_at, results, attribution, cached, notice }`), trata timeout, erros HTTP e limite de
requisições (429), e guarda cache em memória com validade por tipo (`src/lib/providers/cache.ts`).

Sem credenciais, as telas mostram **"Consulta real indisponível"** e oferecem links de pesquisa externa com
datas e passageiros preenchidos. Nenhuma tarifa, disponibilidade, avaliação ou histórico é inventado.

O estado de cada integração aparece em **Configurações → Integrações** (`GET /api/integrations/status`,
que devolve apenas rótulos/booleanos, nunca segredos).

| Área | Interface | Adaptadores | Chave? | Situação |
|---|---|---|---|---|
| Voos | `FlightSearchProvider` | Duffel, Amadeus (Enterprise) | Sim | Pendente até configurar |
| Hospedagem | `AccommodationSearchProvider` | Amadeus Hotel (Enterprise) + links (Booking, Airbnb, Google Hotéis, Decolar) | Sim | Pendente até configurar |
| Carros | `CarRentalSearchProvider` | Nenhum (sem API pública autorizada) → links + registro manual | — | Links externos |
| Passeios | `ActivitySearchProvider` | Amadeus Tours & Activities (Enterprise) + OSM gratuito + links (GetYourGuide, Viator, Tripadvisor) | Sim/Não | Parcial |
| Lugares (guia) | `PlacesProvider` | OpenStreetMap Overpass | Não | Pública |
| Geocodificação | `MapsProvider` | OpenStreetMap Nominatim | Não | Pública |
| Mapas (tiles) | — | tile.openstreetmap.org via Leaflet | Não | Pública |
| Clima | `WeatherProvider` | Open-Meteo (previsão + arquivo histórico) | Não | Pública |
| Câmbio | `ExchangeRateProvider` | ExchangeRate-API (open access) → Frankfurter (BCE) | Não | Pública |

## Rotas

| Rota | Método | Limite (por IP/min) |
|---|---|---|
| `/api/search/flights` | POST JSON | 12 |
| `/api/search/lodging` | POST JSON | 12 |
| `/api/search/cars` | POST JSON | 20 |
| `/api/search/activities` | POST JSON | 20 |
| `/api/places?lat&lng&category&radius_m` | GET | 20 |
| `/api/geocode?q` | GET | 20 |
| `/api/weather?lat&lng&start_date&end_date` | GET | 30 |
| `/api/fx?base=BRL&symbols=ARS` | GET | 60 |
| `/api/integrations/status` | GET | 30 |

O rate limit é em memória por instância (`src/lib/server/rate-limit.ts`). Em produção com várias instâncias,
troque por um armazenamento compartilhado (ex.: Upstash Redis).

---

## Amadeus

**Atenção (verificado em out/2026):** a Amadeus encerrou o portal **Self-Service** em **17/07/2026**: novos
cadastros foram pausados em fevereiro/2026 e as chaves self-service foram desativadas na data. O portal
**Enterprise** não foi afetado, mas exige contrato e aprovação de acesso. Fontes:
[PhocusWire](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers),
[AirLabs](https://airlabs.co/amadeus-self-service-api-shutdown),
[guia de migração Ignav](https://ignav.com/docs/amadeus-self-service-shutdown),
[GitHub amadeus4dev (arquivado em 17/07/2026)](https://github.com/amadeus4dev).
Confirme os termos atuais diretamente com a Amadeus.

Os adaptadores (`src/lib/providers/amadeus.ts`) seguem o formato das APIs Flight Offers Search
(`/v2/shopping/flight-offers`), Hotel List + Hotel Search (`/v1/reference-data/locations/hotels/*`,
`/v3/shopping/hotel-offers`) e Tours & Activities (`/v1/shopping/activities`), com OAuth2 client credentials.
Para usá-los é preciso um contrato Enterprise com acesso equivalente; se a URL base ou os caminhos forem
diferentes no seu contrato, ajuste `AMADEUS_BASE_URL` e, se necessário, os caminhos no adaptador.

Variáveis:

```
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
AMADEUS_ENV=test            # ou production
AMADEUS_BASE_URL=           # opcional; URL informada no contrato Enterprise
```

Comportamento:
- Flexibilidade de datas (±1 a 3 dias) e aeroportos alternativos geram várias consultas; o total é limitado a
  6 chamadas por busca para respeitar cotas (o aviso informa quando combinações foram omitidas).
- Hotéis: `availability_confirmed` só é `true` quando a fonte retorna `available: true`.
- A Amadeus não vende passagens: o resultado não tem link de compra; a tela orienta concluir no site da
  companhia/agência e mostra links externos.
- **Não testado contra a API real neste ambiente**: o host `test.api.amadeus.com` não respondeu (proxy 502) e
  não há credenciais. Os testes usam respostas simuladas com o formato documentado.

## Duffel

API de voos com cadastro direto em https://duffel.com (modo teste gratuito; produção requer verificação da
conta e tem custo por reserva/oferta conforme contrato). Recomendada como opção principal de voos após o
encerramento do Self-Service da Amadeus.

```
DUFFEL_ACCESS_TOKEN=duffel_test_...
```

- Usa `POST /air/offer_requests?return_offers=true` com header `Duffel-Version: v2`.
- Exige a idade de cada criança (o formulário envia as idades da viagem).
- Ofertas expiram em minutos; o VIAJAR+ só salva a cotação (com horário da consulta) e nunca emite bilhetes.
- **Não testado contra a API real** (sem token neste ambiente); coberto por testes com resposta simulada.

## Carros

Não há API pública e aberta de locadoras com termos que permitam integração direta sem parceria. O
`NoCarRentalProvider` retorna "não configurado" e a tela `/veiculos` oferece links (Kayak, Rentalcars, Google)
e o **registro manual de cotação** com: locadora, retirada/devolução, categoria, câmbio, capacidade real de
passageiros e malas, taxas, caução, seguro, franquia, combustível, quilometragem, cancelamento, motorista
adicional e requisitos de habilitação. Para plugar um parceiro, implemente `CarRentalSearchProvider` e
registre-o em `src/lib/providers/registry.ts`.

## Airbnb

O Airbnb não oferece API pública. O VIAJAR+ usa **apenas o link de pesquisa** com datas e hóspedes; não faz
scraping nem contorna autenticação. O preço visto pode ser registrado manualmente como cotação.

## OpenStreetMap

- **Overpass** (`src/lib/providers/osm.ts`): restaurantes, bares, cafés, culinária local (`cuisine=regional|local|…`),
  locais religiosos (`amenity=place_of_worship`), mirantes/instagramáveis (`tourism=viewpoint|artwork`),
  museus, parques e atrações. Endpoints públicos com fallback: `overpass-api.de` → `overpass.kumi.systems`.
  Para uso intenso, hospede sua instância e defina `OVERPASS_URL` (tem prioridade).
- **Nominatim**: geocodificação com User-Agent identificável e fila de 1 requisição/segundo
  ([política de uso](https://operations.osmfoundation.org/policies/nominatim/)). Defina `OSM_CONTACT_EMAIL`
  para identificar o app.
- **Tiles**: `tile.openstreetmap.org` com atribuição visível; uso leve, conforme a
  [política de tiles](https://operations.osmfoundation.org/policies/tiles/). Para tráfego alto, use um provedor
  comercial de tiles.
- Licença dos dados: ODbL — atribuição "© colaboradores do OpenStreetMap" exibida no mapa e nos resultados.
- Cache: 24 h para lugares, 7 dias para geocodificação.
- "Sem ingresso" só é mostrado quando o mapa informa `fee=no`, sempre com a ressalva de que transporte e
  taxas podem ser cobrados.

```
OVERPASS_URL=          # opcional
OSM_CONTACT_EMAIL=     # recomendado
```

## Open-Meteo

Sem chave para uso não comercial (atribuição CC BY 4.0). Uso comercial requer plano pago.
- Até 16 dias à frente: previsão (`api.open-meteo.com/v1/forecast`).
- Datas mais distantes: dados **históricos do mesmo período do ano anterior** (`archive-api.open-meteo.com`),
  rotulados "Histórico, não previsão".
- Viagens passadas: dados observados.
- Cache de 1 h.

## Câmbio

- Primário: [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free) (`open.er-api.com`),
  sem chave, atualização diária, inclui ARS; exige atribuição ("Rates By Exchange Rate API").
- Reserva: [Frankfurter](https://frankfurter.dev) (taxas de referência do BCE; não inclui ARS).
- São taxas de referência: não incluem spread bancário nem IOF. Cada item do orçamento guarda a taxa usada.
- Contrato de `/api/fx`: `GET ?base=BRL&symbols=ARS` → `{ base, rates: { ARS }, source, fetched_at, rate_date, attribution }`.

## Mock (somente desenvolvimento)

Com `NODE_ENV=development` **e** `ENABLE_MOCK_PROVIDERS=true`, provedores fictícios de voos, hospedagem e
passeios são ativados para testar telas. Todos os resultados vêm rotulados **"DADOS FICTÍCIOS"** e salvos
como cotação de origem "demo". Em produção os mocks nunca são carregados.

## Testes ao vivo realizados (23/10/2026, a partir do ambiente de desenvolvimento)

| Serviço | Resultado |
|---|---|
| Nominatim ("El Calafate, Argentina") | OK — lat −50.3387, lng −72.2737, país AR |
| ExchangeRate-API (BRL → ARS, USD) | OK — 1 BRL = 302,98 ARS; 0,1983 USD |
| Frankfurter (BRL → USD) | OK — 0,19806 (referência 22/10/2026) |
| Overpass (restaurantes/religiosos/mirantes) | Falhou — timeout/reset nos dois endpoints públicos (funcionou uma vez mais cedo no mesmo dia); o app mostra erro claro |
| Open-Meteo | Falhou — 429 (limite diário do IP compartilhado do ambiente) e falha de rede; esperado funcionar em IP próprio |
| Amadeus / Duffel | Não testados (sem credenciais; Amadeus inacessível pela rede) |
