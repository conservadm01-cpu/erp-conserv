import { quoteFromUnit, round2 } from "@/lib/budget/calc";
import type { Expense, NewRow, Quote, QuoteType } from "@/lib/types";

export const QUOTE_TYPE_LABEL: Record<QuoteType, string> = {
  voo: "Voos",
  hospedagem: "Hospedagem",
  carro: "Carros",
  passeio: "Passeios",
  outro: "Outros",
};

export const QUOTE_TYPE_CATEGORY: Record<QuoteType, string> = {
  voo: "passagens",
  hospedagem: "hospedagem",
  carro: "carro",
  passeio: "passeios",
  outro: "outros",
};

/** Idade máxima (dias) antes de pedir nova consulta, por tipo. */
export const STALE_AFTER_DAYS: Record<QuoteType, number> = { voo: 1, hospedagem: 3, carro: 3, passeio: 7, outro: 7 };

export const UNIT_LABEL: Record<QuoteType, string> = { voo: "trecho/pacote", hospedagem: "noite", carro: "diária", passeio: "unidade", outro: "unidade" };

export interface Freshness {
  expired: boolean; // validade informada já passou
  stale: boolean; // consulta antiga: precisa nova consulta
  age_days: number;
  label: string;
}

export function quoteFreshness(q: Pick<Quote, "type" | "captured_at" | "valid_until">, now: Date = new Date()): Freshness {
  const age = Math.max(0, (now.getTime() - new Date(q.captured_at).getTime()) / 86_400_000);
  const expired = Boolean(q.valid_until && new Date(q.valid_until).getTime() < now.getTime());
  const stale = age > STALE_AFTER_DAYS[q.type];
  const label = expired ? "Oferta vencida" : stale ? "Precisa nova consulta" : "Recente";
  return { expired, stale, age_days: Math.floor(age), label };
}

export interface NormalizedQuote {
  quote: Quote;
  base_total: number; // pacote na moeda base
  per_person: number;
  per_family: number;
  per_unit: number;
  freshness: Freshness;
  is_lowest_registered: boolean; // menor entre as cotações registradas (não é "menor do mercado")
  diff_from_lowest: number;
}

export function normalizeQuote(q: Quote, familySize: number, now?: Date): Omit<NormalizedQuote, "is_lowest_registered" | "diff_from_lowest"> {
  const base = quoteFromUnit(1, q.total_price, 0, q.fx_rate || 0);
  const people = Math.max(1, q.travelers_count || 1);
  const perPerson = round2(base / people);
  return {
    quote: q,
    base_total: base,
    per_person: perPerson,
    per_family: round2(perPerson * Math.max(1, familySize)),
    per_unit: round2(base / Math.max(1, q.units || 1)),
    freshness: quoteFreshness(q, now),
  };
}

export interface ComparisonGroup {
  type: QuoteType;
  rows: NormalizedQuote[];
  coverage_note: string;
}

/** Compara cotações ativas por tipo. Só compara o que foi registrado — cobertura parcial do mercado. */
export function compareQuotes(quotes: Quote[], familySize: number, opts: { includeDiscarded?: boolean; now?: Date } = {}): ComparisonGroup[] {
  const groups = new Map<QuoteType, ReturnType<typeof normalizeQuote>[]>();
  for (const q of quotes) {
    if (!opts.includeDiscarded && q.status === "descartada") continue;
    const list = groups.get(q.type) ?? [];
    list.push(normalizeQuote(q, familySize, opts.now));
    groups.set(q.type, list);
  }
  return [...groups.entries()].map(([type, list]) => {
    const valid = list.filter((r) => !r.freshness.expired);
    const lowest = valid.length ? Math.min(...valid.map((r) => r.base_total)) : null;
    const rows = list
      .map((r) => ({
        ...r,
        is_lowest_registered: lowest != null && !r.freshness.expired && r.base_total === lowest,
        diff_from_lowest: lowest != null ? round2(r.base_total - lowest) : 0,
      }))
      .sort((a, b) => a.base_total - b.base_total);
    const sources = new Set(list.map((r) => r.quote.provider_name)).size;
    return {
      type,
      rows,
      coverage_note: `Comparação entre ${list.length} cotação(ões) de ${sources} fonte(s) registradas por você — não representa todo o mercado.`,
    };
  });
}

export interface TrendPoint {
  date: string;
  base_total: number;
}

export interface Trend {
  search_key: string;
  sufficient: boolean;
  points: TrendPoint[];
  change_pct: number | null;
  direction: "subindo" | "caindo" | "estavel" | null;
  message: string;
}

export const MIN_TREND_POINTS = 3;

/** Tendência só com ≥3 consultas do mesmo search_key em datas distintas; sem previsão de preço. */
export function quoteTrends(quotes: Quote[]): Trend[] {
  const byKey = new Map<string, Quote[]>();
  for (const q of quotes) {
    if (!q.search_key) continue;
    const l = byKey.get(q.search_key) ?? [];
    l.push(q);
    byKey.set(q.search_key, l);
  }
  return [...byKey.entries()].map(([key, list]) => {
    // menor preço observado por dia de consulta
    const byDay = new Map<string, number>();
    for (const q of list) {
      const day = q.captured_at.slice(0, 10);
      const v = quoteFromUnit(1, q.total_price, 0, q.fx_rate || 0);
      byDay.set(day, Math.min(byDay.get(day) ?? Infinity, v));
    }
    const points = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, base_total]) => ({ date, base_total }));
    if (points.length < MIN_TREND_POINTS) {
      return {
        search_key: key,
        sufficient: false,
        points,
        change_pct: null,
        direction: null,
        message: `Histórico insuficiente: ${points.length} de ${MIN_TREND_POINTS} consultas em datas diferentes.`,
      };
    }
    const first = points[0].base_total;
    const last = points[points.length - 1].base_total;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    const direction = Math.abs(change) < 2 ? "estavel" : change > 0 ? "subindo" : "caindo";
    return {
      search_key: key,
      sufficient: true,
      points,
      change_pct: round2(change),
      direction,
      message: `Entre ${points[0].date} e ${points[points.length - 1].date} o menor preço registrado variou ${change >= 0 ? "+" : ""}${change.toFixed(1)}%. Isto descreve o passado e não é previsão.`,
    };
  });
}

/** Cria um item de orçamento a partir da cotação: entra como COTADO (não reservado, não pago). */
export function quoteToExpense(q: Quote): NewRow<"expenses"> {
  return {
    trip_id: q.trip_id,
    category_key: QUOTE_TYPE_CATEGORY[q.type],
    description: q.title,
    supplier: q.provider_name,
    quantity: 1,
    unit_price: q.total_price,
    original_currency: q.currency,
    fx_rate: q.fx_rate || 1,
    fees: 0,
    planned_amount: 0,
    quoted_amount: quoteFromUnit(1, q.total_price, 0, q.fx_rate || 1),
    reserved_amount: 0,
    due_date: null,
    responsible_traveler_id: null,
    status: "cotado",
    receipt_document_id: null,
    notes: [`Cotação de ${q.provider_name} (${q.source === "manual" ? "registro manual" : q.source === "api" ? "API" : "demonstração"}) consultada em ${q.captured_at}.`, q.url ? `Fonte: ${q.url}` : ""]
      .filter(Boolean)
      .join(" "),
    split_mode: "todos",
    split: {},
    quote_id: q.id,
    reservation_id: null,
    diary_entry_id: null,
    incurred_on: null,
  };
}

/** Aplica a cotação a um item de orçamento existente (atualiza só o valor cotado e a origem). */
export function quotePatchForExpense(q: Quote): Partial<Expense> {
  return {
    supplier: q.provider_name,
    quantity: 1,
    unit_price: q.total_price,
    original_currency: q.currency,
    fx_rate: q.fx_rate || 1,
    fees: 0,
    quoted_amount: quoteFromUnit(1, q.total_price, 0, q.fx_rate || 1),
    quote_id: q.id,
  };
}
