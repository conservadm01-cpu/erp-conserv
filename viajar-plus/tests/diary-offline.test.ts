import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepo, resetLocalDb } from "@/lib/data/local";
import { draftsForTrip, resolveConflict, saveDraft, syncDrafts, type DraftStorage } from "@/lib/diary/offline";

function memStorage(): DraftStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

const data = { date: "2026-12-11", title: "Perito Moreno", body: "Ouvimos o gelo estalar.", location_name: "Passarelas", rating: 5, mood: "emocionados", tags: ["glaciar"], people: ["Lia"], author_traveler_id: null, instagrammable: true, lat: null, lng: null };

describe("diário offline", () => {
  let repo: LocalRepo;
  let s: DraftStorage;
  beforeEach(async () => {
    await resetLocalDb();
    repo = new LocalRepo();
    s = memStorage();
  });

  it("sincroniza um registro novo e limpa a fila", async () => {
    saveDraft({ local_id: "d1", trip_id: "t1", entry_id: null, base_updated_at: null, data }, s);
    const r = await syncDrafts(repo, "t1", s);
    expect(r.synced).toBe(1);
    expect(draftsForTrip("t1", s)).toHaveLength(0);
    expect((await repo.list("diary_entries", { trip_id: "t1" }))[0].title).toBe("Perito Moreno");
  });

  it("detecta conflito quando o servidor mudou e não sobrescreve", async () => {
    const entry = await repo.insert("diary_entries", { ...data, trip_id: "t1", story_answers: [], is_draft: false, base_updated_at: null, body: "original" });
    const base = entry.updated_at;
    await new Promise((r) => setTimeout(r, 5));
    await repo.update("diary_entries", entry.id, { body: "editado por outra pessoa" });
    saveDraft({ local_id: "d2", trip_id: "t1", entry_id: entry.id, base_updated_at: base, data: { ...data, body: "minha versão offline" } }, s);
    const r = await syncDrafts(repo, "t1", s);
    expect(r.conflicts).toHaveLength(1);
    expect((await repo.get("diary_entries", entry.id))!.body).toBe("editado por outra pessoa");
    await resolveConflict(repo, r.conflicts[0], "juntar", s);
    const merged = (await repo.get("diary_entries", entry.id))!.body;
    expect(merged).toContain("editado por outra pessoa");
    expect(merged).toContain("minha versão offline");
    expect(draftsForTrip("t1", s)).toHaveLength(0);
  });

  it("atualiza sem conflito quando a base é a mesma", async () => {
    const entry = await repo.insert("diary_entries", { ...data, trip_id: "t1", story_answers: [], is_draft: false, base_updated_at: null });
    saveDraft({ local_id: "d3", trip_id: "t1", entry_id: entry.id, base_updated_at: entry.updated_at, data: { ...data, title: "Novo título" } }, s);
    const r = await syncDrafts(repo, "t1", s);
    expect(r.conflicts).toHaveLength(0);
    expect((await repo.get("diary_entries", entry.id))!.title).toBe("Novo título");
  });
});
