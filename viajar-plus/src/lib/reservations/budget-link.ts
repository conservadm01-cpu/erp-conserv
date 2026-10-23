import { getRepo } from "@/lib/data";
import { round2 } from "@/lib/budget/calc";
import type { Expense, NewRow, QuoteType, Reservation, Trip } from "@/lib/types";

// Liga reservas ao orçamento. Regra central: reserva é COMPROMISSO, não pagamento.
// Aqui só se altera reserved_amount da despesa; pagamentos são registrados no orçamento.

export const RESERVATION_CATEGORY: Record<QuoteType, string> = {
  voo: "passagens",
  hospedagem: "hospedagem",
  carro: "carro",
  passeio: "passeios",
  outro: "outros",
};

/** Valor reservado na moeda base; reservas canceladas não geram compromisso. */
export function reservedBaseAmount(r: Pick<Reservation, "amount" | "status">, fxRate: number): number {
  if (r.status === "cancelada") return 0;
  return round2((Number(r.amount) || 0) * (Number(fxRate) || 0));
}

export interface LinkResult {
  expense: Expense;
  created: boolean;
}

/** Cria ou atualiza a despesa ligada à reserva, com reserved_amount convertido. Nunca cria pagamento. */
export async function syncReservationExpense(trip: Pick<Trip, "id" | "currency">, reservation: Reservation, fxRate: number): Promise<LinkResult> {
  const repo = getRepo();
  const fx = reservation.currency === trip.currency ? 1 : fxRate;
  if (!(fx > 0)) throw new Error("Informe a taxa de câmbio para converter a reserva para a moeda da viagem.");
  const reserved = reservedBaseAmount(reservation, fx);
  const existing = reservation.expense_id ? await repo.get("expenses", reservation.expense_id) : null;

  if (existing) {
    const patch: Partial<Expense> = {
      reserved_amount: reserved,
      reservation_id: reservation.id,
      supplier: existing.supplier || reservation.provider_name,
      fx_rate: existing.original_currency === reservation.currency ? fx : existing.fx_rate,
    };
    // Cancelamento não apaga o histórico de pagamentos; só remove o compromisso.
    if (reservation.status === "cancelada" && existing.status !== "cancelado") patch.status = existing.status === "pago" ? "previsto" : existing.status;
    const expense = await repo.update("expenses", existing.id, patch);
    return { expense, created: false };
  }

  const row: NewRow<"expenses"> = {
    trip_id: trip.id,
    category_key: RESERVATION_CATEGORY[reservation.type] ?? "outros",
    description: reservation.title,
    supplier: reservation.provider_name,
    quantity: 1,
    unit_price: reservation.amount,
    original_currency: reservation.currency,
    fx_rate: fx,
    fees: 0,
    planned_amount: 0,
    quoted_amount: 0,
    reserved_amount: reserved,
    due_date: null,
    responsible_traveler_id: null,
    status: "previsto",
    receipt_document_id: null,
    notes: reservation.confirmation_code ? `Reserva ${reservation.confirmation_code}` : "",
    split_mode: "todos",
    split: {},
    quote_id: null,
    reservation_id: reservation.id,
    diary_entry_id: null,
    incurred_on: null,
  };
  const expense = await repo.insert("expenses", row);
  await repo.update("reservations", reservation.id, { expense_id: expense.id });
  return { expense, created: true };
}

/** Remove o vínculo: a despesa permanece (com seus pagamentos), mas sem compromisso reservado. */
export async function unlinkReservationExpense(reservation: Reservation): Promise<void> {
  const repo = getRepo();
  if (reservation.expense_id) {
    const exp = await repo.get("expenses", reservation.expense_id);
    if (exp) await repo.update("expenses", exp.id, { reserved_amount: 0, reservation_id: null });
  }
  await repo.update("reservations", reservation.id, { expense_id: null });
}

/** Itens do roteiro marcados como reservados voltam a "planejado" se a reserva deixar de estar confirmada. */
export async function syncItineraryForReservation(reservation: Pick<Reservation, "id" | "status" | "trip_id">): Promise<number> {
  if (reservation.status === "confirmada") return 0;
  const repo = getRepo();
  const items = await repo.list("itinerary_items", { trip_id: reservation.trip_id, reservation_id: reservation.id });
  let n = 0;
  for (const it of items) {
    if (it.booking_status === "reservado") {
      await repo.update("itinerary_items", it.id, { booking_status: "planejado" });
      n++;
    }
  }
  return n;
}
