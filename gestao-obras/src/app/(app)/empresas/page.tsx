import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { formatCnpj, listCompanies } from "@/server/services/company.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, StatusBadge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Empresas" };

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "company.read")) return <Forbidden />;
  const { q } = await searchParams;
  const companies = await listCompanies(actor, { q: q?.slice(0, 100) || undefined });
  return (
    <div>
      <PageHeader title="Empresas" description="Empresas contratadas e fornecedores de serviço." actions={canAnywhere(actor, "company.manage") && <Link href="/empresas/nova" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Cadastrar empresa</Link>} />
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar</label>
        <input id="q" name="q" defaultValue={q} placeholder="Razão social, nome fantasia ou CNPJ" className="input max-w-sm" />
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Buscar</button>
      </form>
      {companies.length === 0 ? <EmptyState title="Nenhuma empresa encontrada" /> : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Empresa</th><th>CNPJ</th><th>Unidade</th><th>Contratos</th><th>Conferência</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/empresas/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.legalName}</Link>{c.tradeName && <span className="block text-xs text-slate-500">{c.tradeName}</span>}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{formatCnpj(c.cnpj)}</td>
                  <td>{c.unit.name}</td>
                  <td className="tabular-nums">{c._count.contracts}</td>
                  <td>{c.verification === "VERIFICADA_MANUALMENTE" ? <Badge tone="green">conferida manualmente</Badge> : <Badge tone="amber">não conferida</Badge>}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
