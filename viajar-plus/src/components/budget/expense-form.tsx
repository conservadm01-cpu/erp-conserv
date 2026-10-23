"use client";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { RefreshCw } from "lucide-react";
import { expenseSchema, type ExpenseInput } from "@/lib/schemas";
import { quoteFromUnit } from "@/lib/budget/calc";
import { fetchFxRate } from "@/lib/fx-client";
import { getRepo } from "@/lib/data";
import { CURRENCIES, money } from "@/lib/format";
import type { BudgetCategory, Expense, Traveler, Trip } from "@/lib/types";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

type FormIn = z.input<typeof expenseSchema>;

export function emptyExpense(trip: Trip, category = "outros"): ExpenseInput {
  return {
    category_key: category,
    description: "",
    supplier: "",
    quantity: 1,
    unit_price: 0,
    original_currency: trip.currency,
    fx_rate: 1,
    fees: 0,
    planned_amount: 0,
    quoted_amount: 0,
    reserved_amount: 0,
    due_date: null,
    responsible_traveler_id: null,
    status: "previsto",
    notes: "",
    split_mode: "todos",
    split: {},
  };
}

export function ExpenseForm({
  trip,
  expense,
  categories,
  travelers,
  open,
  onOpenChange,
}: {
  trip: Trip;
  expense: Expense | null;
  categories: BudgetCategory[];
  travelers: Traveler[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const toast = useToast();
  const initial: ExpenseInput = expense
    ? {
        category_key: expense.category_key,
        description: expense.description,
        supplier: expense.supplier,
        quantity: expense.quantity,
        unit_price: expense.unit_price,
        original_currency: expense.original_currency,
        fx_rate: expense.fx_rate,
        fees: expense.fees,
        planned_amount: expense.planned_amount,
        quoted_amount: expense.quoted_amount,
        reserved_amount: expense.reserved_amount,
        due_date: expense.due_date,
        responsible_traveler_id: expense.responsible_traveler_id,
        status: expense.status === "pago" || expense.status === "cancelado" ? expense.status : "previsto",
        notes: expense.notes,
        split_mode: expense.split_mode,
        split: expense.split ?? {},
      }
    : emptyExpense(trip);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, ExpenseInput>({ resolver: zodResolver(expenseSchema), defaultValues: initial, values: open ? initial : undefined });

  const [qty, unit, fees, fx, cur, mode] = useWatch({ control, name: ["quantity", "unit_price", "fees", "fx_rate", "original_currency", "split_mode"] });
  const autoQuote = Number(unit) > 0;
  const computedQuote = quoteFromUnit(Number(qty), Number(unit), Number(fees), Number(fx));
  const [fxInfo, setFxInfo] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);

  async function loadFx() {
    setFxLoading(true);
    try {
      const r = await fetchFxRate(String(cur), trip.currency);
      setValue("fx_rate", Number(r.rate.toFixed(6)));
      setFxInfo(`Fonte: ${r.source} · ${new Date(r.fetched_at).toLocaleString("pt-BR")}`);
    } catch (e) {
      setFxInfo(e instanceof Error ? e.message : "Câmbio indisponível — informe manualmente.");
    } finally {
      setFxLoading(false);
    }
  }

  async function onSubmit(v: ExpenseInput) {
    const row = { ...v, quoted_amount: autoQuote ? computedQuote : v.quoted_amount };
    try {
      if (expense) await getRepo().update("expenses", expense.id, row);
      else
        await getRepo().insert("expenses", {
          ...row,
          trip_id: trip.id,
          receipt_document_id: null,
          quote_id: null,
          reservation_id: null,
          diary_entry_id: null,
          incurred_on: null,
        });
      toast(expense ? "Item atualizado" : "Item adicionado ao orçamento");
      onOpenChange(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  const err = (k: keyof ExpenseInput) => errors[k]?.message as string | undefined;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={expense ? "Editar item do orçamento" : "Novo item do orçamento"} description="Previsto, cotado, reservado e pago são campos separados. Uma reserva é um compromisso — o dinheiro só conta como realizado quando você registra um pagamento." size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Descrição" error={err("description")} className="md:col-span-2">
            {(p) => <Input {...p} {...register("description")} />}
          </Field>
          <Field label="Categoria" error={err("category_key")}>
            {(p) => (
              <Select {...p} {...register("category_key")}>
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Fornecedor">{(p) => <Input {...p} {...register("supplier")} />}</Field>
        </div>

        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Cotação (moeda original)</legend>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
            <Field label="Quantidade" error={err("quantity")}>{(p) => <Input type="number" step="any" {...p} {...register("quantity")} />}</Field>
            <Field label="Valor unitário" error={err("unit_price")}>{(p) => <Input type="number" step="0.01" {...p} {...register("unit_price")} />}</Field>
            <Field label="Moeda original">
              {(p) => (
                <Select {...p} {...register("original_currency")}>
                  {[...new Set([trip.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
                </Select>
              )}
            </Field>
            <Field label={`Câmbio → ${trip.currency}`} error={err("fx_rate")} hint={fxInfo ?? undefined}>
              {(p) => (
                <div className="flex gap-1">
                  <Input type="number" step="any" {...p} {...register("fx_rate")} />
                  <Button variant="outline" size="icon" onClick={loadFx} loading={fxLoading} aria-label="Buscar câmbio atual" disabled={cur === trip.currency}>
                    {!fxLoading && <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </Field>
            <Field label="Taxas adicionais" error={err("fees")}>{(p) => <Input type="number" step="0.01" {...p} {...register("fees")} />}</Field>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Valor previsto (${trip.currency})`} error={err("planned_amount")} hint="Sua estimativa de orçamento.">
            {(p) => <Input type="number" step="0.01" {...p} {...register("planned_amount")} />}
          </Field>
          <Field label={`Valor cotado (${trip.currency})`} error={err("quoted_amount")} hint={autoQuote ? "Calculado: (qtd × unitário + taxas) × câmbio." : "Preço encontrado em pesquisa."}>
            {(p) => (autoQuote ? <Input {...p} readOnly value={money(computedQuote, trip.currency)} /> : <Input type="number" step="0.01" {...p} {...register("quoted_amount")} />)}
          </Field>
          <Field label={`Valor reservado (${trip.currency})`} error={err("reserved_amount")} hint="Compromisso confirmado com o fornecedor. Não é pagamento.">
            {(p) => <Input type="number" step="0.01" {...p} {...register("reserved_amount")} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Vencimento" error={err("due_date")}>{(p) => <Input type="date" {...p} {...register("due_date")} />}</Field>
          <Field label="Responsável">
            {(p) => (
              <Select {...p} {...register("responsible_traveler_id")}>
                <option value="">—</option>
                {travelers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Situação" hint="O status (cotado, reservado, parcial, pago) é calculado. Marque “quitado” para encerrar a estimativa restante.">
            {(p) => (
              <Select {...p} {...register("status")}>
                <option value="previsto">Em aberto (automático)</option>
                <option value="pago">Quitado</option>
                <option value="cancelado">Cancelado</option>
              </Select>
            )}
          </Field>
        </div>

        <fieldset className="rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-semibold">Rateio entre viajantes</legend>
          <Select aria-label="Modo de rateio" className="mb-3 sm:w-72" {...register("split_mode")}>
            <option value="todos">Dividir igualmente entre todos</option>
            <option value="selecionados">Dividir entre selecionados</option>
            <option value="personalizado">Pesos personalizados</option>
            <option value="individual">Despesa de uma pessoa</option>
          </Select>
          {mode !== "todos" && (
            <Controller
              control={control}
              name="split"
              render={({ field }) => {
                const split = (field.value as Record<string, number>) ?? {};
                return (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {travelers.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        {mode === "personalizado" ? (
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="w-24"
                            aria-label={`Peso de ${t.name}`}
                            value={split[t.id] ?? 0}
                            onChange={(e) => field.onChange({ ...split, [t.id]: Number(e.target.value) })}
                          />
                        ) : (
                          <input
                            type={mode === "individual" ? "radio" : "checkbox"}
                            name="split-person"
                            className="h-4 w-4"
                            checked={Number(split[t.id]) > 0}
                            onChange={(e) =>
                              field.onChange(mode === "individual" ? { [t.id]: 1 } : { ...split, [t.id]: e.target.checked ? 1 : 0 })
                            }
                          />
                        )}
                        {t.name}
                      </label>
                    ))}
                  </div>
                );
              }}
            />
          )}
          {errors.split && <p role="alert" className="mt-2 text-xs text-red-600">{errors.split.message as string}</p>}
        </fieldset>

        <Field label="Observações">{(p) => <Textarea {...p} {...register("notes")} />}</Field>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" loading={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}
