"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, TextAreaField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Decision = "APROVAR" | "REJEITAR" | "DEVOLVER";

export function DecisionForm({ approvalId, documents, blocked }: { approvalId: string; documents: { id: string; title: string; status: string }[]; blocked: string[] }) {
  const router = useRouter();
  const [opinion, setOpinion] = useState("");
  const [consulted, setConsulted] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const { pending, error, fieldErrors, run } = useSubmit();

  async function decide(decision: Decision) {
    const res = await run(() => api<{ status: string; remaining: number }>(`/api/approvals/${approvalId}/decision`, { body: { decision, opinion, consultedDocumentIds: consulted } }));
    setConfirming(null);
    if (!res) return;
    setResult(res.status === "PENDENTE" ? `Decisão registrada. Faltam ${res.remaining} decisão(ões) favorável(is) de outros aprovadores.` : "Decisão registrada e aplicada à obra.");
    router.refresh();
  }

  if (result) return <Alert tone="success">{result}</Alert>;
  const labels: Record<Decision, string> = { APROVAR: "Aprovar", DEVOLVER: "Devolver para ajustes", REJEITAR: "Rejeitar" };
  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {blocked.length > 0 && <Alert tone="warning" title="Requisitos bloqueantes pendentes">A aprovação não poderá ser concluída enquanto houver: {blocked.join("; ")}.</Alert>}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Documentos consultados</legend>
        {documents.length === 0 ? <p className="text-sm text-slate-500">A obra não possui documentos.</p> : (
          <div className="space-y-1">
            {documents.map((d) => (
              <CheckboxField key={d.id} label={`${d.title} (${d.status.toLowerCase()})`} checked={consulted.includes(d.id)} onChange={() => setConsulted(consulted.includes(d.id) ? consulted.filter((c) => c !== d.id) : [...consulted, d.id])} />
            ))}
          </div>
        )}
      </fieldset>
      <TextAreaField label="Parecer" required rows={5} value={opinion} onChange={(e) => setOpinion(e.target.value)} error={fieldErrors.opinion} maxLength={4000} hint="O parecer fica registrado no histórico da obra e no dossiê." />
      {confirming ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm">Confirmar a decisão <strong>{labels[confirming]}</strong>? Ela não poderá ser alterada.</p>
          <div className="mt-3 flex gap-2">
            <Button variant={confirming === "APROVAR" ? "primary" : "danger"} loading={pending} onClick={() => decide(confirming)}>Confirmar</Button>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={pending}>Voltar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfirming("APROVAR")}>Aprovar</Button>
          <Button variant="secondary" onClick={() => setConfirming("DEVOLVER")}>Devolver para ajustes</Button>
          <Button variant="danger" onClick={() => setConfirming("REJEITAR")}>Rejeitar</Button>
        </div>
      )}
    </div>
  );
}
