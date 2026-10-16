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
import { listPersonRules } from "@/server/services/health.service";
import { PersonRulesPanel } from "@/components/config/PersonRulesPanel";

export const metadata: Metadata = { title: "Regras documentais" };

export default async function RulesPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "requirement.read")) return <Forbidden />;
  const [rules, catalogs, root, personRules] = await Promise.all([listRules(actor), listRequirementCatalogs(), getRootUnit(), listPersonRules(actor)]);
  const canManage = Boolean(root && can(actor, "requirement.manage", root.path));
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title="Regras documentais" description="Matriz configurável de requisitos por tipo de obra, atividade e forma de execução." />
      <Alert tone="warning" title="As regras iniciais são pontos de partida">
        As regras de NR foram cadastradas como <strong>pendentes de confirmação</strong>, sem artigos, prazos ou exigências específicas. Antes de validar, confirme a redação vigente, a base legal e a aplicabilidade com responsável técnico ou jurídico. A lista não é exaustiva.
      </Alert>
      <RuleEditor
        rules={serialize(rules)}
        canManage={canManage}
        workTypes={catalogs.workTypes}
        activities={catalogs.activities}
        categories={catalogs.categories}
      />
      <section className="space-y-3 pt-4" aria-labelledby="pessoas">
        <h2 id="pessoas" className="text-lg font-semibold">Exigências para as pessoas, por atividade</h2>
        <p className="text-sm text-slate-600">Treinamentos e ASO que quem executa cada atividade deve ter. Enquanto pendentes de validação, apenas geram avisos; validadas e marcadas para impedir, bloqueiam o vínculo de quem não atende.</p>
        <PersonRulesPanel rules={personRules} canManage={canManage} />
      </section>
    </div>
  );
}
