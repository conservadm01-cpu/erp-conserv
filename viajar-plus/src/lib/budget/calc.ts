import type { Budget, Expense, ExpenseStatus, ID, ISODate, Payment, Traveler } from "@/lib/types";

// Todos os cálculos acontecem em centavos inteiros para evitar erros de ponto
// flutuante, e os resultados voltam em unidades da moeda base da viagem.

export const toCents = (v: number): number => Math.round((Number(v) || 0) * 100);
export const fromCents = (c: number): number => c / 100;
export const round2 = (v: number): number => fromCents(toCents(v));

/** Valor cotado na moeda base: (quantidade × valor unitário + taxas) × câmbio. */
export function quoteFromUnit(quantity: number, unitPrice: number, fees: number, fxRate: number): number {
  return round2(((Number(quantity) || 0) * (Number(unitPrice) || 0) + (Number(fees) || 0)) * (Number(fxRate) || 0));
}

/** Valor de um pagamento na moeda base; estornos são negativos. */
export function paymentBase(p: Pick<Payment, "amount" | "fx_rate" | "kind">): number {
  const v = round2(Math.abs(Number(p.amount) || 0) * (Number(p.fx_rate) || 0));
  return p.kind === "estorno" ? -v : v;
}

export interface ItemFigures {
  id: ID;
  planned: number; // previsto
  quoted: number; // cotado
  reserved: number; // compromisso reservado (não é dinheiro pago)
  paid: number; // realizado líquido (pagamentos − estornos)
  expected: number; // melhor estimativa do custo do item
  pending: number; // saldo a pagar de compromissos reservados
  uncommitted: number; // estimativa restante de itens sem reserva
  projected: number; // realizado + pendente + estimativa restante
  status: ExpenseStatus; // status derivado
  overpaid: boolean; // pago acima do valor reservado
  negativePaid: boolean; // estornos maiores que pagamentos
}

/**
 * Números de um item. Regras contra dupla contagem:
 * - reserva é compromisso, não pagamento: só gera saldo a pagar;
 * - o saldo a pagar desconta o que já foi pago;
 * - a estimativa restante só existe para itens ainda não reservados;
 * - item cancelado conta apenas o que foi efetivamente pago e não estornado;
 * - item marcado como "pago" (quitado) encerra qualquer saldo/estimativa restante.
 */
export function itemFigures(e: Expense, payments: Payment[]): ItemFigures {
  const paidC = payments.filter((p) => p.expense_id === e.id).reduce((s, p) => s + toCents(paymentBase(p)), 0);
  const cancelled = e.status === "cancelado";
  const settled = e.status === "pago";
  const plannedC = cancelled ? 0 : toCents(e.planned_amount);
  const quotedC = cancelled ? 0 : toCents(e.quoted_amount);
  const reservedC = cancelled ? 0 : toCents(e.reserved_amount);
  const committed = reservedC > 0;
  const expectedC = cancelled ? 0 : committed ? reservedC : quotedC > 0 ? quotedC : plannedC;

  let pendingC = 0;
  let uncommittedC = 0;
  if (!cancelled && !settled) {
    if (committed) pendingC = Math.max(0, reservedC - paidC);
    else uncommittedC = Math.max(0, expectedC - paidC);
  }

  let status: ExpenseStatus;
  if (cancelled) status = "cancelado";
  else if (settled || (paidC > 0 && paidC >= expectedC)) status = "pago";
  else if (paidC > 0) status = "parcial";
  else if (committed) status = "reservado";
  else if (quotedC > 0) status = "cotado";
  else status = "previsto";

  return {
    id: e.id,
    planned: fromCents(plannedC),
    quoted: fromCents(quotedC),
    reserved: fromCents(reservedC),
    paid: fromCents(paidC),
    expected: fromCents(expectedC),
    pending: fromCents(pendingC),
    uncommitted: fromCents(uncommittedC),
    projected: fromCents(paidC + pendingC + uncommittedC),
    status,
    overpaid: committed && paidC > reservedC,
    negativePaid: paidC < 0,
  };
}

export interface Totals {
  planned: number;
  quoted: number;
  reserved: number;
  realized: number;
  pending: number;
  uncommitted: number;
  projected: number;
  difference: number; // realizado − previsto
  economy: number; // previsto − realizado
  budget: number;
  consumedPct: number; // realizado / orçamento
  projectedPct: number; // projeção / orçamento
  availableNow: number; // orçamento − realizado
  availableProjected: number; // orçamento − projeção
  itemCount: number;
}

function sumFigures(figs: ItemFigures[], budgetTotal: number): Totals {
  const s = (k: keyof ItemFigures) => figs.reduce((acc, f) => acc + toCents(f[k] as number), 0);
  const planned = s("planned");
  const realized = s("paid");
  const projected = s("projected");
  const budgetC = toCents(budgetTotal);
  return {
    planned: fromCents(planned),
    quoted: fromCents(s("quoted")),
    reserved: fromCents(s("reserved")),
    realized: fromCents(realized),
    pending: fromCents(s("pending")),
    uncommitted: fromCents(s("uncommitted")),
    projected: fromCents(projected),
    difference: fromCents(realized - planned),
    economy: fromCents(planned - realized),
    budget: fromCents(budgetC),
    consumedPct: budgetC > 0 ? (realized / budgetC) * 100 : 0,
    projectedPct: budgetC > 0 ? (projected / budgetC) * 100 : 0,
    availableNow: fromCents(budgetC - realized),
    availableProjected: fromCents(budgetC - projected),
    itemCount: figs.length,
  };
}

export function computeTotals(expenses: Expense[], payments: Payment[], budgetTotal: number): Totals {
  return sumFigures(expenses.map((e) => itemFigures(e, payments)), budgetTotal);
}

export interface CategoryTotals extends Totals {
  category: string;
}

export function totalsByCategory(expenses: Expense[], payments: Payment[]): CategoryTotals[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) {
    const list = groups.get(e.category_key) ?? [];
    list.push(e);
    groups.set(e.category_key, list);
  }
  return [...groups.entries()].map(([category, list]) => ({ category, ...computeTotals(list, payments, 0) }));
}

// ---------- Rateio ----------

/** Pesos de rateio de um item entre os viajantes, conforme o modo escolhido. */
export function splitWeights(e: Pick<Expense, "split_mode" | "split">, travelers: Traveler[]): Map<ID, number> {
  const ids = new Set(travelers.map((t) => t.id));
  const weights = new Map<ID, number>();
  const declared = Object.entries(e.split ?? {}).filter(([id, w]) => ids.has(id) && Number(w) > 0);
  if (e.split_mode === "individual" && declared.length) {
    weights.set(declared[0][0], 1);
  } else if (e.split_mode === "selecionados" && declared.length) {
    declared.forEach(([id]) => weights.set(id, 1));
  } else if (e.split_mode === "personalizado" && declared.length) {
    declared.forEach(([id, w]) => weights.set(id, Number(w)));
  } else {
    travelers.forEach((t) => weights.set(t.id, 1));
  }
  return weights;
}

/** Divide um valor em centavos proporcionalmente aos pesos, sem perder centavos (maiores restos). */
export function allocate(amount: number, weights: Map<ID, number>): Map<ID, number> {
  const out = new Map<ID, number>();
  const entries = [...weights.entries()];
  const totalW = entries.reduce((s, [, w]) => s + w, 0);
  if (!entries.length || totalW <= 0) return out;
  const totalC = toCents(amount);
  const sign = totalC < 0 ? -1 : 1;
  const abs = Math.abs(totalC);
  const raw = entries.map(([id, w]) => ({ id, exact: (abs * w) / totalW }));
  const floors = raw.map((r) => ({ ...r, c: Math.floor(r.exact) }));
  let rest = abs - floors.reduce((s, r) => s + r.c, 0);
  [...floors]
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
    .forEach((r) => {
      if (rest > 0) {
        r.c += 1;
        rest -= 1;
      }
    });
  floors.forEach((r) => out.set(r.id, fromCents(sign * r.c)));
  return out;
}

export type Basis = "projecao" | "realizado" | "previsto";

function basisValue(f: ItemFigures, basis: Basis): number {
  return basis === "realizado" ? f.paid : basis === "previsto" ? f.planned : f.projected;
}

export interface TravelerShare {
  traveler_id: ID;
  name: string;
  share: number; // quanto cabe a este viajante
  paid: number; // quanto este viajante efetivamente pagou
  balance: number; // pago − parte no realizado (positivo = tem a receber)
}

/** Custo por viajante com rateio personalizado e saldo entre quem pagou e quem deve. */
export function perTraveler(expenses: Expense[], payments: Payment[], travelers: Traveler[], basis: Basis = "projecao"): TravelerShare[] {
  const share = new Map<ID, number>();
  const realizedShare = new Map<ID, number>();
  const paid = new Map<ID, number>();
  travelers.forEach((t) => {
    share.set(t.id, 0);
    realizedShare.set(t.id, 0);
    paid.set(t.id, 0);
  });
  for (const e of expenses) {
    const f = itemFigures(e, payments);
    const w = splitWeights(e, travelers);
    allocate(basisValue(f, basis), w).forEach((v, id) => share.set(id, round2((share.get(id) ?? 0) + v)));
    allocate(f.paid, w).forEach((v, id) => realizedShare.set(id, round2((realizedShare.get(id) ?? 0) + v)));
  }
  for (const p of payments) {
    if (p.payer_traveler_id && paid.has(p.payer_traveler_id)) {
      paid.set(p.payer_traveler_id, round2(paid.get(p.payer_traveler_id)! + paymentBase(p)));
    }
  }
  return travelers.map((t) => ({
    traveler_id: t.id,
    name: t.name,
    share: share.get(t.id) ?? 0,
    paid: paid.get(t.id) ?? 0,
    balance: round2((paid.get(t.id) ?? 0) - (realizedShare.get(t.id) ?? 0)),
  }));
}

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}

/** Sugere transferências mínimas para acertar despesas compartilhadas. */
export function settleUp(shares: TravelerShare[]): Transfer[] {
  const debtors = shares.filter((s) => s.balance < -0.004).map((s) => ({ id: s.traveler_id, c: -toCents(s.balance) }));
  const creditors = shares.filter((s) => s.balance > 0.004).map((s) => ({ id: s.traveler_id, c: toCents(s.balance) }));
  debtors.sort((a, b) => b.c - a.c);
  creditors.sort((a, b) => b.c - a.c);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const v = Math.min(debtors[i].c, creditors[j].c);
    if (v > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount: fromCents(v) });
    debtors[i].c -= v;
    creditors[j].c -= v;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

// ---------- Indicadores derivados ----------

export function costPerTraveler(total: number, travelerCount: number): number {
  return travelerCount > 0 ? round2(total / travelerCount) : 0;
}

/** Dias considerados: definido no orçamento ou dias corridos da viagem (inclusive). */
export function tripDays(start: ISODate, end: ISODate, override?: number | null): number {
  if (override && override > 0) return override;
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10));
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function costPerDay(total: number, days: number): number {
  return days > 0 ? round2(total / days) : 0;
}

export interface BudgetAlert {
  threshold: number;
  level: "info" | "aviso" | "critico";
  kind: "realizado" | "projecao";
  message: string;
}

/** Alertas quando o realizado (ou a projeção) atinge os limites configurados. */
export function budgetAlerts(t: Totals, thresholds: number[] = [70, 90, 100]): BudgetAlert[] {
  if (t.budget <= 0) return [];
  const sorted = [...new Set(thresholds.filter((x) => x > 0))].sort((a, b) => a - b);
  const level = (th: number): BudgetAlert["level"] => (th >= 100 ? "critico" : th >= 90 ? "aviso" : "info");
  const out: BudgetAlert[] = [];
  const hitReal = sorted.filter((th) => t.consumedPct >= th).pop();
  if (hitReal != null) {
    out.push({ threshold: hitReal, level: level(hitReal), kind: "realizado", message: `Gastos pagos atingiram ${hitReal}% do orçamento.` });
  }
  const hitProj = sorted.filter((th) => t.projectedPct >= th).pop();
  if (hitProj != null && hitProj !== hitReal) {
    out.push({ threshold: hitProj, level: level(hitProj), kind: "projecao", message: `A projeção final chega a ${hitProj}% do orçamento.` });
  }
  return out;
}

/** Evolução acumulada do realizado por data de pagamento. */
export function spendingEvolution(payments: Payment[]): { date: ISODate; daily: number; cumulative: number }[] {
  const byDay = new Map<ISODate, number>();
  for (const p of payments) byDay.set(p.paid_at, (byDay.get(p.paid_at) ?? 0) + toCents(paymentBase(p)));
  let acc = 0;
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, c]) => {
      acc += c;
      return { date, daily: fromCents(c), cumulative: fromCents(acc) };
    });
}

export type BudgetSettings = Pick<Budget, "total" | "alert_thresholds" | "days_considered" | "per_traveler_basis">;
