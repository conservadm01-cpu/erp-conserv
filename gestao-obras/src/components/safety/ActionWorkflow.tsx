"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, TextAreaField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

export function ActionWorkflow({ id, status, canAct, canValidate, documents }: { id: string; status: string; canAct: boolean; canValidate: boolean; documents: { id: string; title: string }[] }) {
  const router = useRouter();
  const [evidence, setEvidence] = useState("");
  const [docs, setDocs] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const { pending, error, fieldErrors, run } = useSubmit();
  const step = async (s: string) => {
    const res = await run(() => api(`/api/safety/actions/${id}`, { body: { step: s, evidence: evidence || null, evidenceDocumentIds: docs, note: note || null } }));
    if (res) router.refresh();
  };
  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {canAct && status === "ABERTA" && <Button onClick={() => step("INICIAR")} loading={pending}>Iniciar tratamento</Button>}
      {canAct && ["ABERTA", "EM_ANDAMENTO"].includes(status) && (
        <div className="card space-y-3 p-4">
          <TextAreaField label="Evidência da correção" required rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} error={fieldErrors.evidence} maxLength={4000} />
          {documents.length > 0 && (
            <fieldset><legend className="label">Documentos/fotos de evidência</legend>
              {documents.map((d) => <CheckboxField key={d.id} label={d.title} checked={docs.includes(d.id)} onChange={() => setDocs(docs.includes(d.id) ? docs.filter((x) => x !== d.id) : [...docs, d.id])} />)}
            </fieldset>
          )}
          <Button onClick={() => step("ENVIAR_EVIDENCIA")} loading={pending}>Enviar para validação</Button>
        </div>
      )}
      {canValidate && status === "AGUARDANDO_VALIDACAO" && (
        <div className="card space-y-3 p-4">
          <TextAreaField label="Parecer da validação" rows={2} value={note} onChange={(e) => setNote(e.target.value)} error={fieldErrors.note} maxLength={2000} hint="Obrigatório para reprovar." />
          <div className="flex gap-2">
            <Button onClick={() => step("VALIDAR")} loading={pending}>Validar e encerrar</Button>
            <Button variant="danger" onClick={() => step("REPROVAR")} loading={pending}>Reprovar correção</Button>
          </div>
        </div>
      )}
      {canValidate && ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"].includes(status) && (
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">Cancelar ação</summary>
          <div className="mt-2 space-y-2">
            <TextAreaField label="Justificativa do cancelamento" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            <Button variant="danger" onClick={() => step("CANCELAR")} loading={pending}>Cancelar ação</Button>
          </div>
        </details>
      )}
    </div>
  );
}
