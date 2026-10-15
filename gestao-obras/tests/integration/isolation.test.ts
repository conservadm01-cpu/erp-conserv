import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createOrgUnit, getOrgUnit, listOrgUnits, setOrgUnitStatus, updateOrgUnit } from "@/server/services/org-unit.service";
import { addUserScope, getUser, listUsers, removeUserScope, setUserStatus } from "@/server/services/user.service";
import { listAuditEvents, auditQuerySchema } from "@/server/services/audit.service";
import { getDashboard } from "@/server/services/dashboard.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

type Tree = Awaited<ReturnType<typeof makeTree>>;
let t: Tree;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
let userA1: Awaited<ReturnType<typeof makeUser>>;
let userB1: Awaited<ReturnType<typeof makeUser>>;

const codes = (units: { code: string }[]) => units.map((u) => u.code).sort();

beforeAll(async () => {
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
  userA1 = await makeUser({ unit: t.a1, role: "CONSULTA" });
  userB1 = await makeUser({ unit: t.b1, role: "CONSULTA" });
});

describe("isolamento entre regiões — estrutura organizacional", () => {
  it("gestor regional só enxerga a própria região e suas subordinadas", async () => {
    const units = await listOrgUnits(await actorOf(gestorA));
    expect(codes(units)).toEqual(codes([t.regA, t.a1, t.a2]));
  });

  it("detalhe de unidade de outra região responde como inexistente (404)", async () => {
    await expect(getOrgUnit(await actorOf(gestorA), t.b1.id)).rejects.toMatchObject({ status: 404 });
    await expect(getOrgUnit(await actorOf(gestorA), t.root.id)).rejects.toMatchObject({ status: 404 });
  });

  it("não cria, altera nem inativa unidades fora do escopo", async () => {
    const a = await actorOf(gestorA);
    await expect(
      createOrgUnit(a, { code: `X-${t.suffix}`, name: "Invasora", typeCode: "CONGREGACAO", parentId: t.regB.id, contacts: [] } as never, meta()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(updateOrgUnit(a, t.b1.id, { name: "Alterada" } as never, meta())).rejects.toMatchObject({ status: 404 });
    await expect(setOrgUnitStatus(a, t.b1.id, "INATIVA", "teste", meta())).rejects.toMatchObject({ status: 404 });
    expect((await prisma.organizationUnit.findUniqueOrThrow({ where: { id: t.b1.id } })).name).toBe(t.b1.name);
  });

  it("não move unidade própria para dentro de outra região", async () => {
    await expect(updateOrgUnit(await actorOf(gestorA), t.a2.id, { parentId: t.regB.id } as never, meta())).rejects.toMatchObject({ status: 404 });
  });

  it("cria unidade na própria região com caminho materializado correto e auditoria", async () => {
    const unit = await createOrgUnit(
      await actorOf(gestorA),
      { code: `A3-${t.suffix}`, name: "Nova A3", typeCode: "CONGREGACAO", parentId: t.regA.id, contacts: [{ name: "Contato Fictício", role: null, email: null, phone: null }] } as never,
      meta(),
    );
    expect(unit.path).toBe(`${t.regA.path}${unit.id}/`);
    expect(unit.depth).toBe(2);
    const ev = await prisma.auditEvent.findFirst({ where: { objectId: unit.id, action: "org.unidade.criada" } });
    expect(ev?.actorUserId).toBe(gestorA.id);
    expect(ev?.unitPath).toBe(unit.path);
  });

  it("respeita as regras de hierarquia por tipo", async () => {
    await expect(
      createOrgUnit(await actorOf(gestorA), { code: `R-${t.suffix}`, name: "Região dentro de região", typeCode: "REGIAO", parentId: t.regA.id, contacts: [] } as never, meta()),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("perfil de consulta não altera dados", async () => {
    const c = await actorOf(userA1);
    expect(codes(await listOrgUnits(c))).toEqual([t.a1.code]);
    await expect(updateOrgUnit(c, t.a1.id, { name: "x" } as never, meta())).rejects.toMatchObject({ status: 403 });
  });

  it("ao mover uma região, descendentes acompanham e o escopo segue a nova posição", async () => {
    const adminActor = await actorOf(admin);
    const regC = await createOrgUnit(adminActor, { code: `RC-${t.suffix}`, name: "Região C", typeCode: "REGIAO", parentId: t.root.id, contacts: [] } as never, meta());
    const c1 = await createOrgUnit(adminActor, { code: `C1-${t.suffix}`, name: "C1", typeCode: "CONGREGACAO", parentId: regC.id, contacts: [] } as never, meta());
    // Move C1 para a região B: o gestor B passa a vê-la; o gestor A continua sem ver.
    await updateOrgUnit(adminActor, c1.id, { parentId: t.regB.id } as never, meta());
    const moved = await prisma.organizationUnit.findUniqueOrThrow({ where: { id: c1.id } });
    expect(moved.path).toBe(`${t.regB.path}${c1.id}/`);
    expect(codes(await listOrgUnits(await actorOf(gestorB)))).toContain(c1.code);
    expect(codes(await listOrgUnits(await actorOf(gestorA)))).not.toContain(c1.code);
  });

  it("impede ciclos na hierarquia", async () => {
    await expect(updateOrgUnit(await actorOf(admin), t.regA.id, { parentId: t.a1.id } as never, meta())).rejects.toMatchObject({ status: 422 });
  });
});

describe("isolamento entre regiões — usuários e acessos", () => {
  it("lista apenas usuários lotados no escopo", async () => {
    const ids = (await listUsers(await actorOf(gestorA))).map((u) => u.id);
    expect(ids).toContain(userA1.id);
    expect(ids).not.toContain(userB1.id);
    expect(ids).not.toContain(gestorB.id);
    expect(ids).not.toContain(admin.id);
  });

  it("usuário de outra região responde como inexistente", async () => {
    await expect(getUser(await actorOf(gestorA), userB1.id)).rejects.toMatchObject({ status: 404 });
    await expect(setUserStatus(await actorOf(gestorA), userB1.id, "BLOQUEADO", "teste", meta())).rejects.toMatchObject({ status: 404 });
  });

  it("não concede acesso em unidade de outra região", async () => {
    const consulta = await prisma.role.findUniqueOrThrow({ where: { code: "CONSULTA" } });
    await expect(addUserScope(await actorOf(gestorA), userA1.id, { roleId: consulta.id, unitId: t.b1.id, includeDescendants: true }, meta())).rejects.toMatchObject({ status: 404 });
  });

  it("não concede papel com permissões que o próprio gestor não possui (escalonamento)", async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN_SISTEMA" } });
    await expect(addUserScope(await actorOf(gestorA), userA1.id, { roleId: adminRole.id, unitId: t.a1.id, includeDescendants: true }, meta())).rejects.toMatchObject({ status: 403 });
    const denied = await prisma.auditEvent.findFirst({ where: { action: "usuario.escopo.negado", objectId: userA1.id } });
    expect(denied?.result).toBe("NEGADO");
  });

  it("não permite alterar o próprio acesso (segregação de funções)", async () => {
    const consulta = await prisma.role.findUniqueOrThrow({ where: { code: "CONSULTA" } });
    await expect(addUserScope(await actorOf(gestorA), gestorA.id, { roleId: consulta.id, unitId: t.a1.id, includeDescendants: true }, meta())).rejects.toMatchObject({ status: 403 });
  });

  it("concessão e revogação dentro do escopo têm efeito imediato", async () => {
    const consulta = await prisma.role.findUniqueOrThrow({ where: { code: "CONSULTA" } });
    const extra = await makeUser({ unit: t.a2 });
    expect(await listOrgUnits(await actorOf(extra))).toEqual([]);
    const scope = await addUserScope(await actorOf(gestorA), extra.id, { roleId: consulta.id, unitId: t.a2.id, includeDescendants: false }, meta());
    expect(codes(await listOrgUnits(await actorOf(extra)))).toEqual([t.a2.code]);
    await removeUserScope(await actorOf(gestorA), extra.id, scope.id, meta());
    expect(await listOrgUnits(await actorOf(extra))).toEqual([]);
  });

  it("escopo sem subordinadas não dá acesso às unidades abaixo", async () => {
    const u = await makeUser({ unit: t.regA, role: "CONSULTA", includeDescendants: false });
    expect(codes(await listOrgUnits(await actorOf(u)))).toEqual([t.regA.code]);
    await expect(getOrgUnit(await actorOf(u), t.a1.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("isolamento entre regiões — auditoria e painel", () => {
  it("gestor regional vê eventos da própria região, não de outras nem eventos globais", async () => {
    const res = await listAuditEvents(await actorOf(gestorA), auditQuerySchema.parse({ pageSize: 100 }), meta());
    expect(res.events.length).toBeGreaterThan(0);
    for (const e of res.events) {
      expect(e.unitPath).not.toBeNull();
      expect(e.unitPath!.startsWith(t.regA.path)).toBe(true);
    }
  });

  it("perfil sem audit.read não consulta a trilha", async () => {
    await expect(listAuditEvents(await actorOf(userA1), auditQuerySchema.parse({}), meta())).rejects.toMatchObject({ status: 403 });
  });

  it("indicadores do painel respeitam o escopo", async () => {
    const d = await getDashboard(await actorOf(userA1));
    expect(d.units.find((u) => u.typeCode === "CONGREGACAO")?.ativas).toBe(1);
    expect(d.units.find((u) => u.typeCode === "REGIAO")?.ativas).toBe(0);
    expect(d.users).toBeNull();
  });
});
