import type { CredentialKind, HealthCertificate, ProfessionalCredential } from "@prisma/client";
import type { z } from "zod";
import { prisma, type Db } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, assertCanAnywhere, can, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { healthCertificateSchema, personRuleUpdateSchema, selfCredentialSchema } from "../validation/health";
import { storeOwnedDocument, type UploadedFile } from "./document.service";
import { getRootUnit } from "./org-unit.service";
import { startOfToday } from "./requirement.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

async function loadPerson(actor: Actor, id: string) {
  const p = await prisma.person.findUnique({ where: { id } });
  if (!p || !can(actor, "person.read", p.unitPath)) throw Errors.notFound("Pessoa");
  return p;
}

// ---------------------------------------------------------------------------
// Exigências por atividade (situação de cada pessoa)
// ---------------------------------------------------------------------------

const validCredential = (c: Pick<ProfessionalCredential, "status" | "expiryDate">, today: Date) => c.status === "ATIVO" && (!c.expiryDate || c.expiryDate >= today);
const validHealth = (h: Pick<HealthCertificate, "status" | "result" | "expiryDate" | "fitFor">, activity: string, today: Date) =>
  h.status === "CONFERIDO" && h.result === "APTO" && h.fitFor.includes(activity) && (!h.expiryDate || h.expiryDate >= today);

/**
 * Confere as exigências cadastradas para as atividades informadas. Para saúde, informa
 * apenas se há ASO conferido e válido — nunca detalhes do exame.
 */
export async function personCompliance(db: Db, personId: string, activities: string[]) {
  if (!activities.length) return [];
  const today = startOfToday();
  const [rules, credentials, health, acts] = await Promise.all([
    db.personRequirementRule.findMany({ where: { activityCode: { in: activities }, status: { not: "INATIVA" } }, orderBy: [{ activityCode: "asc" }, { code: "asc" }] }),
    db.professionalCredential.findMany({ where: { personId } }),
    db.healthCertificate.findMany({ where: { personId } }),
    db.activityType.findMany({ where: { code: { in: activities } } }),
  ]);
  return rules.map((r) => {
    let met: boolean;
    let detail: string;
    if (r.kind === "CREDENCIAL") {
      const match = credentials.filter(
        (c) => (!r.credentialKind || c.kind === r.credentialKind) && (!r.credentialNameContains || c.name.toLowerCase().includes(r.credentialNameContains.toLowerCase())),
      );
      const ok = match.find((c) => validCredential(c, today));
      met = Boolean(ok);
      detail = ok ? `${ok.name}${ok.expiryDate ? ` — válido até ${ok.expiryDate.toISOString().slice(0, 10)}` : ""}${ok.verifiedAt ? " (conferido)" : " (não conferido em fonte oficial)"}` : match.length ? "Registro vencido ou inativo" : "Nenhum registro correspondente";
    } else {
      met = health.some((h) => validHealth(h, r.activityCode, today));
      detail = met ? "ASO conferido e válido para a atividade" : "Sem ASO conferido e válido para a atividade";
    }
    return {
      ruleId: r.id, code: r.code, name: r.name, activityCode: r.activityCode, activityName: acts.find((a) => a.code === r.activityCode)?.name ?? r.activityCode,
      kind: r.kind, met, detail, validated: r.status === "VALIDADA", blocking: r.status === "VALIDADA" && r.blocking,
    };
  });
}

/** Comprovação de experiência (para profissionais e técnicos). */
export function experienceSummary(credentials: Pick<ProfessionalCredential, "kind" | "status" | "verifiedAt">[]) {
  const exp = credentials.filter((c) => c.kind === "EXPERIENCIA" && c.status === "ATIVO");
  return { total: exp.length, verified: exp.filter((c) => c.verifiedAt).length };
}

// ---------------------------------------------------------------------------
// ASO (restrito)
// ---------------------------------------------------------------------------

export async function listHealthCertificates(actor: Actor, personId: string) {
  const p = await loadPerson(actor, personId);
  if (!can(actor, "health.read", p.unitPath)) return null;
  return prisma.healthCertificate.findMany({ where: { personId }, orderBy: [{ status: "asc" }, { examDate: "desc" }], include: { document: { select: { id: true, versions: { where: { supersededAt: null }, select: { id: true } } } } } });
}

async function storeAso(actor: Actor, person: { id: string; unitPath: string; name: string }, examDate: Date, file: UploadedFile, meta: RequestMeta) {
  return storeOwnedDocument(
    actor, { kind: "person", id: person.id }, { unitPath: person.unitPath, link: { personId: person.id }, label: person.name },
    { categoryCode: "ASO", title: `ASO de ${examDate.toISOString().slice(0, 10)}`, issuer: null, documentNumber: null, issueDate: examDate, expiryDate: null },
    file, meta,
  );
}

export async function addHealthCertificate(
  actor: Actor, personId: string, input: z.infer<typeof healthCertificateSchema> & { checked?: boolean }, file: UploadedFile | null, meta: RequestMeta,
) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "health.manage", p.unitPath, "Você não pode registrar ASO.");
  if (input.fitFor.length && (await prisma.activityType.count({ where: { code: { in: input.fitFor } } })) !== new Set(input.fitFor).size) {
    throw Errors.invalid("Atividade inválida.", { fitFor: ["Há atividades desconhecidas."] });
  }
  const doc = file ? await storeAso(actor, p, input.examDate, file, meta) : null;
  return prisma.$transaction(async (tx) => {
    const { checked, ...data } = input;
    const h = await tx.healthCertificate.create({
      data: { ...data, personId, documentId: doc?.id ?? null, createdById: actor.userId, ...(checked ? { status: "CONFERIDO", checkedById: actor.userId, checkedAt: new Date() } : {}) },
    });
    // Sem detalhes clínicos na auditoria: apenas o registro e a conclusão.
    await recordAudit({ action: "saude.aso.registrado", actor: auditActor(actor), objectType: "HealthCertificate", objectId: h.id, unitPath: p.unitPath, metadata: { conferido: Boolean(checked), comArquivo: Boolean(doc) } }, meta, tx);
    return h;
  });
}

export async function reviewHealthCertificate(actor: Actor, personId: string, certificateId: string, decision: "CONFERIR" | "INATIVAR", meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "health.manage", p.unitPath, "Você não pode conferir ASO.");
  const h = await prisma.healthCertificate.findFirst({ where: { id: certificateId, personId } });
  if (!h) throw Errors.notFound("ASO");
  if (decision === "CONFERIR" && h.status !== "PENDENTE_CONFERENCIA") throw Errors.conflict("Este ASO não está aguardando conferência.");
  if (decision === "INATIVAR" && h.status === "INATIVO") throw Errors.conflict("Este ASO já está inativo.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.healthCertificate.update({
      where: { id: certificateId },
      data: decision === "CONFERIR" ? { status: "CONFERIDO", checkedById: actor.userId, checkedAt: new Date() } : { status: "INATIVO" },
    });
    await recordAudit({ action: decision === "CONFERIR" ? "saude.aso.conferido" : "saude.aso.inativado", actor: auditActor(actor), objectType: "HealthCertificate", objectId: h.id, unitPath: p.unitPath }, meta, tx);
    return u;
  });
}

// ---------------------------------------------------------------------------
// Portal do titular (voluntário e demais pessoas com conta vinculada)
// ---------------------------------------------------------------------------

async function myPerson(actor: Actor) {
  assertCanAnywhere(actor, "self.portal");
  const p = await prisma.person.findUnique({ where: { userId: actor.userId } });
  if (!p) throw Errors.notFound("Cadastro vinculado à sua conta");
  return p;
}

export async function getMyProfile(actor: Actor) {
  const p = await myPerson(actor);
  const person = await prisma.person.findUniqueOrThrow({
    where: { id: p.id },
    include: {
      unit: { select: { name: true } },
      credentials: { orderBy: [{ status: "asc" }, { expiryDate: "asc" }], include: { document: { select: { id: true, status: true, versions: { where: { supersededAt: null }, select: { id: true } } } } } },
      healthCertificates: { orderBy: { examDate: "desc" }, include: { document: { select: { id: true, versions: { where: { supersededAt: null }, select: { id: true } } } } } },
      assignments: { orderBy: { startDate: "desc" }, include: { work: { select: { code: true, title: true, status: true } } } },
    },
  });
  const activities = [...new Set([...person.authorizedActivities, ...person.assignments.filter((a) => a.status === "ATIVO").flatMap((a) => a.activities)])];
  const [compliance, acts] = await Promise.all([personCompliance(prisma, p.id, activities), prisma.activityType.findMany({ orderBy: { name: "asc" } })]);
  return { person, compliance, activities: acts };
}

const SELF_CATEGORY: Record<string, string> = { EXPERIENCIA: "EXPERIENCIA", TREINAMENTO: "TREINAMENTO", REGISTRO_CONSELHO: "REGISTRO_PROFISSIONAL" };

export async function uploadMyCredential(actor: Actor, input: z.infer<typeof selfCredentialSchema>, file: UploadedFile, meta: RequestMeta) {
  const p = await myPerson(actor);
  if (input.issueDate && input.expiryDate && input.expiryDate < input.issueDate) throw Errors.invalid("A validade deve ser posterior à emissão.", { expiryDate: ["Data inválida."] });
  const doc = await storeOwnedDocument(
    actor, { kind: "person", id: p.id }, { unitPath: p.unitPath, link: { personId: p.id }, label: p.name },
    { categoryCode: SELF_CATEGORY[input.kind] ?? "OUTRO", title: input.name, issuer: input.issuer ?? null, documentNumber: null, issueDate: input.issueDate, expiryDate: input.expiryDate },
    file, meta,
  );
  return prisma.$transaction(async (tx) => {
    const c = await tx.professionalCredential.create({ data: { personId: p.id, kind: input.kind as CredentialKind, name: input.name, issuer: input.issuer ?? null, issueDate: input.issueDate, expiryDate: input.expiryDate, documentId: doc.id } });
    await recordAudit({ action: "portal.comprovante.enviado", actor: auditActor(actor), objectType: "ProfessionalCredential", objectId: c.id, unitPath: p.unitPath, metadata: { tipo: c.kind } }, meta, tx);
    return c;
  });
}

export async function uploadMyHealthCertificate(actor: Actor, input: z.infer<typeof healthCertificateSchema>, file: UploadedFile, meta: RequestMeta) {
  const p = await myPerson(actor);
  if (input.fitFor.length && (await prisma.activityType.count({ where: { code: { in: input.fitFor } } })) !== new Set(input.fitFor).size) {
    throw Errors.invalid("Atividade inválida.", { fitFor: ["Há atividades desconhecidas."] });
  }
  const doc = await storeAso(actor, p, input.examDate, file, meta);
  return prisma.$transaction(async (tx) => {
    // Enviado pelo titular: fica aguardando conferência por quem tem permissão de saúde.
    const h = await tx.healthCertificate.create({ data: { ...input, personId: p.id, documentId: doc.id, createdById: actor.userId } });
    await recordAudit({ action: "portal.aso.enviado", actor: auditActor(actor), objectType: "HealthCertificate", objectId: h.id, unitPath: p.unitPath }, meta, tx);
    return h;
  });
}

/** Vincula (ou desvincula, com e-mail vazio) a conta de acesso do titular ao cadastro da pessoa. */
export async function linkPersonUser(actor: Actor, personId: string, email: string, meta: RequestMeta) {
  const p = await loadPerson(actor, personId);
  assertCan(actor, "person.manage", p.unitPath, "Você não pode alterar este cadastro.");
  let userId: string | null = null;
  if (email) {
    const u = await prisma.user.findUnique({ where: { email }, include: { homeUnit: { select: { path: true } } } });
    if (!u || !can(actor, "user.read", u.homeUnit.path)) throw Errors.invalid("Usuário não encontrado no seu escopo.", { email: ["Usuário não encontrado."] });
    const other = await prisma.person.findUnique({ where: { userId: u.id } });
    if (other && other.id !== personId) throw Errors.conflict("Esta conta já está vinculada a outro cadastro.");
    userId = u.id;
  }
  return prisma.$transaction(async (tx) => {
    const u = await tx.person.update({ where: { id: personId }, data: { userId } });
    await recordAudit({ action: userId ? "pessoa.conta.vinculada" : "pessoa.conta.desvinculada", actor: auditActor(actor), objectType: "Person", objectId: personId, unitPath: p.unitPath, metadata: { usuario: userId } }, meta, tx);
    return u;
  });
}

// ---------------------------------------------------------------------------
// Configuração das exigências por atividade (gestão central)
// ---------------------------------------------------------------------------

export async function listPersonRules(actor: Actor) {
  assertCanAnywhere(actor, "requirement.read");
  const [rules, acts] = await Promise.all([prisma.personRequirementRule.findMany({ orderBy: [{ activityCode: "asc" }, { code: "asc" }] }), prisma.activityType.findMany()]);
  return rules.map((r) => ({ ...r, activityName: acts.find((a) => a.code === r.activityCode)?.name ?? r.activityCode }));
}

export async function updatePersonRule(actor: Actor, id: string, input: z.infer<typeof personRuleUpdateSchema>, meta: RequestMeta) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "requirement.manage", root.path, "A configuração de exigências é restrita à gestão central.");
  const rule = await prisma.personRequirementRule.findUnique({ where: { id } });
  if (!rule) throw Errors.notFound("Exigência");
  const data =
    input.action === "validar"
      ? { status: "VALIDADA" as const, legalBasis: input.legalBasis, sourceUrl: input.sourceUrl, lastReviewedAt: input.lastReviewedAt, blocking: Boolean(input.blocking), validatedAt: new Date(), validatedById: actor.userId }
      : input.action === "inativar"
        ? { status: "INATIVA" as const, blocking: false, validatedAt: null, validatedById: null }
        : { status: "PENDENTE_VALIDACAO" as const, blocking: false, validatedAt: null, validatedById: null };
  if (input.action === "validar" && rule.status === "INATIVA") throw Errors.conflict("Reative a exigência antes de validá-la.");
  return prisma.$transaction(async (tx) => {
    const u = await tx.personRequirementRule.update({ where: { id }, data });
    await recordAudit({ action: `pessoa.exigencia.${input.action}`, actor: auditActor(actor), objectType: "PersonRequirementRule", objectId: id, metadata: { codigo: rule.code, bloqueante: u.blocking, base: u.legalBasis } }, meta, tx);
    return u;
  });
}

