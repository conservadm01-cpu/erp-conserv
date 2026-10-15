import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { getAction, listCriticality } from "@/server/services/safety.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ActionWorkflow } from "@/components/safety/ActionWorkflow";
import { ACTION_STATUS, criticalityTone, INCIDENT_TYPE } from "@/components/phase3/labels";
import { formatDateTime, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Ação corretiva" };

export default async function ActionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [a, levels] = await Promise.all([orNotFound(() => getAction(actor, id)), listCriticality()]);
  const level = levels.find((l) => l.code === a.criticality);
  const evidenceDocs = a.documents.filter((d) => a.evidenceDocumentIds.includes(d.id));
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={a.title}
        description={<span className="flex flex-wrap items-center gap-2">Obra <Link href={`/obras/${a.work.id}?aba=seguranca`} className="text-brand-700 hover:underline">{a.work.code}</Link> · <Badge tone={criticalityTone(a.criticality)}>{level?.name ?? a.criticality}</Badge> · {ACTION_STATUS[a.status]} · prazo {formatDay(a.dueDate)}</span>}
      />
      {level?.blocksProgress && !["ENCERRADA", "CANCELADA"].includes(a.status) && <Alert tone="warning">Enquanto esta ação estiver aberta, a obra não pode iniciar, retomar a execução nem seguir para vistoria.</Alert>}
      <section className="card space-y-2 p-6 text-sm">
        <p><span className="text-slate-500">Responsável:</span> {a.responsibleName}</p>
        {a.description && <p><span className="text-slate-500">Descrição:</span> {a.description}</p>}
        <p><span className="text-slate-500">Origem:</span>{" "}
          {a.inspectionItem ? <>inspeção <Link className="text-brand-700 hover:underline" href={`/seguranca/inspecoes/${a.inspectionItem.inspection.id}`}>{a.inspectionItem.inspection.title}</Link> — {a.inspectionItem.text}</>
            : a.risk ? <>risco “{a.risk.title}”</> : a.incident ? <>{INCIDENT_TYPE[a.incident.type]} em {formatDateTime(a.incident.occurredAt)}</> : "registro avulso"}
        </p>
        <p><span className="text-slate-500">Criada por</span> {a.people[a.createdById] ?? "—"} em {formatDateTime(a.createdAt)}</p>
        {a.evidence && <p><span className="text-slate-500">Evidência ({a.submittedById ? a.people[a.submittedById] : "—"}, {a.submittedAt ? formatDateTime(a.submittedAt) : "—"}):</span> {a.evidence}{evidenceDocs.length > 0 && ` · documentos: ${evidenceDocs.map((d) => d.title).join(", ")}`}</p>}
        {a.validationNote && <p><span className="text-slate-500">Parecer:</span> {a.validationNote}</p>}
        {a.validatedAt && <p><span className="text-slate-500">{a.status === "CANCELADA" ? "Cancelada" : "Validada"} por</span> {a.validatedById ? a.people[a.validatedById] : "—"} em {formatDateTime(a.validatedAt)}</p>}
      </section>
      {!a.can.validate && a.status === "AGUARDANDO_VALIDACAO" && a.submittedById === actor.userId && <Alert tone="info">Por segregação de funções, a validação deve ser feita por outra pessoa.</Alert>}
      <ActionWorkflow id={a.id} status={a.status} canAct={a.can.act} canValidate={a.can.validate} documents={a.documents} />
    </div>
  );
}
