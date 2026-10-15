import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listRequirementCatalogs, listRules } from "@/server/services/requirement.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { RuleEditor } from "@/components/config/RuleEditor";
import { serialize } from "@/lib/format";

export const metadata: Metadata = { title: "Regras documentais" };

export default async function RulesPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "requirement.read")) return <Forbidden />;
  const [rules, catalogs, root] = await Promise.all([listRules(actor), listRequirementCatalogs(), getRootUnit()]);
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title="Regras documentais" description="Matriz configurável de requisitos por tipo de obra, atividade e forma de execução." />
      <Alert tone="warning" title="As regras iniciais são pontos de partida">
        As regras de NR foram cadastradas como <strong>pendentes de confirmação</strong>, sem artigos, prazos ou exigências específicas. Antes de validar, confirme a redação vigente, a base legal e a aplicabilidade com responsável técnico ou jurídico. A lista não é exaustiva.
      </Alert>
      <RuleEditor
        rules={serialize(rules)}
        canManage={Boolean(root && can(actor, "requirement.manage", root.path))}
        workTypes={catalogs.workTypes}
        activities={catalogs.activities}
        categories={catalogs.categories}
      />
    </div>
  );
}
