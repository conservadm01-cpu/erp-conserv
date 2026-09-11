import type { Course, CourseModule, ID, Lesson, LessonBlock, SourceRef } from "../../core/types";
import { nowIso } from "../../core/dates";

export interface LessonSpec {
  title: string;
  summary: string;
  durationMin?: number;
  xp?: number;
  competencies?: ID[];
  blocks: LessonBlock[];
  refs?: SourceRef[];
  fromContentId?: ID;
}

export interface ModuleSpec {
  title: string;
  summary: string;
  lessons: LessonSpec[];
}

export interface CourseSpec {
  id: ID;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: Course["level"];
  sector: string;
  hours: number;
  icon: string;
  accent: string;
  competencies: ID[];
  sourceContentIds: ID[];
  librarySourceIds: ID[];
  passScore?: number;
  author?: string;
  classification?: string;
  responsible?: string;
  createdAt?: string;
  modules: ModuleSpec[];
}

export interface BuiltCourse {
  course: Course;
  modules: CourseModule[];
  lessons: Lesson[];
}

/**
 * Monta curso + módulos + aulas a partir de uma especificação declarativa.
 * O painel administrativo usa o mesmo formato quando cria um curso a
 * partir de um conteúdo analisado (ver engines/content/CourseComposer).
 */
export function buildCourse(spec: CourseSpec): BuiltCourse {
  const created = spec.createdAt ?? nowIso();
  const modules: CourseModule[] = [];
  const lessons: Lesson[] = [];
  let lessonOrder = 0;

  spec.modules.forEach((mod, mIndex) => {
    const moduleId = `MOD-${spec.code}-${String(mIndex + 1).padStart(2, "0")}`;
    const lessonIds: ID[] = [];
    mod.lessons.forEach((lesson) => {
      lessonOrder += 1;
      const lessonId = `LES-${spec.code}-${String(lessonOrder).padStart(2, "0")}`;
      lessonIds.push(lessonId);
      lessons.push({
        id: lessonId,
        courseId: spec.id,
        moduleId,
        title: lesson.title,
        summary: lesson.summary,
        order: lessonOrder,
        blocks: lesson.blocks,
        durationMin: lesson.durationMin ?? 8,
        xp: lesson.xp ?? 20,
        competencies: lesson.competencies ?? spec.competencies.slice(0, 2),
        sourceRefs: lesson.refs ?? [],
        status: "published",
        createdFromContentId: lesson.fromContentId,
        createdAt: created,
        updatedAt: created,
      });
    });
    modules.push({
      id: moduleId,
      courseId: spec.id,
      title: mod.title,
      summary: mod.summary,
      order: mIndex + 1,
      lessonIds,
    });
  });

  const course: Course = {
    id: spec.id,
    code: spec.code,
    title: spec.title,
    subtitle: spec.subtitle,
    description: spec.description,
    category: spec.category,
    level: spec.level,
    sector: spec.sector,
    hours: spec.hours,
    icon: spec.icon,
    accent: spec.accent,
    moduleIds: modules.map((m) => m.id),
    competencies: spec.competencies,
    passScore: spec.passScore ?? 70,
    certificate: {
      enabled: true,
      classification: spec.classification ?? "Certificado de conclusão de treinamento interno",
      responsible: spec.responsible ?? "Coordenação de Treinamento — ConServ Confecções",
    },
    status: "published",
    version: "1.0",
    author: spec.author ?? "Coordenação de Treinamento",
    sourceContentIds: spec.sourceContentIds,
    librarySourceIds: spec.librarySourceIds,
    createdAt: created,
    updatedAt: created,
    publishedAt: created,
  };

  return { course, modules, lessons };
}
