// =====================================================================
// Progresso, matrícula e conclusão de curso
// ---------------------------------------------------------------------
// Concentra o fluxo: matricular → concluir aula → avaliar → certificar.
// Nenhum componente de tela altera progresso direto: todos passam aqui.
// =====================================================================

import type { Certificate, Enrollment, ID, Lesson } from "../../core/types";
import { auditRepo, catalogRepo, learningRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { xpEngine } from "../gamification/XpEngine";
import type { BadgeGrant } from "../gamification/BadgeEngine";
import { competencyEngine } from "../competency/CompetencyEngine";
import { certificateEngine } from "../certificate/CertificateEngine";
import { notificationEngine } from "../notification/NotificationEngine";

export interface LessonCompletion {
  lessonXp: number;
  leveledUp: boolean;
  newBadges: BadgeGrant[];
  enrollment: Enrollment;
  courseCompleted: boolean;
  nextLessonId?: ID;
}

export interface CourseCompletion {
  enrollment: Enrollment;
  certificate: Certificate | null;
  xpEarned: number;
  newBadges: BadgeGrant[];
  finalScore: number;
}

export const progressEngine = {
  enroll(employeeId: ID, courseId: ID, source: Enrollment["source"] = "autoinscricao"): Enrollment {
    const existing = learningRepo.enrollment(employeeId, courseId);
    if (existing) return existing;
    const lessons = catalogRepo.orderedLessons(courseId);
    return learningRepo.saveEnrollment({
      id: uid("ENR"),
      employeeId,
      courseId,
      status: "em_andamento",
      progressPct: 0,
      lessonsDone: 0,
      lessonsTotal: lessons.length,
      startedAt: nowIso(),
      lastActivityAt: nowIso(),
      source,
    });
  },

  /** Recalcula progresso a partir dos registros de aula concluída. */
  refreshEnrollment(employeeId: ID, courseId: ID): Enrollment {
    const enrollment = this.enroll(employeeId, courseId, "auto");
    const lessons = catalogRepo.orderedLessons(courseId);
    const done = learningRepo.completedLessonIds(employeeId, courseId);
    const lessonsDone = lessons.filter((l) => done.has(l.id)).length;
    const progressPct = lessons.length === 0 ? 0 : Math.round((lessonsDone / lessons.length) * 100);
    return learningRepo.saveEnrollment({
      ...enrollment,
      lessonsDone,
      lessonsTotal: lessons.length,
      progressPct,
      lastActivityAt: nowIso(),
      status: enrollment.status === "concluido" ? "concluido" : "em_andamento",
    });
  },

  completeLesson(employeeId: ID, lesson: Lesson, timeSpentSec = 0): LessonCompletion {
    const existing = learningRepo.lessonProgress(employeeId, lesson.id);
    const alreadyDone = existing?.status === "concluido";
    learningRepo.saveProgress({
      id: existing?.id ?? uid("PRG"),
      employeeId,
      courseId: lesson.courseId,
      lessonId: lesson.id,
      status: "concluido",
      timeSpentSec: (existing?.timeSpentSec ?? 0) + timeSpentSec,
      startedAt: existing?.startedAt ?? nowIso(),
      completedAt: nowIso(),
    });

    const rules = settingsRepo.get().xpRules;
    const amount = alreadyDone ? 0 : lesson.xp || rules.lesson;
    const award = amount > 0
      ? xpEngine.award(employeeId, amount, `Aula concluída: ${lesson.title}`, "aula", lesson.id)
      : { leveledUp: false, newBadges: [] as BadgeGrant[] };

    if (!alreadyDone) {
      for (const competencyId of lesson.competencies) {
        competencyEngine.registerEvidence(employeeId, competencyId, "aula", lesson.id, `Aula: ${lesson.title}`);
      }
    }

    const enrollment = this.refreshEnrollment(employeeId, lesson.courseId);
    const lessons = catalogRepo.orderedLessons(lesson.courseId);
    const done = learningRepo.completedLessonIds(employeeId, lesson.courseId);
    const next = lessons.find((l) => !done.has(l.id));

    return {
      lessonXp: amount,
      leveledUp: award.leveledUp,
      newBadges: award.newBadges,
      enrollment,
      courseCompleted: !next,
      nextLessonId: next?.id,
    };
  },

  /** Todas as aulas concluídas? (pré-requisito da avaliação final) */
  lessonsFinished(employeeId: ID, courseId: ID): boolean {
    const lessons = catalogRepo.orderedLessons(courseId);
    if (lessons.length === 0) return false;
    const done = learningRepo.completedLessonIds(employeeId, courseId);
    return lessons.every((l) => done.has(l.id));
  },

  /**
   * Fecha o curso: marca conclusão, lança XP de curso, registra evidência
   * de competência e emite certificado quando o aproveitamento permite.
   */
  completeCourse(employeeId: ID, courseId: ID, finalScore: number): CourseCompletion {
    const course = catalogRepo.course(courseId);
    const enrollmentBase = this.refreshEnrollment(employeeId, courseId);
    const passed = finalScore >= (course?.passScore ?? settingsRepo.get().defaultPassScore);
    const rules = settingsRepo.get().xpRules;

    let certificate: Certificate | null = null;
    let xpEarned = 0;
    let newBadges: BadgeGrant[] = [];

    // A matrícula é fechada ANTES de lançar XP: o BadgeEngine conta
    // "cursos concluídos" lendo as matrículas, então a ordem importa.
    const enrollment = learningRepo.saveEnrollment({
      ...enrollmentBase,
      status: passed ? "concluido" : "reprovado",
      finalScore,
      completedAt: passed ? nowIso() : undefined,
      lastActivityAt: nowIso(),
    });

    if (passed && course) {
      for (const competencyId of course.competencies) {
        competencyEngine.registerEvidence(employeeId, competencyId, "curso", courseId, `Curso: ${course.title}`, finalScore / 100);
      }
      certificate = certificateEngine.issue({ employeeId, kind: "curso", refId: courseId, score: finalScore });
      xpEarned = rules.course + (certificate ? rules.certificate : 0);
      const award = xpEngine.award(
        employeeId,
        xpEarned,
        certificate ? `Curso concluído e certificado: ${course.title}` : `Curso concluído: ${course.title}`,
        "curso",
        courseId,
      );
      newBadges = award.newBadges;
      notificationEngine.notifyEmployee(
        employeeId,
        "Curso concluído!",
        certificate
          ? `Seu certificado de ${course.title} está disponível (código ${certificate.code}).`
          : `Você concluiu ${course.title}.`,
        "conquista",
        certificate ? `/certificados` : `/curso/${courseId}`,
      );
    }

    const finalEnrollment = certificate
      ? learningRepo.saveEnrollment({ ...enrollment, certificateId: certificate.id })
      : enrollment;

    auditRepo.log({
      actorId: employeeId,
      actorName: peopleRepo.employee(employeeId)?.name ?? employeeId,
      action: passed ? "course.complete" : "course.fail",
      entity: "enrollments",
      entityId: finalEnrollment.id,
      detail: `${course?.title ?? courseId} · ${finalScore}%${certificate ? ` · certificado ${certificate.code}` : ""}`,
    });

    return { enrollment: finalEnrollment, certificate, xpEarned, newBadges, finalScore };
  },

  /** Próxima aula a fazer de um curso (para o botão "Continuar"). */
  nextLesson(employeeId: ID, courseId: ID): Lesson | undefined {
    const done = learningRepo.completedLessonIds(employeeId, courseId);
    return catalogRepo.orderedLessons(courseId).find((l) => !done.has(l.id));
  },
};
