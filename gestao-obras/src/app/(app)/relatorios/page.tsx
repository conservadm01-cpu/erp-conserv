import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { REPORTS } from "@/server/services/reports-extra.service";
import { listWorks } from "@/server/services/work.service";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { ReportCatalog } from "@/components/phase4/ReportCatalog";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "report.generate")) return <Forbidden />;
  const reports = [
    { type: "dossie", title: "Dossiê da obra", scope: "obra" as const },
    ...Object.entries(REPORTS).filter(([, d]) => canAnywhere(actor, d.permission)).map(([type, d]) => ({ type, title: d.title, scope: d.scope })),
  ];
  const [works, units] = await Promise.all([listWorks(actor), canAnywhere(actor, "org.read") ? listOrgUnits(actor, { status: "ATIVA" }) : Promise.resolve([])]);
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader title="Relatórios" description="Relatórios em PDF gerados com os dados do seu escopo de acesso. Cada geração é registrada na auditoria." />
      <Alert tone="info">Os relatórios são documentos gerenciais: não contêm assinatura e não substituem documentos formalmente assinados.</Alert>
      <ReportCatalog reports={reports} works={works.map((w) => ({ id: w.id, label: `${w.code} — ${w.title}` }))} units={units.map((u) => ({ id: u.id, name: u.name }))} />
    </div>
  );
}
