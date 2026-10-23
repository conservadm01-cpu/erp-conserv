"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { reservationSchema } from "@/lib/schemas";
import { sensitiveDataError } from "@/lib/reservations/sensitive";
import { fetchFxRate } from "@/lib/fx-client";
import { CURRENCIES, money } from "@/lib/format";
import type { Reservation, Trip } from "@/lib/types";

type In = z.input<typeof reservationSchema>;
type Out = z.output<typeof reservationSchema>;

export const TYPE_LABEL: Record<Reservation["type"], string> = { voo: "Voo", hospedagem: "Hospedagem", carro: "Carro", passeio: "Passeio", outro: "Outro" };
export const STATUS_LABEL: Record<Reservation["status"], string> = { pendente: "Pendente", confirmada: "Confirmada", cancelada: "Cancelada", concluida: "Concluída" };

/** ISO -> valor de <input type="datetime-local"> no fuso local. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localInputToIso(v: string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export interface ReservationSubmit {
  values: Omit<Reservation, "id" | "created_at" | "updated_at" | "trip_id" | "expense_id">;
  linkBudget: boolean;
  fxRate: number;
}

export function ReservationForm({
  trip,
  initial,
  onSubmit,
  onCancel,
}: {
  trip: Trip;
  initial?: Reservation | null;
  onSubmit: (s: ReservationSubmit) => Promise<void>;
  onCancel: () => void;
}) {
  const { register, handleSubmit, formState, watch, setError } = useForm<In, unknown, Out>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      type: initial?.type ?? "hospedagem",
      title: initial?.title ?? "",
      provider_name: initial?.provider_name ?? "",
      confirmation_code: initial?.confirmation_code ?? "",
      start_at: isoToLocalInput(initial?.start_at ?? null),
      end_at: isoToLocalInput(initial?.end_at ?? null),
      cancellation_policy: initial?.cancellation_policy ?? "",
      cancel_deadline: isoToLocalInput(initial?.cancel_deadline ?? null),
      amount: initial?.amount ?? 0,
      currency: initial?.currency ?? trip.currency,
      status: initial?.status ?? "pendente",
      url: initial?.url ?? "",
      notes: initial?.notes ?? "",
    },
  });
  const e = formState.errors;
  const currency = watch("currency") as string;
  const amount = Number(watch("amount")) || 0;
  const type = watch("type");
  const [linkBudget, setLinkBudget] = useState(initial ? Boolean(initial.expense_id) || initial.amount > 0 : true);
  const [fx, setFx] = useState<string>(currency === trip.currency ? "1" : "");
  const [fxInfo, setFxInfo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (currency === trip.currency) {
      setFx("1");
      setFxInfo(null);
      return;
    }
    let alive = true;
    setFxInfo("Consultando câmbio…");
    fetchFxRate(currency, trip.currency)
      .then((r) => {
        if (!alive) return;
        setFx(String(Number(r.rate.toFixed(6))));
        setFxInfo(`Câmbio sugerido por ${r.source || "provedor de câmbio"} em ${new Date(r.fetched_at).toLocaleString("pt-BR")}. Ajuste para a taxa real da sua compra.`);
      })
      .catch(() => alive && setFxInfo("Câmbio automático indisponível. Informe a taxa manualmente."));
    return () => {
      alive = false;
    };
  }, [currency, trip.currency]);

  const fxNum = Number(fx.replace(",", "."));
  const converted = fxNum > 0 ? amount * fxNum : null;

  const submit = handleSubmit(async (v) => {
    setFormError(null);
    const sensitive = sensitiveDataError(v.notes, v.confirmation_code, v.cancellation_policy, v.title, v.provider_name);
    if (sensitive) {
      setError("notes", { message: sensitive });
      setFormError(sensitive);
      return;
    }
    if (v.start_at && v.end_at && new Date(v.end_at) < new Date(v.start_at)) {
      setError("end_at", { message: "O fim deve ser depois do início" });
      return;
    }
    if (linkBudget && v.amount > 0 && !(fxNum > 0)) {
      setFormError("Informe a taxa de câmbio para vincular ao orçamento.");
      return;
    }
    await onSubmit({
      values: {
        ...v,
        start_at: localInputToIso(v.start_at),
        end_at: localInputToIso(v.end_at),
        cancel_deadline: localInputToIso(v.cancel_deadline),
      },
      linkBudget: linkBudget && (v.amount > 0 || Boolean(initial?.expense_id)),
      fxRate: fxNum,
    });
  });

  const startLabel = type === "hospedagem" ? "Check-in" : type === "carro" ? "Retirada" : type === "voo" ? "Partida" : "Início";
  const endLabel = type === "hospedagem" ? "Check-out" : type === "carro" ? "Devolução" : type === "voo" ? "Chegada/volta" : "Fim";

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Notice tone="warn" className="sm:col-span-2">
        <ShieldAlert className="mr-1 inline h-4 w-4" aria-hidden />
        Nunca guarde número completo de cartão, CVV ou senhas de fornecedores. Registre apenas o código de confirmação.
      </Notice>
      <Field label="Tipo">
        {(p) => (
          <Select {...p} {...register("type")}>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Status" hint="Use “confirmada” somente após confirmação do fornecedor">
        {(p) => (
          <Select {...p} {...register("status")}>
            {Object.entries(STATUS_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Título" error={e.title?.message} className="sm:col-span-2">
        {(p) => <Input {...p} {...register("title")} placeholder="Ex.: Apartamento 3 quartos — centro" />}
      </Field>
      <Field label="Fornecedor" error={e.provider_name?.message}>
        {(p) => <Input {...p} {...register("provider_name")} />}
      </Field>
      <Field label="Número de confirmação" error={e.confirmation_code?.message}>
        {(p) => <Input {...p} {...register("confirmation_code")} autoComplete="off" />}
      </Field>
      <Field label={startLabel} error={e.start_at?.message}>
        {(p) => <Input {...p} type="datetime-local" {...register("start_at")} />}
      </Field>
      <Field label={endLabel} error={e.end_at?.message}>
        {(p) => <Input {...p} type="datetime-local" {...register("end_at")} />}
      </Field>
      <Field label="Política de cancelamento" error={e.cancellation_policy?.message} className="sm:col-span-2">
        {(p) => <Textarea {...p} rows={2} {...register("cancellation_policy")} />}
      </Field>
      <Field label="Prazo para cancelar sem custo" error={e.cancel_deadline?.message}>
        {(p) => <Input {...p} type="datetime-local" {...register("cancel_deadline")} />}
      </Field>
      <Field label="Link da reserva" error={e.url?.message}>
        {(p) => <Input {...p} type="url" {...register("url")} placeholder="https://" />}
      </Field>
      <Field label="Valor total da reserva" error={e.amount?.message}>
        {(p) => <Input {...p} type="number" min={0} step="0.01" inputMode="decimal" {...register("amount")} />}
      </Field>
      <Field label="Moeda" error={e.currency?.message}>
        {(p) => (
          <Select {...p} {...register("currency")}>
            {[...new Set([trip.currency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        )}
      </Field>
      <div className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-3 sm:col-span-2">
        <Checkbox label="Vincular ao orçamento como valor reservado (não conta como pago)" checked={linkBudget} onChange={(ev) => setLinkBudget(ev.target.checked)} />
        {linkBudget && currency !== trip.currency && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={`Câmbio: 1 ${currency} = ? ${trip.currency}`} hint={fxInfo ?? undefined}>
              {(p) => <Input {...p} inputMode="decimal" value={fx} onChange={(ev) => setFx(ev.target.value)} />}
            </Field>
          </div>
        )}
        {linkBudget && converted != null && (
          <p className="text-xs text-muted">
            Entrará no orçamento como compromisso de {money(converted, trip.currency)}. Registre os pagamentos no Orçamento conforme forem feitos.
          </p>
        )}
      </div>
      <Field label="Observações" error={e.notes?.message} className="sm:col-span-2">
        {(p) => <Textarea {...p} rows={3} {...register("notes")} />}
      </Field>
      {formError && <Notice tone="error" className="sm:col-span-2">{formError}</Notice>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={formState.isSubmitting}>Salvar reserva</Button>
      </div>
    </form>
  );
}
