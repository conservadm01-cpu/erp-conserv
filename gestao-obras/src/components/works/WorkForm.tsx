"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";
import { EXECUTION_MODE, PRIORITY } from "./labels";

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export type WorkFormValues = {
  unitId: string; title: string; typeCode: string; activities: string[]; priority: string; executionMode: string;
  scope: string; justification: string; street: string; number: string; district: string; city: string; state: string; postalCode: string;
  plannedStart: string; plannedEnd: string; responsibleName: string;
};

type Props = {
  mode: "create" | "edit";
  workId?: string;
  version?: number;
  scopeEditable: boolean;
  initial: WorkFormValues;
  units: { id: string; name: string; depth: number }[];
  types: { code: string; name: string }[];
  activities: { code: string; name: string }[];
};

export function WorkForm({ mode, workId, version, scopeEditable, initial, units, types, activities }: Props) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  const set = (k: keyof WorkFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const toggleActivity = (code: string) =>
    setV({ ...v, activities: v.activities.includes(code) ? v.activities.filter((a) => a !== code) : [...v.activities, code] });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const { unitId, title, typeCode, activities: acts, executionMode, scope, justification, ...rest } = v;
    const scopeFields = { title, typeCode, activities: acts, executionMode, scope, justification };
    const res = await run(() =>
      mode === "create"
        ? api<{ work: { id: string } }>("/api/works", { body: { unitId, ...scopeFields, ...rest } })
        : api<{ work: { id: string } }>(`/api/works/${workId}`, { method: "PATCH", body: { version, ...(scopeEditable ? scopeFields : {}), ...rest } }),
    );
    if (!res) return;
    if (mode === "create") router.push(`/obras/${res.work.id}`);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Alterações salvas.</Alert>}
      {!scopeEditable && mode === "edit" && <Alert tone="info">Título, tipo, atividades, escopo e justificativa ficam bloqueados depois do envio para aprovação.</Alert>}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Identificação</legend>
        {mode === "create" && (
          <SelectField label="Unidade" required value={v.unitId} onChange={set("unitId")} error={fieldErrors.unitId} className="sm:col-span-2">
            <option value="">Selecione…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
          </SelectField>
        )}
        <TextField label="Título" required value={v.title} onChange={set("title")} error={fieldErrors.title} disabled={!scopeEditable} maxLength={200} className="sm:col-span-2" />
        <SelectField label="Tipo de obra" required value={v.typeCode} onChange={set("typeCode")} error={fieldErrors.typeCode} disabled={!scopeEditable}>
          <option value="">Selecione…</option>
          {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </SelectField>
        <SelectField label="Prioridade" value={v.priority} onChange={set("priority")}>
          {Object.entries(PRIORITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField label="Forma de execução" value={v.executionMode} onChange={set("executionMode")} disabled={!scopeEditable} hint="Usada para avaliar a aplicabilidade de requisitos. Não define, por si, obrigações legais.">
          {Object.entries(EXECUTION_MODE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <TextField label="Responsável" value={v.responsibleName} onChange={set("responsibleName")} maxLength={200} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Atividades previstas</legend>
        <p className="mb-2 text-xs text-slate-500">Indique as atividades para que o sistema relacione os requisitos documentais que podem ser aplicáveis.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {activities.map((a) => (
            <CheckboxField key={a.code} label={a.name} checked={v.activities.includes(a.code)} onChange={() => toggleActivity(a.code)} disabled={!scopeEditable} />
          ))}
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Escopo e justificativa</legend>
        <TextAreaField label="Escopo" required rows={4} value={v.scope} onChange={set("scope")} error={fieldErrors.scope} disabled={!scopeEditable} maxLength={4000} />
        <TextAreaField label="Justificativa" required rows={3} value={v.justification} onChange={set("justification")} error={fieldErrors.justification} disabled={!scopeEditable} maxLength={4000} />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Local e prazos</legend>
        <TextField className="sm:col-span-4" label="Logradouro" value={v.street} onChange={set("street")} maxLength={200} />
        <TextField className="sm:col-span-2" label="Número" value={v.number} onChange={set("number")} maxLength={20} />
        <TextField className="sm:col-span-2" label="Bairro" value={v.district} onChange={set("district")} maxLength={120} />
        <TextField className="sm:col-span-2" label="Cidade" value={v.city} onChange={set("city")} maxLength={120} />
        <SelectField className="sm:col-span-1" label="UF" value={v.state} onChange={set("state")}>
          <option value="">—</option>
          {UF.map((u) => <option key={u} value={u}>{u}</option>)}
        </SelectField>
        <TextField className="sm:col-span-1" label="CEP" value={v.postalCode} onChange={set("postalCode")} error={fieldErrors.postalCode} maxLength={9} inputMode="numeric" />
        <TextField className="sm:col-span-3" label="Início previsto" type="date" value={v.plannedStart} onChange={set("plannedStart")} error={fieldErrors.plannedStart} />
        <TextField className="sm:col-span-3" label="Término previsto" type="date" value={v.plannedEnd} onChange={set("plannedEnd")} error={fieldErrors.plannedEnd} />
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{mode === "create" ? "Cadastrar obra" : "Salvar alterações"}</Button>
        {mode === "create" && <Button variant="secondary" onClick={() => router.back()} disabled={pending}>Cancelar</Button>}
      </div>
    </form>
  );
}
