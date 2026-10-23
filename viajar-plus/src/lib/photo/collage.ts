export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Células de uma colagem para 2–6 fotos. Função pura. */
export function collageCells(n: number, W: number, H: number, gap: number): Rect[] {
  const count = Math.max(1, Math.min(6, n));
  const rows: number[][] = {
    1: [[1]],
    2: [[1, 1]],
    3: [[2], [1, 1]],
    4: [[1, 1], [1, 1]],
    5: [[1, 1], [1, 1, 1]],
    6: [[1, 1, 1], [1, 1, 1]],
  }[count]!;
  if (count === 3) {
    // uma grande à esquerda e duas empilhadas à direita
    const lw = (W - gap * 3) * 0.6;
    const rw = W - gap * 3 - lw;
    const hh = (H - gap * 3) / 2;
    return [
      { x: gap, y: gap, w: lw, h: H - gap * 2 },
      { x: gap * 2 + lw, y: gap, w: rw, h: hh },
      { x: gap * 2 + lw, y: gap * 2 + hh, w: rw, h: hh },
    ];
  }
  const out: Rect[] = [];
  const rh = (H - gap * (rows.length + 1)) / rows.length;
  rows.forEach((cols, ri) => {
    const cw = (W - gap * (cols.length + 1)) / cols.length;
    cols.forEach((_, ci) => out.push({ x: gap + ci * (cw + gap), y: gap + ri * (rh + gap), w: cw, h: rh }));
  });
  return out;
}

/** Recorte "cover" de uma imagem sw×sh para caber em w×h. */
export function coverSource(sw: number, sh: number, w: number, h: number): Rect {
  const r = w / h;
  if (sw / sh > r) {
    const cw = sh * r;
    return { x: (sw - cw) / 2, y: 0, w: cw, h: sh };
  }
  const ch = sw / r;
  return { x: 0, y: (sh - ch) / 2, w: sw, h: ch };
}

/** Encaixe "contain" (imagem inteira, sem corte) dentro de uma caixa. */
export function containBox(sw: number, sh: number, box: Rect): Rect {
  const s = Math.min(box.w / sw, box.h / sh);
  const w = sw * s;
  const h = sh * s;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}
