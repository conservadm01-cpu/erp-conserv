"use client";

import { useState } from "react";
import { LogIn, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setInfo("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
  }

  async function sendMagicLink() {
    if (!supabase) return;
    if (!email.trim()) { setError("Informe o e-mail para receber o link."); return; }
    setBusy(true); setError(""); setInfo("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin }
    });
    setBusy(false);
    if (error) setError(error.message);
    else setInfo("Enviamos um link de acesso para o seu e-mail. Abra-o neste aparelho.");
  }

  if (!isSupabaseConfigured) {
    return <div className="empty-state compact">
      <AlertTriangle size={28}/>
      <strong>Supabase não configurado</strong>
      <p>Preencha <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no <code>.env.local</code> (ou nas variáveis do Vercel) para habilitar login e gravação.</p>
    </div>;
  }

  return <form className="login" onSubmit={signInWithPassword}>
    <div className="eyebrow">ACESSO</div>
    <h2>Entrar</h2>
    <p className="microcopy">Use o e-mail cadastrado pela administração. Não há cadastro aberto.</p>
    <div className="form-grid single">
      <label>E-mail<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
    </div>
    <div className="controls">
      <button className="button primary" type="submit" disabled={busy || !email || !password}><LogIn size={17}/> Entrar</button>
      <button className="button secondary" type="button" onClick={sendMagicLink} disabled={busy}><Mail size={17}/> Receber link por e-mail</button>
    </div>
    {error && <div className="error"><AlertTriangle size={17}/>{error}</div>}
    {info && <div className="success"><CheckCircle2 size={17}/>{info}</div>}
  </form>;
}
