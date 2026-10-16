"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDay, toInputDate } from "@/lib/format";
import { Button } from "../ui/Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { useSubmit } from "../ui/useForm";
import { RuleStatusBadge } from "../works/StatusBadges";
import { CHECKPOINT, CLASSIFICATION, EXECUTION_MODE } from "../works/labels";

type Rule = {
  id: string; code: string; name: string; description: string | null; workTypes: string[]; activities: string[]; executionModes: string[];
  applicabilityNote: string | null; evidence: string; documentCategoryCode: string | null; classification: string; legalBasis: string | null;
  sourceUrl: string | null; normVersion: string | null; lastReviewedAt: string | null; validatedAt: string | null; nextReviewAt: string | null;
  checkpoint: string; blocking: boolean; status: string;
};
type Opt = { code: string; name: string };

const blank = {
  code: "", name: "", description: "", workTypes: [] as string[], activities: [] as string[], executionModes: [] as string[], applicabilityNote: "",
  evidence: "", documentCategoryCode: "", classification: "BOA_PRATICA", legalBasis: "", sourceUrl: "", normVersion: "", checkpoint: "INICIO_EXECUCAO", blocking: false, nextReviewAt: "",
};

export function RuleEditor({ rules, canManage, workTypes, activities, categories }: { rules: Rule[]; canManage: boolean; workTypes: Opt[]; activities: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [v, setV] = useState(blank);
  const [validating, setValidating] = useState<Rule | null>(null);
  const [val, setVal] = useState({ lastReviewedAt: new Date().toISOString().slice(0, 10), nextReviewAt: "", note: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const save = useSubmit();
  const validate = useSubmit();
  const name = (list: Opt[], code: string) => list.find((o) => o.code === code)?.name ?? code;
  const toggle = (k: "workTypes" | "activities" | "executionModes", code: string) => setV({ ...v, [k]: v[k].includes(code) ? v[k].filter((c) => c !== code) : [...v[k], code] });

  function open(r?: Rule) {
    setNotice(null);
    setEditing(r?.id ?? "new");
    setV(r ? {
      code: r.code, name: r.name, description: r.description ?? "", workTypes: r.workTypes, activities: r.activities, executionModes: r.executionModes,
      applicabilityNote: r.applicabilityNote ?? "", evidence: r.evidence, documentCategoryCode: r.documentCategoryCode ?? "", classification: r.classification,
      legalBasis: r.legalBasis ?? "", sourceUrl: r.sourceUrl ?? "", normVersion: r.normVersion ?? "", checkpoint: r.checkpoint, blocking: r.blocking, nextReviewAt: toInputDate(r.nextReviewAt),
    } : blank);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { code, ...rest } = v;
    const res = await save.run(() => editing === "new" ? api("/api/requirement-rules", { body: v }) : api(`/api/requirement-rules/${editing}`, { method: "PATCH", body: rest }));
    if (res) { setEditing(null); setNotice(editing === "new" ? "Regra criada como pendente de validação." : "Regra alterada. Ela voltou para pendente de validação."); router.refresh(); }
    void code;
  }

  async function doValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!validating) return;
    const res = await validate.run(() => api(`/api/requirement-rules/${validating.id}/validate`, { body: val }));
    if (res) { setValidating(null); setNotice("Regra validada."); router.refresh(); }
  }

  const form = (
    <form onSubmit={submit} className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2" noValidate>
      {save.error && <div className="sm:col-span-2"><Alert tone="error">{save.error}</Alert></div>}
      <TextField label="Código" required value={v.code} disabled={editing !== "new"} onChange={(e) => setV({ ...v, code: e.target.value })} error={save.fieldErrors.code} maxLength={40} />
      <TextField label="Nome do requisito" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={save.fieldErrors.name} maxLength={200} />
      <TextAreaField className="sm:col-span-2" label="Descrição" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={2000} />
      <TextField className="sm:col-span-2" label="Documento ou evidência exigida" required value={v.evidence} onChange={(e) => setV({ ...v, evidence: e.target.value })} error={save.fieldErrors.evidence} maxLength={500} />
      <SelectField label="Classificação" value={v.classification} onChange={(e) => setV({ ...v, classification: e.target.value })}>
        {Object.entries(CLASSIFICATION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <SelectField label="Etapa de verificação" value={v.checkpoint} onChange={(e) => setV({ ...v, checkpoint: e.target.value })}>
        {Object.entries(CHECKPOINT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <TextField label="Base legal, contratual ou institucional" value={v.legalBasis} onChange={(e) => setV({ ...v, legalBasis: e.target.value })} maxLength={500} hint="Obrigatória para validar. Não cite artigos sem conferir a redação vigente." />
      <TextField label="URL da fonte oficial" type="url" value={v.sourceUrl} onChange={(e) => setV({ ...v, sourceUrl: e.target.value })} error={save.fieldErrors.sourceUrl} maxLength={500} />
      <TextField label="Versão normativa" value={v.normVersion} onChange={(e) => setV({ ...v, normVersion: e.target.value })} maxLength={100} />
      <SelectField label="Categoria documental sugerida" value={v.documentCategoryCode} onChange={(e) => setV({ ...v, documentCategoryCode: e.target.value })}>
        <option value="">Nenhuma</option>
        {categories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </SelectField>
      <TextField label="Próxima revisão prevista" type="date" value={v.nextReviewAt} onChange={(e) => setV({ ...v, nextReviewAt: e.target.value })} />
      <CheckboxField className="sm:col-span-2" label="Bloquear o avanço da obra nesta etapa enquanto não atendido (só vale após validação)" checked={v.blocking} onChange={(e) => setV({ ...v, blocking: e.target.checked })} />
      <fieldset className="sm:col-span-2">
        <legend className="mb-1 text-sm font-semibold text-slate-700">Condições de aplicabilidade</legend>
        <p className="mb-2 text-xs text-slate-500">Sem seleção, a condição vale para qualquer valor. Evite regras universais quando a norma depende de atividade, risco ou vínculo.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><p className="mb-1 text-xs font-medium text-slate-600">Tipos de obra</p>{workTypes.map((t) => <CheckboxField key={t.code} label={t.name} checked={v.workTypes.includes(t.code)} onChange={() => toggle("workTypes", t.code)} />)}</div>
          <div><p className="mb-1 text-xs font-medium text-slate-600">Atividades (qualquer uma)</p>{activities.map((t) => <CheckboxField key={t.code} label={t.name} checked={v.activities.includes(t.code)} onChange={() => toggle("activities", t.code)} />)}</div>
          <div><p className="mb-1 text-xs font-medium text-slate-600">Forma de execução</p>{Object.entries(EXECUTION_MODE).map(([k, l]) => <CheckboxField key={k} label={l} checked={v.executionModes.includes(k)} onChange={() => toggle("executionModes", k)} />)}</div>
        </div>
      </fieldset>
      <TextAreaField className="sm:col-span-2" label="Observação sobre aplicabilidade" rows={2} value={v.applicabilityNote} onChange={(e) => setV({ ...v, applicabilityNote: e.target.value })} maxLength={2000} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={save.pending}>Salvar regra</Button>
        <Button variant="secondary" onClick={() => setEditing(null)} disabled={save.pending}>Cancelar</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {canManage && editing === null && <Button onClick={() => open()}>Nova regra</Button>}
      {editing === "new" && form}
      <ul className="space-y-3">
        {rules.map((r) => editing === r.id ? <li key={r.id}>{form}</li> : (
          <li key={r.id} className="card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium">{r.name} <span className="font-mono text-xs text-slate-500">{r.code}</span></p>
                <p className="flex flex-wrap gap-1.5"><RuleStatusBadge status={r.status} /><Badge>{CLASSIFICATION[r.classification]}</Badge><Badge>{CHECKPOINT[r.checkpoint]}</Badge>{r.blocking && <Badge tone="red">bloqueante</Badge>}</p>
                <p className="text-slate-700">Evidência: {r.evidence}</p>
                <p className="text-xs text-slate-500">
                  Aplica-se a: {[r.workTypes.map((c) => name(workTypes, c)).join(", ") || "qualquer tipo", r.activities.map((c) => name(activities, c)).join(" ou ") || "qualquer atividade", r.executionModes.map((m) => EXECUTION_MODE[m]).join(", ") || "qualquer forma de execução"].join(" · ")}
                </p>
                <p className="text-xs text-slate-500">Base: {r.legalBasis ?? "não informada"} · Fonte: {r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">link oficial</a> : "não informada"} · Revisão: {formatDay(r.lastReviewedAt)} · Próxima: {formatDay(r.nextReviewAt)}</p>
              </div>
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {r.status === "PENDENTE_VALIDACAO" && <Button onClick={() => { setValidating(r); setVal({ lastReviewedAt: new Date().toISOString().slice(0, 10), nextReviewAt: toInputDate(r.nextReviewAt), note: "" }); }}>Validar</Button>}
                  {r.status !== "INATIVA" && <Button variant="secondary" onClick={() => open(r)}>Editar</Button>}
                  <Button variant="ghost" onClick={async () => { await api(`/api/requirement-rules/${r.id}/status`, { body: { active: r.status === "INATIVA" } }); router.refresh(); }}>
                    {r.status === "INATIVA" ? "Reativar" : "Inativar"}
                  </Button>
                </div>
              )}
            </div>
            {validating?.id === r.id && (
              <form onSubmit={doValidate} className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2" noValidate>
                <Alert tone="warning">Valide somente após conferir a redação vigente, a aplicabilidade e a base legal com o responsável técnico ou jurídico.</Alert>
                <div />
                {validate.error && <div className="sm:col-span-2"><Alert tone="error">{validate.error}</Alert></div>}
                <TextField label="Data da revisão" type="date" value={val.lastReviewedAt} onChange={(e) => setVal({ ...val, lastReviewedAt: e.target.value })} />
                <TextField label="Próxima revisão" type="date" required value={val.nextReviewAt} onChange={(e) => setVal({ ...val, nextReviewAt: e.target.value })} error={validate.fieldErrors.nextReviewAt} />
                <TextAreaField className="sm:col-span-2" label="Registro da validação (quem conferiu, fonte consultada)" required rows={2} value={val.note} onChange={(e) => setVal({ ...val, note: e.target.value })} error={validate.fieldErrors.note} maxLength={1000} />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" loading={validate.pending}>Confirmar validação</Button>
                  <Button variant="secondary" onClick={() => setValidating(null)}>Cancelar</Button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
