import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { canAnywhere } from "@/server/authz/authorize";
import { AGENDA_KIND, agendaFormOptions, listAgenda, monthRange, type AgendaItem } from "@/server/services/agenda.service";
import { listOrgUnits } from "@/server/services/org-unit.service";
import { agendaQuery } from "@/server/validation/agenda";
import { PageHeader } from "@/components/ui/PageHeader";
import { Forbidden } from "@/components/Forbidden";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionButton, EntityForm, Reveal } from "@/components/ui/EntityForm";
import { RegionSelect } from "@/components/filters/RegionSelect";
import { opts } from "@/components/phase3/labels";

export const metadata: Metadata = { title: "Agenda de obras" };

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Dia (AAAA-MM-DD) em Brasília; itens de dia inteiro vêm de colunas DATE (UTC). */
const dayKey = (i: AgendaItem) => (i.allDay ? i.startsAt.toISOString().slice(0, 10) : new Date(i.startsAt.getTime() - 3 * 3_600_000).toISOString().slice(0, 10));
const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const TONE: Record<AgendaItem["source"], "blue" | "amber" | "green" | "slate"> = { evento: "blue", etapa: "slate", marco: "green", inspecao: "amber" };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor();
  if (!canAnywhere(actor, "agenda.read")) return <Forbidden />;
  const sp = await searchParams;
  const parsed = agendaQuery.safeParse(Object.fromEntries(Object.entries(sp).filter(([, v]) => v)));
  const q = parsed.success ? parsed.data : {};
  const { from, to, mes } = monthRange(q.mes);
  const [items, units, options] = await Promise.all([listAgenda(actor, { unitId: q.unitId, from, to }), listOrgUnits(actor, { status: "ATIVA" }), agendaFormOptions(actor)]);

  const [y, m] = mes.split("-").map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const link = (mm: string) => `/agenda?mes=${mm}${q.unitId ? `&unitId=${q.unitId}` : ""}`;
  const byDay = new Map<string, AgendaItem[]>();
  for (const i of items) byDay.set(dayKey(i), [...(byDay.get(dayKey(i)) ?? []), i]);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const key = (d: number) => `${mes}-${String(d).padStart(2, "0")}`;
  const unitName = q.unitId ? units.find((u) => u.id === q.unitId)?.name : null;

  return (
    <div className="max-w-6xl space-y-5">
      <PageHeader
        title="Agenda de obras"
        description={`Compromissos das unidades locais${unitName ? ` — ${unitName}` : " do seu escopo"}, com etapas, marcos e inspeções previstas nas obras. Horários de Brasília.`}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form className="flex flex-wrap items-end gap-2" role="search">
          <input type="hidden" name="mes" value={mes} />
          <RegionSelect units={units} value={q.unitId} />
          {units.length > 1 && <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Filtrar</button>}
        </form>
        <nav aria-label="Mês" className="flex items-center gap-2">
          <Link href={link(prev)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50" aria-label="Mês anterior">‹</Link>
          <span className="min-w-36 text-center font-semibold capitalize">{MONTHS[m - 1]} de {y}</span>
          <Link href={link(next)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50" aria-label="Próximo mês">›</Link>
        </nav>
      </div>

      {options.units.length > 0 && (
        <Reveal label="Novo compromisso">
          <EntityForm
            action="/api/agenda"
            submitLabel="Agendar"
            successMessage="Compromisso agendado."
            initial={{ unitId: q.unitId && options.units.some((u) => u.id === q.unitId) ? q.unitId : options.units.length === 1 ? options.units[0]!.id : "", date: `${mes}-${today.slice(0, 7) === mes ? today.slice(8) : "01"}`, startTime: "08:00" }}
            fields={[
              { name: "unitId", label: "Unidade local", type: "select", required: true, options: options.units.map((u) => ({ value: u.id, label: u.name })) },
              { name: "kind", label: "Tipo", type: "select", required: true, options: opts(AGENDA_KIND) },
              { name: "title", label: "Título", required: true, maxLength: 200, span: 2, placeholder: "Ex.: Mutirão de pintura do salão" },
              { name: "workId", label: "Obra (opcional; precisa ser da unidade)", type: "select", span: 2, options: options.works.map((w) => ({ value: w.id, label: `${w.code} — ${w.title} (${options.units.find((u) => u.id === w.unitId)?.name ?? ""})` })) },
              { name: "date", label: "Data", type: "date", required: true },
              { name: "startTime", label: "Início", type: "time", required: true },
              { name: "endTime", label: "Término", type: "time" },
              { name: "slots", label: "Vagas para voluntários", type: "number" },
              { name: "location", label: "Local", maxLength: 200, span: 2 },
              { name: "notes", label: "Orientações (o que levar, EPIs, ponto de encontro)", type: "textarea", maxLength: 2000 },
            ]}
          />
        </Reveal>
      )}

      <section aria-label="Calendário do mês" className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstWeekday }, (_, i) => <div key={`v${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/50" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const list = byDay.get(key(d)) ?? [];
            return (
              <div key={d} className={`min-h-24 min-w-0 border-b border-r border-slate-100 p-1.5 ${key(d) === today ? "bg-brand-50" : ""}`}>
                <a href={`#dia-${key(d)}`} className={`text-xs font-semibold ${key(d) === today ? "text-brand-700" : "text-slate-600"}`}>{d}</a>
                <ul className="mt-1 space-y-0.5">
                  {list.slice(0, 3).map((it) => (
                    <li key={it.id} className={`truncate rounded px-1 text-[11px] ${it.status === "CANCELADO" ? "text-slate-400 line-through" : it.source === "evento" ? "bg-brand-100 text-brand-900" : it.source === "inspecao" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`} title={it.title}>
                      {!it.allDay && `${hhmm(it.startsAt)} `}{it.title}
                    </li>
                  ))}
                  {list.length > 3 && <li className="text-[11px] text-slate-500">+{list.length - 3}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="lista" className="space-y-3">
        <h2 id="lista" className="text-sm font-semibold text-slate-700">Compromissos do mês ({items.length})</h2>
        {items.length === 0 ? (
          <EmptyState title="Nada agendado neste mês" description={options.units.length ? "Use “Novo compromisso” para agendar mutirões, visitas e entregas." : undefined} />
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <div key={day} id={`dia-${day}`} className="card scroll-mt-20 p-4">
              <h3 className="mb-2 text-sm font-semibold">{new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" })}</h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {list.map((it) => (
                  <li key={it.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className={`font-medium ${it.status === "CANCELADO" ? "text-slate-400 line-through" : ""}`}>
                        {it.allDay ? "Dia todo" : `${hhmm(it.startsAt)}${it.endsAt ? `–${hhmm(it.endsAt)}` : ""}`} · {it.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        <Badge tone={TONE[it.source]}>{it.kind}</Badge> {it.unitName}
                        {it.work && <> · <Link href={`/obras/${it.work.id}`} className="text-brand-700 hover:underline">{it.work.code}</Link></>}
                        {it.location ? ` · ${it.location}` : ""}{it.slots ? ` · ${it.slots} vagas` : ""}
                      </p>
                      {it.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-600">{it.notes}</p>}
                      {it.source === "evento" && it.status !== "AGENDADO" && <p className="mt-1 text-xs">{it.status === "REALIZADO" ? <Badge tone="green">realizado</Badge> : <Badge>cancelado</Badge>} {it.statusReason}</p>}
                    </div>
                    {it.canManage && it.status === "AGENDADO" && (
                      <div className="flex flex-wrap gap-2">
                        <ActionButton label="Marcar como realizado" method="PATCH" action={`/api/agenda/${it.id}`} body={{ status: "REALIZADO" }} />
                        <Reveal label="Cancelar" variant="ghost">
                          <EntityForm action={`/api/agenda/${it.id}`} method="PATCH" submitLabel="Confirmar cancelamento" fixed={{ status: "CANCELADO" }} fields={[{ name: "reason", label: "Motivo", required: true, maxLength: 1000, span: 2 }]} />
                        </Reveal>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
