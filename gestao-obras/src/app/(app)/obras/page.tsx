import type { Metadata } from "next";
import Link from "next/link";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { RegionSelect } from "@/components/filters/RegionSelect";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listWorkCatalogs, listWorks } from "@/server/services/work.service";
import { workListQuery } from "@/server/validation/work";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkStatusBadge } from "@/components/works/StatusBadges";
import { PRIORITY, WORK_STATUS } from "@/components/works/labels";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Obras" };

export default async function WorksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "work.read")) return <Forbidden />;
  const sp = await searchParams;
  const parsed = workListQuery.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : {};
  const [works, { types }, units] = await Promise.all([listWorks(actor, q), listWorkCatalogs(), listOrgUnits(actor, { status: "ATIVA" })]);

  return (
    <div>
      <PageHeader
        title="Obras"
        description="Obras das unidades do seu escopo."
        actions={canAnywhere(actor, "work.create") && <Link href="/obras/nova" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Nova obra</Link>}
      />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="search">
        <div><label className="label" htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={q.q} placeholder="Título ou código" className="input" /></div>
        <RegionSelect units={units} value={q.unitId} />
        <div>
          <label className="label" htmlFor="status">Situação</label>
          <select id="status" name="status" defaultValue={q.status ?? ""} className="input">
            <option value="">Todas</option>
            {Object.entries(WORK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="typeCode">Tipo</label>
          <select id="typeCode" name="typeCode" defaultValue={q.typeCode ?? ""} className="input">
            <option value="">Todos</option>
            {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </div>
        <div className="flex items-end"><button className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button></div>
      </form>
      {works.length === 0 ? (
        <EmptyState
          title="Nenhuma obra encontrada"
          description={Object.keys(q).length ? "Ajuste os filtros da busca." : "Ainda não há obras cadastradas no seu escopo."}
          action={canAnywhere(actor, "work.create") && !Object.keys(q).length ? <Link href="/obras/nova" className="text-sm text-brand-700 hover:underline">Cadastrar a primeira obra</Link> : undefined}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Código</th><th>Obra</th><th>Unidade</th><th>Tipo</th><th>Prioridade</th><th>Previsão</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {works.map((w) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap font-mono text-xs">{w.code}</td>
                  <td><Link href={`/obras/${w.id}`} className="font-medium text-brand-700 hover:underline">{w.title}</Link></td>
                  <td>{w.unit.name}</td>
                  <td>{w.type.name}</td>
                  <td>{PRIORITY[w.priority]}</td>
                  <td className="whitespace-nowrap">{formatDay(w.plannedStart)} – {formatDay(w.plannedEnd)}</td>
                  <td><WorkStatusBadge status={w.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
