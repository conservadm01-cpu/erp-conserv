"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AlertTriangle, HardHat } from "lucide-react";
import CameraRecorder from "@/components/CameraRecorder";
import RecordingHistory from "@/components/RecordingHistory";
import { obrasPorIds } from "@/lib/data";
import { nomeUnidade, type ObraDetalhada } from "@/types";

export default function WorkerPanel({ user, obraIds }: { user: User; obraIds: string[] }) {
  const [obras, setObras] = useState<ObraDetalhada[]>([]);
  const [obraId, setObraId] = useState("");
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const onActiveChange = useCallback((a: boolean) => setRecording(a), []);

  useEffect(() => {
    obrasPorIds(obraIds)
      .then(list => {
        setObras(list);
        setObraId(cur => cur || list.find(o => o.status === "ativa")?.id || "");
      })
      .catch(e => setError(e.message));
  }, [obraIds]);

  const ativas = obras.filter(o => o.status === "ativa");
  const obra = obras.find(o => o.id === obraId);

  return <>
    <section className="content">
      <div className="section-head">
        <div><div className="eyebrow">ÁREA DO PROFISSIONAL</div><h2>Registrar execução</h2></div>
        <span className="tag green">{ativas.length} {ativas.length === 1 ? "obra ativa" : "obras ativas"}</span>
      </div>
      {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
      {!error && ativas.length === 0 && <div className="empty-state compact"><HardHat size={28}/><strong>Nenhuma obra ativa</strong>
        <p>Você não está vinculado a nenhuma obra em andamento. Peça à administração do condomínio para incluir o seu e-mail ({user.email}) na obra.</p></div>}
      {ativas.length > 0 && <>
        <div className="form-grid single">
          <label>Obra
            <select value={obraId} onChange={e => setObraId(e.target.value)} disabled={recording}>
              {ativas.map(o => <option key={o.id} value={o.id}>{o.condominio?.nome} · {nomeUnidade(o.unidade)} · {o.descricao || "Obra"}</option>)}
            </select>
          </label>
        </div>
        {obra && <CameraRecorder
          key={obra.id}
          obraId={obra.id}
          userId={user.id}
          onActiveChange={onActiveChange}
          metadata={{ condo: obra.condominio?.nome ?? "", unit: nomeUnidade(obra.unidade), worker: user.email ?? "", job: obra.descricao ?? "" }}
        />}
      </>}
    </section>
    <section className="content"><RecordingHistory/></section>
  </>;
}
