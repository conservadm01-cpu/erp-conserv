import { useEffect, useState } from "react";
import { Search, ShoppingBag, Minus, Plus, Trash2, Tag } from "lucide-react";
import { uid, armazem } from "../db.js";
import { brl, CATEGORIAS, useColecao, precoPromocional, promocaoValida } from "../logic.js";
import { Modal, Emoji } from "../ui.jsx";
import Checkout from "./Checkout.jsx";

// ---------- Carrinho (fica salvo no aparelho) ----------
function useCarrinho() {
  const [itens, setItens] = useState(() => {
    try { return JSON.parse(armazem.get("pz-carrinho")) || []; } catch { return []; }
  });
  useEffect(() => { armazem.set("pz-carrinho", JSON.stringify(itens)); }, [itens]);
  return [itens, setItens];
}

export default function Cardapio() {
  const [produtos, carregado] = useColecao("produto");
  const [promocoes] = useColecao("promocao", 60000);
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [carrinho, setCarrinho] = useCarrinho();
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [checkout, setCheckout] = useState(false);

  const ativos = produtos.filter((p) => p.ativo !== false);
  const categorias = Object.keys(CATEGORIAS).filter((c) => ativos.some((p) => p.categoria === c));
  const visiveis = ativos
    .filter((p) => categoria === "todas" || p.categoria === categoria)
    .filter((p) => !busca || (p.nome + " " + (p.descricao || "")).toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => Object.keys(CATEGORIAS).indexOf(a.categoria) - Object.keys(CATEGORIAS).indexOf(b.categoria) || a.nome.localeCompare(b.nome));

  const banners = promocoes.filter((p) => p.tipo !== "cupom" && promocaoValida(p));

  const qtdTotal = carrinho.reduce((s, i) => s + i.qtd, 0);
  const subtotal = carrinho.reduce((s, i) => s + i.qtd * i.precoUnit, 0);

  return (
    <div className="coluna" style={{ gap: 16 }}>
      {banners.length > 0 && (
        <div className="linha" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
          {banners.map((p) => (
            <div key={p.id} className="cartao linha" style={{ background: "#fff4e0", borderColor: "#f1d29e", flex: "none", padding: "10px 14px" }}>
              <Tag size={16} color="#b3261e" /> <span className="forte">{p.nome}</span>
            </div>
          ))}
        </div>
      )}

      <div className="linha">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: "absolute", left: 11, top: 12, color: "#7a6656" }} />
          <input className="in" style={{ paddingLeft: 34 }} placeholder="Buscar sabor, bebida…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <div className="abas">
        <button className={categoria === "todas" ? "ativo" : ""} onClick={() => setCategoria("todas")}>Tudo</button>
        {categorias.map((c) => (
          <button key={c} className={categoria === c ? "ativo" : ""} onClick={() => setCategoria(c)}>
            <Emoji categoria={c} /> {CATEGORIAS[c]}
          </button>
        ))}
      </div>

      {!carregado ? (
        <div className="vazio">Carregando cardápio…</div>
      ) : visiveis.length === 0 ? (
        <div className="vazio">
          {ativos.length === 0 ? "O cardápio ainda está vazio. Cadastre produtos na Área da loja." : "Nada encontrado."}
        </div>
      ) : (
        <div className="grade">
          {visiveis.map((p) => {
            const promo = precoPromocional(p, promocoes);
            const menor = Math.min(...p.tamanhos.map((t) => t.preco));
            return (
              <div key={p.id} className="cartao produto" onClick={() => setAberto(p)}>
                <div className="foto" style={p.imagem ? { backgroundImage: `url(${p.imagem})` } : null}>
                  {!p.imagem && <Emoji categoria={p.categoria} />}
                </div>
                <div className="coluna" style={{ gap: 4, minWidth: 0 }}>
                  <h3>{p.nome}</h3>
                  <div className="suave pequeno">{p.descricao}</div>
                  <div className="linha" style={{ gap: 6 }}>
                    {promo ? (
                      <>
                        <span className="riscado">{brl(menor)}</span>
                        <span className="preco">{p.tamanhos.length > 1 ? "a partir de " : ""}{brl(menor * (1 - promo.valor / 100))}</span>
                        <span className="selo" style={{ background: "#b3261e" }}>-{promo.valor}%</span>
                      </>
                    ) : (
                      <span className="preco">{p.tamanhos.length > 1 ? "a partir de " : ""}{brl(menor)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aberto && (
        <ModalProduto
          produto={aberto}
          produtos={ativos}
          aoFechar={() => setAberto(null)}
          aoAdicionar={(item) => { setCarrinho([...carrinho, item]); setAberto(null); }}
        />
      )}

      {qtdTotal > 0 && !verCarrinho && !checkout && (
        <div className="barra-carrinho">
          <button className="btn primario" onClick={() => setVerCarrinho(true)}>
            <ShoppingBag size={18} /> Ver sacola ({qtdTotal}) <span className="direita">{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {verCarrinho && (
        <Modal titulo="Sua sacola" aoFechar={() => setVerCarrinho(false)}>
          <Sacola itens={carrinho} setItens={setCarrinho} />
          <div className="linha entre" style={{ marginTop: 14 }}>
            <span className="forte">Subtotal {brl(subtotal)}</span>
            <button className="btn primario" disabled={!carrinho.length} onClick={() => { setVerCarrinho(false); setCheckout(true); }}>
              Continuar
            </button>
          </div>
        </Modal>
      )}

      {checkout && (
        <Checkout
          itens={carrinho}
          promocoes={promocoes}
          aoFechar={() => setCheckout(false)}
          aoConcluir={(pedido) => { setCarrinho([]); setCheckout(false); window.location.hash = `#/pedido/${pedido.id}`; }}
        />
      )}
    </div>
  );
}

function Sacola({ itens, setItens }) {
  if (!itens.length) return <div className="vazio">Sacola vazia.</div>;
  const mudar = (chave, delta) =>
    setItens(itens.map((i) => (i.chave === chave ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)));
  return (
    <div className="coluna">
      {itens.map((i) => (
        <div key={i.chave} className="linha" style={{ borderBottom: "1px solid #ecdcc8", paddingBottom: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div className="forte">{i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""}</div>
            <div className="suave pequeno">{i.tamanho}{i.sabor2 ? " · meio a meio" : ""}{i.obs ? ` · ${i.obs}` : ""}</div>
            <div className="preco pequeno">{brl(i.precoUnit * i.qtd)}</div>
          </div>
          <div className="linha" style={{ gap: 4 }}>
            <button className="btn pequeno" onClick={() => mudar(i.chave, -1)}><Minus size={14} /></button>
            <span style={{ minWidth: 20, textAlign: "center" }}>{i.qtd}</span>
            <button className="btn pequeno" onClick={() => mudar(i.chave, 1)}><Plus size={14} /></button>
            <button className="btn pequeno perigo" onClick={() => setItens(itens.filter((x) => x.chave !== i.chave))}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalProduto({ produto, produtos, aoFechar, aoAdicionar }) {
  const [tamanho, setTamanho] = useState(produto.tamanhos[produto.tamanhos.length - 1].nome);
  const [meio, setMeio] = useState(false);
  const [sabor2, setSabor2] = useState("");
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  // Meio a meio: só sabores da mesma categoria que tenham o mesmo tamanho;
  // cobra o preço do sabor mais caro, como é o costume.
  const opcoesMeio = produtos.filter(
    (p) => p.id !== produto.id && p.categoria === produto.categoria && p.meioAMeio && p.tamanhos.some((t) => t.nome === tamanho)
  );
  const segundo = meio ? opcoesMeio.find((p) => p.id === sabor2) : null;
  const precoDe = (p) => p.tamanhos.find((t) => t.nome === tamanho)?.preco || 0;
  const precoUnit = Math.max(precoDe(produto), segundo ? precoDe(segundo) : 0);

  return (
    <Modal titulo={produto.nome} aoFechar={aoFechar}>
      <div className="coluna">
        {produto.imagem && <img src={produto.imagem} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} />}
        <div className="suave">{produto.descricao}</div>

        {produto.tamanhos.length > 1 && (
          <>
            <div className="forte pequeno">Tamanho</div>
            {produto.tamanhos.map((t) => (
              <button key={t.nome} className={"opcao" + (tamanho === t.nome ? " sel" : "")} onClick={() => setTamanho(t.nome)}>
                <span style={{ flex: 1 }}>{t.nome}</span>
                <span className="preco">{brl(t.preco)}</span>
              </button>
            ))}
          </>
        )}

        {produto.meioAMeio && opcoesMeio.length > 0 && (
          <>
            <label className="check">
              <input type="checkbox" checked={meio} onChange={(e) => setMeio(e.target.checked)} /> Quero meio a meio
            </label>
            {meio && (
              <select className="in" value={sabor2} onChange={(e) => setSabor2(e.target.value)}>
                <option value="">Escolha o segundo sabor…</option>
                {opcoesMeio.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {brl(precoDe(p))}</option>
                ))}
              </select>
            )}
          </>
        )}

        <label className="campo">
          Observação
          <textarea rows={2} placeholder="Ex.: sem cebola, bem assada…" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>

        <div className="linha entre">
          <div className="linha" style={{ gap: 4 }}>
            <button className="btn" onClick={() => setQtd(Math.max(1, qtd - 1))}><Minus size={16} /></button>
            <span className="forte" style={{ minWidth: 26, textAlign: "center" }}>{qtd}</span>
            <button className="btn" onClick={() => setQtd(qtd + 1)}><Plus size={16} /></button>
          </div>
          <button
            className="btn primario"
            disabled={meio && !segundo}
            onClick={() =>
              aoAdicionar({
                chave: uid(), produtoId: produto.id, nome: produto.nome, categoria: produto.categoria, tamanho,
                sabor2: segundo ? { id: segundo.id, nome: segundo.nome } : null, qtd, precoUnit, obs: obs.trim(),
              })
            }
          >
            Adicionar {brl(precoUnit * qtd)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
