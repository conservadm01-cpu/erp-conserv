import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { listCompanies } from "@/server/services/company.service";
import { listWorkCatalogs } from "@/server/services/work.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { EntityForm } from "@/components/ui/EntityForm";
import { opts, PERSON_CATEGORY } from "@/components/phase3/labels";

export const metadata: Metadata = { title: "Cadastrar pessoa" };

export default async function NewPersonPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "person.manage")) return <Forbidden />;
  const { categoria } = await searchParams;
  const [units, companies, { activities }] = await Promise.all([listOrgUnits(actor, { status: "ATIVA" }), listCompanies(actor, { status: "ATIVO" }), listWorkCatalogs()]);
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Cadastrar pessoa" />
      <Alert tone="info">A categoria serve para organizar o cadastro e apoiar a avaliação jurídica do vínculo. Ela não dispensa obrigações legais aplicáveis.</Alert>
      <div className="card p-6">
        <EntityForm
          action="/api/people"
          onDone="/pessoas/:id"
          submitLabel="Cadastrar"
          initial={{ category: categoria && PERSON_CATEGORY[categoria] ? categoria : "" }}
          fields={[
            { name: "name", label: "Nome", required: true, maxLength: 200 },
            { name: "category", label: "Categoria", type: "select", required: true, options: opts(PERSON_CATEGORY) },
            { name: "bondDescription", label: "Descrição do vínculo (para “Outro vínculo”)", maxLength: 300 },
            { name: "unitId", label: "Unidade", type: "select", required: true, options: units.filter((u) => can(actor, "person.manage", u.path)).map((u) => ({ value: u.id, label: `${"— ".repeat(u.depth)}${u.name}` })) },
            { name: "jobFunction", label: "Função", maxLength: 120 },
            { name: "internalId", label: "Identificação interna (opcional)", maxLength: 60, hint: "Evite CPF ou RG se não houver finalidade definida." },
            { name: "email", label: "E-mail", type: "email", maxLength: 254 },
            { name: "phone", label: "Telefone", maxLength: 30 },
            { name: "companyId", label: "Empresa vinculada", type: "select", options: companies.map((c) => ({ value: c.id, label: c.legalName })) },
            { name: "authorizedActivities", label: "Atividades autorizadas", type: "multi", options: activities.map((a) => ({ value: a.code, label: a.name })), hint: "Atividades para as quais a pessoa tem qualificação registrada." },
          ]}
        />
      </div>
    </div>
  );
}
