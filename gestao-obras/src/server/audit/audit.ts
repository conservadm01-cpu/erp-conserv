import { randomUUID } from "node:crypto";
import type { AuditResult, Prisma } from "@prisma/client";
import { prisma, type Db, type Tx } from "../db";
import { sha256Hex } from "../crypto";
import type { RequestMeta } from "../http/request-meta";
import { canonicalJson, sanitizeMetadata } from "./sanitize";

export const GENESIS_HASH = "0".repeat(64);
// Chave do lock transacional que serializa a cadeia de hash.
const AUDIT_LOCK_KEY = 7_210_431;

export type AuditInput = {
  action: string;
  result?: AuditResult;
  actor?: { userId: string; email: string } | null;
  actorLabel?: string;
  objectType?: string;
  objectId?: string;
  unitPath?: string | null;
  metadata?: Record<string, unknown>;
};

type HashedFields = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorLabel: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  unitPath: string | null;
  result: AuditResult;
  correlationId: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
};

export function computeAuditHash(prevHash: string, fields: HashedFields): string {
  return sha256Hex(`${prevHash}|${canonicalJson(fields)}`);
}

async function insert(tx: Tx, input: AuditInput, meta: RequestMeta) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`;
  const last = await tx.auditEvent.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
  const prevHash = last?.hash ?? GENESIS_HASH;
  const fields: HashedFields = {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorUserId: input.actor?.userId ?? null,
    actorLabel: input.actorLabel ?? input.actor?.email ?? null,
    action: input.action,
    objectType: input.objectType ?? null,
    objectId: input.objectId ?? null,
    unitPath: input.unitPath ?? null,
    result: input.result ?? "SUCESSO",
    correlationId: meta.correlationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: input.metadata ? sanitizeMetadata(input.metadata) : null,
  };
  const hash = computeAuditHash(prevHash, fields);
  return tx.auditEvent.create({
    data: {
      ...fields,
      occurredAt: new Date(fields.occurredAt),
      metadata: (fields.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      prevHash,
      hash,
    },
    select: { id: true, seq: true },
  });
}

/**
 * Registra um evento de auditoria. Quando `db` é uma transação, o evento é
 * gravado nela (e desfeito junto com a operação, se ela falhar).
 */
export async function recordAudit(input: AuditInput, meta: RequestMeta, db: Db = prisma) {
  if ("$transaction" in db) return db.$transaction((tx) => insert(tx, input, meta));
  return insert(db, input, meta);
}

export type ChainVerification = { ok: boolean; checked: number; brokenAtSeq?: string; reason?: string };

/** Recalcula a cadeia inteira e aponta o primeiro registro inconsistente. */
export async function verifyAuditChain(db: Db = prisma, batchSize = 1000): Promise<ChainVerification> {
  let prevHash = GENESIS_HASH;
  let cursor: bigint | undefined;
  let checked = 0;
  for (;;) {
    const rows = await db.auditEvent.findMany({
      where: cursor !== undefined ? { seq: { gt: cursor } } : undefined,
      orderBy: { seq: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) return { ok: true, checked };
    for (const r of rows) {
      if (r.prevHash !== prevHash) {
        return { ok: false, checked, brokenAtSeq: r.seq.toString(), reason: "Encadeamento rompido (prev_hash divergente)." };
      }
      const expected = computeAuditHash(prevHash, {
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        actorUserId: r.actorUserId,
        actorLabel: r.actorLabel,
        action: r.action,
        objectType: r.objectType,
        objectId: r.objectId,
        unitPath: r.unitPath,
        result: r.result,
        correlationId: r.correlationId,
        ip: r.ip,
        userAgent: r.userAgent,
        metadata: r.metadata ?? null,
      });
      if (expected !== r.hash) {
        return { ok: false, checked, brokenAtSeq: r.seq.toString(), reason: "Conteúdo do registro não confere com o hash." };
      }
      prevHash = r.hash;
      cursor = r.seq;
      checked++;
    }
  }
}
