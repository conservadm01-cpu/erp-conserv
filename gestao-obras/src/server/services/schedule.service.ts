import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, canOnWork, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { diarySchema, milestoneSchema, scopeChangeSchema, stageScheduleSchema } from "../validation/phase4";
import { FROZEN } from "../domain/work-state";
import { openSubjectApproval } from "./approval.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

async function loadWork(actor: Actor, workId: string, manage = false) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "work.read", work)) throw Errors.notFound("Obra");
  if (manage) {
    assertCanOnWork(actor, "work.manage", work, "Você não pode alterar o cronograma desta obra.");
    if (FROZEN.includes(work.status)) throw Errors.conflict("Esta obra não aceita mais alterações.");
  }
  return work;
}

/** Detecta ciclos no grafo de dependências entre etapas. */
export function hasCycle(edges: Map<string, string[]>): boolean {
  const state = new Map<string, 1 | 2>();
  const visit = (n: string): boolean => {
    if (state.get(n) === 1) return true;
    if (state.get(n) === 2) return false;
    state.set(n, 1);
    for (const m of edges.get(n) ?? []) if (visit(m)) return true;
    state.set(n, 2);
    return false;
  };
  return [...edges.keys()].some((n) => visit(n));
}

export async function getSchedule(actor: Actor, workId: string) {
  const work = await loadWork(actor, workId);
  const [stages, milestones, baselines] = await Promise.all([
    prisma.workStage.findMany({ where: { workId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.workMilestone.findMany({ where: { workId }, orderBy: { plannedDate: "asc" } }),
    prisma.scheduleBaseline.findMany({ where: { workId }, orderBy: { version: "desc" } }),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: baselines.map((b) => b.createdById) } }, select: { id: true, name: true } });
  return { work, stages, milestones, baselines, people: Object.fromEntries(people.map((p) => [p.id, p.name])), canEdit: canOnWork(actor, "work.manage", work) && !FROZEN.includes(work.status) };
}

export async function updateStageSchedule(actor: Actor, workId: string, stageId: string, input: z.infer<typeof stageScheduleSchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  const stages = await prisma.workStage.findMany({ where: { workId }, select: { id: true, dependsOnIds: true, plannedEnd: true, status: true } });
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) throw Errors.notFound("Etapa");
  if (input.dependsOnIds.includes(stageId)) throw Errors.invalid("Uma etapa não pode depender de si mesma.", { dependsOnIds: ["Dependência inválida."] });
  if (input.dependsOnIds.some((d) => !stages.some((s) => s.id === d))) throw Errors.invalid("Dependência inválida.", { dependsOnIds: ["Selecione etapas desta obra."] });
  const edges = new Map(stages.map((s) => [s.id, s.id === stageId ? input.dependsOnIds : s.dependsOnIds]));
  if (hasCycle(edges)) throw Errors.invalid("Essas dependências criariam um ciclo entre etapas.", { dependsOnIds: ["Dependência circular."] });
  return prisma.$transaction(async (tx) => {
    const u = await tx.workStage.update({ where: { id: stageId }, data: input });
    await recordAudit({ action: "obra.cronograma.etapa", actor: auditActor(actor), objectType: "WorkStage", objectId: stageId, unitPath: work.unitPath, metadata: { obra: work.code, dependencias: input.dependsOnIds.length, justificativaAtraso: input.delayReason ?? undefined } }, meta, tx);
    return u;
  });
}

export async function saveMilestone(actor: Actor, workId: string, id: string | null, input: z.infer<typeof milestoneSchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  if (id && !(await prisma.workMilestone.findFirst({ where: { id, workId } }))) throw Errors.notFound("Marco");
  return prisma.$transaction(async (tx) => {
    const data = { ...input, actualDate: input.actualDate ?? null };
    const m = id ? await tx.workMilestone.update({ where: { id }, data }) : await tx.workMilestone.create({ data: { ...data, workId } });
    await recordAudit({ action: id ? "obra.marco.alterado" : "obra.marco.criado", actor: auditActor(actor), objectType: "WorkMilestone", objectId: m.id, unitPath: work.unitPath, metadata: { obra: work.code, marco: m.name, previsto: m.plannedDate.toISOString().slice(0, 10) } }, meta, tx);
    return m;
  });
}

/** Congela o cronograma atual como nova linha de base (as anteriores ficam no histórico). */
export async function createBaseline(actor: Actor, workId: string, reason: string, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  const [stages, milestones] = await Promise.all([
    prisma.workStage.findMany({ where: { workId }, orderBy: { sortOrder: "asc" } }),
    prisma.workMilestone.findMany({ where: { workId }, orderBy: { plannedDate: "asc" } }),
  ]);
  if (!stages.length) throw Errors.invalid("Cadastre as etapas antes de definir a linha de base.");
  const missing = stages.filter((s) => !s.plannedStart || !s.plannedEnd);
  if (missing.length) throw Errors.invalid(`Informe início e término previstos de todas as etapas (faltam ${missing.length}).`);
  return prisma.$transaction(async (tx) => {
    const last = await tx.scheduleBaseline.findFirst({ where: { workId }, orderBy: { version: "desc" } });
    const version = (last?.version ?? 0) + 1;
    const snapshot = {
      etapas: stages.map((s) => ({ id: s.id, nome: s.name, inicio: s.plannedStart!.toISOString().slice(0, 10), termino: s.plannedEnd!.toISOString().slice(0, 10), dependencias: s.dependsOnIds })),
      marcos: milestones.map((m) => ({ id: m.id, nome: m.name, data: m.plannedDate.toISOString().slice(0, 10) })),
    };
    const b = await tx.scheduleBaseline.create({ data: { workId, version, reason, snapshot, createdById: actor.userId } });
    await recordAudit({ action: "obra.cronograma.linha_base", actor: auditActor(actor), objectType: "ScheduleBaseline", objectId: b.id, unitPath: work.unitPath, metadata: { obra: work.code, versao: version, motivo: reason } }, meta, tx);
    return b;
  });
}

type BaselineSnapshot = { etapas: { id: string; nome: string; inicio: string; termino: string }[]; marcos: { id: string; nome: string; data: string }[] };

/** Desvio (em dias) de cada etapa em relação à linha de base mais recente. */
export function scheduleVariance(stages: { id: string; plannedEnd: Date | null; actualEnd: Date | null }[], snapshot: unknown) {
  const snap = snapshot as BaselineSnapshot;
  return stages.map((s) => {
    const base = snap?.etapas?.find((e) => e.id === s.id);
    const current = s.actualEnd ?? s.plannedEnd;
    const days = base && current ? Math.round((current.getTime() - new Date(base.termino).getTime()) / 86_400_000) : null;
    return { stageId: s.id, baselineEnd: base?.termino ?? null, varianceDays: days };
  });
}

export async function listDiary(actor: Actor, workId: string) {
  await loadWork(actor, workId);
  const entries = await prisma.workDiaryEntry.findMany({ where: { workId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 200 });
  const people = await prisma.user.findMany({ where: { id: { in: entries.map((e) => e.authorId) } }, select: { id: true, name: true } });
  return entries.map((e) => ({ ...e, authorName: people.find((p) => p.id === e.authorId)?.name ?? "—" }));
}

/** Diário de obra: inclusão apenas (não há edição nem exclusão de registros). */
export async function addDiaryEntry(actor: Actor, workId: string, input: z.infer<typeof diarySchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId, true);
  if (input.date > new Date()) throw Errors.invalid("A data do registro não pode estar no futuro.", { date: ["Data inválida."] });
  return prisma.$transaction(async (tx) => {
    const e = await tx.workDiaryEntry.create({ data: { ...input, workId, authorId: actor.userId } });
    await recordAudit({ action: "obra.diario.registro", actor: auditActor(actor), objectType: "WorkDiaryEntry", objectId: e.id, unitPath: work.unitPath, metadata: { obra: work.code, data: input.date.toISOString().slice(0, 10) } }, meta, tx);
    return e;
  });
}

/** Mudança de escopo de obra já aprovada: sempre passa pela aprovação central. */
export async function requestScopeChange(actor: Actor, workId: string, input: z.infer<typeof scopeChangeSchema>, meta: RequestMeta) {
  const work = await loadWork(actor, workId);
  assertCanOnWork(actor, "work.manage", work, "Você não pode solicitar mudanças de escopo nesta obra.");
  if (!["APROVADA", "EM_EXECUCAO", "SUSPENSA"].includes(work.status)) throw Errors.conflict("Antes da aprovação, altere o escopo diretamente; depois do encerramento, não há mudança de escopo.");
  if (await prisma.scopeChange.findFirst({ where: { workId, status: "EM_APROVACAO" } })) throw Errors.conflict("Já existe uma mudança de escopo aguardando decisão.");
  return prisma.$transaction(async (tx) => {
    const sc = await tx.scopeChange.create({ data: { ...input, workId, previousScope: work.scope, requesterId: actor.userId } });
    await openSubjectApproval(
      tx, actor, work,
      { kind: "MUDANCA_ESCOPO", subjectId: sc.id, amount: null, note: input.reason, snapshot: { titulo: `Mudança de escopo — ${work.code}`, resumo: [["Escopo atual", work.scope], ["Escopo proposto", input.proposedScope], ["Justificativa proposta", input.proposedJustification], ["Motivo da mudança", input.reason]] } },
      meta,
    );
    return sc;
  });
}

export async function listScopeChanges(actor: Actor, workId: string) {
  await loadWork(actor, workId);
  return prisma.scopeChange.findMany({ where: { workId }, orderBy: { createdAt: "desc" } });
}
