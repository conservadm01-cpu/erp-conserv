import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { STATUS } from "./logic.js";

export function Modal({ titulo, aoFechar, children }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aoFechar]);
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal">
        <div className="linha entre" style={{ marginBottom: 12 }}>
          <h2>{titulo}</h2>
          <button className="btn fantasma" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, children, ...props }) {
  return (
    <label className="campo">
      {rotulo}
      {children || <input {...props} />}
    </label>
  );
}

export function SeloStatus({ status }) {
  const s = STATUS[status] || { curto: status, cor: "#666" };
  return <span className="selo" style={{ background: s.cor }}>{s.curto}</span>;
}

export function Emoji({ categoria }) {
  const e = { pizza: "🍕", doce: "🍫", bebida: "🥤", sobremesa: "🍰" }[categoria] || "🍽️";
  return <>{e}</>;
}

let mostrarToast = () => {};
export const toast = (msg) => mostrarToast(msg);
export function Toasts() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let t;
    mostrarToast = (m) => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(null), 2800); };
    return () => clearTimeout(t);
  }, []);
  return msg ? <div className="toast">{msg}</div> : null;
}

export const numero = (v) => (v === "" || v == null ? 0 : Number(String(v).replace(",", ".")) || 0);

// Botão que pede um segundo clique para confirmar (substitui o confirm()
// do navegador, que nem sempre está disponível).
export function BotaoConfirmar({ aoConfirmar, children, texto = "Confirmar?", className = "btn pequeno perigo" }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(false), 3000);
    return () => clearTimeout(t);
  }, [armado]);
  return (
    <button type="button" className={className} onClick={() => (armado ? (setArmado(false), aoConfirmar()) : setArmado(true))}>
      {armado ? texto : children}
    </button>
  );
}

// Pizza em traço dourado, usada quando o produto não tem foto. A posição
// das coberturas varia conforme o nome, para cada sabor ter a sua cara.
export function PizzaIlustrada({ nome = "", tamanho = 120, doce = false, className }) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const id = "pz" + (h % 100000);
  const fatias = 8;
  const cobertura = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + (h % 13) * 0.3;
    const r = 10 + (((h >> (i % 16)) & 7) * 3.4);
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r, i % 3];
  });
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6cd96" />
          <stop offset="0.5" stopColor="#c9a45c" />
          <stop offset="1" stopColor="#8a6d35" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={`url(#${id})`} strokeLinecap="round">
        <circle cx="50" cy="50" r="46" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="40.5" strokeWidth="0.7" strokeDasharray="1.2 2.6" />
        <circle cx="50" cy="50" r="37" strokeWidth="0.9" opacity="0.85" />
        {Array.from({ length: fatias }, (_, i) => {
          const a = (i / fatias) * Math.PI * 2 + 0.2;
          return <line key={i} x1={50 + Math.cos(a) * 4} y1={50 + Math.sin(a) * 4} x2={50 + Math.cos(a) * 37} y2={50 + Math.sin(a) * 37} strokeWidth="0.5" opacity="0.45" />;
        })}
        {cobertura.map(([x, y, t], i) =>
          t === 0 ? <circle key={i} cx={x} cy={y} r={doce ? 2.6 : 3.6} strokeWidth="0.9" />
          : t === 1 ? <path key={i} d={`M${x - 3} ${y + 1.5} q3 -5 6 0`} strokeWidth="0.9" />
          : <circle key={i} cx={x} cy={y} r="1" fill={`url(#${id})`} stroke="none" />
        )}
      </g>
    </svg>
  );
}

export function FotoProduto({ produto }) {
  if (produto.imagem) return null;
  if (produto.categoria === "pizza" || produto.categoria === "doce") {
    return <PizzaIlustrada nome={produto.nome} doce={produto.categoria === "doce"} className="ilustra" />;
  }
  return <span className="emoji"><Emoji categoria={produto.categoria} /></span>;
}
