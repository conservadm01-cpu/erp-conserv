"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDay, toInputDate } from "@/lib/format";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { useSubmit } from "../ui/useForm";
import { STAGE_STATUS } from "./labels";

type Stage = {
  id: string; name: string; sortOrder: number; status: string; progress: number; responsibleName: string | null; notes: string | null;
  plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null;
};

const empty = { name: "", sortOrder: "0", status: "NAO_INICIADA", progress: "0", responsibleName: "", plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "" };

export function StagesPanel({ workId, stages, canEdit }: { workId: string; stages: Stage[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [v, setV] = useState(empty);
  const { pending, error, fieldErrors, run } = useSubmit();
  const today = new Date().toISOString().slice(0, 10);

  function open(stage?: Stage) {
    setEditing(stage?.id ?? "new");
    setV(stage ? {
      name: stage.name, sortOrder: String(stage.sortOrder), status: stage.status, progress: String(stage.progress), responsibleName: stage.responsibleName ?? "",
      plannedStart: toInputDate(stage.plannedStart), plannedEnd: toInputDate(stage.plannedEnd), actualStart: toInputDate(stage.actualStart), actualEnd: toInputDate(stage.actualEnd),
    } : { ...empty, sortOrder: String((stages.at(-1)?.sortOrder ?? 0) + 10) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, sortOrder: Number(v.sortOrder), progress: Number(v.progress) };
    const res = await run(() => editing === "new" ? api(`/api/works/${workId}/stages`, { body }) : api(`/api/works/${workId}/stages/${editing}`, { method: "PATCH", body }));
    if (res) { setEditing(null); router.refresh(); }
  }

  const form = (
    <form onSubmit={save} className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-6" noValidate>
      {error && <div className="sm:col-span-6"><Alert tone="error">{error}</Alert></div>}
      <TextField className="sm:col-span-3" label="Etapa" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={fieldErrors.name} maxLength={200} />
      <TextField className="sm:col-span-1" label="Ordem" type="number" min={0} value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value })} />
      <SelectField className="sm:col-span-2" label="Situação" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
        {Object.entries(STAGE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <TextField className="sm:col-span-3" label="Início previsto" type="date" value={v.plannedStart} onChange={(e) => setV({ ...v, plannedStart: e.target.value })} />
      <TextField className="sm:col-span-3" label="Término previsto" type="date" value={v.plannedEnd} onChange={(e) => setV({ ...v, plannedEnd: e.target.value })} error={fieldErrors.plannedEnd} />
      <TextField className="sm:col-span-2" label="Início real" type="date" value={v.actualStart} onChange={(e) => setV({ ...v, actualStart: e.target.value })} />
      <TextField className="sm:col-span-2" label="Término real" type="date" value={v.actualEnd} onChange={(e) => setV({ ...v, actualEnd: e.target.value })} />
      <TextField className="sm:col-span-2" label="Avanço (%)" type="number" min={0} max={100} value={v.progress} onChange={(e) => setV({ ...v, progress: e.target.value })} error={fieldErrors.progress} />
      <TextField className="sm:col-span-6" label="Responsável" value={v.responsibleName} onChange={(e) => setV({ ...v, responsibleName: e.target.value })} maxLength={200} />
      <div className="flex gap-2 sm:col-span-6">
        <Button type="submit" loading={pending}>Salvar etapa</Button>
        <Button variant="secondary" onClick={() => setEditing(null)} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {canEdit && editing === null && <Button onClick={() => open()}>Nova etapa</Button>}
      {editing === "new" && form}
      {stages.length === 0 && editing !== "new" ? (
        <EmptyState title="Nenhuma etapa cadastrada" description="Divida a obra em etapas para acompanhar prazos e avanço." />
      ) : (
        <ul className="space-y-2">
          {stages.map((s) => {
            const late = s.plannedEnd && s.plannedEnd.slice(0, 10) < today && ["NAO_INICIADA", "EM_ANDAMENTO"].includes(s.status);
            return editing === s.id ? (
              <li key={s.id}>{form}</li>
            ) : (
              <li key={s.id} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{s.name} {late && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">atrasada</span>}</p>
                  <p className="text-xs text-slate-500">
                    {STAGE_STATUS[s.status]} · previsto {formatDay(s.plannedStart)} a {formatDay(s.plannedEnd)} · real {formatDay(s.actualStart)} a {formatDay(s.actualEnd)}
                    {s.responsibleName ? ` · ${s.responsibleName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32" aria-label={`Avanço ${s.progress}%`}>
                    <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${s.progress}%` }} /></div>
                    <p className="mt-0.5 text-right text-xs tabular-nums text-slate-600">{s.progress}%</p>
                  </div>
                  {canEdit && editing === null && <Button variant="ghost" onClick={() => open(s)}>Editar</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
