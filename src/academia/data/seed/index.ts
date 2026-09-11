// =====================================================================
// CARGA INICIAL (seção 32)
// ---------------------------------------------------------------------
// 5 cursos · 25 aulas · 32 curiosidades · 56 questões · 6 jogos ·
// 12 desafios · 14 badges · 17 trilhas · 12 materiais no Banco de
// Conhecimento · 1 apostila de exemplo · 2 certificados de exemplo.
//
// A carga entra pelo mesmo caminho de qualquer conteúdo: registros no
// banco. A apostila de exemplo é GERADA pelo HandbookEngine, provando
// que o gerador funciona de verdade.
// =====================================================================

import type { Course } from "../../core/types";
import { db } from "../db";
import type { CollectionName } from "../schema";
import { DEFAULT_SETTINGS } from "../defaults";
import { SEED_COMPETENCIES } from "./competencies";
import { SEED_SOURCES } from "./sources";
import { SEED_DEPARTMENTS, SEED_EMPLOYEES, SEED_JOB_ROLES, SEED_USERS } from "./people";
import { SEED_CONTENTS } from "./contentIndex";
import { COURSE_1 } from "./course1";
import { COURSE_5S, COURSE_CORTE, COURSE_NR1, COURSE_QUALIDADE } from "./courses2";
import { SEED_QUESTIONS } from "./questions";
import { FINAL_QUIZ_BY_COURSE, SEED_QUIZZES } from "./quizzes";
import { SEED_PATHS } from "./paths";
import { SEED_BADGES } from "./badges";
import { SEED_CURIOSITIES } from "./curiosities";
import { SEED_CHALLENGES } from "./challenges";
import { SEED_GAMES } from "./games";
import { SEED_DEMO } from "./demo";
import { handbookEngine } from "../../engines/handbook/HandbookEngine";
import { heuristicAnalyzer } from "../../engines/content/analyzers/HeuristicAnalyzer";
import { DEFAULT_AI_SETTINGS } from "../defaults";
import type { ContentItem } from "../../core/types";

const BUILT = [COURSE_1, COURSE_NR1, COURSE_QUALIDADE, COURSE_CORTE, COURSE_5S];

/** Liga cada curso ao seu quiz final e à aula de quiz rápido. */
function withQuizzes(course: Course): Course {
  const finalQuizId = FINAL_QUIZ_BY_COURSE[course.id];
  return finalQuizId ? { ...course, finalQuizId } : course;
}

/** Marca quais cursos desenvolvem cada competência (recomendações). */
function competenciesWithCourses() {
  const map = new Map<string, string[]>();
  for (const built of BUILT) {
    for (const competencyId of built.course.competencies) {
      map.set(competencyId, [...(map.get(competencyId) ?? []), built.course.id]);
    }
  }
  return SEED_COMPETENCIES.map((c) => ({ ...c, developedBy: map.get(c.id) ?? [] }));
}

export interface SeedReport {
  seeded: boolean;
  counts: Record<string, number>;
}

export function isSeeded(): boolean {
  return db.count("courses") > 0 && db.count("questions") > 0;
}

/** Escreve a carga inicial. `force` recria do zero (apaga o que existe). */
export async function runSeed(options: { force?: boolean } = {}): Promise<SeedReport> {
  if (isSeeded() && !options.force) {
    return { seeded: false, counts: {} };
  }
  if (options.force) await db.wipe();

  // Os materiais da carga inicial passam pela mesma análise que um PDF
  // enviado pelo administrador. Assim o Banco de Conhecimento já nasce com
  // conceitos, definições, procedimentos e riscos mapeados — é isso que
  // alimenta o "Aprender no posto" e a tela de revisão do admin.
  const contents: ContentItem[] = [];
  for (const content of SEED_CONTENTS) {
    const analysis = await heuristicAnalyzer.analyze(content, DEFAULT_AI_SETTINGS);
    contents.push({ ...content, analysis });
  }

  const lessons = BUILT.flatMap((b) => b.lessons);
  const modules = BUILT.flatMap((b) => b.modules);
  const courses = BUILT.map((b) => withQuizzes(b.course));

  const batch: Array<{ collection: CollectionName; records: Array<{ id: string } & Record<string, unknown>> }> = [
    { collection: "settings", records: [DEFAULT_SETTINGS as unknown as { id: string }] },
    { collection: "competencies", records: competenciesWithCourses() as unknown as Array<{ id: string }> },
    { collection: "content_sources", records: SEED_SOURCES as unknown as Array<{ id: string }> },
    { collection: "departments", records: SEED_DEPARTMENTS as unknown as Array<{ id: string }> },
    { collection: "job_roles", records: SEED_JOB_ROLES as unknown as Array<{ id: string }> },
    { collection: "employees", records: SEED_EMPLOYEES as unknown as Array<{ id: string }> },
    { collection: "users", records: SEED_USERS as unknown as Array<{ id: string }> },
    { collection: "content", records: contents as unknown as Array<{ id: string }> },
    { collection: "courses", records: courses as unknown as Array<{ id: string }> },
    { collection: "modules", records: modules as unknown as Array<{ id: string }> },
    { collection: "lessons", records: lessons as unknown as Array<{ id: string }> },
    { collection: "questions", records: SEED_QUESTIONS as unknown as Array<{ id: string }> },
    { collection: "quizzes", records: SEED_QUIZZES as unknown as Array<{ id: string }> },
    { collection: "learning_paths", records: SEED_PATHS as unknown as Array<{ id: string }> },
    { collection: "badges", records: SEED_BADGES as unknown as Array<{ id: string }> },
    { collection: "curiosities", records: SEED_CURIOSITIES as unknown as Array<{ id: string }> },
    { collection: "challenges", records: SEED_CHALLENGES as unknown as Array<{ id: string }> },
    { collection: "games", records: SEED_GAMES as unknown as Array<{ id: string }> },
    { collection: "enrollments", records: SEED_DEMO.enrollments as unknown as Array<{ id: string }> },
    { collection: "progress", records: SEED_DEMO.progress as unknown as Array<{ id: string }> },
    { collection: "quiz_attempts", records: SEED_DEMO.attempts as unknown as Array<{ id: string }> },
    { collection: "game_sessions", records: SEED_DEMO.gameSessions as unknown as Array<{ id: string }> },
    { collection: "challenge_attempts", records: SEED_DEMO.challengeAttempts as unknown as Array<{ id: string }> },
    { collection: "employee_competencies", records: SEED_DEMO.competencies as unknown as Array<{ id: string }> },
    { collection: "employee_badges", records: SEED_DEMO.badges as unknown as Array<{ id: string }> },
    { collection: "certificates", records: SEED_DEMO.certificates as unknown as Array<{ id: string }> },
    { collection: "xp_transactions", records: SEED_DEMO.xp as unknown as Array<{ id: string }> },
    { collection: "risk_reports", records: SEED_DEMO.risks as unknown as Array<{ id: string }> },
    { collection: "notifications", records: SEED_DEMO.notifications as unknown as Array<{ id: string }> },
  ];

  await db.writeBatch(batch);

  // Apostila de exemplo gerada pelo motor (não escrita à mão).
  if (db.count("handbooks") === 0) {
    handbookEngine.generate({
      courseId: "CRS-001",
      author: "Coordenação de Treinamento — ConServ Confecções",
      version: "1.0",
      createdBy: "EMP-0009",
      status: "published",
      objectives: [
        "Reconhecer as máquinas da costura industrial e o que cada uma faz melhor.",
        "Escolher agulha e linha conforme o tecido e a operação.",
        "Entender tensão, comprimento do ponto, diferencial e pressão do calcador.",
        "Aplicar autocontrole: conferir a primeira peça antes de produzir o lote.",
        "Saber o limite entre regulagem do operador e tarefa da manutenção.",
      ],
    });
  }

  const counts: Record<string, number> = {};
  for (const part of batch) counts[part.collection] = part.records.length;
  counts.handbooks = db.count("handbooks");
  return { seeded: true, counts };
}
