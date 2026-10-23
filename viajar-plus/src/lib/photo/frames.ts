// Sistema de molduras editáveis. Cada moldura é um template de parâmetros;
// o usuário escolhe um template e ajusta espessura, cores, faixa inferior e padrão.

export type FramePattern = "nenhum" | "flocos" | "montanhas" | "filete" | "sombra";

export interface FrameSpec {
  template: string;
  name: string;
  thickness: number; // % do menor lado da foto
  bottomExtra: number; // % adicional na faixa inferior (Polaroid)
  color: string; // cor de fundo da moldura
  accent: string; // filete/padrão
  pattern: FramePattern;
  textColor: string; // cor da legenda escrita na moldura
}

export const FRAME_TEMPLATES: FrameSpec[] = [
  { template: "nenhuma", name: "Sem moldura", thickness: 0, bottomExtra: 0, color: "#ffffff", accent: "#000000", pattern: "nenhum", textColor: "#222222" },
  { template: "classica", name: "Clássica", thickness: 4, bottomExtra: 0, color: "#2b2118", accent: "#c9b38c", pattern: "filete", textColor: "#f3eadb" },
  { template: "branca", name: "Branca", thickness: 6, bottomExtra: 0, color: "#ffffff", accent: "#dddddd", pattern: "sombra", textColor: "#333333" },
  { template: "preta", name: "Preta", thickness: 6, bottomExtra: 0, color: "#0d0d0d", accent: "#333333", pattern: "nenhum", textColor: "#f2f2f2" },
  { template: "polaroid", name: "Polaroid", thickness: 5, bottomExtra: 18, color: "#fbfaf6", accent: "#e6e2d8", pattern: "sombra", textColor: "#2a2a2a" },
  { template: "dourada", name: "Dourada", thickness: 5, bottomExtra: 0, color: "#b8860b", accent: "#ffe08a", pattern: "filete", textColor: "#fff7dc" },
  { template: "neve", name: "Neve", thickness: 7, bottomExtra: 4, color: "#e8f4fb", accent: "#ffffff", pattern: "flocos", textColor: "#1b5f7a" },
  { template: "patagonia", name: "Patagônia", thickness: 7, bottomExtra: 8, color: "#1b5f7a", accent: "#e8f4f8", pattern: "montanhas", textColor: "#ffffff" },
];

export function frameTemplate(id: string | null | undefined): FrameSpec {
  return FRAME_TEMPLATES.find((f) => f.template === id) ?? FRAME_TEMPLATES[0];
}

export interface FrameLayout {
  outW: number;
  outH: number;
  imgX: number;
  imgY: number;
  border: number;
  bottom: number;
}

/** Calcula o tamanho final com moldura e a posição da foto. Função pura. */
export function frameLayout(w: number, h: number, f: FrameSpec | null): FrameLayout {
  if (!f || f.thickness <= 0) return { outW: w, outH: h, imgX: 0, imgY: 0, border: 0, bottom: 0 };
  const base = Math.min(w, h);
  const border = Math.round((base * f.thickness) / 100);
  const bottom = border + Math.round((base * f.bottomExtra) / 100);
  return { outW: w + border * 2, outH: h + border + bottom, imgX: border, imgY: border, border, bottom };
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Desenha o fundo/padrão da moldura (antes da foto) e os detalhes (depois). */
export function drawFrameBackground(ctx: Ctx2D, l: FrameLayout, f: FrameSpec): void {
  if (l.border === 0) return;
  ctx.save();
  if (f.template === "dourada") {
    const g = ctx.createLinearGradient(0, 0, l.outW, l.outH);
    g.addColorStop(0, "#8a6212");
    g.addColorStop(0.3, f.accent);
    g.addColorStop(0.55, f.color);
    g.addColorStop(0.8, "#f6d77a");
    g.addColorStop(1, "#7a5510");
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = f.color;
  }
  ctx.fillRect(0, 0, l.outW, l.outH);
  if (f.pattern === "flocos") {
    ctx.fillStyle = f.accent;
    const n = Math.round((l.outW + l.outH) / 40);
    for (let i = 0; i < n; i++) {
      // pseudoaleatório determinístico
      const px = ((i * 9301 + 49297) % 233280) / 233280;
      const py = ((i * 4096 + 150889) % 714025) / 714025;
      const x = px * l.outW;
      const y = py * l.outH;
      const r = Math.max(1, l.border * (0.06 + ((i % 5) * 0.03)));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.pattern === "montanhas") {
    const by = l.outH - l.bottom * 0.15;
    const peaks = 7;
    ctx.fillStyle = f.accent;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, l.outH);
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * l.outW;
      const y = by - (i % 2 ? l.bottom * 0.7 : l.bottom * 0.25);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(l.outW, l.outH);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawFrameDetails(ctx: Ctx2D, l: FrameLayout, f: FrameSpec, imgW: number, imgH: number): void {
  if (l.border === 0) return;
  ctx.save();
  if (f.pattern === "filete") {
    ctx.strokeStyle = f.accent;
    ctx.lineWidth = Math.max(1, l.border * 0.12);
    const inset = l.border * 0.45;
    ctx.strokeRect(inset, inset, l.outW - inset * 2, l.outH - inset * 2);
  }
  if (f.pattern === "sombra") {
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = Math.max(1, l.border * 0.06);
    ctx.strokeRect(l.imgX, l.imgY, imgW, imgH);
  }
  ctx.restore();
}
