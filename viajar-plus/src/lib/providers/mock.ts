import type { FlightOption, LodgingOption } from "@/lib/types";
import { mocksEnabled } from "./config";
import { ProviderNotConfigured } from "./errors";
import type { AccommodationSearchProvider, ActivityParams, ActivityResult, ActivitySearchProvider, FlightParams, FlightSearchProvider, LodgingParams, ProviderResponse } from "./types";

// Provedores FICTÍCIOS apenas para desenvolvimento (NODE_ENV=development e
// ENABLE_MOCK_PROVIDERS=true). Todos os resultados são rotulados como fictícios.

export const MOCK_LABEL = "DADOS FICTÍCIOS — provedor de teste em desenvolvimento, não são preços reais.";

function guard(name: string) {
  if (!mocksEnabled()) throw new ProviderNotConfigured(name);
}

export class MockFlights implements FlightSearchProvider {
  readonly key = "mock";
  readonly name = "Mock (DADOS FICTÍCIOS)";
  isConfigured() {
    return mocksEnabled();
  }
  async searchFlights(p: FlightParams): Promise<ProviderResponse<FlightOption>> {
    guard(this.name);
    const q = new Date().toISOString();
    const n = p.adults + p.children;
    const results: FlightOption[] = [0, 1, 2].map((i) => {
      const total = 1000 * n * (i + 1);
      return {
        id: `mock:${i}`,
        provider: this.name,
        carrier_names: [`Companhia Fictícia ${i + 1}`],
        segments: [{ carrier: `Companhia Fictícia ${i + 1}`, flight_number: `XX${100 + i}`, from: p.origin, to: p.destination, depart_at: `${p.departure_date}T0${6 + i}:00:00`, arrive_at: `${p.departure_date}T1${i}:30:00` }],
        outbound_duration_min: 270 + i * 60,
        stops: i,
        cabin: p.cabin,
        baggage_included: "Fictício",
        fare_rules: MOCK_LABEL,
        total_price: total,
        currency: p.currency,
        price_per_person: total / n,
        booking_url: "",
        queried_at: q,
      };
    });
    return { provider: this.name, queried_at: q, results, attribution: MOCK_LABEL, cached: false, notice: MOCK_LABEL };
  }
}

export class MockLodging implements AccommodationSearchProvider {
  readonly key = "mock";
  readonly name = "Mock (DADOS FICTÍCIOS)";
  isConfigured() {
    return mocksEnabled();
  }
  async searchLodging(p: LodgingParams): Promise<ProviderResponse<LodgingOption>> {
    guard(this.name);
    const q = new Date().toISOString();
    const results: LodgingOption[] = [0, 1].map((i) => ({
      id: `mock:h${i}`,
      provider: this.name,
      name: `Hospedagem Fictícia ${i + 1}`,
      kind: i ? "apartamento" : "hotel",
      address: "Endereço fictício",
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      total_price: 2000 * (i + 1),
      taxes_included: null,
      currency: p.currency,
      breakfast: !i,
      kitchen: Boolean(i),
      parking: true,
      cancellation: MOCK_LABEL,
      rating: null,
      distance_center_km: 1 + i,
      photos: [],
      booking_url: "",
      availability_confirmed: false,
      queried_at: q,
    }));
    return { provider: this.name, queried_at: q, results, attribution: MOCK_LABEL, cached: false, notice: MOCK_LABEL };
  }
}

export class MockActivities implements ActivitySearchProvider {
  readonly key = "mock";
  readonly name = "Mock (DADOS FICTÍCIOS)";
  isConfigured() {
    return mocksEnabled();
  }
  async searchActivities(p: ActivityParams): Promise<ProviderResponse<ActivityResult>> {
    guard(this.name);
    const q = new Date().toISOString();
    return {
      provider: this.name,
      queried_at: q,
      results: [
        {
          id: "mock:a1",
          provider: this.name,
          name: "Passeio Fictício",
          category: "atracao",
          description: MOCK_LABEL,
          price_per_person: 100,
          price_group: null,
          currency: "BRL",
          duration_min: 120,
          min_age: 6,
          accessibility: "",
          meeting_point: p.destination,
          cancellation_policy: MOCK_LABEL,
          provider_name: this.name,
          url: "",
          lat: p.lat,
          lng: p.lng,
          photos: [],
          free_entry: null,
          queried_at: q,
        },
      ],
      attribution: MOCK_LABEL,
      cached: false,
      notice: MOCK_LABEL,
    };
  }
}
