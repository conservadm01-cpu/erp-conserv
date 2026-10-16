import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { listWorkCatalogs } from "@/server/services/work.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { WorkForm } from "@/components/works/WorkForm";

export const metadata: Metadata = { title: "Nova obra" };

export default async function NewWorkPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "work.create")) return <Forbidden />;
  const [units, { types, activities }] = await Promise.all([listOrgUnits(actor, { status: "ATIVA" }), listWorkCatalogs()]);
  const options = units.filter((u) => can(actor, "work.create", u.path)).map((u) => ({ id: u.id, name: u.name, depth: u.depth }));
  return (
    <div className="max-w-4xl">
      <PageHeader title="Nova obra" description="A obra é criada como rascunho e recebe um código único. Depois, envie a solicitação para triagem." />
      <div className="card p-6">
        <WorkForm
          mode="create"
          scopeEditable
          units={options}
          types={types}
          activities={activities}
          initial={{ unitId: options.length === 1 ? options[0]!.id : "", title: "", typeCode: "", activities: [], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "", justification: "", street: "", number: "", district: "", city: "", state: "", postalCode: "", plannedStart: "", plannedEnd: "", responsibleName: "" }}
        />
      </div>
    </div>
  );
}
