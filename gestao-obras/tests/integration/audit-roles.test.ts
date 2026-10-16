import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { recordAudit, verifyAuditChain } from "@/server/audit/audit";
import { REDACTED } from "@/server/audit/sanitize";
import { createRole, listRoles, updateRole } from "@/server/services/role.service";
import { removeUserScope } from "@/server/services/user.service";
import { verifyChain } from "@/server/services/audit.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

let t: Awaited<ReturnType<typeof makeTree>>;
beforeAll(async () => {
  t = await makeTree();
});

describe("trilha de auditoria", () => {
  it("encadeia os registros por hash e a verificação confirma a integridade", async () => {
    await recordAudit({ action: "teste.a", actorLabel: "teste" }, meta());
    await recordAudit({ action: "teste.b", actorLabel: "teste" }, meta());
    const last = await prisma.auditEvent.findMany({ orderBy: { seq: "desc" }, take: 2 });
    expect(last[0]!.prevHash).toBe(last[1]!.hash);
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("gravações concorrentes mantêm a cadeia consistente", async () => {
    await Promise.all(Array.from({ length: 15 }, (_, i) => recordAudit({ action: `teste.concorrente.${i}` }, meta())));
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("remove dados sensíveis dos metadados", async () => {
    const { id } = await recordAudit({ action: "teste.sensivel", metadata: { senha: "123", token: "abc", campo: "ok" } }, meta());
    const ev = await prisma.auditEvent.findUniqueOrThrow({ where: { id } });
    expect(ev.metadata).toEqual({ senha: REDACTED, token: REDACTED, campo: "ok" });
  });

  it("o banco bloqueia UPDATE, DELETE e TRUNCATE", async () => {
    const ev = await prisma.auditEvent.findFirstOrThrow();
    await expect(prisma.$executeRaw`UPDATE audit_event SET action = 'x' WHERE id = ${ev.id}::uuid`).rejects.toThrow(/somente inclusão/);
    await expect(prisma.$executeRaw`DELETE FROM audit_event WHERE id = ${ev.id}::uuid`).rejects.toThrow(/somente inclusão/);
    await expect(prisma.$executeRawUnsafe("TRUNCATE audit_event")).rejects.toThrow(/somente inclusão/);
    await expect(prisma.auditEvent.delete({ where: { id: ev.id } })).rejects.toThrow();
  });

  it("detecta adulteração feita por quem contorna o trigger (ex.: dono da tabela)", async () => {
    // Executado em transação revertida para não deixar a cadeia corrompida.
    const result = await prisma
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe("ALTER TABLE audit_event DISABLE TRIGGER audit_event_no_update");
        await tx.$executeRawUnsafe("UPDATE audit_event SET action = 'adulterado' WHERE seq = (SELECT min(seq) + 1 FROM audit_event)");
        const r = await verifyAuditChain(tx);
        throw Object.assign(new Error("rollback"), { r });
      })
      .catch((e) => e.r);
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("hash") });
    expect(await verifyAuditChain()).toMatchObject({ ok: true });
  });

  it("verificação de integridade é restrita à gestão central", async () => {
    const auditorRaiz = await makeUser({ unit: t.root, role: "AUDITOR" });
    const gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
    expect(await verifyChain(await actorOf(auditorRaiz), meta())).toMatchObject({ ok: true });
    await expect(verifyChain(await actorOf(gestorA), meta())).rejects.toMatchObject({ status: 403 });
  });
});

describe("papéis e permissões", () => {
  it("apenas quem tem role.manage na raiz configura papéis", async () => {
    const gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
    const a = await actorOf(gestorA);
    expect((await listRoles(a)).canManage).toBe(false);
    await expect(createRole(a, { code: `P_${t.suffix}`, name: "X", description: null, requiresMfa: false, permissions: [] }, meta())).rejects.toMatchObject({ status: 403 });
  });

  it("administrador cria papel, altera permissões e a mudança fica auditada", async () => {
    const admin = await actorOf(await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" }));
    const role = await createRole(admin, { code: `TEC_${t.suffix}`, name: "Técnico", description: null, requiresMfa: false, permissions: ["org.read"] }, meta());
    await updateRole(admin, role.id, { permissions: ["org.read", "dashboard.view"] }, meta());
    const perms = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    expect(perms.map((p) => p.permissionCode).sort()).toEqual(["dashboard.view", "org.read"]);
    const ev = await prisma.auditEvent.findFirstOrThrow({ where: { action: "papel.alterado", objectId: role.id } });
    expect(ev.metadata).toMatchObject({ adicionadas: ["dashboard.view"], removidas: [] });
    await expect(updateRole(admin, role.id, { permissions: ["nao.existe"] }, meta())).rejects.toMatchObject({ status: 422 });
  });

  it("papel de sistema não perde permissões nem a exigência de MFA", async () => {
    const admin = await actorOf(await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" }));
    const sys = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_SISTEMA" } });
    await expect(updateRole(admin, sys.id, { permissions: ["org.read"] }, meta())).rejects.toMatchObject({ status: 409 });
    await expect(updateRole(admin, sys.id, { requiresMfa: false }, meta())).rejects.toMatchObject({ status: 409 });
  });

  it("não remove o último administrador do sistema", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_SISTEMA" } });
    const rootAdminScopes = await prisma.userScope.findMany({ where: { roleId: adminRole.id, unitId: t.root.id }, include: { user: true } });
    // Deixa apenas dois administradores ativos: um remove o outro e depois não há quem remova o último.
    const [keep, other] = [await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" }), await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" })];
    await prisma.user.updateMany({ where: { id: { in: rootAdminScopes.map((s) => s.userId) } }, data: { status: "INATIVO" } });
    const otherScope = await prisma.userScope.findFirstOrThrow({ where: { userId: other.id, roleId: adminRole.id } });
    await removeUserScope(await actorOf(keep), other.id, otherScope.id, meta());
    // "keep" agora é o único admin ativo; um auxiliar com user.manage na raiz tenta removê-lo.
    const helper = await makeUser({ unit: t.root, role: "GESTOR_REGIONAL" });
    const keepScope = await prisma.userScope.findFirstOrThrow({ where: { userId: keep.id, roleId: adminRole.id } });
    await expect(removeUserScope(await actorOf(helper), keep.id, keepScope.id, meta())).rejects.toMatchObject({ status: 409 });
    expect(await prisma.userScope.count({ where: { id: keepScope.id } })).toBe(1);
    await prisma.user.updateMany({ where: { id: { in: rootAdminScopes.map((s) => s.userId) } }, data: { status: "ATIVO" } });
  });
});

describe("proteção contra ficar sem administrador", () => {
  it("não inativa o último administrador ativo", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_SISTEMA" } });
    const others = await prisma.userScope.findMany({ where: { roleId: adminRole.id, unit: { depth: 0 }, user: { status: "ATIVO" } } });
    const last = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
    await prisma.user.updateMany({ where: { id: { in: others.map((s) => s.userId) } }, data: { status: "INATIVO" } });
    try {
      const helper = await makeUser({ unit: t.root, role: "GESTOR_REGIONAL" });
      const { setUserStatus } = await import("@/server/services/user.service");
      await expect(setUserStatus(await actorOf(helper), last.id, "INATIVO", "teste", meta())).rejects.toMatchObject({ status: 409 });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: last.id } })).status).toBe("ATIVO");
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((s) => s.userId) } }, data: { status: "ATIVO" } });
    }
  });
});
