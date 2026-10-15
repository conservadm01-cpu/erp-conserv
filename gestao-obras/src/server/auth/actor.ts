import type { User } from "@prisma/client";
import { prisma } from "../db";
import type { Actor } from "../authz/authorize";
import type { LoadedSession } from "./session";

/** Estado de autenticação da sessão. Somente "OK" libera o sistema. */
export type AuthState = "OK" | "MFA_PENDENTE" | "MFA_CADASTRO_OBRIGATORIO" | "TROCA_SENHA_OBRIGATORIA";

export async function userRequiresMfa(userId: string): Promise<boolean> {
  const count = await prisma.userScope.count({ where: { userId, role: { requiresMfa: true } } });
  return count > 0;
}

export async function authStateFor(session: LoadedSession): Promise<AuthState> {
  const u = session.user;
  if (u.mfaEnabledAt) {
    if (!session.mfaVerifiedAt) return "MFA_PENDENTE";
  } else if (await userRequiresMfa(u.id)) {
    return "MFA_CADASTRO_OBRIGATORIO";
  }
  if (u.mustChangePassword) return "TROCA_SENHA_OBRIGATORIA";
  return "OK";
}

export async function buildActor(user: Pick<User, "id" | "email" | "name" | "homeUnitId">, sessionId: string): Promise<Actor> {
  const [home, scopes] = await Promise.all([
    prisma.organizationUnit.findUniqueOrThrow({ where: { id: user.homeUnitId }, select: { path: true } }),
    prisma.userScope.findMany({
      where: { userId: user.id, unit: { status: "ATIVA" } },
      include: {
        role: { include: { permissions: { select: { permissionCode: true } } } },
        unit: { select: { name: true, path: true } },
      },
    }),
  ]);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    sessionId,
    homeUnitId: user.homeUnitId,
    homeUnitPath: home.path,
    scopes: scopes.map((s) => ({
      scopeId: s.id,
      roleId: s.roleId,
      roleCode: s.role.code,
      roleName: s.role.name,
      unitId: s.unitId,
      unitName: s.unit.name,
      unitPath: s.unit.path,
      includeDescendants: s.includeDescendants,
      permissions: s.role.permissions.map((p) => p.permissionCode),
    })),
  };
}
