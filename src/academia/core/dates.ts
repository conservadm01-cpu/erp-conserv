import type { ISODate } from "./types";

export const nowIso = (): ISODate => new Date().toISOString();

export function daysAgoIso(days: number): ISODate {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function formatDate(iso?: ISODate): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateLong(iso?: ISODate): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(iso?: ISODate): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function relativeFrom(iso?: ISODate): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 30) return `${d} dias atrás`;
  const m = Math.round(d / 30);
  if (m < 12) return `${m} ${m === 1 ? "mês" : "meses"} atrás`;
  const y = Math.round(m / 12);
  return `${y} ${y === 1 ? "ano" : "anos"} atrás`;
}

export function yearsSince(iso?: ISODate): number {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

/** Chave do dia (America/Sao_Paulo) — usada pelo Desafio do Dia. */
export function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  if (m < 60) return s ? `${m}min ${s}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}
