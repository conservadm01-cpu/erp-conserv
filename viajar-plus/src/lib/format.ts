import type { CurrencyCode, ISODate } from "@/lib/types";

export const LOCALE = "pt-BR";

export function money(value: number | null | undefined, currency: CurrencyCode = "BRL"): string {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function pct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

/** Converte "2026-12-10" em Date local (sem deslocamento de fuso). */
export function parseDate(d: ISODate): Date {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function toISODate(d: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  if (!d) return "—";
  const date = d.length <= 10 ? parseDate(d) : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(LOCALE, opts);
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(LOCALE, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Lista de datas (inclusive) entre início e fim. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const d = parseDate(start);
  const last = parseDate(end);
  while (d <= last && out.length < 400) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function daysBetween(start: ISODate, end: ISODate): number {
  return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86_400_000);
}

export function minutesLabel(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
}

export function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export const CURRENCIES: CurrencyCode[] = ["BRL", "ARS", "USD", "EUR", "CLP", "UYU", "GBP", "PYG", "MXN", "JPY"];
