import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { buildActor } from "@/server/auth/actor";
import { hashPassword } from "@/server/auth/password";
import { systemMeta } from "@/server/http/request-meta";
import { PERMISSIONS } from "@/server/authz/catalog";
import { ACTIVITY_TYPES, APPROVAL_POLICIES, CHECKLIST_TEMPLATES, CRITICALITY_LEVELS, DOCUMENT_CATEGORIES, ORG_UNIT_TYPES, REQUIREMENT_RULES, ROLES, WORK_TYPES } from "../../prisma/seed-data";

export const PASSWORD = "Teste@Seguro2026!";
export const meta = () => systemMeta("teste");
let passwordHash: string | undefined;

export async function ensureBase() {
  for (const t of ORG_UNIT_TYPES) await prisma.orgUnitType.upsert({ where: { code: t.code }, update: {}, create: t });
  for (const [code, p] of Object.entries(PERMISSIONS)) await prisma.permission.upsert({ where: { code }, update: {}, create: { code, ...p } });
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: { code: r.code, name: r.name, requiresMfa: r.requiresMfa, isSystem: r.isSystem },
    });
    await prisma.rolePermission.createMany({ data: r.permissions.map((permissionCode) => ({ roleId: role.id, permissionCode })), skipDuplicates: true });
  }
  for (const t of WORK_TYPES) await prisma.workType.upsert({ where: { code: t.code }, update: {}, create: t });
  for (const a of ACTIVITY_TYPES) await prisma.activityType.upsert({ where: { code: a.code }, update: {}, create: a });
  for (const c of DOCUMENT_CATEGORIES) await prisma.documentCategory.upsert({ where: { code: c.code }, update: {}, create: c });
  for (const p of APPROVAL_POLICIES) await prisma.approvalPolicy.upsert({ where: { kind: p.kind }, update: {}, create: p });
  for (const r of REQUIREMENT_RULES) await prisma.requirementRule.upsert({ where: { code: r.code }, update: {}, create: r });
  for (const c of CRITICALITY_LEVELS) await prisma.criticalityLevel.upsert({ where: { code: c.code }, update: {}, create: c });
  for (const t of CHECKLIST_TEMPLATES) {
    if (!(await prisma.checklistTemplate.findFirst({ where: { name: t.name } }))) {
      await prisma.checklistTemplate.create({ data: { name: t.name, workTypes: t.workTypes, items: { create: t.items.map((i, n) => ({ ...i, sortOrder: n })) } } });
    }
  }
  let root = await prisma.organizationUnit.findFirst({ where: { depth: 0 } });
  if (!root) {
    const id = randomUUID();
    root = await prisma.organizationUnit.create({ data: { id, code: "CENTRAL", name: "Central de Testes", typeCode: "CENTRAL", path: `/${id}/`, depth: 0 } });
  }
  return root;
}

export async function makeUnit(code: string, typeCode: string, parent: { id: string; path: string; depth: number }) {
  const id = randomUUID();
  return prisma.organizationUnit.create({
    data: { id, code, name: `Unidade ${code}`, typeCode, parentId: parent.id, path: `${parent.path}${id}/`, depth: parent.depth + 1 },
  });
}

/** Árvore: raiz → região A (A1, A2) e região B (B1). Códigos únicos por chamada. */
export async function makeTree() {
  const root = await ensureBase();
  const s = randomUUID().slice(0, 6).toUpperCase();
  const regA = await makeUnit(`RA-${s}`, "REGIAO", root);
  const regB = await makeUnit(`RB-${s}`, "REGIAO", root);
  const a1 = await makeUnit(`A1-${s}`, "CONGREGACAO", regA);
  const a2 = await makeUnit(`A2-${s}`, "CONGREGACAO", regA);
  const b1 = await makeUnit(`B1-${s}`, "CONGREGACAO", regB);
  return { root, regA, regB, a1, a2, b1, suffix: s };
}

export async function makeUser(opts: { unit: { id: string }; role?: string; scopeUnit?: { id: string }; includeDescendants?: boolean; email?: string; mustChangePassword?: boolean; workId?: string }) {
  passwordHash ??= await hashPassword(PASSWORD);
  const user = await prisma.user.create({
    data: {
      email: opts.email ?? `u-${randomUUID().slice(0, 12)}@exemplo.test`,
      name: "Usuário de Teste",
      passwordHash,
      homeUnitId: opts.unit.id,
      mustChangePassword: opts.mustChangePassword ?? false,
    },
  });
  if (opts.role) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: opts.role } });
    await prisma.userScope.create({
      data: { userId: user.id, roleId: role.id, unitId: (opts.scopeUnit ?? opts.unit).id, includeDescendants: opts.includeDescendants ?? true, workId: opts.workId ?? null },
    });
  }
  return user;
}

export async function actorOf(user: { id: string; email: string; name: string; homeUnitId: string }) {
  return buildActor(user, randomUUID());
}
