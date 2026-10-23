"use client";
import type { VideoProject } from "@/lib/types";
import { bitrateFor, canvasSize, clipDuration, coverRect, fadeAlpha, pickMimeType, totalDuration, type EditorClip } from "./timeline";

// Compositor da montagem no navegador.
// Desenha cada clipe num <canvas>, mistura o áudio com WebAudio e, na exportação,
// grava o resultado com canvas.captureStream + MediaRecorder. A gravação acontece
// em TEMPO REAL (um vídeo de 60 s leva ~60 s) e exige a aba visível: navegadores
// reduzem a taxa de quadros em abas ocultas.

export interface RenderInput {
  clips: EditorClip[];
  urls: Record<string, string>; // media_id -> URL do arquivo
  aspect: VideoProject["aspect"];
  resolution: VideoProject["resolution"];
  transition: VideoProject["transition"];
  audioUrl?: string | null; // trilha própria/licenciada
  audioVolume?: number;
  canvas: HTMLCanvasElement;
  record: boolean;
  signal?: AbortSignal;
  onProgress?: (seconds: number, total: number) => void;
}

export interface RenderResult {
  blob: Blob | null;
  mimeType: string | null;
}

export function recorderSupport(): { supported: boolean; mimeType: string | null; reason?: string } {
  if (typeof window === "undefined") return { supported: false, mimeType: null, reason: "Somente no navegador." };
  if (typeof MediaRecorder === "undefined") return { supported: false, mimeType: null, reason: "Este navegador não oferece MediaRecorder." };
  const c = document.createElement("canvas");
  if (typeof c.captureStream !== "function") return { supported: false, mimeType: null, reason: "Este navegador não permite capturar o canvas (captureStream)." };
  const mimeType = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
  if (!mimeType) return { supported: false, mimeType: null, reason: "Nenhum formato de vídeo gravável foi encontrado neste navegador." };
  return { supported: true, mimeType };
}

class Aborted extends Error {
  constructor() {
    super("Exportação cancelada.");
  }
}

function waitEvent(el: HTMLMediaElement, ev: string, signal?: AbortSignal, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => cleanup(new Error("O vídeo demorou demais para carregar.")), timeoutMs);
    const onEv = () => cleanup();
    const onErr = () => cleanup(new Error("Não foi possível ler um dos vídeos (formato não suportado por este navegador?)."));
    const onAbort = () => cleanup(new Aborted());
    function cleanup(err?: Error) {
      clearTimeout(t);
      el.removeEventListener(ev, onEv);
      el.removeEventListener("error", onErr);
      signal?.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(ev, onEv, { once: true });
    el.addEventListener("error", onErr, { once: true });
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function drawText(ctx: CanvasRenderingContext2D, W: number, H: number, clip: EditorClip, local: number) {
  const base = Math.min(W, H);
  ctx.save();
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.65)";
  ctx.shadowBlur = base * 0.02;
  ctx.fillStyle = "#fff";
  if (clip.title && local < 3) {
    ctx.globalAlpha = Math.min(1, local / 0.4, (3 - local) / 0.4);
    ctx.font = `700 ${Math.round(base * 0.075)}px Georgia, "Times New Roman", serif`;
    wrap(ctx, clip.title, W / 2, H * 0.42, W * 0.86, base * 0.09);
    ctx.globalAlpha = 1;
  }
  if (clip.caption) {
    ctx.font = `500 ${Math.round(base * 0.045)}px system-ui, sans-serif`;
    wrap(ctx, clip.caption, W / 2, H * 0.86, W * 0.9, base * 0.055);
  }
  const meta = [clip.date_label, clip.location_label].filter(Boolean).join(" · ");
  if (meta) {
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(base * 0.034)}px system-ui, sans-serif`;
    ctx.fillText(meta, base * 0.05, base * 0.08);
  }
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}

/** Reproduz a montagem no canvas; com `record`, devolve o arquivo de vídeo gravado. */
export async function renderMontage(input: RenderInput): Promise<RenderResult> {
  const { clips, canvas, signal } = input;
  if (!clips.length) throw new Error("Adicione ao menos um clipe à linha do tempo.");
  const { width: W, height: H } = canvasSize(input.aspect, input.resolution);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  await ac.resume().catch(() => {});
  const dest = ac.createMediaStreamDestination();
  const monitor = input.record ? null : ac.destination; // na prévia, o áudio sai pelos alto-falantes

  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  let mimeType: string | null = null;
  let bgAudio: HTMLAudioElement | null = null;
  const elements: HTMLMediaElement[] = [];
  const total = totalDuration(clips);
  let elapsedBefore = 0;

  try {
    if (input.audioUrl) {
      bgAudio = new Audio();
      bgAudio.crossOrigin = "anonymous";
      bgAudio.src = input.audioUrl;
      bgAudio.loop = true;
      const g = ac.createGain();
      g.gain.value = input.audioVolume ?? 0.8;
      ac.createMediaElementSource(bgAudio).connect(g);
      g.connect(dest);
      if (monitor) g.connect(monitor);
      elements.push(bgAudio);
    }

    if (input.record) {
      const sup = recorderSupport();
      if (!sup.supported || !sup.mimeType) throw new Error(sup.reason ?? "Gravação não suportada.");
      mimeType = sup.mimeType;
      const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrateFor(input.resolution), audioBitsPerSecond: 128_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start(1000);
    }
    if (bgAudio) await bgAudio.play().catch(() => {});

    for (const clip of clips) {
      if (signal?.aborted) throw new Aborted();
      const url = input.urls[clip.media_id];
      if (!url) throw new Error("Um dos vídeos da linha do tempo não está mais disponível.");
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.playsInline = true;
      v.preload = "auto";
      v.src = url;
      elements.push(v);
      const gain = ac.createGain();
      gain.gain.value = clip.muted ? 0 : Math.max(0, Math.min(1, clip.volume));
      ac.createMediaElementSource(v).connect(gain);
      gain.connect(dest);
      if (monitor) gain.connect(monitor);

      if (v.readyState < 1) await waitEvent(v, "loadedmetadata", signal);
      v.currentTime = clip.start;
      await waitEvent(v, "seeked", signal);
      const dur = clipDuration(clip);
      await v.play();

      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          v.pause();
          reject(new Aborted());
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        const step = () => {
          if (signal?.aborted) return;
          const local = Math.max(0, v.currentTime - clip.start);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          if (v.videoWidth) {
            const r = coverRect(v.videoWidth, v.videoHeight, W, H);
            ctx.globalAlpha = fadeAlpha(local, dur, input.transition);
            ctx.drawImage(v, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
            ctx.globalAlpha = 1;
          }
          drawText(ctx, W, H, clip, local);
          input.onProgress?.(Math.min(total, elapsedBefore + local), total);
          if (v.currentTime >= clip.end - 0.02 || v.ended) {
            v.pause();
            signal?.removeEventListener("abort", onAbort);
            resolve();
          } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      elapsedBefore += dur;
      v.removeAttribute("src");
      v.load();
    }

    if (!recorder) return { blob: null, mimeType: null };
    const rec = recorder;
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    await done;
    return { blob: new Blob(chunks, { type: (mimeType ?? "video/webm").split(";")[0] }), mimeType };
  } finally {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    elements.forEach((el) => {
      el.pause();
      el.removeAttribute("src");
    });
    await ac.close().catch(() => {});
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof Aborted;
}
