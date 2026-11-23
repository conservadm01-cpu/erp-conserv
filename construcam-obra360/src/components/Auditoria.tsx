"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Flag, ShieldCheck, ShieldOff, CheckCircle2, AlertTriangle, Radio } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { confirmSheet, promptSheet } from "@/components/Sheet";
import { OCORRENCIA_COLS, faixa } from "@/components/RecordingHistory";
import type { AcessoVideo, Ocorrencia } from "@/types";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Quem assistiu aos vídeos das obras (registrado pelo servidor ao emitir os links). */
export function AcessosList({ obraIds, nomes = {}, limit = 30 }: { obraIds: string[]; nomes?: Record<string, string>; limit?: number }) {
  const [rows, setRows] = useState<AcessoVideo[]>([]);
  const [error, setError] = useState("");
  const key = obraIds.join(",");
  useEffect(() => {
    if (!supabase || !key) { setRows([]); return; }
    supabase.from("acessos_video").select("id,email,gravacao_id,obra_id,tipo,segmentos,created_at")
      .in("obra_id", key.split(",")).order("created_at", { ascending: false }).limit(limit)
      .then(({ data, error }) => { if (error) setError(error.message); else setRows((data ?? []) as AcessoVideo[]); });
  }, [key, limit]);
  if (error) return <div className="error"><AlertTriangle size={17}/>{error}</div>;
  if (!rows.length) return <p className="microcopy">Ninguém assistiu aos vídeos ainda.</p>;
  return <ul className="audit-list">
    {rows.map(r => <li key={r.id}>
      {r.tipo === "ao_vivo" ? <Radio size={14}/> : <Eye size={14}/>}
      <span><b>{r.email ?? "—"}</b> {r.tipo === "ao_vivo" ? "acompanhou ao vivo" : `assistiu ${r.segmentos?.length ?? 0} trechos`}{r.obra_id && nomes[r.obra_id] ? ` · ${nomes[r.obra_id]}` : ""}</span>
      <time>{fmt(r.created_at)}</time>
    </li>)}
  </ul>;
}

/** Ocorrências das obras; a administração pode resolver e liberar a preservação. */
export function OcorrenciasPainel({ obraIds, nomes = {}, canResolve }: { obraIds: string[]; nomes?: Record<string, string>; canResolve: boolean }) {
  const [rows, setRows] = useState<Ocorrencia[]>([]);
  const [filtro, setFiltro] = useState<"aberta" | "todas">("aberta");
  const [error, setError] = useState("");
  const key = obraIds.join(",");

  const load = useCallback(async () => {
    if (!supabase || !key) { setRows([]); return; }
    let q = supabase.from("ocorrencias").select(OCORRENCIA_COLS).in("obra_id", key.split(",")).order("created_at", { ascending: false }).limit(50);
    if (filtro === "aberta") q = q.eq("status", "aberta");
    const { data, error } = await q;
    if (error) setError(error.message); else { setError(""); setRows((data ?? []) as Ocorrencia[]); }
  }, [key, filtro]);
  useEffect(() => { void load(); }, [load]);

  async function atualizar(o: Ocorrencia, patch: Partial<Ocorrencia> & Record<string, unknown>) {
    if (!supabase) return;
    const { data, error } = await supabase.from("ocorrencias").update(patch).eq("id", o.id).select("id");
    if (error || !data?.length) setError(error?.message ?? "Sem permissão para alterar esta ocorrência.");
    else void load();
  }
  async function resolver(o: Ocorrencia) {
    const resolucao = await promptSheet({ title: "Resolver ocorrência", message: faixa(o) + " · " + o.descricao, label: "Como foi resolvida?", placeholder: "Ex.: Construtora fará o reparo até sexta.", confirmLabel: "Marcar como resolvida" });
    if (!resolucao?.trim() || !supabase) return;
    const { data: s } = await supabase.auth.getSession();
    await atualizar(o, { status: "resolvida", resolucao: resolucao.trim(), resolvido_por: s.session?.user.id, resolvido_em: new Date().toISOString() });
  }
  async function liberar(o: Ocorrencia) {
    if (!await confirmSheet({ title: "Liberar a preservação?", message: "Os trechos voltam a seguir a retenção de 60 dias e podem ser apagados.", confirmLabel: "Liberar", danger: true })) return;
    await atualizar(o, { preservada: false });
  }

  return <div>
    <div className="seg-toggle">
      <button className={filtro === "aberta" ? "active" : ""} onClick={() => setFiltro("aberta")}>Abertas</button>
      <button className={filtro === "todas" ? "active" : ""} onClick={() => setFiltro("todas")}>Todas</button>
    </div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    {!rows.length && <p className="microcopy">{filtro === "aberta" ? "Nenhuma ocorrência aberta." : "Nenhuma ocorrência registrada."}</p>}
    <ul className="ocorrencias">
      {rows.map(o => <li key={o.id}>
        <span className="oc-title"><Flag size={12}/> {o.obra_id && nomes[o.obra_id] ? `${nomes[o.obra_id]} · ` : ""}{faixa(o)}</span>
        <span className={o.status === "aberta" ? "tag amber" : "tag"}>{o.status === "aberta" ? "Aberta" : "Resolvida"}</span>
        {o.preservada && <span className="tag green"><ShieldCheck size={11}/> Preservado</span>}
        <p>{o.descricao}</p>
        <small>{o.solicitado_email ?? "—"} · {fmt(o.created_at)}{o.resolucao ? ` · Resolução: ${o.resolucao}` : ""}</small>
        {canResolve && <div className="controls top-gap">
          {o.status === "aberta" && <button className="button secondary small" onClick={() => resolver(o)}><CheckCircle2 size={14}/> Marcar como resolvida</button>}
          {o.preservada && <button className="button secondary small" onClick={() => liberar(o)}><ShieldOff size={14}/> Liberar preservação</button>}
        </div>}
      </li>)}
    </ul>
  </div>;
}
