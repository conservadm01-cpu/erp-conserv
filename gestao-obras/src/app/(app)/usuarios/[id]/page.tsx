import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere, permissionsAt } from "@/server/authz/authorize";
import { getUser } from "@/server/services/user.service";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { listAssignableRoles } from "@/server/services/role.service";
import { orNotFound } from "@/server/http/page-guard";
import { uuid } from "@/server/validation/common";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { UserAdmin } from "@/components/users/UserAdmin";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Usuário" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const user = await orNotFound(() => getUser(actor, id));
  const manageable = canAnywhere(actor, "user.manage");
  const [units, roles] = manageable
    ? await Promise.all([listOrgUnits(actor, { status: "ATIVA" }), listAssignableRoles(actor)])
    : [[], []];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {user.email} · lotação: {user.homeUnit.name} · <StatusBadge status={user.status} />
            {user.mfaEnabledAt ? <Badge tone="green">MFA ativo</Badge> : <Badge tone="amber">Sem MFA</Badge>}
            {user.mustChangePassword && <Badge tone="amber">Troca de senha pendente</Badge>}
          </span>
        }
      />
      {user.id === actor.userId && <Alert tone="info">Por segregação de funções, os seus próprios acessos devem ser alterados por outro administrador.</Alert>}
      <UserAdmin
        user={{ id: user.id, name: user.name, email: user.email, status: user.status, homeUnitId: user.homeUnitId, mfaEnabled: Boolean(user.mfaEnabledAt), canManage: user.canManage }}
        scopes={user.scopes.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        units={units.filter((u) => can(actor, "user.manage", u.path)).map((u) => ({ id: u.id, name: u.name, depth: u.depth, held: [...permissionsAt(actor, u.path)] }))}
        roles={roles}
      />
      <p className="text-xs text-slate-500">Último acesso: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "nunca"} · Cadastro: {formatDate(user.createdAt)}</p>
    </div>
  );
}
