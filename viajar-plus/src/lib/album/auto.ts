import type { Album, AlbumPage, AlbumPageItem, DiaryEntry, MediaAsset, NewRow } from "@/lib/types";
import { fmtDate } from "@/lib/format";

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

function layoutFor(n: number): AlbumPage["layout"] {
  if (n <= 1) return "1";
  if (n === 2) return "2";
  if (n === 3) return "3";
  if (n === 4) return "4";
  return "colagem";
}

const takenDate = (m: MediaAsset) => (m.taken_at ?? m.created_at).slice(0, 10);

/**
 * Sugere páginas do book: uma sequência por entrada do diário (com as fotos
 * ligadas a ela ou favoritas/instagramáveis do mesmo dia) e, depois, as
 * favoritas e instagramáveis restantes. Função pura.
 */
export function suggestPages(album: Pick<Album, "id" | "trip_id" | "frame">, diary: DiaryEntry[], media: MediaAsset[], startPosition = 0, pageFrame = "branca"): NewRow<"album_pages">[] {
  const photos = media.filter((m) => m.kind === "image").sort((a, b) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at));
  const used = new Set<string>();
  const pages: NewRow<"album_pages">[] = [];
  let pos = startPosition;
  const item = (m: MediaAsset): AlbumPageItem => ({ media_id: m.id, edit_id: null, caption: m.caption, frame: "", fit: "contain" });
  const push = (p: Omit<NewRow<"album_pages">, "album_id" | "trip_id" | "position" | "included" | "background" | "frame">) =>
    pages.push({ ...p, album_id: album.id, trip_id: album.trip_id, position: pos++, included: true, background: "", frame: pageFrame });

  for (const e of [...diary].filter((d) => !d.is_draft).sort((a, b) => a.date.localeCompare(b.date))) {
    const linked = photos.filter((m) => !used.has(m.id) && (m.diary_entry_id === e.id || (takenDate(m) === e.date && (m.favorite || m.instagrammable))));
    const groups = chunk(linked, 6);
    if (!groups.length) {
      push({ layout: "texto", title: e.title, text: e.body.slice(0, 1500), date_label: fmtDate(e.date), items: [] });
      continue;
    }
    groups.forEach((g, gi) => {
      g.forEach((m) => used.add(m.id));
      push({ layout: layoutFor(g.length), title: gi === 0 ? e.title : `${e.title} (cont.)`, text: gi === 0 ? e.body.slice(0, 600) : "", date_label: fmtDate(e.date), items: g.map(item) });
    });
  }
  const highlights = photos.filter((m) => !used.has(m.id) && (m.favorite || m.instagrammable));
  chunk(highlights, 4).forEach((g, i) => push({ layout: layoutFor(g.length), title: i === 0 ? "Favoritas e instagramáveis" : "", text: "", date_label: "", items: g.map(item) }));
  return pages;
}
