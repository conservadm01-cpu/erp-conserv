import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import type { z } from "zod";
import type { privacyCloseSchema, privacyRequestSchema } from "../validation/phase4";
import { getRootUnit } from "./org-unit.service";
import { getSetting } from "./settings.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

async function assertPrivacyAdmin(actor: Actor) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  assertCan(actor, "privacy.manage", root.path, "O atendimento a titulares é feito pela gestão central.");
}

export async function listPrivacyRequests(actor: Actor) {
  await assertPrivacyAdmin(actor);
  const rows = await prisma.privacyRequest.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 500 });
  const ids = (t: "USUARIO" | "PESSOA") => rows.filter((r) => r.subjectType === t).map((r) => r.subjectId);
  const [users, people] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids("USUARIO") } }, select: { id: true, name: true } }),
    prisma.person.findMany({ where: { id: { in: ids("PESSOA") } }, select: { id: true, name: true } }),
  ]);
  const names = new Map([...users, ...people].map((x) => [x.id, x.name]));
  return rows.map((r) => ({ ...r, subjectName: names.get(r.subjectId) ?? "—" }));
}

async function subjectLabel(type: "USUARIO" | "PESSOA", id: string) {
  if (type === "USUARIO") return (await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } })) ?? null;
  return (await prisma.person.findUnique({ where: { id }, select: { name: true, email: true } })) ?? null;
}

export async function searchSubjects(actor: Actor, q: string) {
  await assertPrivacyAdmin(actor);
  if (q.trim().length < 3) return [];
  const [users, people] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, select: { id: true, name: true, email: true }, take: 20 }),
    prisma.person.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, select: { id: true, name: true, email: true }, take: 20 }),
  ]);
  return [...users.map((u) => ({ type: "USUARIO" as const, ...u })), ...people.map((p) => ({ type: "PESSOA" as const, ...p }))];
}

export async function openPrivacyRequest(actor: Actor, input: z.infer<typeof privacyRequestSchema>, meta: RequestMeta) {
  await assertPrivacyAdmin(actor);
  if (!(await subjectLabel(input.subjectType, input.subjectId))) throw Errors.notFound("Titular");
  const days = await getSetting("privacy.responseDays");
  return prisma.$transaction(async (tx) => {
    const r = await tx.privacyRequest.create({ data: { ...input, dueDate: new Date(Date.now() + days * 86_400_000), createdById: actor.userId } });
    await recordAudit({ action: "privacidade.solicitacao.aberta", actor: auditActor(actor), objectType: "PrivacyRequest", objectId: r.id, metadata: { tipo: input.kind, titular: input.subjectType } }, meta, tx);
    return r;
  });
}

/** Reúne os dados pessoais do titular mantidos pelo sistema (atendimento de acesso). */
export async function exportSubjectData(actor: Actor, requestId: string, meta: RequestMeta) {
  await assertPrivacyAdmin(actor);
  const r = await prisma.privacyRequest.findUnique({ where: { id: requestId } });
  if (!r) throw Errors.notFound("Solicitação");
  let data: Record<string, unknown>;
  if (r.subjectType === "USUARIO") {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: r.subjectId },
      select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, mfaEnabledAt: true, homeUnit: { select: { name: true } }, scopes: { select: { role: { select: { name: true } }, unit: { select: { name: true } }, createdAt: true } } },
    });
    const [sessions, events] = await Promise.all([
      prisma.session.findMany({ where: { userId: r.subjectId }, select: { createdAt: true, lastSeenAt: true, ip: true, userAgent: true, revokedAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
      prisma.auditEvent.findMany({ where: { actorUserId: r.subjectId }, select: { occurredAt: true, action: true, result: true, ip: true }, orderBy: { seq: "desc" }, take: 1000 }),
    ]);
    data = { tipo: "usuario", cadastro: u, sessoes: sessions, atividadesRegistradas: events };
  } else {
    const p = await prisma.person.findUniqueOrThrow({
      where: { id: r.subjectId },
      include: { unit: { select: { name: true } }, credentials: true, assignments: { include: { work: { select: { code: true, title: true } } } }, epiDeliveries: { include: { catalog: { select: { name: true } } } }, documents: { select: { title: true, categoryCode: true, createdAt: true } } },
    });
    data = { tipo: "pessoa", cadastro: p };
  }
  await recordAudit({ action: "privacidade.exportacao", actor: auditActor(actor), objectType: "PrivacyRequest", objectId: r.id, metadata: { titular: r.subjectType } }, meta);
  return { geradoEm: new Date().toISOString(), solicitacao: { id: r.id, tipo: r.kind, aberturaEm: r.createdAt }, dados: data };
}

/**
 * Encerra a solicitação. A anonimização substitui dados identificadores da
 * pessoa e mantém os registros de obra/segurança necessários (sem identificar).
 * A trilha de auditoria não é alterada (imutável), o que deve constar na resposta.
 */
export async function closePrivacyRequest(actor: Actor, requestId: string, input: z.infer<typeof privacyCloseSchema>, meta: RequestMeta) {
  await assertPrivacyAdmin(actor);
  const r = await prisma.privacyRequest.findUnique({ where: { id: requestId } });
  if (!r) throw Errors.notFound("Solicitação");
  if (r.status !== "ABERTA") throw Errors.conflict("A solicitação já foi encerrada.");
  if (input.anonymize && r.subjectType !== "PESSOA") throw Errors.invalid("A anonimização direta está disponível para cadastros de pessoas. Para usuários, inative a conta.");
  return prisma.$transaction(async (tx) => {
    if (input.anonymize && input.status === "ATENDIDA") {
      await tx.person.update({ where: { id: r.subjectId }, data: { name: `Pessoa anonimizada ${r.subjectId.slice(0, 8)}`, email: null, phone: null, internalId: null, bondDescription: null, legalReviewNote: null, status: "INATIVO" } });
    }
    const u = await tx.privacyRequest.update({ where: { id: requestId }, data: { status: input.status, resolution: input.resolution, handledById: actor.userId, closedAt: new Date() } });
    await recordAudit({ action: "privacidade.solicitacao.encerrada", actor: auditActor(actor), objectType: "PrivacyRequest", objectId: r.id, metadata: { situacao: input.status, anonimizado: Boolean(input.anonymize) } }, meta, tx);
    return u;
  });
}

/** Descarte periódico de registros operacionais conforme os prazos configurados. */
export async function applyRetention(now = new Date()) {
  const [loginDays, sessionDays] = await Promise.all([getSetting("retention.loginAttemptsDays"), getSetting("retention.sessionsDays")]);
  const loginLimit = new Date(now.getTime() - loginDays * 86_400_000);
  const sessionLimit = new Date(now.getTime() - sessionDays * 86_400_000);
  const [attempts, sessions, tokens] = await Promise.all([
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: loginLimit } } }),
    prisma.session.deleteMany({ where: { OR: [{ revokedAt: { lt: sessionLimit } }, { expiresAt: { lt: sessionLimit } }] } }),
    prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: sessionLimit } } }),
  ]);
  return { tentativasLogin: attempts.count, sessoes: sessions.count, tokensSenha: tokens.count };
}
