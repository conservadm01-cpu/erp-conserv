"use client";

import { useEffect, useState } from "react";
import { FlaskConical, LogIn, Radio, Square, Clock3, RotateCcw, X, Check, Camera } from "lucide-react";
import { PESSOAS, currentEmail, loginAs, envelhecer, retencao, resetData } from "./fakeSupabase";
import { iniciarVirtual, pararVirtual, virtualAtivo, seedExemplo, cameraSimulada } from "./sim";

export default function DemoBar({ onRemount }: { onRemount: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail());
  const [live, setLive] = useState(virtualAtivo());
  const [msg, setMsg] = useState("");

  useEffect(() => { const t = setInterval(() => { setEmail(currentEmail()); setLive(virtualAtivo()); }, 500); return () => clearInterval(t); }, []);

  const entrar = (e: string) => { loginAs(e); setEmail(e); setOpen(false); setMsg(""); window.scrollTo({ top: 0 }); };

  if (!email) {
    return <div className="demo-login">
      <div className="demo-login-head"><FlaskConical size={16}/><strong>Demonstração</strong><span>Toque para entrar como:</span></div>
      <div className="demo-people">
        {PESSOAS.map(p => <button key={p.email} onClick={() => entrar(p.email)}><b>{p.papel}</b><span>{p.email}</span></button>)}
      </div>
    </div>;
  }

  return <>
    <button className="demo-fab" onClick={() => setOpen(true)} aria-label="Painel da demonstração"><FlaskConical size={16}/> Demo</button>
    {open && <div className="sheet-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet" role="dialog" aria-label="Painel da demonstração" onClick={e => e.stopPropagation()}>
        <div className="sheet-grip"/>
        <button className="sheet-close" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18}/></button>
        <h3>Painel da demonstração</h3>
        <p>Os dados ficam só nesta aba e voltam ao início se você recarregar a página.{cameraSimulada ? " A câmera deste navegador não foi liberada, então a demo usa uma câmera simulada." : ""}</p>

        <div className="demo-section">Entrar como</div>
        <div className="demo-people">
          {PESSOAS.map(p => <button key={p.email} className={p.email === email ? "current" : ""} onClick={() => entrar(p.email)}>
            <b>{p.papel} {p.email === email && <Check size={14}/>}</b><span>{p.desc}</span>
          </button>)}
        </div>

        <div className="demo-section">Simular</div>
        <div className="demo-actions">
          <button className="button secondary lg" onClick={() => { if (live) pararVirtual(); else iniciarVirtual(() => setLive(virtualAtivo())); setMsg(live ? "O profissional virtual parou de gravar." : "O profissional virtual começou a gravar na cozinha (A-104). Entre como Proprietário para acompanhar: o primeiro trecho chega em ~10 s."); }}>
            {live ? <><Square size={16}/> Parar o profissional virtual</> : <><Radio size={16}/> Profissional gravando agora (A-104)</>}
          </button>
          <button className="button secondary lg" onClick={() => {
            envelhecer(61); const r = retencao(60); onRemount();
            setMsg(`Passaram-se 61 dias e a rotina de retenção rodou: ${r.trechosApagados} trechos apagados, ${r.preservados} preservados por ocorrência, ${r.gravacoesExpiradas} gravações expiradas.`);
          }}><Clock3 size={16}/> Avançar 61 dias e rodar a retenção</button>
          <button className="button ghost lg" onClick={async () => {
            pararVirtual(); resetData(); loginAs(null); setOpen(false); onRemount(); void seedExemplo();
          }}><RotateCcw size={16}/> Reiniciar dados</button>
        </div>
        {msg && <div className="success"><Camera size={16}/>{msg}</div>}
      </div>
    </div>}
  </>;
}
