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
    permissions: [
      "dashboard.view", "org.read", "org.manage", "user.read", "user.manage", "role.read", "audit.read",
      "work.read", "work.create", "work.manage", "work.transition", "document.read", "document.upload",
      "requirement.read", "requirement.evaluate", "report.generate",
    ],
  },
  {
    code: "ANALISTA_CENTRAL",
    name: "Analista da gestão central",
    description: "Analisa documentos e decide aprovações de obras no seu escopo.",
    requiresMfa: true,
    isSystem: false,
    permissions: [
      "dashboard.view", "org.read", "work.read", "document.read", "document.review", "requirement.read",
      "requirement.evaluate", "requirement.waive", "approval.decide", "report.generate",
    ],
  },
  {
    code: "RESPONSAVEL_OBRA",
    name: "Responsável pela obra",
    description: "Acompanha uma obra específica: etapas, documentos e requisitos. Atribuído por obra.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["work.read", "work.manage", "document.read", "document.upload", "requirement.read", "report.generate"],
  },
  {
    code: "AUDITOR",
    name: "Auditor",
    description: "Consulta a trilha de auditoria e a estrutura, sem alterar dados.",
    requiresMfa: true,
    isSystem: false,
    permissions: ["dashboard.view", "org.read", "user.read", "role.read", "audit.read", "work.read", "document.read", "requirement.read", "report.generate"],
  },
  {
    code: "CONSULTA",
    name: "Consulta",
    description: "Visualiza o painel, a estrutura e as obras da sua unidade.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["dashboard.view", "org.read", "work.read", "document.read", "requirement.read"],
  },
];

export const WORK_TYPES = [
  { code: "CONSTRUCAO", name: "Construção nova", sortOrder: 1 },
  { code: "AMPLIACAO", name: "Ampliação", sortOrder: 2 },
  { code: "REFORMA", name: "Reforma", sortOrder: 3 },
  { code: "MANUTENCAO", name: "Manutenção", sortOrder: 4 },
  { code: "REPARO_EMERGENCIAL", name: "Reparo emergencial", sortOrder: 5 },
];

export const ACTIVITY_TYPES = [
  { code: "TRABALHO_ALTURA", name: "Trabalho em altura" },
  { code: "ELETRICIDADE", name: "Instalações e serviços em eletricidade" },
  { code: "ESPACO_CONFINADO", name: "Trabalho em espaço confinado" },
  { code: "MAQUINAS", name: "Uso de máquinas e equipamentos" },
  { code: "MOVIMENTACAO_CARGAS", name: "Movimentação e armazenagem de materiais" },
  { code: "CONSTRUCAO_CIVIL", name: "Atividades da indústria da construção" },
  { code: "DEMOLICAO", name: "Demolição" },
];

export const DOCUMENT_CATEGORIES = [
  { code: "PROJETO", name: "Projeto", requiresExpiry: false },
  { code: "ART_RRT", name: "ART / RRT", requiresExpiry: false },
  { code: "ALVARA", name: "Alvará / licença", requiresExpiry: true },
  { code: "CONTRATO", name: "Contrato / ordem de serviço", requiresExpiry: false },
  { code: "ORCAMENTO", name: "Orçamento / cotação", requiresExpiry: false },
  { code: "ANALISE_RISCO", name: "Análise de risco / permissão de trabalho", requiresExpiry: true },
  { code: "TREINAMENTO", name: "Certificado de treinamento", requiresExpiry: true },
  { code: "LAUDO", name: "Laudo técnico", requiresExpiry: false },
  { code: "FOTO", name: "Registro fotográfico", requiresExpiry: false },
  { code: "OUTRO", name: "Outro", requiresExpiry: false },
];

export const APPROVAL_POLICIES = [
  { kind: "SOLICITACAO_OBRA" as const, name: "Aprovação de solicitação de obra", stepsRequired: 1, requireSegregation: true },
  { kind: "ENCERRAMENTO_OBRA" as const, name: "Aprovação de vistoria e encerramento", stepsRequired: 1, requireSegregation: true },
];

/**
 * Regras de partida para a matriz de requisitos. TODAS entram como
 * PENDENTE_VALIDACAO, sem efeito de bloqueio, sem artigos, prazos ou URLs:
 * a redação vigente, a base legal e a aplicabilidade devem ser confirmadas
 * por responsável técnico/jurídico antes da validação.
 */
const nr = (code: string, name: string, activities: string[], evidence: string, extra: Partial<{ executionModes: ("VOLUNTARIOS" | "EMPRESA_CONTRATADA" | "MISTA")[]; note: string; category: string }> = {}) => ({
  code,
  name,
  activities,
  executionModes: extra.executionModes ?? [],
  evidence,
  documentCategoryCode: extra.category ?? null,
  classification: "LEGAL_CONDICIONAL" as const,
  legalBasis: `${code.replace("-", " ").replace("NR ", "NR-")} — redação vigente a confirmar`,
  applicabilityNote:
    extra.note ??
    "Aplicabilidade depende da atividade, do risco, do vínculo dos trabalhadores e da redação vigente da norma. Confirmar com responsável técnico antes de validar.",
  checkpoint: "INICIO_EXECUCAO" as const,
});

export const REQUIREMENT_RULES = [
  nr("NR-01", "NR-1 — Gerenciamento de riscos ocupacionais", [], "Inventário de riscos e plano de ação aplicáveis", {
    executionModes: ["EMPRESA_CONTRATADA", "MISTA"],
    category: "ANALISE_RISCO",
    note: "Pode ser aplicável conforme o vínculo dos trabalhadores (por exemplo, empresa contratada). A situação de voluntários exige avaliação jurídica específica.",
  }),
  nr("NR-06", "NR-6 — Equipamentos de proteção individual", ["CONSTRUCAO_CIVIL", "TRABALHO_ALTURA", "ELETRICIDADE", "DEMOLICAO"], "Registro de fornecimento de EPI adequado ao risco"),
  nr("NR-10", "NR-10 — Segurança em instalações e serviços em eletricidade", ["ELETRICIDADE"], "Evidência de capacitação e medidas de controle para serviços em eletricidade", { category: "TREINAMENTO" }),
  nr("NR-11", "NR-11 — Transporte, movimentação, armazenagem e manuseio de materiais", ["MOVIMENTACAO_CARGAS"], "Evidência de capacitação/condições para movimentação de materiais"),
  nr("NR-12", "NR-12 — Segurança no trabalho em máquinas e equipamentos", ["MAQUINAS"], "Evidência de condições seguras e capacitação para uso de máquinas"),
  nr("NR-18", "NR-18 — Segurança e saúde no trabalho na indústria da construção", ["CONSTRUCAO_CIVIL", "DEMOLICAO"], "Documentação de gestão de segurança aplicável ao canteiro", { category: "ANALISE_RISCO" }),
  nr("NR-33", "NR-33 — Segurança e saúde nos trabalhos em espaços confinados", ["ESPACO_CONFINADO"], "Permissão de entrada e capacitação para espaço confinado", { category: "ANALISE_RISCO" }),
  nr("NR-35", "NR-35 — Trabalho em altura", ["TRABALHO_ALTURA"], "Análise de risco e evidência de capacitação para trabalho em altura", { category: "TREINAMENTO" }),
];
