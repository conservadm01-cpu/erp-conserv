import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { EntityForm } from "@/components/ui/EntityForm";
import { companyFields } from "@/components/phase3/companyFields";

export const metadata: Metadata = { title: "Cadastrar empresa" };

export default async function NewCompanyPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "company.manage")) return <Forbidden />;
  const units = (await listOrgUnits(actor, { status: "ATIVA" })).filter((u) => can(actor, "company.manage", u.path));
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Cadastrar empresa" description="O CNPJ é validado pelos dígitos verificadores. A conferência em fonte oficial é registrada à parte, por quem a realizar." />
      <div className="card p-6">
        <EntityForm
          action="/api/companies"
          onDone="/empresas/:id"
          submitLabel="Cadastrar"
          fields={[
            { name: "cnpj", label: "CNPJ", required: true, maxLength: 18, placeholder: "00.000.000/0000-00" },
            { name: "unitId", label: "Unidade responsável", type: "select", required: true, options: units.map((u) => ({ value: u.id, label: `${"— ".repeat(u.depth)}${u.name}` })) },
            ...companyFields,
          ]}
        />
      </div>
    </div>
  );
}
