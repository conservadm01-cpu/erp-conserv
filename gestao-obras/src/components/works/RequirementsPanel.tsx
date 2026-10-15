"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextAreaField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Badge } from "../ui/Badge";
import { useSubmit } from "../ui/useForm";
import { EvalStatusBadge, RuleStatusBadge } from "./StatusBadges";
import { CHECKPOINT, CLASSIFICATION } from "./labels";

type Req = {
  id: string; status: string; justification: string | null; documentId: string | null;
  document: { id: string; title: string; status: string } | null;
  rule: { code: string; name: string; status: string; classification: string; checkpoint: string; blocking: boolean; evidence: string; legalBasis: string | null; sourceUrl: string | null; applicabilityNote: string | null };
};

export function RequirementsPanel({ workId, requirements, documents, canEvaluate, canWaive }: { workId: string; requirements: Req[]; documents: { id: string; title: string; status: string }[]; canEvaluate: boolean; canWaive: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ status: "ATENDIDO", documentId: "", justification: "" });
  const [waiving, setWaiving] = useState<Req | null>(null);
  const { pending, error, fieldErrors, run } = useSubmit();

  async function save(e: React.FormEvent, id: string) {
    e.preventDefault();
    const res = await run(() => api(`/api/works/${workId}/requirements/${id}`, { method: "PATCH", body: { status: form.status, documentId: form.documentId || null, justification: form.justification || null } }));
    if (res) { setEditing(null); router.refresh(); }
  }

  if (!requirements.length) return <EmptyState title="Nenhum requisito aplicável" description="Nenhuma regra configurada se aplica ao tipo, às atividades e à forma de execução desta obra." />;
  return (
    <div className="space-y-3">
      <Alert tone="info">
        Regras <strong>pendentes de confirmação</strong> ainda não foram validadas por responsável e servem apenas como orientação; não representam obrigação jurídica definitiva nem bloqueiam o andamento.
      </Alert>
      <ul className="space-y-3">
        {requirements.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{r.rule.name}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <RuleStatusBadge status={r.rule.status} />
                  <Badge>{CLASSIFICATION[r.rule.classification]}</Badge>
                  <span>Verificação: {CHECKPOINT[r.rule.checkpoint]}</span>
                  {r.rule.blocking && r.rule.status === "VALIDADA" && <Badge tone="red">bloqueante</Badge>}
                </p>
                <p className="text-sm text-slate-700">Evidência: {r.rule.evidence}</p>
                {r.rule.applicabilityNote && <p className="text-xs text-slate-500">{r.rule.applicabilityNote}</p>}
                <p className="text-xs text-slate-500">Base: {r.rule.legalBasis ?? "não informada"}{r.rule.sourceUrl && <> · <a href={r.rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">fonte oficial</a></>}</p>
                {r.document && <p className="text-sm">Documento vinculado: {r.document.title}</p>}
                {r.justification && <p className="text-sm text-slate-700">Registro: {r.justification}</p>}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <EvalStatusBadge status={r.status} />
                <div className="flex gap-2">
                  {canEvaluate && editing !== r.id && <Button variant="secondary" onClick={() => { setEditing(r.id); setForm({ status: r.status === "PENDENTE" ? "ATENDIDO" : r.status, documentId: r.documentId ?? "", justification: r.justification ?? "" }); }}>Registrar</Button>}
                  {canWaive && r.status !== "DISPENSADO_JUSTIFICADO" && <Button variant="ghost" onClick={() => setWaiving(r)}>Dispensar</Button>}
                </div>
              </div>
            </div>
            {editing === r.id && (
              <form onSubmit={(e) => save(e, r.id)} className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2" noValidate>
                {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
                <SelectField label="Situação" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ATENDIDO">Atendido</option>
                  <option value="NAO_ATENDIDO">Não atendido</option>
                  <option value="PENDENTE">Pendente</option>
                </SelectField>
                <SelectField label="Documento de evidência" value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} error={fieldErrors.documentId}>
                  <option value="">Nenhum</option>
                  {documents.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.status.toLowerCase()})</option>)}
                </SelectField>
                <TextAreaField className="sm:col-span-2" label="Observação" rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} maxLength={2000} />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" loading={pending}>Salvar</Button>
                  <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(waiving)}
        title="Dispensar requisito"
        description={<>A dispensa de <strong>{waiving?.rule.name}</strong> exige justificativa, fica registrada com o seu nome na auditoria e consta do dossiê da obra.</>}
        confirmLabel="Dispensar"
        reasonLabel="Justificativa (mínimo de 20 caracteres)"
        onClose={() => setWaiving(null)}
        onConfirm={async (justification) => {
          if (!waiving) return;
          await api(`/api/works/${workId}/requirements/${waiving.id}/waive`, { body: { justification } });
          router.refresh();
        }}
      />
    </div>
  );
}
