import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listActions, listCriticality } from "@/server/services/safety.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ACTION_STATUS, criticalityTone } from "@/components/phase3/labels";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Ações corretivas" };

export default async function ActionsPage({ searchParams }: { searchParams: Promise<{ status?: string; atrasadas?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "safety.read")) return <Forbidden />;
  const sp = await searchParams;
  const status = Object.keys(ACTION_STATUS).find((k) => k === sp.status) as keyof typeof ACTION_STATUS | undefined;
  const [list, levels] = await Promise.all([listActions(actor, { status: status as never, overdue: sp.atrasadas === "1" }), listCriticality()]);
  const today = new Date().toISOString().slice(0, 10);
  const levelName = (c: string) => levels.find((l) => l.code === c)?.name ?? c;
  return (
    <div>
      <PageHeader title="Ações corretivas" description="Pendências de segurança com responsável, prazo, evidência e validação do encerramento." />
      <nav className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Filtros">
        <Link className="rounded-full border border-slate-300 bg-white px-3 py-1" href="/seguranca/acoes">Todas</Link>
        <Link className="rounded-full border border-slate-300 bg-white px-3 py-1" href="/seguranca/acoes?atrasadas=1">Atrasadas</Link>
        {Object.entries(ACTION_STATUS).map(([k, l]) => <Link key={k} className="rounded-full border border-slate-300 bg-white px-3 py-1" href={`/seguranca/acoes?status=${k}`}>{l}</Link>)}
      </nav>
      {list.length === 0 ? <EmptyState title="Nenhuma ação encontrada" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Prazo</th><th>Ação</th><th>Obra</th><th>Criticidade</th><th>Responsável</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a) => {
                const late = ["ABERTA", "EM_ANDAMENTO"].includes(a.status) && a.dueDate.toISOString().slice(0, 10) < today;
                return (
                  <tr key={a.id}>
                    <td className={`whitespace-nowrap ${late ? "font-medium text-red-700" : ""}`}>{formatDay(a.dueDate)}{late && " (atrasada)"}</td>
                    <td><Link href={`/seguranca/acoes/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.title}</Link></td>
                    <td>{a.work.code}</td>
                    <td><Badge tone={criticalityTone(a.criticality)}>{levelName(a.criticality)}</Badge></td>
                    <td>{a.responsibleName}</td>
                    <td>{ACTION_STATUS[a.status]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
