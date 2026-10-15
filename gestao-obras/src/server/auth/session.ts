import type { Session, User } from "@prisma/client";
import { prisma, type Db } from "../db";
import { env, isSecureCookie } from "../env";
import { randomToken, sha256Hex } from "../crypto";
import type { RequestMeta } from "../http/request-meta";

export function sessionCookieName() {
  // O prefixo __Host- exige HTTPS, Path=/ e ausência de Domain.
  return isSecureCookie() ? "__Host-go_session" : "go_session";
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

function idleDeadline(from = new Date()) {
  return new Date(from.getTime() + env().SESSION_IDLE_MINUTES * 60_000);
}

export async function createSession(userId: string, meta: RequestMeta, db: Db = prisma) {
  const token = randomToken(32);
  const now = new Date();
  const session = await db.session.create({
    data: {
      tokenHash: sha256Hex(token),
      userId,
      idleExpiresAt: idleDeadline(now),
      expiresAt: new Date(now.getTime() + env().SESSION_ABSOLUTE_HOURS * 3_600_000),
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  return { token, session };
}

export type LoadedSession = Session & { user: User };

/** Valida o token e renova a expiração por inatividade. */
export async function loadSession(token: string | undefined | null): Promise<LoadedSession | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: true } });
  if (!session) return null;
  const now = new Date();
  if (session.revokedAt || session.expiresAt <= now || session.idleExpiresAt <= now) return null;
  if (session.user.status !== "ATIVO") return null;
  // Evita uma escrita por requisição: renova no máximo a cada minuto.
  if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
    const idle = idleDeadline(now);
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now, idleExpiresAt: idle } });
    session.lastSeenAt = now;
    session.idleExpiresAt = idle;
  }
  return session;
}

export async function revokeSession(sessionId: string, db: Db = prisma) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeUserSessions(userId: string, opts: { exceptSessionId?: string } = {}, db: Db = prisma) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(opts.exceptSessionId ? { id: { not: opts.exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
