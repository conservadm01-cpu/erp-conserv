import { useEffect, useState } from "react";
import { ClipboardList, Pizza, Tag, Bike, Users, Settings, Lock, Armchair, MonitorPlay, BarChart3 } from "lucide-react";
import { useConfig, publicarTelas } from "../logic.js";
import Pedidos from "./loja/Pedidos.jsx";
import Salao from "./loja/Salao.jsx";
import Produtos from "./loja/Produtos.jsx";
import Promocoes from "./loja/Promocoes.jsx";
import Telas from "./loja/Telas.jsx";
import Motoboys from "./loja/Motoboys.jsx";
import Clientes from "./loja/Clientes.jsx";
import Relatorios from "./loja/Relatorios.jsx";
import Configuracoes from "./loja/Configuracoes.jsx";

const GRUPOS = [
  ["Operação", [
    ["pedidos", "Pedidos", ClipboardList, Pedidos],
    ["salao", "Salão e mesas", Armchair, Salao],
    ["motoboys", "Motoboys", Bike, Motoboys],
  ]],
  ["Cardápio", [
    ["produtos", "Produtos", Pizza, Produtos],
    ["promocoes", "Promoções", Tag, Promocoes],
    ["telas", "Telas e TV", MonitorPlay, Telas],
  ]],
  ["Gestão", [
    ["relatorios", "Caixa e relatórios", BarChart3, Relatorios],
    ["clientes", "Clientes", Users, Clientes],
    ["config", "Configurações", Settings, Configuracoes],
  ]],
];
const ABAS = GRUPOS.flatMap(([, abas]) => abas);

// Mudou produto ou promoção: reenvia o cardápio para as telas (TV/ESP32),
// esperando um pouco para juntar várias edições seguidas num envio só.
function usePublicacaoAutomatica(ativo) {
  useEffect(() => {
    if (!ativo) return;
    let t;
    const aoMudar = (e) => {
      if (!["produto", "promocao", "config"].includes(e.detail)) return;
      clearTimeout(t);
      t = setTimeout(() => publicarTelas().catch(console.error), 1500);
    };
    window.addEventListener("pz-mudou", aoMudar);
    return () => { clearTimeout(t); window.removeEventListener("pz-mudou", aoMudar); };
  }, [ativo]);
}

export default function Loja({ aba }) {
  const [cfg, carregado] = useConfig();
  const [liberado, setLiberado] = useState(() => { try { return sessionStorage.getItem("pz-loja") === "ok"; } catch { return false; } });
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState(false);
  usePublicacaoAutomatica(liberado);

  if (!carregado) return <div className="vazio">Carregando…</div>;
  if (!liberado) {
    return (
      <form
        className="cartao coluna"
        style={{ maxWidth: 380, margin: "40px auto", padding: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (pin === String(cfg.adminPin)) { try { sessionStorage.setItem("pz-loja", "ok"); } catch { /* só nesta tela */ } setLiberado(true); }
          else { setPin(""); setErro(true); }
        }}
      >
        <h2><Lock size={20} style={{ verticalAlign: -3 }} /> Área da loja</h2>
        <input className="in" type="password" inputMode="numeric" placeholder="PIN da loja" value={pin} onChange={(e) => { setPin(e.target.value); setErro(false); }} autoFocus />
        {erro && <div className="pequeno" style={{ color: "var(--erro)" }}>PIN incorreto. Tente de novo.</div>}
        <button className="btn primario">Entrar</button>
        <div className="suave pequeno">PIN inicial: 1234. Troque em Configurações.</div>
      </form>
    );
  }

  const atual = ABAS.find((a) => a[0] === aba) || ABAS[0];
  const Tela = atual[3];
  return (
    <div className="loja">
      <nav className="loja-menu" aria-label="Menu da loja">
        {GRUPOS.map(([grupo, abas]) => (
          <div key={grupo} style={{ display: "contents" }}>
            <span className="grupo">{grupo}</span>
            {abas.map(([id, nome, Icone]) => (
              <button key={id} className={id === atual[0] ? "ativo" : ""} onClick={() => (window.location.hash = `#/loja/${id}`)}>
                <Icone size={17} /> {nome}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ minWidth: 0 }}><Tela /></div>
    </div>
  );
}
