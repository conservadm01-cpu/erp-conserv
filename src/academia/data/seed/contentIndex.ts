import type { ContentItem, ID, SourceRef } from "../../core/types";
import { SEED_CONTENTS_PART1 } from "./contents";
import { SEED_CONTENTS_PART2 } from "./contents2";
import { refOf } from "./helpers";

export const SEED_CONTENTS: ContentItem[] = [...SEED_CONTENTS_PART1, ...SEED_CONTENTS_PART2];

const byId = new Map<ID, ContentItem>(SEED_CONTENTS.map((c) => [c.id, c]));

export function seedContent(id: ID): ContentItem {
  const found = byId.get(id);
  if (!found) throw new Error(`Conteúdo de carga inicial não encontrado: ${id}`);
  return found;
}

/** Referência rastreável (SOURCE_ID + trecho) para usar no seed. */
export function ref(contentId: ID, chunkIndex: number, uncertain = false): SourceRef {
  return refOf(seedContent(contentId), chunkIndex, uncertain);
}
