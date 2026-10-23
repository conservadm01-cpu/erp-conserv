import { NO_ADJUST, type Adjustments } from "./ops";
import { frameTemplate, type FrameSpec } from "./frames";

export type AspectId = "original" | "livre" | "1:1" | "4:5" | "9:16" | "16:9" | "3:2";

export const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: "original", label: "Original", ratio: null },
  { id: "livre", label: "Livre", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
];

export interface CropState {
  aspect: AspectId;
  zoom: number; // 1..4 (aproxima dentro do recorte)
  panX: number; // 0..1 posição horizontal do recorte (enquadramento)
  panY: number; // 0..1
  freeW: number; // 0.1..1 (apenas proporção livre)
  freeH: number;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number; // 0..1 (relativo à imagem final)
  y: number;
  size: number; // % da largura final
  color: string;
  font: "serif" | "sans" | "script" | "mono";
  align: "left" | "center" | "right";
  shadow: boolean;
  inFrame: boolean; // posiciona na faixa inferior da moldura
}

export interface EditState {
  version: 1;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  crop: CropState;
  adjust: Adjustments;
  maxSide: number | null; // redimensionar (lado maior em px)
  frame: FrameSpec;
  texts: TextLayer[];
}

export const DEFAULT_CROP: CropState = { aspect: "original", zoom: 1, panX: 0.5, panY: 0.5, freeW: 1, freeH: 1 };

export function defaultEditState(): EditState {
  return {
    version: 1,
    rotate: 0,
    flipH: false,
    flipV: false,
    crop: { ...DEFAULT_CROP },
    adjust: { ...NO_ADJUST },
    maxSide: null,
    frame: { ...frameTemplate("nenhuma") },
    texts: [],
  };
}

/** Garante que um estado salvo (photo_edits.operations) seja reaplicável mesmo se incompleto. */
export function normalizeState(raw: unknown): EditState {
  const d = defaultEditState();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<EditState>;
  return {
    version: 1,
    rotate: ([0, 90, 180, 270] as const).includes(r.rotate as 0) ? (r.rotate as EditState["rotate"]) : 0,
    flipH: Boolean(r.flipH),
    flipV: Boolean(r.flipV),
    crop: { ...d.crop, ...(r.crop ?? {}) },
    adjust: { ...d.adjust, ...(r.adjust ?? {}) },
    maxSide: typeof r.maxSide === "number" && r.maxSide > 0 ? r.maxSide : null,
    frame: { ...d.frame, ...(r.frame ?? {}) },
    texts: Array.isArray(r.texts) ? r.texts : [],
  };
}

/** Retângulo de recorte em pixels sobre a imagem já girada (w×h). Função pura. */
export function cropRect(w: number, h: number, c: CropState): { x: number; y: number; w: number; h: number } {
  const ratio = ASPECTS.find((a) => a.id === c.aspect)?.ratio ?? null;
  let cw: number;
  let ch: number;
  if (c.aspect === "livre") {
    cw = w * Math.min(1, Math.max(0.1, c.freeW));
    ch = h * Math.min(1, Math.max(0.1, c.freeH));
  } else if (ratio) {
    if (w / h > ratio) {
      ch = h;
      cw = h * ratio;
    } else {
      cw = w;
      ch = w / ratio;
    }
  } else {
    cw = w;
    ch = h;
  }
  const z = Math.min(4, Math.max(1, c.zoom || 1));
  cw /= z;
  ch /= z;
  const x = (w - cw) * Math.min(1, Math.max(0, c.panX));
  const y = (h - ch) * Math.min(1, Math.max(0, c.panY));
  return { x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(cw)), h: Math.max(1, Math.round(ch)) };
}

/** Histórico de desfazer/refazer (puro). */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function historyInit<T>(v: T): History<T> {
  return { past: [], present: v, future: [] };
}
export function historyPush<T>(h: History<T>, v: T, limit = 80): History<T> {
  return { past: [...h.past, h.present].slice(-limit), present: v, future: [] };
}
export function historyUndo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}
export function historyRedo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
