// =====================================================================
// QUIZ_ENGINE (seção 10)
// ---------------------------------------------------------------------
// Monta a tentativa (sorteio + embaralhamento), corrige, grava, lança XP
// e registra evidência de competência. Também devolve os pontos fracos
// da tentativa, que alimentam o aprendizado adaptativo (seção 26).
// =====================================================================

import type { ID, Question, Quiz, QuizAttempt } from "../../core/types";
import { catalogRepo, learningRepo, settingsRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { xpEngine } from "../gamification/XpEngine";
import type { BadgeGrant } from "../gamification/BadgeEngine";
import { competencyEngine } from "../competency/CompetencyEngine";

export interface PreparedQuestion extends Question {
  shuffledOptions: Question["options"];
}

export interface PreparedQuiz {
  quiz: Quiz;
  questions: PreparedQuestion[];
  startedAt: string;
}

export interface QuizAnswerInput {
  questionId: ID;
  optionId: ID | null;
  timeSec: number;
}

export interface QuizResult {
  attempt: QuizAttempt;
  score: number;
  passed: boolean;
  correctCount: number;
  total: number;
  xpEarned: number;
  leveledUp: boolean;
  newBadges: BadgeGrant[];
  weakSubjects: string[];
  weakCompetencies: ID[];
  review: Array<{ question: Question; chosenOptionId: ID | null; correct: boolean }>;
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const quizEngine = {
  /** Seleciona e prepara as questões de uma tentativa. */
  prepare(quizId: ID): PreparedQuiz | null {
    const quiz = catalogRepo.quiz(quizId);
    if (!quiz) return null;
    const pool = quiz.questionIds
      .map((id) => catalogRepo.question(id))
      .filter((q): q is Question => !!q && q.status === "approved");
    const selected = quiz.drawCount > 0 && quiz.drawCount < pool.length ? shuffle(pool).slice(0, quiz.drawCount) : pool;
    const questions: PreparedQuestion[] = selected.map((q) => ({
      ...q,
      shuffledOptions: quiz.shuffleOptions ? shuffle(q.options) : q.options,
    }));
    return { quiz, questions, startedAt: nowIso() };
  },

  /** Corrige sem gravar (usado em pré-visualização pelo admin). */
  grade(questions: Question[], answers: QuizAnswerInput[]) {
    let correctCount = 0;
    const review = questions.map((question) => {
      const answer = answers.find((a) => a.questionId === question.id);
      const correct = !!answer && answer.optionId === question.correctOptionId;
      if (correct) correctCount += 1;
      return { question, chosenOptionId: answer?.optionId ?? null, correct };
    });
    const score = questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100);
    return { score, correctCount, review };
  },

  /** Corrige, grava a tentativa e distribui XP e evidências. */
  submit(prepared: PreparedQuiz, employeeId: ID, answers: QuizAnswerInput[], courseId?: ID): QuizResult {
    const { quiz, questions } = prepared;
    const { score, correctCount, review } = this.grade(questions, answers);
    const passed = score >= quiz.passScore;
    const finishedAt = nowIso();
    const durationSec = Math.max(1, Math.round((Date.parse(finishedAt) - Date.parse(prepared.startedAt)) / 1000));

    const attempt = learningRepo.saveQuizAttempt({
      id: uid("QAT"),
      quizId: quiz.id,
      employeeId,
      courseId: courseId ?? (quiz.scope === "avaliacao_final" ? quiz.refId : undefined),
      answers: review.map((r) => {
        const input = answers.find((a) => a.questionId === r.question.id);
        return {
          questionId: r.question.id,
          optionId: r.chosenOptionId,
          correct: r.correct,
          timeSec: input?.timeSec ?? 0,
          competencies: r.question.competencies,
          subject: r.question.subject,
        };
      }),
      score,
      passed,
      startedAt: prepared.startedAt,
      finishedAt,
      durationSec,
      xpEarned: 0,
    });

    // XP proporcional ao acerto, com bônus de aprovação.
    const rules = settingsRepo.get().xpRules;
    const base = quiz.xp || rules.quiz;
    const xpEarned = Math.round(base * (score / 100)) + (passed ? Math.round(base * 0.2) : 0);
    const award = xpEngine.award(employeeId, xpEarned, `Quiz: ${quiz.title} (${score}%)`, "quiz", quiz.id);
    learningRepo.saveQuizAttempt({ ...attempt, xpEarned });

    // Evidência de competência por competência presente na prova.
    const perCompetency = new Map<ID, { total: number; correct: number }>();
    for (const r of review) {
      for (const competencyId of r.question.competencies) {
        const acc = perCompetency.get(competencyId) ?? { total: 0, correct: 0 };
        acc.total += 1;
        if (r.correct) acc.correct += 1;
        perCompetency.set(competencyId, acc);
      }
    }
    const weakCompetencies: ID[] = [];
    for (const [competencyId, acc] of perCompetency) {
      const performance = acc.correct / acc.total;
      competencyEngine.registerEvidence(employeeId, competencyId, "quiz", quiz.id, `Quiz ${quiz.title}`, performance);
      if (performance < 0.6) weakCompetencies.push(competencyId);
    }

    // Assuntos com erro — base da recomendação "você precisa reforçar".
    const subjectErrors = new Map<string, number>();
    for (const r of review) {
      if (r.correct) continue;
      subjectErrors.set(r.question.subject, (subjectErrors.get(r.question.subject) ?? 0) + 1);
    }
    const weakSubjects = [...subjectErrors.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);

    return {
      attempt: { ...attempt, xpEarned },
      score,
      passed,
      correctCount,
      total: questions.length,
      xpEarned,
      leveledUp: award.leveledUp,
      newBadges: award.newBadges,
      weakSubjects,
      weakCompetencies,
      review,
    };
  },

  /**
   * Monta um quiz de reforço com questões das competências fracas.
   * É o "[APRENDER NOVAMENTE]" da seção 26 — feito com questões reais do
   * banco aprovado, nunca inventadas na hora.
   */
  buildReinforcementQuiz(competencyIds: ID[], size = 6): Quiz | null {
    const pool = new Map<ID, Question>();
    for (const competencyId of competencyIds) {
      for (const question of catalogRepo.questionsOfCompetency(competencyId)) pool.set(question.id, question);
    }
    if (pool.size === 0) return null;
    const questionIds = shuffle([...pool.keys()]).slice(0, Math.max(3, size));
    const quiz: Quiz = {
      id: uid("QIZ-REF"),
      title: "Reforço dirigido",
      description: "Questões focadas no que você precisa reforçar.",
      scope: "avulso",
      questionIds,
      drawCount: 0,
      passScore: 60,
      shuffleOptions: true,
      xp: 40,
      status: "published",
      createdAt: nowIso(),
    };
    return catalogRepo.saveQuiz(quiz);
  },
};
