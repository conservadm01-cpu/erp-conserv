import type { CharacterId, LessonBlock, SourceId } from "../../core/types";
import { sourceId } from "../../core/ids";

/** Atalhos para escrever blocos de aula de forma legível no seed. */
export const sid = (contentId: string, chunk: number): SourceId => sourceId(contentId, chunk);

export const h = (text: string): LessonBlock => ({ kind: "heading", text });
export const t = (text: string, src?: SourceId): LessonBlock => ({ kind: "text", text, sourceId: src });
export const li = (items: string[], src?: SourceId): LessonBlock => ({ kind: "list", items, sourceId: src });
export const ol = (items: string[], src?: SourceId): LessonBlock => ({ kind: "list", items, ordered: true, sourceId: src });
export const call = (tone: "info" | "alerta" | "dica" | "atencao", title: string, text: string, src?: SourceId): LessonBlock =>
  ({ kind: "callout", tone, title, text, sourceId: src });
export const ch = (character: CharacterId, text: string): LessonBlock => ({ kind: "character", character, text });
export const steps = (title: string, list: string[], src?: SourceId): LessonBlock => ({ kind: "steps", title, steps: list, sourceId: src });
export const tbl = (headers: string[], rows: string[][], caption?: string, src?: SourceId): LessonBlock =>
  ({ kind: "table", headers, rows, caption, sourceId: src });
export const quote = (text: string, author?: string): LessonBlock => ({ kind: "quote", text, author });
export const safety = (text: string): LessonBlock => ({ kind: "safety", text });
