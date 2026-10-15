import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listPolicies, listTiers } from "@/server/services/approval.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { PolicyEditor } from "@/components/config/PolicyEditor";
import { TierEditor } from "@/components/config/TierEditor";

export const metadata: Metadata = { title: "Fluxos e alçadas" };

export default async function PoliciesPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "approval.decide") && !canAnywhere(actor, "approval.policy.manage")) return <Forbidden />;
  const [policies, root, tiers] = await Promise.all([listPolicies(), getRootUnit(), listTiers()]);
  const canManage = Boolean(root && can(actor, "approval.policy.manage", root.path));
  const valued = policies.filter((p) => ["ORCAMENTO", "MEDICAO", "DESPESA"].includes(p.kind));
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Fluxos e alçadas de aprovação" description="Quantidade de decisões e regras de segregação por tipo de aprovação." />
      <Alert tone="info">Os valores iniciais são técnicos e não representam alçadas oficiais. Defina-os conforme a decisão formal dos responsáveis autorizados. Não há limites financeiros pré-definidos.</Alert>
      <PolicyEditor policies={policies} canManage={canManage} />
      <section className="space-y-3 pt-4" aria-labelledby="faixas">
        <h2 id="faixas" className="text-lg font-semibold">Alçadas por valor</h2>
        <p className="text-sm text-slate-600">Opcional. Quando houver faixas, a quantidade de decisões passa a depender do valor da solicitação; a segregação de funções do fluxo continua valendo.</p>
        <TierEditor kinds={valued.map((p) => ({ kind: p.kind, name: p.name }))} tiers={tiers.map((t) => ({ kind: t.kind, upToAmount: t.upToAmount?.toString() ?? null, stepsRequired: t.stepsRequired }))} canManage={canManage} />
      </section>
    </div>
  );
}
