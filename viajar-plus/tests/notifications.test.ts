import { describe, expect, it } from "vitest";
import { generateAlerts } from "@/lib/notifications/generate";
import type { Expense, ItineraryDay, ItineraryItem, Payment, Reservation } from "@/lib/types";

const ts = { created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
const res = (p: Partial<Reservation>): Reservation => ({
  id: "r1", trip_id: "t", type: "hospedagem", title: "Apartamento", provider_name: "Anfitrião", confirmation_code: "X1",
  start_at: null, end_at: null, cancellation_policy: "", cancel_deadline: null, amount: 1000, currency: "BRL",
  status: "confirmada", url: "", expense_id: null, notes: "", ...ts, ...p,
});
const exp = (p: Partial<Expense>): Expense => ({
  id: "e1", trip_id: "t", category_key: "hospedagem", description: "Apartamento", supplier: "", quantity: 1, unit_price: 0,
  original_currency: "BRL", fx_rate: 1, fees: 0, planned_amount: 0, quoted_amount: 0, reserved_amount: 1000, due_date: "2026-12-05",
  responsible_traveler_id: null, status: "previsto", receipt_document_id: null, notes: "", split_mode: "todos", split: {},
  quote_id: null, reservation_id: null, diary_entry_id: null, incurred_on: null, ...ts, ...p,
});

describe("alertas", () => {
  const now = new Date("2026-12-01T12:00:00Z");

  it("gera check-in, check-out e prazo de cancelamento dentro da antecedência, em ordem", () => {
    const r = res({ start_at: "2026-12-03T14:00:00Z", end_at: "2026-12-08T10:00:00Z", cancel_deadline: "2026-12-02T23:59:00Z" });
    const a = generateAlerts({ reservations: [r] }, { now });
    expect(a.map((x) => x.kind)).toEqual(["cancelamento", "checkin"]); // check-out está a 7 dias (> 24h)
    const later = generateAlerts({ reservations: [r] }, { now: new Date("2026-12-07T12:00:00Z") });
    expect(later.some((x) => x.kind === "checkout")).toBe(true);
  });

  it("ignora reservas canceladas", () => {
    expect(generateAlerts({ reservations: [res({ status: "cancelada", start_at: "2026-12-02T10:00:00Z" })] }, { now })).toHaveLength(0);
  });

  it("alerta vencimento apenas com saldo pendente", () => {
    const e = exp({});
    expect(generateAlerts({ expenses: [e] }, { now })).toHaveLength(1);
    const pay: Payment = { id: "p", trip_id: "t", expense_id: "e1", kind: "pagamento", amount: 1000, currency: "BRL", fx_rate: 1, paid_at: "2026-11-30", payer_traveler_id: null, method: "pix", notes: "", receipt_document_id: null, ...ts };
    expect(generateAlerts({ expenses: [e], payments: [pay] }, { now })).toHaveLength(0);
  });

  it("marca itens vencidos e respeita antecedência configurável", () => {
    const day: ItineraryDay = { id: "d", trip_id: "t", date: "2026-12-01", title: "Dia 1", notes: "", ...ts };
    const it = { id: "i", trip_id: "t", day_id: "d", title: "Glaciar", kind: "passeio", start_time: "08:00", duration_min: 60, address: "", lat: null, lng: null, cost_estimate: 0, currency: "BRL", travel_min_from_prev: null, opening_hours: "", notes: "", booking_status: "planejado", reservation_id: null, activity_id: null, position: 0, ...ts } as ItineraryItem;
    const a = generateAlerts({ days: [day], items: [it] }, { now: new Date(2026, 11, 1, 9, 0) });
    expect(a[0].overdue).toBe(true);
    expect(generateAlerts({ days: [day], items: [it] }, { now: new Date(2026, 10, 29, 9, 0), leadHours: { horario: 1 } })).toHaveLength(0);
  });
});
