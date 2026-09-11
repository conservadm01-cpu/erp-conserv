// =====================================================================
// APRENDIZADO ADAPTATIVO (seção 26)
// ---------------------------------------------------------------------
// Analisa erros de quiz, tempo, competências, cursos, desafios e jogos e
// devolve recomendações concretas — sempre apontando para conteúdo que
// existe e está publicado.
// =====================================================================

import type { ID, Recommendation } from "../../core/types";
import { catalogRepo, learningRepo, peopleRepo } from "../../data/repositories";
import { competencyEngine } from "../competency/CompetencyEngine";
import { progressEngine } from "./ProgressEngine";

export interface WeakPoint {
  subject: string;
  errors: number;
  total: number;
  accuracy: number;
  competencyIds: ID[];
}

export const adaptiveEngine = {
  /** Assuntos com mais erro nas últimas tentativas de quiz. */
  weakPoints(employeeId: ID, limit = 3): WeakPoint[] {
    const attempts = learningRepo.quizAttempts(employeeId);
    const map = new Map<string, { errors: number; total: number; comps: Set<ID> }>();
    for (const attempt of attempts) {
      for (const answer of attempt.answers) {
        const acc = map.get(answer.subject) ?? { errors: 0, total: 0, comps: new Set<ID>() };
        acc.total += 1;
        if (!answer.correct) acc.errors += 1;
        for (const c of answer.competencies) acc.comps.add(c);
        map.set(answer.subject, acc);
      }
    }
    return [...map.entries()]
      .map(([subject, acc]) => ({
        subject,
        errors: acc.errors,
        total: acc.total,
        accuracy: acc.total === 0 ? 1 : (acc.total - acc.errors) / acc.total,
        competencyIds: [...acc.comps],
      }))
      .filter((w) => w.errors > 0 && w.accuracy < 0.75)
      .sort((a, b) => a.accuracy - b.accuracy || b.errors - a.errors)
      .slice(0, limit);
  },

  /** Trilhas obrigatórias da função que ainda não foram iniciadas. */
  mandatoryPending(employeeId: ID): Recommendation[] {
    const employee = peopleRepo.employee(employeeId);
    if (!employee) return [];
    const roleName = peopleRepo.jobRoleName(employee.jobRoleId);
    const out: Recommendation[] = [];
    for (const path of catalogRepo.publishedPaths()) {
      const forMe = path.recommendedFor.includes("Todos") || path.recommendedFor.includes(roleName);
      if (!path.mandatory || !forMe) continue;
      for (const courseId of path.courseIds) {
        const enrollment = learningRepo.enrollment(employeeId, courseId);
        if (enrollment?.status === "concluido") continue;
        const course = catalogRepo.course(courseId);
        if (!course) continue;
        out.push({
          id: `mand-${courseId}`,
          kind: "curso",
          title: course.title,
          reason: `Trilha obrigatória: ${path.title}`,
          refId: courseId,
          priority: 10,
          link: `/curso/${courseId}`,
        });
      }
    }
    return out;
  },

  /** Lista completa de recomendações para o dashboard. */
  recommendations(employeeId: ID, limit = 5): Recommendation[] {
    const out: Recommendation[] = [...this.mandatoryPending(employeeId)];

    // 1. Continuar o que está em andamento.
    for (const enrollment of learningRepo.inProgress(employeeId)) {
      const course = catalogRepo.course(enrollment.courseId);
      if (!course) continue;
      const next = progressEngine.nextLesson(employeeId, course.id);
      out.push({
        id: `cont-${course.id}`,
        kind: next ? "aula" : "quiz",
        title: next ? next.title : `Avaliação final — ${course.title}`,
        reason: `Continuar ${course.title} (${enrollment.progressPct}%)`,
        refId: next ? next.id : course.id,
        priority: 9,
        link: next ? `/curso/${course.id}/aula/${next.id}` : `/curso/${course.id}`,
      });
    }

    // 2. Reforço dirigido pelos erros de quiz.
    for (const weak of this.weakPoints(employeeId)) {
      const competencyId = weak.competencyIds[0];
      const games = competencyId ? catalogRepo.publishedGames().filter((g) => g.competencies.includes(competencyId)) : [];
      if (games[0]) {
        out.push({
          id: `ref-game-${games[0].id}`,
          kind: "jogo",
          title: games[0].title,
          reason: `Você precisa reforçar: ${weak.subject}`,
          refId: games[0].id,
          priority: 8,
          link: `/jogos/${games[0].id}`,
        });
      }
      out.push({
        id: `ref-${weak.subject}`,
        kind: "reforco",
        title: `Reforçar ${weak.subject}`,
        reason: `${Math.round(weak.accuracy * 100)}% de acerto nesse assunto`,
        refId: weak.competencyIds[0] ?? weak.subject,
        priority: 8,
        link: `/reforco/${encodeURIComponent(weak.subject)}`,
      });
    }

    // 3. Lacunas de competência da função.
    out.push(...competencyEngine.recommendations(employeeId, 3).map((r) => ({ ...r, priority: 7 })));

    // 4. Curso novo da área, ainda não iniciado.
    const employee = peopleRepo.employee(employeeId);
    if (employee) {
      const sector = peopleRepo.departmentName(employee.departmentId);
      for (const course of catalogRepo.publishedCourses()) {
        if (learningRepo.enrollment(employeeId, course.id)) continue;
        if (course.sector !== sector && course.sector !== "Todos") continue;
        out.push({
          id: `new-${course.id}`,
          kind: "curso",
          title: course.title,
          reason: `Recomendado para ${sector}`,
          refId: course.id,
          priority: 5,
          link: `/curso/${course.id}`,
        });
      }
    }

    const unique = new Map<string, Recommendation>();
    for (const rec of out.sort((a, b) => b.priority - a.priority)) {
      if (!unique.has(rec.refId + rec.kind)) unique.set(rec.refId + rec.kind, rec);
    }
    return [...unique.values()].slice(0, limit);
  },
};
