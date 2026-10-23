"use client";
import { useEffect, useState } from "react";
import type { CurrencyCode } from "@/lib/types";

export interface FxResult {
  rate: number | null;
  source: string | null;
  fetched_at: string | null;
  error: string | null;
  loading: boolean;
}

/** Cotação de câmbio via /api/fx (servidor consulta o ExchangeRateProvider e mantém cache). */
export function useFxRate(from: CurrencyCode | null | undefined, to: CurrencyCode | null | undefined): FxResult {
  const [state, setState] = useState<FxResult>({ rate: null, source: null, fetched_at: null, error: null, loading: false });
  useEffect(() => {
    if (!from || !to) return;
    if (from === to) {
      setState({ rate: 1, source: "mesma moeda", fetched_at: null, error: null, loading: false });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fetchFxRate(from, to)
      .then((r) => alive && setState({ ...r, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ rate: null, source: null, fetched_at: null, error: e instanceof Error ? e.message : String(e), loading: false }));
    return () => {
      alive = false;
    };
  }, [from, to]);
  return state;
}

export async function fetchFxRate(from: CurrencyCode, to: CurrencyCode): Promise<{ rate: number; source: string; fetched_at: string }> {
  if (from === to) return { rate: 1, source: "mesma moeda", fetched_at: new Date().toISOString() };
  const res = await fetch(`/api/fx?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`);
  const json = (await res.json().catch(() => ({}))) as { rates?: Record<string, number>; source?: string; fetched_at?: string; error?: string };
  const rate = json.rates?.[to];
  if (!res.ok || !rate) throw new Error(json.error ?? "Câmbio indisponível no momento");
  return { rate, source: json.source ?? "", fetched_at: json.fetched_at ?? new Date().toISOString() };
}
