import type { UserStatus } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { recordAudit } from "../audit/audit";
import { assertCan, can, pathWhere, permissionsAt, type Actor } from "../authz/authorize";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { hashPassword, passwordPolicyIssues } from "../auth/password";
import { revokeUserSessions } from "../auth/session";
import type { CreateUserInput } from "../validation/user";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  homeUnitId: true,
  mfaEnabledAt: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  homeUnit: { select: { id: true, name: true, code: true, path: true } },
} as const;

export async function listUsers(actor: Actor, filter: { q?: string; status?: UserStatus; unitId?: string } = {}) {
  const where = pathWhere(actor, "user.read");
  if (!where) return [];
  const users = await prisma.user.findMany({
    where: {
      homeUnit: { ...where, ...(filter.unitId ? { id: filter.unitId } : {}) },
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.q ? { OR: [{ name: { contains: filter.q, mode: "insensitive" } }, { email: { contains: filter.q, mode: "insensitive" } }] } : {}),
    },
    select: { ...publicUserSelect, _count: { select: { scopes: true } } },
    orderBy: { name: "asc" },
    take: 500,
  });
  return users.map((u) => ({ ...u, canManage: can(actor, "user.manage", u.homeUnit.path) && u.id !== actor.userId }));
}

async function loadVisible(actor: Actor, id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user || !can(actor, "user.read", user.homeUnit.path)) throw Errors.notFound("Usuário");
  return user;
}

export async function getUser(actor: Actor, id: string) {
  const user = await loadVisible(actor, id);
  const scopes = await prisma.userScope.findMany({
    where: { userId: id },
    include: {
      role: { select: { id: true, code: true, name: true, requiresMfa: true } },
      unit: { select: { id: true, name: true, code: true, path: true, status: true } },
      work: { select: { id: true, code: true, title: true } },
      grantedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const manage = can(actor, "user.manage", user.homeUnit.path) && id !== actor.userId;
  return {
    ...user,
    canManage: manage,
    scopes: scopes.map((s) => ({ ...s, canRemove: manage && can(actor, "user.manage", s.unit.path) })),
  };
}

/** Impede que o sistema fique sem nenhum administrador ativo na raiz. */
async function assertSystemAdminRemains(tx: Tx) {
  const remaining = await tx.userScope.count({ where: { role: { isSystem: true }, unit: { depth: 0 }, user: { status: "ATIVO" } } });
  if (remaining === 0) throw Errors.conflict("Não é possível remover ou desativar o último administrador do sistema.");
}

/** O usuário só administra quem está lotado em unidades sob sua gestão — e nunca a si mesmo. */
async function loadManageable(actor: Actor, id: string) {
  const user = await loadVisible(actor, id);
  if (user.id === actor.userId) throw Errors.forbidden("Por segregação de funções, você não pode alterar o próprio cadastro de acesso.");
  assertCan(actor, "user.manage", user.homeUnit.path);
  return user;
}

export async function createUser(actor: Actor, input: CreateUserInput, meta: RequestMeta) {
  const unit = await prisma.organizationUnit.findUnique({ where: { id: input.homeUnitId } });
  if (!unit || !can(actor, "user.read", unit.path)) throw Errors.notFound("Unidade de lotação");
  assertCan(actor, "user.manage", unit.path, "Você não pode cadastrar usuários nesta unidade.");
  if (unit.status !== "ATIVA") throw Errors.invalid("A unidade de lotação está inativa.");
  const issues = passwordPolicyIssues(input.temporaryPassword, input);
  if (issues.length) throw Errors.invalid("A senha provisória não atende à política.", { temporaryPassword: issues });
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    throw Errors.conflict("Já existe um usuário com este e-mail.");
  }
  const passwordHash = await hashPassword(input.temporaryPassword);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        homeUnitId: unit.id,
        passwordHash,
        mustChangePassword: true,
        createdById: actor.userId,
        updatedById: actor.userId,
      },
      select: { id: true, email: true, name: true },
    });
    await recordAudit(
      { action: "usuario.criado", actor: auditActor(actor), objectType: "User", objectId: user.id, unitPath: unit.path, metadata: { email: user.email, lotacao: unit.code } },
      meta,
      tx,
    );
    return user;
  });
}

export async function updateUser(actor: Actor, id: string, input: { name?: string; homeUnitId?: string }, meta: RequestMeta) {
  const user = await loadManageable(actor, id);
  let newUnitPath: string | undefined;
  if (input.homeUnitId && input.homeUnitId !== user.homeUnitId) {
    const unit = await prisma.organizationUnit.findUnique({ where: { id: input.homeUnitId } });
    if (!unit || !can(actor, "user.read", unit.path)) throw Errors.notFound("Unidade de lotação");
    assertCan(actor, "user.manage", unit.path, "Você não pode transferir usuários para esta unidade.");
    if (unit.status !== "ATIVA") throw Errors.invalid("A unidade de lotação está inativa.");
    newUnitPath = unit.path;
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { ...input, updatedById: actor.userId }, select: { id: true, name: true } });
    await recordAudit(
      {
        action: "usuario.alterado",
        actor: auditActor(actor),
        objectType: "User",
        objectId: id,
        unitPath: newUnitPath ?? user.homeUnit.path,
        metadata: { campos: Object.keys(input), ...(newUnitPath ? { lotacaoAnterior: user.homeUnit.code } : {}) },
      },
      meta,
      tx,
    );
    return updated;
  });
}

export async function setUserStatus(actor: Actor, id: string, status: UserStatus, reason: string, meta: RequestMeta) {
  const user = await loadManageable(actor, id);
  if (user.status === status) return;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status, updatedById: actor.userId } });
    if (status !== "ATIVO") await assertSystemAdminRemains(tx);
    if (status !== "ATIVO") await revokeUserSessions(id, {}, tx);
    await recordAudit(
      { action: "usuario.situacao", actor: auditActor(actor), objectType: "User", objectId: id, unitPath: user.homeUnit.path, metadata: { de: user.status, para: status, justificativa: reason } },
      meta,
      tx,
    );
  });
}

export async function setTemporaryPassword(actor: Actor, id: string, password: string, meta: RequestMeta) {
  const user = await loadManageable(actor, id);
  const issues = passwordPolicyIssues(password, user);
  if (issues.length) throw Errors.invalid("A senha provisória não atende à política.", { temporaryPassword: issues });
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: true } });
    await revokeUserSessions(id, {}, tx);
    await recordAudit({ action: "usuario.senha_provisoria", actor: auditActor(actor), objectType: "User", objectId: id, unitPath: user.homeUnit.path }, meta, tx);
  });
}

export async function resetUserMfa(actor: Actor, id: string, meta: RequestMeta) {
  const user = await loadManageable(actor, id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastUsedStep: null } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: id } });
    await revokeUserSessions(id, {}, tx);
    await recordAudit({ action: "usuario.mfa_redefinido", actor: auditActor(actor), objectType: "User", objectId: id, unitPath: user.homeUnit.path }, meta, tx);
  });
}

/**
 * Atribui um papel em uma unidade. Regras contra escalonamento de privilégio:
 * o ator precisa de user.manage na lotação do usuário e na unidade do escopo,
 * e precisa possuir, naquela unidade, todas as permissões do papel concedido.
 */
export async function addUserScope(
  actor: Actor,
  userId: string,
  input: { roleId: string; unitId?: string; workId?: string; includeDescendants: boolean },
  meta: RequestMeta,
) {
  const user = await loadManageable(actor, userId);
  let work: { id: string; code: string; unitId: string } | null = null;
  if (input.workId) {
    work = await prisma.work.findUnique({ where: { id: input.workId }, select: { id: true, code: true, unitId: true, unitPath: true } });
    if (!work) throw Errors.notFound("Obra");
  }
  const [role, unit] = await Promise.all([
    prisma.role.findUnique({ where: { id: input.roleId }, include: { permissions: true } }),
    prisma.organizationUnit.findUnique({ where: { id: work ? work.unitId : input.unitId! } }),
  ]);
  if (!role) throw Errors.notFound("Papel");
  if (!unit || !can(actor, "org.read", unit.path)) throw Errors.notFound("Unidade");
  assertCan(actor, "user.manage", unit.path, "Você não pode conceder acesso nesta unidade.");
  if (unit.status !== "ATIVA") throw Errors.invalid("A unidade está inativa.");
  const held = permissionsAt(actor, unit.path);
  const missing = role.permissions.map((p) => p.permissionCode).filter((p) => !held.has(p));
  if (missing.length) {
    await recordAudit(
      { action: "usuario.escopo.negado", result: "NEGADO", actor: auditActor(actor), objectType: "User", objectId: userId, unitPath: unit.path, metadata: { papel: role.code, permissoesFaltantes: missing } },
      meta,
    );
    throw Errors.forbidden("Você não pode conceder um papel com permissões que você mesmo não possui nesta unidade.");
  }
  return prisma.$transaction(async (tx) => {
    const scope = await tx.userScope.create({
      data: { userId, roleId: role.id, unitId: unit.id, workId: work?.id ?? null, includeDescendants: work ? false : input.includeDescendants, grantedById: actor.userId },
    });
    await recordAudit(
      {
        action: "usuario.escopo.concedido",
        actor: auditActor(actor),
        objectType: "UserScope",
        objectId: scope.id,
        unitPath: unit.path,
        metadata: { usuario: user.email, papel: role.code, unidade: unit.code, obra: work?.code, incluiSubordinadas: work ? false : input.includeDescendants },
      },
      meta,
      tx,
    );
    return scope;
  });
}

export async function removeUserScope(actor: Actor, userId: string, scopeId: string, meta: RequestMeta) {
  const user = await loadManageable(actor, userId);
  const scope = await prisma.userScope.findFirst({ where: { id: scopeId, userId }, include: { role: true, unit: true } });
  if (!scope) throw Errors.notFound("Atribuição");
  assertCan(actor, "user.manage", scope.unit.path, "Você não pode revogar acessos nesta unidade.");
  await prisma.$transaction(async (tx) => {
    await tx.userScope.delete({ where: { id: scopeId } });
    if (scope.role.isSystem && scope.unit.depth === 0) await assertSystemAdminRemains(tx);
    // Os escopos são relidos a cada requisição: a perda de acesso tem efeito imediato.
    await recordAudit(
      {
        action: "usuario.escopo.revogado",
        actor: auditActor(actor),
        objectType: "UserScope",
        objectId: scopeId,
        unitPath: scope.unit.path,
        metadata: { usuario: user.email, papel: scope.role.code, unidade: scope.unit.code },
      },
      meta,
      tx,
    );
  });
}
