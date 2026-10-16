import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { listUsers } from "@/server/services/user.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, StatusBadge } from "@/components/ui/Badge";

export const metadata: Metadata = { title: "Usuários" };

const STATUSES = ["ATIVO", "BLOQUEADO", "INATIVO"] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "user.read")) return <Forbidden />;
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.slice(0, 100) || undefined;
  const users = await listUsers(actor, { q, status });

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Usuários lotados nas unidades do seu escopo."
        actions={canAnywhere(actor, "user.manage") && <Link href="/usuarios/novo" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Novo usuário</Link>}
      />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <label className="sr-only" htmlFor="q">Buscar</label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" className="input sm:max-w-xs" />
        <label className="sr-only" htmlFor="status">Situação</label>
        <select id="status" name="status" defaultValue={status ?? ""} className="input sm:max-w-[10rem]">
          <option value="">Todas</option>
          <option value="ATIVO">Ativos</option>
          <option value="BLOQUEADO">Bloqueados</option>
          <option value="INATIVO">Inativos</option>
        </select>
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button>
      </form>
      {users.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado" description={q || status ? "Ajuste os filtros da busca." : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Lotação</th><th>MFA</th><th>Papéis</th><th>Situação</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td><Link href={`/usuarios/${u.id}`} className="font-medium text-brand-700 hover:underline">{u.name}</Link></td>
                  <td>{u.email}</td>
                  <td>{u.homeUnit.name}</td>
                  <td>{u.mfaEnabledAt ? <Badge tone="green">Ativo</Badge> : <Badge tone="amber">Não</Badge>}</td>
                  <td>{u._count.scopes}</td>
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
