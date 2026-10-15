"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Row = { upToAmount: string; stepsRequired: string };

/** Faixas por valor: cada faixa define quantas decisões favoráveis são necessárias. */
function TierCard({ kind, name, initial, canManage }: { kind: string; name: string; initial: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, run } = useSubmit();
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const tiers = rows.map((r) => ({ upToAmount: r.upToAmount.trim() === "" ? null : Number(r.upToAmount.replace(",", ".")), stepsRequired: Number(r.stepsRequired) }));
    if (await run(() => api(`/api/approval-tiers/${kind}`, { method: "PUT", body: { tiers } }))) { setSaved(true); router.refresh(); }
  }
  return (
    <form onSubmit={save} className="card space-y-3 p-5" noValidate>
      <h3 className="font-semibold">{name}</h3>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Faixas salvas. Valem para as próximas solicitações.</Alert>}
      {rows.length === 0 && <p className="text-sm text-slate-500">Sem faixas: vale a quantidade de decisões do fluxo.</p>}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <TextField label={`Faixa ${i + 1}: até (R$)`} inputMode="decimal" value={r.upToAmount} onChange={(e) => set(i, { upToAmount: e.target.value })} disabled={!canManage} hint="Vazio = acima do maior limite" />
          <TextField label="Decisões necessárias" type="number" min={1} max={5} value={r.stepsRequired} onChange={(e) => set(i, { stepsRequired: e.target.value })} disabled={!canManage} />
          {canManage && <Button type="button" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remover faixa {i + 1}</Button>}
        </div>
      ))}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setRows([...rows, { upToAmount: "", stepsRequired: "1" }])} disabled={rows.length >= 10}>Adicionar faixa</Button>
          <Button type="submit" loading={pending}>Salvar faixas</Button>
        </div>
      )}
    </form>
  );
}

export function TierEditor({ kinds, tiers, canManage }: { kinds: { kind: string; name: string }[]; tiers: { kind: string; upToAmount: string | null; stepsRequired: number }[]; canManage: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {kinds.map((k) => (
        <TierCard key={k.kind} kind={k.kind} name={k.name} canManage={canManage} initial={tiers.filter((t) => t.kind === k.kind).map((t) => ({ upToAmount: t.upToAmount ?? "", stepsRequired: String(t.stepsRequired) }))} />
      ))}
    </div>
  );
}
