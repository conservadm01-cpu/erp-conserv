import type { PersonCategory, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, assertCanOnWork, can, canOnWork, pathWhere, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import { experienceSummary, personCompliance } from "./health.service";
import type { assignmentSchema, credentialSchema, personSchema, updateAssignmentSchema, updatePersonSchema } from "../validation/phase3";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export async function listPeople(actor: Actor, q: { category?: PersonCategory; q?: string; status?: "ATIVO" | "INATIVO"; regionId?: string } = {}) {
  const scope = pathWhere(actor, "person.read", "unitPath");
  if (!scope) return [];
  // Filtro por região/unidade: soma-se ao escopo (nunca o amplia).
  const region = q.regionId ? await prisma.organizationUnit.findUnique({ where: { id: q.regionId }, select: { path: true } }) : null;
  return prisma.person.findMany({
    where: {
      AND: [
        scope,
        q.regionId ? { unitPath: { startsWith: region?.path ?? "#inexistente" } } : {},
        q.category ? { category: q.category } : {},
        q.status ? { status: q.status } : {},
        q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { jobFunction: { contains: q.q, mode: "insensitive" } }, { internalId: { contains: q.q, mode: "insensitive" } }] } : {},
      ],
    },
    include: { unit: { select: { name: true } }, company: { select: { legalName: true } }, _count: { select: { assignments: { where: { status: "ATIVO" } } } } },
    orderBy: { name: "asc" },
    take: 500,
  });
}

async function loadPerson(actor: Actor, id: string) {
  const p = await prisma.person.findUnique({ where: { id } });
  if (!p || !can(actor, "person.read", p.unitPath)) throw Errors.notFound("Pessoa");
  return p;
}

export async function getPerson(actor: Actor, id: string) {
  await loadPerson(actor, id);
  const person = await prisma.person.findUniqueOrThrow({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      company: { select: { id: true, legalName: true } },
      credentials: { orderBy: [{ status: "asc" }, { expiryDate: "asc" }], include: { document: { select: { id: true, title: true, status: true } } } },
      assignments: { orderBy: { startDate: "desc" }, include: { work: { select: { id: true, code: true, title: true, unitPath: true } } } },
      epiDeliveries: { orderBy: { deliveredAt: "desc" }, include: { catalog: { select: { name: true, caNumber: true } } }, take: 100 },
    },
  });
  const activities = [...new Set([...person.authorizedActivities, ...person.assignments.filter((a) => a.status === "ATIVO").flatMap((a) => a.activities)])];
  const linkedUser = person.userId ? await prisma.user.findUnique({ where: { id: person.userId }, select: { email: true } }) : null;
  return {
    ...person,
    canManage: can(actor, "person.manage", person.unitPath),
    assignments: person.assignments.filter((a) => canOnWork(actor, "work.read", a.work)),
    compliance: await personCompliance(prisma, id, activities),
    experience: experienceSummary(person.credentials),
    linkedEmail: linkedUser?.email ?? null,
  };
}

async function checkRefs(actor: Actor, input: { companyId?: string | null; authorizedActivities?: string[] }) {
  if (input.companyId) {
    const c = await prisma.company.findUnique({ where: { id: input.companyId } });
    if (!c || !can(actor, "company.read", c.unitPath)) throw Errors.invalid("Empresa inválida.", { companyId: ["Empresa não encontrada."] });
  }
  if (input.authorizedActivities?.length) {
    const n = await prisma.activityType.count({ where: { code: { in: input.authorizedActivities } } });
    if (n !== new Set(input.authorizedActivities).size) throw Errors.invalid("Atividade inválida.", { authorizedActivities: ["Há atividades desconhecidas."] });
  }
}

export async function createPerson(actor: Actor, input: z.infer<typeof personSchema>, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.unitId } });
  if (!unit || !can(actor, "person.read", unit.path)) throw Errors.notFound("Unidade");
  assertCan(actor, "person.manage", unit.path, "Você não pode cadastrar pessoas nesta unidade.");
  await checkRefs(actor, input);
  return prisma.$transaction(async (tx) => {
    const p = await tx.person.create({ data: { ...input, unitPath: unit.path, createdById: actor.userId } });
    await recordAudit({ action: "pessoa.criada", actor: auditActor(actor), objectType: "Person", objectId: p.id, unitPath: p.unitPath, metadata: { categoria: p.category } }, meta, tx);
    return p;
  });
}

export async function updatePerson(actor: Actor, id: string, input: z.infer<typeof updatePersonSchema>, meta: RequestMeta) {
  const p = await loadPerson(actor, id);
  assertCan(actor, "person.manage", p.unitPath, "Você não pode alterar este cadastro.");
  await checkRefs(actor, input);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.person.update({ where: { id }, data: input });
    // Não registra valores pessoais na auditoria, apenas os campos alterados.
    await recordAudit({ action: "pessoa.alterada", actor: auditActor(actor), objectType: "Person", objectId: id, unitPath: p.unitPath, metadata: { campos: Object.keys(input) } }, meta, tx);
    return updated;
  });
}

export async function addCredential(actor: Actor, personId: string, input: z.infer<typeof credentialSchema>, meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "person.manage", p.unitPath, "Você não pode alterar este cadastro.");
  if (input.documentId && !(await prisma.document.findFirst({ where: { id: input.documentId, personId } }))) {
    throw Errors.invalid("O documento precisa estar no cadastro desta pessoa.", { documentId: ["Documento inválido."] });
  }
  if (input.issueDate && input.expiryDate && input.expiryDate < input.issueDate) throw Errors.invalid("A validade deve ser posterior à emissão.", { expiryDate: ["Data inválida."] });
  return prisma.$transaction(async (tx) => {
    const c = await tx.professionalCredential.create({ data: { ...input, personId } });
    await recordAudit({ action: "pessoa.qualificacao.criada", actor: auditActor(actor), objectType: "ProfessionalCredential", objectId: c.id, unitPath: p.unitPath, metadata: { tipo: c.kind, nome: c.name } }, meta, tx);
    return c;
  });
}

/** Registra que a qualificação foi conferida em fonte oficial (nunca automático). */
export async function verifyCredential(actor: Actor, personId: string, credentialId: string, source: string, meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "person.manage", p.unitPath);
  const c = await prisma.professionalCredential.findFirst({ where: { id: credentialId, personId } });
  if (!c) throw Errors.notFound("Qualificação");
  return prisma.$transaction(async (tx) => {
    const u = await tx.professionalCredential.update({ where: { id: credentialId }, data: { verifiedAt: new Date(), verifiedById: actor.userId, verificationSource: source } });
    await recordAudit({ action: "pessoa.qualificacao.conferida", actor: auditActor(actor), objectType: "ProfessionalCredential", objectId: c.id, unitPath: p.unitPath, metadata: { fonte: source } }, meta, tx);
    return u;
  });
}

export async function setCredentialStatus(actor: Actor, personId: string, credentialId: string, status: "ATIVO" | "INATIVO", meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "person.manage", p.unitPath);
  const c = await prisma.professionalCredential.findFirst({ where: { id: credentialId, personId } });
  if (!c) throw Errors.notFound("Qualificação");
  await prisma.$transaction(async (tx) => {
    await tx.professionalCredential.update({ where: { id: credentialId }, data: { status } });
    await recordAudit({ action: "pessoa.qualificacao.situacao", actor: auditActor(actor), objectType: "ProfessionalCredential", objectId: c.id, unitPath: p.unitPath, metadata: { para: status } }, meta, tx);
  });
}

/** Vincula uma pessoa a uma obra. Avisa (sem bloquear) quando faltam qualificação ou integração. */
export async function addAssignment(actor: Actor, personId: string, input: z.infer<typeof assignmentSchema>, meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  if (p.status !== "ATIVO") throw Errors.conflict("A pessoa está inativa.");
  const work = await prisma.work.findUnique({ where: { id: input.workId } });
  if (!work || !canOnWork(actor, "work.read", work)) throw Errors.notFound("Obra");
  if (!can(actor, "person.manage", p.unitPath) && !canOnWork(actor, "work.manage", work)) throw Errors.forbidden("Você não pode vincular pessoas a esta obra.");
  assertCanOnWork(actor, "work.read", work);
  if (["CONCLUIDA", "ARQUIVADA", "REJEITADA"].includes(work.status)) throw Errors.conflict("A obra não aceita novos vínculos.");
  if (input.endDate && input.endDate < input.startDate) throw Errors.invalid("O término deve ser posterior ao início.", { endDate: ["Data inválida."] });
  const notAuthorized = input.activities.filter((a) => !p.authorizedActivities.includes(a));
  // Exigências por atividade: só bloqueiam quando validadas e marcadas como bloqueantes.
  const compliance = await personCompliance(prisma, personId, input.activities);
  const blocked = compliance.filter((c) => c.blocking && !c.met);
  if (blocked.length) {
    throw Errors.conflict(`Vínculo não permitido. Pendências: ${blocked.map((c) => `${c.activityName}: ${c.name}`).join("; ")}.`);
  }
  const pending = compliance.filter((c) => !c.met);
  return prisma.$transaction(async (tx) => {
    const a = await tx.volunteerAssignment.create({ data: { ...input, endDate: input.endDate ?? null, safetyBriefingAt: input.safetyBriefingAt ?? null, personId, createdById: actor.userId } });
    await recordAudit(
      { action: "pessoa.vinculo.criado", actor: auditActor(actor), objectType: "VolunteerAssignment", objectId: a.id, unitPath: work.unitPath, metadata: { obra: work.code, funcao: a.role, atividadesNaoAutorizadas: notAuthorized, integracaoRegistrada: Boolean(a.safetyBriefingAt) } },
      meta,
      tx,
    );
    return {
      assignment: a,
      warnings: [
        ...(notAuthorized.length ? ["Há atividades não autorizadas no cadastro da pessoa."] : []),
        ...(!a.safetyBriefingAt ? ["Orientação de segurança/integração ainda não registrada."] : []),
        ...pending.map((c) => `${c.activityName}: ${c.name} — ${c.detail}${c.validated ? "" : " (exigência pendente de validação)"}`),
      ],
    };
  });
}

export async function updateAssignment(actor: Actor, personId: string, assignmentId: string, input: z.infer<typeof updateAssignmentSchema>, meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  const a = await prisma.volunteerAssignment.findFirst({ where: { id: assignmentId, personId }, include: { work: true } });
  if (!a || !canOnWork(actor, "work.read", a.work)) throw Errors.notFound("Vínculo");
  if (!can(actor, "person.manage", p.unitPath) && !canOnWork(actor, "work.manage", a.work)) throw Errors.forbidden();
  return prisma.$transaction(async (tx) => {
    const u = await tx.volunteerAssignment.update({ where: { id: assignmentId }, data: input });
    await recordAudit({ action: "pessoa.vinculo.alterado", actor: auditActor(actor), objectType: "VolunteerAssignment", objectId: a.id, unitPath: a.work.unitPath, metadata: { obra: a.work.code, campos: Object.keys(input) } }, meta, tx);
    return u;
  });
}

export async function listWorkTeam(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "work.read", work)) throw Errors.notFound("Obra");
  const assignments = await prisma.volunteerAssignment.findMany({
    where: { workId },
    include: { person: { select: { id: true, name: true, category: true, unitPath: true, credentials: { where: { status: "ATIVO" }, select: { kind: true, name: true, expiryDate: true } } } } },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  return assignments.map((a) => ({ ...a, personVisible: can(actor, "person.read", a.person.unitPath) }));
}

export type PersonWithRelations = Prisma.PersonGetPayload<{ include: { unit: true } }>;
