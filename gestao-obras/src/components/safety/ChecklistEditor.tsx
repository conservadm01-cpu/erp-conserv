"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { useSubmit } from "../ui/useForm";

type Checklist = { id: string; name: string; workTypes: string[]; active: boolean; items: { text: string; defaultCriticality: string }[] };
type Opt = { code: string; name: string };

export function ChecklistEditor({ checklists, levels, workTypes, canManage }: { checklists: Checklist[]; levels: Opt[]; workTypes: Opt[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [v, setV] = useState<Omit<Checklist, "id">>({ name: "", workTypes: [], active: true, items: [] });
  const { pending, error, fieldErrors, run } = useSubmit();

  function open(c?: Checklist) {
    setEditing(c?.id ?? "new");
    setV(c ? { name: c.name, workTypes: c.workTypes, active: c.active, items: c.items.map((i) => ({ text: i.text, defaultCriticality: i.defaultCriticality })) } : { name: "", workTypes: [], active: true, items: [{ text: "", defaultCriticality: "MEDIA" }] });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...v, items: v.items.filter((i) => i.text.trim()) };
    const res = await run(() => (editing === "new" ? api("/api/safety/checklists", { body }) : api(`/api/safety/checklists/${editing}`, { method: "PUT", body })));
    if (res) { setEditing(null); router.refresh(); }
  }

  const form = (
    <form onSubmit={save} className="card space-y-3 p-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Nome" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={fieldErrors.name} maxLength={200} />
      <fieldset>
        <legend className="label">Tipos de obra (vazio = todos)</legend>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">{workTypes.map((t) => <CheckboxField key={t.code} label={t.name} checked={v.workTypes.includes(t.code)} onChange={() => setV({ ...v, workTypes: v.workTypes.includes(t.code) ? v.workTypes.filter((x) => x !== t.code) : [...v.workTypes, t.code] })} />)}</div>
      </fieldset>
      <CheckboxField label="Ativo" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
      <fieldset className="space-y-2">
        <legend className="label">Itens</legend>
        {v.items.map((i, n) => (
          <div key={n} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
            <TextField className="sm:col-span-4" label={`Item ${n + 1}`} value={i.text} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === n ? { ...x, text: e.target.value } : x)) })} maxLength={500} />
            <SelectField className="sm:col-span-1" label="Criticidade" value={i.defaultCriticality} onChange={(e) => setV({ ...v, items: v.items.map((x, j) => (j === n ? { ...x, defaultCriticality: e.target.value } : x)) })}>
              {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </SelectField>
            <div className="flex items-end"><Button variant="ghost" onClick={() => setV({ ...v, items: v.items.filter((_, j) => j !== n) })}>Remover</Button></div>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setV({ ...v, items: [...v.items, { text: "", defaultCriticality: "MEDIA" }] })}>Adicionar item</Button>
      </fieldset>
      <div className="flex gap-2"><Button type="submit" loading={pending}>Salvar checklist</Button><Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button></div>
    </form>
  );

  return (
    <div className="space-y-3">
      {canManage && editing === null && <Button onClick={() => open()}>Novo checklist</Button>}
      {editing === "new" && form}
      {checklists.map((c) => editing === c.id ? <div key={c.id}>{form}</div> : (
        <div key={c.id} className="card p-4 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{c.name} {!c.active && <Badge>inativo</Badge>}</p>
              <p className="text-xs text-slate-500">{c.items.length} itens · {c.workTypes.length ? c.workTypes.join(", ") : "todos os tipos de obra"}</p>
            </div>
            {canManage && editing === null && <Button variant="secondary" onClick={() => open(c)}>Editar</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}
