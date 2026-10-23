import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheClear } from "@/lib/providers/cache";
import { AmadeusFlights, normalizeAmadeusActivities, normalizeAmadeusFlights, normalizeAmadeusHotels } from "@/lib/providers/amadeus";
import { normalizeDuffel } from "@/lib/providers/duffel";
import { ProviderNotConfigured, ProviderUnavailable, RateLimited } from "@/lib/providers/errors";
import { FxChain } from "@/lib/providers/fx";
import { fetchJson, isoDurationToMin } from "@/lib/providers/http";
import { flightLinks, lodgingLinks } from "@/lib/providers/links";
import { buildOverpassQuery, normalizeOverpass, OverpassPlaces } from "@/lib/providers/osm";
import { normalizeOpenMeteo, OpenMeteoWeather, weatherPlan } from "@/lib/providers/weather";
import { flightParamsSchema } from "@/lib/providers/types";
import { flightProviders, integrationStatus } from "@/lib/providers/registry";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

beforeEach(() => cacheClear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("http", () => {
  it("traduz 429 em RateLimited com Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 429, { "retry-after": "30" })));
    await expect(fetchJson("X", "https://x")).rejects.toMatchObject({ name: "RateLimited", retryAfterSec: 30 });
  });

  it("traduz 5xx em ProviderUnavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)));
    await expect(fetchJson("X", "https://x")).rejects.toBeInstanceOf(ProviderUnavailable);
  });

  it("aborta por timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))))),
    );
    await expect(fetchJson("X", "https://x", { timeoutMs: 20 })).rejects.toThrow(/sem resposta/);
  });

  it("converte duração ISO", () => {
    expect(isoDurationToMin("PT2H35M")).toBe(155);
    expect(isoDurationToMin("P1DT1H")).toBe(1500);
    expect(isoDurationToMin(null)).toBeNull();
  });
});

describe("Amadeus", () => {
  it("sem credenciais: não configurado e fora do registro", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "");
    vi.stubEnv("DUFFEL_ACCESS_TOKEN", "");
    const p = flightParamsSchema.parse({ origin: "GRU", destination: "FTE", departure_date: "2026-12-10", adults: 4 });
    await expect(new AmadeusFlights().searchFlights(p)).rejects.toBeInstanceOf(ProviderNotConfigured);
    expect(flightProviders()).toHaveLength(0);
    expect(integrationStatus().find((s) => s.key === "amadeus")?.state).toBe("pendente");
  });

  it("status nunca expõe segredos", () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "id-secreto-123");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "segredo-456");
    const s = JSON.stringify(integrationStatus());
    expect(s).not.toContain("id-secreto-123");
    expect(s).not.toContain("segredo-456");
    expect(integrationStatus().find((x) => x.key === "amadeus")?.state).toBe("configurada");
  });

  it("normaliza ofertas de voo", () => {
    const out = normalizeAmadeusFlights(
      {
        data: [
          {
            id: "1",
            itineraries: [
              {
                duration: "PT7H10M",
                segments: [
                  { departure: { iataCode: "GRU", at: "2026-12-10T06:00:00" }, arrival: { iataCode: "AEP", at: "2026-12-10T09:00:00" }, carrierCode: "AR", number: "1241" },
                  { departure: { iataCode: "AEP", at: "2026-12-10T10:30:00" }, arrival: { iataCode: "FTE", at: "2026-12-10T13:10:00" }, carrierCode: "AR", number: "1872" },
                ],
              },
            ],
            price: { currency: "BRL", total: "10000.00", grandTotal: "10000.00" },
            travelerPricings: [{ fareDetailsBySegment: [{ cabin: "ECONOMY", includedCheckedBags: { quantity: 1 } }] }],
          },
        ],
        dictionaries: { carriers: { AR: "AEROLINEAS ARGENTINAS" } },
      },
      5,
      "2026-10-23T00:00:00Z",
      "",
    );
    expect(out[0]).toMatchObject({ stops: 1, outbound_duration_min: 430, total_price: 10000, price_per_person: 2000, carrier_names: ["AEROLINEAS ARGENTINAS"] });
    expect(out[0].baggage_included).toContain("1 mala");
    expect(out[0].segments).toHaveLength(2);
  });

  it("normaliza hotéis sem inventar disponibilidade", () => {
    const out = normalizeAmadeusHotels(
      [{ hotelId: "H1", name: "Hotel", distance: { value: 2, unit: "KM" } }],
      { data: [{ available: false, hotel: { hotelId: "H1", name: "Hotel" }, offers: [{ price: { currency: "USD", total: "500" }, boardType: "BREAKFAST" }] }] },
      "q",
    );
    expect(out[0]).toMatchObject({ total_price: 500, breakfast: true, availability_confirmed: false, distance_center_km: 2, rating: null });
  });

  it("normaliza atividades e descarta links não https", () => {
    const out = normalizeAmadeusActivities({ data: [{ id: "a", name: "Tour", price: { amount: "80", currencyCode: "USD" }, bookingLink: "javascript:alert(1)", minimumDuration: "2 hours" }] }, "q");
    expect(out[0].url).toBe("");
    expect(out[0].price_per_person).toBe(80);
  });

  it("autentica, consulta e usa cache", async () => {
    vi.stubEnv("AMADEUS_CLIENT_ID", "id");
    vi.stubEnv("AMADEUS_CLIENT_SECRET", "sec");
    const f = vi.fn(async (url: string) =>
      url.includes("oauth2") ? json({ access_token: "tok", expires_in: 1799 }) : json({ data: [], dictionaries: {} }),
    );
    vi.stubGlobal("fetch", f);
    const p = flightParamsSchema.parse({ origin: "GRU", destination: "FTE", departure_date: "2026-12-10", adults: 2 });
    const a = await new AmadeusFlights().searchFlights(p);
    const b = await new AmadeusFlights().searchFlights(p);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(f).toHaveBeenCalledTimes(2); // token + 1 busca; a segunda veio do cache
  });
});

describe("Duffel", () => {
  it("normaliza ofertas", () => {
    const out = normalizeDuffel(
      {
        data: {
          offers: [
            {
              id: "off",
              total_amount: "900",
              total_currency: "USD",
              slices: [
                {
                  duration: "PT3H",
                  segments: [
                    {
                      origin: { iata_code: "GRU" },
                      destination: { iata_code: "EZE" },
                      departing_at: "a",
                      arriving_at: "b",
                      marketing_carrier: { name: "LATAM", iata_code: "LA" },
                      marketing_carrier_flight_number: "8000",
                      passengers: [{ baggages: [{ type: "checked", quantity: 1 }] }],
                    },
                  ],
                },
              ],
              conditions: { refund_before_departure: { allowed: false } },
            },
          ],
        },
      },
      3,
      "q",
    );
    expect(out[0]).toMatchObject({ stops: 0, price_per_person: 300, fare_rules: "Não reembolsável" });
  });
});

describe("OpenStreetMap", () => {
  const p = { lat: -50.34, lng: -72.26, category: "religioso" as const, radius_m: 3000, limit: 10 };

  it("monta consulta Overpass", () => {
    const q = buildOverpassQuery(p);
    expect(q).toContain('["amenity"="place_of_worship"]');
    expect(q).toContain("around:3000,-50.34,-72.26");
  });

  it("normaliza, remove sem nome e ordena por distância", () => {
    const out = normalizeOverpass(
      {
        elements: [
          { type: "node", id: 1, lat: -50.35, lon: -72.26, tags: { name: "Capela Longe", amenity: "place_of_worship", religion: "christian" } },
          { type: "way", id: 2, center: { lat: -50.3401, lon: -72.2601 }, tags: { name: "Igreja Perto", amenity: "place_of_worship", fee: "no", website: "javascript:x" } },
          { type: "node", id: 3, lat: -50.34, lon: -72.26, tags: { amenity: "place_of_worship" } },
        ],
      },
      p,
    );
    expect(out.map((x) => x.name)).toEqual(["Igreja Perto", "Capela Longe"]);
    expect(out[0]).toMatchObject({ id: "osm:way/2", fee: false, website: "" });
  });

  it("usa endpoint reserva quando o primeiro falha", async () => {
    const f = vi.fn(async (url: string) => (url.includes("primeiro") ? json({}, 504) : json({ elements: [] })));
    vi.stubGlobal("fetch", f);
    const r = await new OverpassPlaces(["https://primeiro", "https://segundo"]).places(p);
    expect(r.results).toEqual([]);
    expect(r.attribution).toContain("OpenStreetMap");
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("Open-Meteo", () => {
  const today = new Date("2026-10-23T12:00:00Z");
  it("previsão só até 16 dias; depois, histórico rotulado", () => {
    expect(weatherPlan({ lat: 0, lng: 0, start_date: "2026-10-25", end_date: "2026-10-30" }, today).kind).toBe("previsao");
    const h = weatherPlan({ lat: 0, lng: 0, start_date: "2026-12-10", end_date: "2026-12-15" }, today);
    expect(h).toEqual({ kind: "historico", start: "2025-12-10", end: "2025-12-15" });
    expect(weatherPlan({ lat: 0, lng: 0, start_date: "2026-01-10", end_date: "2026-01-15" }, today).kind).toBe("observado");
  });

  it("chama o arquivo histórico e rotula como não previsão", async () => {
    const f = vi.fn(async (_url: string) => json({ daily: { time: ["2025-12-10"], temperature_2m_max: [14.2], temperature_2m_min: [3.1], precipitation_sum: [0.4] } }));
    vi.stubGlobal("fetch", f);
    const r = await new OpenMeteoWeather().weather({ lat: -50.34, lng: -72.26, start_date: "2026-12-10", end_date: "2026-12-15" }, today);
    expect(f.mock.calls[0][0]).toContain("archive-api");
    expect(r.results[0].label).toMatch(/Histórico, não previsão/);
    expect(r.results[0].days[0]).toMatchObject({ t_max: 14.2, t_min: 3.1 });
  });

  it("normaliza vazio sem quebrar", () => {
    expect(normalizeOpenMeteo({})).toEqual([]);
  });
});

describe("Câmbio", () => {
  it("usa ExchangeRate-API e devolve só os símbolos pedidos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ result: "success", rates: { ARS: 250.5, USD: 0.18 }, time_last_update_utc: "x" })));
    const r = await new FxChain().latest({ base: "BRL", symbols: "ARS" });
    expect(r.results[0].rates).toEqual({ ARS: 250.5 });
  });

  it("cai para Frankfurter quando a primeira fonte falha", async () => {
    const f = vi.fn(async (url: string) => (url.includes("er-api") ? json({}, 500) : json({ base: "BRL", date: "2026-10-22", rates: { USD: 0.18 } })));
    vi.stubGlobal("fetch", f);
    const r = await new FxChain().latest({ base: "BRL", symbols: "USD" });
    expect(r.provider).toContain("Frankfurter");
  });

  it("falha quando nenhuma fonte tem a moeda", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.includes("er-api") ? json({ result: "success", rates: {} }) : json({ rates: {} }))));
    await expect(new FxChain().latest({ base: "BRL", symbols: "XYZ" })).rejects.toThrow(/sem cotação/);
  });
});

describe("Links externos", () => {
  it("preenche parâmetros e Airbnb é apenas link", () => {
    const f = flightLinks({ origin: "gru", destination: "fte", departure_date: "2026-12-10", return_date: "2026-12-15", adults: 4, children_ages: [8] });
    expect(f.find((l) => l.label === "Kayak")?.url).toBe("https://www.kayak.com.br/flights/GRU-FTE/2026-12-10/2026-12-15/4adults/children-8");
    const l = lodgingLinks({ destination: "El Calafate", check_in: "2026-12-10", check_out: "2026-12-15", adults: 4, children_ages: [8] });
    expect(l.find((x) => x.label === "Booking.com")?.url).toContain("age=8");
    expect(l.find((x) => x.label === "Airbnb")?.note).toMatch(/Somente link/);
  });
});
