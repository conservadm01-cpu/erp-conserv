import { Badge } from "../ui/Badge";
import { EntityForm, Reveal } from "../ui/EntityForm";
import { MILESTONE_KIND, STAGE_STATUS } from "../works/labels";
import { opts } from "../phase3/labels";
import { formatDateTime, formatDay, toInputDate } from "@/lib/format";
import type { getSchedule } from "@/server/services/schedule.service";

type S = Awaited<ReturnType<typeof getSchedule>>;
type Snap = { etapas?: { id: string; inicio: string; termino: string }[] };
const DAY = 86_400_000;

/** Gráfico de Gantt simples: barra prevista, barra realizada e marcação da linha de base. */
export function SchedulePanel({ workId, s }: { workId: string; s: S }) {
  const today = new Date();
  const base = s.baselines[0]?.snapshot as Snap | undefined;
  const dates = [
    ...s.stages.flatMap((x) => [x.plannedStart, x.plannedEnd, x.actualStart, x.actualEnd]),
    ...s.milestones.flatMap((m) => [m.plannedDate, m.actualDate]),
    ...(base?.etapas ?? []).flatMap((e) => [new Date(e.inicio), new Date(e.termino)]),
  ].filter(Boolean) as Date[];
  const min = dates.length ? Math.min(...dates.map((d) => d.getTime())) : today.getTime();
  const max = dates.length ? Math.max(...dates.map((d) => d.getTime()), min + DAY) : today.getTime() + 30 * DAY;
  const span = max - min + DAY;
  const pos = (d: Date) => `${((d.getTime() - min) / span) * 100}%`;
  const width = (a: Date, b: Date) => `${Math.max(((b.getTime() - a.getTime() + DAY) / span) * 100, 0.8)}%`;
  const stageName = (id: string) => s.stages.find((x) => x.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded bg-brand-500/70" /> previsto</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-1.5 w-5 rounded bg-green-600" /> realizado</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-slate-900" /> fim na linha de base{s.baselines[0] ? ` v${s.baselines[0].version}` : " (não definida)"}</span>
          <span>{formatDay(new Date(min))} a {formatDay(new Date(max))}</span>
        </div>
        {s.stages.length === 0 ? <p className="text-sm text-slate-500">Cadastre etapas na lista abaixo para visualizar o cronograma.</p> : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              {s.stages.map((st) => {
                const b = base?.etapas?.find((e) => e.id === st.id);
                const late = st.plannedEnd && st.plannedEnd < today && ["NAO_INICIADA", "EM_ANDAMENTO"].includes(st.status);
                return (
                  <div key={st.id} className="grid grid-cols-[12rem_1fr] items-center gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{st.name}</p>
                      <p className="text-xs text-slate-500">{STAGE_STATUS[st.status]} · {st.progress}%{late && " · atrasada"}</p>
                    </div>
                    <div className="relative h-7 rounded bg-slate-50">
                      {st.plannedStart && st.plannedEnd && <span className={`absolute top-1 h-3 rounded ${late ? "bg-red-400/80" : "bg-brand-500/70"}`} style={{ left: pos(st.plannedStart), width: width(st.plannedStart, st.plannedEnd) }} title={`Previsto: ${formatDay(st.plannedStart)} a ${formatDay(st.plannedEnd)}`} />}
                      {st.actualStart && <span className="absolute bottom-1 h-1.5 rounded bg-green-600" style={{ left: pos(st.actualStart), width: width(st.actualStart, st.actualEnd ?? today) }} title={`Realizado: ${formatDay(st.actualStart)} a ${st.actualEnd ? formatDay(st.actualEnd) : "em andamento"}`} />}
                      {b && <span className="absolute top-0 h-7 w-0.5 bg-slate-900" style={{ left: pos(new Date(b.termino)) }} title={`Linha de base: término ${formatDay(new Date(b.termino))}`} />}
                    </div>
                  </div>
                );
              })}
              {s.milestones.map((m) => (
                <div key={m.id} className="grid grid-cols-[12rem_1fr] items-center gap-3 text-sm">
                  <p className="truncate text-slate-700">◆ {m.name}</p>
                  <div className="relative h-5">
                    <span className={`absolute top-0.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 ${m.actualDate ? "bg-green-600" : m.plannedDate < today ? "bg-red-500" : "bg-amber-500"}`} style={{ left: pos(m.plannedDate) }} title={`${MILESTONE_KIND[m.kind]}: ${formatDay(m.plannedDate)}`} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[12rem_1fr] gap-3"><span /><div className="relative h-4 text-[10px] text-slate-500"><span className="absolute h-4 w-px bg-red-500" style={{ left: pos(today) }} /><span className="absolute -translate-x-1/2" style={{ left: pos(today), top: 0 }}>hoje</span></div></div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Dependências e justificativas de atraso</h2>
        <ul className="space-y-2">
          {s.stages.map((st) => (
            <li key={st.id} className="card flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">{st.name}</p>
                <p className="text-xs text-slate-500">Depende de: {st.dependsOnIds.length ? st.dependsOnIds.map(stageName).join(", ") : "nenhuma"}</p>
                {st.delayReason && <p className="text-xs text-amber-800">Atraso: {st.delayReason}</p>}
              </div>
              {s.canEdit && (
                <Reveal label="Editar" variant="secondary">
                  <EntityForm
                    action={`/api/works/${workId}/stages/${st.id}/schedule`}
                    method="PATCH"
                    initial={{ dependsOnIds: st.dependsOnIds, delayReason: st.delayReason ?? "" }}
                    fields={[
                      { name: "dependsOnIds", label: "Depende das etapas", type: "multi", options: s.stages.filter((x) => x.id !== st.id).map((x) => ({ value: x.id, label: x.name })) },
                      { name: "delayReason", label: "Justificativa de atraso", type: "textarea", maxLength: 1000 },
                    ]}
                  />
                </Reveal>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Marcos ({s.milestones.length})</h2>
          {s.canEdit && (
            <Reveal label="Novo marco" variant="secondary">
              <EntityForm action={`/api/works/${workId}/milestones`} initial={{ kind: "MARCO" }} fields={[{ name: "name", label: "Marco", required: true, maxLength: 200 }, { name: "kind", label: "Tipo", type: "select", required: true, options: opts(MILESTONE_KIND) }, { name: "plannedDate", label: "Data prevista", type: "date", required: true }, { name: "actualDate", label: "Data realizada", type: "date" }, { name: "notes", label: "Observações", type: "textarea", maxLength: 1000 }]} />
            </Reveal>
          )}
        </div>
        {s.milestones.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {s.milestones.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{m.name} <Badge>{MILESTONE_KIND[m.kind]}</Badge> · previsto {formatDay(m.plannedDate)} · {m.actualDate ? `realizado ${formatDay(m.actualDate)}` : "pendente"}</span>
                {s.canEdit && (
                  <Reveal label="Atualizar" variant="secondary">
                    <EntityForm action={`/api/works/${workId}/milestones/${m.id}`} method="PUT" initial={{ name: m.name, kind: m.kind, plannedDate: toInputDate(m.plannedDate), actualDate: toInputDate(m.actualDate), notes: m.notes ?? "" }} fields={[{ name: "name", label: "Marco", required: true }, { name: "kind", label: "Tipo", type: "select", required: true, options: opts(MILESTONE_KIND) }, { name: "plannedDate", label: "Data prevista", type: "date", required: true }, { name: "actualDate", label: "Data realizada", type: "date" }, { name: "notes", label: "Observações", type: "textarea" }]} />
                  </Reveal>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Linhas de base e revisões</h2>
          {s.canEdit && (
            <Reveal label="Definir nova linha de base" variant="secondary">
              <EntityForm action={`/api/works/${workId}/baselines`} submitLabel="Congelar cronograma atual" fields={[{ name: "reason", label: "Motivo (planejamento inicial, revisão aprovada etc.)", type: "textarea", required: true, maxLength: 1000 }]} />
            </Reveal>
          )}
        </div>
        {s.baselines.length === 0 ? <p className="text-sm text-slate-500">Nenhuma linha de base definida.</p> : (
          <ul className="space-y-1 text-sm">
            {s.baselines.map((b) => <li key={b.id}>v{b.version} · {formatDateTime(b.createdAt)} · {s.people[b.createdById] ?? "—"} — {b.reason}</li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
