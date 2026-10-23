import { describe, expect, it } from "vitest";
import { analyzeDay, analyzeItinerary, canMarkReserved, estimateTravelMin, fitTimes, parseOpeningHours, parseTime } from "@/lib/itinerary/conflicts";
import type { ItineraryDay, ItineraryItem } from "@/lib/types";

const ts = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const day = (id: string, date = "2026-12-11"): ItineraryDay => ({ id, trip_id: "t", date, title: `Dia ${id}`, notes: "", ...ts });
let n = 0;
const item = (p: Partial<ItineraryItem>): ItineraryItem => ({
  id: `i${++n}`, trip_id: "t", day_id: "d1", title: `Item ${n}`, kind: "passeio", start_time: null, duration_min: 60, address: "",
  lat: null, lng: null, cost_estimate: 0, currency: "BRL", travel_min_from_prev: null, opening_hours: "", notes: "",
  booking_status: "planejado", reservation_id: null, activity_id: null, position: n, ...ts, ...p,
});

describe("parsers", () => {
  it("lê horários e horário de funcionamento", () => {
    expect(parseTime("09:30")).toBe(570);
    expect(parseTime("25:00")).toBeNull();
    expect(parseOpeningHours("09:00-18:00")).toEqual({ open: 540, close: 1080 });
    expect(parseOpeningHours("20:00–02:00")).toEqual({ open: 1200, close: 1560 });
    expect(parseOpeningHours("sempre")).toBeNull();
  });
});

describe("conflitos do roteiro", () => {
  it("detecta sobreposição de horários", () => {
    const a = item({ start_time: "09:00", duration_min: 120 });
    const b = item({ start_time: "10:00" });
    const issues = analyzeDay(day("d1"), [a, b]);
    expect(issues.find((i) => i.kind === "sobreposicao")?.item_ids).toEqual([a.id, b.id]);
  });

  it("detecta deslocamento improvável pelo tempo informado", () => {
    const a = item({ start_time: "09:00", duration_min: 60 });
    const b = item({ start_time: "10:10", travel_min_from_prev: 45 });
    expect(analyzeDay(day("d1"), [a, b]).some((i) => i.kind === "deslocamento")).toBe(true);
  });

  it("estima deslocamento por distância quando há coordenadas (El Calafate → Perito Moreno ≈ 78 km)", () => {
    const a = item({ start_time: "09:00", duration_min: 30, lat: -50.3379, lng: -72.2648 });
    const b = item({ start_time: "09:45", lat: -50.4967, lng: -73.1377 });
    const est = estimateTravelMin(a, b)!;
    expect(est).toBeGreaterThan(50);
    expect(analyzeDay(day("d1"), [a, b]).some((i) => i.kind === "deslocamento")).toBe(true);
  });

  it("aponta atividade fora do horário de funcionamento", () => {
    const a = item({ start_time: "08:00", duration_min: 120, opening_hours: "09:00-18:00" });
    expect(analyzeDay(day("d1"), [a])[0]).toMatchObject({ kind: "funcionamento" });
  });

  it("aponta dia cheio conforme o ritmo e sugere mover para dia mais leve", () => {
    const d1 = day("d1");
    const d2 = day("d2", "2026-12-12");
    const items = [item({ duration_min: 240, title: "Navegação" }), item({ duration_min: 200 }), item({ day_id: "d2", duration_min: 60 })];
    const issues = analyzeItinerary([d1, d2], items, { pace: "tranquilo" });
    const cheio = issues.find((i) => i.kind === "dia_cheio");
    expect(cheio?.day_id).toBe("d1");
    expect(cheio?.suggestion).toContain("Navegação");
    expect(analyzeItinerary([d1, d2], items, { pace: "intenso" }).some((i) => i.kind === "dia_cheio")).toBe(false);
  });

  it("só permite reservado com reserva confirmada", () => {
    const it = item({ booking_status: "reservado", reservation_id: "r1" });
    expect(canMarkReserved(it, [{ id: "r1", status: "pendente" }])).toBe(false);
    expect(canMarkReserved(it, [{ id: "r1", status: "confirmada" }])).toBe(true);
    const issues = analyzeDay(day("d1"), [it], [], { reservations: [{ id: "r1", status: "pendente" }] });
    expect(issues.some((i) => i.kind === "reserva")).toBe(true);
  });

  it("encaixa horários em sequência respeitando deslocamento e abertura", () => {
    const a = item({ start_time: "08:00", duration_min: 60, position: 0 });
    const b = item({ duration_min: 30, travel_min_from_prev: 20, position: 1 });
    const c = item({ duration_min: 30, opening_hours: "10:00-12:00", position: 2 });
    const r = fitTimes([c, b, a]);
    expect(r.map((x) => x.start_time)).toEqual(["08:00", "09:20", "10:00"]);
  });
});
