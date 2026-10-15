/**
 * Seed idempotente.
 *  - SEED_MODE=base: tipos, permissões, papéis, unidade raiz e administrador inicial
 *    (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). Indicado para produção.
 *  - SEED_MODE=demo (padrão fora de produção): base + dados fictícios de demonstração.
 * Todos os nomes e e-mails de demonstração são fictícios (domínio reservado .test).
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyIssues } from "../src/server/auth/password";
import { PERMISSIONS } from "../src/server/authz/catalog";
import { recordAudit } from "../src/server/audit/audit";
import { systemMeta } from "../src/server/http/request-meta";
import { ACTIVITY_TYPES, APPROVAL_POLICIES, CHECKLIST_TEMPLATES, CRITICALITY_LEVELS, DEMO_EPIS, DOCUMENT_CATEGORIES, ORG_UNIT_TYPES, REQUIREMENT_RULES, ROLES, WORK_TYPES } from "./seed-data";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "Demo@Obras2026!";

async function seedBase(mode: string) {
  for (const t of ORG_UNIT_TYPES) {
    await prisma.orgUnitType.upsert({ where: { code: t.code }, update: { name: t.name, allowedParentCodes: t.allowedParentCodes, sortOrder: t.sortOrder }, create: t });
  }
  for (const [code, p] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, update: { module: p.module, description: p.description }, create: { code, ...p } });
  }
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: r.isSystem ? { isSystem: true, requiresMfa: true } : {},
      create: { code: r.code, name: r.name, description: r.description, requiresMfa: r.requiresMfa, isSystem: r.isSystem },
    });
    // Papéis de sistema recebem sempre todas as permissões do catálogo; os demais só na criação
    // (no modo demonstração, também recebem permissões novas do exemplo).
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (r.isSystem || existing === 0 || mode === "demo") {
      await prisma.rolePermission.createMany({ data: r.permissions.map((permissionCode) => ({ roleId: role.id, permissionCode })), skipDuplicates: true });
    }
  }
  for (const t of WORK_TYPES) await prisma.workType.upsert({ where: { code: t.code }, update: {}, create: t });
  for (const a of ACTIVITY_TYPES) await prisma.activityType.upsert({ where: { code: a.code }, update: {}, create: a });
  for (const c of DOCUMENT_CATEGORIES) await prisma.documentCategory.upsert({ where: { code: c.code }, update: {}, create: c });
  for (const p of APPROVAL_POLICIES) await prisma.approvalPolicy.upsert({ where: { kind: p.kind }, update: {}, create: p });
  // Regras de requisito: criadas uma única vez; alterações posteriores são feitas pela tela de configuração.
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
    root = await prisma.organizationUnit.create({
      data: { id, code: "CENTRAL", name: process.env.SEED_ROOT_NAME ?? "Gestão Central", typeCode: "CENTRAL", path: `/${id}/`, depth: 0 },
    });
  }
  return root;
}

async function ensureUser(opts: { email: string; name: string; password: string; homeUnitId: string; mustChangePassword: boolean }) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      passwordHash: await hashPassword(opts.password),
      homeUnitId: opts.homeUnitId,
      mustChangePassword: opts.mustChangePassword,
    },
  });
}

async function grant(userId: string, roleCode: string, unitId: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const existing = await prisma.userScope.findFirst({ where: { userId, roleId: role.id, unitId, workId: null } });
  if (!existing) await prisma.userScope.create({ data: { userId, roleId: role.id, unitId } });
}

async function ensureUnit(code: string, name: string, typeCode: string, parent: { id: string; path: string; depth: number }, extra: Record<string, string> = {}) {
  const existing = await prisma.organizationUnit.findUnique({ where: { code } });
  if (existing) return existing;
  const id = randomUUID();
  return prisma.organizationUnit.create({
    data: { id, code, name, typeCode, parentId: parent.id, path: `${parent.path}${id}/`, depth: parent.depth + 1, ...extra },
  });
}

async function seedDemo(root: { id: string; path: string; depth: number }) {
  const norte = await ensureUnit("REG-DEMO-NORTE", "Região Demonstração Norte", "REGIAO", root, { city: "Cidade Exemplo Norte", state: "SP" });
  const sul = await ensureUnit("REG-DEMO-SUL", "Região Demonstração Sul", "REGIAO", root, { city: "Cidade Exemplo Sul", state: "PR" });
  const alfa = await ensureUnit("UL-ALFA", "Unidade Local Alfa", "CONGREGACAO", norte, { street: "Rua Fictícia", number: "100", district: "Centro", city: "Cidade Exemplo Norte", state: "SP", postalCode: "00000-000" });
  await ensureUnit("UL-BETA", "Unidade Local Beta", "CONGREGACAO", norte, { city: "Cidade Exemplo Norte", state: "SP" });
  await ensureUnit("UL-GAMA", "Unidade Local Gama", "CONGREGACAO", sul, { city: "Cidade Exemplo Sul", state: "PR" });
  await ensureUnit("UL-DELTA", "Unidade Local Delta", "CONGREGACAO", sul, { city: "Cidade Exemplo Sul", state: "PR" });

  const users = [
    { email: "admin@exemplo.test", name: "Administrador Demonstração", unit: root, role: "ADMIN_SISTEMA" },
    { email: "gestor.norte@exemplo.test", name: "Gestor Norte Demonstração", unit: norte, role: "GESTOR_REGIONAL" },
    { email: "gestor.sul@exemplo.test", name: "Gestor Sul Demonstração", unit: sul, role: "GESTOR_REGIONAL" },
    { email: "auditor@exemplo.test", name: "Auditor Demonstração", unit: root, role: "AUDITOR" },
    { email: "analista@exemplo.test", name: "Analista Central Demonstração", unit: root, role: "ANALISTA_CENTRAL" },
    { email: "seguranca.norte@exemplo.test", name: "Técnico de Segurança Norte Demonstração", unit: norte, role: "TECNICO_SEGURANCA" },
    { email: "consulta.alfa@exemplo.test", name: "Consulta Alfa Demonstração", unit: alfa, role: "CONSULTA" },
  ];
  for (const u of users) {
    const user = await ensureUser({ email: u.email, name: u.name, password: DEMO_PASSWORD, homeUnitId: u.unit.id, mustChangePassword: false });
    await grant(user.id, u.role, u.unit.id);
  }
  for (const e of DEMO_EPIS) {
    if (!(await prisma.epiCatalog.findFirst({ where: { name: e.name } }))) await prisma.epiCatalog.create({ data: e });
  }
  return users.map((u) => `${u.email} (${u.role})`);
}

async function main() {
  const mode = process.env.SEED_MODE ?? (process.env.NODE_ENV === "production" ? "base" : "demo");
  if (mode === "demo" && process.env.NODE_ENV === "production") {
    throw new Error("SEED_MODE=demo não é permitido em produção.");
  }
  const root = await seedBase(mode);

  if (mode === "base") {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (email && password) {
      const issues = passwordPolicyIssues(password, { email });
      if (issues.length) throw new Error(`SEED_ADMIN_PASSWORD inválida: ${issues.join(" ")}`);
      const admin = await ensureUser({ email, name: process.env.SEED_ADMIN_NAME ?? "Administrador", password, homeUnitId: root.id, mustChangePassword: true });
      await grant(admin.id, "ADMIN_SISTEMA", root.id);
      console.log(`Administrador inicial: ${email} (troca de senha e MFA obrigatórios no primeiro acesso).`);
    } else {
      console.log("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD para criar o administrador inicial.");
    }
  } else {
    const created = await seedDemo(root);
    console.log(`Dados de demonstração prontos. Senha de todos os usuários fictícios: ${DEMO_PASSWORD}`);
    created.forEach((c) => console.log(`  - ${c}`));
  }
  await recordAudit({ action: "sistema.seed", actorLabel: "seed", metadata: { modo: mode } }, systemMeta("seed"), prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
