import { describe, expect, it } from "vitest";
import { compareQuotes, quoteFreshness, quoteToExpense, quoteTrends } from "@/lib/quotes/compare";
import type { Quote } from "@/lib/types";

const base: Quote = {
  id: "q1",
  trip_id: "t",
  type: "hospedagem",
  title: "Apto centro",
  provider_name: "Booking",
  source: "manual",
  url: "https://booking.com/x",
  total_price: 1000,
  currency: "USD",
  fx_rate: 5.5,
  travelers_count: 5,
  units: 5,
  captured_at: "2026-10-20T10:00:00Z",
  valid_until: null,
  search_key: "hosp-fte-dez",
  details: {},
  status: "ativa",
  expense_id: null,
  notes: "",
  created_at: "",
  updated_at: "",
};
const q = (over: Partial<Quote>): Quote => ({ ...base, ...over });
const now = new Date("2026-10-22T10:00:00Z");

describe("frescor", () => {
  it("vencida pela validade e antiga por tipo", () => {
    expect(quoteFreshness(q({ valid_until: "2026-10-21T00:00:00Z" }), now).expired).toBe(true);
    expect(quoteFreshness(q({}), now).stale).toBe(false); // 2 dias < 3 (hospedagem)
    expect(quoteFreshness(q({ type: "voo" }), now).stale).toBe(true); // 2 dias > 1 (voo)
  });
});

describe("comparação", () => {
  it("normaliza para moeda base e calcula por pessoa, família e unidade", () => {
    const [g] = compareQuotes([q({}), q({ id: "q2", total_price: 900, provider_name: "Airbnb" })], 5, { now });
    const first = g.rows[0];
    expect(first.quote.id).toBe("q2");
    expect(first.base_total).toBe(4950);
    expect(first.per_person).toBe(990);
    expect(first.per_unit).toBe(990);
    expect(first.per_family).toBe(4950);
    expect(first.is_lowest_registered).toBe(true);
    expect(g.rows[1].diff_from_lowest).toBe(550);
    expect(g.coverage_note).toMatch(/não representa todo o mercado/);
  });

  it("cotação vencida não é marcada como menor", () => {
    const [g] = compareQuotes([q({ total_price: 100, valid_until: "2026-10-01T00:00:00Z" }), q({ id: "q2" })], 5, { now });
    expect(g.rows.find((r) => r.quote.id === "q1")!.is_lowest_registered).toBe(false);
    expect(g.rows.find((r) => r.quote.id === "q2")!.is_lowest_registered).toBe(true);
  });

  it("ignora descartadas", () => {
    expect(compareQuotes([q({ status: "descartada" })], 5)).toEqual([]);
  });
});

describe("tendência", () => {
  it("histórico insuficiente com menos de 3 datas", () => {
    const [t] = quoteTrends([q({}), q({ id: "b", captured_at: "2026-10-20T18:00:00Z" }), q({ id: "c", captured_at: "2026-10-21T10:00:00Z" })]);
    expect(t.sufficient).toBe(false);
    expect(t.message).toMatch(/insuficiente/);
  });

  it("calcula variação com 3 datas e não promete previsão", () => {
    const [t] = quoteTrends([
      q({ captured_at: "2026-10-18T10:00:00Z", total_price: 1000 }),
      q({ id: "b", captured_at: "2026-10-19T10:00:00Z", total_price: 1050 }),
      q({ id: "c", captured_at: "2026-10-20T10:00:00Z", total_price: 1100 }),
    ]);
    expect(t.sufficient).toBe(true);
    expect(t.change_pct).toBe(10);
    expect(t.direction).toBe("subindo");
    expect(t.message).toMatch(/não é previsão/);
  });
});

describe("cotação → orçamento", () => {
  it("entra como cotado, sem reserva nem pagamento", () => {
    const e = quoteToExpense(q({}));
    expect(e).toMatchObject({ category_key: "hospedagem", quoted_amount: 5500, reserved_amount: 0, status: "cotado", quote_id: "q1", original_currency: "USD", fx_rate: 5.5 });
  });
});
