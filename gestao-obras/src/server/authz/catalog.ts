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
  "person.read": { module: "Pessoas", description: "Consultar profissionais, voluntários e demais pessoas" },
  "person.manage": { module: "Pessoas", description: "Cadastrar pessoas, qualificações e vínculos com obras" },
  "company.read": { module: "Empresas", description: "Consultar empresas e contratos" },
  "company.manage": { module: "Empresas", description: "Cadastrar empresas e registrar conferência cadastral" },
  "contract.manage": { module: "Empresas", description: "Cadastrar contratos, aditivos e ordens de serviço" },
  "epi.read": { module: "EPIs", description: "Consultar catálogo, estoque e entregas de EPI" },
  "epi.stock": { module: "EPIs", description: "Movimentar estoque e registrar entregas e devoluções de EPI" },
  "epi.manage": { module: "EPIs", description: "Manter o catálogo de EPIs (somente na raiz)" },
  "equipment.read": { module: "Equipamentos", description: "Consultar ferramentas e equipamentos" },
  "equipment.manage": { module: "Equipamentos", description: "Cadastrar equipamentos e registrar inspeções e manutenções" },
  "safety.read": { module: "Segurança", description: "Consultar inspeções, riscos, incidentes e ações corretivas" },
  "safety.inspect": { module: "Segurança", description: "Realizar inspeções e registrar riscos e incidentes" },
  "safety.action": { module: "Segurança", description: "Criar ações corretivas e registrar evidências de correção" },
  "safety.validate": { module: "Segurança", description: "Validar o encerramento de ações corretivas" },
  "budget.read": { module: "Orçamento", description: "Consultar orçamentos, lançamentos e medições" },
  "budget.manage": { module: "Orçamento", description: "Elaborar orçamentos, registrar lançamentos e medições e submetê-los à aprovação" },
  "privacy.manage": { module: "Privacidade", description: "Atender solicitações de titulares de dados (somente na raiz)" },
  "settings.manage": { module: "Configurações", description: "Alterar parâmetros do sistema (somente na raiz)" },
  "safety.config": { module: "Segurança", description: "Configurar checklists e critérios de criticidade (somente na raiz)" },
  "agenda.read": { module: "Agenda", description: "Consultar a agenda de obras das unidades" },
  "agenda.manage": { module: "Agenda", description: "Agendar, concluir e cancelar compromissos da agenda de obras" },
  "health.read": { module: "Saúde ocupacional", description: "Consultar ASO e aptidões (dado sensível de saúde)" },
  "health.manage": { module: "Saúde ocupacional", description: "Registrar e conferir ASO" },
  "self.portal": { module: "Portal do titular", description: "Acessar o próprio cadastro, qualificações e ASO e enviar comprovantes" },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

export function isPermissionCode(value: string): value is PermissionCode {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}
