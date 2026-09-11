// =====================================================================
// CONTENT_ENGINE (seções 8, 9, 21, 35, 37 e 40)
// ---------------------------------------------------------------------
// O caminho do conteúdo, do arquivo ao publicado:
//
//   RECEBER → INTERPRETAR → ORGANIZAR → SUGERIR → REVISAR → PUBLICAR
//
//   createFromUpload()   recebe arquivo/URL/texto e cria o CONTENT_ID
//   analyze()            produz a estrutura pedagógica (com SOURCE_ID)
//   materialize*()       transforma sugestão aprovada em registro real
//   publish()            publica e versiona
//
// Nada gerado automaticamente é publicado sem aprovação humana: todas as
// sugestões nascem em `analysis.suggestions` e só viram registro quando
// um administrador aprova explicitamente.
// =====================================================================

import type {
  AiSettings, Challenge, ContentAnalysis, ContentItem, Curiosity, GameDefinition, ID, Lesson, Question,
  SuggestedChallenge, SuggestedCuriosity, SuggestedGame, SuggestedLesson, SuggestedQuestion,
} from "../../core/types";
import { auditRepo, catalogRepo, settingsRepo } from "../../data/repositories";
import { seqId, sourceId as makeSourceId, uid } from "../../core/ids";
import { nowIso } from "../../core/dates";
import { cleanExtractedText, splitParagraphs } from "../../core/text";
import { heuristicAnalyzer } from "./analyzers/HeuristicAnalyzer";
import { RemoteAiProvider, type ContentAnalyzer } from "./ai/AiProvider";
import type { ExtractionResult } from "./extractors";

export interface CreateContentInput {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  level: ContentItem["level"];
  sector: string;
  jobFunction?: string;
  contentType: ContentItem["contentType"];
  author?: string;
  keywords: string[];
  competencies: ID[];
  librarySourceIds: ID[];
  validUntil?: string;
  /** Resultado da extração (arquivo, URL ou texto digitado). */
  extraction: ExtractionResult;
  /** Texto colado manualmente quando o arquivo não tinha texto. */
  manualText?: string;
  url?: string;
  /** Arquivo em data URL (FILE STORAGE do protótipo — ver docs). */
  fileRef?: string;
  createdBy: ID;
}

/** Resolve qual analisador usar conforme as configurações de IA. */
export function resolveAnalyzer(settings: AiSettings): ContentAnalyzer {
  if (settings.remoteProvider.enabled && settings.remoteProvider.endpoint) {
    return new RemoteAiProvider(settings.remoteProvider.endpoint, settings.remoteProvider.model, heuristicAnalyzer);
  }
  return heuristicAnalyzer;
}

function chunksFrom(contentId: ID, extraction: ExtractionResult, manualText?: string) {
  const sections = extraction.sections.length > 0 && !extraction.needsManualText
    ? extraction.sections
    : splitParagraphs(cleanExtractedText(manualText ?? extraction.text ?? "")).map((text, i) => ({ text, locator: `parágrafo ${i + 1}` }));
  return sections
    .filter((s) => s.text.trim().length > 0)
    .map((section, index) => ({
      index,
      text: section.text.trim(),
      locator: section.locator,
      sourceId: makeSourceId(contentId, index),
    }));
}

export const contentEngine = {
  /** ETAPA 1–3: salvar, extrair e criar o CONTENT_ID com os trechos. */
  createFromUpload(input: CreateContentInput): ContentItem {
    const id = seqId("CNT");
    const chunks = chunksFrom(id, input.extraction, input.manualText);
    const rawText = chunks.map((c) => c.text).join("\n\n");
    const now = nowIso();
    const content: ContentItem = {
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      subcategory: input.subcategory,
      level: input.level,
      sector: input.sector,
      jobFunction: input.jobFunction,
      contentType: input.contentType,
      author: input.author,
      source: {
        type: input.extraction.detectedType,
        reference: input.extraction.fileName,
        url: input.url,
        fileRef: input.fileRef,
        fileSize: input.extraction.fileSize,
        mimeType: input.extraction.mimeType,
      },
      librarySourceIds: input.librarySourceIds,
      date: now.slice(0, 10),
      version: "1.0",
      validUntil: input.validUntil,
      keywords: input.keywords,
      rawText,
      chunks,
      competencies: input.competencies,
      status: chunks.length > 0 ? "processing" : "draft",
      generated: { lessonIds: [], questionIds: [], curiosityIds: [], gameIds: [], challengeIds: [], courseIds: [], handbookIds: [] },
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      notes: input.extraction.notes.join(" "),
    };
    catalogRepo.saveContent(content);
    auditRepo.log({
      actorId: input.createdBy,
      actorName: "—",
      action: "content.create",
      entity: "content",
      entityId: id,
      detail: `Conteúdo recebido: ${content.title} (${content.source.type}, ${chunks.length} trechos)`,
    });
    return content;
  },

  /** ETAPA 4–13: analisar e gerar sugestões (nada é publicado aqui). */
  async analyze(contentId: ID, actorId: ID, overrides?: Partial<AiSettings>): Promise<ContentItem | undefined> {
    const content = catalogRepo.content(contentId);
    if (!content) return undefined;
    const settings = { ...settingsRepo.get().ai, ...overrides };
    const analyzer = resolveAnalyzer(settings);
    catalogRepo.patchContent(contentId, { status: "processing" });
    const analysis = await analyzer.analyze(content, settings);
    const updated = catalogRepo.patchContent(contentId, {
      analysis,
      status: "pending_review",
      level: content.level === "basico" ? analysis.difficulty : content.level,
      competencies: content.competencies.length > 0 ? content.competencies : analysis.competencies,
      updatedAt: nowIso(),
    });
    auditRepo.log({
      actorId,
      actorName: "—",
      action: "content.analyze",
      entity: "content",
      entityId: contentId,
      detail: `Análise por ${analysis.provider}: ${analysis.concepts.length} conceitos, ${analysis.suggestions.questions.length} questões, ${analysis.suggestions.games.length} jogos sugeridos`,
      meta: { warnings: analysis.warnings.length },
    });
    return updated;
  },

  /** Reanálise com outras configurações (quantidade, nível, tom…). */
  async reanalyze(contentId: ID, actorId: ID, overrides: Partial<AiSettings>): Promise<ContentItem | undefined> {
    return this.analyze(contentId, actorId, overrides);
  },

  // -------------------------------------------------------------------
  // REVISÃO HUMANA → registros reais
  // -------------------------------------------------------------------

  materializeQuestions(content: ContentItem, selected: SuggestedQuestion[], actorId: ID, courseId?: ID): Question[] {
    const created: Question[] = [];
    for (const suggestion of selected) {
      const id = seqId("QST");
      const options = suggestion.options.map((text, i) => ({ id: `${id}-O${i + 1}`, text }));
      created.push(catalogRepo.saveQuestion({
        id,
        stem: suggestion.stem,
        options,
        correctOptionId: options[suggestion.correctIndex].id,
        explanation: suggestion.explanation,
        difficulty: suggestion.difficulty,
        type: suggestion.type,
        subject: suggestion.subject,
        competencies: suggestion.competencies.length > 0 ? suggestion.competencies : content.competencies,
        points: suggestion.difficulty === "dificil" ? 15 : suggestion.difficulty === "facil" ? 5 : 10,
        sourceRef: suggestion.sourceRef,
        contentId: content.id,
        courseId,
        aiGenerated: true,
        status: "approved",
        reviewedBy: actorId,
        reviewedAt: nowIso(),
        createdAt: nowIso(),
      }));
    }
    this.registerGenerated(content.id, { questionIds: created.map((q) => q.id) });
    auditRepo.log({ actorId, actorName: "—", action: "content.approve_questions", entity: "content", entityId: content.id, detail: `${created.length} questões aprovadas` });
    return created;
  },

  materializeCuriosities(content: ContentItem, selected: SuggestedCuriosity[], actorId: ID): Curiosity[] {
    const created = selected.map((suggestion) => catalogRepo.saveCuriosity({
      id: seqId("CUR"),
      title: suggestion.title,
      text: suggestion.text,
      category: suggestion.category,
      competencies: content.competencies,
      sourceRef: suggestion.sourceRef,
      xp: settingsRepo.get().xpRules.curiosity,
      status: "published",
      createdAt: nowIso(),
    }));
    this.registerGenerated(content.id, { curiosityIds: created.map((c) => c.id) });
    auditRepo.log({ actorId, actorName: "—", action: "content.approve_curiosities", entity: "content", entityId: content.id, detail: `${created.length} curiosidades publicadas` });
    return created;
  },

  materializeChallenges(content: ContentItem, selected: SuggestedChallenge[], actorId: ID): Challenge[] {
    const created = selected.map((suggestion) => {
      const id = seqId("CHL");
      const options = suggestion.options.map((text, i) => ({ id: `${id}-O${i + 1}`, text }));
      return catalogRepo.saveChallenge({
        id,
        title: suggestion.title,
        scenario: suggestion.scenario,
        character: suggestion.character,
        options,
        correctOptionId: options[suggestion.correctIndex].id,
        explanation: suggestion.explanation,
        category: content.category,
        competencies: content.competencies,
        difficulty: "medio",
        xp: settingsRepo.get().xpRules.challenge,
        sourceRef: suggestion.sourceRef,
        dailyEligible: true,
        contentId: content.id,
        status: "published",
        createdAt: nowIso(),
      });
    });
    this.registerGenerated(content.id, { challengeIds: created.map((c) => c.id) });
    auditRepo.log({ actorId, actorName: "—", action: "content.approve_challenges", entity: "content", entityId: content.id, detail: `${created.length} desafios publicados` });
    return created;
  },

  materializeGames(content: ContentItem, selected: SuggestedGame[], actorId: ID, questionIds: ID[] = []): GameDefinition[] {
    const created = selected.map((suggestion) => {
      const payload = suggestion.payload.kind === "timed_quiz" && questionIds.length > 0
        ? { kind: "timed_quiz" as const, rounds: suggestion.payload.rounds.map((r) => ({ ...r, questionIds })) }
        : suggestion.payload;
      return catalogRepo.saveGame({
        id: seqId("GAM"),
        code: `AUTO-${content.id}-${suggestion.type}`.toUpperCase(),
        type: suggestion.type,
        title: suggestion.title,
        pitch: suggestion.pitch,
        description: suggestion.reason,
        character: content.category === "seguranca" ? "seguranca" : "mestre",
        icon: "gamepad-2",
        accent: "navy",
        level: content.level,
        competencies: content.competencies,
        sourceRefs: suggestion.sourceRefs,
        contentId: content.id,
        xp: settingsRepo.get().xpRules.game,
        passScore: 60,
        payload,
        status: "published",
        createdAt: nowIso(),
        aiGenerated: true,
      });
    });
    this.registerGenerated(content.id, { gameIds: created.map((g) => g.id) });
    auditRepo.log({ actorId, actorName: "—", action: "content.approve_games", entity: "content", entityId: content.id, detail: `${created.length} jogos publicados` });
    return created;
  },

  /** Cria as aulas aprovadas dentro de um curso e módulo existentes. */
  materializeLessons(content: ContentItem, selected: SuggestedLesson[], courseId: ID, moduleId: ID, actorId: ID): Lesson[] {
    let order = catalogRepo.lessonsOf(courseId).length;
    const saved = selected.map((suggestion) => {
      order += 1;
      return catalogRepo.saveLesson({
        id: seqId("LES"),
        courseId,
        moduleId,
        title: suggestion.title,
        summary: suggestion.summary,
        order,
        blocks: suggestion.blocks,
        durationMin: suggestion.durationMin,
        xp: settingsRepo.get().xpRules.lesson,
        competencies: suggestion.competencies,
        sourceRefs: suggestion.sourceRefs,
        status: "published",
        createdFromContentId: content.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });
    const module = catalogRepo.module(moduleId);
    if (module) {
      catalogRepo.saveModule({ ...module, lessonIds: [...module.lessonIds, ...saved.map((l) => l.id)] });
    }
    this.registerGenerated(content.id, { lessonIds: saved.map((l) => l.id) });
    auditRepo.log({ actorId, actorName: "—", action: "content.approve_lessons", entity: "content", entityId: content.id, detail: `${saved.length} aulas criadas no curso ${courseId}` });
    return saved;
  },

  /** Guarda o que já foi gerado a partir do material (rastreabilidade). */
  registerGenerated(contentId: ID, patch: Partial<ContentItem["generated"]>): void {
    const content = catalogRepo.content(contentId);
    if (!content) return;
    const generated = { ...content.generated };
    for (const key of Object.keys(patch) as Array<keyof ContentItem["generated"]>) {
      generated[key] = [...new Set([...(generated[key] ?? []), ...((patch[key] ?? []) as ID[])])];
    }
    catalogRepo.patchContent(contentId, { generated, updatedAt: nowIso() });
  },

  /** PUBLICAR: muda status e grava a versão (seção 37). */
  publish(contentId: ID, actorId: ID, actorName: string, changes: string[] = ["Publicação do conteúdo"], reason?: string): ContentItem | undefined {
    const content = catalogRepo.content(contentId);
    if (!content) return undefined;
    const updated = catalogRepo.patchContent(contentId, {
      status: "published",
      reviewedBy: actorId,
      reviewedAt: nowIso(),
      publishedAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.saveVersion(contentId, actorId, actorName, changes, reason);
    auditRepo.log({ actorId, actorName, action: "content.publish", entity: "content", entityId: contentId, detail: `Conteúdo publicado (v${content.version})` });
    return updated;
  },

  reject(contentId: ID, actorId: ID, actorName: string, reason: string): ContentItem | undefined {
    const updated = catalogRepo.patchContent(contentId, { status: "rejected", notes: reason, updatedAt: nowIso() });
    auditRepo.log({ actorId, actorName, action: "content.reject", entity: "content", entityId: contentId, detail: reason });
    return updated;
  },

  archive(contentId: ID, actorId: ID, actorName: string): ContentItem | undefined {
    const updated = catalogRepo.patchContent(contentId, { status: "archived", updatedAt: nowIso() });
    auditRepo.log({ actorId, actorName, action: "content.archive", entity: "content", entityId: contentId });
    return updated;
  },

  /** VERSIONAMENTO: guarda quem, quando, o que mudou, fonte e motivo. */
  saveVersion(contentId: ID, actorId: ID, actorName: string, changes: string[], reason?: string, bump: "minor" | "major" | "none" = "minor"): void {
    const content = catalogRepo.content(contentId);
    if (!content) return;
    const [major, minor] = content.version.split(".").map((n) => Number(n) || 0);
    const version = bump === "none" ? content.version : bump === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
    catalogRepo.saveContentVersion({
      id: uid("CVR"),
      contentId,
      version,
      changedBy: actorId,
      changedByName: actorName,
      changedAt: nowIso(),
      changes,
      reason,
      sourceNote: content.source.reference ?? content.source.url,
      snapshot: {
        title: content.title,
        description: content.description,
        category: content.category,
        level: content.level,
        status: content.status,
        keywords: content.keywords,
        competencies: content.competencies,
      },
    });
    if (bump !== "none") catalogRepo.patchContent(contentId, { version });
  },

  /** Resumo de tudo que a análise encontrou (tela da seção 35). */
  analysisSummary(analysis?: ContentAnalysis) {
    if (!analysis) return null;
    return {
      concepts: analysis.concepts.length,
      competencies: analysis.competencies.length,
      subjects: analysis.subjects.length,
      questions: analysis.suggestions.questions.length,
      challenges: analysis.suggestions.challenges.length,
      games: analysis.suggestions.games.length,
      lessons: analysis.suggestions.lessons.length,
      curiosities: analysis.suggestions.curiosities.length,
      risks: analysis.risks.length,
      procedures: analysis.procedures.length,
      warnings: analysis.warnings.length,
      readingMinutes: analysis.readingMinutes,
      provider: analysis.provider,
    };
  },
};
