import { z } from "zod";
import type { FlightOption, LodgingOption, RentalOption } from "@/lib/types";

// Modelo comum de resposta de todos os provedores.
export interface ProviderResponse<T> {
  provider: string;
  queried_at: string;
  results: T[];
  attribution: string;
  cached: boolean;
  notice?: string;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)");
const iata = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use o código IATA de 3 letras (ex.: GRU)");

export const flightParamsSchema = z
  .object({
    origin: iata,
    destination: iata,
    departure_date: isoDate,
    return_date: isoDate.optional().nullable(),
    adults: z.coerce.number().int().min(1).max(9),
    children: z.coerce.number().int().min(0).max(8).default(0),
    children_ages: z.array(z.coerce.number().int().min(0).max(17)).max(8).default([]),
    extra_origins: z.array(iata).max(2).default([]), // aeroportos próximos/alternativos
    extra_destinations: z.array(iata).max(2).default([]),
    cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
    checked_bags: z.coerce.number().int().min(0).max(3).default(0),
    flex_days: z.coerce.number().int().min(0).max(3).default(0),
    nonstop: z.coerce.boolean().default(false),
    currency: z.string().regex(/^[A-Z]{3}$/).default("BRL"),
    max_results: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine((p) => !p.return_date || p.return_date >= p.departure_date, { path: ["return_date"], message: "A volta deve ser depois da ida" })
  .refine((p) => p.children_ages.length === 0 || p.children_ages.length === p.children, { path: ["children_ages"], message: "Informe a idade de cada criança" });
export type FlightParams = z.infer<typeof flightParamsSchema>;

export const lodgingParamsSchema = z
  .object({
    city_code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    destination: z.string().trim().min(2).max(160),
    check_in: isoDate,
    check_out: isoDate,
    adults: z.coerce.number().int().min(1).max(30),
    children: z.coerce.number().int().min(0).max(20).default(0),
    rooms: z.coerce.number().int().min(1).max(10).default(1),
    beds: z.coerce.number().int().min(0).max(30).default(0),
    kind: z.enum(["qualquer", "hotel", "apartamento", "casa"]).default("qualquer"),
    currency: z.string().regex(/^[A-Z]{3}$/).default("BRL"),
  })
  .refine((p) => p.check_out > p.check_in, { path: ["check_out"], message: "Check-out deve ser depois do check-in" });
export type LodgingParams = z.infer<typeof lodgingParamsSchema>;

export const carParamsSchema = z.object({
  pickup_place: z.string().trim().min(2).max(160),
  dropoff_place: z.string().trim().max(160).optional().default(""),
  pickup_date: isoDate,
  pickup_time: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  dropoff_date: isoDate,
  dropoff_time: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  category: z.string().max(40).default(""),
  transmission: z.enum(["qualquer", "manual", "automatico"]).default("qualquer"),
  passengers: z.coerce.number().int().min(1).max(15).default(1),
  bags: z.coerce.number().int().min(0).max(15).default(0),
});
export type CarParams = z.infer<typeof carParamsSchema>;

export const activityParamsSchema = z.object({
  destination: z.string().trim().min(2).max(160),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  date: isoDate.optional().nullable(),
  radius_km: z.coerce.number().min(1).max(50).default(15),
});
export type ActivityParams = z.infer<typeof activityParamsSchema>;

export const PLACE_CATEGORIES = ["restaurante", "bar", "cafe", "culinaria", "religioso", "mirante", "museu", "parque", "atracao"] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const placesParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: z.enum(PLACE_CATEGORIES),
  radius_m: z.coerce.number().int().min(200).max(30000).default(3000),
  limit: z.coerce.number().int().min(1).max(200).default(60),
});
export type PlacesParams = z.infer<typeof placesParamsSchema>;

export const geocodeParamsSchema = z.object({ q: z.string().trim().min(2).max(200), limit: z.coerce.number().int().min(1).max(10).default(5) });
export type GeocodeParams = z.infer<typeof geocodeParamsSchema>;

export const weatherParamsSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    start_date: isoDate,
    end_date: isoDate,
  })
  .refine((p) => p.end_date >= p.start_date, { path: ["end_date"], message: "Período inválido" });
export type WeatherParams = z.infer<typeof weatherParamsSchema>;

export const fxParamsSchema = z.object({
  base: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Moeda inválida"),
  symbols: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}(,[A-Z]{3})*$/, "Moedas inválidas"),
});
export type FxParams = z.infer<typeof fxParamsSchema>;

// ---------- Resultados normalizados ----------

export interface ActivityResult {
  id: string;
  provider: string;
  name: string;
  category: string;
  description: string;
  price_per_person: number | null;
  price_group: number | null;
  currency: string;
  duration_min: number | null;
  min_age: number | null;
  accessibility: string;
  meeting_point: string;
  cancellation_policy: string;
  provider_name: string;
  url: string;
  lat: number | null;
  lng: number | null;
  photos: string[];
  free_entry: boolean | null;
  queried_at: string;
}

export interface Place {
  id: string; // "osm:node/123"
  name: string;
  category: PlaceCategory;
  subtype: string; // ex.: "restaurant", "church"
  cuisine: string;
  religion: string;
  lat: number;
  lng: number;
  address: string;
  opening_hours: string;
  website: string;
  phone: string;
  wheelchair: string; // "yes" | "no" | "limited" | ""
  fee: boolean | null; // null = não informado
  distance_m: number | null;
}

export interface GeoResult {
  name: string;
  display_name: string;
  lat: number;
  lng: number;
  country: string;
  country_code: string;
  type: string;
}

export interface WeatherDay {
  date: string;
  t_max: number | null;
  t_min: number | null;
  precipitation_mm: number | null;
  wind_max_kmh: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface WeatherResult {
  kind: "previsao" | "historico";
  label: string;
  reference_period: { start: string; end: string };
  days: WeatherDay[];
}

export interface FxResult {
  base: string;
  rates: Record<string, number>;
  rate_date: string | null;
}

// ---------- Interfaces de provedores ----------

export interface BaseProvider {
  readonly key: string;
  readonly name: string;
  isConfigured(): boolean;
}

export interface FlightSearchProvider extends BaseProvider {
  searchFlights(p: FlightParams): Promise<ProviderResponse<FlightOption>>;
}
export interface AccommodationSearchProvider extends BaseProvider {
  searchLodging(p: LodgingParams): Promise<ProviderResponse<LodgingOption>>;
}
export interface CarRentalSearchProvider extends BaseProvider {
  searchCars(p: CarParams): Promise<ProviderResponse<RentalOption>>;
}
export interface ActivitySearchProvider extends BaseProvider {
  searchActivities(p: ActivityParams): Promise<ProviderResponse<ActivityResult>>;
}
export interface ExchangeRateProvider extends BaseProvider {
  latest(p: FxParams): Promise<ProviderResponse<FxResult>>;
}
export interface MapsProvider extends BaseProvider {
  geocode(p: GeocodeParams): Promise<ProviderResponse<GeoResult>>;
}
export interface WeatherProvider extends BaseProvider {
  weather(p: WeatherParams, today?: Date): Promise<ProviderResponse<WeatherResult>>;
}
export interface PlacesProvider extends BaseProvider {
  places(p: PlacesParams): Promise<ProviderResponse<Place>>;
}
