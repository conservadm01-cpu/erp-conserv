import { z } from "zod";
import "../validation/zod-pt";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { recordAudit, verifyAuditChain } from "../audit/audit";
import { assertCan, can, grantsFor, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { getRootUnit } from "./org-unit.service";

export const auditQuerySchema = z.object({
  action: z.string().trim().max(80).optional(),
  actor: z.string().trim().max(254).optional(),
  result: z.enum(["SUCESSO", "FALHA", "NEGADO"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

/** Eventos sem unidade (login, papéis) só são visíveis a quem lê a auditoria na raiz. */
async function scopeWhere(actor: Actor): Promise<Prisma.AuditEventWhereInput | null> {
  const grants = grantsFor(actor, "audit.read");
  if (grants.length === 0) return null;
  const root = await getRootUnit();
  const conditions: Prisma.AuditEventWhereInput[] = grants.map((g) =>
    g.includeDescendants ? { unitPath: { startsWith: g.path } } : { unitPath: g.path },
  );
  if (root && can(actor, "audit.read", root.path)) conditions.push({ unitPath: null });
  return { OR: conditions };
}

export async function listAuditEvents(actor: Actor, q: AuditQuery, meta: RequestMeta) {
  const scope = await scopeWhere(actor);
  if (!scope) throw Errors.forbidden();
  const where: Prisma.AuditEventWhereInput = {
    AND: [
      scope,
      q.action ? { action: { startsWith: q.action } } : {},
      q.actor ? { actorLabel: { contains: q.actor, mode: "insensitive" } } : {},
      q.result ? { result: q.result } : {},
      q.from || q.to ? { occurredAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {},
    ],
  };
  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({ where, orderBy: { seq: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  // A própria consulta à trilha é um acesso a dado restrito e fica registrada.
  await recordAudit(
    { action: "auditoria.consulta", actor: { userId: actor.userId, email: actor.email }, metadata: { filtros: { ...q, from: q.from?.toISOString(), to: q.to?.toISOString() }, total } },
    meta,
  );
  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    events: events.map((e) => ({ ...e, seq: e.seq.toString() })),
  };
}

export async function verifyChain(actor: Actor, meta: RequestMeta) {
  const root = await getRootUnit();
  if (!root) throw Errors.forbidden();
  assertCan(actor, "audit.read", root.path, "A verificação de integridade é restrita à gestão central.");
  const result = await verifyAuditChain();
  await recordAudit(
    { action: "auditoria.verificacao", result: result.ok ? "SUCESSO" : "FALHA", actor: { userId: actor.userId, email: actor.email }, metadata: { ...result } },
    meta,
  );
  return result;
}
