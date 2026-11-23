"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Home, HardHat } from "lucide-react";
import { AcessosList, OcorrenciasPainel } from "@/components/Auditoria";
import LiveView from "@/components/LiveView";
import RecordingHistory from "@/components/RecordingHistory";
import { supabase } from "@/lib/supabase";
import { check, obrasPorUnidades } from "@/lib/data";
import { nomeUnidade, type Membro, type ObraDetalhada } from "@/types";

export type OwnerView = "acompanhar" | "ocorrencias" | "acessos";

export default function OwnerPanel({ unidadeIds, view }: { unidadeIds: string[]; view: OwnerView }) {
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
  const nomes = Object.fromEntries(obras.map(o => [o.id, `${nomeUnidade(o.unidade)} · ${o.descricao || "Obra"}`]));

  return <div className="screen">
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    {loaded && !error && obras.length === 0 && <div className="empty-state"><Home size={30}/><strong>Nenhuma obra cadastrada</strong>
      <p>Quando a administração do condomínio registrar uma obra na sua unidade, ela aparecerá aqui.</p></div>}

    {view === "acompanhar" && <>
      {ativas.map(o => <ObraCard key={o.id} obra={o} equipe={equipe.filter(m => m.obra_id === o.id)}/>)}
      {encerradas.length > 0 && <>
        <h3 className="list-title">Obras encerradas</h3>
        {encerradas.map(o => <ObraCard key={o.id} obra={o} equipe={equipe.filter(m => m.obra_id === o.id)}/>)}
      </>}
    </>}

    {view === "ocorrencias" && obras.length > 0 && <section className="card">
      <div className="card-head"><div><div className="eyebrow">Sua unidade</div><h2>Ocorrências</h2></div></div>
      <p className="microcopy">Para registrar uma ocorrência, abra a gravação em “Acompanhar” e toque em “Registrar ocorrência neste trecho”.</p>
      <OcorrenciasPainel obraIds={obras.map(o => o.id)} nomes={nomes} canResolve={false}/>
    </section>}

    {view === "acessos" && obras.length > 0 && <section className="card">
      <div className="card-head"><div><div className="eyebrow">Transparência</div><h2>Quem assistiu</h2></div></div>
      <p className="microcopy">Cada vez que alguém abre um vídeo da sua obra, fica registrado aqui.</p>
      <AcessosList obraIds={obras.map(o => o.id)} nomes={nomes}/>
    </section>}
  </div>;
}

function ObraCard({ obra, equipe }: { obra: ObraDetalhada; equipe: Membro[] }) {
  const [live, setLive] = useState(false);
  const ativa = obra.status === "ativa";
  return <section className="card obra-card">
    <div className="card-head">
      <div>
        <div className="eyebrow">{obra.condominio?.nome} · {nomeUnidade(obra.unidade)}</div>
        <h2>{obra.descricao || "Obra"}</h2>
        {obra.empresa && <p className="sub">{obra.empresa}</p>}
      </div>
      <span className={!ativa ? "tag" : live ? "tag live" : "tag"}>{!ativa ? "Encerrada" : live ? "Gravando agora" : "Sem gravação agora"}</span>
    </div>
    {equipe.length > 0 && <p className="team"><HardHat size={14}/> {equipe.map(m => m.nome || m.email).join(", ")}</p>}
    {ativa && <LiveView obraId={obra.id} onLiveChange={setLive}/>}
    <RecordingHistory obraId={obra.id} eyebrow="Histórico" title="Gravações" showWorker canReport/>
  </section>;
}
