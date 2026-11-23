"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, Plus, X, Home, HardHat, ShieldCheck, ChevronDown, ChevronUp, ChevronRight, Flag, FileCheck2 } from "lucide-react";
import { AcessosList, OcorrenciasPainel } from "@/components/Auditoria";
import RecordingHistory from "@/components/RecordingHistory";
import { confirmSheet } from "@/components/Sheet";
import { supabase } from "@/lib/supabase";
import { check, emailValido, normalizarEmail, OBRA_COLS } from "@/lib/data";
import { nomeUnidade, type Condominio, type Membro, type Obra, type Papel, type Unidade } from "@/types";

export type AdminView = "painel" | "unidades" | "ocorrencias" | "acessos";
type Props = { platformAdmin: boolean; adminCondos: string[]; onChanged: () => void; view: AdminView; onNavigate: (v: AdminView) => void };
type Dados = { unidades: Unidade[]; obras: Obra[]; membros: Membro[]; hoje: number; andamento: number; abertas: number; termos: Record<string, string> };

function db() { if (!supabase) throw new Error("Supabase não configurado."); return supabase; }
const MEMBRO_COLS = "id,email,nome,papel,condominio_id,unidade_id,obra_id";

export default function AdminPanel({ platformAdmin, adminCondos, onChanged, view, onNavigate }: Props) {
  const [condos, setCondos] = useState<Condominio[]>([]);
  const [condoId, setCondoId] = useState("");
  const [dados, setDados] = useState<Dados | null>(null);
  const [error, setError] = useState("");

  const loadCondos = useCallback(async () => {
    try {
      const all = check(await db().from("condominios").select("id,nome,cidade").order("nome")) as Condominio[];
      const mine = platformAdmin ? all : all.filter(c => adminCondos.includes(c.id));
      setCondos(mine);
      setCondoId(cur => mine.some(c => c.id === cur) ? cur : mine[0]?.id ?? "");
    } catch (e) { setError((e as Error).message); }
  }, [platformAdmin, adminCondos]);

  const loadDados = useCallback(async () => {
    if (!condoId) { setDados(null); return; }
    try {
      const unidades = check(await db().from("unidades").select("id,condominio_id,bloco,identificador").eq("condominio_id", condoId).order("bloco").order("identificador")) as Unidade[];
      const uIds = unidades.map(u => u.id);
      const obras = uIds.length ? check(await db().from("obras").select(OBRA_COLS).in("unidade_id", uIds).order("created_at", { ascending: false })) as Obra[] : [];
      const oIds = obras.map(o => o.id);
      const [adm, prop, prof] = await Promise.all([
        db().from("membros").select(MEMBRO_COLS).eq("condominio_id", condoId),
        uIds.length ? db().from("membros").select(MEMBRO_COLS).in("unidade_id", uIds) : Promise.resolve({ data: [], error: null }),
        oIds.length ? db().from("membros").select(MEMBRO_COLS).in("obra_id", oIds) : Promise.resolve({ data: [], error: null })
      ]);
      const membros = [...check(adm), ...check(prop), ...check(prof)] as Membro[];
      let hoje = 0, andamento = 0;
      if (oIds.length) {
        const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
        const gs = check(await db().from("gravacoes").select("id,status").in("obra_id", oIds).gte("inicio", inicioDia.toISOString())) as { status: string }[];
        hoje = gs.length; andamento = gs.filter(g => g.status === "iniciada").length;
      }
      let abertas = 0;
      const termos: Record<string, string> = {};
      if (oIds.length) {
        const oc = await db().from("ocorrencias").select("id").in("obra_id", oIds).eq("status", "aberta");
        abertas = oc.data?.length ?? 0;
      }
      const emails = [...new Set(membros.filter(m => m.papel === "profissional").map(m => m.email))];
      if (emails.length) {
        const { data: versao } = await db().rpc("termo_versao_atual");
        const t = await db().from("termos_aceite").select("email,aceito_em").in("email", emails).eq("versao", versao as string);
        (t.data ?? []).forEach((r: { email: string; aceito_em: string }) => { termos[r.email] = r.aceito_em; });
      }
      setDados({ unidades, obras, membros, hoje, andamento, abertas, termos });
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [condoId]);

  useEffect(() => { void loadCondos(); }, [loadCondos]);
  useEffect(() => { void loadDados(); }, [loadDados]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await fn();
    if (error) { setError(traduzErro(error.message)); return false; }
    setError(""); await loadDados(); return true;
  }

  async function criarCondominio(nome: string, cidade: string) {
    const { data, error } = await db().from("condominios").insert({ nome: nome.trim(), cidade: cidade.trim() || null }).select("id").single();
    if (error) { setError(traduzErro(error.message)); return false; }
    await loadCondos(); setCondoId(data.id); return true;
  }

  const addMembro = (papel: Papel, alvo: Partial<Membro>) => (email: string) =>
    run(() => db().from("membros").insert({ email: normalizarEmail(email), papel, ...alvo })).then(ok => { if (ok) onChanged(); return ok; });
  const removeMembro = (id: string) => run(() => db().from("membros").delete().eq("id", id)).then(ok => { if (ok) onChanged(); return ok; });

  const condo = condos.find(c => c.id === condoId);
  const obrasAtivas = dados?.obras.filter(o => o.status === "ativa").length ?? 0;

  const condoPicker = condos.length > 1 && <label className="field compact-field">Condomínio
    <select value={condoId} onChange={e => setCondoId(e.target.value)}>
      {condos.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cidade ? ` · ${c.cidade}` : ""}</option>)}
    </select>
  </label>;

  return <div className="screen">
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}

    {view === "painel" && <>
      <section className="card">
        <div className="card-head">
          <div><div className="eyebrow">Condomínio</div><h2>{condo ? condo.nome : "Condomínios"}</h2>{condo?.cidade && <p className="sub">{condo.cidade}</p>}</div>
          {platformAdmin && <span className="tag green">Plataforma</span>}
        </div>
        {condoPicker}
        {platformAdmin && <NovoCondominio onCreate={criarCondominio}/>}
        {condos.length === 0 && <div className="empty-state compact"><Building2 size={28}/><strong>Nenhum condomínio</strong>
          <p>{platformAdmin ? "Cadastre o primeiro condomínio no botão acima." : "Você ainda não administra nenhum condomínio."}</p></div>}
      </section>

      {condo && dados && <>
        {dados.abertas > 0 && <button className="alert-card" onClick={() => onNavigate("ocorrencias")}>
          <Flag size={18}/><span><b>{dados.abertas} {dados.abertas === 1 ? "ocorrência aberta" : "ocorrências abertas"}</b>aguardando a administração</span><ChevronRight size={18}/>
        </button>}
        <div className="stats">
          <button onClick={() => onNavigate("unidades")}><strong>{dados.unidades.length}</strong><span>Unidades</span></button>
          <button onClick={() => onNavigate("unidades")}><strong>{obrasAtivas}</strong><span>Obras ativas</span></button>
          <div><strong>{dados.hoje}</strong><span>Gravações hoje</span></div>
          <div className={dados.andamento ? "live-stat" : ""}><strong>{dados.andamento}</strong><span>Gravando agora</span></div>
        </div>
        <section className="card">
          <h3 className="card-title"><ShieldCheck size={17}/> Administradores</h3>
          <Pessoas membros={dados.membros.filter(m => m.papel === "admin")} onAdd={addMembro("admin", { condominio_id: condo.id })} onRemove={removeMembro} placeholder="e-mail do síndico ou administradora"/>
        </section>
      </>}
    </>}

    {view === "unidades" && condo && dados && <section className="card">
      <div className="card-head"><div><div className="eyebrow">{condo.nome}</div><h2>Unidades e obras</h2></div></div>
      {condoPicker}
      <NovaUnidade onCreate={(bloco, id) => run(() => db().from("unidades").insert({ condominio_id: condo.id, bloco: bloco.trim(), identificador: id.trim() }))}/>
      {dados.unidades.length === 0 && <p className="microcopy">Nenhuma unidade cadastrada. Cadastre apenas as unidades que terão obra acompanhada.</p>}
      <ul className="unit-list">
        {dados.unidades.map(u => <UnidadeItem key={u.id} unidade={u}
          obras={dados.obras.filter(o => o.unidade_id === u.id)}
          membros={dados.membros} termos={dados.termos}
          onAddMembro={addMembro} onRemoveMembro={removeMembro}
          onNovaObra={(descricao, empresa) => run(() => db().from("obras").insert({ unidade_id: u.id, descricao: descricao.trim(), empresa: empresa.trim() || null, status: "ativa" }))}
          onStatus={(obraId, status) => run(() => db().from("obras").update({ status }).eq("id", obraId))}
        />)}
      </ul>
    </section>}

    {view === "ocorrencias" && condo && dados && <section className="card">
      <div className="card-head"><div><div className="eyebrow">{condo.nome}</div><h2>Ocorrências</h2></div></div>
      <OcorrenciasPainel obraIds={dados.obras.map(o => o.id)} nomes={nomesObras(dados)} canResolve/>
    </section>}

    {view === "acessos" && condo && dados && <section className="card">
      <div className="card-head"><div><div className="eyebrow">{condo.nome}</div><h2>Quem assistiu</h2></div></div>
      <p className="microcopy">Cada vez que alguém abre um vídeo (histórico ou ao vivo), o servidor registra aqui.</p>
      <AcessosList obraIds={dados.obras.map(o => o.id)} nomes={nomesObras(dados)}/>
    </section>}

    {view !== "painel" && !condo && <div className="empty-state"><Building2 size={28}/><strong>Escolha um condomínio</strong><p>Cadastre ou selecione um condomínio na aba Painel.</p></div>}
  </div>;
}

function nomesObras(d: Dados) {
  const out: Record<string, string> = {};
  d.obras.forEach(o => { out[o.id] = `${nomeUnidade(d.unidades.find(u => u.id === o.unidade_id))} · ${o.descricao || "Obra"}`; });
  return out;
}

function traduzErro(msg: string) {
  if (/row-level security/i.test(msg)) return "Sem permissão para esta ação.";
  if (/unidades_condominio_id_bloco_identificador_key/i.test(msg)) return "Já existe uma unidade com esse bloco e número.";
  if (/membros_unico/i.test(msg)) return "Este e-mail já tem esse acesso.";
  if (/duplicate key/i.test(msg)) return "Este cadastro já existe.";
  if (/membros_email_check/i.test(msg)) return "E-mail inválido.";
  return msg;
}

function NovoCondominio({ onCreate }: { onCreate: (nome: string, cidade: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(""); const [cidade, setCidade] = useState("");
  if (!open) return <button className="button secondary" onClick={() => setOpen(true)}><Plus size={16}/> Novo condomínio</button>;
  return <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (await onCreate(nome, cidade)) { setNome(""); setCidade(""); setOpen(false); } }}>
    <input placeholder="Nome do condomínio" value={nome} onChange={e => setNome(e.target.value)} required/>
    <input placeholder="Cidade (opcional)" value={cidade} onChange={e => setCidade(e.target.value)}/>
    <button className="button primary" disabled={!nome.trim()}>Criar</button>
    <button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancelar</button>
  </form>;
}

function NovaUnidade({ onCreate }: { onCreate: (bloco: string, id: string) => Promise<boolean> }) {
  const [bloco, setBloco] = useState(""); const [id, setId] = useState("");
  return <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (await onCreate(bloco, id)) { setId(""); } }}>
    <input className="short" placeholder="Bloco (opcional)" value={bloco} onChange={e => setBloco(e.target.value)}/>
    <input className="short" placeholder="Apto." value={id} onChange={e => setId(e.target.value)} required/>
    <button className="button primary" disabled={!id.trim()}><Plus size={16}/> Adicionar unidade</button>
  </form>;
}

type UnidadeProps = {
  unidade: Unidade; obras: Obra[]; membros: Membro[]; termos: Record<string, string>;
  onAddMembro: (papel: Papel, alvo: Partial<Membro>) => (email: string) => Promise<boolean>;
  onRemoveMembro: (id: string) => Promise<boolean>;
  onNovaObra: (descricao: string, empresa: string) => Promise<boolean>;
  onStatus: (obraId: string, status: string) => Promise<boolean>;
};

function UnidadeItem({ unidade, obras, membros, termos, onAddMembro, onRemoveMembro, onNovaObra, onStatus }: UnidadeProps) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState(""); const [empresa, setEmpresa] = useState("");
  const donos = membros.filter(m => m.papel === "proprietario" && m.unidade_id === unidade.id);
  const ativas = obras.filter(o => o.status === "ativa").length;
  return <li className={open ? "open" : ""}>
    <button className="history-row" onClick={() => setOpen(!open)}>
      <Home size={20}/>
      <div><strong>{nomeUnidade(unidade)}</strong><span>{donos.length} {donos.length === 1 ? "proprietário" : "proprietários"} · {obras.length} {obras.length === 1 ? "obra" : "obras"}</span></div>
      {ativas > 0 && <span className="tag green">{ativas} ativa{ativas > 1 ? "s" : ""}</span>}
      {open ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
    </button>
    {open && <div className="unit-body">
      <h4>Proprietários</h4>
      <Pessoas membros={donos} onAdd={onAddMembro("proprietario", { unidade_id: unidade.id })} onRemove={onRemoveMembro} placeholder="e-mail do proprietário"/>
      <h4>Obras</h4>
      {obras.map(o => <ObraItem key={o.id} obra={o} termos={termos} profissionais={membros.filter(m => m.papel === "profissional" && m.obra_id === o.id)}
        onAdd={onAddMembro("profissional", { obra_id: o.id })} onRemove={onRemoveMembro} onStatus={s => onStatus(o.id, s)}/>)}
      <form className="inline-form" onSubmit={async e => { e.preventDefault(); if (await onNovaObra(descricao, empresa)) { setDescricao(""); setEmpresa(""); } }}>
        <input placeholder="Nova obra (ex.: Reforma de cozinha)" value={descricao} onChange={e => setDescricao(e.target.value)} required/>
        <input placeholder="Empresa (opcional)" value={empresa} onChange={e => setEmpresa(e.target.value)}/>
        <button className="button primary" disabled={!descricao.trim()}><Plus size={16}/> Registrar obra</button>
      </form>
    </div>}
  </li>;
}

function ObraItem({ obra, profissionais, termos, onAdd, onRemove, onStatus }: {
  obra: Obra; profissionais: Membro[]; termos: Record<string, string>; onAdd: (email: string) => Promise<boolean>; onRemove: (id: string) => Promise<boolean>; onStatus: (s: string) => Promise<boolean>;
}) {
  const [hist, setHist] = useState(false);
  const ativa = obra.status === "ativa";
  return <div className="obra-item">
    <div className="obra-head">
      <div><strong>{obra.descricao || "Obra"}</strong><span>{obra.empresa || "Sem empresa informada"} · desde {new Date(obra.created_at).toLocaleDateString("pt-BR")}</span></div>
      <span className={ativa ? "tag green" : "tag"}>{ativa ? "Ativa" : "Encerrada"}</span>
    </div>
    <div className="obra-team"><HardHat size={14}/> Profissionais autorizados a gravar</div>
    <Pessoas membros={profissionais} onAdd={onAdd} onRemove={onRemove} placeholder="e-mail do profissional"
      extra={m => termos[m.email]
        ? <span className="termo-ok" title={`Termo aceito em ${new Date(termos[m.email]).toLocaleString("pt-BR")}`}><FileCheck2 size={12}/></span>
        : <span className="termo-pend" title="Ainda não aceitou o termo de ciência">termo pendente</span>}/>
    <div className="controls">
      <button className="button secondary" onClick={() => setHist(!hist)}>{hist ? "Ocultar gravações" : "Ver gravações"}</button>
      <button className={ativa ? "button danger" : "button secondary"} onClick={() => {
        void (async () => { if (!ativa || await confirmSheet({ title: "Encerrar a obra?", message: "Os profissionais não poderão mais gravar nela. Você pode reabrir depois.", confirmLabel: "Encerrar obra", danger: true })) void onStatus(ativa ? "concluida" : "ativa"); })();
      }}>{ativa ? "Encerrar obra" : "Reabrir obra"}</button>
    </div>
    {hist && <RecordingHistory obraId={obra.id} eyebrow="HISTÓRICO DA OBRA" title="Gravações" showWorker canReport/>}
  </div>;
}

function Pessoas({ membros, onAdd, onRemove, placeholder, extra }: {
  membros: Membro[]; onAdd: (email: string) => Promise<boolean>; onRemove: (id: string) => Promise<boolean>; placeholder: string;
  extra?: (m: Membro) => React.ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  return <div className="people">
    <div className="chips">
      {membros.length === 0 && <span className="microcopy">Ninguém cadastrado.</span>}
      {membros.map(m => <span key={m.id} className="chip">{m.nome || m.email}{extra?.(m)}
        <button title="Remover acesso" aria-label={`Remover ${m.email}`} onClick={async () => { if (await confirmSheet({ title: "Remover acesso?", message: `${m.email} deixará de ver esta obra/unidade.`, confirmLabel: "Remover", danger: true })) void onRemove(m.id); }}><X size={13}/></button>
      </span>)}
    </div>
    <form className="inline-form" onSubmit={async e => {
      e.preventDefault();
      const v = normalizarEmail(email);
      if (!emailValido(v)) { setInvalid(true); return; }
      if (await onAdd(v)) setEmail("");
    }}>
      <input type="email" placeholder={placeholder} value={email} onChange={e => { setEmail(e.target.value); setInvalid(false); }} aria-invalid={invalid}/>
      <button className="button secondary" disabled={!email.trim()}><Plus size={16}/> Dar acesso</button>
    </form>
  </div>;
}
