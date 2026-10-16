import type { CorrectiveActionStatus, Prisma } from "@prisma/client";
import { prisma, type Db, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, assertCanOnWork, canAnywhere, canOnWork, workScopedWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { actionSchema, checklistSchema, completeInspectionSchema, criticalitySchema, incidentSchema, inspectionItemsSchema, inspectionSchema, riskSchema, updateRiskSchema } from "../validation/phase3";
import { getRootUnit } from "./org-unit.service";
import { notify, recipientsFor } from "./notification.service";
import { startOfToday } from "./requirement.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });
const OPEN: CorrectiveActionStatus[] = ["ABERTA", "EM_ANDAMENTO", "AGUARDANDO_VALIDACAO"];

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

async function assertSafetyAdmin(actor: Actor) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "safety.config", root.path, "A configuração de segurança é restrita à gestão central.");
}

export async function listCriticality() {
  return prisma.criticalityLevel.findMany({ orderBy: { rank: "asc" } });
}

async function levelOf(db: Db, code: string) {
  const l = await db.criticalityLevel.findUnique({ where: { code } });
  if (!l) throw Errors.invalid("Criticidade inválida.", { criticality: ["Selecione um nível válido."] });
  return l;
}

export async function updateCriticality(actor: Actor, code: string, input: z.infer<typeof criticalitySchema>, meta: RequestMeta) {
  await assertSafetyAdmin(actor);
  const before = await levelOf(prisma, code);
  return prisma.$transaction(async (tx) => {
    const u = await tx.criticalityLevel.update({ where: { code }, data: input });
    await recordAudit({ action: "seguranca.criticidade.alterada", actor: auditActor(actor), objectType: "CriticalityLevel", objectId: code, metadata: { antes: { prazo: before.responseDays, alerta: before.priorityAlert, bloqueia: before.blocksProgress }, depois: input } }, meta, tx);
    return u;
  });
}

export async function listChecklists(actor: Actor) {
  if (!canAnywhere(actor, "safety.read")) throw Errors.forbidden();
  return prisma.checklistTemplate.findMany({ include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: { name: "asc" } });
}

export async function saveChecklist(actor: Actor, id: string | null, input: z.infer<typeof checklistSchema>, meta: RequestMeta) {
  await assertSafetyAdmin(actor);
  for (const i of input.items) await levelOf(prisma, i.defaultCriticality);
  return prisma.$transaction(async (tx) => {
    const items = input.items.map((i, n) => ({ ...i, sortOrder: n }));
    const t = id
      ? await tx.checklistTemplate.update({ where: { id }, data: { name: input.name, workTypes: input.workTypes, active: input.active, items: { deleteMany: {}, create: items } } })
      : await tx.checklistTemplate.create({ data: { name: input.name, workTypes: input.workTypes, active: input.active, items: { create: items } } });
    await recordAudit({ action: id ? "seguranca.checklist.alterado" : "seguranca.checklist.criado", actor: auditActor(actor), objectType: "ChecklistTemplate", objectId: t.id, metadata: { nome: t.name, itens: items.length } }, meta, tx);
    return t;
  });
}

// ---------------------------------------------------------------------------
// Utilidades de escopo
// ---------------------------------------------------------------------------

async function loadWorkFor(actor: Actor, workId: string, permission: "safety.read" | "safety.inspect" | "safety.action") {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "safety.read", work)) throw Errors.notFound("Obra");
  assertCanOnWork(actor, permission, work, "Você não pode registrar esta informação nesta obra.");
  return work;
}

/** Alerta prioritário para níveis configurados, a quem responde pela segurança e pela obra. */
async function priorityAlert(tx: Tx, level: { code: string; name: string; priorityAlert: boolean }, work: { id: string; code: string; unitPath: string }, title: string, link: string, key: string) {
  if (!level.priorityAlert) return;
  const users = new Set([...(await recipientsFor("safety.validate", work.unitPath, work.id, tx)), ...(await recipientsFor("work.transition", work.unitPath, work.id, tx))]);
  await notify([...users], { kind: "seguranca.alerta_prioritario", severity: level.code === "CRITICA" ? "CRITICO" : "ALERTA", title: `Risco ${level.name.toLowerCase()} — obra ${work.code}`, body: title, link, dedupKey: key }, tx);
}

const dueFrom = (days: number, from = startOfToday()) => new Date(from.getTime() + days * 86_400_000);

// ---------------------------------------------------------------------------
// Inspeções
// ---------------------------------------------------------------------------

export async function listInspections(actor: Actor, q: { workId?: string; status?: Prisma.InspectionWhereInput["status"] } = {}) {
  const scope = workScopedWhere(actor, "safety.read", "workId");
  if (!scope) return [];
  return prisma.inspection.findMany({
    where: { AND: [scope, q.workId ? { workId: q.workId } : {}, q.status ? { status: q.status } : {}] },
    include: { work: { select: { id: true, code: true, title: true } }, _count: { select: { items: { where: { result: "NAO_CONFORME" } } } } },
    orderBy: { plannedDate: "desc" },
    take: 300,
  });
}

export async function createInspection(actor: Actor, input: z.infer<typeof inspectionSchema>, meta: RequestMeta) {
  const work = await loadWorkFor(actor, input.workId, "safety.inspect");
  let items: { text: string; criticality: string; sortOrder: number }[] = [];
  if (input.templateId) {
    const t = await prisma.checklistTemplate.findUnique({ where: { id: input.templateId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (!t || !t.active) throw Errors.invalid("Checklist inválido.", { templateId: ["Selecione um checklist ativo."] });
    items = t.items.map((i) => ({ text: i.text, criticality: i.defaultCriticality, sortOrder: i.sortOrder }));
  }
  return prisma.$transaction(async (tx) => {
    const ins = await tx.inspection.create({ data: { ...input, unitPath: work.unitPath, inspectorId: actor.userId, items: { create: items } } });
    await recordAudit({ action: "seguranca.inspecao.criada", actor: auditActor(actor), objectType: "Inspection", objectId: ins.id, unitPath: work.unitPath, metadata: { obra: work.code, itens: items.length } }, meta, tx);
    return ins;
  });
}

async function loadInspection(actor: Actor, id: string) {
  const ins = await prisma.inspection.findUnique({ where: { id }, include: { work: true } });
  if (!ins || !canOnWork(actor, "safety.read", ins.work)) throw Errors.notFound("Inspeção");
  return ins;
}

export async function getInspection(actor: Actor, id: string) {
  const ins = await loadInspection(actor, id);
  const full = await prisma.inspection.findUniqueOrThrow({
    where: { id },
    include: { work: { select: { id: true, code: true, title: true } }, items: { orderBy: { sortOrder: "asc" }, include: { correctiveActions: { select: { id: true, title: true, status: true } } } } },
  });
  const inspector = await prisma.user.findUnique({ where: { id: ins.inspectorId }, select: { name: true } });
  const photos = await prisma.document.findMany({ where: { workId: ins.workId, categoryCode: "FOTO" }, select: { id: true, title: true } });
  return { ...full, inspectorName: inspector?.name ?? "—", canEdit: canOnWork(actor, "safety.inspect", ins.work) && !["CONCLUIDA", "CANCELADA"].includes(ins.status), photos };
}

export async function saveInspectionItems(actor: Actor, id: string, input: z.infer<typeof inspectionItemsSchema>, meta: RequestMeta) {
  const ins = await loadInspection(actor, id);
  assertCanOnWork(actor, "safety.inspect", ins.work);
  if (["CONCLUIDA", "CANCELADA"].includes(ins.status)) throw Errors.conflict("A inspeção já foi encerrada.");
  const levels = new Set((await listCriticality()).map((l) => l.code));
  const bad = [...input.items.map((i) => i.criticality), ...input.extraItems.map((i) => i.criticality)].filter((c) => !levels.has(c));
  if (bad.length) throw Errors.invalid("Criticidade inválida.");
  const docIds = [...new Set(input.items.flatMap((i) => i.documentIds))];
  if (docIds.length && (await prisma.document.count({ where: { id: { in: docIds }, workId: ins.workId } })) !== docIds.length) throw Errors.invalid("Há evidências que não pertencem à obra.");
  return prisma.$transaction(async (tx) => {
    for (const i of input.items) {
      const r = await tx.inspectionItem.updateMany({ where: { id: i.id, inspectionId: id }, data: { result: i.result, criticality: i.criticality, observation: i.observation, documentIds: i.documentIds } });
      if (r.count !== 1) throw Errors.invalid("Item de inspeção inválido.");
    }
    const max = await tx.inspectionItem.aggregate({ where: { inspectionId: id }, _max: { sortOrder: true } });
    let n = (max._max.sortOrder ?? 0) + 1;
    for (const e of input.extraItems) await tx.inspectionItem.create({ data: { inspectionId: id, text: e.text, criticality: e.criticality, sortOrder: n++ } });
    await tx.inspection.update({ where: { id }, data: { status: "EM_ANDAMENTO" } });
    await recordAudit({ action: "seguranca.inspecao.registrada", actor: auditActor(actor), objectType: "Inspection", objectId: id, unitPath: ins.unitPath, metadata: { itens: input.items.length, novos: input.extraItems.length } }, meta, tx);
  });
}

/** Conclui a inspeção: cada não conformidade gera uma ação corretiva com prazo pela criticidade. */
export async function completeInspection(actor: Actor, id: string, input: z.infer<typeof completeInspectionSchema>, meta: RequestMeta) {
  const ins = await loadInspection(actor, id);
  assertCanOnWork(actor, "safety.inspect", ins.work);
  if (["CONCLUIDA", "CANCELADA"].includes(ins.status)) throw Errors.conflict("A inspeção já foi encerrada.");
  const items = await prisma.inspectionItem.findMany({ where: { inspectionId: id }, include: { correctiveActions: { select: { id: true } } } });
  if (!items.length) throw Errors.invalid("Inclua ao menos um item antes de concluir.");
  const pending = items.filter((i) => i.result === "PENDENTE");
  if (pending.length) throw Errors.invalid(`Há ${pending.length} item(ns) sem resultado.`);
  const levels = await listCriticality();
  return prisma.$transaction(async (tx) => {
    await tx.inspection.update({ where: { id }, data: { status: "CONCLUIDA", performedAt: new Date(), summary: input.summary, ...(input.location ? { location: input.location } : {}) } });
    let created = 0;
    for (const item of items.filter((i) => i.result === "NAO_CONFORME" && i.correctiveActions.length === 0)) {
      const level = levels.find((l) => l.code === item.criticality)!;
      const action = await tx.correctiveAction.create({
        data: {
          workId: ins.workId, unitPath: ins.unitPath, inspectionItemId: item.id, title: `Corrigir: ${item.text}`.slice(0, 200), description: item.observation,
          criticality: item.criticality, responsibleName: "A definir", dueDate: dueFrom(level.responseDays), createdById: actor.userId,
        },
      });
      created++;
      await priorityAlert(tx, level, ins.work, `Não conformidade na inspeção "${ins.title}": ${item.text}`, `/seguranca/acoes/${action.id}`, `nc:${item.id}`);
    }
    await recordAudit({ action: "seguranca.inspecao.concluida", actor: auditActor(actor), objectType: "Inspection", objectId: id, unitPath: ins.unitPath, metadata: { obra: ins.work.code, naoConformidades: items.filter((i) => i.result === "NAO_CONFORME").length, acoesCriadas: created } }, meta, tx);
    return { actionsCreated: created };
  });
}

// ---------------------------------------------------------------------------
// Riscos e incidentes
// ---------------------------------------------------------------------------

export async function listRisks(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "safety.read", work)) throw Errors.notFound("Obra");
  return prisma.risk.findMany({ where: { workId }, include: { correctiveActions: { select: { id: true, title: true, status: true } } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
}

export async function createRisk(actor: Actor, input: z.infer<typeof riskSchema>, meta: RequestMeta) {
  const work = await loadWorkFor(actor, input.workId, "safety.inspect");
  const level = await levelOf(prisma, input.criticality);
  return prisma.$transaction(async (tx) => {
    const r = await tx.risk.create({ data: { ...input, unitPath: work.unitPath, createdById: actor.userId } });
    await priorityAlert(tx, level, work, `Risco registrado: ${r.title}`, `/obras/${work.id}?aba=seguranca`, `risco:${r.id}`);
    await recordAudit({ action: "seguranca.risco.criado", actor: auditActor(actor), objectType: "Risk", objectId: r.id, unitPath: work.unitPath, metadata: { obra: work.code, criticidade: r.criticality } }, meta, tx);
    return r;
  });
}

export async function updateRisk(actor: Actor, id: string, input: z.infer<typeof updateRiskSchema>, meta: RequestMeta) {
  const r = await prisma.risk.findUnique({ where: { id }, include: { work: true } });
  if (!r || !canOnWork(actor, "safety.read", r.work)) throw Errors.notFound("Risco");
  assertCanOnWork(actor, "safety.inspect", r.work);
  if (input.criticality) await levelOf(prisma, input.criticality);
  if (input.status === "ENCERRADO" && (await prisma.correctiveAction.count({ where: { riskId: id, status: { in: OPEN } } }))) throw Errors.conflict("Há ações corretivas abertas para este risco.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.risk.update({ where: { id }, data: input });
    await recordAudit({ action: "seguranca.risco.alterado", actor: auditActor(actor), objectType: "Risk", objectId: id, unitPath: r.unitPath, metadata: { campos: Object.keys(input), situacao: input.status } }, meta, tx);
    return u;
  });
}

export async function listIncidents(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "safety.read", work)) throw Errors.notFound("Obra");
  return prisma.incident.findMany({ where: { workId }, include: { correctiveActions: { select: { id: true, title: true, status: true } } }, orderBy: { occurredAt: "desc" } });
}

export async function createIncident(actor: Actor, input: z.infer<typeof incidentSchema>, meta: RequestMeta) {
  const work = await loadWorkFor(actor, input.workId, "safety.inspect");
  const level = await levelOf(prisma, input.criticality);
  if (input.occurredAt > new Date()) throw Errors.invalid("A data do fato não pode estar no futuro.", { occurredAt: ["Data inválida."] });
  return prisma.$transaction(async (tx) => {
    const i = await tx.incident.create({ data: { ...input, unitPath: work.unitPath, reportedById: actor.userId } });
    // Incidentes de qualquer criticidade alertam a obra; os prioritários seguem o fluxo de resposta.
    await priorityAlert(tx, { ...level, priorityAlert: level.priorityAlert || input.type === "ACIDENTE" }, work, `${input.type === "QUASE_ACIDENTE" ? "Quase acidente" : input.type === "ACIDENTE" ? "Acidente" : "Incidente"} registrado`, `/obras/${work.id}?aba=seguranca`, `incidente:${i.id}`);
    await recordAudit({ action: "seguranca.incidente.registrado", actor: auditActor(actor), objectType: "Incident", objectId: i.id, unitPath: work.unitPath, metadata: { obra: work.code, tipo: i.type, criticidade: i.criticality } }, meta, tx);
    return i;
  });
}

// ---------------------------------------------------------------------------
// Ações corretivas
// ---------------------------------------------------------------------------

export async function listActions(actor: Actor, q: { workId?: string; status?: CorrectiveActionStatus; overdue?: boolean } = {}) {
  const scope = workScopedWhere(actor, "safety.read", "workId");
  if (!scope) return [];
  return prisma.correctiveAction.findMany({
    where: {
      AND: [
        scope,
        q.workId ? { workId: q.workId } : {},
        q.status ? { status: q.status } : {},
        q.overdue ? { status: { in: ["ABERTA", "EM_ANDAMENTO"] }, dueDate: { lt: startOfToday() } } : {},
      ],
    },
    include: { work: { select: { id: true, code: true, title: true } } },
    orderBy: [{ dueDate: "asc" }],
    take: 500,
  });
}

export async function createAction(actor: Actor, input: z.infer<typeof actionSchema>, meta: RequestMeta) {
  const work = await loadWorkFor(actor, input.workId, "safety.action");
  const level = await levelOf(prisma, input.criticality);
  if (input.riskId && !(await prisma.risk.findFirst({ where: { id: input.riskId, workId: work.id } }))) throw Errors.invalid("Risco inválido.");
  if (input.incidentId && !(await prisma.incident.findFirst({ where: { id: input.incidentId, workId: work.id } }))) throw Errors.invalid("Incidente inválido.");
  return prisma.$transaction(async (tx) => {
    const a = await tx.correctiveAction.create({ data: { ...input, dueDate: input.dueDate ?? dueFrom(level.responseDays), unitPath: work.unitPath, createdById: actor.userId } });
    if (a.responsibleUserId) {
      await notify([a.responsibleUserId], { kind: "acao.atribuida", severity: "INFO", title: `Ação corretiva atribuída: ${a.title}`, body: `Obra ${work.code}. Prazo: ${a.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}.`, link: `/seguranca/acoes/${a.id}`, dedupKey: `acao-atribuida:${a.id}` }, tx);
    }
    await priorityAlert(tx, level, work, `Ação corretiva ${level.name.toLowerCase()}: ${a.title}`, `/seguranca/acoes/${a.id}`, `acao:${a.id}`);
    await recordAudit({ action: "seguranca.acao.criada", actor: auditActor(actor), objectType: "CorrectiveAction", objectId: a.id, unitPath: work.unitPath, metadata: { obra: work.code, criticidade: a.criticality, prazo: a.dueDate.toISOString().slice(0, 10) } }, meta, tx);
    return a;
  });
}

export async function getAction(actor: Actor, id: string) {
  const a = await prisma.correctiveAction.findUnique({
    where: { id },
    include: { work: true, inspectionItem: { include: { inspection: { select: { id: true, title: true } } } }, risk: { select: { id: true, title: true } }, incident: { select: { id: true, type: true, occurredAt: true } } },
  });
  if (!a || !canOnWork(actor, "safety.read", a.work)) throw Errors.notFound("Ação corretiva");
  const [people, docs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [a.createdById, a.submittedById, a.validatedById].filter(Boolean) as string[] } }, select: { id: true, name: true } }),
    prisma.document.findMany({ where: { workId: a.workId }, select: { id: true, title: true } }),
  ]);
  return {
    ...a,
    people: Object.fromEntries(people.map((p) => [p.id, p.name])),
    documents: docs,
    can: {
      act: canOnWork(actor, "safety.action", a.work) || a.responsibleUserId === actor.userId,
      validate: canOnWork(actor, "safety.validate", a.work) && a.submittedById !== actor.userId,
    },
  };
}

/** Avança a ação: iniciar, enviar evidência, validar (outra pessoa), reprovar ou cancelar. */
export async function advanceAction(
  actor: Actor,
  id: string,
  input: { step: "INICIAR" | "ENVIAR_EVIDENCIA" | "VALIDAR" | "REPROVAR" | "CANCELAR"; evidence?: string | null; evidenceDocumentIds: string[]; note?: string | null },
  meta: RequestMeta,
) {
  const a = await prisma.correctiveAction.findUnique({ where: { id }, include: { work: true } });
  if (!a || !canOnWork(actor, "safety.read", a.work)) throw Errors.notFound("Ação corretiva");
  const canAct = canOnWork(actor, "safety.action", a.work) || a.responsibleUserId === actor.userId;
  const data: Prisma.CorrectiveActionUpdateInput = {};
  switch (input.step) {
    case "INICIAR":
      if (!canAct) throw Errors.forbidden();
      if (a.status !== "ABERTA") throw Errors.conflict("Somente ações abertas podem ser iniciadas.");
      data.status = "EM_ANDAMENTO";
      break;
    case "ENVIAR_EVIDENCIA": {
      if (!canAct) throw Errors.forbidden();
      if (!["ABERTA", "EM_ANDAMENTO"].includes(a.status)) throw Errors.conflict("A ação não aceita evidências nesta situação.");
      if (!input.evidence || input.evidence.length < 10) throw Errors.invalid("Descreva a correção realizada (mínimo de 10 caracteres).", { evidence: ["Evidência obrigatória."] });
      if (input.evidenceDocumentIds.length && (await prisma.document.count({ where: { id: { in: input.evidenceDocumentIds }, workId: a.workId } })) !== input.evidenceDocumentIds.length) {
        throw Errors.invalid("Há evidências que não pertencem à obra.");
      }
      Object.assign(data, { status: "AGUARDANDO_VALIDACAO", evidence: input.evidence, evidenceDocumentIds: input.evidenceDocumentIds, submittedById: actor.userId, submittedAt: new Date() });
      break;
    }
    case "VALIDAR":
    case "REPROVAR":
      assertCanOnWork(actor, "safety.validate", a.work, "Você não pode validar ações corretivas nesta obra.");
      if (a.status !== "AGUARDANDO_VALIDACAO") throw Errors.conflict("A ação não está aguardando validação.");
      if (a.submittedById === actor.userId) throw Errors.forbidden("Por segregação de funções, quem registrou a correção não pode validá-la.");
      if (input.step === "REPROVAR" && (!input.note || input.note.length < 10)) throw Errors.invalid("Explique por que a correção não foi aceita.", { note: ["Motivo obrigatório."] });
      Object.assign(data, input.step === "VALIDAR"
        ? { status: "ENCERRADA", validatedById: actor.userId, validatedAt: new Date(), validationNote: input.note ?? null }
        : { status: "EM_ANDAMENTO", validationNote: input.note });
      break;
    case "CANCELAR":
      assertCanOnWork(actor, "safety.validate", a.work, "Somente quem valida ações pode cancelá-las.");
      if (!OPEN.includes(a.status)) throw Errors.conflict("A ação já foi concluída.");
      if (!input.note || input.note.length < 10) throw Errors.invalid("Justifique o cancelamento.", { note: ["Justificativa obrigatória."] });
      Object.assign(data, { status: "CANCELADA", validationNote: input.note, validatedById: actor.userId, validatedAt: new Date() });
      break;
  }
  return prisma.$transaction(async (tx) => {
    const changed = await tx.correctiveAction.updateMany({ where: { id, status: a.status }, data: data as Prisma.CorrectiveActionUpdateManyMutationInput });
    if (changed.count !== 1) throw Errors.conflict("A ação foi alterada por outra pessoa. Recarregue a página.");
    if (input.step === "ENVIAR_EVIDENCIA") {
      const validators = (await recipientsFor("safety.validate", a.unitPath, a.workId, tx)).filter((u) => u !== actor.userId);
      await notify(validators, { kind: "acao.validacao", severity: "INFO", title: `Ação aguardando validação: ${a.title}`, body: `Obra ${a.work.code}.`, link: `/seguranca/acoes/${a.id}`, dedupKey: `acao-validacao:${a.id}:${Date.now()}` }, tx);
    }
    await recordAudit({ action: `seguranca.acao.${input.step.toLowerCase()}`, actor: auditActor(actor), objectType: "CorrectiveAction", objectId: id, unitPath: a.unitPath, metadata: { obra: a.work.code, de: a.status, para: data.status, observacao: input.note ?? undefined } }, meta, tx);
    return tx.correctiveAction.findUniqueOrThrow({ where: { id } });
  });
}

/** Ações abertas cujo nível de criticidade impede o avanço da obra. */
export async function blockingActions(db: Db, workId: string) {
  const levels = await db.criticalityLevel.findMany({ where: { blocksProgress: true }, select: { code: true } });
  if (!levels.length) return [];
  return db.correctiveAction.findMany({ where: { workId, status: { in: OPEN }, criticality: { in: levels.map((l) => l.code) } }, select: { id: true, title: true } });
}

export async function workSafetySummary(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "safety.read", work)) throw Errors.notFound("Obra");
  const [inspections, risks, incidents, actions, levels, templates] = await Promise.all([
    listInspections(actor, { workId }),
    listRisks(actor, workId),
    listIncidents(actor, workId),
    listActions(actor, { workId }),
    listCriticality(),
    prisma.checklistTemplate.findMany({ where: { active: true, OR: [{ workTypes: { isEmpty: true } }, { workTypes: { has: work.typeCode } }] }, select: { id: true, name: true } }),
  ]);
  return {
    inspections, risks, incidents, actions, levels, templates,
    can: { inspect: canOnWork(actor, "safety.inspect", work), act: canOnWork(actor, "safety.action", work) },
  };
}
