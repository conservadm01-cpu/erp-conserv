/**
 * Catálogo de permissões implementadas. Cada fase acrescenta as suas.
 * A atribuição de permissões a papéis é configurável pela tela de permissões.
 */
export const PERMISSIONS = {
  "dashboard.view": { module: "Painel", description: "Visualizar o painel de indicadores" },
  "org.read": { module: "Organização", description: "Consultar unidades organizacionais" },
  "org.manage": { module: "Organização", description: "Criar, editar e inativar unidades organizacionais" },
  "user.read": { module: "Usuários", description: "Consultar usuários" },
  "user.manage": { module: "Usuários", description: "Criar e editar usuários, atribuir papéis e redefinir MFA" },
  "role.read": { module: "Permissões", description: "Consultar papéis e permissões" },
  "role.manage": { module: "Permissões", description: "Criar papéis e alterar suas permissões (somente na raiz)" },
  "audit.read": { module: "Auditoria", description: "Consultar a trilha de auditoria" },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

export function isPermissionCode(value: string): value is PermissionCode {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
