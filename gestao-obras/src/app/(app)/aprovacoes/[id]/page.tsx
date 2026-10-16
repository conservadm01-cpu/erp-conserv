import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { getApproval } from "@/server/services/approval.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { DecisionForm } from "@/components/approvals/DecisionForm";
import { DocStatusBadge } from "@/components/works/StatusBadges";
import { APPROVAL_KIND, APPROVAL_STATUS, DECISION, EXECUTION_MODE } from "@/components/works/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Aprovação" };

type GenericSnapshot = { titulo: string; resumo: [string, string][]; linhas?: { colunas: string[]; valores: string[][] } };
type Snapshot = { codigo: string; titulo: string; escopo: string; justificativa: string; formaExecucao: string; inicioPrevisto: string | null; terminoPrevisto: string | null; etapas: { nome: string; situacao: string; progresso: number }[] };

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const a = await orNotFound(() => getApproval(actor, id));
  const snap = a.snapshot as Snapshot;
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={`${APPROVAL_KIND[a.kind]} — ${a.work.code}`}
        description={<>{a.work.title} · {APPROVAL_STATUS[a.status]} · versão submetida {a.subjectVersion} · solicitada por {a.people[a.requesterId] ?? "—"} em {formatDateTime(a.createdAt)}</>}
        actions={<Link href={`/obras/${a.workId}`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Abrir obra</Link>}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card space-y-3 p-6 text-sm">
          <h2 className="font-semibold text-slate-700">Dados submetidos</h2>
          <p className="text-xs text-slate-500">Cópia registrada no momento da submissão; alterações posteriores na obra invalidam esta aprovação.</p>
          {"resumo" in (a.snapshot as object) ? <GenericSnapshotView snap={a.snapshot as GenericSnapshot} /> : <WorkSnapshotView snap={snap} />}
          {a.requestNote && <div><p className="text-slate-500">Observação do solicitante</p><p className="whitespace-pre-line">{a.requestNote}</p></div>}
          <div>
            <p className="text-slate-500">Documentos da obra</p>
            {a.documents.length ? <ul className="space-y-1">{a.documents.map((d) => <li key={d.id}>{d.title} · {d.category.name} <DocStatusBadge status={d.status} /></li>)}</ul> : <p>Nenhum documento.</p>}
          </div>
        </section>
        <section className="card space-y-4 p-6">
          <h2 className="text-sm font-semibold text-slate-700">Decisões ({a.steps.filter((s) => s.decision === "APROVAR").length} de {a.stepsRequired} favoráveis necessárias)</h2>
          {a.steps.length > 0 && (
            <ul className="space-y-2 text-sm">
              {a.steps.map((s) => (
                <li key={s.id} className="rounded-md bg-slate-50 p-3">
                  <p className="font-medium">{DECISION[s.decision]} — {a.people[s.approverId] ?? "—"}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(s.decidedAt)} · {s.consultedDocumentIds.length} documento(s) consultado(s)</p>
                  <p className="mt-1">{s.opinion}</p>
                </li>
              ))}
            </ul>
          )}
          {a.canDecide ? (
            <DecisionForm approvalId={a.id} documents={a.documents.map((d) => ({ id: d.id, title: d.title, status: d.status }))} blocked={a.blockingIssues} />
          ) : a.status === "PENDENTE" ? (
            <Alert tone="info">
              {a.ownRequest
                ? "Por segregação de funções, você não pode decidir uma solicitação que fez ou cadastrou."
                : a.steps.some((s) => s.approverId === actor.userId)
                  ? "Sua decisão foi registrada. A aprovação aguarda outros aprovadores."
                  : "Você não tem permissão para decidir esta aprovação."}
            </Alert>
          ) : (
            <Alert tone={a.status === "APROVADA" ? "success" : "info"} title={a.status === "APROVADA" ? "Solicitação aprovada" : `Aprovação ${APPROVAL_STATUS[a.status]?.toLowerCase()}`}>
              Decisão registrada em {a.decidedAt ? formatDateTime(a.decidedAt) : "—"}.
            </Alert>
          )}
        </section>
      </div>
    </div>
  );
}

function WorkSnapshotView({ snap }: { snap: Snapshot }) {
  return (
    <>
          <div><p className="text-slate-500">Escopo</p><p className="whitespace-pre-line">{snap.escopo}</p></div>
          <div><p className="text-slate-500">Justificativa</p><p className="whitespace-pre-line">{snap.justificativa}</p></div>
          <p><span className="text-slate-500">Forma de execução:</span> {EXECUTION_MODE[snap.formaExecucao] ?? snap.formaExecucao} · <span className="text-slate-500">Previsão:</span> {snap.inicioPrevisto ?? "—"} a {snap.terminoPrevisto ?? "—"}</p>
          <div>
            <p className="text-slate-500">Etapas</p>
            {snap.etapas.length ? <ul className="list-disc pl-5">{snap.etapas.map((e, i) => <li key={i}>{e.nome} ({e.progresso}%)</li>)}</ul> : <p>Nenhuma etapa.</p>}
          </div>
    </>
  );
}

/** Solicitações vinculadas a orçamento, medição, despesa ou mudança de escopo. */
function GenericSnapshotView({ snap }: { snap: GenericSnapshot }) {
  return (
    <>
      <p className="font-medium">{snap.titulo}</p>
      <dl className="space-y-2">
        {snap.resumo.map(([k, v]) => (
          <div key={k}><dt className="text-slate-500">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
        ))}
      </dl>
      {snap.linhas && snap.linhas.valores.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead><tr>{snap.linhas.colunas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {snap.linhas.valores.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j}>{v}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
