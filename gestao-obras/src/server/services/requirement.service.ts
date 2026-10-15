import type { EvaluationStatus, Prisma, RequirementRule, Work, WorkCheckpoint } from "@prisma/client";
import { prisma, type Db, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, assertCanAnywhere, assertCanOnWork, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { RuleInput } from "../validation/requirement";
import { getRootUnit } from "./org-unit.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

/** A regra se aplica à obra? Listas vazias significam "qualquer". */
export function ruleApplies(rule: Pick<RequirementRule, "workTypes" | "activities" | "executionModes" | "status">, work: Pick<Work, "typeCode" | "activities" | "executionMode">): boolean {
  if (rule.status === "INATIVA") return false;
  if (rule.workTypes.length && !rule.workTypes.includes(work.typeCode)) return false;
  if (rule.executionModes.length && !rule.executionModes.includes(work.executionMode)) return false;
  if (rule.activities.length && !rule.activities.some((a) => work.activities.includes(a))) return false;
  return true;
}

/** Cria avaliações para regras aplicáveis e marca como não aplicáveis as que deixaram de se aplicar. */
export async function syncEvaluations(db: Db, work: Pick<Work, "id" | "typeCode" | "activities" | "executionMode">) {
  const [rules, existing] = await Promise.all([
    db.requirementRule.findMany(),
    db.requirementEvaluation.findMany({ where: { workId: work.id } }),
  ]);
  const byRule = new Map(existing.map((e) => [e.ruleId, e]));
  for (const rule of rules) {
    const applies = ruleApplies(rule, work);
    const ev = byRule.get(rule.id);
    if (applies && !ev) await db.requirementEvaluation.create({ data: { workId: work.id, ruleId: rule.id } });
    else if (applies && ev?.status === "NAO_APLICAVEL") await db.requirementEvaluation.update({ where: { id: ev.id }, data: { status: "PENDENTE" } });
    else if (!applies && ev && ev.status === "PENDENTE") await db.requirementEvaluation.update({ where: { id: ev.id }, data: { status: "NAO_APLICAVEL" } });
  }
}

const SATISFIED: EvaluationStatus[] = ["ATENDIDO", "DISPENSADO_JUSTIFICADO", "NAO_APLICAVEL"];

/**
 * Requisitos que impedem o avanço no ponto de verificação. Só regras VALIDADAS
 * e marcadas como bloqueantes produzem efeito; regras pendentes de validação
 * são apenas informativas.
 */
export async function blockingIssues(db: Db, workId: string, checkpoint: WorkCheckpoint) {
  const evaluations = await db.requirementEvaluation.findMany({
    where: { workId, rule: { status: "VALIDADA", blocking: true, checkpoint } },
    include: { rule: true, document: { select: { status: true, expiryDate: true } } },
  });
  return evaluations.filter((e) => {
    if (!SATISFIED.includes(e.status)) return true;
    // "Atendido" por documento que deixou de valer não conta.
    if (e.status === "ATENDIDO" && e.document && (e.document.status !== "APROVADO" || (e.document.expiryDate && e.document.expiryDate < startOfToday()))) return true;
    return false;
  });
}

export function startOfToday() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Configuração das regras (restrita à raiz)
// ---------------------------------------------------------------------------

async function assertRuleAdmin(actor: Actor) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "requirement.manage", root.path, "A configuração de regras documentais é restrita à gestão central.");
}

export async function listRules(actor: Actor) {
  assertCanAnywhere(actor, "requirement.read");
  return prisma.requirementRule.findMany({ orderBy: [{ status: "asc" }, { code: "asc" }] });
}

export async function listRequirementCatalogs() {
  const [workTypes, activities, categories] = await Promise.all([
    prisma.workType.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.activityType.findMany({ orderBy: { name: "asc" } }),
    prisma.documentCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { workTypes, activities, categories };
}

async function validateRefs(input: Partial<RuleInput>) {
  if (input.documentCategoryCode && !(await prisma.documentCategory.findUnique({ where: { code: input.documentCategoryCode } }))) {
    throw Errors.invalid("Categoria de documento inválida.", { documentCategoryCode: ["Categoria inexistente."] });
  }
  if (input.workTypes?.length && (await prisma.workType.count({ where: { code: { in: input.workTypes } } })) !== new Set(input.workTypes).size) {
    throw Errors.invalid("Tipo de obra inválido.", { workTypes: ["Há tipos inexistentes."] });
  }
  if (input.activities?.length && (await prisma.activityType.count({ where: { code: { in: input.activities } } })) !== new Set(input.activities).size) {
    throw Errors.invalid("Atividade inválida.", { activities: ["Há atividades inexistentes."] });
  }
}

export async function createRule(actor: Actor, input: RuleInput, meta: RequestMeta) {
  await assertRuleAdmin(actor);
  await validateRefs(input);
  return prisma.$transaction(async (tx) => {
    // Toda regra nova nasce pendente de validação.
    const rule = await tx.requirementRule.create({ data: { ...input, nextReviewAt: input.nextReviewAt ?? null, status: "PENDENTE_VALIDACAO" } });
    await recordAudit({ action: "requisito.regra.criada", actor: auditActor(actor), objectType: "RequirementRule", objectId: rule.id, metadata: { codigo: rule.code, classificacao: rule.classification } }, meta, tx);
    return rule;
  });
}

/** Alterações de conteúdo devolvem a regra para "pendente de validação". */
export async function updateRule(actor: Actor, id: string, input: Partial<RuleInput>, meta: RequestMeta) {
  await assertRuleAdmin(actor);
  const rule = await prisma.requirementRule.findUnique({ where: { id } });
  if (!rule) throw Errors.notFound("Regra");
  await validateRefs(input);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.requirementRule.update({
      where: { id },
      data: { ...input, status: rule.status === "INATIVA" ? "INATIVA" : "PENDENTE_VALIDACAO", validatedAt: null, validatedById: null },
    });
    await recordAudit(
      { action: "requisito.regra.alterada", actor: auditActor(actor), objectType: "RequirementRule", objectId: id, metadata: { codigo: rule.code, campos: Object.keys(input), situacaoAnterior: rule.status } },
      meta,
      tx,
    );
    return updated;
  });
}

export async function validateRule(actor: Actor, id: string, input: { lastReviewedAt: Date; nextReviewAt: Date; note: string }, meta: RequestMeta) {
  await assertRuleAdmin(actor);
  const rule = await prisma.requirementRule.findUnique({ where: { id } });
  if (!rule) throw Errors.notFound("Regra");
  if (rule.status === "INATIVA") throw Errors.conflict("Reative a regra antes de validá-la.");
  const missing = [!rule.legalBasis && "base legal, contratual ou institucional", !rule.evidence && "evidência exigida"].filter(Boolean);
  if (missing.length) throw Errors.invalid(`Preencha antes de validar: ${missing.join(", ")}.`);
  if (input.nextReviewAt <= input.lastReviewedAt) throw Errors.invalid("A próxima revisão deve ser posterior à data de revisão.", { nextReviewAt: ["Data inválida."] });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.requirementRule.update({
      where: { id },
      data: { status: "VALIDADA", validatedAt: new Date(), validatedById: actor.userId, lastReviewedAt: input.lastReviewedAt, nextReviewAt: input.nextReviewAt },
    });
    await recordAudit({ action: "requisito.regra.validada", actor: auditActor(actor), objectType: "RequirementRule", objectId: id, metadata: { codigo: rule.code, registro: input.note, bloqueante: rule.blocking } }, meta, tx);
    return updated;
  });
}

export async function setRuleActive(actor: Actor, id: string, active: boolean, meta: RequestMeta) {
  await assertRuleAdmin(actor);
  const rule = await prisma.requirementRule.findUnique({ where: { id } });
  if (!rule) throw Errors.notFound("Regra");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.requirementRule.update({ where: { id }, data: { status: active ? "PENDENTE_VALIDACAO" : "INATIVA", validatedAt: null, validatedById: null } });
    await recordAudit({ action: active ? "requisito.regra.reativada" : "requisito.regra.inativada", actor: auditActor(actor), objectType: "RequirementRule", objectId: id, metadata: { codigo: rule.code } }, meta, tx);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Avaliação por obra
// ---------------------------------------------------------------------------

async function loadWorkFor(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work) throw Errors.notFound("Obra");
  assertCanOnWork(actor, "requirement.read", work);
  return work;
}

export async function listWorkRequirements(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work) throw Errors.notFound("Obra");
  try {
    assertCanOnWork(actor, "requirement.read", work);
  } catch {
    throw Errors.notFound("Obra");
  }
  await syncEvaluations(prisma, work);
  return prisma.requirementEvaluation.findMany({
    where: { workId, status: { not: "NAO_APLICAVEL" } },
    include: { rule: true, document: { select: { id: true, title: true, status: true, expiryDate: true } } },
    orderBy: [{ rule: { checkpoint: "asc" } }, { rule: { code: "asc" } }],
  });
}

async function loadEvaluation(actor: Actor, workId: string, evaluationId: string) {
  const work = await loadWorkFor(actor, workId).catch(() => {
    throw Errors.notFound("Obra");
  });
  const ev = await prisma.requirementEvaluation.findFirst({ where: { id: evaluationId, workId }, include: { rule: true } });
  if (!ev) throw Errors.notFound("Requisito");
  return { work, ev };
}

export async function setEvaluation(
  actor: Actor,
  workId: string,
  evaluationId: string,
  input: { status: "PENDENTE" | "ATENDIDO" | "NAO_ATENDIDO"; documentId?: string | null; justification?: string | null },
  meta: RequestMeta,
) {
  const { work, ev } = await loadEvaluation(actor, workId, evaluationId);
  assertCanOnWork(actor, "requirement.evaluate", work, "Você não pode registrar o atendimento de requisitos nesta obra.");
  if (input.documentId) {
    const doc = await prisma.document.findFirst({ where: { id: input.documentId, workId } });
    if (!doc) throw Errors.invalid("O documento precisa pertencer a esta obra.", { documentId: ["Documento inválido."] });
  }
  if (input.status === "ATENDIDO" && !input.documentId && !input.justification) {
    throw Errors.invalid("Vincule um documento ou descreva a evidência.", { documentId: ["Informe a evidência."] });
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.requirementEvaluation.update({
      where: { id: ev.id },
      data: { status: input.status, documentId: input.documentId ?? null, justification: input.justification ?? null, evaluatedById: actor.userId, evaluatedAt: new Date() },
    });
    await recordAudit(
      { action: "requisito.avaliado", actor: auditActor(actor), objectType: "RequirementEvaluation", objectId: ev.id, unitPath: work.unitPath, metadata: { obra: work.code, regra: ev.rule.code, de: ev.status, para: input.status, documento: input.documentId ?? undefined } },
      meta,
      tx,
    );
    return updated;
  });
}

export async function waiveEvaluation(actor: Actor, workId: string, evaluationId: string, justification: string, meta: RequestMeta) {
  const { work, ev } = await loadEvaluation(actor, workId, evaluationId);
  assertCanOnWork(actor, "requirement.waive", work, "Você não pode dispensar requisitos nesta obra.");
  if (work.createdById === actor.userId) throw Errors.forbidden("Por segregação de funções, quem cadastrou a obra não pode dispensar seus requisitos.");
  return prisma.$transaction(async (tx: Tx) => {
    const updated = await tx.requirementEvaluation.update({
      where: { id: ev.id },
      data: { status: "DISPENSADO_JUSTIFICADO", justification, evaluatedById: actor.userId, evaluatedAt: new Date() },
    });
    await recordAudit(
      { action: "requisito.dispensado", actor: auditActor(actor), objectType: "RequirementEvaluation", objectId: ev.id, unitPath: work.unitPath, metadata: { obra: work.code, regra: ev.rule.code, justificativa: justification } },
      meta,
      tx,
    );
    return updated;
  });
}

export type RequirementWithRule = Prisma.RequirementEvaluationGetPayload<{ include: { rule: true } }>;
