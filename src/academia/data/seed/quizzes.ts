import type { Quiz } from "../../core/types";
import { SEED_QUESTIONS } from "./questions";

// Avaliação final de cada curso, montada a partir do banco de questões
// aprovadas daquele curso. O QUIZ_ENGINE sorteia `drawCount` questões por
// tentativa, então a avaliação não fica decorada.
const COURSES: Array<{ id: string; courseId: string; title: string; pass: number; draw: number; time?: number }> = [
  { id: "QIZ-CRS-001", courseId: "CRS-001", title: "Avaliação final — Costureira Profissional: Fundamentos", pass: 70, draw: 12, time: 900 },
  { id: "QIZ-CRS-002", courseId: "CRS-002", title: "Avaliação final — NR-1: Segurança e Saúde no Trabalho", pass: 80, draw: 10, time: 900 },
  { id: "QIZ-CRS-003", courseId: "CRS-003", title: "Avaliação final — Qualidade na Confecção", pass: 70, draw: 7 },
  { id: "QIZ-CRS-004", courseId: "CRS-004", title: "Avaliação final — Corte Inteligente", pass: 70, draw: 6 },
  { id: "QIZ-CRS-005", courseId: "CRS-005", title: "Avaliação final — 5S no Posto de Trabalho", pass: 70, draw: 4 },
];

const finals: Quiz[] = COURSES.map((c) => {
  const questionIds = SEED_QUESTIONS.filter((q) => q.courseId === c.courseId).map((q) => q.id);
  return {
    id: c.id,
    title: c.title,
    description: "Avaliação de conclusão. O resultado define a emissão do certificado.",
    scope: "avaliacao_final",
    refId: c.courseId,
    questionIds,
    drawCount: Math.min(c.draw, questionIds.length),
    passScore: c.pass,
    timeLimitSec: c.time,
    shuffleOptions: true,
    xp: 120,
    status: "published",
    createdAt: "2026-03-02T12:00:00.000Z",
  };
});

/** Quiz rápido de aula (usado no player da aula de regulagem). */
const lessonQuiz: Quiz = {
  id: "QIZ-LES-REG",
  title: "Quiz rápido — Regulagem da Overloque",
  description: "Cinco questões para fixar o que você acabou de ver.",
  scope: "aula",
  refId: "LES-COST-FUND-08",
  questionIds: SEED_QUESTIONS.filter((q) => q.subject === "Regulagem da overloque").slice(0, 6).map((q) => q.id),
  drawCount: 5,
  passScore: 60,
  shuffleOptions: true,
  xp: 50,
  status: "published",
  createdAt: "2026-03-02T12:00:00.000Z",
};

const safetyQuiz: Quiz = {
  id: "QIZ-NR1-RAPIDO",
  title: "Quiz — Perigo x Risco",
  description: "Dona Segurança quer saber se a diferença ficou clara.",
  scope: "avulso",
  questionIds: SEED_QUESTIONS.filter((q) => q.subject.startsWith("NR-1")).map((q) => q.id),
  drawCount: 6,
  passScore: 70,
  shuffleOptions: true,
  xp: 60,
  status: "published",
  createdAt: "2026-03-02T12:00:00.000Z",
};

export const SEED_QUIZZES: Quiz[] = [...finals, lessonQuiz, safetyQuiz];

/** Liga cada curso ao seu quiz final (usado no seed de cursos). */
export const FINAL_QUIZ_BY_COURSE: Record<string, string> = Object.fromEntries(COURSES.map((c) => [c.courseId, c.id]));
