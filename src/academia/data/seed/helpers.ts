import type { ContentChunk, ContentItem, ID, SourceRef } from "../../core/types";
import { sourceId as makeSourceId } from "../../core/ids";
import { cleanExtractedText, splitParagraphs, truncate } from "../../core/text";

/**
 * Divide o texto do material em trechos (chunks) e gera um SOURCE_ID para
 * cada um. É exatamente o mesmo caminho que um PDF enviado pelo admin
 * percorre (ver engines/content/ContentEngine.ts) — aqui só já chega em
 * texto, porque o material é da própria ConServ.
 */
export function chunkText(contentId: ID, text: string): ContentChunk[] {
  const clean = cleanExtractedText(text);
  return splitParagraphs(clean).map((paragraph, index) => ({
    index,
    text: paragraph,
    locator: `parágrafo ${index + 1}`,
    sourceId: makeSourceId(contentId, index),
  }));
}

/** Monta a referência rastreável de um trecho (usada por questões, aulas…). */
export function refOf(content: ContentItem, chunkIndex: number, uncertain = false): SourceRef {
  const chunk = content.chunks[Math.min(chunkIndex, content.chunks.length - 1)];
  return {
    sourceId: chunk?.sourceId ?? makeSourceId(content.id, 0),
    contentId: content.id,
    excerpt: truncate(chunk?.text ?? content.description, 220),
    locator: chunk?.locator,
    librarySourceId: content.librarySourceIds[0],
    uncertain,
  };
}

export interface ContentDraft {
  id: ID;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  level: ContentItem["level"];
  sector: string;
  jobFunction?: string;
  contentType: ContentItem["contentType"];
  author: string;
  sourceType: ContentItem["source"]["type"];
  reference?: string;
  url?: string;
  librarySourceIds: ID[];
  keywords: string[];
  competencies: ID[];
  version: string;
  date: string;
  validUntil?: string;
  text: string;
}

export function buildContent(draft: ContentDraft, createdBy: ID): ContentItem {
  const chunks = chunkText(draft.id, draft.text);
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    subcategory: draft.subcategory,
    level: draft.level,
    sector: draft.sector,
    jobFunction: draft.jobFunction,
    contentType: draft.contentType,
    author: draft.author,
    source: { type: draft.sourceType, reference: draft.reference, url: draft.url },
    librarySourceIds: draft.librarySourceIds,
    date: draft.date,
    version: draft.version,
    validUntil: draft.validUntil,
    keywords: draft.keywords,
    rawText: cleanExtractedText(draft.text),
    chunks,
    competencies: draft.competencies,
    status: "published",
    generated: { lessonIds: [], questionIds: [], curiosityIds: [], gameIds: [], challengeIds: [], courseIds: [], handbookIds: [] },
    createdBy,
    createdAt: `${draft.date}T12:00:00.000Z`,
    updatedAt: `${draft.date}T12:00:00.000Z`,
    reviewedBy: createdBy,
    reviewedAt: `${draft.date}T13:00:00.000Z`,
    publishedAt: `${draft.date}T13:10:00.000Z`,
  };
}
