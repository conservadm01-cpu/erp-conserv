import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listInspections } from "@/server/services/safety.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { INSPECTION_STATUS } from "@/components/phase3/labels";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Inspeções" };

export default async function InspectionsPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "safety.read")) return <Forbidden />;
  const list = await listInspections(actor);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <PageHeader title="Inspeções" description="Para planejar uma inspeção, abra a obra na aba Segurança." />
      {list.length === 0 ? <EmptyState title="Nenhuma inspeção registrada" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Data prevista</th><th>Inspeção</th><th>Obra</th><th>Não conformidades</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap">{formatDay(i.plannedDate)}{["PLANEJADA", "EM_ANDAMENTO"].includes(i.status) && i.plannedDate.toISOString().slice(0, 10) < today && <> <Badge tone="red">atrasada</Badge></>}</td>
                  <td><Link href={`/seguranca/inspecoes/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.title}</Link></td>
                  <td><Link href={`/obras/${i.work.id}?aba=seguranca`} className="hover:underline">{i.work.code}</Link><span className="block text-xs text-slate-500">{i.work.title}</span></td>
                  <td className="tabular-nums">{i._count.items}</td>
                  <td>{INSPECTION_STATUS[i.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
