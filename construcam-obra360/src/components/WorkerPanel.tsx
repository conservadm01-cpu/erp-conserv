"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertTriangle, HardHat, MapPin } from "lucide-react";
import CameraRecorder from "@/components/CameraRecorder";
import TermoCiencia, { useTermo } from "@/components/TermoCiencia";
import RecordingHistory from "@/components/RecordingHistory";
import { obrasPorIds } from "@/lib/data";
import { nomeUnidade, type ObraDetalhada } from "@/types";

export type WorkerView = "gravar" | "historico";

export default function WorkerPanel({ user, obraIds, view }: { user: User; obraIds: string[]; view: WorkerView }) {
  const [obras, setObras] = useState<ObraDetalhada[]>([]);
  const [obraId, setObraId] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const onActiveChange = useCallback((a: boolean) => setRecording(a), []);
  const termo = useTermo(user.id);

  useEffect(() => {
    obrasPorIds(obraIds)
      .then(list => {
        setObras(list);
        setObraId(cur => cur || list.find(o => o.status === "ativa")?.id || "");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoaded(true));
  }, [obraIds]);

  const ativas = obras.filter(o => o.status === "ativa");
  const obra = obras.find(o => o.id === obraId);

  // O gravador fica montado mesmo na aba Histórico, para não interromper uma gravação.
  return <div className="screen">
    <div hidden={view !== "gravar"}>
      {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
      {termo.error && <div className="error"><AlertTriangle size={17}/>{termo.error}</div>}
      {loaded && !error && ativas.length === 0 && <div className="empty-state"><HardHat size={30}/><strong>Nenhuma obra ativa</strong>
        <p>Você não está vinculado a nenhuma obra em andamento. Peça à administração do condomínio para incluir o seu e-mail ({user.email}) na obra.</p></div>}
      {ativas.length > 0 && !termo.loading && !termo.error && !termo.aceito && <TermoCiencia versao={termo.versao} onAceito={termo.marcarAceito}/>}
      {ativas.length > 0 && termo.aceito && <>
        <label className={`obra-picker ${recording ? "locked" : ""}`}>
          <MapPin size={18}/>
          <span>
            <small>{recording ? "Gravando em" : "Obra"}</small>
            <strong>{obra ? `${nomeUnidade(obra.unidade)} · ${obra.descricao || "Obra"}` : "Escolha a obra"}</strong>
            {obra?.condominio && <em>{obra.condominio.nome}</em>}
          </span>
          {ativas.length > 1 && <select aria-label="Obra" value={obraId} onChange={e => setObraId(e.target.value)} disabled={recording}>
            {ativas.map(o => <option key={o.id} value={o.id}>{o.condominio?.nome} · {nomeUnidade(o.unidade)} · {o.descricao || "Obra"}</option>)}
          </select>}
        </label>
        {obra && <CameraRecorder
          key={obra.id}
          obraId={obra.id}
          userId={user.id}
          onActiveChange={onActiveChange}
          metadata={{ condo: obra.condominio?.nome ?? "", unit: nomeUnidade(obra.unidade), worker: user.email ?? "", job: obra.descricao ?? "" }}
        />}
      </>}
    </div>
    {view === "historico" && <section className="card"><RecordingHistory/></section>}
  </div>;
}
