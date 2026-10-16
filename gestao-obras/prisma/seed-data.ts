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
    name: "Master (administração geral)",
    description: "Acesso técnico integral. Deve ser concedido somente na unidade raiz e a poucas pessoas.",
    requiresMfa: true,
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    code: "GESTOR_REGIONAL",
    name: "Admin regional",
    description: "Administra unidades, usuários, obras e pessoas somente dentro da sua região.",
    requiresMfa: true,
    isSystem: false,
    permissions: [
      "dashboard.view", "org.read", "org.manage", "user.read", "user.manage", "role.read", "audit.read",
      "work.read", "work.create", "work.manage", "work.transition", "document.read", "document.upload",
      "requirement.read", "requirement.evaluate", "report.generate",
      "person.read", "person.manage", "company.read", "company.manage", "contract.manage", "epi.read", "epi.stock",
      "equipment.read", "equipment.manage", "safety.read", "safety.inspect", "safety.action",
      "budget.read", "budget.manage", "agenda.read", "agenda.manage",
    ],
  },
  {
    code: "TECNICO_SEGURANCA",
    name: "Técnico de segurança",
    description: "Realiza inspeções, acompanha riscos, incidentes e ações corretivas e valida encerramentos.",
    requiresMfa: true,
    isSystem: false,
    permissions: [
      "dashboard.view", "org.read", "work.read", "document.read", "document.upload", "requirement.read",
      "person.read", "epi.read", "epi.stock", "equipment.read", "equipment.manage",
      "safety.read", "safety.inspect", "safety.action", "safety.validate", "report.generate",
      "health.read", "health.manage", "agenda.read", "agenda.manage",
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
      "person.read", "company.read", "epi.read", "equipment.read", "safety.read", "safety.validate", "budget.read", "agenda.read",
    ],
  },
  {
    code: "RESPONSAVEL_OBRA",
    name: "Encarregado de obra",
    description: "Conduz a obra no dia a dia: etapas, diário, documentos, equipe e ações de segurança. Atribuído por obra ou unidade.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["work.read", "work.manage", "document.read", "document.upload", "requirement.read", "report.generate", "safety.read", "safety.action", "budget.read", "person.read", "agenda.read", "agenda.manage"],
  },
  {
    code: "AUDITOR",
    name: "Auditor",
    description: "Consulta a trilha de auditoria e a estrutura, sem alterar dados.",
    requiresMfa: true,
    isSystem: false,
    permissions: [
      "dashboard.view", "org.read", "user.read", "role.read", "audit.read", "work.read", "document.read", "requirement.read", "report.generate",
      "person.read", "company.read", "epi.read", "equipment.read", "safety.read", "budget.read", "agenda.read",
    ],
  },
  {
    code: "CONSULTA",
    name: "Consulta",
    description: "Visualiza o painel, a estrutura e as obras da sua unidade.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["dashboard.view", "org.read", "work.read", "document.read", "requirement.read", "safety.read", "agenda.read"],
  },
  {
    code: "VOLUNTARIO",
    name: "Voluntário",
    description: "Acessa somente o próprio cadastro: qualificações, ASO, obras em que atua, e envia comprovantes para conferência.",
    requiresMfa: false,
    isSystem: false,
    permissions: ["self.portal"],
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
  { code: "ASO", name: "Atestado de saúde ocupacional (ASO) — restrito", requiresExpiry: false },
  { code: "EXPERIENCIA", name: "Comprovação de experiência", requiresExpiry: false },
  { code: "REGISTRO_PROFISSIONAL", name: "Registro profissional / conselho", requiresExpiry: false },
  { code: "OUTRO", name: "Outro", requiresExpiry: false },
];

export const APPROVAL_POLICIES = [
  { kind: "SOLICITACAO_OBRA" as const, name: "Aprovação de solicitação de obra", stepsRequired: 1, requireSegregation: true },
  { kind: "ENCERRAMENTO_OBRA" as const, name: "Aprovação de vistoria e encerramento", stepsRequired: 1, requireSegregation: true },
  { kind: "MUDANCA_ESCOPO" as const, name: "Aprovação de mudança de escopo", stepsRequired: 1, requireSegregation: true },
  { kind: "ORCAMENTO" as const, name: "Aprovação de orçamento e aditivos", stepsRequired: 1, requireSegregation: true },
  { kind: "MEDICAO" as const, name: "Aprovação de medição", stepsRequired: 1, requireSegregation: true },
  { kind: "DESPESA" as const, name: "Aprovação de despesa", stepsRequired: 1, requireSegregation: true },
];

/** Parâmetros iniciais (técnicos, configuráveis). */
export const SYSTEM_SETTINGS = [
  { key: "budget.deviationAlertPercent", value: 10 },
  { key: "retention.loginAttemptsDays", value: 180 },
  { key: "retention.sessionsDays", value: 90 },
  { key: "privacy.responseDays", value: 15 },
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

/** Critérios de criticidade iniciais (técnicos, ajustáveis na configuração). */
export const CRITICALITY_LEVELS = [
  { code: "BAIXA", name: "Baixa", rank: 1, responseDays: 30, priorityAlert: false, blocksProgress: false },
  { code: "MEDIA", name: "Média", rank: 2, responseDays: 15, priorityAlert: false, blocksProgress: false },
  { code: "ALTA", name: "Alta", rank: 3, responseDays: 5, priorityAlert: true, blocksProgress: false },
  { code: "CRITICA", name: "Crítica", rank: 4, responseDays: 1, priorityAlert: true, blocksProgress: true },
];

/** Checklist de exemplo (genérico, sem citar exigências normativas específicas). */
export const CHECKLIST_TEMPLATES = [
  {
    name: "Inspeção geral de canteiro (exemplo)",
    workTypes: [] as string[],
    items: [
      { text: "Área de trabalho organizada e acessos desobstruídos", defaultCriticality: "MEDIA" },
      { text: "Isolamento e sinalização da área de risco", defaultCriticality: "ALTA" },
      { text: "Trabalhadores usando os EPIs definidos para a atividade", defaultCriticality: "ALTA" },
      { text: "Escadas, andaimes e plataformas em bom estado", defaultCriticality: "CRITICA" },
      { text: "Instalações elétricas provisórias protegidas", defaultCriticality: "CRITICA" },
      { text: "Extintores acessíveis e dentro da validade", defaultCriticality: "MEDIA" },
      { text: "Instalações sanitárias e água potável disponíveis", defaultCriticality: "MEDIA" },
      { text: "Materiais armazenados de forma estável", defaultCriticality: "BAIXA" },
    ],
  },
];

/** EPIs fictícios para demonstração (CA e fabricantes inventados, marcados como exemplo). */
export const DEMO_EPIS = [
  { name: "Capacete de segurança (exemplo)", epiType: "Proteção da cabeça", manufacturer: "Fabricante Exemplo", caNumber: "00000", minStock: 10, indicatedFor: ["CONSTRUCAO_CIVIL"] },
  { name: "Cinto tipo paraquedista (exemplo)", epiType: "Proteção contra quedas", manufacturer: "Fabricante Exemplo", caNumber: "00001", minStock: 4, indicatedFor: ["TRABALHO_ALTURA"] },
  { name: "Luva de raspa (exemplo)", epiType: "Proteção das mãos", manufacturer: "Fabricante Exemplo", caNumber: "00002", minStock: 20, indicatedFor: ["CONSTRUCAO_CIVIL", "DEMOLICAO"] },
];

/**
 * Exigências por atividade para as PESSOAS que a executam (exemplos técnicos).
 * Todas começam PENDENTES DE VALIDAÇÃO e sem bloqueio: só passam a impedir vínculos
 * depois de validadas por responsável, com fonte e data de revisão registradas.
 */
export const PERSON_REQUIREMENT_RULES = [
  { code: "PESSOA-ALTURA-TREINAMENTO", name: "Treinamento para trabalho em altura (NR-35) dentro da validade", activityCode: "TRABALHO_ALTURA", kind: "CREDENCIAL" as const, credentialKind: "TREINAMENTO" as const, credentialNameContains: "NR-35", classification: "LEGAL_CONDICIONAL" as const },
  { code: "PESSOA-ALTURA-ASO", name: "ASO conferido declarando aptidão para trabalho em altura", activityCode: "TRABALHO_ALTURA", kind: "SAUDE" as const, credentialKind: null, credentialNameContains: null, classification: "LEGAL_CONDICIONAL" as const },
  { code: "PESSOA-ELETRICIDADE-TREINAMENTO", name: "Treinamento de segurança em eletricidade (NR-10) dentro da validade", activityCode: "ELETRICIDADE", kind: "CREDENCIAL" as const, credentialKind: "TREINAMENTO" as const, credentialNameContains: "NR-10", classification: "LEGAL_CONDICIONAL" as const },
  { code: "PESSOA-ELETRICIDADE-ASO", name: "ASO conferido declarando aptidão para serviços em eletricidade", activityCode: "ELETRICIDADE", kind: "SAUDE" as const, credentialKind: null, credentialNameContains: null, classification: "LEGAL_CONDICIONAL" as const },
  { code: "PESSOA-CONFINADO-TREINAMENTO", name: "Treinamento para espaço confinado (NR-33) dentro da validade", activityCode: "ESPACO_CONFINADO", kind: "CREDENCIAL" as const, credentialKind: "TREINAMENTO" as const, credentialNameContains: "NR-33", classification: "LEGAL_CONDICIONAL" as const },
  { code: "PESSOA-CONFINADO-ASO", name: "ASO conferido declarando aptidão para espaço confinado", activityCode: "ESPACO_CONFINADO", kind: "SAUDE" as const, credentialKind: null, credentialNameContains: null, classification: "LEGAL_CONDICIONAL" as const },
];
