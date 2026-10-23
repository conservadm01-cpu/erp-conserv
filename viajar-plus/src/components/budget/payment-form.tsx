"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Trash2 } from "lucide-react";
import { paymentSchema, type PaymentInput } from "@/lib/schemas";
import { paymentBase, type ItemFigures } from "@/lib/budget/calc";
import { fetchFxRate } from "@/lib/fx-client";
import { getRepo } from "@/lib/data";
import { CURRENCIES, fmtDate, money, toISODate } from "@/lib/format";
import type { Expense, Payment, Traveler, Trip } from "@/lib/types";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type FormIn = z.input<typeof paymentSchema>;

const METHOD: Record<Payment["method"], string> = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", transferencia: "Transferência", boleto: "Boleto", outro: "Outro" };

/** Registro de pagamentos parciais e estornos de um item. Nunca guarda dados de cartão. */
export function PaymentDialog({
  trip,
  expense,
  figures,
  payments,
  travelers,
  open,
  onOpenChange,
}: {
  trip: Trip;
  expense: Expense;
  figures: ItemFigures | undefined;
  payments: Payment[];
  travelers: Traveler[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const toast = useToast();
  const mine = payments.filter((p) => p.expense_id === expense.id).sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  const suggested = figures ? (figures.pending || figures.uncommitted) : 0;
  const defaults: PaymentInput = {
    kind: "pagamento",
    amount: suggested > 0 ? Number((suggested / (expense.original_currency === trip.currency ? 1 : expense.fx_rate || 1)).toFixed(2)) : 0,
    currency: expense.original_currency || trip.currency,
    fx_rate: expense.original_currency === trip.currency ? 1 : expense.fx_rate || 1,
    paid_at: toISODate(new Date()),
    payer_traveler_id: expense.responsible_traveler_id,
    method: "pix",
    notes: "",
  };
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, PaymentInput>({ resolver: zodResolver(paymentSchema), defaultValues: defaults, values: open ? defaults : undefined });
  const [amount, fx, kind, cur] = useWatch({ control, name: ["amount", "fx_rate", "kind", "currency"] });
  const base = paymentBase({ amount: Number(amount) || 0, fx_rate: Number(fx) || 0, kind: (kind as Payment["kind"]) ?? "pagamento" });
  const willOverpay = figures && figures.reserved > 0 && kind === "pagamento" && figures.paid + base > figures.reserved + 0.005;

  async function onSubmit(v: PaymentInput) {
    try {
      await getRepo().insert("payments", { ...v, trip_id: trip.id, expense_id: expense.id, receipt_document_id: null });
      toast(v.kind === "estorno" ? "Estorno registrado" : "Pagamento registrado");
      reset(defaults);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`Pagamentos — ${expense.description}`} size="lg">
      {figures && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-surface-2 p-2">Reservado<br /><strong>{money(figures.reserved, trip.currency)}</strong></div>
          <div className="rounded-lg bg-surface-2 p-2">Pago<br /><strong>{money(figures.paid, trip.currency)}</strong></div>
          <div className="rounded-lg bg-surface-2 p-2">Saldo a pagar<br /><strong>{money(figures.pending, trip.currency)}</strong></div>
          <div className="rounded-lg bg-surface-2 p-2">Estimativa restante<br /><strong>{money(figures.uncommitted, trip.currency)}</strong></div>
        </div>
      )}

      {mine.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line text-sm">
          {mine.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 p-2">
              <Badge tone={p.kind === "estorno" ? "red" : "green"}>{p.kind === "estorno" ? "Estorno" : "Pagamento"}</Badge>
              <span>{fmtDate(p.paid_at)}</span>
              <span className="font-medium">{money(p.amount, p.currency)}</span>
              {p.currency !== trip.currency && <span className="text-muted">= {money(Math.abs(paymentBase(p)), trip.currency)}</span>}
              <span className="text-muted">{METHOD[p.method]}{p.payer_traveler_id ? ` · ${travelers.find((t) => t.id === p.payer_traveler_id)?.name ?? ""}` : ""}</span>
              <Button variant="ghost" size="icon" className="ml-auto" aria-label="Excluir lançamento" onClick={() => confirm("Excluir este lançamento?") && getRepo().remove("payments", p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo">
            {(p) => (
              <Select {...p} {...register("kind")}>
                <option value="pagamento">Pagamento</option>
                <option value="estorno">Estorno/reembolso</option>
              </Select>
            )}
          </Field>
          <Field label="Valor" error={errors.amount?.message as string}>{(p) => <Input type="number" step="0.01" {...p} {...register("amount")} />}</Field>
          <Field label="Moeda">
            {(p) => (
              <Select
                {...p}
                {...register("currency", {
                  onChange: async (e) => {
                    const c = e.target.value as string;
                    if (c === trip.currency) return setValue("fx_rate", 1);
                    try {
                      setValue("fx_rate", Number((await fetchFxRate(c, trip.currency)).rate.toFixed(6)));
                    } catch {
                      toast("Câmbio indisponível — informe manualmente", "info");
                    }
                  },
                })}
              >
                {[...new Set([trip.currency, expense.original_currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field label={`Câmbio ${cur} → ${trip.currency}`} error={errors.fx_rate?.message as string} hint="Use a taxa efetivamente cobrada (ex.: da fatura).">
            {(p) => <Input type="number" step="any" {...p} {...register("fx_rate")} />}
          </Field>
          <Field label="Data" error={errors.paid_at?.message as string}>{(p) => <Input type="date" {...p} {...register("paid_at")} />}</Field>
          <Field label="Quem pagou">
            {(p) => (
              <Select {...p} {...register("payer_traveler_id")}>
                <option value="">—</option>
                {travelers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Forma">
            {(p) => (
              <Select {...p} {...register("method")}>
                {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Observações" className="sm:col-span-2" hint="Não informe número de cartão, CVV ou senhas.">{(p) => <Input {...p} {...register("notes")} />}</Field>
        </div>
        <p className="text-sm text-muted">Na moeda base: <strong className="text-fg">{money(base, trip.currency)}</strong></p>
        {willOverpay && <Notice tone="warn">Este pagamento ultrapassa o valor reservado. Confira se não é um lançamento duplicado.</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button type="submit" loading={isSubmitting}>Registrar</Button>
        </div>
      </form>
    </Modal>
  );
}
