import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { deleteOrgUnit } from "@/server/services/org-unit.service";
import { actorOf, makeTree, makeUnit, makeUser, meta } from "./fixtures";

let t: Awaited<ReturnType<typeof makeTree>>;
let admin: Awaited<ReturnType<typeof makeUser>>;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;

beforeAll(async () => {
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
});

describe("remoção de unidade", () => {
  it("admin regional remove unidade local sem histórico da própria região, com auditoria", async () => {
    const u = await makeUnit(`DEL-${t.suffix}`, "CONGREGACAO", t.regA);
    await expect(deleteOrgUnit(await actorOf(gestorB), u.id, "Criada por engano", meta())).rejects.toMatchObject({ status: 404 });
    const r = await deleteOrgUnit(await actorOf(gestorA), u.id, "Criada por engano", meta());
    expect(r.parentId).toBe(t.regA.id);
    expect(await prisma.organizationUnit.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await prisma.auditEvent.count({ where: { objectId: u.id, action: "org.unidade.removida" } })).toBe(1);
  });

  it("unidade com histórico ou subordinadas não é removida; a região exige a gestão central", async () => {
    const u = await makeUnit(`USO-${t.suffix}`, "CONGREGACAO", t.regA);
    await makeUser({ unit: u });
    await expect(deleteOrgUnit(await actorOf(gestorA), u.id, "Teste de remoção", meta())).rejects.toMatchObject({ status: 409 });
    await expect(deleteOrgUnit(await actorOf(gestorA), t.regA.id, "Teste de remoção", meta())).rejects.toMatchObject({ status: 403 });
    await expect(deleteOrgUnit(await actorOf(admin), t.regA.id, "Teste de remoção", meta())).rejects.toMatchObject({ status: 409 });
    await expect(deleteOrgUnit(await actorOf(admin), t.root.id, "Teste de remoção", meta())).rejects.toMatchObject({ status: 422 });
    const reg = await makeUnit(`REG-${t.suffix}`, "REGIAO", t.root);
    await deleteOrgUnit(await actorOf(admin), reg.id, "Região criada por engano", meta());
    expect(await prisma.organizationUnit.findUnique({ where: { id: reg.id } })).toBeNull();
  });
});
