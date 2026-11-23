"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CircleStop, Play, Pause, RefreshCw, CloudUpload, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type Metadata = { condo: string; unit: string; worker: string; job: string };
type Props = { metadata: Metadata };

export default function CameraRecorder({ metadata }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef<string | null>(null);
  const chunkRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState("Câmera desligada");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (status === "Gravando") timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => { if (timer) clearInterval(timer); };
  }, [status]);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  async function openCamera() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("A câmera exige HTTPS e um navegador compatível.");
      streamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 24 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus("Câmera pronta");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível abrir a câmera."); }
  }

  function supportedMime() {
    return ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      .find(t => MediaRecorder.isTypeSupported(t));
  }

  async function startRecording() {
    setError("");
    try {
      if (!streamRef.current) await openCamera();
      const stream = streamRef.current;
      if (!stream) throw new Error("Abra a câmera antes de gravar.");
      if (!isSupabaseConfigured || !supabase) throw new Error("Configure o Supabase no arquivo .env.local antes de gravar na nuvem.");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Faça login no Supabase antes de iniciar uma gravação real.");

      const { data: session, error: dbError } = await supabase.from("gravacoes").insert({
        obra_id: null,
        profissional_id: auth.user.id,
        status: "iniciada",
        inicio: new Date().toISOString(),
        metadata
      }).select().single();
      if (dbError) throw dbError;
      sessionRef.current = session.id;
      chunkRef.current = 0;
      queueRef.current = Promise.resolve();

      const mimeType = supportedMime();
      if (!mimeType) throw new Error("Este navegador não oferece um formato MediaRecorder compatível.");
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1800000 });
      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) return;
        const part = chunkRef.current++;
        setUploading(true);
        queueRef.current = queueRef.current.then(() => uploadChunk(session.id, part, event.data))
          .catch(err => { setError(err instanceof Error ? err.message : "Falha no envio do segmento."); });
        queueRef.current.finally(() => setUploading(false));
      };
      recorder.onerror = () => setError("O navegador informou um erro na gravação.");
      recorder.start(10000);
      recorderRef.current = recorder;
      setSeconds(0); setPaused(false); setStatus("Gravando");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível iniciar."); }
  }

  async function uploadChunk(sessionId: string, part: number, blob: Blob) {
    if (!supabase) throw new Error("Supabase não configurado.");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${sessionId}/${String(part).padStart(6, "0")}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("obras-videos").upload(path, blob, {
      contentType: blob.type || "application/octet-stream", upsert: false
    });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from("arquivos_video").insert({
      gravacao_id: sessionId, caminho_storage: path, numero_segmento: part, tamanho_bytes: blob.size
    });
    if (rowError) throw rowError;
  }

  function pauseRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") { recorder.pause(); setPaused(true); setStatus("Pausado"); }
  }
  function resumeRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "paused") { recorder.resume(); setPaused(false); setStatus("Gravando"); }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setStatus("Finalizando");
    await new Promise<void>(resolve => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
    await queueRef.current;
    if (supabase && sessionRef.current) {
      const { error: updateError } = await supabase.from("gravacoes").update({
        status: "finalizada", fim: new Date().toISOString()
      }).eq("id", sessionRef.current);
      if (updateError) setError("Vídeo enviado, mas houve erro ao finalizar a sessão no banco.");
    }
    setStatus("Gravação encerrada");
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    recorderRef.current = null;
  }

  const time = `${String(Math.floor(seconds / 3600)).padStart(2,"0")}:${String(Math.floor(seconds / 60) % 60).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;

  return <div className="camera-module">
    <div className="camera-frame">
      <video ref={videoRef} autoPlay muted playsInline/>
      {!streamRef.current && <div className="camera-placeholder"><Camera size={34}/><span>Pré-visualização da câmera</span></div>}
      {(status === "Gravando" || status === "Pausado") && <div className="rec-indicator"><i/>{status === "Gravando" ? "REC" : "PAUSADO"} · {time}</div>}
    </div>
    <div className="camera-meta">
      <div><strong>{metadata.worker}</strong><span>{metadata.job} · Apto. {metadata.unit}</span></div>
      <span className={status === "Gravando" ? "tag green" : "tag"}>{status}</span>
    </div>
    <div className="controls">
      <button className="button secondary" onClick={openCamera} disabled={status === "Gravando" || status === "Pausado"}><Camera size={17}/> Abrir câmera</button>
      <button className="button secondary" onClick={() => setFacing(f => f === "environment" ? "user" : "environment")} disabled={status === "Gravando" || status === "Pausado"}><RefreshCw size={17}/> Virar câmera</button>
      {status !== "Gravando" && status !== "Pausado" && <button className="button primary" onClick={startRecording}><Play size={17}/> Iniciar gravação</button>}
      {status === "Gravando" && <button className="button secondary" onClick={pauseRecording}><Pause size={17}/> Pausar</button>}
      {status === "Pausado" && <button className="button primary" onClick={resumeRecording}><Play size={17}/> Retomar</button>}
      {(status === "Gravando" || status === "Pausado" || status === "Finalizando") && <button className="button danger" onClick={stopRecording} disabled={status === "Finalizando"}><CircleStop size={17}/> Encerrar</button>}
    </div>
    <div className="upload-state"><CloudUpload size={16}/>{uploading ? "Enviando segmento para a nuvem..." : "Upload em segmentos de 10 segundos"} </div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    <p className="microcopy">Áudio desativado. Mantenha a tela ativa durante a gravação. Não bloqueie o celular nem feche o navegador. Se a conexão cair, este protótipo não garante recuperação automática dos segmentos ainda não enviados.</p>
  </div>;
}
