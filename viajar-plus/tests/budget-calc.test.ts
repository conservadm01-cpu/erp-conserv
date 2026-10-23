import { describe, expect, it } from "vitest";
import {
  allocate,
  budgetAlerts,
  computeTotals,
  costPerDay,
  costPerTraveler,
  itemFigures,
  paymentBase,
  perTraveler,
  quoteFromUnit,
  settleUp,
  spendingEvolution,
  splitWeights,
  totalsByCategory,
  tripDays,
} from "@/lib/budget/calc";
import type { Expense, Payment, Traveler } from "@/lib/types";

const T = "2026-01-01T00:00:00.000Z";

function exp(p: Partial<Expense> & { id: string }): Expense {
  return {
    trip_id: "t",
    category_key: "outros",
    description: p.id,
    supplier: "",
    quantity: 1,
    unit_price: 0,
    original_currency: "BRL",
    fx_rate: 1,
    fees: 0,
    planned_amount: 0,
    quoted_amount: 0,
    reserved_amount: 0,
    due_date: null,
    responsible_traveler_id: null,
    status: "previsto",
    receipt_document_id: null,
    notes: "",
    split_mode: "todos",
    split: {},
    quote_id: null,
    reservation_id: null,
    diary_entry_id: null,
    incurred_on: null,
    created_at: T,
    updated_at: T,
    ...p,
  };
}

let pid = 0;
function pay(expense_id: string, amount: number, p: Partial<Payment> = {}): Payment {
  return {
    id: `p${++pid}`,
    trip_id: "t",
    expense_id,
    kind: "pagamento",
    amount,
    currency: "BRL",
    fx_rate: 1,
    paid_at: "2026-11-01",
    payer_traveler_id: null,
    method: "pix",
    notes: "",
    receipt_document_id: null,
    created_at: T,
    updated_at: T,
    ...p,
  };
}

const travelers: Traveler[] = ["a", "b", "c"].map((id) => ({
  id,
  trip_id: "t",
  name: id.toUpperCase(),
  kind: "adulto",
  age: null,
  member_id: null,
  responsibilities: "",
  created_at: T,
  updated_at: T,
}));

describe("valores básicos", () => {
  it("calcula o valor cotado com quantidade, taxas e câmbio", () => {
    // 5 ingressos de ARS 45.000 + ARS 10.000 de taxa, câmbio 0,0055
    expect(quoteFromUnit(5, 45000, 10000, 0.0055)).toBe(1292.5);
  });

  it("evita erros de ponto flutuante", () => {
    const e = [exp({ id: "1", planned_amount: 0.1 }), exp({ id: "2", planned_amount: 0.2 })];
    expect(computeTotals(e, [], 0).planned).toBe(0.3);
  });

  it("converte pagamentos e trata estorno como negativo", () => {
    expect(paymentBase({ amount: 100, fx_rate: 5.5, kind: "pagamento" })).toBe(550);
    expect(paymentBase({ amount: 100, fx_rate: 5.5, kind: "estorno" })).toBe(-550);
  });
});

describe("item: reserva, pagamento e saldo sem dupla contagem", () => {
  it("reserva gera saldo a pagar, não realizado", () => {
    const f = itemFigures(exp({ id: "h", planned_amount: 6000, quoted_amount: 5800, reserved_amount: 5500 }), []);
    expect(f.paid).toBe(0);
    expect(f.pending).toBe(5500);
    expect(f.uncommitted).toBe(0);
    expect(f.projected).toBe(5500);
    expect(f.status).toBe("reservado");
  });

  it("pagamento parcial reduz o saldo e soma no realizado uma única vez", () => {
    const e = exp({ id: "h", planned_amount: 6000, reserved_amount: 5500 });
    const f = itemFigures(e, [pay("h", 2000)]);
    expect(f.paid).toBe(2000);
    expect(f.pending).toBe(3500);
    expect(f.projected).toBe(5500);
    expect(f.status).toBe("parcial");
  });

  it("quitação total zera saldo e marca como pago", () => {
    const f = itemFigures(exp({ id: "h", reserved_amount: 5500 }), [pay("h", 2000), pay("h", 3500)]);
    expect(f.pending).toBe(0);
    expect(f.status).toBe("pago");
  });

  it("estorno reabre o saldo da reserva", () => {
    const f = itemFigures(exp({ id: "h", reserved_amount: 1000 }), [pay("h", 1000), pay("h", 300, { kind: "estorno" })]);
    expect(f.paid).toBe(700);
    expect(f.pending).toBe(300);
  });

  it("item sem reserva usa a cotação como estimativa restante", () => {
    const f = itemFigures(exp({ id: "x", planned_amount: 500, quoted_amount: 450 }), [pay("x", 100)]);
    expect(f.expected).toBe(450);
    expect(f.uncommitted).toBe(350);
    expect(f.pending).toBe(0);
    expect(f.projected).toBe(450);
  });

  it("item marcado como pago encerra a estimativa (economia realizada)", () => {
    const f = itemFigures(exp({ id: "x", planned_amount: 500, status: "pago" }), [pay("x", 380)]);
    expect(f.projected).toBe(380);
    expect(f.uncommitted).toBe(0);
  });

  it("item cancelado conta só o valor não estornado", () => {
    const f = itemFigures(exp({ id: "c", planned_amount: 900, reserved_amount: 900, status: "cancelado" }), [pay("c", 900), pay("c", 600, { kind: "estorno" })]);
    expect(f.planned).toBe(0);
    expect(f.reserved).toBe(0);
    expect(f.paid).toBe(300);
    expect(f.pending).toBe(0);
    expect(f.projected).toBe(300);
  });

  it("sinaliza pagamento acima do reservado", () => {
    expect(itemFigures(exp({ id: "o", reserved_amount: 100 }), [pay("o", 150)]).overpaid).toBe(true);
  });

  it("pagamentos em moeda estrangeira usam o câmbio do pagamento", () => {
    const f = itemFigures(exp({ id: "ars", reserved_amount: 1100 }), [pay("ars", 100000, { currency: "ARS", fx_rate: 0.0055 })]);
    expect(f.paid).toBe(550);
    expect(f.pending).toBe(550);
  });
});

describe("totais do orçamento", () => {
  const expenses = [
    exp({ id: "voo", category_key: "passagens", planned_amount: 10000, reserved_amount: 9800 }),
    exp({ id: "hotel", category_key: "hospedagem", planned_amount: 6000, quoted_amount: 6200 }),
    exp({ id: "comida", category_key: "alimentacao", planned_amount: 3000 }),
  ];
  const payments = [pay("voo", 4900, { paid_at: "2026-10-01" }), pay("voo", 4900, { paid_at: "2026-11-01" }), pay("comida", 500, { paid_at: "2026-12-11" })];
  const t = computeTotals(expenses, payments, 20000);

  it("aplica as fórmulas pedidas", () => {
    expect(t.planned).toBe(19000);
    expect(t.realized).toBe(10300);
    expect(t.pending).toBe(0); // voo quitado
    expect(t.uncommitted).toBe(6200 + 2500);
    expect(t.projected).toBe(10300 + 0 + 8700); // realizado + compromissos + estimativas
    expect(t.difference).toBe(10300 - 19000);
    expect(t.economy).toBe(19000 - 10300);
    expect(t.consumedPct).toBeCloseTo(51.5);
    expect(t.availableProjected).toBe(20000 - 19000);
  });

  it("agrupa por categoria", () => {
    const cats = totalsByCategory(expenses, payments);
    expect(cats.find((c) => c.category === "passagens")?.realized).toBe(9800);
    expect(cats.reduce((s, c) => s + c.projected, 0)).toBe(t.projected);
  });

  it("gera alertas de 70/90/100% e de projeção", () => {
    expect(budgetAlerts({ ...t, consumedPct: 72, projectedPct: 95 }).map((a) => [a.kind, a.threshold])).toEqual([
      ["realizado", 70],
      ["projecao", 90],
    ]);
    expect(budgetAlerts({ ...t, consumedPct: 101, projectedPct: 101 })).toHaveLength(1);
    expect(budgetAlerts({ ...t, consumedPct: 50, projectedPct: 50 }, [40])[0].threshold).toBe(40);
    expect(budgetAlerts({ ...t, budget: 0 })).toEqual([]);
  });

  it("evolução acumulada por data", () => {
    const ev = spendingEvolution(payments);
    expect(ev.map((e) => e.cumulative)).toEqual([4900, 9800, 10300]);
  });
});

describe("rateio", () => {
  it("divide sem perder centavos", () => {
    const parts = allocate(100, new Map([["a", 1], ["b", 1], ["c", 1]]));
    const values = [...parts.values()];
    expect(values.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 10);
    expect(values.sort()).toEqual([33.33, 33.33, 33.34]);
  });

  it("respeita modos de rateio", () => {
    expect([...splitWeights({ split_mode: "todos", split: {} }, travelers).keys()]).toEqual(["a", "b", "c"]);
    expect([...splitWeights({ split_mode: "selecionados", split: { a: 1, c: 1 } }, travelers).keys()]).toEqual(["a", "c"]);
    expect(splitWeights({ split_mode: "individual", split: { b: 1 } }, travelers).get("b")).toBe(1);
    // sem participantes válidos, volta a dividir entre todos
    expect(splitWeights({ split_mode: "selecionados", split: { zz: 1 } }, travelers).size).toBe(3);
  });

  it("custo por viajante com rateio personalizado e acerto de contas", () => {
    const e = [
      exp({ id: "carro", planned_amount: 900, reserved_amount: 900, split_mode: "personalizado", split: { a: 2, b: 1 } }),
      exp({ id: "jantar", planned_amount: 300, reserved_amount: 300 }),
    ];
    const p = [pay("carro", 900, { payer_traveler_id: "a" }), pay("jantar", 300, { payer_traveler_id: "c" })];
    const shares = perTraveler(e, p, travelers, "realizado");
    expect(shares.map((s) => s.share)).toEqual([700, 400, 100]);
    expect(shares.reduce((s, x) => s + x.share, 0)).toBe(1200);
    const transfers = settleUp(shares);
    // A pagou 900 e deve 700 → recebe 200; B deve 400; C pagou 300 e deve 100 → recebe 200
    expect(transfers).toEqual([
      { from: "b", to: "a", amount: 200 },
      { from: "b", to: "c", amount: 200 },
    ]);
  });

  it("custo por pessoa e por dia", () => {
    expect(costPerTraveler(1000, 3)).toBe(333.33);
    expect(costPerTraveler(1000, 0)).toBe(0);
    expect(tripDays("2026-12-10", "2026-12-15")).toBe(6);
    expect(tripDays("2026-12-10", "2026-12-15", 5)).toBe(5);
    expect(costPerDay(6000, 6)).toBe(1000);
  });
});
