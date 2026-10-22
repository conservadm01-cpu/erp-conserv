import { useState } from "react";
import { ClipboardList, Pizza, Tag, Bike, Users, Settings, Lock } from "lucide-react";
import { useConfig } from "../logic.js";
import Pedidos from "./loja/Pedidos.jsx";
import Produtos from "./loja/Produtos.jsx";
import Promocoes from "./loja/Promocoes.jsx";
import Motoboys from "./loja/Motoboys.jsx";
import Clientes from "./loja/Clientes.jsx";
import Configuracoes from "./loja/Configuracoes.jsx";

const ABAS = [
  ["pedidos", "Pedidos", ClipboardList, Pedidos],
  ["produtos", "Produtos", Pizza, Produtos],
  ["promocoes", "Promoções", Tag, Promocoes],
  ["motoboys", "Motoboys", Bike, Motoboys],
  ["clientes", "Clientes", Users, Clientes],
  ["config", "Configurações", Settings, Configuracoes],
];

export default function Loja({ aba }) {
  const [cfg, carregado] = useConfig();
  const [liberado, setLiberado] = useState(() => { try { return sessionStorage.getItem("pz-loja") === "ok"; } catch { return false; } });
  const [pin, setPin] = useState("");

  if (!carregado) return <div className="vazio">Carregando…</div>;
  if (!liberado) {
    return (
      <form
        className="cartao coluna"
        style={{ maxWidth: 360, margin: "40px auto" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (pin === String(cfg.adminPin)) { try { sessionStorage.setItem("pz-loja", "ok"); } catch { /* só nesta tela */ } setLiberado(true); }
          else setPin("");
        }}
      >
        <h2><Lock size={18} /> Área da loja</h2>
        <input className="in" type="password" inputMode="numeric" placeholder="PIN da loja" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        <button className="btn primario">Entrar</button>
        <div className="suave pequeno">PIN inicial: 1234 — troque em Configurações.</div>
      </form>
    );
  }

  const atual = ABAS.find((a) => a[0] === aba) || ABAS[0];
  const Tela = atual[3];
  return (
    <div>
      <div className="abas">
        {ABAS.map(([id, nome, Icone]) => (
          <button key={id} className={id === atual[0] ? "ativo" : ""} onClick={() => (window.location.hash = `#/loja/${id}`)}>
            <Icone size={15} /> {nome}
          </button>
        ))}
      </div>
      <Tela />
    </div>
  );
}
