import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, canOnWork, pathWhere, workScopedWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { agendaEventSchema, agendaStatusSchema } from "../validation/agenda";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export const AGENDA_KIND: Record<string, string> = {
  MUTIRAO: "Mutirão", VISITA_TECNICA: "Visita técnica", ENTREGA_MATERIAL: "Entrega de material", REUNIAO: "Reunião",
  INSPECAO: "Inspeção", INTEGRACAO_SEGURANCA: "Integração de segurança", OUTRO: "Outro",
};

export type AgendaItem = {
  id: string;
  source: "evento" | "etapa" | "marco" | "inspecao";
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  unitName: string;
  work: { id: string; code: string } | null;
  status: string;
  location: string | null;
  notes: string | null;
  slots: number | null;
  statusReason: string | null;
  canManage: boolean;
};

/** Mês no fuso de Brasília: [início, fim). */
export function monthRange(mes?: string) {
  const now = new Date(Date.now() - 3 * 3_600_000);
  const [y, m] = mes ? mes.split("-").map(Number) as [number, number] : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const from = new Date(Date.UTC(y, m - 1, 1, 3));
  const to = new Date(Date.UTC(y, m, 1, 3));
  return { from, to, mes: `${y}-${String(m).padStart(2, "0")}` };
}

/**
 * Agenda das unidades no escopo do ator: compromissos cadastrados e, para quem pode ver
 * as obras, datas previstas de etapas, marcos e inspeções planejadas.
 */
export async function listAgenda(actor: Actor, q: { unitId?: string; from: Date; to: Date }): Promise<AgendaItem[]> {
  const scope = pathWhere(actor, "agenda.read", "unitPath");
  if (!scope) return [];
  const unit = q.unitId ? await prisma.organizationUnit.findUnique({ where: { id: q.unitId }, select: { path: true } }) : null;
  const unitFilter = q.unitId ? { unitPath: { startsWith: unit?.path ?? "#inexistente" } } : {};
  const dayFrom = new Date(q.from.getTime() - 3 * 3_600_000);
  const dayTo = new Date(q.to.getTime());

  const events = await prisma.agendaEvent.findMany({
    where: { AND: [scope, unitFilter, { startsAt: { gte: q.from, lt: q.to } }] },
    include: { unit: { select: { name: true } }, work: { select: { id: true, code: true } } },
    orderBy: { startsAt: "asc" },
  });
  const items: AgendaItem[] = events.map((e) => ({
    id: e.id, source: "evento", kind: AGENDA_KIND[e.kind]!, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, allDay: false, unitName: e.unit.name, work: e.work,
    status: e.status, location: e.location, notes: e.notes, slots: e.slots, statusReason: e.statusReason, canManage: can(actor, "agenda.manage", e.unitPath),
  }));

  const workScope = workScopedWhere(actor, "work.read", "id");
  if (workScope) {
    const workWhere: Prisma.WorkWhereInput = { AND: [workScope, unitFilter, { status: { notIn: ["ARQUIVADA", "REJEITADA"] } }] };
    const [stages, milestones] = await Promise.all([
      prisma.workStage.findMany({
        where: { work: workWhere, OR: [{ plannedStart: { gte: dayFrom, lt: dayTo } }, { plannedEnd: { gte: dayFrom, lt: dayTo } }] },
        include: { work: { select: { id: true, code: true, unit: { select: { name: true } } } } },
      }),
      prisma.workMilestone.findMany({ where: { work: workWhere, plannedDate: { gte: dayFrom, lt: dayTo } }, include: { work: { select: { id: true, code: true, unit: { select: { name: true } } } } } }),
    ]);
    const inRange = (d: Date | null) => Boolean(d && d >= dayFrom && d < dayTo);
    for (const s of stages) {
      const base = { source: "etapa" as const, kind: "Etapa", allDay: true, endsAt: null, unitName: s.work.unit.name, work: { id: s.work.id, code: s.work.code }, status: s.status, location: null, notes: null, slots: null, statusReason: null, canManage: false };
      if (inRange(s.plannedStart)) items.push({ ...base, id: `${s.id}-i`, title: `Início previsto: ${s.name}`, startsAt: s.plannedStart! });
      if (inRange(s.plannedEnd)) items.push({ ...base, id: `${s.id}-t`, title: `Término previsto: ${s.name}`, startsAt: s.plannedEnd! });
    }
    for (const m of milestones) {
      items.push({ id: m.id, source: "marco", kind: "Marco", title: m.name, startsAt: m.plannedDate, endsAt: null, allDay: true, unitName: m.work.unit.name, work: { id: m.work.id, code: m.work.code }, status: m.actualDate ? "REALIZADO" : "PREVISTO", location: null, notes: null, slots: null, statusReason: null, canManage: false });
    }
  }
  const safetyScope = workScopedWhere(actor, "safety.read", "workId");
  if (safetyScope) {
    const inspections = await prisma.inspection.findMany({
      where: { AND: [safetyScope, { work: unitFilter }, { status: { in: ["PLANEJADA", "EM_ANDAMENTO"] } }, { plannedDate: { gte: dayFrom, lt: dayTo } }] },
      include: { work: { select: { id: true, code: true, unit: { select: { name: true } } } } },
    });
    for (const i of inspections) {
      items.push({ id: i.id, source: "inspecao", kind: "Inspeção de segurança", title: `Inspeção planejada — ${i.work.code}`, startsAt: i.plannedDate, endsAt: null, allDay: true, unitName: i.work.unit.name, work: { id: i.work.id, code: i.work.code }, status: i.status, location: null, notes: null, slots: null, statusReason: null, canManage: false });
    }
  }
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Unidades onde o ator pode agendar e as obras abertas de cada uma (para o formulário). */
export async function agendaFormOptions(actor: Actor) {
  const scope = pathWhere(actor, "agenda.manage", "path");
  if (!scope) return { units: [], works: [] };
  const units = await prisma.organizationUnit.findMany({ where: { AND: [scope, { status: "ATIVA" }, { children: { none: {} } }] }, select: { id: true, name: true, path: true }, orderBy: { name: "asc" } });
  const workScope = workScopedWhere(actor, "work.read", "id");
  const works = workScope
    ? await prisma.work.findMany({ where: { AND: [workScope, { unitId: { in: units.map((u) => u.id) } }, { status: { notIn: ["CONCLUIDA", "ARQUIVADA", "REJEITADA"] } }] }, select: { id: true, code: true, title: true, unitId: true }, orderBy: { code: "asc" } })
    : [];
  return { units: units.map(({ id, name }) => ({ id, name })), works };
}

export async function createAgendaEvent(actor: Actor, input: z.infer<typeof agendaEventSchema>, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.unitId } });
  if (!unit || !can(actor, "agenda.read", unit.path)) throw Errors.notFound("Unidade");
  assertCan(actor, "agenda.manage", unit.path, "Você não pode agendar compromissos nesta unidade.");
  if (unit.status !== "ATIVA") throw Errors.conflict("A unidade está inativa.");
  if (input.workId) {
    const work = await prisma.work.findUnique({ where: { id: input.workId } });
    if (!work || !canOnWork(actor, "work.read", work)) throw Errors.invalid("Obra inválida.", { workId: ["Obra não encontrada."] });
    if (work.unitId !== unit.id) throw Errors.invalid("A obra não pertence a esta unidade.", { workId: ["Escolha uma obra da unidade."] });
  }
  return prisma.$transaction(async (tx) => {
    const e = await tx.agendaEvent.create({ data: { ...input, workId: input.workId ?? null, slots: input.slots ?? null, unitPath: unit.path, createdById: actor.userId } });
    await recordAudit({ action: "agenda.compromisso.criado", actor: auditActor(actor), objectType: "AgendaEvent", objectId: e.id, unitPath: unit.path, metadata: { tipo: e.kind, inicio: e.startsAt.toISOString() } }, meta, tx);
    return e;
  });
}

/** Conclui ou cancela. Compromissos não são excluídos; o histórico permanece. */
export async function setAgendaEventStatus(actor: Actor, id: string, input: z.infer<typeof agendaStatusSchema>, meta: RequestMeta) {
  const e = await prisma.agendaEvent.findUnique({ where: { id } });
  if (!e || !can(actor, "agenda.read", e.unitPath)) throw Errors.notFound("Compromisso");
  assertCan(actor, "agenda.manage", e.unitPath, "Você não pode alterar este compromisso.");
  if (e.status !== "AGENDADO") throw Errors.conflict("Este compromisso já foi concluído ou cancelado.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.agendaEvent.update({ where: { id }, data: { status: input.status, statusReason: input.reason ?? null } });
    await recordAudit({ action: input.status === "REALIZADO" ? "agenda.compromisso.realizado" : "agenda.compromisso.cancelado", actor: auditActor(actor), objectType: "AgendaEvent", objectId: id, unitPath: e.unitPath, metadata: { motivo: input.reason ?? undefined } }, meta, tx);
    return u;
  });
}

/** Portal do titular: próximos compromissos das obras em que atua e mutirões da sua unidade. */
export async function myAgenda(personId: string, unitId: string) {
  const assignments = await prisma.volunteerAssignment.findMany({ where: { personId, status: "ATIVO" }, select: { workId: true } });
  return prisma.agendaEvent.findMany({
    where: { status: "AGENDADO", startsAt: { gte: new Date() }, OR: [{ workId: { in: assignments.map((a) => a.workId) } }, { unitId, kind: "MUTIRAO" }] },
    include: { unit: { select: { name: true } }, work: { select: { code: true, title: true } } },
    orderBy: { startsAt: "asc" },
    take: 30,
  });
}
