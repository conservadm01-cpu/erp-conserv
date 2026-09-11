import { db } from "../db";
import type {
  Challenge, ContentItem, ContentVersion, Course, CourseModule, Curiosity, GameDefinition, Handbook, ID,
  LearningPath, Lesson, LibrarySource, Question, Quiz,
} from "../../core/types";
import { normalize } from "../../core/text";

const isPublished = (s: string) => s === "published";

/** Catálogo educacional: tudo que o colaborador consome e o admin publica. */
export const catalogRepo = {
  // ----- conteúdos (Banco de Conhecimento) -----
  contents(): readonly ContentItem[] {
    return db.list("content");
  },
  content(id?: ID): ContentItem | undefined {
    return db.byId("content", id);
  },
  contentsByStatus(status: ContentItem["status"]): ContentItem[] {
    return db.filter("content", (c) => c.status === status);
  },
  pendingContents(): ContentItem[] {
    return db.filter("content", (c) => c.status === "pending_review" || c.status === "processing");
  },
  searchContents(term: string): ContentItem[] {
    const q = normalize(term.trim());
    if (!q) return [...this.contents()];
    return db.filter("content", (c) =>
      normalize(c.title).includes(q) ||
      normalize(c.description).includes(q) ||
      c.keywords.some((k) => normalize(k).includes(q)) ||
      normalize(c.category).includes(q));
  },
  saveContent(content: ContentItem): ContentItem {
    return db.put("content", content);
  },
  patchContent(id: ID, changes: Partial<ContentItem>): ContentItem | undefined {
    return db.patch("content", id, changes);
  },
  versionsOf(contentId: ID) {
    return db.filter("content_versions", (v) => v.contentId === contentId).sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  },

  // ----- biblioteca de fontes -----
  sources(): readonly LibrarySource[] {
    return db.list("content_sources");
  },
  source(id?: ID): LibrarySource | undefined {
    return db.byId("content_sources", id);
  },
  saveSource(source: LibrarySource): LibrarySource {
    return db.put("content_sources", source);
  },

  // ----- cursos / módulos / aulas -----
  courses(): readonly Course[] {
    return db.list("courses");
  },
  publishedCourses(): Course[] {
    return db.filter("courses", (c) => isPublished(c.status));
  },
  course(id?: ID): Course | undefined {
    return db.byId("courses", id);
  },
  saveCourse(course: Course): Course {
    return db.put("courses", course);
  },
  patchCourse(id: ID, changes: Partial<Course>): Course | undefined {
    return db.patch("courses", id, changes);
  },
  modulesOf(courseId: ID): CourseModule[] {
    return db.filter("modules", (m) => m.courseId === courseId).sort((a, b) => a.order - b.order);
  },
  module(id?: ID): CourseModule | undefined {
    return db.byId("modules", id);
  },
  lessonsOf(courseId: ID): Lesson[] {
    return db.filter("lessons", (l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
  },
  lessonsOfModule(moduleId: ID): Lesson[] {
    return db.filter("lessons", (l) => l.moduleId === moduleId).sort((a, b) => a.order - b.order);
  },
  lesson(id?: ID): Lesson | undefined {
    return db.byId("lessons", id);
  },
  saveLesson(lesson: Lesson): Lesson {
    return db.put("lessons", lesson);
  },
  saveModule(module: CourseModule): CourseModule {
    return db.put("modules", module);
  },
  saveContentVersion(version: ContentVersion): ContentVersion {
    return db.put("content_versions", version);
  },
  /** Aulas na ordem real de consumo do curso (módulo → aula). */
  orderedLessons(courseId: ID): Lesson[] {
    const modules = this.modulesOf(courseId);
    const out: Lesson[] = [];
    for (const mod of modules) out.push(...this.lessonsOfModule(mod.id));
    if (out.length === 0) return this.lessonsOf(courseId);
    return out;
  },
  coursesOfCompetency(competencyId: ID): Course[] {
    return db.filter("courses", (c) => isPublished(c.status) && c.competencies.includes(competencyId));
  },

  // ----- trilhas -----
  paths(): readonly LearningPath[] {
    return db.list("learning_paths");
  },
  publishedPaths(): LearningPath[] {
    return db.filter("learning_paths", (p) => isPublished(p.status)).sort((a, b) => a.order - b.order);
  },
  path(id?: ID): LearningPath | undefined {
    return db.byId("learning_paths", id);
  },
  savePath(path: LearningPath): LearningPath {
    return db.put("learning_paths", path);
  },
  pathsOfCourse(courseId: ID): LearningPath[] {
    return db.filter("learning_paths", (p) => p.courseIds.includes(courseId));
  },

  // ----- questões e quizzes -----
  questions(): readonly Question[] {
    return db.list("questions");
  },
  question(id?: ID): Question | undefined {
    return db.byId("questions", id);
  },
  approvedQuestions(): Question[] {
    return db.filter("questions", (q) => q.status === "approved");
  },
  questionsOfCourse(courseId: ID): Question[] {
    return db.filter("questions", (q) => q.courseId === courseId && q.status === "approved");
  },
  questionsOfContent(contentId: ID): Question[] {
    return db.filter("questions", (q) => q.contentId === contentId);
  },
  questionsOfCompetency(competencyId: ID): Question[] {
    return db.filter("questions", (q) => q.status === "approved" && q.competencies.includes(competencyId));
  },
  saveQuestion(question: Question): Question {
    return db.put("questions", question);
  },
  quizzes(): readonly Quiz[] {
    return db.list("quizzes");
  },
  quiz(id?: ID): Quiz | undefined {
    return db.byId("quizzes", id);
  },
  saveQuiz(quiz: Quiz): Quiz {
    return db.put("quizzes", quiz);
  },
  quizzesOf(scope: Quiz["scope"], refId: ID): Quiz[] {
    return db.filter("quizzes", (q) => q.scope === scope && q.refId === refId);
  },

  // ----- jogos, desafios, curiosidades -----
  games(): readonly GameDefinition[] {
    return db.list("games");
  },
  publishedGames(): GameDefinition[] {
    return db.filter("games", (g) => isPublished(g.status));
  },
  game(id?: ID): GameDefinition | undefined {
    return db.byId("games", id);
  },
  saveGame(game: GameDefinition): GameDefinition {
    return db.put("games", game);
  },
  challenges(): readonly Challenge[] {
    return db.list("challenges");
  },
  publishedChallenges(): Challenge[] {
    return db.filter("challenges", (c) => isPublished(c.status));
  },
  dailyChallenges(): Challenge[] {
    return db.filter("challenges", (c) => isPublished(c.status) && c.dailyEligible);
  },
  challenge(id?: ID): Challenge | undefined {
    return db.byId("challenges", id);
  },
  saveChallenge(challenge: Challenge): Challenge {
    return db.put("challenges", challenge);
  },
  curiosities(): readonly Curiosity[] {
    return db.list("curiosities");
  },
  publishedCuriosities(): Curiosity[] {
    return db.filter("curiosities", (c) => isPublished(c.status));
  },
  curiosity(id?: ID): Curiosity | undefined {
    return db.byId("curiosities", id);
  },
  saveCuriosity(curiosity: Curiosity): Curiosity {
    return db.put("curiosities", curiosity);
  },
  curiositiesByCategory(category: string): Curiosity[] {
    return db.filter("curiosities", (c) => isPublished(c.status) && normalize(c.category) === normalize(category));
  },

  // ----- apostilas -----
  handbooks(): readonly Handbook[] {
    return db.list("handbooks");
  },
  handbook(id?: ID): Handbook | undefined {
    return db.byId("handbooks", id);
  },
  saveHandbook(handbook: Handbook): Handbook {
    return db.put("handbooks", handbook);
  },
  handbooksOfCourse(courseId: ID): Handbook[] {
    return db.filter("handbooks", (h) => h.courseId === courseId);
  },
};
