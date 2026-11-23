"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Play, Pause, RefreshCw, CloudUpload, AlertTriangle, WifiOff, CheckCircle2 } from "lucide-react";
import { enqueue, subscribeQueue, processQueue, type QueueSnapshot } from "@/lib/uploadQueue";

type Metadata = { condo: string; unit: string; worker: string; job: string };
type Props = { metadata: Metadata; userId: string; obraId: string; onActiveChange?: (active: boolean) => void };
type Phase = "off" | "ready" | "recording" | "paused" | "stopping" | "done";

const SEGMENT_SECONDS = 10;
const LABEL: Record<Phase, string> = {
  off: "Câmera desligada", ready: "Câmera pronta", recording: "Gravando",
  paused: "Pausado", stopping: "Finalizando", done: "Gravação encerrada"
};

type Segment = { recorder: MediaRecorder; part: number; inicio: string; activeMs: number; resumedAt: number; done: Promise<void> };

function supportedMime() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find(t => MediaRecorder.isTypeSupported(t));
}

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function CameraRecorder({ metadata, userId, obraId, onActiveChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentRef = useRef<Segment | null>(null);
  const gravacaoRef = useRef<string | null>(null);
  const partRef = useRef(0);
  const segSecondsRef = useRef(0);
  const phaseRef = useRef<Phase>("off");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const enqueueChain = useRef<Promise<void>>(Promise.resolve());

  const [phase, setPhaseState] = useState<Phase>("off");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [segments, setSegments] = useState(0);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [queue, setQueue] = useState<QueueSnapshot | null>(null);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const active = phase === "recording" || phase === "paused";

  useEffect(() => subscribeQueue(setQueue), []);
  useEffect(() => { onActiveChange?.(phase === "recording" || phase === "paused" || phase === "stopping"); }, [phase, onActiveChange]);

  // Relógio + rotação dos segmentos.
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
      segSecondsRef.current += 1;
      if (segSecondsRef.current >= SEGMENT_SECONDS) rotateSegment();
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Ao sair do app (tela bloqueada, troca de aba), salva o segmento atual na
  // fila imediatamente, para perder o mínimo se o sistema suspender a página.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (phaseRef.current === "recording") {
          rotateSegment();
          setWarning("O app saiu da tela durante a gravação. O celular pode ter suspendido a câmera — confira se a gravação continua.");
        }
      } else if (phaseRef.current === "recording" || phaseRef.current === "paused") {
        void acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    segmentRef.current?.recorder.state !== "inactive" && segmentRef.current?.recorder.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    void wakeLockRef.current?.release().catch(() => undefined);
  }, []);

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      }
    } catch { /* sem suporte ou negado: segue sem bloquear a tela */ }
  }

  async function openCamera(mode = facing) {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera exige HTTPS e um navegador compatível.");
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24 } }
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (phaseRef.current === "recording" || phaseRef.current === "paused") {
          setError("A câmera foi interrompida pelo sistema. A gravação foi encerrada; os trechos já gravados estão salvos.");
          void stopRecording();
        }
      });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      if (phaseRef.current === "off" || phaseRef.current === "done") setPhase("ready");
      return stream;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a câmera.");
      return null;
    }
  }

  function flipCamera() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (streamRef.current) void openCamera(next);
  }

  function queueWrite(job: Parameters<typeof enqueue>[0]) {
    enqueueChain.current = enqueueChain.current
      .then(() => enqueue(job))
      .catch(err => setError(`Não foi possível salvar no aparelho: ${err instanceof Error ? err.message : err}`));
    return enqueueChain.current;
  }

  // Cada segmento é um MediaRecorder próprio: o arquivo resultante é completo
  // (com cabeçalho) e pode ser reproduzido sozinho.
  function startSegment(stream: MediaStream, mimeType: string): Segment {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_800_000 });
    const chunks: Blob[] = [];
    const part = partRef.current++;
    const gravacaoId = gravacaoRef.current!;
    const seg: Segment = { recorder, part, inicio: new Date().toISOString(), activeMs: 0, resumedAt: Date.now(), done: Promise.resolve() };
    seg.done = new Promise<void>(resolve => {
      recorder.ondataavailable = ev => { if (ev.data?.size) chunks.push(ev.data); };
      recorder.onstop = () => {
        if (recorder.state === "inactive" && seg.resumedAt) seg.activeMs += Date.now() - seg.resumedAt;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        if (blob.size > 0) {
          setSegments(n => n + 1);
          void queueWrite({ kind: "segment", userId, gravacaoId, part, blob, inicio: seg.inicio, duracaoMs: seg.activeMs }).then(resolve);
        } else resolve();
      };
    });
    recorder.onerror = () => setError("O navegador informou um erro na gravação.");
    recorder.start();
    segSecondsRef.current = 0;
    return seg;
  }

  function closeSegment(seg: Segment) {
    if (seg.recorder.state === "paused") seg.resumedAt = 0;
    if (seg.recorder.state !== "inactive") seg.recorder.stop();
    return seg.done;
  }

  function rotateSegment() {
    const stream = streamRef.current;
    const old = segmentRef.current;
    if (!stream || !old || phaseRef.current !== "recording") return;
    // Inicia o próximo antes de fechar o atual, para não haver buraco.
    segmentRef.current = startSegment(stream, old.recorder.mimeType || supportedMime()!);
    void closeSegment(old);
  }

  async function startRecording() {
    setError(""); setWarning("");
    try {
      const stream = streamRef.current ?? await openCamera();
      if (!stream) return;
      const mimeType = supportedMime();
      if (!mimeType) throw new Error("Este navegador não oferece um formato de gravação compatível.");

      const gravacaoId = crypto.randomUUID();
      gravacaoRef.current = gravacaoId;
      partRef.current = 0;
      // A sessão entra na fila primeiro: funciona mesmo sem internet no início.
      await queueWrite({ kind: "session", userId, gravacaoId, obraId, inicio: new Date().toISOString(), metadata });

      segmentRef.current = startSegment(stream, mimeType);
      await acquireWakeLock();
      setSeconds(0); setSegments(0); setPhase("recording");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar."); }
  }

  function pauseRecording() {
    const seg = segmentRef.current;
    if (seg?.recorder.state === "recording") {
      seg.recorder.pause();
      seg.activeMs += Date.now() - seg.resumedAt;
      setPhase("paused");
    }
  }
  function resumeRecording() {
    const seg = segmentRef.current;
    if (seg?.recorder.state === "paused") {
      seg.recorder.resume();
      seg.resumedAt = Date.now();
      setPhase("recording");
    }
  }

  async function stopRecording() {
    const seg = segmentRef.current;
    const gravacaoId = gravacaoRef.current;
    if (!seg || !gravacaoId) return;
    setPhase("stopping");
    segmentRef.current = null;
    await closeSegment(seg);
    await queueWrite({ kind: "finalize", userId, gravacaoId, fim: new Date().toISOString() });
    gravacaoRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    await wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    setPhase("done");
  }

  const time = `${seconds >= 3600 ? `${Math.floor(seconds / 3600)}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const cameraOn = phase !== "off" && phase !== "done";
  const busy = phase === "stopping";
  const hint = phase === "recording" ? `Gravando · ${segments} ${segments === 1 ? "trecho salvo" : "trechos salvos"}`
    : phase === "paused" ? "Pausado para privacidade"
    : phase === "stopping" ? "Finalizando…"
    : phase === "done" ? "Gravação encerrada · toque para gravar de novo"
    : "Toque no botão para gravar";

  return <div className="recorder">
    <div className={`viewfinder ${phase}`}>
      <video ref={videoRef} autoPlay muted playsInline/>
      {!cameraOn && <button className="vf-empty" onClick={() => openCamera()}>
        <span className="vf-empty-icon"><Camera size={28}/></span>
        <strong>Abrir câmera</strong>
        <span>Confira o enquadramento antes de gravar</span>
      </button>}
      <div className="vf-top">
        {active
          ? <span className={`rec-pill ${phase}`}><i/>{phase === "recording" ? "REC" : "PAUSADO"} {time}</span>
          : <span className="vf-chip">{LABEL[phase]}</span>}
        <QueueChip queue={queue}/>
      </div>
      {cameraOn && <div className="vf-bottom"><strong>{metadata.job || "Obra"}</strong><span>{metadata.unit}</span></div>}
    </div>

    <div className="rec-bar">
      <div className="rec-side">
        {active
          ? <button className="round-btn" onClick={phase === "paused" ? resumeRecording : pauseRecording} aria-label={phase === "paused" ? "Retomar" : "Pausar (privacidade)"}>
              {phase === "paused" ? <Play size={22}/> : <Pause size={22}/>}
            </button>
          : <button className="round-btn" onClick={flipCamera} disabled={busy} aria-label="Virar câmera"><RefreshCw size={22}/></button>}
        <span>{active ? (phase === "paused" ? "Retomar" : "Pausar") : "Virar"}</span>
      </div>

      <div className="rec-main">
        {active || busy
          ? <button className="rec-button stop" onClick={stopRecording} disabled={busy} aria-label="Encerrar"><span/></button>
          : <button className="rec-button" onClick={startRecording} aria-label="Iniciar gravação"><span/></button>}
        <span>{active || busy ? "Encerrar" : "Gravar"}</span>
      </div>

      <div className="rec-side">
        <span className="rec-count"><b>{segments}</b>trechos</span>
      </div>
    </div>
    <p className="rec-hint">{hint}</p>

    <QueueStatus queue={queue}/>
    {warning && <div className="warning"><AlertTriangle size={17}/>{warning}</div>}
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    <details className="fold">
      <summary>Como funciona a gravação</summary>
      <p className="microcopy">Áudio desativado. Cada trecho de {SEGMENT_SECONDS} s é salvo primeiro no aparelho e enviado à nuvem assim que houver conexão — se a internet cair ou o navegador fechar, o envio continua quando o app for aberto de novo. Mantenha a tela ativa: com o celular bloqueado, o navegador pode parar a câmera. Use “Pausar” em intervalos e chamadas pessoais.</p>
    </details>
  </div>;
}

function QueueChip({ queue }: { queue: QueueSnapshot | null }) {
  if (!queue) return null;
  if (!queue.online) return <span className="vf-chip warn"><WifiOff size={13}/> Offline · {queue.pending}</span>;
  if (queue.pending > 0) return <span className="vf-chip"><CloudUpload size={13}/> {queue.pending}</span>;
  return <span className="vf-chip ok"><CheckCircle2 size={13}/> Na nuvem</span>;
}

function QueueStatus({ queue }: { queue: QueueSnapshot | null }) {
  if (!queue) return null;
  if (!queue.online) {
    return <div className="upload-state amber"><WifiOff size={16}/> Sem conexão · {queue.pending} itens guardados no aparelho ({formatBytes(queue.pendingBytes)})</div>;
  }
  if (queue.pending > 0) {
    return <div className="upload-state">
      <CloudUpload size={16}/>
      {queue.processing ? "Enviando" : "Aguardando envio"} · {queue.pending} itens na fila ({formatBytes(queue.pendingBytes)})
      {queue.lastError && !queue.processing && <>
        <span className="upload-error"> · última falha: {queue.lastError}</span>
        <button className="link-button" onClick={() => void processQueue()}>tentar agora</button>
      </>}
    </div>;
  }
  return <div className="upload-state green sr-only">Tudo enviado para a nuvem</div>;
}
