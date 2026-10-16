import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { allPermissions, canAnywhere } from "@/server/authz/authorize";
import { listPermissionCatalog, listRoles } from "@/server/services/role.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { RoleMatrix } from "@/components/roles/RoleMatrix";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Papéis e permissões" };

export default async function PermissionsPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "role.read")) return <Forbidden />;
  const { roles, canManage } = await listRoles(actor);
  return (
    <div className="space-y-4">
      <PageHeader title="Papéis e permissões" description="Papéis agrupam permissões e são atribuídos aos usuários por unidade organizacional." />
      <Alert tone="info">
        Os papéis iniciais são uma proposta técnica de exemplo e não representam cargos ou alçadas oficiais. Ajuste-os conforme a definição formal dos responsáveis autorizados.
      </Alert>
      <RoleMatrix roles={roles} catalog={listPermissionCatalog()} canManage={canManage} held={[...allPermissions(actor)]} />
    </div>
  );
}
