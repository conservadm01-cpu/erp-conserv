import { prisma } from "../db";
import { env } from "../env";
import { decryptSecret, encryptSecret, randomToken, sha256Hex } from "../crypto";
import { recordAudit } from "../audit/audit";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { hashPassword, passwordPolicyIssues, verifyPassword } from "../auth/password";
import { createSession, revokeSession, revokeUserSessions, type LoadedSession } from "../auth/session";
import { authStateFor, type AuthState } from "../auth/actor";
import {
  generateMfaSecret,
  generateRecoveryCodes,
  mfaEnrollmentData,
  normalizeRecoveryCode,
  verifyTotp,
} from "../auth/mfa";
import { getMailer } from "../mail/mailer";

export const LOCKOUT = {
  windowMs: 15 * 60_000,
  maxFailuresPerAccount: 5,
  maxFailuresPerIp: 30,
  maxMfaFailures: 5,
};

const RESET_TOKEN_TTL_MS = 30 * 60_000;
const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";

async function recentFailures(identifier: string) {
  const since = new Date(Date.now() - LOCKOUT.windowMs);
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { identifier, success: true, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return prisma.loginAttempt.count({
    where: { identifier, success: false, createdAt: { gte: lastSuccess?.createdAt ?? since } },
  });
}

async function ipFailures(ip: string | null) {
  if (!ip) return 0;
  return prisma.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: new Date(Date.now() - LOCKOUT.windowMs) } },
  });
}

export type LoginResult = { token: string; expiresAt: Date; state: AuthState };

export async function login(input: { email: string; password: string }, meta: RequestMeta): Promise<LoginResult> {
  const identifier = input.email;
  if (
    (await recentFailures(identifier)) >= LOCKOUT.maxFailuresPerAccount ||
    (await ipFailures(meta.ip)) >= LOCKOUT.maxFailuresPerIp
  ) {
    await recordAudit({ action: "auth.login.bloqueado", result: "NEGADO", actorLabel: identifier }, meta);
    throw Errors.tooMany("Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente em 15 minutos.");
  }

  const user = await prisma.user.findUnique({ where: { email: identifier } });
  const passwordOk = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !passwordOk || user.status !== "ATIVO") {
    await prisma.loginAttempt.create({ data: { identifier, ip: meta.ip, success: false } });
    await recordAudit(
      {
        action: "auth.login.falha",
        result: "FALHA",
        actorLabel: identifier,
        actor: user ? { userId: user.id, email: user.email } : null,
        metadata: { motivo: !user || !passwordOk ? "credenciais" : `usuario_${user.status.toLowerCase()}` },
      },
      meta,
    );
    throw Errors.invalid(GENERIC_LOGIN_ERROR);
  }

  const { token, session } = await prisma.$transaction(async (tx) => {
    await tx.loginAttempt.create({ data: { identifier, ip: meta.ip, success: true } });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const created = await createSession(user.id, meta, tx);
    await recordAudit(
      { action: "auth.login.sucesso", actor: { userId: user.id, email: user.email }, objectType: "Session", objectId: created.session.id },
      meta,
      tx,
    );
    return created;
  });
  const state = await authStateFor({ ...session, user });
  return { token, expiresAt: session.expiresAt, state };
}

export async function logout(session: LoadedSession, meta: RequestMeta) {
  await revokeSession(session.id);
  await recordAudit(
    { action: "auth.logout", actor: { userId: session.userId, email: session.user.email }, objectType: "Session", objectId: session.id },
    meta,
  );
}

/** Verificação do segundo fator (TOTP ou código de recuperação). */
export async function verifyMfa(session: LoadedSession, code: string, meta: RequestMeta) {
  const user = session.user;
  if (!user.mfaEnabledAt || !user.mfaSecretEnc) throw Errors.invalid("MFA não está ativado para este usuário.");
  if (session.mfaVerifiedAt) return;
  const identifier = `mfa:${user.id}`;
  if ((await recentFailures(identifier)) >= LOCKOUT.maxMfaFailures) {
    await revokeSession(session.id);
    await recordAudit({ action: "auth.mfa.bloqueado", result: "NEGADO", actor: { userId: user.id, email: user.email } }, meta);
    throw Errors.tooMany("Excesso de códigos inválidos. Entre novamente em 15 minutos.");
  }

  const actor = { userId: user.id, email: user.email };
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const step = verifyTotp(decryptSecret(user.mfaSecretEnc), trimmed, user.mfaLastUsedStep);
    if (step !== null) {
      // A condição no WHERE impede que o mesmo código seja aceito em duas requisições simultâneas.
      const updated = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }] },
        data: { mfaLastUsedStep: step },
      });
      if (updated.count === 1) {
        await prisma.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
        await prisma.loginAttempt.create({ data: { identifier, ip: meta.ip, success: true } });
        await recordAudit({ action: "auth.mfa.sucesso", actor, metadata: { metodo: "totp" } }, meta);
        return;
      }
    }
  } else {
    const hash = sha256Hex(normalizeRecoveryCode(trimmed));
    const used = await prisma.mfaRecoveryCode.updateMany({
      where: { userId: user.id, codeHash: hash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 1) {
      await prisma.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
      await prisma.loginAttempt.create({ data: { identifier, ip: meta.ip, success: true } });
      const remaining = await prisma.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
      await recordAudit({ action: "auth.mfa.sucesso", actor, metadata: { metodo: "codigo_recuperacao", restantes: remaining } }, meta);
      return;
    }
  }
  await prisma.loginAttempt.create({ data: { identifier, ip: meta.ip, success: false } });
  await recordAudit({ action: "auth.mfa.falha", result: "FALHA", actor }, meta);
  throw Errors.invalid("Código inválido ou já utilizado.");
}

/** Inicia (ou reinicia) o cadastro do autenticador enquanto o MFA não está ativo. */
export async function startMfaEnrollment(session: LoadedSession) {
  const user = session.user;
  if (user.mfaEnabledAt) throw Errors.conflict("O MFA já está ativo. Peça a um administrador para redefini-lo.");
  const secret = generateMfaSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encryptSecret(secret) } });
  const { otpauthUrl, qrDataUrl } = await mfaEnrollmentData(user.email, secret);
  return { secret, otpauthUrl, qrDataUrl };
}

export async function confirmMfaEnrollment(session: LoadedSession, code: string, meta: RequestMeta) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (user.mfaEnabledAt) throw Errors.conflict("O MFA já está ativo.");
  if (!user.mfaSecretEnc) throw Errors.invalid("Inicie o cadastro do autenticador antes de confirmar.");
  const step = verifyTotp(decryptSecret(user.mfaSecretEnc), code.trim(), null);
  if (step === null) {
    await recordAudit({ action: "auth.mfa.cadastro.falha", result: "FALHA", actor: { userId: user.id, email: user.email } }, meta);
    throw Errors.invalid("Código inválido. Confira o horário do celular e tente novamente.");
  }
  const codes = generateRecoveryCodes();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date(), mfaLastUsedStep: step } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({ data: codes.hashes.map((codeHash) => ({ userId: user.id, codeHash })) });
    await tx.session.update({ where: { id: session.id }, data: { mfaVerifiedAt: new Date() } });
    await revokeUserSessions(user.id, { exceptSessionId: session.id }, tx);
    await recordAudit({ action: "auth.mfa.ativado", actor: { userId: user.id, email: user.email }, objectType: "User", objectId: user.id }, meta, tx);
  });
  return { recoveryCodes: codes.plain };
}

/** Sempre responde da mesma forma, exista ou não o e-mail. */
export async function requestPasswordReset(emailAddress: string, meta: RequestMeta) {
  const user = await prisma.user.findUnique({ where: { email: emailAddress } });
  if (!user || user.status !== "ATIVO") {
    await recordAudit({ action: "auth.senha.solicitacao", result: "FALHA", actorLabel: emailAddress, metadata: { motivo: "usuario_inexistente_ou_inativo" } }, meta);
    return;
  }
  const token = randomToken(32);
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });
    await recordAudit({ action: "auth.senha.solicitacao", actor: { userId: user.id, email: user.email } }, meta, tx);
  });
  const link = `${env().APP_URL}/redefinir-senha?token=${encodeURIComponent(token)}`;
  await getMailer().send({
    to: user.email,
    subject: "Redefinição de senha — Gestão de Obras",
    text:
      `Olá, ${user.name}.\n\nRecebemos um pedido para redefinir a sua senha. ` +
      `Use o link abaixo em até 30 minutos:\n\n${link}\n\n` +
      `Se você não fez este pedido, ignore esta mensagem; sua senha atual continua válida.`,
  });
}

export async function resetPassword(token: string, newPassword: string, meta: RequestMeta) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.status !== "ATIVO") {
    throw Errors.invalid("Link inválido ou expirado. Solicite uma nova redefinição.");
  }
  const issues = passwordPolicyIssues(newPassword, record.user);
  if (issues.length) throw Errors.invalid("A senha não atende à política.", { password: issues });
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw Errors.invalid("Link inválido ou expirado. Solicite uma nova redefinição.");
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
    });
    await revokeUserSessions(record.userId, {}, tx);
    await recordAudit({ action: "auth.senha.redefinida", actor: { userId: record.userId, email: record.user.email }, objectType: "User", objectId: record.userId }, meta, tx);
  });
}

export async function changePassword(session: LoadedSession, currentPassword: string, newPassword: string, meta: RequestMeta) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const actor = { userId: user.id, email: user.email };
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    await recordAudit({ action: "auth.senha.troca.falha", result: "FALHA", actor }, meta);
    throw Errors.invalid("Senha atual incorreta.", { currentPassword: ["Senha atual incorreta."] });
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw Errors.invalid("A nova senha deve ser diferente da atual.", { newPassword: ["A nova senha deve ser diferente da atual."] });
  }
  const issues = passwordPolicyIssues(newPassword, user);
  if (issues.length) throw Errors.invalid("A senha não atende à política.", { newPassword: issues });
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false } });
    await revokeUserSessions(user.id, { exceptSessionId: session.id }, tx);
    await recordAudit({ action: "auth.senha.alterada", actor, objectType: "User", objectId: user.id }, meta, tx);
  });
}
