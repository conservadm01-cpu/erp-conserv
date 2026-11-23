"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, RefreshCw, PlayCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { subscribeQueue } from "@/lib/uploadQueue";

type Gravacao = {
  id: string; status: string; inicio: string; fim: string | null;
  metadata: { condo?: string; unit?: string; worker?: string; job?: string };
  trechos: number;
};
type Arquivo = { id: string; caminho_storage: string; numero_segmento: number; tamanho_bytes: number | null; duracao_ms: number | null; inicio_segmento: string | null };

const fmtUnit = (u?: string) => !u ? "—" : /^\d/.test(u) ? `Apto. ${u}` : u;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

type Props = { obraId?: string; title?: string; eyebrow?: string; showWorker?: boolean };

export default function RecordingHistory({ obraId, title = "Minhas gravações", eyebrow = "HISTÓRICO", showWorker = false }: Props) {
  const [items, setItems] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError("");
    let q = supabase.from("gravacoes").select("id,status,inicio,fim,metadata").order("inicio", { ascending: false }).limit(30);
    if (obraId) q = q.eq("obra_id", obraId);
    const { data, error } = await q;
    if (error) { setLoading(false); setError(error.message); return; }
    const rows = (data ?? []) as Omit<Gravacao, "trechos">[];
    const counts: Record<string, number> = {};
    if (rows.length) {
      const { data: segs, error: segErr } = await supabase.from("arquivos_video").select("gravacao_id").in("gravacao_id", rows.map(r => r.id));
      if (segErr) { setLoading(false); setError(segErr.message); return; }
      (segs ?? []).forEach((s: { gravacao_id: string }) => { counts[s.gravacao_id] = (counts[s.gravacao_id] ?? 0) + 1; });
    }
    setLoading(false);
    setItems(rows.map(r => ({ ...r, trechos: counts[r.id] ?? 0 })));
  }, [obraId]);

  useEffect(() => { void load(); }, [load]);

  // Histórico de uma obra (proprietário/administração): as gravações vêm de
  // outro aparelho, então atualiza periodicamente.
  useEffect(() => {
    if (!obraId) return;
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [obraId, load]);

  // Recarrega quando a fila termina de enviar algo.
  const lastPending = useRef<number | null>(null);
  const sentSinceLoad = useRef(false);
  useEffect(() => subscribeQueue(q => {
    if (lastPending.current !== null && q.pending < lastPending.current) sentSinceLoad.current = true;
    lastPending.current = q.pending;
    if (sentSinceLoad.current && !q.processing) { sentSinceLoad.current = false; void load(); }
  }), [load]);

  return <div className="history">
    <div className="section-head">
      <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>
      <button className="button secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Atualizar</button>
    </div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    {!error && items.length === 0 && !loading && <div className="empty-state compact"><History size={28}/><strong>Nenhuma gravação ainda</strong><p>As gravações enviadas aparecem aqui.</p></div>}
    <ul className="history-list">
      {items.map(g => {
        const count = g.trechos;
        const open = openId === g.id;
        return <li key={g.id} className={open ? "open" : ""}>
          <button className="history-row" onClick={() => setOpenId(open ? null : g.id)}>
            <PlayCircle size={22}/>
            <div>
              <strong>{g.metadata?.job || "Gravação"} · {fmtUnit(g.metadata?.unit)}</strong>
              <span>{showWorker && g.metadata?.worker ? `${g.metadata.worker} · ` : ""}{fmtDate(g.inicio)}{g.fim ? ` até ${new Date(g.fim).toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : ""} · {count} trechos</span>
            </div>
            <span className={g.status === "finalizada" ? "tag green" : "tag amber"}>{g.status === "finalizada" ? "Finalizada" : "Em andamento"}</span>
            {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          {open && <SegmentPlayer gravacaoId={g.id}/>}
        </li>;
      })}
    </ul>
  </div>;
}

function SegmentPlayer({ gravacaoId }: { gravacaoId: string }) {
  const [files, setFiles] = useState<Arquivo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplay = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from("arquivos_video")
        .select("id,caminho_storage,numero_segmento,tamanho_bytes,duracao_ms,inicio_segmento")
        .eq("gravacao_id", gravacaoId).order("numero_segmento");
      if (cancelled) return;
      if (error) { setError(error.message); return; }
      const list = (data ?? []) as Arquivo[];
      setFiles(list);
      if (list.length === 0) return;
      // URLs assinadas e temporárias (1 h): o bucket continua privado.
      const { data: signed, error: signError } = await supabase.storage.from("obras-videos")
        .createSignedUrls(list.map(f => f.caminho_storage), 3600);
      if (cancelled) return;
      if (signError) { setError(signError.message); return; }
      const map: Record<string, string> = {};
      signed?.forEach(s => { if (s.signedUrl && s.path) map[s.path] = s.signedUrl; });
      setUrls(map);
    })();
    return () => { cancelled = true; };
  }, [gravacaoId]);

  useEffect(() => {
    if (autoplay.current) void videoRef.current?.play().catch(() => undefined);
  }, [index]);

  if (error) return <div className="error"><AlertTriangle size={17}/>{error}</div>;
  if (files.length === 0) return <p className="microcopy">Nenhum trecho enviado ainda para esta gravação.</p>;

  const current = files[index];
  const total = files.reduce((n, f) => n + (f.duracao_ms ?? 0), 0);
  return <div className="player">
    <div className="camera-frame">
      {urls[current.caminho_storage]
        ? <video ref={videoRef} key={current.id} src={urls[current.caminho_storage]} controls playsInline muted
            onPlay={() => { autoplay.current = true; }}
            onEnded={() => { if (index < files.length - 1) setIndex(index + 1); else autoplay.current = false; }}/>
        : <div className="camera-placeholder"><span>Carregando…</span></div>}
    </div>
    <div className="player-meta">
      <span>Trecho {index + 1} de {files.length}{current.inicio_segmento ? ` · ${new Date(current.inicio_segmento).toLocaleTimeString("pt-BR")}` : ""}</span>
      {total > 0 && <span>Total gravado: {fmtDuration(total)}</span>}
    </div>
    <div className="segment-strip">
      {files.map((f, i) => <button key={f.id} className={i === index ? "active" : ""} onClick={() => { autoplay.current = true; setIndex(i); }}>{i + 1}</button>)}
    </div>
  </div>;
}
