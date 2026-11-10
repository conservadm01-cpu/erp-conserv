import { useEffect, useState } from "react";
import { armazem } from "../db.js";
import { useConfig, senhaDo, brl } from "../logic.js";
import { PizzaIlustrada } from "../ui.jsx";
import Cardapio, { chaveCarrinho } from "./Cardapio.jsx";

// Totem de autoatendimento (tablet ou tela touch no balcão). Mostra uma
// tela de boas-vindas, recebe o pedido, exibe a senha e volta ao início.
// Sem toque por 2 minutos, descarta o pedido em andamento.
const OCIOSO_MS = 2 * 60 * 1000;
const CONFIRMACAO_MS = 20 * 1000;

export default function Totem() {
  const [cfg] = useConfig();
  const [tela, setTela] = useState("inicio"); // inicio | pedindo | feito
  const [sessao, setSessao] = useState(0);
  const [feito, setFeito] = useState(null);

  function recomecar() {
    armazem.del(chaveCarrinho("balcao"));
    setFeito(null);
    setSessao((s) => s + 1);
    setTela("inicio");
  }

  useEffect(() => {
    document.body.classList.add("totem");
    return () => document.body.classList.remove("totem");
  }, []);

  useEffect(() => {
    if (tela === "inicio") return;
    let t;
    const armar = () => { clearTimeout(t); t = setTimeout(recomecar, tela === "feito" ? CONFIRMACAO_MS : OCIOSO_MS); };
    armar();
    const eventos = ["pointerdown", "keydown", "scroll"];
    eventos.forEach((e) => window.addEventListener(e, armar, { passive: true }));
    return () => { clearTimeout(t); eventos.forEach((e) => window.removeEventListener(e, armar)); };
  }, [tela]); // eslint-disable-line react-hooks/exhaustive-deps

  if (tela === "inicio") {
    return (
      <div className="atracao" onClick={() => setTela("pedindo")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setTela("pedindo")}>
        <PizzaIlustrada nome={cfg.loja.nome} className="gira" />
        <h1>{cfg.loja.nome}</h1>
        <div className="toque">Toque na tela para fazer seu pedido</div>
      </div>
    );
  }

  if (tela === "feito" && feito) {
    return (
      <div className="atracao" onClick={recomecar} role="button" tabIndex={0}>
        <div className="toque" style={{ animation: "none" }}>Pedido enviado para a cozinha!</div>
        <div style={{ fontSize: 22, opacity: 0.8 }}>Sua senha</div>
        <div className="senha-grande" style={{ color: "var(--borda-pizza)", fontSize: "clamp(110px, 22vw, 220px)" }}>{senhaDo(feito)}</div>
        <div style={{ fontSize: 22, maxWidth: 640 }}>
          {feito.nomeChamada}, acompanhe no painel. Total {brl(feito.total)} — pague no caixa ao retirar.
        </div>
        <button className="btn grande" style={{ marginTop: 10 }}>Novo pedido</button>
      </div>
    );
  }

  return (
    <div>
      <div className="linha" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={recomecar}>← Cancelar e voltar ao início</button>
      </div>
      <Cardapio key={sessao} canal="balcao" aoConcluirLocal={(p) => { setFeito(p); setTela("feito"); }} />
    </div>
  );
}
