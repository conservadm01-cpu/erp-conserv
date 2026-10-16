import type { ApprovalKind } from "@prisma/client";
import type { Tx } from "../db";
import { Errors } from "../http/errors";

/** Aprovações cujo objeto não é a situação da própria obra. */
export const SUBJECT_KINDS: ApprovalKind[] = ["MUDANCA_ESCOPO", "ORCAMENTO", "MEDICAO", "DESPESA"];

type Outcome = "APROVAR" | "REJEITAR" | "DEVOLVER";

/** Confere se o objeto ainda aguarda decisão. */
export async function assertSubjectPending(tx: Tx, kind: ApprovalKind, subjectId: string) {
  const pending =
    kind === "ORCAMENTO" ? (await tx.budget.findUnique({ where: { id: subjectId } }))?.status === "EM_APROVACAO"
    : kind === "MEDICAO" ? (await tx.measurement.findUnique({ where: { id: subjectId } }))?.status === "EM_APROVACAO"
    : kind === "DESPESA" ? (await tx.costEntry.findUnique({ where: { id: subjectId } }))?.status === "AGUARDANDO_APROVACAO"
    : (await tx.scopeChange.findUnique({ where: { id: subjectId } }))?.status === "EM_APROVACAO";
  if (!pending) throw Errors.conflict("O objeto desta aprovação mudou de situação. A aprovação precisa ser reaberta.");
}

/** Aplica a decisão final ao objeto aprovado. */
export async function applySubjectOutcome(tx: Tx, kind: ApprovalKind, subjectId: string, workId: string, outcome: Outcome, actorId: string) {
  const now = new Date();
  switch (kind) {
    case "ORCAMENTO":
      if (outcome === "APROVAR") {
        await tx.budget.updateMany({ where: { workId, status: "APROVADO" }, data: { status: "SUBSTITUIDO" } });
        await tx.budget.update({ where: { id: subjectId }, data: { status: "APROVADO", approvedAt: now } });
      } else {
        await tx.budget.update({ where: { id: subjectId }, data: { status: outcome === "REJEITAR" ? "REJEITADO" : "RASCUNHO" } });
      }
      return;
    case "MEDICAO":
      await tx.measurement.update({ where: { id: subjectId }, data: { status: outcome === "APROVAR" ? "APROVADA" : outcome === "REJEITAR" ? "REJEITADA" : "RASCUNHO" } });
      return;
    case "DESPESA":
      await tx.costEntry.update({ where: { id: subjectId }, data: { status: outcome === "APROVAR" ? "APROVADO" : "REJEITADO" } });
      return;
    case "MUDANCA_ESCOPO": {
      const change = await tx.scopeChange.update({ where: { id: subjectId }, data: { status: outcome === "APROVAR" ? "APROVADA" : outcome === "REJEITAR" ? "REJEITADA" : "DEVOLVIDA", decidedAt: now } });
      if (outcome === "APROVAR") {
        await tx.work.update({ where: { id: workId }, data: { scope: change.proposedScope, justification: change.proposedJustification, version: { increment: 1 }, updatedById: actorId } });
      }
      return;
    }
    default:
      throw Errors.conflict("Tipo de aprovação sem tratamento.");
  }
}
