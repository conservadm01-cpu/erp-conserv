export const WORK_STATUS: Record<string, { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }> = {
  RASCUNHO: { label: "Rascunho", tone: "slate" },
  SOLICITADA: { label: "Solicitada", tone: "blue" },
  EM_TRIAGEM: { label: "Em triagem", tone: "blue" },
  EM_APROVACAO: { label: "Em aprovação", tone: "amber" },
  APROVADA: { label: "Aprovada", tone: "green" },
  EM_EXECUCAO: { label: "Em execução", tone: "blue" },
  SUSPENSA: { label: "Suspensa", tone: "red" },
  EM_VISTORIA: { label: "Em vistoria", tone: "amber" },
  CONCLUIDA: { label: "Concluída", tone: "green" },
  REJEITADA: { label: "Rejeitada", tone: "red" },
  ARQUIVADA: { label: "Arquivada", tone: "slate" },
};

export const DOC_STATUS: Record<string, { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }> = {
  ENVIADO: { label: "Enviado", tone: "blue" },
  EM_REVISAO: { label: "Em revisão", tone: "amber" },
  APROVADO: { label: "Aprovado", tone: "green" },
  REJEITADO: { label: "Rejeitado", tone: "red" },
  VENCIDO: { label: "Vencido", tone: "red" },
  SUBSTITUIDO: { label: "Substituído", tone: "slate" },
};

export const EVAL_STATUS: Record<string, { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }> = {
  PENDENTE: { label: "Pendente", tone: "amber" },
  ATENDIDO: { label: "Atendido", tone: "green" },
  NAO_ATENDIDO: { label: "Não atendido", tone: "red" },
  DISPENSADO_JUSTIFICADO: { label: "Dispensado (justificado)", tone: "slate" },
  NAO_APLICAVEL: { label: "Não aplicável", tone: "slate" },
};

export const RULE_STATUS: Record<string, { label: string; tone: "slate" | "blue" | "amber" | "green" | "red" }> = {
  PENDENTE_VALIDACAO: { label: "Pendente de confirmação", tone: "amber" },
  VALIDADA: { label: "Validada", tone: "green" },
  INATIVA: { label: "Inativa", tone: "slate" },
};

export const CLASSIFICATION: Record<string, string> = {
  LEGAL_OBRIGATORIO: "Legal obrigatório",
  LEGAL_CONDICIONAL: "Legal condicional",
  CONTRATUAL: "Contratual",
  INSTITUCIONAL_APROVADO: "Institucional aprovado",
  BOA_PRATICA: "Boa prática",
  INFORMATIVO: "Informativo",
};

export const CHECKPOINT: Record<string, string> = {
  TRIAGEM: "Triagem",
  APROVACAO: "Aprovação",
  INICIO_EXECUCAO: "Início da execução",
  VISTORIA: "Vistoria",
  ENCERRAMENTO: "Encerramento",
};

export const PRIORITY: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente" };
export const EXECUTION_MODE: Record<string, string> = { VOLUNTARIOS: "Voluntários", EMPRESA_CONTRATADA: "Empresa contratada", MISTA: "Mista" };
export const STAGE_STATUS: Record<string, string> = { NAO_INICIADA: "Não iniciada", EM_ANDAMENTO: "Em andamento", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" };
export const APPROVAL_KIND: Record<string, string> = { SOLICITACAO_OBRA: "Solicitação de obra", ENCERRAMENTO_OBRA: "Vistoria e encerramento" };
export const APPROVAL_STATUS: Record<string, string> = { PENDENTE: "Pendente", APROVADA: "Aprovada", REJEITADA: "Rejeitada", DEVOLVIDA: "Devolvida", CANCELADA: "Cancelada" };
export const DECISION: Record<string, string> = { APROVAR: "Aprovou", REJEITAR: "Rejeitou", DEVOLVER: "Devolveu" };
