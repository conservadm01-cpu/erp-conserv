"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { TextAreaField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Line = { lineKey: string; description: string; unit: string; quantity: number; unitPrice: number; measured: number };

/** Medição: informa a quantidade executada no período para cada item do orçamento aprovado. */
export function MeasurementForm({ workId, lines }: { workId: string; lines: Line[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState({ periodStart: today, periodEnd: today, notes: "" });
  const [qty, setQty] = useState<Record<string, string>>({});
  const { pending, error, fieldErrors, run } = useSubmit();
  const total = lines.reduce((s, l) => s + (Number(qty[l.lineKey] || 0) * l.unitPrice), 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const items = lines.filter((l) => Number(qty[l.lineKey] || 0) > 0).map((l) => ({ lineKey: l.lineKey, quantity: Number(qty[l.lineKey]) }));
    const res = await run(() => api(`/api/works/${workId}/measurements`, { body: { ...period, items } }));
    if (res) { setQty({}); router.refresh(); }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Início do período" type="date" required value={period.periodStart} onChange={(e) => setPeriod({ ...period, periodStart: e.target.value })} />
        <TextField label="Fim do período" type="date" required value={period.periodEnd} onChange={(e) => setPeriod({ ...period, periodEnd: e.target.value })} error={fieldErrors.periodEnd} />
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Item</th><th className="text-right">Orçado</th><th className="text-right">Já medido</th><th className="text-right">Medir agora</th><th className="text-right">Valor</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => {
              const q = Number(qty[l.lineKey] || 0);
              const over = l.measured + q > l.quantity;
              return (
                <tr key={l.lineKey}>
                  <td>{l.description}</td>
                  <td className="text-right tabular-nums">{l.quantity} {l.unit}</td>
                  <td className="text-right tabular-nums">{l.measured} {l.unit}</td>
                  <td className="text-right">
                    <label className="sr-only" htmlFor={`q-${l.lineKey}`}>Quantidade de {l.description}</label>
                    <input id={`q-${l.lineKey}`} type="number" min={0} step="any" className={`input w-28 text-right ${over ? "border-amber-500" : ""}`} value={qty[l.lineKey] ?? ""} onChange={(e) => setQty({ ...qty, [l.lineKey]: e.target.value })} />
                    {over && <span className="block text-xs text-amber-800">acima do orçado</span>}
                  </td>
                  <td className="text-right tabular-nums">{(q * l.unitPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TextAreaField label="Observações" rows={2} value={period.notes} onChange={(e) => setPeriod({ ...period, notes: e.target.value })} maxLength={2000} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Total desta medição: <strong className="tabular-nums">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span>
        <Button type="submit" loading={pending} disabled={total <= 0}>Salvar medição (rascunho)</Button>
      </div>
    </form>
  );
}
