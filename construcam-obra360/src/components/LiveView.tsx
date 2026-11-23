"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, VideoOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

// "Quase ao vivo": sem WebRTC, acompanha a gravação em andamento tocando o
// trecho mais recente que chegou à nuvem e emendando os seguintes.
// Atraso típico: 10–30 s (duração do trecho + envio).

type Seg = { id: string; caminho_storage: string; numero_segmento: number; created_at: string };
type Grav = { id: string; inicio: string; metadata: { worker?: string } };

const POLL_MS = 8000;
const LIVE_WINDOW_MS = 90_000;

export default function LiveView({ obraId, onLiveChange }: { obraId: string; onLiveChange?: (live: boolean) => void }) {
  const [grav, setGrav] = useState<Grav | null>(null);
  const [lastAt, setLastAt] = useState<number>(0);
  const [playlist, setPlaylist] = useState<Seg[]>([]);
  const [idx, setIdx] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [url, setUrl] = useState("");
  const [now, setNow] = useState(Date.now());
  const gravRef = useRef<string | null>(null);
  const lastNum = useRef(-1);

  useEffect(() => {
    let stop = false;
    async function poll() {
      if (!supabase) return;
      const { data: gs } = await supabase.from("gravacoes").select("id,inicio,metadata")
        .eq("obra_id", obraId).eq("status", "iniciada").order("inicio", { ascending: false }).limit(1);
      if (stop) return;
      const g = (gs?.[0] ?? null) as Grav | null;
      if (!g) { gravRef.current = null; setGrav(null); return; }
      if (g.id !== gravRef.current) {
        // Nova gravação: começa pelo trecho mais recente.
        gravRef.current = g.id; lastNum.current = -1;
        const { data: last } = await supabase.from("arquivos_video").select("id,caminho_storage,numero_segmento,created_at")
          .eq("gravacao_id", g.id).order("numero_segmento", { ascending: false }).limit(1);
        if (stop) return;
        const segs = (last ?? []) as Seg[];
        setGrav(g); setPlaylist(segs); setIdx(0); setWaiting(false);
        if (segs[0]) { lastNum.current = segs[0].numero_segmento; setLastAt(Date.parse(segs[0].created_at)); }
        return;
      }
      const { data: novos } = await supabase.from("arquivos_video").select("id,caminho_storage,numero_segmento,created_at")
        .eq("gravacao_id", g.id).gt("numero_segmento", lastNum.current).order("numero_segmento").limit(30);
      if (stop || !novos?.length) return;
      const segs = novos as Seg[];
      lastNum.current = segs[segs.length - 1].numero_segmento;
      setLastAt(Date.parse(segs[segs.length - 1].created_at));
      setPlaylist(p => [...p, ...segs]);
    }
    void poll();
    const t = setInterval(() => { void poll(); setNow(Date.now()); }, POLL_MS);
    return () => { stop = true; clearInterval(t); };
  }, [obraId]);

  // Chegou trecho novo enquanto o player esperava: avança.
  useEffect(() => {
    if (waiting && idx < playlist.length - 1) { setWaiting(false); setIdx(i => i + 1); }
  }, [playlist.length, waiting, idx]);

  const current = playlist[idx];
  useEffect(() => {
    setUrl("");
    if (!current || !supabase) return;
    let cancelled = false;
    supabase.storage.from("obras-videos").createSignedUrl(current.caminho_storage, 600)
      .then(({ data }) => { if (!cancelled && data?.signedUrl) setUrl(data.signedUrl); });
    return () => { cancelled = true; };
  }, [current]);

  const live = Boolean(grav && lastAt && now - lastAt < LIVE_WINDOW_MS);
  useEffect(() => { onLiveChange?.(live); }, [live, onLiveChange]);

  if (!grav || !current) {
    return <div className="live-box idle"><VideoOff size={22}/><div><strong>Nenhuma gravação em andamento</strong><p>Quando o profissional iniciar a gravação nesta obra, as imagens aparecem aqui com alguns segundos de atraso.</p></div></div>;
  }

  return <div className="live-box">
    <div className="camera-frame">
      {url && <video key={current.id} src={url} autoPlay muted playsInline controls
        onEnded={() => { if (idx < playlist.length - 1) setIdx(idx + 1); else setWaiting(true); }}/>}
      <div className={live ? "rec-indicator live" : "rec-indicator"}><i/>{live ? "QUASE AO VIVO" : "SEM SINAL RECENTE"}</div>
      {waiting && <div className="live-waiting">Aguardando o próximo trecho…</div>}
    </div>
    <div className="player-meta">
      <span><Radio size={13}/> {grav.metadata?.worker || "Profissional"} · desde {new Date(grav.inicio).toLocaleTimeString("pt-BR", { timeStyle: "short" })}</span>
      <span>Trecho de {new Date(current.created_at).toLocaleTimeString("pt-BR")}</span>
    </div>
  </div>;
}
