import { describe, expect, it } from "vitest";
import { buildAlbumPdf, layoutCells, pdfText, type ImageLoader } from "@/lib/album/pdf";
import { suggestPages } from "@/lib/album/auto";
import { computeTotals } from "@/lib/budget/calc";
import type { Album, AlbumPage, DiaryEntry, MediaAsset, Trip } from "@/lib/types";

// PNG 1×1 válido
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const loader: ImageLoader = async () => ({ data: PNG, width: 1600, height: 1200, format: "PNG" });

const now = "2026-12-16T00:00:00.000Z";
const trip = { id: "t1", name: "Patagônia", destination: "El Calafate", destination_country: "Argentina", start_date: "2026-12-10", end_date: "2026-12-15", currency: "BRL" } as Trip;
const album: Album = {
  id: "a1", trip_id: "t1", title: "Patagônia em família", subtitle: "Gelo, vento e chocolate quente", format: "A4", margin_mm: 12, gap_mm: 4,
  background: "#ffffff", frame: "revista", include_cover: true, include_toc: true, include_itinerary: true, include_budget: true, include_diary: true,
  footer_text: "El Calafate — VIAJAR+", page_numbers: true, created_at: now, updated_at: now,
};
const page = (id: string, position: number, included: boolean, n: number, layout: AlbumPage["layout"] = "4"): AlbumPage => ({
  id, album_id: "a1", trip_id: "t1", position, layout, title: `Página ${id}`, text: "Um dia inesquecível no glaciar. ".repeat(5), date_label: "11 dez 2026",
  background: "", frame: "polaroid", items: Array.from({ length: n }, (_, i) => ({ media_id: `m${i}`, edit_id: null, caption: `Foto ${i}`, frame: "", fit: i % 2 ? "cover" : "contain" })),
  included, created_at: now, updated_at: now,
});
const diary: DiaryEntry[] = [
  { id: "d1", trip_id: "t1", date: "2026-12-11", title: "Perito Moreno", body: "Texto longo do diário. ".repeat(300), location_name: "Parque Nacional", lat: null, lng: null, author_traveler_id: null, rating: 5, mood: "", tags: [], people: [], instagrammable: true, story_answers: [], is_draft: false, base_updated_at: null, created_at: now, updated_at: now },
];
const budget = { currency: "BRL", totals: computeTotals([], [], 40000), categories: [{ name: "Hospedagem", planned: 6000, realized: 3000, projected: 6000 }] };
const base = { album, trip, coverItem: { media_id: "m0", edit_id: null, caption: "", frame: "", fit: "cover" as const }, itinerary: { days: [], items: [] }, diary, budget };

async function pdf(pages: AlbumPage[], a: Album = album) {
  const doc = await buildAlbumPdf({ ...base, album: a, pages }, loader);
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  return { doc, head: new TextDecoder().decode(bytes.slice(0, 5)), size: bytes.length };
}

describe("PDF do book", () => {
  it("gera PDF válido com várias páginas, e páginas excluídas não entram", async () => {
    const all = await pdf([page("p1", 0, true, 4), page("p2", 1, true, 6, "colagem"), page("p3", 2, false, 2)]);
    expect(all.head).toBe("%PDF-");
    const withExcludedIncluded = await pdf([page("p1", 0, true, 4), page("p2", 1, true, 6, "colagem"), page("p3", 2, true, 2)]);
    expect(withExcludedIncluded.doc.getNumberOfPages()).toBe(all.doc.getNumberOfPages() + 1);
    // capa + sumário + roteiro + 2 páginas + diário (≥2 págs pelo texto longo) + orçamento
    expect(all.doc.getNumberOfPages()).toBeGreaterThanOrEqual(8);
  });

  it("exporta só as seções escolhidas", async () => {
    const minimal = await pdf([page("p1", 0, true, 1, "1")], { ...album, include_cover: false, include_toc: false, include_itinerary: false, include_budget: false, include_diary: false });
    expect(minimal.doc.getNumberOfPages()).toBe(1);
  });

  it("todos os formatos geram páginas no tamanho certo", async () => {
    for (const [format, w, h] of [["quadrado", 210, 210], ["horizontal", 297, 210], ["vertical", 203, 254]] as const) {
      const { doc } = await pdf([page("p1", 0, true, 2, "2")], { ...album, format });
      expect(Math.round(doc.internal.pageSize.getWidth())).toBe(w);
      expect(Math.round(doc.internal.pageSize.getHeight())).toBe(h);
    }
  });

  it("células do layout ficam dentro da área útil", () => {
    const area = { x: 12, y: 20, w: 186, h: 240 };
    for (const layout of ["1", "2", "3", "4", "colagem"] as const) {
      for (const c of layoutCells(layout, 6, area, 4)) {
        expect(c.x).toBeGreaterThanOrEqual(area.x - 0.001);
        expect(c.y).toBeGreaterThanOrEqual(area.y - 0.001);
        expect(c.x + c.w).toBeLessThanOrEqual(area.x + area.w + 0.001);
        expect(c.y + c.h).toBeLessThanOrEqual(area.y + area.h + 0.001);
      }
    }
  });

  it("texto é convertido para Latin-1 sem perder acentos", () => {
    expect(pdfText("Patagônia — “glaciar” ★ 📷")).toBe('Patagônia - "glaciar"  ');
  });
});

describe("sugestão automática de páginas", () => {
  const m = (id: string, extra: Partial<MediaAsset>): MediaAsset => ({
    id, trip_id: "t1", kind: "image", storage_path: `${id}.jpg`, thumb_path: null, original_name: id, mime_type: "image/jpeg", size_bytes: 1, width: 10, height: 10,
    duration_sec: null, taken_at: "2026-12-11T15:00:00.000Z", lat: null, lng: null, caption: "", tags: [], people: [], album: "", favorite: false, instagrammable: false,
    diary_entry_id: null, story_answers: [], created_at: now, updated_at: now, ...extra,
  });
  it("cria páginas por entrada do diário e depois as favoritas restantes", () => {
    const media = [m("a", { diary_entry_id: "d1" }), m("b", { favorite: true }), m("c", { instagrammable: true, taken_at: "2026-12-13T12:00:00.000Z" }), m("d", {})];
    const pages = suggestPages(album, diary, media);
    expect(pages[0].title).toBe("Perito Moreno");
    expect(pages[0].items.map((i) => i.media_id)).toEqual(["a", "b"]);
    expect(pages[1].title).toBe("Favoritas e instagramáveis");
    expect(pages[1].items.map((i) => i.media_id)).toEqual(["c"]);
    expect(pages.flatMap((p) => p.items).some((i) => i.media_id === "d")).toBe(false);
    expect(pages.map((p) => p.position)).toEqual([0, 1]);
  });
});
