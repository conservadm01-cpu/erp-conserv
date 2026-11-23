"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Home, HardHat } from "lucide-react";
import LiveView from "@/components/LiveView";
import RecordingHistory from "@/components/RecordingHistory";
import { supabase } from "@/lib/supabase";
import { check, obrasPorUnidades } from "@/lib/data";
import { nomeUnidade, type Membro, type ObraDetalhada } from "@/types";

export default function OwnerPanel({ unidadeIds }: { unidadeIds: string[] }) {
  const [obras, setObras] = useState<ObraDetalhada[]>([]);
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const list = await obrasPorUnidades(unidadeIds);
      setObras(list);
      if (list.length && supabase) {
        setEquipe(check(await supabase.from("membros").select("id,email,nome,papel,obra_id")
          .eq("papel", "profissional").in("obra_id", list.map(o => o.id))) as Membro[]);
      }
    })().catch(e => setError(e.message)).finally(() => setLoaded(true));
  }, [unidadeIds]);

  const ativas = obras.filter(o => o.status === "ativa");
  const encerradas = obras.filter(o => o.status !== "ativa");

  return <>
    <section className="content">
      <div className="section-head">
        <div><div className="eyebrow">ÁREA DO PROPRIETÁRIO</div><h2>Acompanhamento da obra</h2></div>
        <span className="tag">{unidadeIds.length} {unidadeIds.length === 1 ? "unidade" : "unidades"}</span>
      </div>
      {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
      {loaded && !error && obras.length === 0 && <div className="empty-state compact"><Home size={28}/><strong>Nenhuma obra cadastrada</strong>
        <p>Quando a administração do condomínio registrar uma obra na sua unidade, ela aparecerá aqui.</p></div>}
      {ativas.map(o => <ObraCard key={o.id} obra={o} equipe={equipe.filter(m => m.obra_id === o.id)}/>)}
    </section>
    {encerradas.length > 0 && <section className="content">
      <div className="section-head"><div><div className="eyebrow">ARQUIVO</div><h2>Obras encerradas</h2></div></div>
      {encerradas.map(o => <ObraCard key={o.id} obra={o} equipe={equipe.filter(m => m.obra_id === o.id)}/>)}
    </section>}
  </>;
}

function ObraCard({ obra, equipe }: { obra: ObraDetalhada; equipe: Membro[] }) {
  const [live, setLive] = useState(false);
  return <div className="obra-card">
    <div className="owner-card">
      <div className="owner-icon"><Home size={22}/></div>
      <div>
        <strong>{obra.condominio?.nome} · {nomeUnidade(obra.unidade)}</strong>
        <p>{obra.descricao || "Obra"}{obra.empresa ? ` · ${obra.empresa}` : ""}</p>
      </div>
      <span className={obra.status !== "ativa" ? "tag" : live ? "tag green" : "tag amber"}>
        {obra.status !== "ativa" ? "Encerrada" : live ? "Gravando agora" : "Sem gravação agora"}
      </span>
    </div>
    {equipe.length > 0 && <p className="team"><HardHat size={14}/> Profissionais: {equipe.map(m => m.nome || m.email).join(", ")}</p>}
    {obra.status === "ativa" && <LiveView obraId={obra.id} onLiveChange={setLive}/>}
    <RecordingHistory obraId={obra.id} eyebrow="HISTÓRICO DA OBRA" title="Gravações" showWorker/>
  </div>;
}
