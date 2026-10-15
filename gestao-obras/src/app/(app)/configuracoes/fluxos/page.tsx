import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listPolicies } from "@/server/services/approval.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { PolicyEditor } from "@/components/config/PolicyEditor";

export const metadata: Metadata = { title: "Fluxos e alçadas" };

export default async function PoliciesPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "approval.decide") && !canAnywhere(actor, "approval.policy.manage")) return <Forbidden />;
  const [policies, root] = await Promise.all([listPolicies(), getRootUnit()]);
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Fluxos e alçadas de aprovação" description="Quantidade de decisões e regras de segregação por tipo de aprovação." />
      <Alert tone="info">Os valores iniciais são técnicos e não representam alçadas oficiais. Defina-os conforme a decisão formal dos responsáveis autorizados. Limites por valor financeiro serão incluídos com o módulo de orçamento.</Alert>
      <PolicyEditor policies={policies} canManage={Boolean(root && can(actor, "approval.policy.manage", root.path))} />
    </div>
  );
}
