import { Errors } from "../http/errors";
import type { PermissionCode } from "./catalog";

export type ActorScope = {
  scopeId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  unitId: string;
  unitName: string;
  unitPath: string;
  includeDescendants: boolean;
  permissions: readonly string[];
};

export type Actor = {
  userId: string;
  email: string;
  name: string;
  sessionId: string;
  homeUnitId: string;
  homeUnitPath: string;
  scopes: readonly ActorScope[];
};

export function scopeCovers(scope: Pick<ActorScope, "unitPath" | "includeDescendants">, unitPath: string): boolean {
  return scope.includeDescendants ? unitPath.startsWith(scope.unitPath) : unitPath === scope.unitPath;
}

/** O ator possui a permissão na unidade indicada (diretamente ou por herança)? */
export function can(actor: Actor, permission: PermissionCode, unitPath: string): boolean {
  return actor.scopes.some((s) => s.permissions.includes(permission) && scopeCovers(s, unitPath));
}

/** O ator possui a permissão em ao menos uma unidade? */
export function canAnywhere(actor: Actor, permission: PermissionCode): boolean {
  return actor.scopes.some((s) => s.permissions.includes(permission));
}

export function permissionsAt(actor: Actor, unitPath: string): Set<string> {
  const out = new Set<string>();
  for (const s of actor.scopes) if (scopeCovers(s, unitPath)) s.permissions.forEach((p) => out.add(p));
  return out;
}

export function allPermissions(actor: Actor): Set<string> {
  const out = new Set<string>();
  for (const s of actor.scopes) s.permissions.forEach((p) => out.add(p));
  return out;
}

export type PathGrant = { path: string; includeDescendants: boolean };

/** `o` concede tudo o que `g` concede? */
function grantCovers(o: PathGrant, g: PathGrant): boolean {
  return o.includeDescendants ? g.path.startsWith(o.path) : g.path === o.path && !g.includeDescendants;
}

/** Escopos em que a permissão vale, sem redundâncias (escopos contidos em outros são removidos). */
export function grantsFor(actor: Actor, permission: PermissionCode): PathGrant[] {
  const unique = new Map<string, PathGrant>();
  for (const s of actor.scopes) {
    if (!s.permissions.includes(permission)) continue;
    unique.set(`${s.unitPath}|${s.includeDescendants}`, { path: s.unitPath, includeDescendants: s.includeDescendants });
  }
  const grants = [...unique.values()];
  return grants.filter((g) => !grants.some((o) => o !== g && grantCovers(o, g)));
}

/**
 * Condição Prisma (`{ OR: [...] }`) sobre um campo de caminho materializado.
 * Retorna `null` quando o ator não tem a permissão em lugar algum.
 */
export function pathWhere<F extends string = "path">(actor: Actor, permission: PermissionCode, field: F = "path" as F) {
  const grants = grantsFor(actor, permission);
  if (grants.length === 0) return null;
  return {
    OR: grants.map((g) => ({ [field]: g.includeDescendants ? { startsWith: g.path } : { equals: g.path } }) as Record<F, { startsWith: string } | { equals: string }>),
  };
}

export function assertCan(actor: Actor, permission: PermissionCode, unitPath: string, message?: string): void {
  if (!can(actor, permission, unitPath)) throw Errors.forbidden(message);
}

export function assertCanAnywhere(actor: Actor, permission: PermissionCode): void {
  if (!canAnywhere(actor, permission)) throw Errors.forbidden();
}
