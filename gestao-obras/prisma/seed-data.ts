import type { PermissionCode } from "../src/server/authz/catalog";
import { ALL_PERMISSIONS } from "../src/server/authz/catalog";

/**
 * Configuração inicial de exemplo. Os papéis abaixo são apenas uma proposta
 * técnica de partida e devem ser revistos pelos responsáveis autorizados.
 */
export const ORG_UNIT_TYPES = [
  { code: "CENTRAL", name: "Gestão central", isRoot: true, allowedParentCodes: [], sortOrder: 1 },
  { code: "REGIAO", name: "Região administrativa", isRoot: false, allowedParentCodes: ["CENTRAL"], sortOrder: 2 },
  { code: "CONGREGACAO", name: "Congregação / unidade local", isRoot: false, allowedParentCodes: ["REGIAO"], sortOrder: 3 },
];

export const ROLES: { code: string; name: string; description: string; requiresMfa: boolean; isSystem: boolean; permissions: PermissionCode[] }[] = [
  {
    code: "ADMIN_SISTEMA",
    name: "Administrador do sistema",
    description: "Acesso técnico integral. Deve ser concedido somente na unidade raiz e a poucas pessoas.",
    requiresMfa: true,
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    code: "GESTOR_REGIONAL",
    name: "Gestor regional",
    description: "Administra unidades e usuários dentro da sua região.",
    requiresMfa: true,
    isSystem: false,
    permissions: ["dashboard.view", "org.read", "org.manage", "user.read", "user.manage", "role.read", "audit.read"],
  },
  {
    code: "AUDITOR",
    name: "Auditor",
    description: "Consulta a trilha de auditoria e a estrutura, sem alterar dados.",
    requiresMfa: true,
    isSystem: false,
    permissions: ["dashboard.view", "org.read", "user.read", "role.read", "audit.read"],
  },
  {
    code: "CONSULTA",
    name: "Consulta",
    description: "Visualiza o painel e a estrutura da sua unidade.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["dashboard.view", "org.read"],
  },
];
