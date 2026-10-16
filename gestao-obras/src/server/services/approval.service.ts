import type { ApprovalKind, Prisma, Work } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, canOnWork, workScopedWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { findApprovalTransition, STATUS_LABEL } from "../domain/work-state";
import { getRootUnit } from "./org-unit.service";
import { blockingIssues } from "./requirement.service";
import { applyStatusChange } from "./work.service";
import { applySubjectOutcome, assertSubjectPending, SUBJECT_KINDS } from "./approval-subjects";
import { Prisma as P } from "@prisma/client";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

const EXPECTED_STATUS: Partial<Record<ApprovalKind, Work["status"]>> = {
  SOLICITACAO_OBRA: "EM_APROVACAO",
  ENCERRAMENTO_OBRA: "EM_VISTORIA",
};

/** Número de decisões: pela faixa de valor (se houver alçadas) ou pela política do tipo. */
async function stepsFor(tx: Tx, kind: ApprovalKind, amount: number | null, fallback: number) {
  if (amount === null) return fallback;
  const tiers = await tx.approvalTier.findMany({ where: { kind } });
  if (!tiers.length) return fallback;
  const sorted = tiers.sort((a, b) => (a.upToAmount === null ? 1 : b.upToAmount === null ? -1 : Number(a.upToAmount) - Number(b.upToAmount)));
  const tier = sorted.find((t) => t.upToAmount === null || amount <= Number(t.upToAmount));
  return tier?.stepsRequired ?? fallback;
}

/** Abre aprovação para orçamento, medição, despesa ou mudança de escopo. */
export async function openSubjectApproval(
  tx: Tx,
  actor: Actor,
  work: Work,
  input: { kind: ApprovalKind; subjectId: string; amount: number | null; snapshot: Record<string, unknown>; note: string | null },
  meta: RequestMeta,
) {
  const policy = await tx.approvalPolicy.findUnique({ where: { kind: input.kind } });
  if (!policy) throw Errors.conflict("Fluxo de aprovação não configurado.");
  const steps = await stepsFor(tx, input.kind, input.amount, policy.stepsRequired);
  const approval = await tx.approval.create({
    data: {
      kind: input.kind, workId: work.id, unitPath: work.unitPath, subjectId: input.subjectId, amount: input.amount === null ? null : new P.Decimal(input.amount),
      subjectVersion: work.version, snapshot: input.snapshot as P.InputJsonValue, stepsRequired: steps, requireSegregation: policy.requireSegregation,
      requesterId: actor.userId, requestNote: input.note,
    },
  });
  await recordAudit(
    { action: "aprovacao.aberta", actor: auditActor(actor), objectType: "Approval", objectId: approval.id, unitPath: work.unitPath, metadata: { obra: work.code, tipo: input.kind, objeto: input.subjectId, valor: input.amount ?? undefined, decisoesNecessarias: steps } },
    meta,
    tx,
  );
  return approval;
}

/** Abre uma aprovação copiando a política vigente e os dados submetidos (chamado na transição). */
export async function openApproval(tx: Tx, actor: Actor, work: Work, kind: ApprovalKind, note: string | null, meta: RequestMeta) {
  const policy = await tx.approvalPolicy.findUnique({ where: { kind } });
  if (!policy) throw Errors.conflict("Fluxo de aprovação não configurado.");
  await tx.approval.updateMany({ where: { workId: work.id, status: "PENDENTE" }, data: { status: "CANCELADA", decidedAt: new Date() } });
  const [stages, documents] = await Promise.all([
    tx.workStage.findMany({ where: { workId: work.id }, orderBy: { sortOrder: "asc" } }),
    tx.document.findMany({ where: { workId: work.id }, select: { id: true, title: true, status: true, categoryCode: true, _count: { select: { versions: true } } } }),
  ]);
  const snapshot = {
    codigo: work.code, titulo: work.title, tipo: work.typeCode, atividades: work.activities, prioridade: work.priority,
    formaExecucao: work.executionMode, escopo: work.scope, justificativa: work.justification,
    inicioPrevisto: work.plannedStart?.toISOString().slice(0, 10) ?? null, terminoPrevisto: work.plannedEnd?.toISOString().slice(0, 10) ?? null,
    etapas: stages.map((s) => ({ nome: s.name, situacao: s.status, progresso: s.progress })),
    documentos: documents.map((d) => ({ id: d.id, titulo: d.title, situacao: d.status, categoria: d.categoryCode, versoes: d._count.versions })),
  };
  const approval = await tx.approval.create({
    data: {
      kind, workId: work.id, unitPath: work.unitPath, subjectVersion: work.version, snapshot,
      stepsRequired: policy.stepsRequired, requireSegregation: policy.requireSegregation, requesterId: actor.userId, requestNote: note,
    },
  });
  await recordAudit(
    { action: "aprovacao.aberta", actor: auditActor(actor), objectType: "Approval", objectId: approval.id, unitPath: work.unitPath, metadata: { obra: work.code, tipo: kind, versao: work.version, decisoesNecessarias: policy.stepsRequired } },
    meta,
    tx,
  );
  return approval;
}

/** Fila da gestão central: aprovações e documentos aguardando análise, no escopo do ator. */
export async function listInbox(actor: Actor) {
  const approvalScope = workScopedWhere(actor, "approval.decide", "workId");
  const reviewScope = workScopedWhere(actor, "document.review", "workId");
  const [approvals, documents] = await Promise.all([
    approvalScope
      ? prisma.approval.findMany({
          where: { AND: [approvalScope, { status: "PENDENTE" }] },
          include: { work: { select: { id: true, code: true, title: true, createdById: true, unit: { select: { name: true } } } }, steps: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    reviewScope
      ? prisma.document.findMany({
          where: { AND: [reviewScope, { status: { in: ["ENVIADO", "EM_REVISAO"] } }] },
          include: {
            work: { select: { id: true, code: true, title: true } },
            person: { select: { id: true, name: true } },
            company: { select: { id: true, legalName: true } },
            equipment: { select: { id: true, name: true } },
            category: { select: { name: true } },
            versions: { where: { supersededAt: null }, select: { uploadedById: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);
  const requesters = await prisma.user.findMany({ where: { id: { in: approvals.map((a) => a.requesterId) } }, select: { id: true, name: true } });
  return {
    approvals: approvals.map((a) => ({
      ...a,
      requesterName: requesters.find((r) => r.id === a.requesterId)?.name ?? "—",
      ownRequest: a.requireSegregation && (a.requesterId === actor.userId || (!SUBJECT_KINDS.includes(a.kind) && a.work.createdById === actor.userId)),
      alreadyDecided: a.steps.some((s) => s.approverId === actor.userId),
    })),
    documents: documents.map((d) => ({ ...d, ownUpload: d.versions.some((v) => v.uploadedById === actor.userId) })),
  };
}

export async function getApproval(actor: Actor, id: string) {
  const approval = await prisma.approval.findUnique({
    where: { id },
    include: { work: true, steps: { orderBy: { stepNo: "asc" } } },
  });
  if (!approval || !(canOnWork(actor, "approval.decide", approval.work) || canOnWork(actor, "work.read", approval.work))) throw Errors.notFound("Aprovação");
  const [documents, people, issues] = await Promise.all([
    prisma.document.findMany({ where: { workId: approval.workId }, include: { category: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { id: { in: [approval.requesterId, ...approval.steps.map((s) => s.approverId)] } }, select: { id: true, name: true } }),
    SUBJECT_KINDS.includes(approval.kind) ? Promise.resolve([]) : blockingIssues(prisma, approval.workId, approval.kind === "SOLICITACAO_OBRA" ? "APROVACAO" : "ENCERRAMENTO"),
  ]);
  const own = approval.requireSegregation && (approval.requesterId === actor.userId || (!SUBJECT_KINDS.includes(approval.kind) && approval.work.createdById === actor.userId));
  return {
    ...approval,
    documents,
    people: Object.fromEntries(people.map((p) => [p.id, p.name])),
    blockingIssues: issues.map((i) => i.rule.name),
    canDecide:
      approval.status === "PENDENTE" && canOnWork(actor, "approval.decide", approval.work) && !own && !approval.steps.some((s) => s.approverId === actor.userId),
    ownRequest: own,
  };
}

export async function decideApproval(
  actor: Actor,
  id: string,
  input: { decision: "APROVAR" | "REJEITAR" | "DEVOLVER"; opinion: string; consultedDocumentIds: string[] },
  meta: RequestMeta,
) {
  return prisma.$transaction(async (tx) => {
    // Bloqueia a linha para que decisões simultâneas não se sobreponham.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM approval WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked.length) throw Errors.notFound("Aprovação");
    const approval = await tx.approval.findUniqueOrThrow({ where: { id }, include: { work: true, steps: true } });
    const work = approval.work;
    if (!canOnWork(actor, "approval.decide", work)) {
      if (!canOnWork(actor, "work.read", work)) throw Errors.notFound("Aprovação");
      throw Errors.forbidden("Você não pode decidir aprovações desta obra.");
    }
    if (approval.status !== "PENDENTE") throw Errors.conflict("Esta aprovação já foi concluída.");
    const isSubject = SUBJECT_KINDS.includes(approval.kind);
    if (approval.requireSegregation && (approval.requesterId === actor.userId || (!isSubject && work.createdById === actor.userId))) {
      await recordAudit({ action: "aprovacao.negada_segregacao", result: "NEGADO", actor: auditActor(actor), objectType: "Approval", objectId: id, unitPath: work.unitPath }, meta);
      throw Errors.forbidden("Por segregação de funções, você não pode decidir uma solicitação que você mesmo fez ou cadastrou.");
    }
    if (approval.steps.some((s) => s.approverId === actor.userId)) throw Errors.conflict("Você já registrou sua decisão nesta aprovação.");
    if (isSubject) {
      await assertSubjectPending(tx, approval.kind, approval.subjectId!);
    } else if (work.status !== EXPECTED_STATUS[approval.kind] || work.version !== approval.subjectVersion) {
      throw Errors.conflict("A obra mudou depois da submissão. A aprovação precisa ser reaberta.");
    }
    if (input.consultedDocumentIds.length) {
      const count = await tx.document.count({ where: { id: { in: input.consultedDocumentIds }, workId: work.id } });
      if (count !== new Set(input.consultedDocumentIds).size) throw Errors.invalid("Há documentos consultados que não pertencem à obra.");
    }

    await tx.approvalStep.create({
      data: { approvalId: id, stepNo: approval.steps.length + 1, approverId: actor.userId, decision: input.decision, opinion: input.opinion, consultedDocumentIds: [...new Set(input.consultedDocumentIds)] },
    });
    await recordAudit(
      { action: "aprovacao.decisao", actor: auditActor(actor), objectType: "Approval", objectId: id, unitPath: work.unitPath, metadata: { obra: work.code, decisao: input.decision, etapa: approval.steps.length + 1, documentosConsultados: input.consultedDocumentIds.length } },
      meta,
      tx,
    );

    const favorable = approval.steps.filter((s) => s.decision === "APROVAR").length + (input.decision === "APROVAR" ? 1 : 0);
    if (input.decision === "APROVAR" && favorable < approval.stepsRequired) {
      return { status: "PENDENTE" as const, remaining: approval.stepsRequired - favorable };
    }
    const final = input.decision === "APROVAR" ? "APROVADA" : input.decision === "REJEITAR" ? "REJEITADA" : "DEVOLVIDA";
    if (isSubject) {
      await tx.approval.update({ where: { id }, data: { status: final, decidedAt: new Date() } });
      await applySubjectOutcome(tx, approval.kind, approval.subjectId!, work.id, input.decision, actor.userId);
      await recordAudit(
        { action: `aprovacao.${approval.kind.toLowerCase()}.${final.toLowerCase()}`, actor: auditActor(actor), objectType: approval.kind, objectId: approval.subjectId!, unitPath: work.unitPath, metadata: { obra: work.code, aprovacao: id } },
        meta,
        tx,
      );
      return { status: final, remaining: 0 };
    }
    const transition = findApprovalTransition(work.status, input.decision);
    if (!transition) throw Errors.conflict(`Decisão incompatível com a situação "${STATUS_LABEL[work.status]}".`);
    if (input.decision === "APROVAR" && transition.checkpoint) {
      const issues = await blockingIssues(tx, work.id, transition.checkpoint);
      if (issues.length) throw Errors.conflict(`Há requisito(s) bloqueante(s) pendente(s): ${issues.map((i) => i.rule.name).join("; ")}.`);
    }
    await tx.approval.update({ where: { id }, data: { status: final, decidedAt: new Date() } });
    await applyStatusChange(tx, work, transition.to, { actor, reason: input.decision === "APROVAR" ? null : input.opinion, approvalId: id, action: transition.action }, meta);
    return { status: final, remaining: 0 };
  });
}

// ---------------------------------------------------------------------------
// Políticas (alçadas e fluxos)
// ---------------------------------------------------------------------------

export async function listPolicies() {
  return prisma.approvalPolicy.findMany({ orderBy: { kind: "asc" } });
}

export async function updatePolicy(actor: Actor, kind: ApprovalKind, input: { stepsRequired: number; requireSegregation: boolean }, meta: RequestMeta) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "approval.policy.manage", root.path, "A configuração de fluxos é restrita à gestão central.");
  const before = await prisma.approvalPolicy.findUnique({ where: { kind } });
  if (!before) throw Errors.notFound("Fluxo");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.approvalPolicy.update({ where: { kind }, data: input });
    await recordAudit(
      { action: "aprovacao.politica.alterada", actor: auditActor(actor), objectType: "ApprovalPolicy", objectId: kind, metadata: { antes: { etapas: before.stepsRequired, segregacao: before.requireSegregation }, depois: { etapas: input.stepsRequired, segregacao: input.requireSegregation } } },
      meta,
      tx,
    );
    return updated;
  });
}

export async function listTiers() {
  return prisma.approvalTier.findMany({ orderBy: [{ kind: "asc" }, { upToAmount: { sort: "asc", nulls: "last" } }] });
}

/** Substitui as faixas de alçada de um tipo (somente gestão central). */
export async function replaceTiers(actor: Actor, kind: ApprovalKind, tiers: { upToAmount: number | null; stepsRequired: number }[], meta: RequestMeta) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "approval.policy.manage", root.path, "A configuração de alçadas é restrita à gestão central.");
  const open = tiers.filter((t) => t.upToAmount === null).length;
  if (tiers.length && open !== 1) throw Errors.invalid("Inclua exatamente uma faixa sem limite superior (acima do último valor).");
  const limits = tiers.filter((t) => t.upToAmount !== null).map((t) => t.upToAmount!);
  if (new Set(limits).size !== limits.length) throw Errors.invalid("Há faixas com o mesmo limite.");
  return prisma.$transaction(async (tx) => {
    await tx.approvalTier.deleteMany({ where: { kind } });
    if (tiers.length) await tx.approvalTier.createMany({ data: tiers.map((t) => ({ kind, upToAmount: t.upToAmount === null ? null : new P.Decimal(t.upToAmount), stepsRequired: t.stepsRequired })) });
    await recordAudit({ action: "aprovacao.alcadas.alteradas", actor: auditActor(actor), objectType: "ApprovalTier", objectId: kind, metadata: { faixas: tiers } }, meta, tx);
  });
}

export type ApprovalWithWork = Prisma.ApprovalGetPayload<{ include: { work: true } }>;
