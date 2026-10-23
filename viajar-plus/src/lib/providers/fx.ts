import { cached, TTL } from "./cache";
import { ProviderUnavailable } from "./errors";
import { fetchJson, firstOk } from "./http";
import type { ExchangeRateProvider, FxParams, FxResult, ProviderResponse } from "./types";

interface ErApi {
  result?: string;
  base_code?: string;
  rates?: Record<string, number>;
  time_last_update_utc?: string;
}
interface Frank {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

function pick(rates: Record<string, number> | undefined, symbols: string[], provider: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of symbols) {
    const v = rates?.[s];
    if (typeof v !== "number" || !(v > 0)) throw new ProviderUnavailable(provider, `sem cotação para ${s}`);
    out[s] = v;
  }
  return out;
}

export async function erApi(p: FxParams): Promise<ProviderResponse<FxResult>> {
  const symbols = p.symbols.split(",");
  const json = await fetchJson<ErApi>("ExchangeRate-API", `https://open.er-api.com/v6/latest/${p.base}`, { timeoutMs: 10_000 });
  if (json.result !== "success") throw new ProviderUnavailable("ExchangeRate-API", "resposta sem sucesso");
  return {
    provider: "ExchangeRate-API (open access)",
    queried_at: new Date().toISOString(),
    results: [{ base: p.base, rates: pick(json.rates, symbols, "ExchangeRate-API"), rate_date: json.time_last_update_utc ?? null }],
    attribution: "Rates By Exchange Rate API — https://www.exchangerate-api.com",
    cached: false,
    notice: "Taxa de referência diária; a cotação de cartão/casa de câmbio será diferente.",
  };
}

export async function frankfurter(p: FxParams): Promise<ProviderResponse<FxResult>> {
  const symbols = p.symbols.split(",");
  const json = await fetchJson<Frank>("Frankfurter", `https://api.frankfurter.dev/v1/latest?base=${p.base}&symbols=${p.symbols}`, { timeoutMs: 10_000 });
  return {
    provider: "Frankfurter (BCE)",
    queried_at: new Date().toISOString(),
    results: [{ base: p.base, rates: pick(json.rates, symbols, "Frankfurter"), rate_date: json.date ?? null }],
    attribution: "Taxas de referência do Banco Central Europeu via Frankfurter",
    cached: false,
    notice: "Taxa de referência; não inclui spread bancário nem IOF.",
  };
}

export class FxChain implements ExchangeRateProvider {
  readonly key = "fx";
  readonly name = "Câmbio (ExchangeRate-API → Frankfurter)";
  isConfigured() {
    return true;
  }
  async latest(p: FxParams): Promise<ProviderResponse<FxResult>> {
    return cached(`fx:${p.base}:${p.symbols}`, TTL.fx, () => firstOk([() => erApi(p), () => frankfurter(p)]));
  }
}
