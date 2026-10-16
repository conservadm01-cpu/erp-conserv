import type { Metadata } from "next";
import { requirePageActor } from "@/server/auth/page-context";
import { can, canAnywhere } from "@/server/authz/authorize";
import { listChecklists, listCriticality } from "@/server/services/safety.service";
import { getRootUnit } from "@/server/services/org-unit.service";
import { listWorkCatalogs } from "@/server/services/work.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EntityForm, Reveal } from "@/components/ui/EntityForm";
import { ChecklistEditor } from "@/components/safety/ChecklistEditor";

export const metadata: Metadata = { title: "Configuração de segurança" };

export default async function SafetyConfigPage() {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "safety.read")) return <Forbidden />;
  const [levels, checklists, root, { types }] = await Promise.all([listCriticality(), listChecklists(actor), getRootUnit(), listWorkCatalogs()]);
  const canManage = Boolean(root && can(actor, "safety.config", root.path));
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Configuração de segurança" description="Critérios de criticidade e modelos de checklist." />
      <Alert tone="info">Os valores iniciais são técnicos e não representam política oficial. Ajuste prazos, alertas e bloqueios conforme a decisão dos responsáveis técnicos.</Alert>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Critérios de criticidade</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {levels.map((l) => (
            <div key={l.code} className="card space-y-2 p-4 text-sm">
              <p className="font-medium">{l.name} <span className="font-mono text-xs text-slate-500">{l.code}</span></p>
              <p>Prazo padrão da ação: {l.responseDays} dia(s) {l.priorityAlert && <Badge tone="amber">alerta prioritário</Badge>} {l.blocksProgress && <Badge tone="red">bloqueia avanço</Badge>}</p>
              {canManage && (
                <Reveal label="Editar" variant="secondary">
                  <EntityForm
                    action={`/api/safety/criticality/${l.code}`}
                    method="PUT"
                    initial={{ name: l.name, responseDays: String(l.responseDays), priorityAlert: l.priorityAlert, blocksProgress: l.blocksProgress }}
                    fields={[
                      { name: "name", label: "Nome", required: true, maxLength: 60 },
                      { name: "responseDays", label: "Prazo padrão (dias)", type: "number", required: true },
                      { name: "priorityAlert", label: "Gerar alerta prioritário", type: "checkbox" },
                      { name: "blocksProgress", label: "Ações abertas bloqueiam o avanço da obra", type: "checkbox" },
                    ]}
                  />
                </Reveal>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Checklists</h2>
        <ChecklistEditor checklists={checklists} levels={levels.map((l) => ({ code: l.code, name: l.name }))} workTypes={types.map((t) => ({ code: t.code, name: t.name }))} canManage={canManage} />
      </section>
    </div>
  );
}
