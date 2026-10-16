import type { WorkCheckpoint, WorkStatus } from "@prisma/client";

/**
 * Máquina de estados das obras. Transições "manuais" são acionadas por
 * usuários com permissão; transições "aprovacao" só ocorrem pela decisão
 * registrada em uma aprovação.
 */
export type Transition = {
  from: WorkStatus;
  to: WorkStatus;
  action: string;
  label: string;
  mode: "manual" | "aprovacao";
  permission: "work.manage" | "work.transition";
  requiresReason: boolean;
  /** Ponto de verificação cujos requisitos bloqueantes precisam estar atendidos. */
  checkpoint?: WorkCheckpoint;
  /** Abre uma aprovação do tipo indicado ao entrar no novo estado. */
  opensApproval?: "SOLICITACAO_OBRA" | "ENCERRAMENTO_OBRA";
};

export const TRANSITIONS: readonly Transition[] = [
  { from: "RASCUNHO", to: "SOLICITADA", action: "solicitar", label: "Enviar solicitação", mode: "manual", permission: "work.manage", requiresReason: false },
  { from: "RASCUNHO", to: "ARQUIVADA", action: "cancelar", label: "Cancelar rascunho", mode: "manual", permission: "work.manage", requiresReason: true },
  { from: "SOLICITADA", to: "EM_TRIAGEM", action: "iniciar_triagem", label: "Iniciar triagem", mode: "manual", permission: "work.transition", requiresReason: false },
  { from: "SOLICITADA", to: "RASCUNHO", action: "devolver", label: "Devolver ao solicitante", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "EM_TRIAGEM", to: "EM_APROVACAO", action: "enviar_aprovacao", label: "Enviar para aprovação", mode: "manual", permission: "work.transition", requiresReason: false, checkpoint: "TRIAGEM", opensApproval: "SOLICITACAO_OBRA" },
  { from: "EM_TRIAGEM", to: "RASCUNHO", action: "devolver", label: "Devolver ao solicitante", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "EM_TRIAGEM", to: "REJEITADA", action: "rejeitar", label: "Rejeitar na triagem", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "EM_APROVACAO", to: "APROVADA", action: "aprovar", label: "Aprovar", mode: "aprovacao", permission: "work.transition", requiresReason: false, checkpoint: "APROVACAO" },
  { from: "EM_APROVACAO", to: "REJEITADA", action: "rejeitar", label: "Rejeitar", mode: "aprovacao", permission: "work.transition", requiresReason: true },
  { from: "EM_APROVACAO", to: "RASCUNHO", action: "devolver", label: "Devolver para ajustes", mode: "aprovacao", permission: "work.transition", requiresReason: true },
  { from: "APROVADA", to: "EM_EXECUCAO", action: "iniciar_execucao", label: "Iniciar execução", mode: "manual", permission: "work.transition", requiresReason: false, checkpoint: "INICIO_EXECUCAO" },
  { from: "EM_EXECUCAO", to: "SUSPENSA", action: "suspender", label: "Suspender", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "SUSPENSA", to: "EM_EXECUCAO", action: "retomar", label: "Retomar", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "EM_EXECUCAO", to: "EM_VISTORIA", action: "enviar_vistoria", label: "Enviar para vistoria", mode: "manual", permission: "work.transition", requiresReason: false, checkpoint: "VISTORIA", opensApproval: "ENCERRAMENTO_OBRA" },
  { from: "EM_VISTORIA", to: "CONCLUIDA", action: "aprovar", label: "Aprovar encerramento", mode: "aprovacao", permission: "work.transition", requiresReason: false, checkpoint: "ENCERRAMENTO" },
  { from: "EM_VISTORIA", to: "EM_EXECUCAO", action: "devolver", label: "Devolver para execução", mode: "aprovacao", permission: "work.transition", requiresReason: true },
  { from: "CONCLUIDA", to: "EM_EXECUCAO", action: "reabrir", label: "Reabrir obra", mode: "manual", permission: "work.transition", requiresReason: true },
  { from: "CONCLUIDA", to: "ARQUIVADA", action: "arquivar", label: "Arquivar", mode: "manual", permission: "work.transition", requiresReason: false },
  { from: "REJEITADA", to: "ARQUIVADA", action: "arquivar", label: "Arquivar", mode: "manual", permission: "work.transition", requiresReason: false },
];

export function manualTransitionsFrom(status: WorkStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === status && t.mode === "manual");
}

export function findManualTransition(status: WorkStatus, action: string): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === status && t.action === action && t.mode === "manual");
}

export function findApprovalTransition(status: WorkStatus, decision: "APROVAR" | "REJEITAR" | "DEVOLVER"): Transition | undefined {
  const action = { APROVAR: "aprovar", REJEITAR: "rejeitar", DEVOLVER: "devolver" }[decision];
  // No encerramento, rejeitar equivale a devolver para execução.
  return (
    TRANSITIONS.find((t) => t.from === status && t.mode === "aprovacao" && t.action === action) ??
    (decision === "REJEITAR" ? TRANSITIONS.find((t) => t.from === status && t.mode === "aprovacao" && t.action === "devolver") : undefined)
  );
}

/** Estados em que escopo e justificativa ainda podem ser alterados. */
export const SCOPE_EDITABLE: readonly WorkStatus[] = ["RASCUNHO", "SOLICITADA", "EM_TRIAGEM"];
/** Estados finais: nenhuma alteração de dados. */
export const FROZEN: readonly WorkStatus[] = ["CONCLUIDA", "REJEITADA", "ARQUIVADA"];

export const STATUS_LABEL: Record<WorkStatus, string> = {
  RASCUNHO: "Rascunho",
  SOLICITADA: "Solicitada",
  EM_TRIAGEM: "Em triagem",
  EM_APROVACAO: "Em aprovação",
  APROVADA: "Aprovada",
  EM_EXECUCAO: "Em execução",
  SUSPENSA: "Suspensa",
  EM_VISTORIA: "Em vistoria",
  CONCLUIDA: "Concluída",
  REJEITADA: "Rejeitada",
  ARQUIVADA: "Arquivada",
};
