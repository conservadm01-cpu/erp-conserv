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
  "work.read": { module: "Obras", description: "Consultar obras, etapas e histórico" },
  "work.create": { module: "Obras", description: "Cadastrar solicitações de obra" },
  "work.manage": { module: "Obras", description: "Editar obras e etapas e submeter solicitações" },
  "work.transition": { module: "Obras", description: "Triar, iniciar, suspender, retomar, enviar à vistoria e arquivar obras" },
  "document.read": { module: "Documentos", description: "Consultar e baixar documentos" },
  "document.upload": { module: "Documentos", description: "Enviar documentos e novas versões" },
  "document.review": { module: "Documentos", description: "Analisar, aprovar ou rejeitar documentos" },
  "requirement.read": { module: "Requisitos", description: "Consultar regras documentais e a situação dos requisitos" },
  "requirement.evaluate": { module: "Requisitos", description: "Registrar atendimento de requisitos de uma obra" },
  "requirement.waive": { module: "Requisitos", description: "Dispensar requisitos com justificativa" },
  "requirement.manage": { module: "Requisitos", description: "Configurar e validar regras documentais (somente na raiz)" },
  "approval.decide": { module: "Aprovações", description: "Decidir aprovações de obras" },
  "approval.policy.manage": { module: "Aprovações", description: "Configurar fluxos e alçadas de aprovação (somente na raiz)" },
  "report.generate": { module: "Relatórios", description: "Gerar relatórios em PDF" },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

export function isPermissionCode(value: string): value is PermissionCode {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
