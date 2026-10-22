import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { salvarItem, uid } from "../db.js";
import { brl, dataHora, useConfig } from "../logic.js";
import { useClienteAtual, Identificacao, sairCliente } from "../cliente.jsx";
import EscolherEndereco from "./Endereco.jsx";

export default function Carteira() {
  const [cfg] = useConfig();
  const [cliente, carregado, recarregar] = useClienteAtual();
  const [novo, setNovo] = useState(false);

  if (!carregado) return <div className="vazio">Carregando…</div>;
  if (!cliente) {
    return (
      <div className="cartao" style={{ maxWidth: 420, margin: "0 auto" }}>
        <Identificacao titulo="Entre para ver sua carteira" />
      </div>
    );
  }

  async function salvar(dados) {
    await salvarItem("cliente", dados);
    await recarregar();
  }

  return (
    <div className="coluna" style={{ maxWidth: 680, margin: "0 auto", gap: 16 }}>
      <div className="linha entre">
        <h1>Minha carteira</h1>
        <button className="btn pequeno" onClick={() => { sairCliente(); recarregar(); }}><LogOut size={14} /> Sair</button>
      </div>

      <div className="cartao" style={{ background: "linear-gradient(135deg, #b3261e, #7f1d17)", color: "#fff", border: "none" }}>
        <div className="pequeno" style={{ opacity: 0.85 }}>Saldo disponível</div>
        <div style={{ fontSize: 34, fontWeight: 800, fontFamily: "Fraunces, serif" }}>{brl(cliente.saldo)}</div>
        <div className="pequeno" style={{ opacity: 0.85 }}>
          {cliente.nome} · {cliente.telefone}
          {cfg.carteira.cashbackPercentual > 0 && <> · {cfg.carteira.cashbackPercentual}% de volta em cada pedido entregue</>}
        </div>
      </div>

      <div className="cartao coluna">
        <h3>Endereços salvos</h3>
        {(cliente.enderecos || []).map((e) => (
          <div key={e.id} className="linha" style={{ borderBottom: "1px solid #ecdcc8", paddingBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="forte">{e.rotulo}</div>
              <div className="suave pequeno">{e.complemento ? e.complemento + " — " : ""}{e.texto}</div>
            </div>
            <button className="btn pequeno perigo" onClick={() => salvar({ ...cliente, enderecos: cliente.enderecos.filter((x) => x.id !== e.id) })}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {novo ? (
          <EscolherEndereco
            textoBotao="Salvar endereço"
            aoCancelar={() => setNovo(false)}
            aoSalvar={async (e) => { await salvar({ ...cliente, enderecos: [...(cliente.enderecos || []), { id: uid(), ...e }] }); setNovo(false); }}
          />
        ) : (
          <button className="btn" onClick={() => setNovo(true)}>+ Adicionar endereço</button>
        )}
      </div>

      <div className="cartao">
        <h3 style={{ marginBottom: 8 }}>Extrato</h3>
        {!(cliente.movimentos || []).length && <div className="suave pequeno">Nenhuma movimentação ainda.</div>}
        <table className="tabela">
          <tbody>
            {(cliente.movimentos || []).map((m) => (
              <tr key={m.id}>
                <td className="suave pequeno">{dataHora(m.em)}</td>
                <td>{m.descricao}</td>
                <td className="forte" style={{ textAlign: "right", color: m.valor >= 0 ? "#15803d" : "#b91c1c" }}>
                  {m.valor >= 0 ? "+" : ""}{brl(m.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
