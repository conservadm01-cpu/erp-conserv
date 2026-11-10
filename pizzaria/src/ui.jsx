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

// Pizza desenhada em SVG, usada quando o produto não tem foto. A cobertura
// varia conforme o nome, para cada sabor ter a sua cara.
const COBERTURAS = [
  ["#8f1d14", "#f6efd9"], // calabresa / mussarela
  ["#2e7a48", "#f6efd9"], // manjericão
  ["#5b3a1e", "#f3d27a"], // frango / catupiry
  ["#3b2a20", "#fff3d6"], // chocolate
  ["#c2272d", "#7a1d12"], // morango
];
export function PizzaIlustrada({ nome = "", tamanho = 120, doce = false, className }) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [cor1, cor2] = doce ? COBERTURAS[3 + (h % 2)] : COBERTURAS[h % 3];
  const molho = doce ? "#4a2c1d" : "#c8361d";
  const pontos = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + (h % 7);
    const r = 14 + ((h >> i) % 3) * 9;
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r, i % 3 === 0 ? cor2 : cor1];
  });
  return (
    <svg viewBox="0 0 100 100" width={tamanho} height={tamanho} className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#e7a43c" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#c9822a" strokeWidth="2" strokeDasharray="3 5" />
      <circle cx="50" cy="50" r="40" fill={molho} />
      <circle cx="50" cy="50" r="38" fill={doce ? "#5a3624" : "#f4d48a"} opacity="0.9" />
      <path d="M50 50 L50 10 A40 40 0 0 1 84.6 30 Z" fill="none" stroke="#c9822a" strokeWidth="0.8" opacity="0.5" />
      <path d="M50 50 L84.6 70 M50 50 L15.4 70 M50 50 L15.4 30" stroke="#c9822a" strokeWidth="0.8" opacity="0.5" />
      {pontos.map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 5.5} fill={c} />)}
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
