import { useState } from "react";
import { Plus, Trash2, Pencil, Sparkles } from "lucide-react";
import { salvarItem, removerItem, uid } from "../../db.js";
import { brl, CATEGORIAS, useColecao, criarExemplos } from "../../logic.js";
import { Modal, Campo, Emoji, numero, toast, BotaoConfirmar } from "../../ui.jsx";

const VAZIO = { nome: "", categoria: "pizza", descricao: "", imagem: "", ativo: true, meioAMeio: true, tamanhos: [{ nome: "Grande", preco: "" }] };

export default function Produtos() {
  const [produtos, carregado] = useColecao("produto");
  const [editando, setEditando] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  const lista = produtos
    .filter((p) => filtro === "todas" || p.categoria === filtro)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));

  return (
    <div className="coluna">
      <div className="linha">
        <h2>Produtos</h2>
        <button className="btn primario direita" onClick={() => setEditando({ ...VAZIO })}><Plus size={16} /> Novo produto</button>
      </div>
      <div className="abas">
        <button className={filtro === "todas" ? "ativo" : ""} onClick={() => setFiltro("todas")}>Todos ({produtos.length})</button>
        {Object.entries(CATEGORIAS).map(([k, v]) => (
          <button key={k} className={filtro === k ? "ativo" : ""} onClick={() => setFiltro(k)}>{v}</button>
        ))}
      </div>

      {carregado && produtos.length === 0 && (
        <div className="cartao vazio coluna" style={{ alignItems: "center" }}>
          Nenhum produto cadastrado ainda.
          <button className="btn" onClick={async () => { await criarExemplos(); toast("Cardápio de exemplo criado"); }}>
            <Sparkles size={16} /> Criar cardápio, promoções e motoboy de exemplo
          </button>
        </div>
      )}

      <div className="grade">
        {lista.map((p) => (
          <div key={p.id} className="cartao coluna" style={{ gap: 6, opacity: p.ativo === false ? 0.55 : 1 }}>
            <div className="linha entre">
              <h3><Emoji categoria={p.categoria} /> {p.nome}</h3>
              {p.ativo === false && <span className="selo claro">Pausado</span>}
            </div>
            <div className="suave pequeno">{p.descricao}</div>
            <div className="pequeno">{p.tamanhos.map((t) => `${t.nome} ${brl(t.preco)}`).join(" · ")}</div>
            <div className="linha">
              <button className="btn pequeno" onClick={() => setEditando({ ...p, tamanhos: p.tamanhos.map((t) => ({ ...t })) })}><Pencil size={14} /> Editar</button>
              <button className="btn pequeno" onClick={() => salvarItem("produto", { ...p, ativo: p.ativo === false })}>{p.ativo === false ? "Reativar" : "Pausar"}</button>
              <BotaoConfirmar className="btn pequeno perigo direita" texto="Excluir?" aoConfirmar={() => removerItem("produto", p.id)}><Trash2 size={14} /></BotaoConfirmar>
            </div>
          </div>
        ))}
      </div>

      {editando && <FormProduto inicial={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function FormProduto({ inicial, aoFechar }) {
  const [p, setP] = useState(inicial);
  const set = (campo, valor) => setP({ ...p, [campo]: valor });
  const setTam = (i, campo, valor) => set("tamanhos", p.tamanhos.map((t, k) => (k === i ? { ...t, [campo]: valor } : t)));
  const ehPizza = p.categoria === "pizza" || p.categoria === "doce";

  async function salvar(e) {
    e.preventDefault();
    const tamanhos = p.tamanhos.filter((t) => t.nome.trim()).map((t) => ({ nome: t.nome.trim(), preco: numero(t.preco) }));
    if (!p.nome.trim() || !tamanhos.length) return toast("Informe nome e pelo menos um preço.");
    await salvarItem("produto", { ...p, id: p.id || uid(), nome: p.nome.trim(), tamanhos, meioAMeio: ehPizza && p.meioAMeio });
    toast("Produto salvo");
    aoFechar();
  }

  return (
    <Modal titulo={p.id ? "Editar produto" : "Novo produto"} aoFechar={aoFechar}>
      <form className="coluna" onSubmit={salvar}>
        <Campo rotulo="Nome" value={p.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
        <Campo rotulo="Categoria">
          <select value={p.categoria} onChange={(e) => set("categoria", e.target.value)}>
            {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Descrição / ingredientes">
          <textarea rows={2} value={p.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </Campo>
        <Campo rotulo="Foto (link da imagem, opcional)" placeholder="https://…" value={p.imagem} onChange={(e) => set("imagem", e.target.value)} />

        <div className="forte pequeno suave">Tamanhos e preços</div>
        {p.tamanhos.map((t, i) => (
          <div key={i} className="linha" style={{ flexWrap: "nowrap" }}>
            <input className="in" placeholder="Tamanho (ex.: Broto, Grande, 2L)" value={t.nome} onChange={(e) => setTam(i, "nome", e.target.value)} />
            <input className="in" style={{ maxWidth: 110 }} inputMode="decimal" placeholder="Preço" value={t.preco} onChange={(e) => setTam(i, "preco", e.target.value)} />
            <button type="button" className="btn pequeno perigo" onClick={() => set("tamanhos", p.tamanhos.filter((_, k) => k !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="btn pequeno" onClick={() => set("tamanhos", [...p.tamanhos, { nome: "", preco: "" }])}>+ Tamanho</button>

        {ehPizza && (
          <label className="check"><input type="checkbox" checked={!!p.meioAMeio} onChange={(e) => set("meioAMeio", e.target.checked)} /> Pode ser meio a meio</label>
        )}
        <label className="check"><input type="checkbox" checked={p.ativo !== false} onChange={(e) => set("ativo", e.target.checked)} /> Disponível no cardápio</label>
        <button className="btn primario">Salvar</button>
      </form>
    </Modal>
  );
}
