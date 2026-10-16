import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Estrutura organizacional" };

export default async function OrgPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "org.read")) return <Forbidden />;
  const sp = await searchParams;
  const status = sp.status === "ATIVA" || sp.status === "INATIVA" ? sp.status : undefined;
  const q = sp.q?.slice(0, 100) || undefined;
  const units = await listOrgUnits(actor, { status, q });
  const minDepth = Math.min(...units.map((u) => u.depth));

  return (
    <div>
      <PageHeader
        title="Estrutura organizacional"
        description="Unidades às quais você tem acesso. A hierarquia é uma proposta técnica configurável."
        actions={canAnywhere(actor, "org.manage") && <Link href="/organizacao/nova" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Nova unidade</Link>}
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="sr-only" htmlFor="q">Buscar</label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nome ou código" className="input sm:max-w-xs" />
        <label className="sr-only" htmlFor="status">Situação</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="input sm:max-w-[10rem]">
          <option value="">Todas</option>
          <option value="ATIVA">Ativas</option>
          <option value="INATIVA">Inativas</option>
        </select>
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button>
      </form>
      {units.length === 0 ? (
        <EmptyState title="Nenhuma unidade encontrada" description={q || status ? "Ajuste os filtros da busca." : "Você ainda não possui unidades no seu escopo."} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr><th>Unidade</th><th>Código</th><th>Tipo</th><th>Cidade/UF</th><th>Situação</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span style={{ paddingLeft: `${(u.depth - minDepth) * 1.25}rem` }} className="inline-block">
                      <Link href={`/organizacao/${u.id}`} className="font-medium text-brand-700 hover:underline">{u.name}</Link>
                    </span>
                  </td>
                  <td className="font-mono text-xs">{u.code}</td>
                  <td>{u.type.name}</td>
                  <td>{[u.city, u.state].filter(Boolean).join("/") || "—"}</td>
                  <td><StatusBadge status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
