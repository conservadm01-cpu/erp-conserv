import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can } from "@/server/authz/authorize";
import { listSettings } from "@/server/services/settings.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { SettingsEditor } from "@/components/config/SettingsEditor";
import { serialize } from "@/lib/format";

export const metadata: Metadata = { title: "Parâmetros" };

export default async function SettingsPage() {
  const actor = await requirePageActor();
  const root = await getRootUnit();
  if (!root || !can(actor, "settings.manage", root.path)) return <Forbidden />;
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Parâmetros do sistema" description="Valores operacionais usados por alertas e rotinas diárias. Cada alteração é registrada na auditoria." />
      <Alert tone="info">Os valores iniciais são técnicos. Prazos legais devem ser confirmados por quem responde pela proteção de dados antes de serem adotados.</Alert>
      <SettingsEditor settings={serialize(await listSettings())} canManage />
    </div>
  );
}
