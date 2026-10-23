"use client";
import { applyAdjustments, isNeutral, type Adjustments, type ImageBuf } from "./ops";
import { drawFrameBackground, drawFrameDetails, frameLayout } from "./frames";
import { cropRect, type EditState, type TextLayer } from "./state";

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: AnyCanvas): Ctx2D {
  const ctx = c.getContext("2d") as Ctx2D | null;
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");
  return ctx;
}

function dims(s: Source): { w: number; h: number } {
  if ("naturalWidth" in s) return { w: s.naturalWidth, h: s.naturalHeight };
  return { w: s.width, h: s.height };
}

/** Carrega a imagem respeitando a orientação EXIF. */
export async function loadSource(blob: Blob): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* cai para <img> (ex.: Safari antigo) */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir esta imagem neste navegador (formato HEIC pode não ser suportado)."));
    };
    img.src = url;
  });
}

// ---------- Worker para ajustes pesados ----------
let worker: Worker | null | undefined;
let seq = 0;

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = typeof Worker !== "undefined" ? new Worker(new URL("./adjust.worker.ts", import.meta.url), { type: "module" }) : null;
  } catch {
    worker = null;
  }
  return worker;
}

export async function adjustBuffer(buf: ImageBuf, adjust: Adjustments): Promise<Uint8ClampedArray> {
  const w = getWorker();
  if (!w) return applyAdjustments(buf, adjust).data;
  const id = ++seq;
  return new Promise((resolve) => {
    const fallback = setTimeout(() => {
      w.removeEventListener("message", onMsg);
      resolve(applyAdjustments(buf, adjust).data);
    }, 30_000);
    function onMsg(e: MessageEvent<{ id: number; data: Uint8ClampedArray }>) {
      if (e.data.id !== id) return;
      clearTimeout(fallback);
      w!.removeEventListener("message", onMsg);
      resolve(e.data.data);
    }
    w.addEventListener("message", onMsg);
    const copy = new Uint8ClampedArray(buf.data);
    w.postMessage({ id, width: buf.width, height: buf.height, data: copy, adjust }, [copy.buffer]);
  });
}

const FONTS: Record<TextLayer["font"], string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  script: "'Brush Script MT', 'Segoe Script', cursive",
  mono: "ui-monospace, Menlo, monospace",
};

export interface RenderOptions {
  /** Limite do lado maior (pré-visualização rápida). Sem limite = resolução total. */
  previewMaxSide?: number;
}

/** Aplica o estado de edição sobre a imagem original e devolve um canvas novo. */
export async function renderEdit(src: Source, st: EditState, opts: RenderOptions = {}): Promise<AnyCanvas> {
  const { w: sw, h: sh } = dims(src);
  const longest = Math.max(sw, sh);
  let scale = 1;
  if (st.maxSide) scale = Math.min(scale, st.maxSide / longest);
  if (opts.previewMaxSide) scale = Math.min(scale, opts.previewMaxSide / longest);
  scale = Math.min(1, scale);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const swap = st.rotate === 90 || st.rotate === 270;
  const rw = swap ? h : w;
  const rh = swap ? w : h;

  // 1) rotação e espelhamento
  const a = makeCanvas(rw, rh);
  const actx = ctx2d(a);
  actx.imageSmoothingQuality = "high";
  actx.translate(rw / 2, rh / 2);
  actx.rotate((st.rotate * Math.PI) / 180);
  actx.scale(st.flipH ? -1 : 1, st.flipV ? -1 : 1);
  actx.drawImage(src as CanvasImageSource, -w / 2, -h / 2, w, h);

  // 2) recorte / enquadramento
  const r = cropRect(rw, rh, st.crop);
  const b = makeCanvas(r.w, r.h);
  const bctx = ctx2d(b);
  bctx.drawImage(a as CanvasImageSource, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);

  // 3) ajustes de cor e nitidez
  if (!isNeutral(st.adjust)) {
    const img = bctx.getImageData(0, 0, r.w, r.h);
    const data = await adjustBuffer({ width: r.w, height: r.h, data: img.data }, st.adjust);
    bctx.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, r.w, r.h), 0, 0);
  }

  // 4) moldura
  const l = frameLayout(r.w, r.h, st.frame);
  const out = makeCanvas(l.outW, l.outH);
  const octx = ctx2d(out);
  drawFrameBackground(octx, l, st.frame);
  octx.drawImage(b as CanvasImageSource, l.imgX, l.imgY);
  drawFrameDetails(octx, l, st.frame, r.w, r.h);

  // 5) textos
  for (const t of st.texts) {
    if (!t.text.trim()) continue;
    const size = Math.max(8, (t.size / 100) * l.outW);
    octx.save();
    octx.font = `600 ${size}px ${FONTS[t.font] ?? FONTS.sans}`;
    octx.fillStyle = t.color;
    octx.textAlign = t.align;
    octx.textBaseline = "middle";
    if (t.shadow) {
      octx.shadowColor = "rgba(0,0,0,0.55)";
      octx.shadowBlur = size * 0.25;
      octx.shadowOffsetY = size * 0.06;
    }
    const inFrame = t.inFrame && l.bottom > 0;
    const x = t.x * l.outW;
    const y = inFrame ? l.imgY + r.h + l.bottom / 2 : t.y * l.outH;
    const lines = t.text.split("\n");
    lines.forEach((line, i) => octx.fillText(line, x, y + (i - (lines.length - 1) / 2) * size * 1.2, l.outW * 0.95));
    octx.restore();
  }
  return out;
}

export async function canvasToBlob(c: AnyCanvas, type = "image/jpeg", quality = 0.92): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => (c as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), type, quality));
}

/** Copia para um <canvas> visível (pré-visualização). */
export function paintTo(target: HTMLCanvasElement, c: AnyCanvas): void {
  target.width = c.width;
  target.height = c.height;
  target.getContext("2d")?.drawImage(c as CanvasImageSource, 0, 0);
}

export const EXPORT_FORMATS = [
  { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  { mime: "image/png", ext: "png", label: "PNG (sem perdas)" },
  { mime: "image/webp", ext: "webp", label: "WebP" },
] as const;
