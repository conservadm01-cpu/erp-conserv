import type { ItineraryDay, ItineraryItem, Reservation, TripPace } from "@/lib/types";

// Análise pura do roteiro: conflitos de horário, deslocamentos improváveis,
// horário de funcionamento, dias cheios e sugestões de alternativas.

export type IssueKind = "sobreposicao" | "deslocamento" | "funcionamento" | "dia_cheio" | "reserva";

export interface ItineraryIssue {
  kind: IssueKind;
  severity: "aviso" | "erro";
  day_id: string;
  item_ids: string[];
  message: string;
  suggestion?: string;
}

export const PACE_HOURS: Record<TripPace, number> = { tranquilo: 6, moderado: 9, intenso: 12 };
export const HARD_DAY_LIMIT_HOURS = 10;

export function parseTime(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Interpreta "HH:MM-HH:MM" (aceita "–" e espaços). Retorna null se ausente/inválido. */
export function parseOpeningHours(s: string | null | undefined): { open: number; close: number } | null {
  if (!s) return null;
  const m = /^\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*$/.exec(s);
  if (!m) return null;
  const open = parseTime(m[1]);
  let close = parseTime(m[2]);
  if (open == null || close == null) return null;
  if (close <= open) close += 1440; // fecha após meia-noite
  return { open, close };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimativa grosseira de deslocamento: ~40 km/h urbano (até 15 km), ~80 km/h estrada; fator 1,3 para sinuosidade. */
export function estimateTravelMin(a: Pick<ItineraryItem, "lat" | "lng">, b: Pick<ItineraryItem, "lat" | "lng">): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const km = haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) * 1.3;
  const speed = km <= 15 ? 40 : 80;
  return Math.round((km / speed) * 60);
}

export function sortItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const ta = parseTime(a.start_time);
    const tb = parseTime(b.start_time);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    return a.position - b.position;
  });
}

export function dayLoadMin(items: ItineraryItem[]): number {
  return items.filter((i) => i.kind !== "descanso" && i.kind !== "hospedagem").reduce((s, i) => s + (i.duration_min || 0) + (i.travel_min_from_prev || 0), 0);
}

export interface AnalyzeOptions {
  pace?: TripPace;
  reservations?: Pick<Reservation, "id" | "status">[];
}

export function canMarkReserved(item: Pick<ItineraryItem, "reservation_id">, reservations: Pick<Reservation, "id" | "status">[]): boolean {
  if (!item.reservation_id) return false;
  return reservations.some((r) => r.id === item.reservation_id && r.status === "confirmada");
}

export function analyzeDay(day: ItineraryDay, items: ItineraryItem[], allDays: { day: ItineraryDay; items: ItineraryItem[] }[] = [], opts: AnalyzeOptions = {}): ItineraryIssue[] {
  const issues: ItineraryIssue[] = [];
  const sorted = sortItems(items);
  const timed = sorted.filter((i) => parseTime(i.start_time) != null);

  for (let k = 0; k < timed.length - 1; k++) {
    const a = timed[k];
    const b = timed[k + 1];
    const aStart = parseTime(a.start_time)!;
    const aEnd = aStart + (a.duration_min || 0);
    const bStart = parseTime(b.start_time)!;
    if (bStart < aEnd) {
      issues.push({
        kind: "sobreposicao",
        severity: "erro",
        day_id: day.id,
        item_ids: [a.id, b.id],
        message: `"${a.title}" termina às ${formatTime(aEnd)}, mas "${b.title}" começa às ${formatTime(bStart)}.`,
        suggestion: `Começar "${b.title}" às ${formatTime(aEnd + (b.travel_min_from_prev ?? estimateTravelMin(a, b) ?? 0))} ou encurtar "${a.title}".`,
      });
      continue;
    }
    const need = b.travel_min_from_prev ?? estimateTravelMin(a, b);
    const gap = bStart - aEnd;
    if (need != null && need > gap) {
      issues.push({
        kind: "deslocamento",
        severity: "aviso",
        day_id: day.id,
        item_ids: [a.id, b.id],
        message: `Deslocamento improvável: há ${gap} min entre "${a.title}" e "${b.title}", mas o trajeto leva cerca de ${need} min.`,
        suggestion: `Iniciar "${b.title}" às ${formatTime(aEnd + need)}.`,
      });
    }
  }

  for (const it of timed) {
    const oh = parseOpeningHours(it.opening_hours);
    if (!oh) continue;
    const s = parseTime(it.start_time)!;
    const e = s + (it.duration_min || 0);
    if (s < oh.open || e > oh.close) {
      issues.push({
        kind: "funcionamento",
        severity: "aviso",
        day_id: day.id,
        item_ids: [it.id],
        message: `"${it.title}" (${formatTime(s)}–${formatTime(e)}) fica fora do horário de funcionamento informado (${it.opening_hours}).`,
        suggestion: s < oh.open ? `Começar às ${formatTime(oh.open)}.` : `Terminar até ${formatTime(oh.close)}.`,
      });
    }
  }

  const load = dayLoadMin(items);
  const effective = (opts.pace ? PACE_HOURS[opts.pace] : HARD_DAY_LIMIT_HOURS) * 60;
  if (load > effective) {
    const others = allDays.filter((d) => d.day.id !== day.id).map((d) => ({ d, load: dayLoadMin(d.items) })).sort((x, y) => x.load - y.load);
    const lighter = others[0];
    const movable = [...sorted].filter((i) => i.booking_status !== "reservado" && i.kind === "passeio").sort((a, b) => b.duration_min - a.duration_min)[0];
    let suggestion = "Encurte atividades ou retire algum passeio deste dia.";
    if (lighter && movable && lighter.load + movable.duration_min <= effective) {
      suggestion = `Mover "${movable.title}" para ${lighter.d.day.title || lighter.d.day.date} (dia mais leve, ${Math.round(lighter.load / 60)}h planejadas).`;
    }
    issues.push({
      kind: "dia_cheio",
      severity: "aviso",
      day_id: day.id,
      item_ids: sorted.map((i) => i.id),
      message: `Dia muito cheio: ${Math.round((load / 60) * 10) / 10}h de atividades e deslocamentos (referência${opts.pace ? ` para ritmo ${opts.pace}` : ""}: ${effective / 60}h).`,
      suggestion,
    });
  }

  if (opts.reservations) {
    for (const it of items) {
      if (it.booking_status === "reservado" && !canMarkReserved(it, opts.reservations)) {
        issues.push({
          kind: "reserva",
          severity: "erro",
          day_id: day.id,
          item_ids: [it.id],
          message: `"${it.title}" está marcado como reservado sem uma reserva confirmada vinculada.`,
          suggestion: "Vincule uma reserva confirmada ou volte o status para planejado.",
        });
      }
    }
  }
  return issues;
}

export function analyzeItinerary(days: ItineraryDay[], items: ItineraryItem[], opts: AnalyzeOptions = {}): ItineraryIssue[] {
  const grouped = days.map((day) => ({ day, items: items.filter((i) => i.day_id === day.id) }));
  return grouped.flatMap((g) => analyzeDay(g.day, g.items, grouped, opts));
}

/** Encaixa horários em sequência a partir do primeiro horário (ou startAt), respeitando duração e deslocamento. */
export function fitTimes(items: ItineraryItem[], startAt = "09:00"): { id: string; start_time: string; travel_min_from_prev: number | null }[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  let cursor = parseTime(sorted.find((i) => parseTime(i.start_time) != null)?.start_time) ?? parseTime(startAt) ?? 540;
  const out: { id: string; start_time: string; travel_min_from_prev: number | null }[] = [];
  sorted.forEach((it, idx) => {
    let travel = it.travel_min_from_prev;
    if (idx > 0) {
      if (travel == null) travel = estimateTravelMin(sorted[idx - 1], it);
      cursor += travel ?? 0;
      const oh = parseOpeningHours(it.opening_hours);
      if (oh && cursor < oh.open) cursor = oh.open;
    }
    out.push({ id: it.id, start_time: formatTime(cursor), travel_min_from_prev: travel ?? null });
    cursor += it.duration_min || 0;
  });
  return out;
}
