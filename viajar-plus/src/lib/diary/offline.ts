import type { Repo } from "@/lib/data/repo";
import type { DiaryEntry, ID } from "@/lib/types";
import type { DiaryInput } from "@/lib/schemas";

// Rascunhos do diário guardados no aparelho (somente texto e metadados).
// Fotos e vídeos NÃO entram no rascunho offline: o espaço local do navegador
// é limitado e pode ser apagado pelo sistema.

export interface DiaryDraft {
  local_id: string;
  trip_id: ID;
  entry_id: ID | null; // null = registro novo
  base_updated_at: string | null; // versão do servidor quando a edição começou
  data: DiaryInput & { lat: number | null; lng: number | null };
  saved_at: string;
}

export interface Conflict {
  draft: DiaryDraft;
  server: DiaryEntry;
}

const KEY = "viajar:diary-outbox";

export interface DraftStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function storage(): DraftStorage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function readDrafts(s: DraftStorage | null = storage()): DiaryDraft[] {
  try {
    return JSON.parse(s?.getItem(KEY) ?? "[]") as DiaryDraft[];
  } catch {
    return [];
  }
}

function writeDrafts(list: DiaryDraft[], s: DraftStorage | null = storage()) {
  s?.setItem(KEY, JSON.stringify(list));
}

export function saveDraft(d: Omit<DiaryDraft, "saved_at">, s: DraftStorage | null = storage()): DiaryDraft {
  const full = { ...d, saved_at: new Date().toISOString() };
  writeDrafts([...readDrafts(s).filter((x) => x.local_id !== d.local_id), full], s);
  return full;
}

export function removeDraft(localId: string, s: DraftStorage | null = storage()): void {
  writeDrafts(readDrafts(s).filter((x) => x.local_id !== localId), s);
}

export function draftsForTrip(tripId: ID, s: DraftStorage | null = storage()): DiaryDraft[] {
  return readDrafts(s).filter((d) => d.trip_id === tripId);
}

function toRow(d: DiaryDraft) {
  return { ...d.data, trip_id: d.trip_id, story_answers: [], is_draft: false, base_updated_at: null };
}

/**
 * Envia os rascunhos. Conflito = o registro foi alterado no servidor depois que a edição
 * offline começou (updated_at diferente). Nesse caso nada é sobrescrito: o usuário decide.
 */
export async function syncDrafts(repo: Repo, tripId: ID, s: DraftStorage | null = storage()): Promise<{ synced: number; conflicts: Conflict[]; errors: string[] }> {
  const out = { synced: 0, conflicts: [] as Conflict[], errors: [] as string[] };
  for (const d of draftsForTrip(tripId, s)) {
    try {
      if (!d.entry_id) {
        await repo.insert("diary_entries", toRow(d));
      } else {
        const server = await repo.get("diary_entries", d.entry_id);
        if (!server) {
          await repo.insert("diary_entries", toRow(d)); // excluído no servidor: recria
        } else if (d.base_updated_at && server.updated_at !== d.base_updated_at) {
          out.conflicts.push({ draft: d, server });
          continue;
        } else {
          await repo.update("diary_entries", d.entry_id, d.data);
        }
      }
      removeDraft(d.local_id, s);
      out.synced++;
    } catch (e) {
      out.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

/** Resolve um conflito: manter a versão do aparelho, a do servidor, ou juntar os textos. */
export async function resolveConflict(repo: Repo, c: Conflict, choice: "local" | "servidor" | "juntar", s: DraftStorage | null = storage()): Promise<void> {
  if (choice === "local") await repo.update("diary_entries", c.server.id, c.draft.data);
  if (choice === "juntar") {
    await repo.update("diary_entries", c.server.id, {
      body: `${c.server.body}\n\n— Versão escrita offline (${new Date(c.draft.saved_at).toLocaleString("pt-BR")}) —\n${c.draft.data.body}`,
      tags: [...new Set([...c.server.tags, ...c.draft.data.tags])],
      people: [...new Set([...c.server.people, ...c.draft.data.people])],
    });
  }
  removeDraft(c.draft.local_id, s);
}
