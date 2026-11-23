"use client";

import { useEffect, useState } from "react";
import { Camera, Building2, HardHat, ShieldCheck, Video, Clock3, LogOut, AlertTriangle, Lock } from "lucide-react";
import LoginForm from "@/components/LoginForm";
import WorkerPanel from "@/components/WorkerPanel";
import OwnerPanel from "@/components/OwnerPanel";
import AdminPanel from "@/components/AdminPanel";
import { isSupabaseConfigured } from "@/lib/supabase";
import { startQueueWorker } from "@/lib/uploadQueue";
import { useAuth } from "@/lib/useAuth";
import { useAccess } from "@/lib/useAccess";

type Role = "worker" | "owner" | "admin";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const access = useAccess(user);
  const [role, setRole] = useState<Role | null>(null);

  // Retoma envios pendentes (de gravações anteriores) assim que o app abre.
  useEffect(() => { startQueueWorker(); }, []);

  const roles: [Role, string, typeof HardHat][] = [];
  if (access.workerObras.length) roles.push(["worker", "Profissional", HardHat]);
  if (access.ownerUnits.length) roles.push(["owner", "Proprietário", Video]);
  if (access.platformAdmin || access.adminCondos.length) roles.push(["admin", "Administração", Building2]);
  const activeRole = roles.find(r => r[0] === role)?.[0] ?? roles[0]?.[0] ?? null;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandmark"><Camera size={23}/></div>
        <div><strong>CONSTRUCAM</strong><span>OBRA 360</span></div>
        {user
          ? <div className="top-user"><span title={user.email}>{user.email}</span><button className="button secondary small" onClick={() => void signOut()}><LogOut size={15}/> Sair</button></div>
          : <div className="top-status"><i/> MVP</div>}
      </header>

      {!user && <section className="hero">
        <div className="eyebrow">GESTÃO AUDIOVISUAL DE REFORMAS</div>
        <h1>Sua obra, acompanhada<br/><em>de qualquer lugar.</em></h1>
        <p>Gravação pelo celular, organização por obra e histórico audiovisual protegido.</p>
        <div className="hero-pills"><span><Video size={14}/> Câmera móvel</span><span><Clock3 size={14}/> Retenção planejada: 60 dias</span></div>
      </section>}

      {loading && <section className="content"><div className="empty-state compact"><strong>Carregando…</strong></div></section>}
      {!loading && !user && <section className="content"><LoginForm/></section>}

      {user && access.loading && <section className="content"><div className="empty-state compact"><strong>Carregando seus acessos…</strong></div></section>}
      {user && !access.loading && access.error && <section className="content"><div className="error"><AlertTriangle size={17}/>{access.error}</div></section>}
      {user && !access.loading && !access.error && roles.length === 0 && <section className="content">
        <div className="empty-state"><Lock size={30}/><strong>Acesso ainda não liberado</strong>
          <p>Você entrou como <b>{user.email}</b>, mas este e-mail ainda não está vinculado a nenhum condomínio, unidade ou obra. Peça à administração do condomínio para cadastrá-lo e depois toque em “Verificar de novo”.</p>
          <button className="button secondary" onClick={access.reload}>Verificar de novo</button>
        </div>
      </section>}

      {user && !access.loading && roles.length > 1 && <nav className="role-tabs" aria-label="Perfil">
        {roles.map(([value, label, Icon]) => (
          <button key={value} className={activeRole === value ? "role active" : "role"} onClick={() => setRole(value)}>
            <Icon size={17}/>{label}
          </button>
        ))}
      </nav>}

      {user && !access.loading && activeRole === "worker" && <WorkerPanel user={user} obraIds={access.workerObras}/>}
      {user && !access.loading && activeRole === "owner" && <OwnerPanel unidadeIds={access.ownerUnits}/>}
      {user && !access.loading && activeRole === "admin" && <AdminPanel platformAdmin={access.platformAdmin} adminCondos={access.adminCondos} onChanged={access.reload}/>}

      <section className="notice">
        <ShieldCheck size={20}/>
        <div><strong>Privacidade e transparência</strong><p>Use somente com autorização e aviso prévio aos envolvidos. Áudio desativado. Não grave banheiros, vestiários, intervalos ou áreas de intimidade. Cada pessoa só vê as obras às quais foi vinculada pela administração.</p></div>
      </section>

      <footer>CONSTRUCAM OBRA 360 <span>•</span> Protótipo funcional</footer>
      {!isSupabaseConfigured && <div className="setup-banner">Configuração pendente: conecte o Supabase seguindo o README para habilitar login e gravação.</div>}
    </main>
  );
}
