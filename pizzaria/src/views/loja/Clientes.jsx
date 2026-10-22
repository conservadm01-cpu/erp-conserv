import { useState } from "react";
import { brl, dataHora, useColecao, movimentarCarteira } from "../../logic.js";
import { Modal, Campo, SeloStatus, numero, toast } from "../../ui.jsx";

export default function Clientes() {
  const [clientes] = useColecao("cliente", 30000);
  const [pedidos] = useColecao("pedido", 30000);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);

  const stats = (id) => {
    const ps = pedidos.filter((p) => p.cliente?.id === id && p.status === "entregue");
    return { qtd: ps.length, total: ps.reduce((s, p) => s + p.total, 0), ultimo: ps.map((p) => p.criadoEm).sort().pop() };
  };
  const lista = clientes
    .filter((c) => !busca || (c.nome + c.telefone).toLowerCase().includes(busca.toLowerCase()))
    .map((c) => ({ ...c, ...stats(c.id) }))
    .sort((a, b) => b.total - a.total);
  const atual = aberto && clientes.find((c) => c.id === aberto);

  return (
    <div className="coluna">
      <h2>Carteira de clientes</h2>
      <input className="in" placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <div className="cartao" style={{ overflowX: "auto" }}>
        <table className="tabela">
          <thead><tr><th>Cliente</th><th>Telefone</th><th>Pedidos</th><th>Gasto total</th><th>Último</th><th>Saldo</th></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} onClick={() => setAberto(c.id)} style={{ cursor: "pointer" }}>
                <td className="forte">{c.nome}</td>
                <td>{c.telefone}</td>
                <td>{c.qtd}</td>
                <td>{brl(c.total)}</td>
                <td className="suave pequeno">{dataHora(c.ultimo)}</td>
                <td className="forte" style={{ color: "#15803d" }}>{brl(c.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <div className="vazio">Nenhum cliente ainda. Eles se cadastram sozinhos ao fazer o primeiro pedido.</div>}
      </div>
      {atual && <DetalheCliente c={atual} pedidos={pedidos.filter((p) => p.cliente?.id === atual.id)} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

function DetalheCliente({ c, pedidos, aoFechar }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  async function lancar(sinal) {
    const v = numero(valor);
    if (!v) return toast("Informe o valor.");
    if (sinal < 0 && v > (c.saldo || 0)) return toast("Saldo insuficiente.");
    await movimentarCarteira(c.id, sinal * v, motivo.trim() || (sinal > 0 ? "Crédito da loja" : "Débito da loja"));
    setValor(""); setMotivo("");
    toast("Lançamento feito");
  }

  return (
    <Modal titulo={c.nome} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 14 }}>
        <div className="suave">{c.telefone} · cliente desde {dataHora(c.criadoEm)}</div>
        <div className="cartao linha entre" style={{ background: "#f0fbf3" }}>
          <span>Saldo na carteira</span><span className="forte" style={{ fontSize: 22 }}>{brl(c.saldo)}</span>
        </div>
        <div className="coluna">
          <div className="forte pequeno">Lançar crédito / débito</div>
          <div className="campos">
            <Campo rotulo="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            <Campo rotulo="Motivo" placeholder="Ex.: pedido atrasou, brinde" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <div className="linha">
            <button className="btn verde" onClick={() => lancar(1)}>+ Creditar</button>
            <button className="btn perigo" onClick={() => lancar(-1)}>− Debitar</button>
          </div>
        </div>
        <div>
          <div className="forte pequeno" style={{ marginBottom: 6 }}>Endereços</div>
          {(c.enderecos || []).map((e) => <div key={e.id} className="pequeno">📍 <b>{e.rotulo}</b> {e.complemento} — {e.texto}</div>)}
        </div>
        <div>
          <div className="forte pequeno" style={{ marginBottom: 6 }}>Pedidos</div>
          {pedidos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((p) => (
            <div key={p.id} className="linha pequeno" style={{ padding: "3px 0" }}>
              <span>#{p.numero}</span><span className="suave">{dataHora(p.criadoEm)}</span><SeloStatus status={p.status} /><span className="direita">{brl(p.total)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="forte pequeno" style={{ marginBottom: 6 }}>Extrato da carteira</div>
          {(c.movimentos || []).map((m) => (
            <div key={m.id} className="linha pequeno" style={{ padding: "3px 0" }}>
              <span className="suave">{dataHora(m.em)}</span><span>{m.descricao}</span>
              <span className="direita forte" style={{ color: m.valor >= 0 ? "#15803d" : "#b91c1c" }}>{brl(m.valor)}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
