"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, RefreshCw, PlayCircle, AlertTriangle, ChevronDown, ChevronUp, Flag, ShieldCheck, Clock3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { subscribeQueue } from "@/lib/uploadQueue";
import { assinarTrechos, diasParaExpirar } from "@/lib/videoUrls";
import type { Ocorrencia } from "@/types";

type Gravacao = {
  id: string; obra_id: string | null; status: string; inicio: string; fim: string | null;
  metadata: { condo?: string; unit?: string; worker?: string; job?: string };
  trechos: number; ocorrencias: number;
};
type Arquivo = { id: string; numero_segmento: number; duracao_ms: number | null; inicio_segmento: string | null };

const fmtUnit = (u?: string) => !u ? "—" : /^\d/.test(u) ? `Apto. ${u}` : u;
const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}
export const OCORRENCIA_COLS = "id,gravacao_id,obra_id,descricao,segmento_inicio,segmento_fim,status,preservada,resolucao,solicitado_email,created_at,resolvido_em";
export const faixa = (o: Pick<Ocorrencia, "segmento_inicio" | "segmento_fim">) =>
  o.segmento_inicio == null ? "Gravação inteira"
    : (o.segmento_fim ?? o.segmento_inicio) === o.segmento_inicio ? `Trecho ${o.segmento_inicio + 1}`
      : `Trechos ${o.segmento_inicio + 1}–${(o.segmento_fim ?? o.segmento_inicio) + 1}`;

type Props = { obraId?: string; title?: string; eyebrow?: string; showWorker?: boolean; canReport?: boolean };

export default function RecordingHistory({ obraId, title = "Minhas gravações", eyebrow = "HISTÓRICO", showWorker = false, canReport = false }: Props) {
  const [items, setItems] = useState<Gravacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError("");
    let q = supabase.from("gravacoes").select("id,obra_id,status,inicio,fim,metadata").order("inicio", { ascending: false }).limit(30);
    if (obraId) q = q.eq("obra_id", obraId);
    const { data, error } = await q;
    if (error) { setLoading(false); setError(error.message); return; }
    const rows = (data ?? []) as Omit<Gravacao, "trechos" | "ocorrencias">[];
    const segs: Record<string, number> = {}, ocs: Record<string, number> = {};
    if (rows.length) {
      const ids = rows.map(r => r.id);
      const [a, o] = await Promise.all([
        supabase.from("arquivos_video").select("gravacao_id").in("gravacao_id", ids),
        supabase.from("ocorrencias").select("gravacao_id").in("gravacao_id", ids)
      ]);
      if (a.error) { setLoading(false); setError(a.error.message); return; }
      (a.data ?? []).forEach((s: { gravacao_id: string }) => { segs[s.gravacao_id] = (segs[s.gravacao_id] ?? 0) + 1; });
      (o.data ?? []).forEach((s: { gravacao_id: string }) => { ocs[s.gravacao_id] = (ocs[s.gravacao_id] ?? 0) + 1; });
    }
    setLoading(false);
    setItems(rows.map(r => ({ ...r, trechos: segs[r.id] ?? 0, ocorrencias: ocs[r.id] ?? 0 })));
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
        const open = openId === g.id;
        const expirada = g.status === "expirada";
        const dias = diasParaExpirar(g.inicio);
        return <li key={g.id} className={open ? "open" : ""}>
          <button className="history-row" onClick={() => setOpenId(open ? null : g.id)}>
            <PlayCircle size={22}/>
            <div>
              <strong>{g.metadata?.job || "Gravação"} · {fmtUnit(g.metadata?.unit)}</strong>
              <span>{showWorker && g.metadata?.worker ? `${g.metadata.worker} · ` : ""}{fmtDate(g.inicio)}{g.fim ? ` até ${new Date(g.fim).toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : ""} · {g.trechos} trechos
                {g.ocorrencias > 0 && <em className="flag-count"> · <Flag size={11}/> {g.ocorrencias} {g.ocorrencias === 1 ? "ocorrência" : "ocorrências"}</em>}
                {!expirada && g.trechos > 0 && <em className="expira"> · apaga em {dias} {dias === 1 ? "dia" : "dias"}</em>}
              </span>
            </div>
            <span className={expirada ? "tag" : g.status === "finalizada" ? "tag green" : "tag amber"}>
              {expirada ? "Expirada" : g.status === "finalizada" ? "Finalizada" : "Em andamento"}
            </span>
            {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          {open && <SegmentPlayer gravacao={g} canReport={canReport} onChanged={load}/>}
        </li>;
      })}
    </ul>
  </div>;
}

function SegmentPlayer({ gravacao, canReport, onChanged }: { gravacao: Gravacao; canReport: boolean; onChanged: () => void }) {
  const [files, setFiles] = useState<Arquivo[]>([]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reporting, setReporting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplay = useRef(false);

  const loadOcorrencias = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("ocorrencias").select(OCORRENCIA_COLS).eq("gravacao_id", gravacao.id).order("created_at");
    setOcorrencias((data ?? []) as Ocorrencia[]);
  }, [gravacao.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from("arquivos_video")
        .select("id,numero_segmento,duracao_ms,inicio_segmento")
        .eq("gravacao_id", gravacao.id).order("numero_segmento");
      if (cancelled) return;
      if (error) { setError(error.message); return; }
      const list = (data ?? []) as Arquivo[];
      setFiles(list); setLoaded(true);
      void loadOcorrencias();
      if (list.length === 0) return;
      try {
        // Links emitidos pelo servidor do app, que registra quem assistiu.
        const signed = await assinarTrechos(gravacao.id, "historico");
        if (cancelled) return;
        const map: Record<number, string> = {};
        signed.forEach(s => { if (s.url) map[s.numero_segmento] = s.url; });
        setUrls(map);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
    })();
    return () => { cancelled = true; };
  }, [gravacao.id, loadOcorrencias]);

  useEffect(() => {
    if (autoplay.current) void videoRef.current?.play().catch(() => undefined);
  }, [index]);

  const flagged = (n: number) => ocorrencias.some(o => o.preservada && (o.segmento_inicio == null || (n >= o.segmento_inicio && n <= (o.segmento_fim ?? o.segmento_inicio))));
  const jump = (n: number | null) => { const i = files.findIndex(f => f.numero_segmento === (n ?? files[0]?.numero_segmento)); if (i >= 0) { autoplay.current = true; setIndex(i); } };

  if (!loaded && !error) return <p className="microcopy pad">Carregando…</p>;
  if (files.length === 0) {
    return <div className="player">
      {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
      <p className="microcopy">{gravacao.status === "expirada"
        ? "Os vídeos desta gravação foram apagados pela retenção de 60 dias. Trechos marcados em ocorrências são preservados."
        : "Nenhum trecho enviado ainda para esta gravação."}</p>
      <OcorrenciaList ocorrencias={ocorrencias} onJump={jump}/>
    </div>;
  }

  const current = files[index];
  const total = files.reduce((n, f) => n + (f.duracao_ms ?? 0), 0);
  return <div className="player">
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    <div className="camera-frame">
      {urls[current.numero_segmento]
        ? <video ref={videoRef} key={current.id} src={urls[current.numero_segmento]} controls playsInline muted
            onPlay={() => { autoplay.current = true; }}
            onEnded={() => { if (index < files.length - 1) setIndex(index + 1); else autoplay.current = false; }}/>
        : <div className="camera-placeholder"><span>{error ? "Vídeo indisponível" : "Carregando…"}</span></div>}
      {flagged(current.numero_segmento) && <div className="rec-indicator flagged"><ShieldCheck size={12}/> PRESERVADO</div>}
    </div>
    <div className="player-meta">
      <span>Trecho {index + 1} de {files.length}{current.inicio_segmento ? ` · ${new Date(current.inicio_segmento).toLocaleTimeString("pt-BR")}` : ""}</span>
      {total > 0 && <span>Total gravado: {fmtDuration(total)}</span>}
    </div>
    <div className="segment-strip">
      {files.map((f, i) => <button key={f.id} className={[i === index ? "active" : "", flagged(f.numero_segmento) ? "flag" : ""].join(" ")}
        title={flagged(f.numero_segmento) ? "Trecho preservado por ocorrência" : undefined}
        onClick={() => { autoplay.current = true; setIndex(i); }}>{i + 1}</button>)}
    </div>
    {canReport && !reporting && <div className="controls top-gap">
      <button className="button secondary" onClick={() => { videoRef.current?.pause(); setReporting(true); }}><Flag size={16}/> Registrar ocorrência neste trecho</button>
    </div>}
    {reporting && <OcorrenciaForm gravacao={gravacao} files={files} index={index}
      onCancel={() => setReporting(false)}
      onSaved={() => { setReporting(false); void loadOcorrencias(); onChanged(); }}/>}
    <OcorrenciaList ocorrencias={ocorrencias} onJump={jump}/>
    <p className="microcopy"><Clock3 size={11}/> Os vídeos são apagados em {diasParaExpirar(gravacao.inicio)} dias (retenção de 60 dias), exceto os trechos preservados por ocorrência. Cada visualização fica registrada.</p>
  </div>;
}

function OcorrenciaForm({ gravacao, files, index, onCancel, onSaved }: {
  gravacao: Gravacao; files: Arquivo[]; index: number; onCancel: () => void; onSaved: () => void;
}) {
  // Por padrão preserva o trecho atual e os vizinhos (≈30 s de contexto).
  const [ini, setIni] = useState(Math.max(0, index - 1));
  const [fim, setFim] = useState(Math.min(files.length - 1, index + 1));
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    const a = files[Math.min(ini, fim)], b = files[Math.max(ini, fim)];
    const { data: s } = await supabase.auth.getSession();
    const { error } = await supabase.from("ocorrencias").insert({
      gravacao_id: gravacao.id, obra_id: gravacao.obra_id, descricao: descricao.trim(),
      segmento_inicio: a.numero_segmento, segmento_fim: b.numero_segmento,
      inicio_trecho: a.inicio_segmento, fim_trecho: b.inicio_segmento,
      solicitado_por: s.session?.user.id, solicitado_email: s.session?.user.email?.toLowerCase()
    });
    setBusy(false);
    if (error) setError(/row-level security/i.test(error.message) ? "Sem permissão para registrar ocorrência nesta obra." : error.message);
    else onSaved();
  }

  const opts = files.map((f, i) => <option key={f.id} value={i}>Trecho {i + 1}{f.inicio_segmento ? ` (${new Date(f.inicio_segmento).toLocaleTimeString("pt-BR")})` : ""}</option>);
  return <form className="ocorrencia-form" onSubmit={salvar}>
    <strong><Flag size={15}/> Nova ocorrência</strong>
    <p className="microcopy">Os trechos escolhidos ficam <b>preservados</b> (não são apagados pela retenção) até a administração liberar.</p>
    <div className="form-grid">
      <label>Do<select value={ini} onChange={e => setIni(+e.target.value)}>{opts}</select></label>
      <label>Até<select value={fim} onChange={e => setFim(+e.target.value)}>{opts}</select></label>
    </div>
    <label className="block-label">O que aconteceu?
      <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} required maxLength={1000}
        placeholder="Ex.: Profissional quebrou parte do piso da sala ao mover a betoneira."/>
    </label>
    <div className="controls">
      <button className="button primary" disabled={busy || !descricao.trim()}><Flag size={16}/> Registrar e preservar</button>
      <button className="button secondary" type="button" onClick={onCancel}>Cancelar</button>
    </div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
  </form>;
}

function OcorrenciaList({ ocorrencias, onJump }: { ocorrencias: Ocorrencia[]; onJump: (n: number | null) => void }) {
  if (!ocorrencias.length) return null;
  return <ul className="ocorrencias">
    {ocorrencias.map(o => <li key={o.id}>
      <button className="link-button" onClick={() => onJump(o.segmento_inicio)}><Flag size={12}/> {faixa(o)}</button>
      <span className={o.status === "aberta" ? "tag amber" : "tag"}>{o.status === "aberta" ? "Aberta" : "Resolvida"}</span>
      {o.preservada && <span className="tag green"><ShieldCheck size={11}/> Preservado</span>}
      <p>{o.descricao}</p>
      <small>{o.solicitado_email ?? "—"} · {fmtDate(o.created_at)}{o.resolucao ? ` · Resolução: ${o.resolucao}` : ""}</small>
    </li>)}
  </ul>;
}
