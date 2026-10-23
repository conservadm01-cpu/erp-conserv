import { cached, TTL } from "./cache";
import { contactEmail } from "./config";
import { fetchJson, firstOk, haversineM, throttle } from "./http";
import type { GeoResult, GeocodeParams, MapsProvider, Place, PlaceCategory, PlacesParams, PlacesProvider, ProviderResponse } from "./types";

export const OSM_ATTRIBUTION = "© colaboradores do OpenStreetMap (ODbL 1.0) — openstreetmap.org/copyright";

export const OVERPASS_ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const LOCAL_CUISINE = "regional|local|traditional|asado|parrilla|grill|steak_house|argentinian|brazilian|chilean|peruvian|mexican|patagonian|lamb|empanada";

/** Filtros Overpass por categoria do guia. */
export const CATEGORY_FILTERS: Record<PlaceCategory, string[]> = {
  restaurante: ['["amenity"="restaurant"]'],
  bar: ['["amenity"~"^(bar|pub|biergarten)$"]'],
  cafe: ['["amenity"~"^(cafe|ice_cream)$"]', '["shop"~"^(chocolate|confectionery|pastry|bakery)$"]'],
  culinaria: [`["amenity"~"^(restaurant|cafe|fast_food)$"]["cuisine"~"${LOCAL_CUISINE}",i]`, '["shop"~"^(deli|cheese|farm|chocolate)$"]'],
  religioso: ['["amenity"="place_of_worship"]', '["historic"~"^(wayside_shrine|church|monastery)$"]'],
  mirante: ['["tourism"~"^(viewpoint|artwork)$"]', '["man_made"="lighthouse"]'],
  museu: ['["tourism"~"^(museum|gallery)$"]'],
  parque: ['["leisure"~"^(park|nature_reserve|garden)$"]["name"]', '["boundary"="national_park"]'],
  atracao: ['["tourism"~"^(attraction|zoo|theme_park|aquarium)$"]', '["historic"~"^(monument|memorial|castle|ruins)$"]'],
};

export function buildOverpassQuery(p: PlacesParams): string {
  const parts = CATEGORY_FILTERS[p.category].map((f) => `nwr${f}(around:${p.radius_m},${p.lat},${p.lng});`);
  return `[out:json][timeout:25];(${parts.join("")});out center tags ${Math.min(400, p.limit * 3)};`;
}

interface OverpassEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function normalizeOverpass(json: { elements?: OverpassEl[] }, p: PlacesParams): Place[] {
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const el of json.elements ?? []) {
    const t = el.tags ?? {};
    const name = t["name:pt"] ?? t.name;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    const id = `osm:${el.type}/${el.id}`;
    const dedupe = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
    if (seen.has(id) || seen.has(dedupe)) continue;
    seen.add(id);
    seen.add(dedupe);
    const address = [t["addr:street"] ? `${t["addr:street"]}${t["addr:housenumber"] ? `, ${t["addr:housenumber"]}` : ""}` : "", t["addr:city"] ?? ""]
      .filter(Boolean)
      .join(" — ");
    out.push({
      id,
      name,
      category: p.category,
      subtype: t.amenity ?? t.tourism ?? t.leisure ?? t.shop ?? t.historic ?? t.man_made ?? t.boundary ?? "",
      cuisine: (t.cuisine ?? "").replace(/;/g, ", ").replace(/_/g, " "),
      religion: [t.religion, t.denomination].filter(Boolean).join(" · "),
      lat,
      lng,
      address,
      opening_hours: t.opening_hours ?? "",
      website: /^https?:\/\//.test(t.website ?? t["contact:website"] ?? "") ? (t.website ?? t["contact:website"])! : "",
      phone: t.phone ?? t["contact:phone"] ?? "",
      wheelchair: t.wheelchair ?? "",
      fee: t.fee === "no" ? false : t.fee === "yes" ? true : null,
      distance_m: Math.round(haversineM({ lat: p.lat, lng: p.lng }, { lat, lng })),
    });
  }
  return out.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0)).slice(0, p.limit);
}

export class OverpassPlaces implements PlacesProvider {
  readonly key = "osm-overpass";
  readonly name = "OpenStreetMap (Overpass)";
  isConfigured() {
    return true;
  }

  constructor(private endpoints = OVERPASS_ENDPOINTS) {}

  async places(p: PlacesParams): Promise<ProviderResponse<Place>> {
    const key = `osm:places:${p.category}:${p.lat.toFixed(3)},${p.lng.toFixed(3)}:${p.radius_m}:${p.limit}`;
    return cached(key, TTL.places, async () => {
      const body = new URLSearchParams({ data: buildOverpassQuery(p) });
      const json = await firstOk(
        this.endpoints.map(
          (url) => () =>
            fetchJson<{ elements?: OverpassEl[] }>(this.name, url, {
              method: "POST",
              body,
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              timeoutMs: 30_000,
            }),
        ),
      );
      return {
        provider: this.name,
        queried_at: new Date().toISOString(),
        results: normalizeOverpass(json, p),
        attribution: OSM_ATTRIBUTION,
        cached: false,
        notice: "Dados colaborativos: horários, preços e funcionamento podem estar desatualizados. Confirme antes de ir.",
      };
    });
  }
}

const nominatimSlot = throttle(1100);

interface NominatimItem {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type?: string;
  address?: { country?: string; country_code?: string };
}

export function normalizeNominatim(items: NominatimItem[]): GeoResult[] {
  return items.map((i) => ({
    name: i.name || i.display_name.split(",")[0],
    display_name: i.display_name,
    lat: Number(i.lat),
    lng: Number(i.lon),
    country: i.address?.country ?? "",
    country_code: (i.address?.country_code ?? "").toUpperCase(),
    type: i.type ?? "",
  }));
}

export class NominatimMaps implements MapsProvider {
  readonly key = "osm-nominatim";
  readonly name = "OpenStreetMap (Nominatim)";
  isConfigured() {
    return true;
  }
  async geocode(p: GeocodeParams): Promise<ProviderResponse<GeoResult>> {
    return cached(`osm:geo:${p.q.toLowerCase()}:${p.limit}`, TTL.geocode, async () => {
      await nominatimSlot();
      const qs = new URLSearchParams({ q: p.q, format: "jsonv2", limit: String(p.limit), addressdetails: "1", "accept-language": "pt-BR" });
      const email = contactEmail();
      if (email) qs.set("email", email);
      const items = await fetchJson<NominatimItem[]>(this.name, `https://nominatim.openstreetmap.org/search?${qs}`, { timeoutMs: 10_000 });
      return { provider: this.name, queried_at: new Date().toISOString(), results: normalizeNominatim(items), attribution: OSM_ATTRIBUTION, cached: false };
    });
  }
}
