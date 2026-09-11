import { db } from "../db";
import type {
  ChallengeAttempt, Enrollment, GameSession, ID, LessonProgress, QuizAttempt,
} from "../../core/types";
import { dayKey } from "../../core/dates";

/** Matrículas, progresso e histórico de atividades do colaborador. */
export const learningRepo = {
  enrollments(): readonly Enrollment[] {
    return db.list("enrollments");
  },
  enrollmentsOf(employeeId: ID): Enrollment[] {
    return db.filter("enrollments", (e) => e.employeeId === employeeId);
  },
  enrollment(employeeId: ID, courseId: ID): Enrollment | undefined {
    return db.find("enrollments", (e) => e.employeeId === employeeId && e.courseId === courseId);
  },
  saveEnrollment(enrollment: Enrollment): Enrollment {
    return db.put("enrollments", enrollment);
  },
  inProgress(employeeId: ID): Enrollment[] {
    return this.enrollmentsOf(employeeId)
      .filter((e) => e.status === "em_andamento")
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  },
  completed(employeeId: ID): Enrollment[] {
    return this.enrollmentsOf(employeeId).filter((e) => e.status === "concluido");
  },

  progressOf(employeeId: ID): LessonProgress[] {
    return db.filter("progress", (p) => p.employeeId === employeeId);
  },
  lessonProgress(employeeId: ID, lessonId: ID): LessonProgress | undefined {
    return db.find("progress", (p) => p.employeeId === employeeId && p.lessonId === lessonId);
  },
  saveProgress(progress: LessonProgress): LessonProgress {
    return db.put("progress", progress);
  },
  completedLessonIds(employeeId: ID, courseId?: ID): Set<ID> {
    const out = new Set<ID>();
    for (const p of this.progressOf(employeeId)) {
      if (p.status === "concluido" && (!courseId || p.courseId === courseId)) out.add(p.lessonId);
    }
    return out;
  },

  quizAttempts(employeeId?: ID): QuizAttempt[] {
    return employeeId ? db.filter("quiz_attempts", (a) => a.employeeId === employeeId) : [...db.list("quiz_attempts")];
  },
  attemptsOfQuiz(employeeId: ID, quizId: ID): QuizAttempt[] {
    return db.filter("quiz_attempts", (a) => a.employeeId === employeeId && a.quizId === quizId)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
  },
  bestAttempt(employeeId: ID, quizId: ID): QuizAttempt | undefined {
    return this.attemptsOfQuiz(employeeId, quizId).sort((a, b) => b.score - a.score)[0];
  },
  saveQuizAttempt(attempt: QuizAttempt): QuizAttempt {
    return db.put("quiz_attempts", attempt);
  },

  gameSessions(employeeId?: ID): GameSession[] {
    return employeeId ? db.filter("game_sessions", (s) => s.employeeId === employeeId) : [...db.list("game_sessions")];
  },
  saveGameSession(session: GameSession): GameSession {
    return db.put("game_sessions", session);
  },
  bestGameScore(employeeId: ID, gameId: ID): GameSession | undefined {
    return db.filter("game_sessions", (s) => s.employeeId === employeeId && s.gameId === gameId)
      .sort((a, b) => b.score - a.score)[0];
  },

  challengeAttempts(employeeId?: ID): ChallengeAttempt[] {
    return employeeId ? db.filter("challenge_attempts", (a) => a.employeeId === employeeId) : [...db.list("challenge_attempts")];
  },
  saveChallengeAttempt(attempt: ChallengeAttempt): ChallengeAttempt {
    return db.put("challenge_attempts", attempt);
  },
  /** Desafio do dia já respondido hoje? */
  dailyAttemptToday(employeeId: ID): ChallengeAttempt | undefined {
    const today = dayKey();
    return db.find("challenge_attempts", (a) => a.employeeId === employeeId && a.daily && dayKey(new Date(a.at)) === today);
  },
  attemptedChallengeIds(employeeId: ID): Set<ID> {
    const out = new Set<ID>();
    for (const a of this.challengeAttempts(employeeId)) out.add(a.challengeId);
    return out;
  },
};
