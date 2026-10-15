"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Policy = { kind: string; name: string; stepsRequired: number; requireSegregation: boolean };

function PolicyCard({ p, canManage }: { p: Policy; canManage: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ stepsRequired: String(p.stepsRequired), requireSegregation: p.requireSegregation });
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const res = await run(() => api(`/api/approval-policies/${p.kind}`, { method: "PATCH", body: { stepsRequired: Number(v.stepsRequired), requireSegregation: v.requireSegregation } }));
    if (res) { setSaved(true); router.refresh(); }
  }
  return (
    <form onSubmit={save} className="card space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{p.name}</h2>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Fluxo atualizado. Vale para as próximas aprovações abertas.</Alert>}
      <TextField label="Decisões favoráveis necessárias" type="number" min={1} max={5} value={v.stepsRequired} onChange={(e) => setV({ ...v, stepsRequired: e.target.value })} error={fieldErrors.stepsRequired} disabled={!canManage} hint="Cada decisão deve vir de um aprovador diferente." />
      <CheckboxField label="Exigir segregação de funções (solicitante e quem cadastrou a obra não decidem)" checked={v.requireSegregation} onChange={(e) => setV({ ...v, requireSegregation: e.target.checked })} disabled={!canManage} />
      {canManage && <Button type="submit" loading={pending}>Salvar</Button>}
    </form>
  );
}

export function PolicyEditor({ policies, canManage }: { policies: Policy[]; canManage: boolean }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{policies.map((p) => <PolicyCard key={p.kind} p={p} canManage={canManage} />)}</div>;
}
