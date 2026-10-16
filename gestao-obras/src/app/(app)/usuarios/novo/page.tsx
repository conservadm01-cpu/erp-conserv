import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { NewUserForm } from "@/components/users/NewUserForm";

export const metadata: Metadata = { title: "Novo usuário" };

export default async function NewUserPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "user.manage")) return <Forbidden />;
  const units = (await listOrgUnits(actor, { status: "ATIVA" }))
    .filter((u) => can(actor, "user.manage", u.path))
    .map((u) => ({ id: u.id, name: u.name, depth: u.depth }));
  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo usuário" />
      <div className="card p-6"><NewUserForm units={units} /></div>
    </div>
  );
}
