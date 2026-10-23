import type { FlightOption, LodgingOption } from "@/lib/types";
import { cached, cacheGet, cacheSet, TTL } from "./cache";
import { amadeusConfig } from "./config";
import { flexOffsets, nightsBetween, shiftDate } from "./dates";
import { ProviderError, ProviderNotConfigured } from "./errors";
import { fetchJson, firstOk, isoDurationToMin } from "./http";
import type {
  AccommodationSearchProvider,
  ActivityParams,
  ActivityResult,
  ActivitySearchProvider,
  FlightParams,
  FlightSearchProvider,
  LodgingParams,
  ProviderResponse,
} from "./types";

const NAME = "Amadeus";
const ATTR = "Dados fornecidos pela Amadeus for Developers no momento da consulta.";
const MAX_CALLS = 6;

async function token(): Promise<string> {
  const cfg = amadeusConfig();
  if (!cfg.configured) throw new ProviderNotConfigured(NAME);
  const key = `amadeus:token:${cfg.env}`;
  const hit = cacheGet<string>(key);
  if (hit) return hit;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: cfg.id, client_secret: cfg.secret });
  const json = await fetchJson<{ access_token?: string; expires_in?: number }>(NAME, `${cfg.base}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!json.access_token) throw new ProviderError("Amadeus recusou as credenciais.", NAME, 502);
  cacheSet(key, json.access_token, Math.min(TTL.token, Math.max(60, (json.expires_in ?? 1799) - 60) * 1000));
  return json.access_token;
}

async function get<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const cfg = amadeusConfig();
  const t = await token();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  return fetchJson<T>(NAME, `${cfg.base}${path}?${qs}`, { headers: { Authorization: `Bearer ${t}` }, timeoutMs: 20_000 });
}

// ---------- Voos ----------

interface AmaSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
}
interface AmaOffer {
  id: string;
  itineraries: { duration: string; segments: AmaSegment[] }[];
  price: { currency: string; grandTotal?: string; total: string };
  lastTicketingDate?: string;
  pricingOptions?: { includedCheckedBagsOnly?: boolean };
  travelerPricings?: {
    fareDetailsBySegment?: { cabin?: string; brandedFare?: string; includedCheckedBags?: { quantity?: number; weight?: number; weightUnit?: string } }[];
  }[];
}
interface AmaFlightResponse {
  data?: AmaOffer[];
  dictionaries?: { carriers?: Record<string, string> };
}

export function normalizeAmadeusFlights(json: AmaFlightResponse, travelers: number, queriedAt: string, bookingUrl: string): FlightOption[] {
  const carriers = json.dictionaries?.carriers ?? {};
  return (json.data ?? []).map((o) => {
    const segments = o.itineraries.flatMap((it) =>
      it.segments.map((s) => ({
        carrier: carriers[s.carrierCode] ?? s.carrierCode,
        flight_number: `${s.carrierCode}${s.number}`,
        from: s.departure.iataCode,
        to: s.arrival.iataCode,
        depart_at: s.departure.at,
        arrive_at: s.arrival.at,
      })),
    );
    const out = o.itineraries[0];
    const fare = o.travelerPricings?.[0]?.fareDetailsBySegment?.[0];
    const bags = fare?.includedCheckedBags;
    const baggage =
      bags?.quantity != null
        ? `${bags.quantity} mala(s) despachada(s) por passageiro`
        : bags?.weight != null
          ? `${bags.weight} ${bags.weightUnit ?? "KG"} despachados por passageiro`
          : "Bagagem despachada não informada pela fonte";
    const total = Number(o.price.grandTotal ?? o.price.total);
    return {
      id: `amadeus:${o.id}:${segments[0]?.depart_at ?? ""}`,
      provider: NAME,
      carrier_names: [...new Set(segments.map((s) => s.carrier))],
      segments,
      outbound_duration_min: isoDurationToMin(out?.duration) ?? 0,
      stops: Math.max(0, (out?.segments.length ?? 1) - 1),
      cabin: fare?.cabin ?? "",
      baggage_included: baggage,
      fare_rules: [fare?.brandedFare ? `Tarifa ${fare.brandedFare}` : "", o.lastTicketingDate ? `Emitir até ${o.lastTicketingDate}` : ""].filter(Boolean).join(" · ") || "Regras tarifárias não informadas pela fonte",
      total_price: total,
      currency: o.price.currency,
      price_per_person: travelers > 0 ? Math.round((total / travelers) * 100) / 100 : total,
      booking_url: bookingUrl,
      queried_at: queriedAt,
    };
  });
}

export class AmadeusFlights implements FlightSearchProvider {
  readonly key = "amadeus";
  readonly name = NAME;
  isConfigured() {
    return amadeusConfig().configured;
  }

  async searchFlights(p: FlightParams): Promise<ProviderResponse<FlightOption>> {
    if (!this.isConfigured()) throw new ProviderNotConfigured(NAME);
    const key = `amadeus:flights:${JSON.stringify(p)}`;
    return cached(key, TTL.flights, async () => {
      const queried_at = new Date().toISOString();
      const travelers = p.adults + p.children;
      const origins = [p.origin, ...p.extra_origins];
      const dests = [p.destination, ...p.extra_destinations];
      const combos: { o: string; d: string; off: number }[] = [];
      for (const off of flexOffsets(p.flex_days)) for (const o of origins) for (const d of dests) combos.push({ o, d, off });
      const used = combos.slice(0, MAX_CALLS);
      const results: FlightOption[] = [];
      const errors: string[] = [];
      for (const c of used) {
        try {
          const json = await get<AmaFlightResponse>("/v2/shopping/flight-offers", {
            originLocationCode: c.o,
            destinationLocationCode: c.d,
            departureDate: shiftDate(p.departure_date, c.off),
            returnDate: p.return_date ? shiftDate(p.return_date, c.off) : undefined,
            adults: p.adults,
            children: p.children || undefined,
            travelClass: p.cabin,
            nonStop: p.nonstop || undefined,
            currencyCode: p.currency,
            max: p.max_results,
          });
          results.push(...normalizeAmadeusFlights(json, travelers, queried_at, ""));
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
          if (e instanceof ProviderError && e.status === 429) break;
        }
      }
      if (!results.length && errors.length) throw new ProviderError(errors[0], NAME, 502);
      const notes = [
        "A Amadeus não vende passagens: conclua a compra no site da companhia ou agência.",
        combos.length > used.length ? `Foram pesquisadas ${used.length} de ${combos.length} combinações de datas/aeroportos para respeitar limites da API.` : "",
        errors.length ? `${errors.length} consulta(s) falharam.` : "",
      ].filter(Boolean);
      return { provider: NAME, queried_at, results, attribution: ATTR, cached: false, notice: notes.join(" ") };
    });
  }
}

// ---------- Hospedagem ----------

interface AmaHotelRef {
  hotelId: string;
  name: string;
  geoCode?: { latitude: number; longitude: number };
  distance?: { value: number; unit: string };
}
interface AmaHotelOffers {
  data?: {
    available?: boolean;
    hotel: { hotelId: string; name: string; latitude?: number; longitude?: number };
    offers?: {
      price: { currency: string; total?: string; base?: string; taxes?: { included?: boolean }[] };
      boardType?: string;
      policies?: { cancellations?: { deadline?: string; description?: { text?: string } }[]; refundable?: { cancellationRefund?: string } };
      room?: { description?: { text?: string } };
    }[];
  }[];
}

export function normalizeAmadeusHotels(refs: AmaHotelRef[], offers: AmaHotelOffers, queriedAt: string): LodgingOption[] {
  const byId = new Map(refs.map((r) => [r.hotelId, r]));
  return (offers.data ?? []).map((h) => {
    const ref = byId.get(h.hotel.hotelId);
    const o = h.offers?.[0];
    const desc = (o?.room?.description?.text ?? "").toLowerCase();
    const cancel = o?.policies?.cancellations?.[0];
    const taxes = o?.price.taxes;
    return {
      id: `amadeus:${h.hotel.hotelId}`,
      provider: NAME,
      name: h.hotel.name,
      kind: "hotel",
      address: "",
      lat: h.hotel.latitude ?? ref?.geoCode?.latitude ?? null,
      lng: h.hotel.longitude ?? ref?.geoCode?.longitude ?? null,
      total_price: o?.price.total ? Number(o.price.total) : null,
      taxes_included: taxes?.length ? taxes.every((t) => t.included !== false) : null,
      currency: o?.price.currency ?? "",
      breakfast: o?.boardType ? /BREAKFAST|HALF|FULL|ALL/.test(o.boardType) : null,
      kitchen: desc ? /kitchen|kitchenette|cozinha/.test(desc) || null : null,
      parking: null,
      cancellation: cancel?.description?.text ?? (cancel?.deadline ? `Cancelamento gratuito até ${cancel.deadline}` : "Política de cancelamento não informada"),
      rating: null,
      distance_center_km: ref?.distance ? (ref.distance.unit === "MI" ? ref.distance.value * 1.609 : ref.distance.value) : null,
      photos: [],
      booking_url: "",
      availability_confirmed: h.available === true,
      queried_at: queriedAt,
    };
  });
}

export class AmadeusLodging implements AccommodationSearchProvider {
  readonly key = "amadeus";
  readonly name = NAME;
  isConfigured() {
    return amadeusConfig().configured;
  }

  async searchLodging(p: LodgingParams): Promise<ProviderResponse<LodgingOption>> {
    if (!this.isConfigured()) throw new ProviderNotConfigured(NAME);
    return cached(`amadeus:lodging:${JSON.stringify(p)}`, TTL.lodging, async () => {
      const queried_at = new Date().toISOString();
      const refsJson = await firstOk<{ data?: AmaHotelRef[] }>([
        ...(p.lat != null && p.lng != null
          ? [() => get<{ data?: AmaHotelRef[] }>("/v1/reference-data/locations/hotels/by-geocode", { latitude: p.lat, longitude: p.lng, radius: 15, radiusUnit: "KM" })]
          : []),
        ...(p.city_code ? [() => get<{ data?: AmaHotelRef[] }>("/v1/reference-data/locations/hotels/by-city", { cityCode: p.city_code })] : []),
      ]).catch((e) => {
        if (p.lat == null && !p.city_code) throw new ProviderError("Informe coordenadas ou código da cidade para pesquisar hotéis.", NAME, 400);
        throw e;
      });
      const refs = (refsJson.data ?? []).slice(0, 20);
      if (!refs.length) return { provider: NAME, queried_at, results: [], attribution: ATTR, cached: false, notice: "Nenhum hotel listado pela fonte nesta região." };
      const offers = await get<AmaHotelOffers>("/v3/shopping/hotel-offers", {
        hotelIds: refs.map((r) => r.hotelId).join(","),
        adults: Math.max(1, Math.ceil((p.adults + p.children) / p.rooms)),
        checkInDate: p.check_in,
        checkOutDate: p.check_out,
        roomQuantity: p.rooms,
        currency: p.currency,
      });
      const results = normalizeAmadeusHotels(refs, offers, queried_at);
      return {
        provider: NAME,
        queried_at,
        results,
        attribution: ATTR,
        cached: false,
        notice: `Preços para ${nightsBetween(p.check_in, p.check_out)} noite(s). A Amadeus cobre principalmente hotéis; apartamentos e casas de temporada podem não aparecer.`,
      };
    });
  }
}

// ---------- Passeios ----------

interface AmaActivity {
  id: string;
  name: string;
  shortDescription?: string;
  description?: string;
  geoCode?: { latitude: string | number; longitude: string | number };
  price?: { amount?: string; currencyCode?: string };
  pictures?: string[];
  bookingLink?: string;
  minimumDuration?: string;
}

export function normalizeAmadeusActivities(json: { data?: AmaActivity[] }, queriedAt: string): ActivityResult[] {
  return (json.data ?? []).map((a) => ({
    id: `amadeus:${a.id}`,
    provider: NAME,
    name: a.name,
    category: "atracao",
    description: (a.shortDescription ?? a.description ?? "").replace(/<[^>]+>/g, "").slice(0, 600),
    price_per_person: a.price?.amount ? Number(a.price.amount) : null,
    price_group: null,
    currency: a.price?.currencyCode ?? "",
    duration_min: isoDurationToMin(a.minimumDuration ? `PT${a.minimumDuration.replace(/\s/g, "").toUpperCase()}` : null),
    min_age: null,
    accessibility: "",
    meeting_point: "",
    cancellation_policy: "",
    provider_name: NAME,
    url: a.bookingLink && /^https:\/\//.test(a.bookingLink) ? a.bookingLink : "",
    lat: a.geoCode ? Number(a.geoCode.latitude) : null,
    lng: a.geoCode ? Number(a.geoCode.longitude) : null,
    photos: (a.pictures ?? []).filter((u) => /^https:\/\//.test(u)).slice(0, 3),
    free_entry: null,
    queried_at: queriedAt,
  }));
}

export class AmadeusActivities implements ActivitySearchProvider {
  readonly key = "amadeus";
  readonly name = NAME;
  isConfigured() {
    return amadeusConfig().configured;
  }
  async searchActivities(p: ActivityParams): Promise<ProviderResponse<ActivityResult>> {
    if (!this.isConfigured()) throw new ProviderNotConfigured(NAME);
    return cached(`amadeus:act:${p.lat.toFixed(3)},${p.lng.toFixed(3)},${p.radius_km}`, TTL.activities, async () => {
      const queried_at = new Date().toISOString();
      const json = await get<{ data?: AmaActivity[] }>("/v1/shopping/activities", { latitude: p.lat, longitude: p.lng, radius: Math.min(20, p.radius_km) });
      return {
        provider: NAME,
        queried_at,
        results: normalizeAmadeusActivities(json, queried_at),
        attribution: ATTR,
        cached: false,
        notice: "Disponibilidade na data escolhida deve ser confirmada no link do fornecedor.",
      };
    });
  }
}
