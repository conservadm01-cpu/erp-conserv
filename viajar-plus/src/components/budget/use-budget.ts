"use client";
import { useCallback, useMemo } from "react";
import { useRows } from "@/lib/data/hooks";
import { computeTotals, itemFigures, perTraveler, totalsByCategory, tripDays, budgetAlerts, type ItemFigures } from "@/lib/budget/calc";
import { useTrip } from "@/lib/trips/context";
import { useFxRate } from "@/lib/fx-client";
import { money } from "@/lib/format";
import type { Trip } from "@/lib/types";

/** Carrega e calcula tudo que o orçamento precisa. Os totais são sempre derivados dos itens e pagamentos. */
export function useBudget(trip: Trip) {
  const where = { trip_id: trip.id };
  const expenses = useRows("expenses", where);
  const payments = useRows("payments", where);
  const travelers = useRows("travelers", where);
  const categories = useRows("budget_categories", where);
  const budgets = useRows("budgets", where);
  const budget = budgets.data[0] ?? null;
  const budgetTotal = budget?.total ?? trip.budget_total;

  const computed = useMemo(() => {
    const figures = new Map<string, ItemFigures>(expenses.data.map((e) => [e.id, itemFigures(e, payments.data)]));
    const totals = computeTotals(expenses.data, payments.data, budgetTotal);
    const days = tripDays(trip.start_date, trip.end_date, budget?.days_considered);
    return {
      figures,
      totals,
      byCategory: totalsByCategory(expenses.data, payments.data),
      shares: perTraveler(expenses.data, payments.data, travelers.data, budget?.per_traveler_basis ?? "projecao"),
      alerts: budgetAlerts(totals, budget?.alert_thresholds ?? [70, 90, 100]),
      days,
    };
  }, [expenses.data, payments.data, travelers.data, budgetTotal, budget, trip.start_date, trip.end_date]);

  return {
    loading: expenses.loading || payments.loading || budgets.loading,
    error: expenses.error ?? payments.error ?? budgets.error,
    expenses: expenses.data,
    payments: payments.data,
    travelers: travelers.data,
    categories: [...categories.data].sort((a, b) => a.position - b.position),
    budget,
    budgetTotal,
    ...computed,
  };
}

/** Formata valores da moeda base na moeda de exibição escolhida no topo (com câmbio do ExchangeRateProvider). */
export function useMoney(trip: Trip) {
  const { displayCurrency } = useTrip();
  const target = displayCurrency && displayCurrency !== trip.currency ? displayCurrency : null;
  const fx = useFxRate(trip.currency, target);
  const converted = Boolean(target && fx.rate);
  const fmt = useCallback(
    (v: number | null | undefined) => (v == null ? "—" : converted ? money(v * (fx.rate as number), target!) : money(v, trip.currency)),
    [converted, fx.rate, target, trip.currency],
  );
  const note = target
    ? fx.rate
      ? `Valores convertidos de ${trip.currency} para ${target} (1 ${trip.currency} = ${fx.rate.toFixed(4)} ${target}, fonte: ${fx.source}). Conversão apenas para visualização.`
      : fx.error
        ? `Câmbio ${trip.currency}→${target} indisponível (${fx.error}). Exibindo em ${trip.currency}.`
        : "Consultando câmbio…"
    : null;
  return { fmt, note, currency: converted ? target! : trip.currency };
}
