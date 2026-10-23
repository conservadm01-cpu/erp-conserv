import type { ID, VideoClip, VideoProject } from "@/lib/types";

// Lógica pura da linha do tempo do editor de vídeo (sem DOM), testável.
// Os clipes são trechos [start, end) de um vídeo de origem, em segundos.

/** Clipe do editor: além dos campos de VideoClip, guarda data e local exibidos (persistidos no JSON de clips). */
export interface EditorClip extends VideoClip {
  date_label?: string;
  location_label?: string;
}

export const MIN_CLIP = 0.3; // menor trecho permitido (s)
export const FADE_SEC = 0.5;

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function clipDuration(c: Pick<VideoClip, "start" | "end">): number {
  return Math.max(0, r3(c.end - c.start));
}

export function totalDuration(clips: Pick<VideoClip, "start" | "end">[]): number {
  return r3(clips.reduce((s, c) => s + clipDuration(c), 0));
}

export function newClip(mediaId: ID, sourceDuration: number, extra: Partial<EditorClip> = {}): EditorClip {
  return { media_id: mediaId, start: 0, end: r3(Math.max(MIN_CLIP, sourceDuration || MIN_CLIP)), volume: 1, muted: false, title: "", caption: "", ...extra };
}

export function moveClip<T>(clips: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= clips.length) return clips;
  const out = [...clips];
  const [c] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, c);
  return out;
}

export function removeClip<T>(clips: T[], i: number): T[] {
  return clips.filter((_, k) => k !== i);
}

/** Corta início/fim respeitando a duração do vídeo de origem e o trecho mínimo. */
export function trimClip<T extends VideoClip>(clips: T[], i: number, start: number, end: number, sourceDuration?: number | null): T[] {
  const c = clips[i];
  if (!c) return clips;
  const max = sourceDuration && sourceDuration > 0 ? sourceDuration : Math.max(end, c.end);
  let s = Math.max(0, Math.min(start, max - MIN_CLIP));
  let e = Math.min(max, Math.max(end, s + MIN_CLIP));
  if (e - s < MIN_CLIP) s = Math.max(0, e - MIN_CLIP);
  s = r3(s);
  e = r3(e);
  return clips.map((x, k) => (k === i ? { ...x, start: s, end: e } : x));
}

/** Divide o clipe no instante `at` (tempo do vídeo de origem). */
export function splitClip<T extends VideoClip>(clips: T[], i: number, at: number): T[] {
  const c = clips[i];
  if (!c || at <= c.start + MIN_CLIP || at >= c.end - MIN_CLIP) return clips;
  const a = { ...c, end: r3(at) };
  const b = { ...c, start: r3(at), title: "" };
  return [...clips.slice(0, i), a, b, ...clips.slice(i + 1)];
}

/** Remove o trecho [from, to) de dentro do clipe, gerando até dois clipes. */
export function removeRange<T extends VideoClip>(clips: T[], i: number, from: number, to: number): T[] {
  const c = clips[i];
  if (!c) return clips;
  const f = Math.max(c.start, Math.min(from, to));
  const t = Math.min(c.end, Math.max(from, to));
  if (t - f <= 0) return clips;
  const parts: T[] = [];
  if (f - c.start >= MIN_CLIP) parts.push({ ...c, end: r3(f) });
  if (c.end - t >= MIN_CLIP) parts.push({ ...c, start: r3(t), title: parts.length ? "" : c.title });
  return [...clips.slice(0, i), ...parts, ...clips.slice(i + 1)];
}

export interface Locate {
  index: number;
  local: number; // tempo dentro do clipe (0..duração)
  source: number; // tempo no vídeo de origem
}

/** Converte um instante da montagem para clipe + tempo de origem. */
export function locate(clips: Pick<VideoClip, "start" | "end">[], t: number): Locate | null {
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clipDuration(clips[i]);
    if (t < acc + d || (i === clips.length - 1 && t <= acc + d)) {
      const local = Math.max(0, t - acc);
      return { index: i, local: r3(local), source: r3(clips[i].start + local) };
    }
    acc += d;
  }
  return null;
}

/** Opacidade do quadro para a transição "fade" (escurece na entrada e na saída). */
export function fadeAlpha(local: number, duration: number, transition: VideoProject["transition"], fade = FADE_SEC): number {
  if (transition !== "fade" || duration <= 0) return 1;
  const f = Math.min(fade, duration / 2);
  if (f <= 0) return 1;
  if (local < f) return Math.max(0, local / f);
  if (local > duration - f) return Math.max(0, (duration - local) / f);
  return 1;
}

/** Dimensões do quadro final: a resolução é o lado menor; valores pares (exigência de codificadores). */
export function canvasSize(aspect: VideoProject["aspect"], resolution: VideoProject["resolution"]): { width: number; height: number } {
  const even = (n: number) => Math.round(n / 2) * 2;
  if (aspect === "1:1") return { width: resolution, height: resolution };
  const long = even((resolution * 16) / 9);
  return aspect === "9:16" ? { width: resolution, height: long } : { width: long, height: resolution };
}

/** Recorte "cobrir": centraliza o vídeo preenchendo o quadro (as bordas excedentes são cortadas). */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!srcW || !srcH) return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  const src = srcW / srcH;
  const dst = dstW / dstH;
  if (src > dst) {
    const sw = srcH * dst;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / dst;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

export const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

/** Escolhe o primeiro formato que o navegador sabe gravar. */
export function pickMimeType(isSupported: (m: string) => boolean): string | null {
  return MIME_CANDIDATES.find((m) => {
    try {
      return isSupported(m);
    } catch {
      return false;
    }
  }) ?? null;
}

export function bitrateFor(resolution: VideoProject["resolution"]): number {
  return resolution >= 1080 ? 8_000_000 : resolution >= 720 ? 5_000_000 : 2_500_000;
}

export interface MontageSource {
  id: ID;
  duration: number | null;
  favorite: boolean;
  taken_at: string | null;
  created_at: string;
}

/** Montagem curta automática: N segundos do meio de cada vídeo (favoritos primeiro), em ordem cronológica. */
export function autoMontage(sources: MontageSource[], opts: { secondsPerClip: number; maxClips: number; onlyFavorites: boolean }): EditorClip[] {
  const sec = Math.max(1, opts.secondsPerClip);
  let pool = sources.filter((s) => (s.duration ?? 0) >= MIN_CLIP);
  if (opts.onlyFavorites && pool.some((s) => s.favorite)) pool = pool.filter((s) => s.favorite);
  pool.sort((a, b) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at));
  return pool.slice(0, Math.max(1, opts.maxClips)).map((s) => {
    const d = s.duration ?? sec;
    const len = Math.min(sec, d);
    const start = r3(Math.max(0, (d - len) / 2));
    return { ...newClip(s.id, d), start, end: r3(start + len) };
  });
}

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}
