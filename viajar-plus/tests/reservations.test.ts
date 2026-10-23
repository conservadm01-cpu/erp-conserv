import { beforeEach, describe, expect, it } from "vitest";
import { LocalFileStore, LocalRepo, resetLocalDb } from "@/lib/data/local";
import { __setDataBackends, getRepo } from "@/lib/data";
import { syncReservationExpense } from "@/lib/reservations/budget-link";
import { computeTotals } from "@/lib/budget/calc";
import type { NewRow, Trip } from "@/lib/types";

const trip = { id: "trip-1", currency: "BRL" } as Pick<Trip, "id" | "currency">;

function reservation(p: Partial<NewRow<"reservations">> = {}): NewRow<"reservations"> {
  return {
    trip_id: trip.id, type: "hospedagem", title: "Apartamento centro", provider_name: "Anfitrião", confirmation_code: "HM123",
    start_at: "2026-12-10T14:00:00Z", end_at: "2026-12-15T10:00:00Z", cancellation_policy: "Grátis até 7 dias antes",
    cancel_deadline: null, amount: 1500, currency: "USD", status: "confirmada", url: "", expense_id: null, notes: "", ...p,
  };
}

describe("reservas ↔ orçamento", () => {
  beforeEach(async () => {
    await resetLocalDb();
    __setDataBackends(new LocalRepo(), new LocalFileStore());
  });

  it("cria despesa com valor reservado convertido, sem registrar pagamento", async () => {
    const repo = getRepo();
    const r = await repo.insert("reservations", reservation());
    const { expense, created } = await syncReservationExpense(trip, r, 5.5);
    expect(created).toBe(true);
    expect(expense.reserved_amount).toBe(8250);
    expect(expense.category_key).toBe("hospedagem");
    expect((await repo.get("reservations", r.id))?.expense_id).toBe(expense.id);
    expect(await repo.list("payments", { trip_id: trip.id })).toHaveLength(0);

    const t = computeTotals(await repo.list("expenses", { trip_id: trip.id }), [], 20000);
    expect(t.realized).toBe(0);
    expect(t.reserved).toBe(8250);
    expect(t.pending).toBe(8250);
    expect(t.projected).toBe(8250);
  });

  it("atualiza a mesma despesa e zera o compromisso ao cancelar, mantendo pagamentos", async () => {
    const repo = getRepo();
    let r = await repo.insert("reservations", reservation({ currency: "BRL", amount: 3000 }));
    const { expense } = await syncReservationExpense(trip, r, 999); // mesma moeda: câmbio ignorado
    expect(expense.reserved_amount).toBe(3000);
    await repo.insert("payments", { trip_id: trip.id, expense_id: expense.id, kind: "pagamento", amount: 1000, currency: "BRL", fx_rate: 1, paid_at: "2026-11-01", payer_traveler_id: null, method: "pix", notes: "", receipt_document_id: null });

    r = (await repo.get("reservations", r.id))!;
    r = await repo.update("reservations", r.id, { status: "cancelada" });
    const again = await syncReservationExpense(trip, r, 1);
    expect(again.created).toBe(false);
    expect(again.expense.id).toBe(expense.id);
    expect(again.expense.reserved_amount).toBe(0);
    expect(await repo.list("expenses", { trip_id: trip.id })).toHaveLength(1);

    const t = computeTotals(await repo.list("expenses", { trip_id: trip.id }), await repo.list("payments", { trip_id: trip.id }), 10000);
    expect(t.realized).toBe(1000);
    expect(t.pending).toBe(0);
  });

  it("exige câmbio válido para moeda estrangeira", async () => {
    const r = await getRepo().insert("reservations", reservation());
    await expect(syncReservationExpense(trip, r, 0)).rejects.toThrow(/câmbio/);
  });
});
