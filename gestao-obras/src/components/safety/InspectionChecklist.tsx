"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextAreaField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";
import { INSPECTION_RESULT } from "../phase3/labels";

type Item = { id: string; text: string; result: string; criticality: string; observation: string | null; documentIds: string[] };

export function InspectionChecklist({ inspectionId, items, levels, photos, canEdit }: { inspectionId: string; items: Item[]; levels: { code: string; name: string }[]; photos: { id: string; title: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(items.map((i) => ({ ...i, observation: i.observation ?? "" })));
  const [extra, setExtra] = useState({ text: "", criticality: "MEDIA" });
  const [summary, setSummary] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const complete = useSubmit();
  const set = (id: string, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function persist(extraItems: { text: string; criticality: string }[] = []) {
    return save.run(() => api(`/api/safety/inspections/${inspectionId}`, { method: "PUT", body: { items: rows.map(({ id, result, criticality, observation, documentIds }) => ({ id, result, criticality, observation: observation || null, documentIds })), extraItems } }));
  }

  async function onSave() {
    if (await persist()) { setNotice("Registro salvo."); router.refresh(); }
  }
  async function addItem() {
    if (!extra.text.trim()) return;
    if (await persist([extra])) { setExtra({ text: "", criticality: "MEDIA" }); router.refresh(); }
  }
  async function onComplete() {
    if (!(await persist())) return;
    const res = await complete.run(() => api<{ actionsCreated: number }>(`/api/safety/inspections/${inspectionId}/complete`, { body: { summary } }));
    if (res) { setNotice(`Inspeção concluída. ${res.actionsCreated} ação(ões) corretiva(s) criada(s) para as não conformidades.`); router.refresh(); }
  }

  const nc = rows.filter((r) => r.result === "NAO_CONFORME").length;
  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {(save.error || complete.error) && <Alert tone="error">{save.error ?? complete.error}</Alert>}
      <ol className="space-y-3">
        {rows.map((r, n) => (
          <li key={r.id} className={`card p-4 ${r.result === "NAO_CONFORME" ? "border-red-300" : ""}`}>
            <p className="mb-2 font-medium"><span className="mr-2 tabular-nums text-slate-400">{n + 1}.</span>{r.text}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <fieldset className="sm:col-span-6" disabled={!canEdit}>
                <legend className="sr-only">Resultado do item {n + 1}</legend>
                <div className="flex flex-wrap gap-2">
                  {(["CONFORME", "NAO_CONFORME", "NAO_APLICAVEL"] as const).map((res) => (
                    <label key={res} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${r.result === res ? (res === "NAO_CONFORME" ? "border-red-600 bg-red-50 text-red-800" : "border-brand-700 bg-brand-50 text-brand-900") : "border-slate-300 bg-white"}`}>
                      <input type="radio" name={`r-${r.id}`} className="sr-only" checked={r.result === res} onChange={() => set(r.id, { result: res })} />
                      {INSPECTION_RESULT[res]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {r.result === "NAO_CONFORME" && (
                <>
                  <SelectField className="sm:col-span-2" label="Criticidade" value={r.criticality} onChange={(e) => set(r.id, { criticality: e.target.value })} disabled={!canEdit}>
                    {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </SelectField>
                  <SelectField className="sm:col-span-4" label="Foto/evidência (documento da obra)" value={r.documentIds[0] ?? ""} onChange={(e) => set(r.id, { documentIds: e.target.value ? [e.target.value] : [] })} disabled={!canEdit} hint={photos.length ? undefined : "Envie fotos na aba Documentos da obra (categoria Registro fotográfico)."}>
                    <option value="">Nenhuma</option>
                    {photos.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </SelectField>
                </>
              )}
              <TextAreaField className="sm:col-span-6" label="Observação" rows={2} value={r.observation} onChange={(e) => set(r.id, { observation: e.target.value })} disabled={!canEdit} maxLength={2000} />
            </div>
          </li>
        ))}
      </ol>
      {canEdit && (
        <>
          <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-6">
            <TextField className="sm:col-span-4" label="Incluir item" value={extra.text} onChange={(e) => setExtra({ ...extra, text: e.target.value })} maxLength={500} />
            <SelectField className="sm:col-span-1" label="Criticidade" value={extra.criticality} onChange={(e) => setExtra({ ...extra, criticality: e.target.value })}>
              {levels.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </SelectField>
            <div className="flex items-end sm:col-span-1"><Button variant="secondary" onClick={addItem} loading={save.pending}>Incluir</Button></div>
          </div>
          <div className="card space-y-3 p-4">
            <TextAreaField label="Conclusão da inspeção" required rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} error={complete.fieldErrors.summary} maxLength={4000} hint={`${nc} não conformidade(s) marcada(s). Ao concluir, cada uma gera uma ação corretiva com prazo pela criticidade.`} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onSave} loading={save.pending}>Salvar rascunho</Button>
              <Button onClick={onComplete} loading={complete.pending}>Concluir inspeção</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
