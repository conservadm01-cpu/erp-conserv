import { describe, expect, it } from "vitest";
import {
  MIN_CLIP, autoMontage, canvasSize, clipDuration, coverRect, fadeAlpha, locate, moveClip, newClip, pickMimeType,
  removeClip, removeRange, splitClip, totalDuration, trimClip, type EditorClip,
} from "@/lib/video/timeline";

const c = (start: number, end: number, id = "m1"): EditorClip => ({ ...newClip(id, 60), start, end, title: "T" });

describe("linha do tempo do vídeo", () => {
  it("calcula duração e total", () => {
    expect(clipDuration(c(2, 5.5))).toBe(3.5);
    expect(totalDuration([c(0, 2), c(10, 13)])).toBe(5);
  });

  it("reordena e remove", () => {
    const list = [c(0, 1, "a"), c(0, 1, "b"), c(0, 1, "c")];
    expect(moveClip(list, 0, 2).map((x) => x.media_id)).toEqual(["b", "c", "a"]);
    expect(moveClip(list, 2, 0).map((x) => x.media_id)).toEqual(["c", "a", "b"]);
    expect(removeClip(list, 1).map((x) => x.media_id)).toEqual(["a", "c"]);
  });

  it("corta início/fim respeitando a origem e o mínimo", () => {
    expect(trimClip([c(0, 10)], 0, 2, 8, 10)[0]).toMatchObject({ start: 2, end: 8 });
    expect(trimClip([c(0, 10)], 0, -5, 99, 10)[0]).toMatchObject({ start: 0, end: 10 });
    const t = trimClip([c(0, 10)], 0, 5, 5, 10)[0];
    expect(t.end - t.start).toBeCloseTo(MIN_CLIP);
  });

  it("divide no ponto e mantém título só na primeira parte", () => {
    const out = splitClip([c(0, 10)], 0, 4);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ start: 0, end: 4, title: "T" });
    expect(out[1]).toMatchObject({ start: 4, end: 10, title: "" });
    expect(splitClip([c(0, 10)], 0, 0.1)).toHaveLength(1); // perto demais da borda
  });

  it("remove trecho do meio gerando dois clipes", () => {
    const out = removeRange([c(0, 10)], 0, 3, 6);
    expect(out.map((x) => [x.start, x.end])).toEqual([[0, 3], [6, 10]]);
    expect(totalDuration(out)).toBe(7);
    expect(removeRange([c(0, 10)], 0, 0, 10)).toHaveLength(0);
  });

  it("localiza um instante da montagem", () => {
    const list = [c(10, 12), c(0, 3)];
    expect(locate(list, 1)).toEqual({ index: 0, local: 1, source: 11 });
    expect(locate(list, 2.5)).toEqual({ index: 1, local: 0.5, source: 0.5 });
    expect(locate(list, 99)).toBeNull();
  });

  it("fade: escuro nas bordas, cheio no meio; corte não altera", () => {
    expect(fadeAlpha(0, 4, "fade")).toBe(0);
    expect(fadeAlpha(2, 4, "fade")).toBe(1);
    expect(fadeAlpha(3.75, 4, "fade")).toBeCloseTo(0.5);
    expect(fadeAlpha(0, 4, "corte")).toBe(1);
  });

  it("dimensões pares por proporção", () => {
    expect(canvasSize("9:16", 720)).toEqual({ width: 720, height: 1280 });
    expect(canvasSize("16:9", 1080)).toEqual({ width: 1920, height: 1080 });
    expect(canvasSize("1:1", 480)).toEqual({ width: 480, height: 480 });
    expect(canvasSize("16:9", 480).width % 2).toBe(0);
  });

  it("recorte cobrir centraliza", () => {
    expect(coverRect(1920, 1080, 1080, 1920)).toEqual({ sx: (1920 - 1080 * (1080 / 1920)) / 2, sy: 0, sw: 1080 * (1080 / 1920), sh: 1080 });
    expect(coverRect(1000, 1000, 1000, 500)).toEqual({ sx: 0, sy: 250, sw: 1000, sh: 500 });
  });

  it("escolhe formato suportado", () => {
    expect(pickMimeType((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=vp9,opus");
    expect(pickMimeType(() => false)).toBeNull();
  });

  it("montagem automática prioriza favoritos em ordem cronológica", () => {
    const src = [
      { id: "b", duration: 20, favorite: true, taken_at: "2026-12-12T10:00:00Z", created_at: "x" },
      { id: "a", duration: 2, favorite: true, taken_at: "2026-12-11T10:00:00Z", created_at: "x" },
      { id: "z", duration: 30, favorite: false, taken_at: "2026-12-10T10:00:00Z", created_at: "x" },
    ];
    const out = autoMontage(src, { secondsPerClip: 4, maxClips: 10, onlyFavorites: true });
    expect(out.map((x) => x.media_id)).toEqual(["a", "b"]);
    expect(out[0]).toMatchObject({ start: 0, end: 2 }); // vídeo menor que o trecho
    expect(out[1]).toMatchObject({ start: 8, end: 12 }); // meio do vídeo
    expect(autoMontage(src, { secondsPerClip: 4, maxClips: 1, onlyFavorites: false })).toHaveLength(1);
  });
});
