// Vídeo simulado para a demonstração: câmera de mentira (quando a real não é
// liberada), gravações de exemplo e um profissional virtual gravando ao vivo.
import { db, objects, IDS, userId } from "./fakeSupabase";

type Scene = { label: string; facing?: string };

/** Desenha uma "obra" animada: parede, piso sendo assentado, data e hora. */
function animate(canvas: HTMLCanvasElement, scene: Scene) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width, H = canvas.height;
  let raf = 0; const t0 = performance.now();
  const draw = () => {
    const t = (performance.now() - t0) / 1000;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#d9d2c3"); g.addColorStop(.62, "#c9bfa9"); g.addColorStop(.62, "#8d8577"); g.addColorStop(1, "#6f685c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // azulejos sendo assentados no piso
    const tiles = Math.floor(t * 1.6) % 36;
    for (let i = 0; i < tiles; i++) {
      const c = i % 9, r = Math.floor(i / 9);
      ctx.fillStyle = (c + r) % 2 ? "#e9e4da" : "#dcd5c8";
      ctx.fillRect(W * .06 + c * W * .098, H * .66 + r * H * .08, W * .092, H * .072);
    }
    // ferramenta em movimento
    const x = W * .5 + Math.sin(t * 1.3) * W * .32, y = H * .5 + Math.cos(t * 2.1) * H * .06;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * .4);
    ctx.fillStyle = "#e0a526"; ctx.fillRect(-W * .07, -H * .025, W * .14, H * .05);
    ctx.fillStyle = "#3d3d3d"; ctx.fillRect(-W * .01, H * .025, W * .02, H * .12);
    ctx.restore();
    // carimbo centralizado (fica visível mesmo com o visor cortando as laterais)
    const fs = Math.round(Math.min(W, H) * .045);
    ctx.font = `700 ${fs}px system-ui, sans-serif`; ctx.textAlign = "center";
    const ts = new Date().toLocaleString("pt-BR");
    const bw = Math.max(ctx.measureText(scene.label).width, ctx.measureText(ts).width) + fs * 1.6;
    ctx.fillStyle = "rgba(10,22,34,.62)";
    ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, H * .2, bw, fs * 3.1, fs * .6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.fillText(scene.label, W / 2, H * .2 + fs * 1.35);
    ctx.font = `500 ${Math.round(fs * .8)}px system-ui, sans-serif`; ctx.fillStyle = "#cfe1ea";
    ctx.fillText(ts, W / 2, H * .2 + fs * 2.5); ctx.textAlign = "start";
    raf = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(raf);
}

function fakeStream(scene: Scene, w = 960, h = 720) {
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const stop = animate(canvas, scene);
  const stream = canvas.captureStream(24);
  stream.getTracks().forEach(tr => tr.addEventListener("ended", stop));
  const origStop = MediaStreamTrack.prototype.stop;
  stream.getVideoTracks().forEach(tr => { tr.stop = function () { stop(); origStop.call(this); }; });
  return stream;
}

export let cameraSimulada = false;
/** Tenta a câmera real; se o navegador/artefato não liberar, usa a simulada. */
export function patchCamera() {
  const md: any = navigator.mediaDevices ?? ((navigator as any).mediaDevices = {});
  const real = md.getUserMedia?.bind(md);
  md.getUserMedia = async (c: MediaStreamConstraints) => {
    if (real && !cameraSimulada) {
      try {
        return await Promise.race([real(c), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
      } catch { cameraSimulada = true; }
    }
    cameraSimulada = true;
    const facing = (c.video as any)?.facingMode?.ideal === "user" ? "frontal" : "traseira";
    return fakeStream({ label: `Câmera simulada · ${facing}` }, 720, 960);
  };
}

function mime() {
  return ["video/mp4", "video/webm;codecs=vp8", "video/webm"].find(t => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}
function recordOnce(stream: MediaStream, ms: number, type: string): Promise<Blob> {
  return new Promise(resolve => {
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 900_000 });
    const parts: Blob[] = [];
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    rec.onstop = () => resolve(new Blob(parts, { type: rec.mimeType || type }));
    rec.start(); setTimeout(() => rec.stop(), ms);
  });
}

/** Gravação de exemplo de ontem, com 3 trechos curtos. */
export async function seedExemplo() {
  const type = mime(); if (!type) return;
  const stream = fakeStream({ label: "Exemplo · Reforma de cozinha" }, 640, 480);
  const blobs = await Promise.all([0, 1, 2].map(i => new Promise<Blob>(r => setTimeout(() => recordOnce(stream, 3200, type).then(r), i * 150))));
  stream.getTracks().forEach(t => t.stop());
  const gid = "f0000000-0000-4000-8000-0000000000e1";
  const inicio = new Date(Date.now() - 86400_000); inicio.setHours(9, 12, 0, 0);
  const ext = type.includes("mp4") ? "mp4" : "webm";
  if (db.gravacoes.some(g => g.id === gid)) return;
  db.gravacoes.push({ id: gid, obra_id: IDS.obraCozinha, profissional_id: userId("pedreiro@demo.com"), status: "finalizada",
    inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + 3 * 10_000).toISOString(),
    metadata: { condo: "Residencial Jardins", unit: "Bloco A · Apto. 104", worker: "pedreiro@demo.com", job: "Reforma de cozinha" }, created_at: inicio.toISOString() });
  blobs.forEach((b, i) => {
    const path = `${gid}/${String(i).padStart(6, "0")}.${ext}`;
    objects.set(path, b);
    const t = new Date(inicio.getTime() + i * 10_000).toISOString();
    db.arquivos_video.push({ id: crypto.randomUUID(), gravacao_id: gid, caminho_storage: path, numero_segmento: i, tamanho_bytes: b.size, inicio_segmento: t, duracao_ms: 3200, created_at: t });
  });
}

// ---------------------------------------------------------------- profissional virtual
let virtual: { stop: () => void } | null = null;
export const virtualAtivo = () => !!virtual;
/** Simula o pedreiro gravando agora na cozinha (A-104): um trecho a cada 10 s. */
export function iniciarVirtual(onChange: () => void) {
  const type = mime(); if (!type || virtual) return;
  const stream = fakeStream({ label: "Profissional virtual · cozinha" }, 640, 480);
  const gid = crypto.randomUUID(); const ext = type.includes("mp4") ? "mp4" : "webm";
  db.gravacoes.push({ id: gid, obra_id: IDS.obraCozinha, profissional_id: userId("pedreiro@demo.com"), status: "iniciada", inicio: new Date().toISOString(), fim: null,
    metadata: { condo: "Residencial Jardins", unit: "Bloco A · Apto. 104", worker: "pedreiro@demo.com", job: "Reforma de cozinha" }, created_at: new Date().toISOString() });
  let part = 0, alive = true;
  const loop = async () => {
    while (alive) {
      const inicio = new Date().toISOString();
      const blob = await recordOnce(stream, 10_000, type);
      const path = `${gid}/${String(part).padStart(6, "0")}.${ext}`;
      objects.set(path, blob);
      db.arquivos_video.push({ id: crypto.randomUUID(), gravacao_id: gid, caminho_storage: path, numero_segmento: part, tamanho_bytes: blob.size, inicio_segmento: inicio, duracao_ms: 10_000, created_at: new Date().toISOString() });
      part++;
      if (!alive) break;
    }
  };
  void loop();
  virtual = { stop: () => {
    alive = false; stream.getTracks().forEach(t => t.stop()); virtual = null;
    const g = db.gravacoes.find(x => x.id === gid); if (g) { g.status = "finalizada"; g.fim = new Date().toISOString(); }
    onChange();
  } };
  onChange();
}
export const pararVirtual = () => virtual?.stop();
