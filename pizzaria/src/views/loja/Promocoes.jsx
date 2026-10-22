import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { salvarItem, removerItem, uid } from "../../db.js";
import { brl, CATEGORIAS, useColecao, promocaoValida } from "../../logic.js";
import { Modal, Campo, numero, toast, BotaoConfirmar } from "../../ui.jsx";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const VAZIO = {
  nome: "", tipo: "automatica", codigo: "", descontoTipo: "percentual", valor: "", alvo: "pedido", alvoId: "",
  pedidoMinimo: "", diasSemana: [], inicio: "", fim: "", limiteUsos: "", ativo: true,
};

function descrever(p, produtos) {
  const valor = p.descontoTipo === "frete" ? "Frete grátis" : p.descontoTipo === "percentual" ? `${p.valor}% off` : `${brl(p.valor)} off`;
  const alvo = p.alvo === "categoria" ? ` em ${CATEGORIAS[p.alvoId] || p.alvoId}` : p.alvo === "produto" ? ` em ${produtos.find((x) => x.id === p.alvoId)?.nome || "produto"}` : "";
  const min = p.pedidoMinimo ? ` · acima de ${brl(p.pedidoMinimo)}` : "";
  const dias = p.diasSemana?.length ? ` · ${p.diasSemana.map((d) => DIAS[d]).join(", ")}` : "";
  return valor + (p.descontoTipo === "frete" ? "" : alvo) + min + dias;
}

export default function Promocoes() {
  const [promocoes] = useColecao("promocao");
  const [produtos] = useColecao("produto");
  const [editando, setEditando] = useState(null);

  return (
    <div className="coluna">
      <div className="linha">
        <h2>Promoções e cupons</h2>
        <button className="btn primario direita" onClick={() => setEditando({ ...VAZIO })}><Plus size={16} /> Nova promoção</button>
      </div>
      <div className="suave pequeno">
        Promoções <b>automáticas</b> entram sozinhas no carrinho quando as regras batem. <b>Cupons</b> só valem com o código digitado no checkout.
      </div>
      {promocoes.length === 0 && <div className="vazio">Nenhuma promoção cadastrada.</div>}
      <div className="grade">
        {promocoes.map((p) => (
          <div key={p.id} className="cartao coluna" style={{ gap: 6 }}>
            <div className="linha entre">
              <h3>{p.nome || p.codigo}</h3>
              {promocaoValida(p) ? <span className="selo" style={{ background: "#15803d" }}>Valendo</span> : <span className="selo claro">Inativa</span>}
            </div>
            <div className="pequeno">
              {p.tipo === "cupom" ? <span className="selo" style={{ background: "#6d5bd0" }}>Cupom {p.codigo}</span> : <span className="selo claro">Automática</span>}
            </div>
            <div className="suave pequeno">{descrever(p, produtos)}</div>
            <div className="suave pequeno">
              Usos: {p.usos || 0}{p.limiteUsos ? ` / ${p.limiteUsos}` : ""}{p.fim ? ` · até ${p.fim.split("-").reverse().join("/")}` : ""}
            </div>
            <div className="linha">
              <button className="btn pequeno" onClick={() => setEditando({ ...VAZIO, ...p })}><Pencil size={14} /> Editar</button>
              <button className="btn pequeno" onClick={() => salvarItem("promocao", { ...p, ativo: !p.ativo })}>{p.ativo ? "Pausar" : "Ativar"}</button>
              <BotaoConfirmar className="btn pequeno perigo direita" texto="Excluir?" aoConfirmar={() => removerItem("promocao", p.id)}><Trash2 size={14} /></BotaoConfirmar>
            </div>
          </div>
        ))}
      </div>
      {editando && <FormPromocao inicial={editando} produtos={produtos} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function FormPromocao({ inicial, produtos, aoFechar }) {
  const [p, setP] = useState(inicial);
  const set = (c, v) => setP({ ...p, [c]: v });

  async function salvar(e) {
    e.preventDefault();
    if (p.tipo === "cupom" && !p.codigo.trim()) return toast("Informe o código do cupom.");
    if (p.descontoTipo !== "frete" && !numero(p.valor)) return toast("Informe o valor do desconto.");
    await salvarItem("promocao", {
      ...p,
      id: p.id || uid(),
      nome: p.nome.trim() || p.codigo.trim().toUpperCase(),
      codigo: p.codigo.trim().toUpperCase(),
      valor: numero(p.valor),
      pedidoMinimo: numero(p.pedidoMinimo),
      limiteUsos: numero(p.limiteUsos),
      alvo: p.descontoTipo === "frete" ? "pedido" : p.alvo,
    });
    toast("Promoção salva");
    aoFechar();
  }

  return (
    <Modal titulo={p.id ? "Editar promoção" : "Nova promoção"} aoFechar={aoFechar}>
      <form className="coluna" onSubmit={salvar}>
        <Campo rotulo="Nome (aparece para o cliente)" placeholder="Ex.: Terça da pizza" value={p.nome} onChange={(e) => set("nome", e.target.value)} />
        <div className="campos">
          <Campo rotulo="Tipo">
            <select value={p.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="automatica">Automática</option>
              <option value="cupom">Cupom com código</option>
            </select>
          </Campo>
          {p.tipo === "cupom" && <Campo rotulo="Código" value={p.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} />}
        </div>
        <div className="campos">
          <Campo rotulo="Desconto">
            <select value={p.descontoTipo} onChange={(e) => set("descontoTipo", e.target.value)}>
              <option value="percentual">Percentual (%)</option>
              <option value="valor">Valor fixo (R$)</option>
              <option value="frete">Frete grátis</option>
            </select>
          </Campo>
          {p.descontoTipo !== "frete" && <Campo rotulo={p.descontoTipo === "percentual" ? "%" : "R$"} inputMode="decimal" value={p.valor} onChange={(e) => set("valor", e.target.value)} />}
        </div>
        {p.descontoTipo !== "frete" && (
          <div className="campos">
            <Campo rotulo="Vale para">
              <select value={p.alvo} onChange={(e) => set("alvo", e.target.value)}>
                <option value="pedido">Pedido inteiro</option>
                <option value="categoria">Uma categoria</option>
                <option value="produto">Um produto</option>
              </select>
            </Campo>
            {p.alvo === "categoria" && (
              <Campo rotulo="Categoria">
                <select value={p.alvoId} onChange={(e) => set("alvoId", e.target.value)}>
                  <option value="">Escolha…</option>
                  {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            )}
            {p.alvo === "produto" && (
              <Campo rotulo="Produto">
                <select value={p.alvoId} onChange={(e) => set("alvoId", e.target.value)}>
                  <option value="">Escolha…</option>
                  {produtos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              </Campo>
            )}
          </div>
        )}
        <div className="campos">
          <Campo rotulo="Pedido mínimo (R$)" inputMode="decimal" value={p.pedidoMinimo} onChange={(e) => set("pedidoMinimo", e.target.value)} />
          <Campo rotulo="Limite de usos" inputMode="numeric" placeholder="sem limite" value={p.limiteUsos} onChange={(e) => set("limiteUsos", e.target.value)} />
        </div>
        <div className="campos">
          <Campo rotulo="Início" type="date" value={p.inicio} onChange={(e) => set("inicio", e.target.value)} />
          <Campo rotulo="Fim" type="date" value={p.fim} onChange={(e) => set("fim", e.target.value)} />
        </div>
        <div className="forte pequeno suave">Dias da semana (nenhum marcado = todos)</div>
        <div className="linha">
          {DIAS.map((d, i) => (
            <label key={i} className="check pequeno">
              <input
                type="checkbox"
                checked={p.diasSemana.includes(i)}
                onChange={(e) => set("diasSemana", e.target.checked ? [...p.diasSemana, i] : p.diasSemana.filter((x) => x !== i))}
              />
              {d}
            </label>
          ))}
        </div>
        <label className="check"><input type="checkbox" checked={p.ativo} onChange={(e) => set("ativo", e.target.checked)} /> Ativa</label>
        <button className="btn primario">Salvar</button>
      </form>
    </Modal>
  );
}
