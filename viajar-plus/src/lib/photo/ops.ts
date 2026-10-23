// Operações puras sobre buffers RGBA. Sem DOM: rodam no Worker, no navegador
// ou nos testes. Cada função devolve um NOVO buffer (o original é preservado).

export interface ImageBuf {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100..100 (negativo = mais frio/azulado)
  sharpness: number; // 0..100
}

export const NO_ADJUST: Adjustments = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 0 };

export function createBuf(width: number, height: number, fill?: [number, number, number, number]): ImageBuf {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) for (let i = 0; i < data.length; i += 4) data.set(fill, i);
  return { width, height, data };
}

export function cloneBuf(b: ImageBuf): ImageBuf {
  return { width: b.width, height: b.height, data: new Uint8ClampedArray(b.data) };
}

export function isNeutral(a: Adjustments): boolean {
  return !a.brightness && !a.contrast && !a.saturation && !a.temperature && !a.sharpness;
}

/** Brilho, contraste, saturação e temperatura numa única passada. */
export function applyColor(src: ImageBuf, a: Adjustments): ImageBuf {
  const out = cloneBuf(src);
  const d = out.data;
  const bright = a.brightness * 2.55;
  const c = a.contrast * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const sat = 1 + a.saturation / 100;
  const warm = a.temperature * 0.6;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] + bright;
    let g = d[i + 1] + bright;
    let b = d[i + 2] + bright;
    r = cf * (r - 128) + 128;
    g = cf * (g - 128) + 128;
    b = cf * (b - 128) + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;
    d[i] = r + warm;
    d[i + 1] = g + warm * 0.15;
    d[i + 2] = b - warm;
  }
  return out;
}

export function brightness(b: ImageBuf, v: number): ImageBuf {
  return applyColor(b, { ...NO_ADJUST, brightness: v });
}
export function contrast(b: ImageBuf, v: number): ImageBuf {
  return applyColor(b, { ...NO_ADJUST, contrast: v });
}
export function saturation(b: ImageBuf, v: number): ImageBuf {
  return applyColor(b, { ...NO_ADJUST, saturation: v });
}
export function temperature(b: ImageBuf, v: number): ImageBuf {
  return applyColor(b, { ...NO_ADJUST, temperature: v });
}

/** Nitidez por convolução 3×3 (kernel laplaciano ponderado). Bordas preservadas. */
export function sharpen(src: ImageBuf, amount: number): ImageBuf {
  const k = Math.max(0, Math.min(100, amount)) / 100;
  if (k === 0) return cloneBuf(src);
  const { width: w, height: h, data: s } = src;
  const out = cloneBuf(src);
  const d = out.data;
  const center = 1 + 4 * k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = center * s[i + ch] - k * (s[i - 4 + ch] + s[i + 4 + ch] + s[i - w * 4 + ch] + s[i + w * 4 + ch]);
        d[i + ch] = v;
      }
    }
  }
  return out;
}

export function applyAdjustments(src: ImageBuf, a: Adjustments): ImageBuf {
  let out = isNeutral({ ...a, sharpness: 0 }) ? src : applyColor(src, a);
  if (a.sharpness > 0) out = sharpen(out, a.sharpness);
  return out === src ? cloneBuf(src) : out;
}

export function flipH(src: ImageBuf): ImageBuf {
  const { width: w, height: h } = src;
  const out = createBuf(w, h);
  const s = new Uint32Array(src.data.buffer.slice(0));
  const o = new Uint32Array(out.data.buffer);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = s[y * w + (w - 1 - x)];
  return out;
}

export function flipV(src: ImageBuf): ImageBuf {
  const { width: w, height: h } = src;
  const out = createBuf(w, h);
  for (let y = 0; y < h; y++) out.data.set(src.data.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  return out;
}

/** Gira 90° no sentido horário (cw) ou anti-horário. */
export function rotate90(src: ImageBuf, cw = true): ImageBuf {
  const { width: w, height: h } = src;
  const out = createBuf(h, w);
  const s = new Uint32Array(src.data.buffer.slice(0));
  const o = new Uint32Array(out.data.buffer);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = cw ? h - 1 - y : y;
      const ny = cw ? x : w - 1 - x;
      o[ny * h + nx] = s[y * w + x];
    }
  }
  return out;
}

export function crop(src: ImageBuf, x: number, y: number, cw: number, ch: number): ImageBuf {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.round(x)));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.round(y)));
  const w = Math.max(1, Math.min(src.width - x0, Math.round(cw)));
  const h = Math.max(1, Math.min(src.height - y0, Math.round(ch)));
  const out = createBuf(w, h);
  for (let row = 0; row < h; row++) {
    const start = ((y0 + row) * src.width + x0) * 4;
    out.data.set(src.data.subarray(start, start + w * 4), row * w * 4);
  }
  return out;
}

/** Redimensiona com interpolação bilinear. */
export function resize(src: ImageBuf, w: number, h: number): ImageBuf {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const out = createBuf(w, h);
  const sx = src.width / w;
  const sy = src.height / h;
  const s = src.data;
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5);
    const y1 = Math.floor(fy);
    const y2 = Math.min(src.height - 1, y1 + 1);
    const ty = fy - y1;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5);
      const x1 = Math.floor(fx);
      const x2 = Math.min(src.width - 1, x1 + 1);
      const tx = fx - x1;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = s[(y1 * src.width + x1) * 4 + c];
        const b = s[(y1 * src.width + x2) * 4 + c];
        const cc = s[(y2 * src.width + x1) * 4 + c];
        const dd = s[(y2 * src.width + x2) * 4 + c];
        out.data[o + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + dd * tx) * ty;
      }
    }
  }
  return out;
}

/** Dimensões que cabem num lado máximo, mantendo a proporção. */
export function fitWithin(w: number, h: number, maxSide: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
}
