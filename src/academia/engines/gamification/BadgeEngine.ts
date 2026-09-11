// =====================================================================
// GAMIFICAÇÃO — BADGES
// Regras declarativas (Badge.rule) avaliadas contra a atividade real.
// Criar um badge novo pelo painel não exige alterar este arquivo.
// =====================================================================

import type { Badge, BadgeRule, EmployeeBadge, ID } from "../../core/types";
import { catalogRepo, competencyRepo, gamificationRepo, learningRepo, riskRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";

export interface BadgeGrant {
  badge: Badge;
  record: EmployeeBadge;
}

interface Stats {
  coursesCompleted: number;
  lessonsCompleted: number;
  bestScores: number[];
  perfectQuizzes: number;
  challengesCorrect: number;
  riskReports: number;
  curiositiesRead: number;
  totalXp: number;
}

function collectStats(employeeId: ID): Stats {
  const enrollments = learningRepo.enrollmentsOf(employeeId);
  const attempts = learningRepo.quizAttempts(employeeId);
  const challenges = learningRepo.challengeAttempts(employeeId);
  const xp = gamificationRepo.xpOf(employeeId);
  return {
    coursesCompleted: enrollments.filter((e) => e.status === "concluido").length,
    lessonsCompleted: learningRepo.progressOf(employeeId).filter((p) => p.status === "concluido").length,
    bestScores: attempts.map((a) => a.score),
    perfectQuizzes: attempts.filter((a) => a.score >= 100).length,
    challengesCorrect: challenges.filter((c) => c.correct).length,
    riskReports: riskRepo.ofEmployee(employeeId).length,
    curiositiesRead: xp.filter((t) => t.refType === "curiosidade").length,
    totalXp: xp.reduce((sum, t) => sum + t.amount, 0),
  };
}

function matches(rule: BadgeRule, employeeId: ID, stats: Stats): boolean {
  switch (rule.kind) {
    case "first_course":
      return stats.coursesCompleted >= 1;
    case "courses_completed":
      return stats.coursesCompleted >= rule.count;
    case "lessons_completed":
      return stats.lessonsCompleted >= rule.count;
    case "quiz_score":
      return stats.bestScores.filter((s) => s >= rule.min).length >= rule.count;
    case "perfect_quiz":
      return stats.perfectQuizzes >= rule.count;
    case "games_passed": {
      const sessions = learningRepo.gameSessions(employeeId).filter((s) => s.passed);
      const filtered = rule.gameType
        ? sessions.filter((s) => catalogRepo.game(s.gameId)?.type === rule.gameType)
        : sessions;
      return filtered.length >= rule.count;
    }
    case "challenges_correct":
      return stats.challengesCorrect >= rule.count;
    case "risk_reports":
      return stats.riskReports >= rule.count;
    case "competency_level": {
      const entry = competencyRepo.entry(employeeId, rule.competencyId);
      return !!entry && entry.level >= rule.level;
    }
    case "path_completed": {
      const paths = rule.pathId ? [catalogRepo.path(rule.pathId)] : catalogRepo.publishedPaths();
      const done = paths.filter((path) => {
        if (!path || path.courseIds.length === 0) return false;
        return path.courseIds.every((courseId) => learningRepo.enrollment(employeeId, courseId)?.status === "concluido");
      });
      return done.length >= (rule.count ?? 1);
    }
    case "curiosities_read":
      return stats.curiositiesRead >= rule.count;
    case "xp_total":
      return stats.totalXp >= rule.amount;
    default:
      return false;
  }
}

export const badgeEngine = {
  /** Concede todos os badges cujas regras o colaborador já cumpre. */
  evaluate(employeeId: ID): BadgeGrant[] {
    const stats = collectStats(employeeId);
    const grants: BadgeGrant[] = [];
    for (const badge of gamificationRepo.activeBadges()) {
      if (gamificationRepo.hasBadge(employeeId, badge.id)) continue;
      if (!matches(badge.rule, employeeId, stats)) continue;
      const record = gamificationRepo.grantBadge({
        id: uid("EBG"),
        employeeId,
        badgeId: badge.id,
        earnedAt: nowIso(),
        context: badge.description,
      });
      // XP do badge é lançado direto, sem reavaliar badges (evita laço).
      gamificationRepo.saveXp({
        id: uid("XP"),
        employeeId,
        amount: badge.xp,
        reason: `Badge conquistado: ${badge.name}`,
        refType: "curso",
        refId: badge.id,
        at: nowIso(),
      });
      grants.push({ badge, record });
    }
    return grants;
  },

  /** Progresso visível dos badges ainda não conquistados. */
  pending(employeeId: ID): Badge[] {
    return gamificationRepo.activeBadges().filter((b) => !gamificationRepo.hasBadge(employeeId, b.id));
  },
};
