// =====================================================================
// Montagem automática de curso a partir de um material analisado
// (botão [GERAR CURSO] da seção 35).
// O curso nasce como rascunho/pendente: publicar é decisão humana.
// =====================================================================

import type { Course, ID, Quiz } from "../../core/types";
import { catalogRepo, settingsRepo } from "../../data/repositories";
import { seqId } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { contentEngine } from "./ContentEngine";

export interface ComposeOptions {
  title?: string;
  subtitle?: string;
  hours?: number;
  level?: Course["level"];
  sector?: string;
  lessonsPerModule?: number;
  publish?: boolean;
  /** Ids de questões já aprovadas para a avaliação final. */
  questionIds?: ID[];
  pathId?: ID;
}

export interface ComposedCourse {
  course: Course;
  moduleIds: ID[];
  lessonIds: ID[];
  finalQuiz: Quiz | null;
}

export const courseComposer = {
  compose(contentId: ID, actorId: ID, actorName: string, options: ComposeOptions = {}): ComposedCourse | null {
    const content = catalogRepo.content(contentId);
    if (!content?.analysis) return null;
    const suggestions = content.analysis.suggestions.lessons;
    if (suggestions.length === 0) return null;

    const settings = settingsRepo.get();
    const courseId = seqId("CRS");
    const code = `AUTO-${courseId.replace("CRS-", "")}`;
    const perModule = Math.max(1, options.lessonsPerModule ?? 3);
    const hours = options.hours ?? Math.max(1, Math.round(suggestions.reduce((sum, l) => sum + l.durationMin, 0) / 60));

    const course: Course = {
      id: courseId,
      code,
      title: options.title ?? content.title,
      subtitle: options.subtitle ?? content.description.slice(0, 120),
      description: content.analysis.summary,
      category: content.category,
      level: options.level ?? content.level,
      sector: options.sector ?? content.sector,
      hours,
      icon: "book-open",
      accent: "navy",
      moduleIds: [],
      competencies: content.competencies.length > 0 ? content.competencies : content.analysis.competencies,
      passScore: settings.defaultPassScore,
      certificate: {
        enabled: true,
        classification: settings.certificateClassification,
        responsible: settings.certificateResponsible,
      },
      status: options.publish ? "published" : "pending_review",
      version: "1.0",
      author: actorName,
      sourceContentIds: [content.id],
      librarySourceIds: content.librarySourceIds,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      publishedAt: options.publish ? nowIso() : undefined,
    };
    catalogRepo.saveCourse(course);

    // Módulos: agrupa as aulas sugeridas.
    const moduleIds: ID[] = [];
    const lessonIds: ID[] = [];
    for (let i = 0; i < suggestions.length; i += perModule) {
      const group = suggestions.slice(i, i + perModule);
      const moduleId = `MOD-${code}-${String(moduleIds.length + 1).padStart(2, "0")}`;
      catalogRepo.saveModule({
        id: moduleId,
        courseId,
        title: `${moduleIds.length + 1}. ${group[0].title}`,
        summary: group[0].summary,
        order: moduleIds.length + 1,
        lessonIds: [],
      });
      moduleIds.push(moduleId);
      const created = contentEngine.materializeLessons(content, group, courseId, moduleId, actorId);
      lessonIds.push(...created.map((l) => l.id));
    }

    // Avaliação final com as questões aprovadas do material.
    const questionIds = options.questionIds ?? catalogRepo.questionsOfContent(content.id).filter((q) => q.status === "approved").map((q) => q.id);
    let finalQuiz: Quiz | null = null;
    if (questionIds.length >= 3) {
      finalQuiz = catalogRepo.saveQuiz({
        id: `QIZ-${courseId}`,
        title: `Avaliação final — ${course.title}`,
        description: "Avaliação de conclusão gerada a partir do material aprovado.",
        scope: "avaliacao_final",
        refId: courseId,
        questionIds,
        drawCount: Math.min(10, questionIds.length),
        passScore: settings.defaultPassScore,
        shuffleOptions: true,
        xp: 120,
        status: "published",
        createdAt: nowIso(),
      });
    }

    const saved = catalogRepo.saveCourse({ ...course, moduleIds, finalQuizId: finalQuiz?.id });
    contentEngine.registerGenerated(content.id, { courseIds: [courseId] });

    // Vincula à trilha escolhida, quando houver.
    if (options.pathId) {
      const path = catalogRepo.path(options.pathId);
      if (path && !path.courseIds.includes(courseId)) {
        catalogRepo.savePath({ ...path, courseIds: [...path.courseIds, courseId], certificateEnabled: true });
      }
    }

    return { course: saved, moduleIds, lessonIds, finalQuiz };
  },
};
