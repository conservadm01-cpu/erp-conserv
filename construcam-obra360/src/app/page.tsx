"use client";

import { useEffect, useState } from "react";
import { Camera, Building2, HardHat, ShieldCheck, Video, Clock3, CloudUpload, ClipboardList, LogOut } from "lucide-react";
import CameraRecorder from "@/components/CameraRecorder";
import LoginForm from "@/components/LoginForm";
import RecordingHistory from "@/components/RecordingHistory";
import { isSupabaseConfigured } from "@/lib/supabase";
import { startQueueWorker } from "@/lib/uploadQueue";
import { useAuth } from "@/lib/useAuth";

type Role = "admin" | "worker" | "owner";

export default function Home() {
  const [role, setRole] = useState<Role>("worker");
  const [condo, setCondo] = useState("Condomínio piloto");
  const [unit, setUnit] = useState("104");
  const [worker, setWorker] = useState("Profissional 01");
  const [job, setJob] = useState("Reforma de cozinha");
  const { user, loading, signOut } = useAuth();

  // Retoma envios pendentes (de gravações anteriores) assim que o app abre.
  useEffect(() => { startQueueWorker(); }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandmark"><Camera size={23}/></div>
        <div><strong>CONSTRUCAM</strong><span>OBRA 360</span></div>
        {user
          ? <div className="top-user"><span title={user.email}>{user.email}</span><button className="button secondary small" onClick={() => void signOut()}><LogOut size={15}/> Sair</button></div>
          : <div className="top-status"><i/> MVP</div>}
      </header>

      <section className="hero">
        <div className="eyebrow">GESTÃO AUDIOVISUAL DE REFORMAS</div>
        <h1>Sua obra, acompanhada<br/><em>de qualquer lugar.</em></h1>
        <p>Gravação pelo celular, organização por obra e histórico audiovisual protegido.</p>
        <div className="hero-pills"><span><Video size={14}/> Câmera móvel</span><span><Clock3 size={14}/> Retenção planejada: 60 dias</span></div>
      </section>

      <nav className="role-tabs" aria-label="Perfil">
        {([
          ["worker", "Profissional", HardHat],
          ["owner", "Proprietário", Video],
          ["admin", "Administração", Building2]
        ] as const).map(([value, label, Icon]) => (
          <button key={value} className={role === value ? "role active" : "role"} onClick={() => setRole(value)}>
            <Icon size={17}/>{label}
          </button>
        ))}
      </nav>

      <section className="content">
        {role === "worker" && loading && <div className="empty-state compact"><strong>Carregando…</strong></div>}
        {role === "worker" && !loading && !user && <LoginForm/>}
        {role === "worker" && user && <>
          <div className="section-head"><div><div className="eyebrow">ÁREA DO PROFISSIONAL</div><h2>Registrar execução</h2></div><span className="tag green">Conectado</span></div>
          <div className="form-grid">
            <label>Condomínio<input value={condo} onChange={e=>setCondo(e.target.value)}/></label>
            <label>Apartamento<input value={unit} onChange={e=>setUnit(e.target.value)}/></label>
            <label>Profissional<input value={worker} onChange={e=>setWorker(e.target.value)}/></label>
            <label>Serviço / etapa<input value={job} onChange={e=>setJob(e.target.value)}/></label>
          </div>
          <CameraRecorder metadata={{ condo, unit, worker, job }} userId={user.id}/>
        </>}
        {role === "owner" && <OwnerPanel condo={condo} unit={unit}/>}
        {role === "admin" && <AdminPanel condo={condo}/>}
      </section>

      {role === "worker" && user && <section className="content"><RecordingHistory/></section>}

      <section className="notice">
        <ShieldCheck size={20}/>
        <div><strong>Privacidade e transparência</strong><p>Use somente com autorização e aviso prévio aos envolvidos. Áudio desativado nesta versão. Não grave banheiros, vestiários, intervalos ou áreas de intimidade. Os painéis de Proprietário e Administração ainda são demonstrativos.</p></div>
      </section>

      <footer>CONSTRUCAM OBRA 360 <span>•</span> Protótipo funcional inicial</footer>
      {!isSupabaseConfigured && <div className="setup-banner">Configuração pendente: conecte o Supabase seguindo o README para habilitar upload e histórico na nuvem.</div>}
    </main>
  );
}

function OwnerPanel({ condo, unit }: { condo: string; unit: string }) {
  return <div className="panel">
    <div className="section-head"><div><div className="eyebrow">ÁREA DO PROPRIETÁRIO</div><h2>Acompanhamento da obra</h2></div><span className="tag">Demonstração</span></div>
    <div className="owner-card"><div className="owner-icon"><Video size={22}/></div><div><strong>{condo} · Apartamento {unit}</strong><p>Reforma de cozinha · Profissional 01</p></div><span className="tag amber">Aguardando transmissão</span></div>
    <div className="empty-state"><Camera size={32}/><strong>Nenhuma transmissão conectada</strong><p>Quando a sessão autorizada estiver ativa e o módulo WebRTC for configurado, o vídeo aparecerá aqui.</p></div>
    <div className="feature-row"><span><Clock3/> Histórico de até 60 dias</span><span><CloudUpload/> Arquivos na nuvem</span></div>
  </div>;
}

function AdminPanel({ condo }: { condo: string }) {
  return <div className="panel">
    <div className="section-head"><div><div className="eyebrow">PAINEL ADMINISTRATIVO</div><h2>Visão do condomínio</h2></div><span className="tag green">Piloto</span></div>
    <div className="stats"><div><strong>240</strong><span>Unidades cadastradas (referência)</span></div><div><strong>4</strong><span>Obras simultâneas planejadas</span></div><div><strong>30</strong><span>Celulares/coletes previstos</span></div></div>
    <div className="owner-card"><Building2/><div><strong>{condo}</strong><p>Ambiente demonstrativo — cadastros reais serão vinculados ao banco Supabase.</p></div></div>
    <div className="empty-state compact"><ClipboardList size={28}/><strong>Gestão de obras</strong><p>O próximo módulo incluirá cadastro de unidades, empresas, profissionais, permissões, contratos e ocorrências.</p></div>
  </div>;
}
