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
