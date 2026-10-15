import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor, pageMeta } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { auditQuerySchema, listAuditEvents } from "@/server/services/audit.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { VerifyChainButton } from "@/components/audit/VerifyChainButton";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

type SP = Record<string, string | undefined>;

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "audit.read")) return <Forbidden />;
  const sp = await searchParams;
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as SP;
  const parsed = auditQuerySchema.safeParse(clean);
  if (!parsed.success) return <Alert tone="error">Filtros inválidos. <Link href="/auditoria" className="underline">Limpar filtros</Link></Alert>;
  const q = parsed.data;
  const [data, root] = await Promise.all([listAuditEvents(actor, q, await pageMeta()), getRootUnit()]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const link = (page: number) => `/auditoria?${new URLSearchParams({ ...clean, page: String(page) } as Record<string, string>).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoria"
        description="Trilha somente inclusão, encadeada por hash. Registros não podem ser editados ou excluídos."
        actions={root && can(actor, "audit.read", root.path) ? <VerifyChainButton /> : undefined}
      />
      <form className="grid grid-cols-1 gap-2 sm:grid-cols-6" role="search">
        <div><label className="label" htmlFor="action">Ação (prefixo)</label><input id="action" name="action" defaultValue={q.action} className="input" placeholder="auth.login" /></div>
        <div><label className="label" htmlFor="actor">Ator</label><input id="actor" name="actor" defaultValue={q.actor} className="input" /></div>
        <div>
          <label className="label" htmlFor="result">Resultado</label>
          <select id="result" name="result" defaultValue={q.result ?? ""} className="input">
            <option value="">Todos</option><option value="SUCESSO">Sucesso</option><option value="FALHA">Falha</option><option value="NEGADO">Negado</option>
          </select>
        </div>
        <div><label className="label" htmlFor="from">De</label><input id="from" name="from" type="date" defaultValue={sp.from} className="input" /></div>
        <div><label className="label" htmlFor="to">Até</label><input id="to" name="to" type="date" defaultValue={sp.to} className="input" /></div>
        <div className="flex items-end"><button className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button></div>
      </form>
      {data.events.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado" />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Nº</th><th>Data/hora</th><th>Ação</th><th>Ator</th><th>Objeto</th><th>Resultado</th><th>Correlação</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{e.seq}</td>
                    <td className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</td>
                    <td>
                      <span className="font-mono text-xs">{e.action}</span>
                      {e.metadata && (
                        <details className="mt-1 text-xs text-slate-600">
                          <summary className="cursor-pointer">detalhes</summary>
                          <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2">{JSON.stringify(e.metadata, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                    <td>{e.actorLabel ?? "—"}</td>
                    <td className="text-xs">{e.objectType ? `${e.objectType} ${e.objectId?.slice(0, 8) ?? ""}` : "—"}</td>
                    <td><StatusBadge status={e.result} /></td>
                    <td className="font-mono text-xs">{e.correlationId.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
            <span>{data.total.toLocaleString("pt-BR")} eventos · página {data.page} de {pages}</span>
            <span className="flex gap-2">
              {data.page > 1 && <Link className="rounded-md border border-slate-300 bg-white px-3 py-1" href={link(data.page - 1)}>Anterior</Link>}
              {data.page < pages && <Link className="rounded-md border border-slate-300 bg-white px-3 py-1" href={link(data.page + 1)}>Próxima</Link>}
            </span>
          </nav>
        </>
      )}
    </div>
  );
}
