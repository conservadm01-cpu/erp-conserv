import { brl, useColecao, useConfig, nomeStatus, arred } from "../logic.js";
import { gravar } from "../db.js";
import { SeloStatus, toast } from "../ui.jsx";
import Cardapio from "./Cardapio.jsx";

// Página aberta pelo QR code da mesa: cardápio + pedidos da mesa em aberto.
export default function Mesa({ numero }) {
  const [cfg] = useConfig();
  const [pedidos] = useColecao("pedido", 8000);
  const n = Number(numero);

  if (!n || n < 1 || n > (cfg.salao.mesas || 0)) {
    return <div className="vazio">Mesa não encontrada. Peça ajuda a um atendente.</div>;
  }

  const abertos = pedidos
    .filter((p) => p.canal === "mesa" && p.mesa === n && !p.pago && p.status !== "cancelado")
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const consumo = arred(abertos.reduce((s, p) => s + p.total, 0));
  const servico = arred((consumo * (cfg.salao.taxaServicoPercentual || 0)) / 100);

  // O chamado aparece na tela "Salão" da loja até alguém atender.
  async function chamar(tipo) {
    await gravar(`chamado:${n}`, { mesa: n, tipo, em: new Date().toISOString() });
    toast(tipo === "conta" ? "Pedimos a conta. Um atendente já vem!" : "Chamamos um atendente. Já vamos até você!");
  }

  return (
    <div className="coluna" style={{ gap: 20 }}>
      <div className="linha">
        <button className="btn" onClick={() => chamar("garcom")}>🙋 Chamar atendente</button>
      </div>
      {abertos.length > 0 && (
        <section className="cartao coluna">
          <div className="linha entre">
            <h3>Conta da mesa {n}</h3>
            <span className="preco">{brl(consumo)}</span>
          </div>
          {abertos.map((p) => (
            <div key={p.id} className="linha pequeno" style={{ flexWrap: "nowrap" }}>
              <span style={{ flex: 1, minWidth: 0 }}>{p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}</span>
              <span className="suave">{nomeStatus(p)}</span>
              <SeloStatus status={p.status} />
            </div>
          ))}
          {servico > 0 && <div className="suave pequeno">+ taxa de serviço ({cfg.salao.taxaServicoPercentual}%): {brl(servico)}</div>}
          <button className="btn" onClick={() => chamar("conta")}>Pedir a conta</button>
        </section>
      )}
      <Cardapio canal="mesa" mesa={n} aoConcluirLocal={(p) => { toast("Pedido enviado para a cozinha! 🍕"); window.location.hash = `#/pedido/${p.id}`; }} />
    </div>
  );
}
