import { Prisma, type WorkStatus } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, assertCanOnWork, can, canAnywhere, canOnWork, workScopedWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { FROZEN, SCOPE_EDITABLE, findManualTransition, manualTransitionsFrom, STATUS_LABEL } from "../domain/work-state";
import type { CreateWorkInput, StageInput, UpdateWorkInput, WorkListQuery } from "../validation/work";
import { blockingIssues, syncEvaluations } from "./requirement.service";
import { openApproval } from "./approval.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

/** Gera OB-AAAA-NNNNN de forma atômica (sem colisões entre requisições simultâneas). */
async function nextWorkCode(tx: Tx, now = new Date()) {
  const year = now.getUTCFullYear();
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO work_code_sequence (year, value) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET value = work_code_sequence.value + 1
    RETURNING value`;
  return `OB-${year}-${String(rows[0]!.value).padStart(5, "0")}`;
}

async function validateCatalog(typeCode: string | undefined, activities: string[] | undefined) {
  if (typeCode) {
    const t = await prisma.workType.findUnique({ where: { code: typeCode } });
    if (!t || !t.active) throw Errors.invalid("Tipo de obra inválido.", { typeCode: ["Selecione um tipo válido."] });
  }
  if (activities?.length) {
    const found = await prisma.activityType.count({ where: { code: { in: activities }, active: true } });
    if (found !== new Set(activities).size) throw Errors.invalid("Atividade inválida.", { activities: ["Há atividades desconhecidas."] });
  }
}

export async function listWorkCatalogs() {
  const [types, activities] = await Promise.all([
    prisma.workType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.activityType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return { types, activities };
}

export async function listWorks(actor: Actor, q: WorkListQuery = {}) {
  const scope = workScopedWhere(actor, "work.read", "id");
  if (!scope) return [];
  const where: Prisma.WorkWhereInput = {
    AND: [
      scope,
      q.status ? { status: q.status } : {},
      q.typeCode ? { typeCode: q.typeCode } : {},
      q.unitId ? { unitId: q.unitId } : {},
      q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { code: { contains: q.q, mode: "insensitive" } }] } : {},
    ],
  };
  return prisma.work.findMany({
    where,
    include: { unit: { select: { name: true, code: true } }, type: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

/** Carrega a obra se o ator puder lê-la; caso contrário, 404. */
export async function loadWork(actor: Actor, id: string, permission: "work.read" = "work.read") {
  const work = await prisma.work.findUnique({ where: { id } });
  if (!work || !canOnWork(actor, permission, work)) throw Errors.notFound("Obra");
  return work;
}

export async function getWork(actor: Actor, id: string) {
  await loadWork(actor, id);
  const work = await prisma.work.findUniqueOrThrow({
    where: { id },
    include: {
      unit: { select: { id: true, name: true, code: true } },
      type: true,
      stages: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      statusHistory: { orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" }, include: { steps: { orderBy: { stepNo: "asc" } } } },
    },
  });
  const people = await prisma.user.findMany({
    where: { id: { in: [work.createdById, ...work.statusHistory.map((h) => h.actorId), ...work.approvals.flatMap((a) => [a.requesterId, ...a.steps.map((s) => s.approverId)])] } },
    select: { id: true, name: true },
  });
  const transitions = manualTransitionsFrom(work.status).filter((t) => canOnWork(actor, t.permission, work));
  return {
    ...work,
    people: Object.fromEntries(people.map((p) => [p.id, p.name])),
    allowed: {
      edit: canOnWork(actor, "work.manage", work) && !FROZEN.includes(work.status),
      editScope: canOnWork(actor, "work.manage", work) && SCOPE_EDITABLE.includes(work.status),
      transitions: transitions.map((t) => ({ action: t.action, label: t.label, requiresReason: t.requiresReason, to: t.to })),
      upload: canOnWork(actor, "document.upload", work) && work.status !== "ARQUIVADA",
      evaluate: canOnWork(actor, "requirement.evaluate", work),
      waive: canOnWork(actor, "requirement.waive", work),
      review: canOnWork(actor, "document.review", work),
      report: canOnWork(actor, "report.generate", work),
    },
  };
}

export async function createWork(actor: Actor, input: CreateWorkInput, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.unitId } });
  if (!unit || (!can(actor, "org.read", unit.path) && !can(actor, "work.read", unit.path))) throw Errors.notFound("Unidade");
  assertCan(actor, "work.create", unit.path, "Você não pode cadastrar obras nesta unidade.");
  if (unit.status !== "ATIVA") throw Errors.invalid("A unidade está inativa.");
  await validateCatalog(input.typeCode, input.activities);
  const { unitId, activities, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    const code = await nextWorkCode(tx);
    const work = await tx.work.create({
      data: { ...fields, plannedStart: fields.plannedStart ?? null, plannedEnd: fields.plannedEnd ?? null, activities: [...new Set(activities)], code, unitId, unitPath: unit.path, createdById: actor.userId },
    });
    await tx.workStatusChange.create({ data: { workId: work.id, fromStatus: null, toStatus: "RASCUNHO", actorId: actor.userId } });
    await syncEvaluations(tx, work);
    await recordAudit(
      { action: "obra.criada", actor: auditActor(actor), objectType: "Work", objectId: work.id, unitPath: work.unitPath, metadata: { codigo: code, titulo: work.title, tipo: work.typeCode } },
      meta,
      tx,
    );
    return work;
  });
}

export async function updateWork(actor: Actor, id: string, input: UpdateWorkInput, meta: RequestMeta) {
  const work = await loadWork(actor, id);
  assertCanOnWork(actor, "work.manage", work, "Você não pode alterar esta obra.");
  if (FROZEN.includes(work.status)) throw Errors.conflict(`Obras na situação "${STATUS_LABEL[work.status]}" não podem ser alteradas.`);
  const { version, ...fields } = input;
  const touchesScope = (["title", "typeCode", "activities", "scope", "justification", "executionMode"] as const).some((k) => fields[k] !== undefined);
  if (touchesScope && !SCOPE_EDITABLE.includes(work.status)) {
    throw Errors.conflict("Título, tipo, atividades, escopo e justificativa não podem mudar depois do envio para aprovação.");
  }
  await validateCatalog(fields.typeCode, fields.activities);
  return prisma.$transaction(async (tx) => {
    // Controle de concorrência otimista: falha se outra pessoa alterou a obra antes.
    const updated = await tx.work.updateMany({
      where: { id, version },
      data: { ...fields, ...(fields.activities ? { activities: [...new Set(fields.activities)] } : {}), version: { increment: 1 }, updatedById: actor.userId },
    });
    if (updated.count !== 1) throw Errors.conflict("A obra foi alterada por outra pessoa. Recarregue a página e tente novamente.");
    const fresh = await tx.work.findUniqueOrThrow({ where: { id } });
    if (fields.typeCode || fields.activities || fields.executionMode) await syncEvaluations(tx, fresh);
    await recordAudit(
      { action: "obra.alterada", actor: auditActor(actor), objectType: "Work", objectId: id, unitPath: work.unitPath, metadata: { campos: Object.keys(fields), versao: fresh.version } },
      meta,
      tx,
    );
    return fresh;
  });
}

/** Aplica uma transição de estado dentro de uma transação (uso interno: manual ou por aprovação). */
export async function applyStatusChange(
  tx: Tx,
  work: { id: string; status: WorkStatus; unitPath: string },
  to: WorkStatus,
  opts: { actor: Actor; reason?: string | null; approvalId?: string; action: string },
  meta: RequestMeta,
) {
  const changed = await tx.work.updateMany({
    where: { id: work.id, status: work.status },
    data: { status: to, version: { increment: 1 }, updatedById: opts.actor.userId },
  });
  if (changed.count !== 1) throw Errors.conflict("A situação da obra mudou enquanto a operação era processada. Recarregue a página.");
  await tx.workStatusChange.create({
    data: { workId: work.id, fromStatus: work.status, toStatus: to, reason: opts.reason ?? null, actorId: opts.actor.userId, approvalId: opts.approvalId ?? null },
  });
  await recordAudit(
    {
      action: `obra.situacao.${opts.action}`,
      actor: auditActor(opts.actor),
      objectType: "Work",
      objectId: work.id,
      unitPath: work.unitPath,
      metadata: { de: work.status, para: to, justificativa: opts.reason ?? undefined, aprovacao: opts.approvalId },
    },
    meta,
    tx,
  );
}

export async function transitionWork(actor: Actor, id: string, input: { action: string; reason?: string | null; version: number }, meta: RequestMeta) {
  const work = await loadWork(actor, id);
  const t = findManualTransition(work.status, input.action);
  if (!t) throw Errors.conflict(`A ação solicitada não é permitida para uma obra "${STATUS_LABEL[work.status]}".`);
  assertCanOnWork(actor, t.permission, work, "Você não pode executar esta ação nesta obra.");
  if (t.requiresReason && (!input.reason || input.reason.trim().length < 10)) {
    throw Errors.invalid("Informe a justificativa (mínimo de 10 caracteres).", { reason: ["Justificativa obrigatória."] });
  }
  if (work.version !== input.version) throw Errors.conflict("A obra foi alterada por outra pessoa. Recarregue a página e tente novamente.");
  if (t.checkpoint) {
    const issues = await blockingIssues(prisma, work.id, t.checkpoint);
    if (issues.length) {
      throw Errors.conflict(`Há ${issues.length} requisito(s) bloqueante(s) pendente(s) para esta etapa: ${issues.map((i) => i.rule.name).join("; ")}.`);
    }
  }
  return prisma.$transaction(async (tx) => {
    await applyStatusChange(tx, work, t.to, { actor, reason: input.reason, action: t.action }, meta);
    if (t.opensApproval) await openApproval(tx, actor, { ...work, version: work.version + 1 }, t.opensApproval, input.reason ?? null, meta);
    return tx.work.findUniqueOrThrow({ where: { id } });
  });
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

async function loadEditableWork(actor: Actor, workId: string) {
  const work = await loadWork(actor, workId);
  assertCanOnWork(actor, "work.manage", work, "Você não pode alterar as etapas desta obra.");
  if (FROZEN.includes(work.status)) throw Errors.conflict("Esta obra não aceita mais alterações.");
  return work;
}

export async function createStage(actor: Actor, workId: string, input: StageInput, meta: RequestMeta) {
  const work = await loadEditableWork(actor, workId);
  return prisma.$transaction(async (tx) => {
    const stage = await tx.workStage.create({ data: { ...nullDates(input), workId } });
    await recordAudit({ action: "obra.etapa.criada", actor: auditActor(actor), objectType: "WorkStage", objectId: stage.id, unitPath: work.unitPath, metadata: { obra: work.code, etapa: stage.name } }, meta, tx);
    return stage;
  });
}

export async function updateStage(actor: Actor, workId: string, stageId: string, input: StageInput, meta: RequestMeta) {
  const work = await loadEditableWork(actor, workId);
  const stage = await prisma.workStage.findFirst({ where: { id: stageId, workId } });
  if (!stage) throw Errors.notFound("Etapa");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.workStage.update({ where: { id: stageId }, data: nullDates(input) });
    await recordAudit(
      { action: "obra.etapa.alterada", actor: auditActor(actor), objectType: "WorkStage", objectId: stageId, unitPath: work.unitPath, metadata: { obra: work.code, etapa: updated.name, progresso: updated.progress, situacao: updated.status } },
      meta,
      tx,
    );
    return updated;
  });
}

function nullDates<T extends StageInput>(input: T) {
  return {
    ...input,
    plannedStart: input.plannedStart ?? null,
    plannedEnd: input.plannedEnd ?? null,
    actualStart: input.actualStart ?? null,
    actualEnd: input.actualEnd ?? null,
  };
}

export function canCreateWorks(actor: Actor) {
  return canAnywhere(actor, "work.create");
}
