import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits, listOrgUnitTypes } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { OrgUnitForm } from "@/components/org/OrgUnitForm";

export const metadata: Metadata = { title: "Nova unidade" };

export default async function NewOrgUnitPage({ searchParams }: { searchParams: Promise<{ parentId?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "org.manage")) return <Forbidden />;
  const { parentId } = await searchParams;
  const [units, types] = await Promise.all([listOrgUnits(actor, { status: "ATIVA" }), listOrgUnitTypes()]);
  const parents = units
    .filter((u) => can(actor, "org.manage", u.path) && types.some((t) => t.allowedParentCodes.includes(u.typeCode)))
    .map(({ id, name, code, typeCode, depth }) => ({ id, name, code, typeCode, depth }));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nova unidade" />
      <div className="card p-6">
        <OrgUnitForm
          mode="create"
          parents={parents}
          types={types}
          initial={{
            code: "", name: "", typeCode: "", parentId: parents.some((p) => p.id === parentId) ? parentId! : "",
            street: "", number: "", complement: "", district: "", city: "", state: "", postalCode: "", contacts: [],
          }}
        />
      </div>
    </div>
  );
}
