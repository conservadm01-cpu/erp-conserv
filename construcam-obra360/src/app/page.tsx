"use client";

import { useEffect, useState } from "react";
import {
  Camera, Building2, HardHat, ShieldCheck, Video, LogOut, AlertTriangle, Lock, History,
  Radio, Flag, Eye, LayoutDashboard, Home as HomeIcon, ChevronDown, X, type LucideIcon
} from "lucide-react";
import LoginForm from "@/components/LoginForm";
import WorkerPanel, { type WorkerView } from "@/components/WorkerPanel";
import OwnerPanel, { type OwnerView } from "@/components/OwnerPanel";
import AdminPanel, { type AdminView } from "@/components/AdminPanel";
import { SheetHost } from "@/components/Sheet";
import { isSupabaseConfigured } from "@/lib/supabase";
import { startQueueWorker } from "@/lib/uploadQueue";
import { useAuth } from "@/lib/useAuth";
import { useAccess } from "@/lib/useAccess";

type Role = "worker" | "owner" | "admin";
type Tab = { id: string; label: string; icon: LucideIcon; title: string };

const ROLES: Record<Role, { label: string; icon: LucideIcon; tabs: Tab[] }> = {
  worker: { label: "Profissional", icon: HardHat, tabs: [
    { id: "gravar", label: "Gravar", icon: Camera, title: "Registrar execução" },
    { id: "historico", label: "Histórico", icon: History, title: "Minhas gravações" }
  ] },
  owner: { label: "Proprietário", icon: Video, tabs: [
    { id: "acompanhar", label: "Acompanhar", icon: Radio, title: "Acompanhamento da obra" },
    { id: "ocorrencias", label: "Ocorrências", icon: Flag, title: "Ocorrências" },
    { id: "acessos", label: "Acessos", icon: Eye, title: "Quem assistiu" }
  ] },
  admin: { label: "Administração", icon: Building2, tabs: [
    { id: "painel", label: "Painel", icon: LayoutDashboard, title: "Painel do condomínio" },
    { id: "unidades", label: "Unidades", icon: HomeIcon, title: "Unidades e obras" },
    { id: "ocorrencias", label: "Ocorrências", icon: Flag, title: "Ocorrências" },
    { id: "acessos", label: "Acessos", icon: Eye, title: "Registro de acessos" }
  ] }
};

const PRIVACIDADE = "Use somente com autorização e aviso prévio aos envolvidos. Áudio desativado. Não grave banheiros, vestiários, intervalos ou áreas de intimidade. Cada pessoa só vê as obras às quais foi vinculada pela administração.";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const access = useAccess(user);
  const [role, setRole] = useState<Role | null>(null);
  const [tabs, setTabs] = useState<Record<Role, string>>({ worker: "gravar", owner: "acompanhar", admin: "painel" });
  const [account, setAccount] = useState(false);

  // Retoma envios pendentes (de gravações anteriores) assim que o app abre.
  useEffect(() => { startQueueWorker(); }, []);

  const roles: Role[] = [];
  if (access.workerObras.length) roles.push("worker");
  if (access.ownerUnits.length) roles.push("owner");
  if (access.platformAdmin || access.adminCondos.length) roles.push("admin");
  const activeRole = roles.find(r => r === role) ?? roles[0] ?? null;
  const tab = activeRole ? ROLES[activeRole].tabs.find(t => t.id === tabs[activeRole]) ?? ROLES[activeRole].tabs[0] : null;
  const go = (id: string) => { if (activeRole) { setTabs(t => ({ ...t, [activeRole]: id })); window.scrollTo({ top: 0 }); } };

  if (!loading && !user) {
    return <main className="login-screen">
      <div className="login-hero">
        <div className="app-logo"><Camera size={30}/></div>
        <h1>Construcam<br/><em>Obra 360</em></h1>
        <p>Gravação pelo celular, acompanhamento pelo proprietário e histórico protegido da sua reforma.</p>
      </div>
      <div className="login-card"><LoginForm/></div>
      <p className="login-foot"><ShieldCheck size={13}/> {PRIVACIDADE}</p>
      {!isSupabaseConfigured && <div className="setup-banner">Configuração pendente: conecte o Supabase seguindo o README.</div>}
    </main>;
  }

  const ready = user && !access.loading;
  const hasNav = ready && activeRole && tab;

  return (
    <div className={hasNav ? "app has-nav" : "app"}>
      <header className="app-header">
        <div className="app-logo sm"><Camera size={18}/></div>
        <div className="app-title">
          {activeRole && roles.length > 1
            ? <label className="role-switch">
                <span>{ROLES[activeRole].label}</span><ChevronDown size={14}/>
                <select aria-label="Perfil" value={activeRole} onChange={e => setRole(e.target.value as Role)}>
                  {roles.map(r => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>
              </label>
            : <small>{activeRole ? ROLES[activeRole].label : "Construcam Obra 360"}</small>}
          <h1>{tab?.title ?? "Construcam"}</h1>
        </div>
        {user && <button className="avatar top-user" onClick={() => setAccount(true)} aria-label="Conta" title={user.email}>
          {(user.email ?? "?")[0].toUpperCase()}
        </button>}
      </header>

      {hasNav && <nav className="tab-bar" aria-label="Seções">
        <div className="tab-brand"><div className="app-logo sm"><Camera size={18}/></div><span>Construcam<b>Obra 360</b></span></div>
        {ROLES[activeRole].tabs.map(t => <button key={t.id} className={t.id === tab.id ? "tab active" : "tab"} onClick={() => go(t.id)} aria-current={t.id === tab.id ? "page" : undefined}>
          <t.icon size={22}/><span>{t.label}</span>
        </button>)}
      </nav>}

      <main className="app-main">
        {(loading || (user && access.loading)) && <div className="empty-state"><span className="spinner"/><strong>Carregando…</strong></div>}
        {ready && access.error && <div className="error"><AlertTriangle size={17}/>{access.error}</div>}
        {ready && !access.error && roles.length === 0 && <div className="empty-state">
          <Lock size={32}/><strong>Acesso ainda não liberado</strong>
          <p>Você entrou como <b>{user.email}</b>, mas este e-mail ainda não está vinculado a nenhum condomínio, unidade ou obra. Peça à administração do condomínio para cadastrá-lo e depois toque em “Verificar de novo”.</p>
          <button className="button primary" onClick={access.reload}>Verificar de novo</button>
        </div>}

        {ready && activeRole === "worker" && <WorkerPanel user={user} obraIds={access.workerObras} view={tab!.id as WorkerView}/>}
        {ready && activeRole === "owner" && <OwnerPanel unidadeIds={access.ownerUnits} view={tab!.id as OwnerView}/>}
        {ready && activeRole === "admin" && <AdminPanel platformAdmin={access.platformAdmin} adminCondos={access.adminCondos} onChanged={access.reload}
          view={tab!.id as AdminView} onNavigate={go}/>}
      </main>

      {account && user && <div className="sheet-backdrop" onClick={() => setAccount(false)}>
        <div className="sheet" role="dialog" aria-label="Conta" onClick={e => e.stopPropagation()}>
          <div className="sheet-grip"/>
          <button className="sheet-close" onClick={() => setAccount(false)} aria-label="Fechar"><X size={18}/></button>
          <div className="account">
            <div className="avatar lg">{(user.email ?? "?")[0].toUpperCase()}</div>
            <div><strong>{user.email}</strong><span>{roles.map(r => ROLES[r].label).join(" · ") || "Sem acesso liberado"}</span></div>
          </div>
          <p className="privacy"><ShieldCheck size={15}/> {PRIVACIDADE}</p>
          <div className="sheet-actions">
            <button className="button danger lg" onClick={() => { setAccount(false); void signOut(); }}><LogOut size={17}/> Sair</button>
          </div>
        </div>
      </div>}
      <SheetHost/>
      {!isSupabaseConfigured && <div className="setup-banner">Configuração pendente: conecte o Supabase seguindo o README.</div>}
    </div>
  );
}
