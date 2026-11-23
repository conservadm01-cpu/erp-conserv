"use client";

import { useEffect, useState } from "react";
import { FileCheck2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// MODELO — revise com assessoria jurídica (LGPD) antes de usar em piloto real.
// Ao mudar o texto, mude também termo_versao_atual() no banco (004): todos
// terão de aceitar de novo.
export const TERMO_ITENS = [
  "A execução dos serviços nesta obra será gravada em vídeo, sem áudio, pela câmera do celular, durante o horário de trabalho.",
  "A finalidade é documentar a execução da reforma, proteger o profissional, o proprietário e o condomínio, e esclarecer eventuais ocorrências.",
  "As imagens podem ser vistas pelo proprietário da unidade e pela administração do condomínio. Cada visualização fica registrada.",
  "Os vídeos são guardados por 60 dias e então apagados, exceto trechos ligados a uma ocorrência registrada, que ficam preservados até sua resolução.",
  "Posso pausar a gravação a qualquer momento por privacidade (intervalos, refeições, chamadas pessoais). Não devo gravar banheiros, vestiários ou áreas íntimas.",
  "Posso pedir informações sobre as gravações em que apareço à administração do condomínio."
];

export function useTermo(userId: string) {
  const [state, setState] = useState<{ loading: boolean; aceito: boolean; versao: string; error: string }>({ loading: true, aceito: false, versao: "", error: "" });
  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: versao, error: vErr } = await supabase.rpc("termo_versao_atual");
      if (vErr) { setState({ loading: false, aceito: false, versao: "", error: /does not exist|schema cache/i.test(vErr.message) ? "O banco ainda não tem o termo de ciência. Rode supabase/004_termo_ocorrencias_auditoria.sql." : vErr.message }); return; }
      const { data, error } = await supabase.from("termos_aceite").select("id").eq("user_id", userId).eq("versao", versao as string).limit(1);
      setState({ loading: false, aceito: Boolean(data?.length), versao: versao as string, error: error?.message ?? "" });
    })();
  }, [userId]);
  return { ...state, marcarAceito: () => setState(s => ({ ...s, aceito: true })) };
}

export default function TermoCiencia({ versao, onAceito }: { versao: string; onAceito: () => void }) {
  const [marcado, setMarcado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function aceitar() {
    if (!supabase) return;
    setBusy(true); setError("");
    const { error } = await supabase.from("termos_aceite").insert({ versao, user_agent: navigator.userAgent.slice(0, 300) });
    setBusy(false);
    if (error && !/duplicate key/i.test(error.message)) setError(error.message);
    else onAceito();
  }

  return <div className="termo">
    <div className="termo-head"><FileCheck2 size={22}/><div><strong>Termo de ciência sobre a gravação</strong><span>Leia antes da primeira gravação · versão {versao}</span></div></div>
    <ol>{TERMO_ITENS.map((t, i) => <li key={i}>{t}</li>)}</ol>
    <label className="check"><input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)}/> Li e estou ciente das condições acima.</label>
    <div className="controls"><button className="button primary" disabled={!marcado || busy} onClick={aceitar}>Aceitar e continuar</button></div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
  </div>;
}
