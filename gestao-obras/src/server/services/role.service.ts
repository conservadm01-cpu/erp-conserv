import { prisma } from "../db";
import { recordAudit } from "../audit/audit";
import { allPermissions, assertCan, assertCanAnywhere, can, type Actor } from "../authz/authorize";
import { isPermissionCode, PERMISSIONS } from "../authz/catalog";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { getRootUnit } from "./org-unit.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export async function listRoles(actor: Actor) {
  assertCanAnywhere(actor, "role.read");
  const root = await getRootUnit();
  const roles = await prisma.role.findMany({
    include: { permissions: { select: { permissionCode: true } }, _count: { select: { scopes: true } } },
    orderBy: { name: "asc" },
  });
  const canManage = Boolean(root && can(actor, "role.manage", root.path));
  return {
    canManage,
    roles: roles.map((r) => ({ ...r, permissions: r.permissions.map((p) => p.permissionCode) })),
  };
}

/** Papéis disponíveis para atribuição (leitura mínima, usada no cadastro de usuários). */
export async function listAssignableRoles(actor: Actor) {
  assertCanAnywhere(actor, "user.manage");
  const roles = await prisma.role.findMany({ include: { permissions: { select: { permissionCode: true } } }, orderBy: { name: "asc" } });
  return roles.map((r) => ({ id: r.id, code: r.code, name: r.name, requiresMfa: r.requiresMfa, permissions: r.permissions.map((p) => p.permissionCode) }));
}

export function listPermissionCatalog() {
  return Object.entries(PERMISSIONS).map(([code, p]) => ({ code, ...p }));
}

async function assertRoleAdmin(actor: Actor) {
  const root = await getRootUnit();
  if (!root) throw Errors.conflict("Estrutura organizacional não inicializada.");
  // Papéis valem para todo o sistema: só quem tem role.manage na raiz pode alterá-los.
  assertCan(actor, "role.manage", root.path, "A configuração de papéis é restrita à gestão central.");
}

function validatePermissions(actor: Actor, codes: string[]) {
  const invalid = codes.filter((c) => !isPermissionCode(c));
  if (invalid.length) throw Errors.invalid("Permissões desconhecidas.", { permissions: invalid });
  const held = allPermissions(actor);
  const notHeld = codes.filter((c) => !held.has(c));
  if (notHeld.length) throw Errors.forbidden("Você não pode atribuir a um papel permissões que não possui.");
  return [...new Set(codes)];
}

export async function createRole(
  actor: Actor,
  input: { code: string; name: string; description: string | null; requiresMfa: boolean; permissions: string[] },
  meta: RequestMeta,
) {
  await assertRoleAdmin(actor);
  const permissions = validatePermissions(actor, input.permissions);
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        requiresMfa: input.requiresMfa,
        permissions: { create: permissions.map((permissionCode) => ({ permissionCode })) },
      },
    });
    await recordAudit(
      { action: "papel.criado", actor: auditActor(actor), objectType: "Role", objectId: role.id, metadata: { codigo: role.code, permissoes: permissions, exigeMfa: role.requiresMfa } },
      meta,
      tx,
    );
    return role;
  });
}

export async function updateRole(
  actor: Actor,
  id: string,
  input: { name?: string; description?: string | null; requiresMfa?: boolean; permissions?: string[] },
  meta: RequestMeta,
) {
  await assertRoleAdmin(actor);
  const role = await prisma.role.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) throw Errors.notFound("Papel");
  const before = role.permissions.map((p) => p.permissionCode).sort();
  if (role.isSystem) {
    if (input.permissions && input.permissions.length < before.length) {
      throw Errors.conflict("Papéis de sistema não podem perder permissões.");
    }
    if (input.requiresMfa === false) throw Errors.conflict("Papéis de sistema exigem MFA.");
  }
  const permissions = input.permissions ? validatePermissions(actor, input.permissions).sort() : undefined;
  return prisma.$transaction(async (tx) => {
    if (permissions) {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: permissions.map((permissionCode) => ({ roleId: id, permissionCode })) });
    }
    const updated = await tx.role.update({
      where: { id },
      data: { name: input.name, description: input.description, requiresMfa: input.requiresMfa },
    });
    await recordAudit(
      {
        action: "papel.alterado",
        actor: auditActor(actor),
        objectType: "Role",
        objectId: id,
        metadata: {
          codigo: role.code,
          ...(permissions
            ? { adicionadas: permissions.filter((p) => !before.includes(p)), removidas: before.filter((p) => !permissions.includes(p)) }
            : {}),
          ...(input.requiresMfa !== undefined ? { exigeMfa: input.requiresMfa } : {}),
        },
      },
      meta,
      tx,
    );
    return updated;
  });
}
