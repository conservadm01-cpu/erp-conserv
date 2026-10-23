import { cached, TTL } from "./cache";
import { shiftDate } from "./dates";
import { fetchJson } from "./http";
import type { ProviderResponse, WeatherDay, WeatherParams, WeatherProvider, WeatherResult } from "./types";

const DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,sunrise,sunset";
export const FORECAST_DAYS = 16;

interface OMDaily {
  daily?: {
    time: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
  };
}

export function normalizeOpenMeteo(json: OMDaily, dateShiftDays = 0): WeatherDay[] {
  const d = json.daily;
  if (!d) return [];
  return d.time.map((t, i) => ({
    date: dateShiftDays ? shiftDate(t, dateShiftDays) : t,
    t_max: d.temperature_2m_max?.[i] ?? null,
    t_min: d.temperature_2m_min?.[i] ?? null,
    precipitation_mm: d.precipitation_sum?.[i] ?? null,
    wind_max_kmh: d.wind_speed_10m_max?.[i] ?? null,
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
  }));
}

function shiftYear(iso: string, years: number): string {
  const y = Number(iso.slice(0, 4)) + years;
  const rest = iso.slice(4) === "-02-29" ? "-02-28" : iso.slice(4);
  return `${y}${rest}`;
}

/** Decide entre previsão (até 16 dias), histórico do ano anterior (viagem futura distante) ou dados observados (viagem passada). */
export function weatherPlan(p: WeatherParams, today: Date): { kind: "previsao" | "historico" | "observado"; start: string; end: string } {
  const t = today.toISOString().slice(0, 10);
  const horizon = shiftDate(t, FORECAST_DAYS - 1);
  if (p.end_date < shiftDate(t, -5)) return { kind: "observado", start: p.start_date, end: p.end_date };
  if (p.start_date >= t && p.end_date <= horizon) return { kind: "previsao", start: p.start_date, end: p.end_date };
  return { kind: "historico", start: shiftYear(p.start_date, -1), end: shiftYear(p.end_date, -1) };
}

export class OpenMeteoWeather implements WeatherProvider {
  readonly key = "open-meteo";
  readonly name = "Open-Meteo";
  isConfigured() {
    return true;
  }

  async weather(p: WeatherParams, today = new Date()): Promise<ProviderResponse<WeatherResult>> {
    const plan = weatherPlan(p, today);
    const key = `om:${plan.kind}:${p.lat.toFixed(2)},${p.lng.toFixed(2)}:${plan.start}:${plan.end}`;
    return cached(key, TTL.weather, async () => {
      const qs = new URLSearchParams({
        latitude: String(p.lat),
        longitude: String(p.lng),
        daily: DAILY,
        timezone: "auto",
        start_date: plan.start,
        end_date: plan.end,
      });
      const base = plan.kind === "previsao" ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
      const json = await fetchJson<OMDaily>(this.name, `${base}?${qs}`, { timeoutMs: 15_000 });
      const days = normalizeOpenMeteo(json);
      const label =
        plan.kind === "previsao"
          ? "Previsão do tempo (pode mudar; atualize perto da data)."
          : plan.kind === "observado"
            ? "Dados observados no período da viagem."
            : `Histórico, não previsão: tempo registrado de ${plan.start} a ${plan.end} (ano anterior), só como referência do clima típico. A previsão fica disponível ${FORECAST_DAYS} dias antes.`;
      return {
        provider: this.name,
        queried_at: new Date().toISOString(),
        results: [{ kind: plan.kind === "previsao" ? "previsao" : "historico", label, reference_period: { start: plan.start, end: plan.end }, days }],
        attribution: "Dados meteorológicos: Open-Meteo.com (CC BY 4.0)",
        cached: false,
      };
    });
  }
}
