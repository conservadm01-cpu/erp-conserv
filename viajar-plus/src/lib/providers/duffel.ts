import type { FlightOption } from "@/lib/types";
import { cached, TTL } from "./cache";
import { duffelConfig } from "./config";
import { ProviderError, ProviderNotConfigured } from "./errors";
import { fetchJson, isoDurationToMin } from "./http";
import type { FlightParams, FlightSearchProvider, ProviderResponse } from "./types";

const NAME = "Duffel";

interface DuffelSegment {
  origin: { iata_code: string };
  destination: { iata_code: string };
  departing_at: string;
  arriving_at: string;
  marketing_carrier: { name: string; iata_code: string };
  marketing_carrier_flight_number: string;
  passengers?: { baggages?: { type: string; quantity: number }[]; cabin_class_marketing_name?: string }[];
}
interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  slices: { duration: string | null; segments: DuffelSegment[] }[];
  conditions?: { refund_before_departure?: { allowed: boolean } | null; change_before_departure?: { allowed: boolean } | null };
}

export function normalizeDuffel(json: { data?: { offers?: DuffelOffer[] } }, travelers: number, queriedAt: string): FlightOption[] {
  return (json.data?.offers ?? []).map((o) => {
    const segments = o.slices.flatMap((s) =>
      s.segments.map((g) => ({
        carrier: g.marketing_carrier.name,
        flight_number: `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`,
        from: g.origin.iata_code,
        to: g.destination.iata_code,
        depart_at: g.departing_at,
        arrive_at: g.arriving_at,
      })),
    );
    const first = o.slices[0];
    const bags = first?.segments[0]?.passengers?.[0]?.baggages ?? [];
    const checked = bags.find((b) => b.type === "checked")?.quantity;
    const total = Number(o.total_amount);
    const rules = [
      o.conditions?.refund_before_departure ? (o.conditions.refund_before_departure.allowed ? "Reembolsável" : "Não reembolsável") : "",
      o.conditions?.change_before_departure ? (o.conditions.change_before_departure.allowed ? "Permite alteração" : "Sem alteração") : "",
    ].filter(Boolean);
    return {
      id: `duffel:${o.id}`,
      provider: NAME,
      carrier_names: [...new Set(segments.map((s) => s.carrier))],
      segments,
      outbound_duration_min: isoDurationToMin(first?.duration) ?? 0,
      stops: Math.max(0, (first?.segments.length ?? 1) - 1),
      cabin: first?.segments[0]?.passengers?.[0]?.cabin_class_marketing_name ?? "",
      baggage_included: checked != null ? `${checked} mala(s) despachada(s) por passageiro` : "Bagagem despachada não informada pela fonte",
      fare_rules: rules.join(" · ") || "Regras tarifárias não informadas pela fonte",
      total_price: total,
      currency: o.total_currency,
      price_per_person: travelers > 0 ? Math.round((total / travelers) * 100) / 100 : total,
      booking_url: "",
      queried_at: queriedAt,
    };
  });
}

export class DuffelFlights implements FlightSearchProvider {
  readonly key = "duffel";
  readonly name = NAME;
  isConfigured() {
    return duffelConfig().configured;
  }

  async searchFlights(p: FlightParams): Promise<ProviderResponse<FlightOption>> {
    const cfg = duffelConfig();
    if (!cfg.configured) throw new ProviderNotConfigured(NAME);
    if (p.children > 0 && p.children_ages.length !== p.children) throw new ProviderError("Duffel exige a idade de cada criança.", NAME, 400);
    return cached(`duffel:${JSON.stringify(p)}`, TTL.flights, async () => {
      const queried_at = new Date().toISOString();
      const slices = [{ origin: p.origin, destination: p.destination, departure_date: p.departure_date }];
      if (p.return_date) slices.push({ origin: p.destination, destination: p.origin, departure_date: p.return_date });
      const passengers = [...Array.from({ length: p.adults }, () => ({ type: "adult" })), ...p.children_ages.map((age) => ({ age }))];
      const json = await fetchJson<{ data?: { offers?: DuffelOffer[] } }>(NAME, "https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000", {
        method: "POST",
        timeoutMs: 25_000,
        headers: { Authorization: `Bearer ${cfg.token}`, "Duffel-Version": "v2", "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { slices, passengers, cabin_class: p.cabin.toLowerCase(), max_connections: p.nonstop ? 0 : 2 },
        }),
      });
      const results = normalizeDuffel(json, p.adults + p.children, queried_at).slice(0, p.max_results);
      return {
        provider: NAME,
        queried_at,
        results,
        attribution: "Ofertas fornecidas pela Duffel no momento da consulta.",
        cached: false,
        notice: "Ofertas expiram em poucos minutos. O VIAJAR+ não emite passagens: conclua a compra no site da companhia/agência.",
      };
    });
  }
}
