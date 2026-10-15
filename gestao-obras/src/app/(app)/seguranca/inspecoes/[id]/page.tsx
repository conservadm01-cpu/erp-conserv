import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { getInspection, listCriticality } from "@/server/services/safety.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { InspectionChecklist } from "@/components/safety/InspectionChecklist";
import { ACTION_STATUS, INSPECTION_STATUS } from "@/components/phase3/labels";
import { formatDateTime, formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Inspeção" };

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const [ins, levels] = await Promise.all([orNotFound(() => getInspection(actor, id)), listCriticality()]);
  const actions = ins.items.flatMap((i) => i.correctiveActions);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={ins.title}
        description={<>Obra <Link href={`/obras/${ins.work.id}?aba=seguranca`} className="text-brand-700 hover:underline">{ins.work.code}</Link> · prevista para {formatDay(ins.plannedDate)} · responsável {ins.inspectorName} · {INSPECTION_STATUS[ins.status]}{ins.performedAt ? ` em ${formatDateTime(ins.performedAt)}` : ""}</>}
        actions={<a href={`/api/safety/inspections/${ins.id}/report`} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Relatório (PDF)</a>}
      />
      {ins.summary && <Alert tone="info" title="Conclusão">{ins.summary}</Alert>}
      {actions.length > 0 && (
        <section className="card p-4 text-sm">
          <h2 className="mb-2 font-semibold text-slate-700">Ações corretivas geradas</h2>
          <ul>{actions.map((a) => <li key={a.id}><Link href={`/seguranca/acoes/${a.id}`} className="text-brand-700 hover:underline">{a.title}</Link> · {ACTION_STATUS[a.status]}</li>)}</ul>
        </section>
      )}
      <InspectionChecklist inspectionId={ins.id} items={ins.items} levels={levels} photos={ins.photos} canEdit={ins.canEdit} />
    </div>
  );
}
