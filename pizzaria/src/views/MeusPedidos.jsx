import { brl, dataHora, useColecao } from "../logic.js";
import { SeloStatus } from "../ui.jsx";
import { useClienteAtual, Identificacao } from "../cliente.jsx";

export default function MeusPedidos() {
  const [cliente, carregado] = useClienteAtual();
  const [pedidos] = useColecao("pedido", 15000);

  if (!carregado) return <div className="vazio">Carregando…</div>;
  if (!cliente) {
    return (
      <div className="cartao" style={{ maxWidth: 420, margin: "0 auto" }}>
        <Identificacao titulo="Entre para ver seus pedidos" />
      </div>
    );
  }

  const meus = pedidos.filter((p) => p.cliente?.id === cliente.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <div className="coluna" style={{ maxWidth: 680, margin: "0 auto" }}>
      <h1>Meus pedidos</h1>
      {meus.length === 0 && <div className="vazio">Você ainda não fez pedidos. <a href="#/">Ver cardápio</a></div>}
      {meus.map((p) => (
        <a key={p.id} href={`#/pedido/${p.id}`} className="cartao linha" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ flex: 1 }}>
            <div className="forte">#{p.numero} · {dataHora(p.criadoEm)}</div>
            <div className="suave pequeno">{p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ")}</div>
          </div>
          <div className="coluna" style={{ alignItems: "flex-end", gap: 4 }}>
            <SeloStatus status={p.status} />
            <span className="preco">{brl(p.total)}</span>
          </div>
        </a>
      ))}
    </div>
  );
}
