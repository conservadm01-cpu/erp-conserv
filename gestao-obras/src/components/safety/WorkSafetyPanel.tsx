import Link from "next/link";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { EntityForm, Reveal } from "../ui/EntityForm";
import { ACTION_STATUS, criticalityTone, INCIDENT_TYPE, INSPECTION_STATUS, RISK_STATUS, opts } from "../phase3/labels";
import { formatDateTime, formatDay } from "@/lib/format";
import type { workSafetySummary } from "@/server/services/safety.service";

type Summary = Awaited<ReturnType<typeof workSafetySummary>>;

/** Aba de segurança da obra: inspeções, riscos, incidentes e ações corretivas. */
export function WorkSafetyPanel({ workId, s, activities }: { workId: string; s: Summary; activities: { code: string; name: string }[] }) {
  const levelOpts = s.levels.map((l) => ({ value: l.code, label: l.name }));
  const level = (c: string) => s.levels.find((l) => l.code === c)?.name ?? c;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Inspeções ({s.inspections.length})</h2>
          {s.can.inspect && (
            <Reveal label="Planejar inspeção">
              <EntityForm
                action="/api/safety/inspections"
                onDone="/seguranca/inspecoes/:id"
                fixed={{ workId }}
                initial={{ plannedDate: today, title: "Inspeção de segurança" }}
                fields={[
                  { name: "title", label: "Título", required: true, maxLength: 200 },
                  { name: "templateId", label: "Checklist", type: "select", options: s.templates.map((t) => ({ value: t.id, label: t.name })), hint: "Sem checklist, os itens são incluídos durante a inspeção." },
                  { name: "plannedDate", label: "Data", type: "date", required: true },
                  { name: "location", label: "Local", maxLength: 200 },
                ]}
              />
            </Reveal>
          )}
        </div>
        {s.inspections.length === 0 ? <EmptyState title="Nenhuma inspeção" /> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {s.inspections.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <Link href={`/seguranca/inspecoes/${i.id}`} className="text-brand-700 hover:underline">{i.title}</Link>
                <span className="text-xs text-slate-600">{formatDay(i.plannedDate)} · {INSPECTION_STATUS[i.status]} · {i._count.items} não conformidade(s)</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Ações corretivas ({s.actions.length})</h2>
          {s.can.act && (
            <Reveal label="Nova ação corretiva" variant="secondary">
              <EntityForm
                action="/api/safety/actions"
                fixed={{ workId }}
                fields={[
                  { name: "title", label: "Ação", required: true, maxLength: 200 },
                  { name: "criticality", label: "Criticidade", type: "select", required: true, options: levelOpts },
                  { name: "responsibleName", label: "Responsável", required: true, maxLength: 200 },
                  { name: "dueDate", label: "Prazo (vazio = padrão da criticidade)", type: "date" },
                  { name: "riskId", label: "Risco relacionado", type: "select", options: s.risks.map((r) => ({ value: r.id, label: r.title })) },
                  { name: "incidentId", label: "Incidente relacionado", type: "select", options: s.incidents.map((i) => ({ value: i.id, label: `${INCIDENT_TYPE[i.type]} — ${formatDateTime(i.occurredAt)}` })) },
                  { name: "description", label: "Descrição", type: "textarea", maxLength: 2000 },
                ]}
              />
            </Reveal>
          )}
        </div>
        {s.actions.length === 0 ? <EmptyState title="Nenhuma ação corretiva" /> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {s.actions.map((a) => {
              const late = ["ABERTA", "EM_ANDAMENTO"].includes(a.status) && a.dueDate.toISOString().slice(0, 10) < today;
              return (
                <li key={a.id} className="flex flex-col gap-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/seguranca/acoes/${a.id}`} className="text-brand-700 hover:underline">{a.title}</Link>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><Badge tone={criticalityTone(a.criticality)}>{level(a.criticality)}</Badge> prazo {formatDay(a.dueDate)}{late && <Badge tone="red">atrasada</Badge>} · {ACTION_STATUS[a.status]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Riscos ({s.risks.length})</h2>
          {s.can.inspect && (
            <Reveal label="Registrar risco" variant="secondary">
              <EntityForm
                action="/api/safety/risks"
                fixed={{ workId }}
                fields={[
                  { name: "title", label: "Risco", required: true, maxLength: 200 },
                  { name: "criticality", label: "Criticidade", type: "select", required: true, options: levelOpts },
                  { name: "activity", label: "Atividade", type: "select", options: activities.map((a) => ({ value: a.code, label: a.name })) },
                  { name: "description", label: "Descrição", type: "textarea", maxLength: 2000 },
                  { name: "controls", label: "Medidas de controle", type: "textarea", maxLength: 2000 },
                ]}
              />
            </Reveal>
          )}
        </div>
        {s.risks.length === 0 ? <EmptyState title="Nenhum risco registrado" /> : (
          <ul className="space-y-2 text-sm">
            {s.risks.map((r) => (
              <li key={r.id} className="card p-3">
                <p className="font-medium">{r.title} <Badge tone={criticalityTone(r.criticality)}>{level(r.criticality)}</Badge> <Badge>{RISK_STATUS[r.status]}</Badge></p>
                {r.controls && <p className="text-slate-700">Controles: {r.controls}</p>}
                {s.can.inspect && r.status !== "ENCERRADO" && (
                  <div className="mt-2">
                    <Reveal label="Atualizar" variant="secondary">
                      <EntityForm action={`/api/safety/risks/${r.id}`} method="PATCH" initial={{ controls: r.controls ?? "", status: r.status, criticality: r.criticality }} fields={[{ name: "controls", label: "Medidas de controle", type: "textarea", maxLength: 2000 }, { name: "criticality", label: "Criticidade", type: "select", required: true, options: levelOpts }, { name: "status", label: "Situação", type: "select", required: true, options: opts(RISK_STATUS) }]} />
                    </Reveal>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Incidentes e quase acidentes ({s.incidents.length})</h2>
          {s.can.inspect && (
            <Reveal label="Registrar ocorrência" variant="secondary">
              <EntityForm
                action="/api/safety/incidents"
                fixed={{ workId }}
                fields={[
                  { name: "type", label: "Tipo", type: "select", required: true, options: opts(INCIDENT_TYPE) },
                  { name: "occurredAt", label: "Data e hora", type: "datetime-local", required: true },
                  { name: "criticality", label: "Criticidade", type: "select", required: true, options: levelOpts },
                  { name: "location", label: "Local", maxLength: 200 },
                  { name: "description", label: "O que aconteceu (sem dados de saúde ou diagnósticos)", type: "textarea", required: true, maxLength: 4000 },
                  { name: "immediateActions", label: "Providências imediatas", type: "textarea", maxLength: 2000 },
                ]}
              />
            </Reveal>
          )}
        </div>
        {s.incidents.length === 0 ? <EmptyState title="Nenhuma ocorrência registrada" /> : (
          <ul className="space-y-2 text-sm">
            {s.incidents.map((i) => (
              <li key={i.id} className="card p-3">
                <p className="font-medium">{INCIDENT_TYPE[i.type]} · {formatDateTime(i.occurredAt)} <Badge tone={criticalityTone(i.criticality)}>{level(i.criticality)}</Badge></p>
                <p className="text-slate-700">{i.description}</p>
                {i.correctiveActions.length > 0 && <p className="text-xs text-slate-500">Ações: {i.correctiveActions.map((a) => a.title).join("; ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
