import { AmadeusActivities, AmadeusFlights, AmadeusLodging } from "./amadeus";
import { NoCarRentalProvider } from "./cars";
import { amadeusConfig, duffelConfig, mocksEnabled } from "./config";
import { DuffelFlights } from "./duffel";
import { FxChain } from "./fx";
import { MockActivities, MockFlights, MockLodging } from "./mock";
import { NominatimMaps, OverpassPlaces } from "./osm";
import type {
  AccommodationSearchProvider,
  ActivitySearchProvider,
  CarRentalSearchProvider,
  ExchangeRateProvider,
  FlightSearchProvider,
  MapsProvider,
  PlacesProvider,
  WeatherProvider,
} from "./types";
import { OpenMeteoWeather } from "./weather";

/** Provedores configurados, em ordem de preferência. Mocks só em desenvolvimento com opt-in. */
export function flightProviders(): FlightSearchProvider[] {
  const all: FlightSearchProvider[] = [new AmadeusFlights(), new DuffelFlights()];
  if (mocksEnabled()) all.push(new MockFlights());
  return all.filter((p) => p.isConfigured());
}

export function lodgingProviders(): AccommodationSearchProvider[] {
  const all: AccommodationSearchProvider[] = [new AmadeusLodging()];
  if (mocksEnabled()) all.push(new MockLodging());
  return all.filter((p) => p.isConfigured());
}

export function activityProviders(): ActivitySearchProvider[] {
  const all: ActivitySearchProvider[] = [new AmadeusActivities()];
  if (mocksEnabled()) all.push(new MockActivities());
  return all.filter((p) => p.isConfigured());
}

export function carProviders(): CarRentalSearchProvider[] {
  return [new NoCarRentalProvider()].filter((p) => p.isConfigured());
}

export const fxProvider = (): ExchangeRateProvider => new FxChain();
export const mapsProvider = (): MapsProvider => new NominatimMaps();
export const weatherProvider = (): WeatherProvider => new OpenMeteoWeather();
export const placesProvider = (): PlacesProvider => new OverpassPlaces();

export type IntegrationState = "configurada" | "pendente" | "publica" | "indisponivel" | "ficticia";

export interface IntegrationStatus {
  key: string;
  name: string;
  area: string;
  state: IntegrationState;
  detail: string;
  docs: string;
}

/** Estado das integrações — apenas booleanos/rotulos, nunca valores de credenciais. */
export function integrationStatus(): IntegrationStatus[] {
  const ama = amadeusConfig();
  const duf = duffelConfig();
  const out: IntegrationStatus[] = [
    {
      key: "amadeus",
      name: "Amadeus for Developers",
      area: "Voos, hotéis e passeios",
      state: ama.configured ? "configurada" : "pendente",
      detail: ama.configured
        ? `Credenciais presentes (${ama.env === "production" ? "produção" : "teste"}). O Self-Service foi encerrado em 17/07/2026: requer contrato Enterprise.`
        : "Self-Service encerrado em 17/07/2026; exige contrato Amadeus Enterprise (AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, AMADEUS_BASE_URL).",
      docs: "docs/INTEGRACOES.md#amadeus",
    },
    {
      key: "duffel",
      name: "Duffel",
      area: "Voos",
      state: duf.configured ? "configurada" : "pendente",
      detail: duf.configured ? "Token presente no servidor." : "Defina DUFFEL_ACCESS_TOKEN.",
      docs: "docs/INTEGRACOES.md#duffel",
    },
    {
      key: "carros",
      name: "Locadoras de veículos",
      area: "Carros",
      state: "indisponivel",
      detail: "Sem API pública autorizada; use links externos e registro manual de cotação.",
      docs: "docs/INTEGRACOES.md#carros",
    },
    { key: "airbnb", name: "Airbnb", area: "Hospedagem", state: "indisponivel", detail: "Sem API pública: somente link de pesquisa.", docs: "docs/INTEGRACOES.md#airbnb" },
    { key: "overpass", name: "OpenStreetMap — Overpass", area: "Guia: restaurantes, bares, religiosos, mirantes", state: "publica", detail: "Sem chave; uso moderado com cache de 24h.", docs: "docs/INTEGRACOES.md#openstreetmap" },
    { key: "nominatim", name: "OpenStreetMap — Nominatim", area: "Geocodificação", state: "publica", detail: "Sem chave; máx. 1 req/s.", docs: "docs/INTEGRACOES.md#openstreetmap" },
    { key: "open-meteo", name: "Open-Meteo", area: "Clima", state: "publica", detail: "Sem chave para uso não comercial.", docs: "docs/INTEGRACOES.md#open-meteo" },
    { key: "fx", name: "ExchangeRate-API / Frankfurter", area: "Câmbio", state: "publica", detail: "Sem chave; atualização diária.", docs: "docs/INTEGRACOES.md#cambio" },
  ];
  if (mocksEnabled()) {
    out.push({ key: "mock", name: "Provedores fictícios", area: "Desenvolvimento", state: "ficticia", detail: "ENABLE_MOCK_PROVIDERS=true em desenvolvimento: resultados rotulados como DADOS FICTÍCIOS.", docs: "docs/INTEGRACOES.md#mock" });
  }
  return out;
}
