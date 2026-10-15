import { beforeAll, describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import { prisma } from "@/server/db";
import { sha256Hex } from "@/server/crypto";
import { MemoryMailer, setMailer } from "@/server/mail/mailer";
import { loadSession } from "@/server/auth/session";
import { authStateFor } from "@/server/auth/actor";
import { decryptSecret } from "@/server/crypto";
import {
  changePassword, confirmMfaEnrollment, LOCKOUT, login, requestPasswordReset, resetPassword, startMfaEnrollment, verifyMfa,
} from "@/server/services/auth.service";
import { makeTree, makeUser, meta, PASSWORD } from "./fixtures";

let t: Awaited<ReturnType<typeof makeTree>>;
const mailer = new MemoryMailer();

beforeAll(async () => {
  t = await makeTree();
  setMailer(mailer);
});

async function sessionOf(token: string) {
  const s = await loadSession(token);
  if (!s) throw new Error("sessão não carregada");
  return s;
}

describe("login e bloqueio por tentativas", () => {
  it("login correto cria sessão; o banco guarda só o hash do token", async () => {
    const u = await makeUser({ unit: t.a1, role: "CONSULTA" });
    const r = await login({ email: u.email, password: PASSWORD }, meta());
    expect(r.state).toBe("OK");
    const stored = await prisma.session.findFirstOrThrow({ where: { userId: u.id } });
    expect(stored.tokenHash).toBe(sha256Hex(r.token));
    expect(stored.tokenHash).not.toBe(r.token);
  });

  it("e-mail inexistente e senha errada recebem a mesma mensagem genérica", async () => {
    const u = await makeUser({ unit: t.a1 });
    const a = await login({ email: "ninguem@exemplo.test", password: "x" }, meta()).catch((e) => e);
    const b = await login({ email: u.email, password: "errada" }, meta()).catch((e) => e);
    expect(a.message).toBe(b.message);
    expect(a.status).toBe(422);
  });

  it(`bloqueia após ${LOCKOUT.maxFailuresPerAccount} falhas, mesmo com a senha certa`, async () => {
    const u = await makeUser({ unit: t.a1 });
    for (let i = 0; i < LOCKOUT.maxFailuresPerAccount; i++) await login({ email: u.email, password: "errada" }, meta()).catch(() => null);
    await expect(login({ email: u.email, password: PASSWORD }, meta())).rejects.toMatchObject({ status: 429 });
    expect(await prisma.auditEvent.count({ where: { action: "auth.login.bloqueado", actorLabel: u.email } })).toBe(1);
  });

  it("bloqueia por IP após muitas falhas em contas diferentes", async () => {
    const ip = "203.0.113.77";
    for (let i = 0; i < LOCKOUT.maxFailuresPerIp; i++) {
      await prisma.loginAttempt.create({ data: { identifier: `x${i}@exemplo.test`, ip, success: false } });
    }
    const u = await makeUser({ unit: t.a1 });
    await expect(login({ email: u.email, password: PASSWORD }, { ...meta(), ip })).rejects.toMatchObject({ status: 429 });
  });

  it("usuário bloqueado não entra e sessões existentes deixam de valer", async () => {
    const u = await makeUser({ unit: t.a1 });
    const r = await login({ email: u.email, password: PASSWORD }, meta());
    await prisma.user.update({ where: { id: u.id }, data: { status: "BLOQUEADO" } });
    expect(await loadSession(r.token)).toBeNull();
    await expect(login({ email: u.email, password: PASSWORD }, meta())).rejects.toMatchObject({ status: 422 });
  });

  it("sessão expira por inatividade e por revogação", async () => {
    const u = await makeUser({ unit: t.a1 });
    const r1 = await login({ email: u.email, password: PASSWORD }, meta());
    await prisma.session.updateMany({ where: { tokenHash: sha256Hex(r1.token) }, data: { idleExpiresAt: new Date(Date.now() - 1000) } });
    expect(await loadSession(r1.token)).toBeNull();
    const r2 = await login({ email: u.email, password: PASSWORD }, meta());
    await prisma.session.updateMany({ where: { tokenHash: sha256Hex(r2.token) }, data: { revokedAt: new Date() } });
    expect(await loadSession(r2.token)).toBeNull();
  });

  it("senha provisória obriga a troca antes de liberar o sistema", async () => {
    const u = await makeUser({ unit: t.a1, role: "CONSULTA", mustChangePassword: true });
    const r = await login({ email: u.email, password: PASSWORD }, meta());
    expect(r.state).toBe("TROCA_SENHA_OBRIGATORIA");
    const s = await sessionOf(r.token);
    await expect(changePassword(s, "errada", "Nova!Senha#Forte26", meta())).rejects.toMatchObject({ status: 422 });
    await expect(changePassword(s, PASSWORD, "fraca", meta())).rejects.toMatchObject({ status: 422 });
    await changePassword(s, PASSWORD, "Nova!Senha#Forte26", meta());
    expect(await authStateFor(await sessionOf(r.token))).toBe("OK");
  });
});

describe("MFA", () => {
  it("papel crítico exige cadastro de MFA; fluxo completo com TOTP e código de recuperação", async () => {
    const u = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
    const r1 = await login({ email: u.email, password: PASSWORD }, meta());
    expect(r1.state).toBe("MFA_CADASTRO_OBRIGATORIO");

    const s1 = await sessionOf(r1.token);
    const { secret } = await startMfaEnrollment(s1);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.mfaSecretEnc).not.toContain(secret);
    expect(decryptSecret(stored.mfaSecretEnc!)).toBe(secret);

    await expect(confirmMfaEnrollment(s1, "000000", meta())).rejects.toMatchObject({ status: 422 });
    const { recoveryCodes } = await confirmMfaEnrollment(s1, authenticator.generate(secret), meta());
    expect(recoveryCodes).toHaveLength(8);
    expect(await authStateFor(await sessionOf(r1.token))).toBe("OK");
    await expect(startMfaEnrollment(await sessionOf(r1.token))).rejects.toMatchObject({ status: 409 });

    // Novo login: exige o segundo fator.
    const r2 = await login({ email: u.email, password: PASSWORD }, meta());
    expect(r2.state).toBe("MFA_PENDENTE");
    const s2 = await sessionOf(r2.token);
    await expect(verifyMfa(s2, "123456", meta())).rejects.toMatchObject({ status: 422 });
    // Código do próximo intervalo (o do intervalo atual já foi usado na ativação).
    const next = authenticator.clone({ epoch: Date.now() + 30_000 }).generate(secret);
    await verifyMfa(s2, next, meta());
    expect(await authStateFor(await sessionOf(r2.token))).toBe("OK");

    // O mesmo código não pode ser reutilizado em outra sessão.
    const r3 = await login({ email: u.email, password: PASSWORD }, meta());
    await expect(verifyMfa(await sessionOf(r3.token), next, meta())).rejects.toMatchObject({ status: 422 });

    // Código de recuperação funciona uma única vez.
    await verifyMfa(await sessionOf(r3.token), recoveryCodes[0]!.toLowerCase(), meta());
    const r4 = await login({ email: u.email, password: PASSWORD }, meta());
    await expect(verifyMfa(await sessionOf(r4.token), recoveryCodes[0]!, meta())).rejects.toMatchObject({ status: 422 });
  });

  it("excesso de códigos inválidos encerra a sessão", async () => {
    const u = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
    const r1 = await login({ email: u.email, password: PASSWORD }, meta());
    const s1 = await sessionOf(r1.token);
    const { secret } = await startMfaEnrollment(s1);
    await confirmMfaEnrollment(s1, authenticator.generate(secret), meta());
    const r2 = await login({ email: u.email, password: PASSWORD }, meta());
    for (let i = 0; i < LOCKOUT.maxMfaFailures; i++) await verifyMfa(await sessionOf(r2.token), "000000", meta()).catch(() => null);
    await expect(verifyMfa(await sessionOf(r2.token), "000000", meta())).rejects.toMatchObject({ status: 429 });
    expect(await loadSession(r2.token)).toBeNull();
  });
});

describe("recuperação de senha", () => {
  it("envia link de uso único, redefine a senha e encerra sessões", async () => {
    const u = await makeUser({ unit: t.a1, role: "CONSULTA" });
    const old = await login({ email: u.email, password: PASSWORD }, meta());
    mailer.outbox.length = 0;
    await requestPasswordReset(u.email, meta());
    expect(mailer.outbox).toHaveLength(1);
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mailer.outbox[0]!.text)![1]!);
    // O banco guarda apenas o hash.
    expect(await prisma.passwordResetToken.count({ where: { tokenHash: token } })).toBe(0);

    await expect(resetPassword(token, "curta", meta())).rejects.toMatchObject({ status: 422 });
    await resetPassword(token, "Outra!Senha#Forte26", meta());
    expect(await loadSession(old.token)).toBeNull();
    await expect(resetPassword(token, "Mais!Uma#Senha2026", meta())).rejects.toMatchObject({ status: 422 });
    await expect(login({ email: u.email, password: PASSWORD }, meta())).rejects.toMatchObject({ status: 422 });
    expect((await login({ email: u.email, password: "Outra!Senha#Forte26" }, meta())).state).toBe("OK");
  });

  it("não revela se o e-mail existe e rejeita token expirado", async () => {
    mailer.outbox.length = 0;
    await expect(requestPasswordReset("inexistente@exemplo.test", meta())).resolves.toBeUndefined();
    expect(mailer.outbox).toHaveLength(0);

    const u = await makeUser({ unit: t.a1 });
    await requestPasswordReset(u.email, meta());
    const token = decodeURIComponent(/token=([^\s]+)/.exec(mailer.outbox[0]!.text)![1]!);
    await prisma.passwordResetToken.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword(token, "Outra!Senha#Forte26", meta())).rejects.toMatchObject({ status: 422 });
  });
});
