import { describe, expect, it } from "vitest";
import { applyAdjustments, brightness, contrast, createBuf, crop, fitWithin, flipH, flipV, resize, rotate90, saturation, sharpen, temperature, NO_ADJUST, type ImageBuf } from "@/lib/photo/ops";
import { cropRect, defaultEditState, historyInit, historyPush, historyRedo, historyUndo, normalizeState } from "@/lib/photo/state";
import { frameLayout, frameTemplate } from "@/lib/photo/frames";
import { collageCells, containBox, coverSource } from "@/lib/photo/collage";

const px = (b: ImageBuf, x: number, y: number) => Array.from(b.data.subarray((y * b.width + x) * 4, (y * b.width + x) * 4 + 4));

function gradient(w: number, h: number): ImageBuf {
  const b = createBuf(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) b.data.set([x * 10, y * 10, 100, 255], (y * w + x) * 4);
  return b;
}

describe("operações de cor", () => {
  it("brilho clareia e escurece, sem alterar o original", () => {
    const src = createBuf(2, 2, [100, 100, 100, 255]);
    expect(px(brightness(src, 20), 0, 0).slice(0, 3)).toEqual([151, 151, 151]);
    expect(px(brightness(src, -100), 0, 0).slice(0, 3)).toEqual([0, 0, 0]);
    expect(px(src, 0, 0)).toEqual([100, 100, 100, 255]);
  });
  it("contraste afasta valores do cinza médio", () => {
    const src = createBuf(1, 2);
    src.data.set([200, 200, 200, 255, 60, 60, 60, 255]);
    const out = contrast(src, 50);
    expect(out.data[0]).toBeGreaterThan(200);
    expect(out.data[4]).toBeLessThan(60);
  });
  it("saturação -100 gera tons de cinza", () => {
    const out = saturation(createBuf(1, 1, [200, 50, 50, 255]), -100);
    const [r, g, b] = px(out, 0, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
  it("temperatura positiva aquece (mais vermelho, menos azul)", () => {
    const [r, , b] = px(temperature(createBuf(1, 1, [120, 120, 120, 255]), 50), 0, 0);
    expect(r).toBeGreaterThan(120);
    expect(b).toBeLessThan(120);
  });
  it("nitidez realça bordas e mantém áreas lisas", () => {
    const flat = createBuf(3, 3, [100, 100, 100, 255]);
    expect(px(sharpen(flat, 100), 1, 1)).toEqual([100, 100, 100, 255]);
    const edge = createBuf(3, 3, [50, 50, 50, 255]);
    edge.data.set([150, 150, 150, 255], (1 * 3 + 1) * 4);
    expect(px(sharpen(edge, 100), 1, 1)[0]).toBeGreaterThan(150);
  });
  it("ajustes neutros devolvem cópia idêntica", () => {
    const g = gradient(4, 3);
    const out = applyAdjustments(g, NO_ADJUST);
    expect(out).not.toBe(g);
    expect(Array.from(out.data)).toEqual(Array.from(g.data));
  });
});

describe("geometria", () => {
  const g = gradient(4, 3);
  it("espelha horizontal e vertical", () => {
    expect(px(flipH(g), 0, 0)).toEqual(px(g, 3, 0));
    expect(px(flipV(g), 0, 0)).toEqual(px(g, 0, 2));
  });
  it("gira 90° e volta ao original com 4 giros", () => {
    const r = rotate90(g);
    expect([r.width, r.height]).toEqual([3, 4]);
    expect(px(r, 2, 0)).toEqual(px(g, 0, 0)); // canto sup. esq. vai para sup. dir.
    const back = rotate90(rotate90(rotate90(r)));
    expect(Array.from(back.data)).toEqual(Array.from(g.data));
    expect(Array.from(rotate90(rotate90(g, true), false).data)).toEqual(Array.from(g.data));
  });
  it("corta respeitando limites", () => {
    const c = crop(g, 1, 1, 10, 10);
    expect([c.width, c.height]).toEqual([3, 2]);
    expect(px(c, 0, 0)).toEqual(px(g, 1, 1));
  });
  it("redimensiona com interpolação", () => {
    const r = resize(createBuf(4, 4, [80, 90, 100, 255]), 2, 2);
    expect([r.width, r.height]).toEqual([2, 2]);
    expect(px(r, 1, 1)).toEqual([80, 90, 100, 255]);
    expect(fitWithin(4000, 3000, 1000)).toEqual({ width: 1000, height: 750, scale: 0.25 });
    expect(fitWithin(100, 50, 1000).scale).toBe(1);
  });
});

describe("estado do editor", () => {
  it("recorte por proporção e enquadramento", () => {
    expect(cropRect(1000, 500, { aspect: "1:1", zoom: 1, panX: 0.5, panY: 0.5, freeW: 1, freeH: 1 })).toEqual({ x: 250, y: 0, w: 500, h: 500 });
    expect(cropRect(1000, 500, { aspect: "1:1", zoom: 1, panX: 0, panY: 0.5, freeW: 1, freeH: 1 }).x).toBe(0);
    expect(cropRect(1000, 500, { aspect: "original", zoom: 2, panX: 0.5, panY: 0.5, freeW: 1, freeH: 1 })).toEqual({ x: 250, y: 125, w: 500, h: 250 });
    expect(cropRect(1000, 500, { aspect: "livre", zoom: 1, panX: 1, panY: 1, freeW: 0.5, freeH: 0.2 })).toEqual({ x: 500, y: 400, w: 500, h: 100 });
  });
  it("desfazer/refazer", () => {
    let h = historyInit(1);
    h = historyPush(h, 2);
    h = historyPush(h, 3);
    h = historyUndo(h);
    expect(h.present).toBe(2);
    h = historyRedo(h);
    expect(h.present).toBe(3);
    h = historyUndo(historyUndo(h));
    h = historyPush(h, 9);
    expect(h.future).toEqual([]);
    expect(historyUndo(historyInit(5)).present).toBe(5);
  });
  it("normaliza estado salvo incompleto (reaplicável)", () => {
    const st = normalizeState({ rotate: 90, adjust: { brightness: 10 } });
    expect(st.rotate).toBe(90);
    expect(st.adjust).toEqual({ ...NO_ADJUST, brightness: 10 });
    expect(normalizeState(null)).toEqual(defaultEditState());
    expect(normalizeState({ rotate: 45 }).rotate).toBe(0);
  });
});

describe("molduras e colagens", () => {
  it("Polaroid tem faixa inferior maior", () => {
    const l = frameLayout(1000, 800, frameTemplate("polaroid"));
    expect(l.border).toBe(40);
    expect(l.bottom).toBeGreaterThan(l.border);
    expect(l.outW).toBe(1080);
    expect(l.outH).toBe(800 + 40 + l.bottom);
    expect(frameLayout(10, 10, frameTemplate("nenhuma"))).toMatchObject({ outW: 10, outH: 10, border: 0 });
  });
  it("todas as molduras pedidas existem", () => {
    for (const id of ["classica", "branca", "preta", "polaroid", "dourada", "neve", "patagonia"]) expect(frameTemplate(id).template).toBe(id);
  });
  it("células de colagem cabem na área e não se sobrepõem", () => {
    for (let n = 2; n <= 6; n++) {
      const cells = collageCells(n, 1000, 1000, 10);
      expect(cells).toHaveLength(n);
      for (const c of cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(1000.001);
        expect(c.y + c.h).toBeLessThanOrEqual(1000.001);
      }
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const a = cells[i];
          const b = cells[j];
          const overlap = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
          expect(overlap).toBe(false);
        }
    }
  });
  it("contain não corta e cover preenche", () => {
    const box = containBox(4000, 2000, { x: 0, y: 0, w: 100, h: 100 });
    expect(box).toEqual({ x: 0, y: 25, w: 100, h: 50 });
    expect(coverSource(4000, 2000, 100, 100)).toEqual({ x: 1000, y: 0, w: 2000, h: 2000 });
  });
});
