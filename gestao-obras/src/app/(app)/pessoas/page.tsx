import type { Metadata } from "next";
import Link from "next/link";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { RegionSelect } from "@/components/filters/RegionSelect";
import { uuid } from "@/server/validation/common";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listPeople } from "@/server/services/people.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { PERSON_CATEGORY } from "@/components/phase3/labels";

export const metadata: Metadata = { title: "Pessoas" };

const CATEGORIES = ["PROFISSIONAL", "EMPREGADO", "VOLUNTARIO", "OUTRO"] as const;

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string; unitId?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "person.read")) return <Forbidden />;
  const sp = await searchParams;
  const category = CATEGORIES.find((c) => c === sp.categoria);
  const q = sp.q?.slice(0, 100) || undefined;
  const regionId = sp.unitId && uuid.safeParse(sp.unitId).success ? sp.unitId : undefined;
  const [people, units] = await Promise.all([listPeople(actor, { category, q, regionId }), listOrgUnits(actor, { status: "ATIVA" })]);
  const title = category === "VOLUNTARIO" ? "Voluntários" : category === "PROFISSIONAL" ? "Profissionais" : "Pessoas";
  return (
    <div>
      <PageHeader
        title={title}
        description="Cadastro mínimo de quem atua nas obras. Não registre dados de saúde, diagnósticos ou documentos pessoais além do necessário."
        actions={canAnywhere(actor, "person.manage") && <Link href={`/pessoas/nova${category ? `?categoria=${category}` : ""}`} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Cadastrar</Link>}
      />
      <nav aria-label="Categorias" className="mb-4 flex flex-wrap gap-2 text-sm">
        {[{ k: "", l: "Todas" }, ...CATEGORIES.map((c) => ({ k: c, l: PERSON_CATEGORY[c]! }))].map((c) => (
          <Link key={c.k} href={c.k ? `/pessoas?categoria=${c.k}` : "/pessoas"} aria-current={(category ?? "") === c.k ? "page" : undefined} className={`rounded-full border px-3 py-1 ${(category ?? "") === c.k ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white hover:bg-slate-50"}`}>{c.l}</Link>
        ))}
      </nav>
      <form className="mb-4 grid grid-cols-1 items-end gap-2 sm:grid-cols-3" role="search">
        {category && <input type="hidden" name="categoria" value={category} />}
        <div><label htmlFor="q" className="label">Buscar</label><input id="q" name="q" defaultValue={q} placeholder="Nome, função ou identificação interna" className="input" /></div>
        <RegionSelect units={units} value={regionId} />
        <div><button className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Buscar</button></div>
      </form>
      {people.length === 0 ? <EmptyState title="Nenhuma pessoa encontrada" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Nome</th><th>Categoria</th><th>Função</th><th>Unidade</th><th>Empresa</th><th>Obras ativas</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/pessoas/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link></td>
                  <td>{PERSON_CATEGORY[p.category]}</td>
                  <td>{p.jobFunction ?? "—"}</td>
                  <td>{p.unit.name}</td>
                  <td>{p.company?.legalName ?? "—"}</td>
                  <td className="tabular-nums">{p._count.assignments}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
