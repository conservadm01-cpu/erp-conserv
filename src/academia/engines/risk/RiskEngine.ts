// =====================================================================
// "EU VI UM RISCO" (seção 19)
// ---------------------------------------------------------------------
// Regras de registro e tratamento de risco ficam aqui, não nas telas:
// código sequencial, linha do tempo, XP, notificação da gestão e
// auditoria seguem as mesmas regras venham de onde vierem.
//
// PRIVACIDADE (regra que não pode ser quebrada): em registro anônimo,
// nada pode ligar a pessoa ao registro — nem o lançamento de XP, nem a
// auditoria, nem a notificação.
// =====================================================================

import type { Employee, ID, RiskPriority, RiskReport, RiskStatus } from "../../core/types";
import { auditRepo, notificationRepo, riskRepo } from "../../data/repositories";
import { riskCode, uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { xpEngine } from "../gamification/XpEngine";
import type { BadgeGrant } from "../gamification/BadgeEngine";
import { notificationEngine } from "../notification/NotificationEngine";
import { settingsRepo } from "../../data/repositories";

export interface RiskInput {
  sector: string;
  place: string;
  category: string;
  description: string;
  priority: RiskPriority;
  anonymous: boolean;
  photoRef?: string;
}

export interface RiskOutcome {
  report: RiskReport;
  xpEarned: number;
  newBadges: BadgeGrant[];
}

export const RISK_FLOW: RiskStatus[] = ["aberto", "em_analise", "acao_definida", "resolvido", "encerrado"];

export const riskEngine = {
  /** Valida o que a tela não deve decidir sozinha. */
  validate(input: RiskInput): string | null {
    if (input.description.trim().length < 10) {
      return "Descreva o risco com um pouco mais de detalhe (o que você viu e onde).";
    }
    if (!input.sector.trim()) return "Informe o setor.";
    return null;
  },

  report(input: RiskInput, author: Employee): RiskOutcome {
    const report: RiskReport = {
      id: uid("RSK"),
      code: riskCode(riskRepo.nextSequence()),
      employeeId: input.anonymous ? undefined : author.id,
      employeeName: input.anonymous ? undefined : author.name,
      anonymous: input.anonymous,
      sector: input.sector,
      place: input.place.trim() || "Não informado",
      category: input.category,
      description: input.description.trim(),
      photoRef: input.photoRef,
      priority: input.priority,
      status: "aberto",
      createdAt: nowIso(),
      timeline: [{
        at: nowIso(),
        status: "aberto",
        note: input.anonymous ? "Registro anônimo." : "Registro feito pelo colaborador.",
        byId: input.anonymous ? undefined : author.id,
        byName: input.anonymous ? undefined : author.name,
      }],
    };
    riskRepo.save(report);

    // XP: no registro anônimo vai SEM o id do registro. Guardar o vínculo
    // permitiria descobrir quem reportou cruzando XP com o registro.
    const amount = settingsRepo.get().xpRules.riskReport;
    const award = input.anonymous
      ? xpEngine.award(author.id, amount, "Contribuição com a segurança", "risco")
      : xpEngine.award(author.id, amount, "Risco reportado", "risco", report.id);

    notificationEngine.notifyRole(
      "GESTOR",
      `Novo risco (${report.priority})`,
      `${report.sector} — ${report.category}: ${report.description.slice(0, 90)}`,
      "risco",
      "/admin/riscos",
    );

    auditRepo.log({
      actorId: input.anonymous ? "anonimo" : author.id,
      actorName: input.anonymous ? "Anônimo" : author.name,
      action: "risk.create",
      entity: "risk_reports",
      entityId: report.id,
      detail: `${report.code} · ${report.category} · ${report.sector}`,
    });

    return { report, xpEarned: amount, newBadges: award.newBadges };
  },

  /** Faz o registro andar no fluxo e avisa quem reportou (se identificado). */
  advance(report: RiskReport, status: RiskStatus, note: string, actor: Employee, actionPlan?: RiskReport["actionPlan"]): RiskReport {
    const updated: RiskReport = {
      ...report,
      status,
      actionPlan: actionPlan ?? report.actionPlan,
      timeline: [...report.timeline, { at: nowIso(), status, note, byId: actor.id, byName: actor.name }],
      closedAt: status === "encerrado" || status === "resolvido" ? nowIso() : report.closedAt,
    };
    riskRepo.save(updated);

    // Registro anônimo não recebe aviso: não sabemos (e não devemos saber)
    // quem reportou.
    if (report.employeeId && !report.anonymous) {
      notificationEngine.notifyEmployee(
        report.employeeId,
        `Seu registro ${report.code} foi atualizado`,
        `Status: ${status.replace(/_/g, " ")} — ${note}`,
        "risco",
        "/risco",
      );
    }

    auditRepo.log({
      actorId: actor.id,
      actorName: actor.name,
      action: `risk.${status}`,
      entity: "risk_reports",
      entityId: report.id,
      detail: `${report.code}: ${note}`,
    });

    return updated;
  },

  /** Próximo passo sugerido no fluxo. */
  nextStatus(current: RiskStatus): RiskStatus {
    const index = RISK_FLOW.indexOf(current);
    return RISK_FLOW[Math.min(index + 1, RISK_FLOW.length - 1)];
  },

  /** Indicadores usados no painel do gestor. */
  summary(employeeId?: ID) {
    const all = employeeId ? riskRepo.ofEmployee(employeeId) : [...riskRepo.all()];
    return {
      total: all.length,
      abertos: all.filter((r) => r.status !== "resolvido" && r.status !== "encerrado").length,
      criticos: all.filter((r) => r.priority === "critica" || r.priority === "alta").length,
      resolvidos: all.filter((r) => r.status === "resolvido" || r.status === "encerrado").length,
      semLeitura: notificationRepo.all().filter((n) => n.kind === "risco" && !n.read).length,
    };
  },
};
