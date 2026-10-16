import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listInbox } from "@/server/services/approval.service";
import { ownerInfo } from "@/server/services/document.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { DocStatusBadge } from "@/components/works/StatusBadges";
import { APPROVAL_KIND } from "@/components/works/labels";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Aprovações" };

export default async function InboxPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "approval.decide") && !canAnywhere(actor, "document.review")) return <Forbidden />;
  const inbox = await listInbox(actor);
  return (
    <div className="space-y-8">
      <PageHeader title="Fila de aprovação" description="Solicitações e documentos aguardando decisão, em ordem de chegada." />
      <section aria-labelledby="ap">
        <h2 id="ap" className="mb-3 text-sm font-semibold text-slate-700">Aprovações pendentes ({inbox.approvals.length})</h2>
        {inbox.approvals.length === 0 ? (
          <EmptyState title="Nenhuma aprovação pendente" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Tipo</th><th>Obra</th><th>Unidade</th><th>Solicitante</th><th>Desde</th><th>Decisões</th><th><span className="sr-only">Ação</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inbox.approvals.map((a) => (
                  <tr key={a.id}>
                    <td>{APPROVAL_KIND[a.kind]}</td>
                    <td><span className="font-mono text-xs">{a.work.code}</span><span className="block">{a.work.title}</span></td>
                    <td>{a.work.unit.name}</td>
                    <td>{a.requesterName}</td>
                    <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td>{a.steps.filter((s) => s.decision === "APROVAR").length} de {a.stepsRequired}</td>
                    <td className="text-right">
                      <Link href={`/aprovacoes/${a.id}`} className="text-brand-700 hover:underline">{a.ownRequest || a.alreadyDecided ? "Ver" : "Analisar"}</Link>
                      {a.ownRequest && <span className="ml-2"><Badge>sua solicitação</Badge></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="dc">
        <h2 id="dc" className="mb-3 text-sm font-semibold text-slate-700">Documentos aguardando análise ({inbox.documents.length})</h2>
        {inbox.documents.length === 0 ? (
          <EmptyState title="Nenhum documento aguardando análise" />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Documento</th><th>Categoria</th><th>Vinculado a</th><th>Enviado em</th><th>Situação</th><th><span className="sr-only">Ação</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {inbox.documents.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.title}</td>
                    <td>{d.category.name}</td>
                    <td><span className="text-xs text-slate-500">{ownerInfo(d).kind}</span><span className="block">{ownerInfo(d).label}</span></td>
                    <td className="whitespace-nowrap">{formatDateTime(d.createdAt)}</td>
                    <td><DocStatusBadge status={d.status} /></td>
                    <td className="text-right">
                      <Link href={ownerInfo(d).href} className="text-brand-700 hover:underline">Analisar</Link>
                      {d.ownUpload && <span className="ml-2"><Badge>enviado por você</Badge></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
