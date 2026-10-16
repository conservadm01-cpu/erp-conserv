import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listCategories, searchDocuments } from "@/server/services/document.service";
import { documentSearchQuery } from "@/server/validation/document";
import { ownerInfo } from "@/server/services/document.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocStatusBadge } from "@/components/works/StatusBadges";
import { DOC_STATUS } from "@/components/works/labels";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Documentos" };

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "document.read")) return <Forbidden />;
  const sp = await searchParams;
  const parsed = documentSearchQuery.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : {};
  const [docs, categories] = await Promise.all([searchDocuments(actor, q), listCategories()]);
  return (
    <div>
      <PageHeader title="Documentos" description="Repositório documental das obras do seu escopo. Para enviar ou baixar arquivos, abra a obra." />
      <form className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-5" role="search">
        <div className="sm:col-span-2"><label className="label" htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={q.q} placeholder="Título, número ou código da obra" className="input" /></div>
        <div>
          <label className="label" htmlFor="status">Situação</label>
          <select id="status" name="status" defaultValue={q.status ?? ""} className="input">
            <option value="">Todas</option>
            {Object.entries(DOC_STATUS).filter(([k]) => k !== "SUBSTITUIDO").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="categoryCode">Categoria</label>
          <select id="categoryCode" name="categoryCode" defaultValue={q.categoryCode ?? ""} className="input">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button>
        </div>
      </form>
      <p className="mb-3 text-sm"><Link href="/documentos?expiring=30" className="text-brand-700 hover:underline">Ver documentos que vencem em até 30 dias</Link>{q.expiring && <> · <Link href="/documentos" className="text-brand-700 hover:underline">limpar</Link></>}</p>
      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento encontrado" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Documento</th><th>Vinculado a</th><th>Categoria</th><th>Versão</th><th>Validade</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.title}{d.documentNumber ? <span className="block text-xs text-slate-500">nº {d.documentNumber}</span> : null}</td>
                  <td><span className="block text-xs text-slate-500">{ownerInfo(d).kind}</span><Link href={ownerInfo(d).href} className="text-brand-700 hover:underline">{ownerInfo(d).label}</Link></td>
                  <td>{d.category.name}</td>
                  <td>v{d.versions[0]?.versionNo ?? "—"}</td>
                  <td className="whitespace-nowrap">{formatDay(d.expiryDate)}</td>
                  <td><DocStatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
