import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Album, AlbumFormat, AlbumPage, AlbumPageItem, DiaryEntry, ItineraryDay, ItineraryItem, MediaAsset, Trip } from "@/lib/types";
import type { Totals } from "@/lib/budget/calc";
import { collageCells, containBox, type Rect } from "@/lib/photo/collage";
import { frameTemplate } from "@/lib/photo/frames";
import { fmtDate, money } from "@/lib/format";

export const PAGE_SIZES: Record<AlbumFormat, [number, number]> = {
  A4: [210, 297],
  quadrado: [210, 210],
  vertical: [203, 254],
  horizontal: [297, 210],
};

export const COVER_TEMPLATES = [
  { id: "revista", name: "Revista (foto inteira com título)" },
  { id: "classica", name: "Clássica (foto e título abaixo)" },
  { id: "polaroid", name: "Polaroid" },
  { id: "minimalista", name: "Minimalista (só tipografia)" },
] as const;

export interface LoadedImage {
  data: string | Uint8Array; // data URL ou bytes
  width: number;
  height: number;
  format: "JPEG" | "PNG";
}

/** Carrega a imagem de um item já no tamanho certo (≈300 dpi para a caixa). Em "cover", deve vir recortada na proporção da caixa. */
export type ImageLoader = (item: AlbumPageItem, boxMm: { w: number; h: number }, fit: "contain" | "cover") => Promise<LoadedImage | null>;

export interface BudgetSummary {
  currency: string;
  totals: Totals;
  categories: { name: string; planned: number; realized: number; projected: number }[];
}

export interface AlbumPdfInput {
  album: Album;
  pages: AlbumPage[];
  trip: Trip;
  coverItem?: AlbumPageItem | null;
  itinerary?: { days: ItineraryDay[]; items: ItineraryItem[] };
  diary?: DiaryEntry[];
  budget?: BudgetSummary | null;
  media?: Map<string, MediaAsset>;
  onProgress?: (done: number, total: number) => void;
}

/** Fontes padrão do PDF usam Latin-1: troca símbolos fora dele por equivalentes. */
export function pdfText(s: string): string {
  return (s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[•●]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  ]/g, " ")
    .replace(/[^\u0000-ÿ]/g, "");
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/** Células da página conforme o layout (em mm, dentro da área útil). */
export function layoutCells(layout: AlbumPage["layout"], n: number, area: Rect, gap: number): Rect[] {
  const count = layout === "texto" ? Math.min(1, n) : layout === "colagem" ? Math.min(6, Math.max(1, n)) : Math.min(Number(layout) || 1, Math.max(1, n));
  if (count === 0) return [];
  let cells: Rect[];
  if (count === 2 && area.w < area.h) {
    const h = (area.h - gap) / 2;
    cells = [
      { x: 0, y: 0, w: area.w, h },
      { x: 0, y: h + gap, w: area.w, h },
    ];
  } else {
    // collageCells inclui margem externa = gap; removemos para usar a área inteira
    cells = collageCells(count, area.w + gap * 2, area.h + gap * 2, gap).map((c) => ({ ...c, x: c.x - gap, y: c.y - gap }));
  }
  return cells.map((c) => ({ x: area.x + c.x, y: area.y + c.y, w: c.w, h: c.h }));
}

export async function buildAlbumPdf(input: AlbumPdfInput, loadImage: ImageLoader): Promise<jsPDF> {
  const { album, trip } = input;
  const [W, H] = PAGE_SIZES[album.format] ?? PAGE_SIZES.A4;
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: W > H ? "landscape" : "portrait", compress: true });
  doc.setProperties({ title: pdfText(album.title), subject: pdfText(`${trip.destination} - ${trip.name}`), creator: "VIAJAR+" });
  const M = Math.max(5, Math.min(40, album.margin_mm || 12));
  const GAP = Math.max(0, Math.min(30, album.gap_mm ?? 4));
  const contentW = W - M * 2;
  const pageBg = album.background || "#ffffff";
  const included = input.pages.filter((p) => p.included).sort((a, b) => a.position - b.position);
  const toc: { title: string; page: number }[] = [];
  let first = true;
  const totalSteps = included.length + 4;
  let step = 0;
  const progress = () => input.onProgress?.(++step, totalSteps);

  const newPage = (bg = pageBg) => {
    if (!first) doc.addPage([W, H], W > H ? "landscape" : "portrait");
    first = false;
    const [r, g, b] = hexToRgb(bg);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, W, H, "F");
    const dark = isDark(bg);
    doc.setTextColor(dark ? 245 : 30, dark ? 245 : 37, dark ? 245 : 48);
  };

  const heading = (text: string, y = M + 8) => {
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text(pdfText(text), M, y);
    doc.setFont("helvetica", "normal");
    return y + 8;
  };

  // ---------- Capa ----------
  if (album.include_cover) {
    const tpl = album.frame || "revista";
    const coverBg = tpl === "minimalista" ? pageBg : "#12394a";
    newPage(coverBg);
    const period = `${fmtDate(trip.start_date)} - ${fmtDate(trip.end_date)}`;
    const place = [trip.destination, trip.destination_country].filter(Boolean).join(", ");
    const cover = input.coverItem && tpl !== "minimalista" ? await loadImage(input.coverItem, tpl === "revista" ? { w: W, h: H } : { w: contentW, h: H * 0.55 }, tpl === "revista" ? "cover" : "contain") : null;
    if (cover && tpl === "revista") {
      doc.addImage(cover.data, cover.format, 0, 0, W, H, undefined, "FAST");
      doc.setFillColor(0, 0, 0);
      doc.setGState(doc.GState({ opacity: 0.45 }));
      doc.rect(0, H * 0.62, W, H * 0.38, "F");
      doc.setGState(doc.GState({ opacity: 1 }));
      doc.setTextColor(255, 255, 255);
    } else if (cover) {
      const box = containBox(cover.width, cover.height, { x: M, y: M, w: contentW, h: H * 0.55 });
      if (tpl === "polaroid") {
        doc.setFillColor(251, 250, 246);
        doc.rect(box.x - 4, box.y - 4, box.w + 8, box.h + 18, "F");
      }
      doc.addImage(cover.data, cover.format, box.x, box.y, box.w, box.h, undefined, "FAST");
    }
    const baseY = tpl === "minimalista" ? H * 0.42 : H * 0.72;
    doc.setFont("times", "bold");
    doc.setFontSize(Math.min(40, W / 6));
    doc.text(doc.splitTextToSize(pdfText(album.title), contentW), W / 2, baseY, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    if (album.subtitle) doc.text(doc.splitTextToSize(pdfText(album.subtitle), contentW), W / 2, baseY + 14, { align: "center" });
    doc.setFontSize(11);
    doc.text(pdfText(`${place}  |  ${period}`), W / 2, baseY + (album.subtitle ? 26 : 14), { align: "center" });
  }
  progress();

  // ---------- Sumário (reservado; preenchido no fim) ----------
  const tocEntries = (album.include_itinerary ? 1 : 0) + (album.include_diary && input.diary?.length ? 1 : 0) + (album.include_budget && input.budget ? 1 : 0) + included.filter((p) => p.title).length;
  const perTocPage = Math.max(8, Math.floor((H - M * 2 - 20) / 8));
  const tocPages: number[] = [];
  if (album.include_toc && tocEntries > 0) {
    for (let i = 0; i < Math.ceil(tocEntries / perTocPage); i++) {
      newPage();
      tocPages.push(doc.getNumberOfPages());
    }
  }

  // ---------- Roteiro ----------
  if (album.include_itinerary && input.itinerary) {
    newPage();
    toc.push({ title: "Roteiro", page: doc.getNumberOfPages() });
    const y = heading("Roteiro");
    const days = [...input.itinerary.days].sort((a, b) => a.date.localeCompare(b.date));
    const body: string[][] = [];
    days.forEach((d, i) => {
      const items = input.itinerary!.items.filter((it) => it.day_id === d.id).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.position - b.position);
      if (!items.length) body.push([`Dia ${i + 1}\n${fmtDate(d.date)}`, "", "Dia livre", ""].map(pdfText));
      items.forEach((it, j) => body.push([j === 0 ? `Dia ${i + 1}\n${fmtDate(d.date)}` : "", it.start_time ?? "", it.title, it.address].map(pdfText)));
    });
    autoTable(doc, {
      startY: y,
      head: [["Dia", "Hora", "Atividade", "Local"]],
      body,
      margin: { left: M, right: M, top: M, bottom: M + 8 },
      styles: { fontSize: 9, cellPadding: 1.8, overflow: "linebreak" },
      headStyles: { fillColor: [31, 117, 150] },
      rowPageBreak: "avoid",
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 14 } },
      willDrawPage: (d) => {
        if (d.pageNumber > 1) {
          const [r, g, b] = hexToRgb(pageBg);
          doc.setFillColor(r, g, b);
          doc.rect(0, 0, W, H, "F");
        }
      },
    });
  }
  progress();

  // ---------- Páginas de fotos ----------
  for (const page of included) {
    newPage(page.background || pageBg);
    if (page.title) toc.push({ title: page.title, page: doc.getNumberOfPages() });
    let top = M;
    if (page.title) {
      doc.setFont("times", "bold");
      doc.setFontSize(18);
      doc.text(doc.splitTextToSize(pdfText(page.title), contentW)[0] ?? "", M, top + 6);
      top += 10;
    }
    if (page.date_label) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(pdfText(page.date_label), M, top + 3);
      top += 6;
    }
    doc.setFont("helvetica", "normal");
    let bottom = H - M - (album.page_numbers || album.footer_text ? 6 : 0);
    const isText = page.layout === "texto";
    let textLines: string[] = [];
    if (page.text) {
      doc.setFontSize(isText ? 12 : 10);
      textLines = doc.splitTextToSize(pdfText(page.text), contentW);
      const lineH = isText ? 5.6 : 4.6;
      const maxLines = Math.floor((isText ? (bottom - top) * (page.items.length ? 0.55 : 1) : (bottom - top) * 0.3) / lineH);
      if (textLines.length > maxLines) textLines = [...textLines.slice(0, Math.max(1, maxLines - 1)), "(...)"];
      const textH = textLines.length * lineH + 2;
      if (isText) {
        doc.text(textLines, M, top + 5, { lineHeightFactor: 1.4 });
        top += textH + GAP;
      } else {
        doc.text(textLines, M, bottom - textH + 4, { lineHeightFactor: 1.3 });
        bottom -= textH + GAP / 2;
      }
    }
    const area: Rect = { x: M, y: top, w: contentW, h: Math.max(10, bottom - top) };
    const cells = layoutCells(page.layout, page.items.length, area, GAP);
    for (let i = 0; i < cells.length; i++) {
      const item = page.items[i];
      if (!item) continue;
      const frame = frameTemplate(item.frame || page.frame);
      const cell = cells[i];
      const pad = frame.thickness > 0 ? Math.max(1.5, Math.min(cell.w, cell.h) * frame.thickness / 100) : 0;
      const capH = item.caption ? 6 : 0;
      const extraBottom = frame.bottomExtra > 0 ? Math.max(capH, Math.min(cell.w, cell.h) * frame.bottomExtra / 100) : capH;
      const inner: Rect = { x: cell.x + pad, y: cell.y + pad, w: cell.w - pad * 2, h: cell.h - pad * 2 - extraBottom };
      if (inner.w <= 2 || inner.h <= 2) continue;
      const img = await loadImage(item, { w: inner.w, h: inner.h }, item.fit);
      if (!img) continue;
      const box = item.fit === "cover" ? inner : containBox(img.width, img.height, inner);
      if (frame.thickness > 0) {
        const [r, g, b] = hexToRgb(frame.color);
        doc.setFillColor(r, g, b);
        doc.rect(box.x - pad, box.y - pad, box.w + pad * 2, box.h + pad * 2 + (frame.bottomExtra > 0 ? extraBottom : 0), "F");
      }
      doc.addImage(img.data, img.format, box.x, box.y, box.w, box.h, undefined, "FAST");
      if (item.caption) {
        doc.setFontSize(8.5);
        const capColor = frame.thickness > 0 && frame.bottomExtra > 0 ? frame.textColor : isDark(page.background || pageBg) ? "#f2f2f2" : "#333333";
        doc.setTextColor(...hexToRgb(capColor));
        doc.text(doc.splitTextToSize(pdfText(item.caption), box.w)[0] ?? "", box.x + box.w / 2, box.y + box.h + (frame.bottomExtra > 0 ? extraBottom / 2 + pad / 2 : 4), { align: "center" });
        const dark = isDark(page.background || pageBg);
        doc.setTextColor(dark ? 245 : 30, dark ? 245 : 37, dark ? 245 : 48);
      }
    }
    progress();
  }

  // ---------- Histórias do diário ----------
  if (album.include_diary && input.diary?.length) {
    newPage();
    toc.push({ title: "Histórias da viagem", page: doc.getNumberOfPages() });
    let y = heading("Histórias da viagem");
    const limit = H - M - 8;
    for (const e of [...input.diary].filter((d) => !d.is_draft).sort((a, b) => a.date.localeCompare(b.date))) {
      const meta = [fmtDate(e.date), e.location_name, e.rating ? `Avaliação: ${e.rating}/5` : ""].filter(Boolean).join("  |  ");
      const lines = doc.setFontSize(10).splitTextToSize(pdfText(e.body), contentW) as string[];
      if (y + 16 > limit) {
        newPage();
        y = M + 6;
      }
      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text(pdfText(e.title), M, y);
      y += 5;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(pdfText(meta), M, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const line of lines) {
        if (y + 5 > limit) {
          newPage();
          y = M + 6;
        }
        doc.text(line, M, y);
        y += 4.8;
      }
      y += 6;
    }
  }
  progress();

  // ---------- Resumo financeiro ----------
  if (album.include_budget && input.budget) {
    const b = input.budget;
    const cur = b.currency;
    newPage();
    toc.push({ title: "Resumo financeiro", page: doc.getNumberOfPages() });
    const y = heading("Resumo financeiro");
    const t = b.totals;
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Valor"]],
      body: [
        ["Orçamento", money(t.budget, cur)],
        ["Previsto", money(t.planned, cur)],
        ["Realizado (pago)", money(t.realized, cur)],
        ["Pendente (reservado a pagar)", money(t.pending, cur)],
        ["Projeção final", money(t.projected, cur)],
        ["Disponível (projeção)", money(t.availableProjected, cur)],
        ["Consumido do orçamento", `${t.consumedPct.toFixed(1).replace(".", ",")}%`],
      ].map((r) => r.map(pdfText)),
      margin: { left: M, right: M, top: M, bottom: M + 8 },
      styles: { fontSize: 10 },
      headStyles: { fillColor: [31, 117, 150] },
      rowPageBreak: "avoid",
    });
    const after = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 60;
    autoTable(doc, {
      startY: after + 6,
      head: [["Categoria", "Previsto", "Realizado", "Projeção"]],
      body: b.categories.map((c) => [c.name, money(c.planned, cur), money(c.realized, cur), money(c.projected, cur)].map(pdfText)),
      margin: { left: M, right: M, top: M, bottom: M + 8 },
      styles: { fontSize: 9 },
      headStyles: { fillColor: [234, 122, 50] },
      rowPageBreak: "avoid",
    });
  }
  progress();

  // ---------- Sumário (preenchimento) ----------
  if (tocPages.length) {
    toc.forEach((entry, i) => {
      const pageIdx = Math.floor(i / perTocPage);
      doc.setPage(tocPages[pageIdx]);
      const dark = isDark(pageBg);
      doc.setTextColor(dark ? 245 : 30, dark ? 245 : 37, dark ? 245 : 48);
      if (i % perTocPage === 0) heading(pageIdx === 0 ? "Sumário" : "Sumário (cont.)");
      const y = M + 22 + (i % perTocPage) * 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(pdfText(entry.title), M, y, { maxWidth: contentW - 20 });
      doc.text(String(entry.page), W - M, y, { align: "right" });
    });
  }

  // ---------- Rodapé e numeração ----------
  const n = doc.getNumberOfPages();
  const startAt = album.include_cover ? 2 : 1;
  for (let i = startAt; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    if (album.footer_text) doc.text(pdfText(album.footer_text), M, H - M / 2 - 1, { maxWidth: contentW - 20 });
    if (album.page_numbers) doc.text(`${i} / ${n}`, W - M, H - M / 2 - 1, { align: "right" });
  }
  return doc;
}
