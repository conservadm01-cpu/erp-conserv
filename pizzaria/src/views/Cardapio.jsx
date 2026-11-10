import { useEffect, useState } from "react";
import { Search, ShoppingBag, Minus, Plus, Trash2, Tag, Clock, Bike } from "lucide-react";
import { uid, armazem } from "../db.js";
import { brl, CATEGORIAS, useColecao, useConfig, precoPromocional, promocaoValida } from "../logic.js";
import { Modal, Emoji, FotoProduto, PizzaIlustrada } from "../ui.jsx";
import Checkout from "./Checkout.jsx";
import CheckoutLocal from "./CheckoutLocal.jsx";

// ---------- Carrinho (fica salvo no aparelho, um por canal) ----------
function useCarrinho(chave) {
  const [itens, setItens] = useState(() => {
    try { return JSON.parse(armazem.get(chave)) || []; } catch { return []; }
  });
  useEffect(() => { armazem.set(chave, JSON.stringify(itens)); }, [chave, itens]);
  return [itens, setItens];
}

const ORDEM = Object.keys(CATEGORIAS);
export const chaveCarrinho = (canal, mesa) => (canal === "delivery" ? "pz-carrinho" : `pz-carrinho-${canal}${mesa || ""}`);

// canal: "delivery" (site), "mesa" (QR code na mesa) ou "balcao" (totem).
export default function Cardapio({ canal = "delivery", mesa = null, aoConcluirLocal }) {
  const [cfg] = useConfig();
  const [produtos, carregado] = useColecao("produto", 120000);
  const [promocoes] = useColecao("promocao", 60000);
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [carrinho, setCarrinho] = useCarrinho(chaveCarrinho(canal, mesa));
  const [verCarrinho, setVerCarrinho] = useState(false);
  const [checkout, setCheckout] = useState(false);

  const ativos = produtos.filter((p) => p.ativo !== false);
  const categorias = ORDEM.filter((c) => ativos.some((p) => p.categoria === c));
  const filtrados = ativos
    .filter((p) => categoria === "todas" || p.categoria === categoria)
    .filter((p) => !busca || (p.nome + " " + (p.descricao || "")).toLowerCase().includes(busca.toLowerCase()));
  const grupos = categorias
    .map((c) => [c, filtrados.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome))])
    .filter(([, l]) => l.length);

  const banners = promocoes.filter((p) => p.tipo !== "cupom" && promocaoValida(p));
  const qtdTotal = carrinho.reduce((s, i) => s + i.qtd, 0);
  const subtotal = carrinho.reduce((s, i) => s + i.qtd * i.precoUnit, 0);
  const local = canal !== "delivery";

  return (
    <div className="coluna" style={{ gap: 18 }}>
      <section className="vitrine">
        <div>
          <div className="rotulo" style={{ color: "rgba(255,255,255,.55)" }}>
            {canal === "mesa" ? `Mesa ${mesa} · peça por aqui` : canal === "balcao" ? "Autoatendimento" : "Cardápio online"}
          </div>
          <h1>{canal === "balcao" ? "Monte seu pedido" : cfg.loja.nome}</h1>
          <div className="sub">
            {local ? (
              <>
                <span><Clock size={15} style={{ verticalAlign: -2 }} /> Fica pronto em ~<b>{cfg.salao.tempoPreparoMin} min</b></span>
                <span>{canal === "mesa" ? "Levamos até a sua mesa" : "Chamamos pelo seu nome no painel"}</span>
              </>
            ) : (
              <>
                <span className="aberto"><span className="pulso" /> Aberto agora</span>
                <span><Bike size={15} style={{ verticalAlign: -2 }} /> Entrega a partir de <b>{brl(cfg.entrega.taxaBase)}</b></span>
                <span>até {cfg.entrega.raioMaxKm} km</span>
              </>
            )}
          </div>
        </div>
        <PizzaIlustrada nome={cfg.loja.nome} className="pizza-grande" />
      </section>

      {banners.length > 0 && (
        <div className="faixa-promos">
          {banners.map((p) => (
            <div key={p.id} className="promo"><Tag size={15} /> {p.nome}</div>
          ))}
        </div>
      )}

      <div className="busca">
        <Search size={17} />
        <input className="in" placeholder="Buscar sabor, bebida…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="abas">
        <button className={categoria === "todas" ? "ativo" : ""} onClick={() => setCategoria("todas")}>Tudo</button>
        {categorias.map((c) => (
          <button key={c} className={categoria === c ? "ativo" : ""} onClick={() => setCategoria(c)}>
            {CATEGORIAS[c]}
          </button>
        ))}
      </div>

      {!carregado ? (
        <div className="vazio">Carregando cardápio…</div>
      ) : grupos.length === 0 ? (
        <div className="vazio">
          {ativos.length === 0 ? "O cardápio ainda está vazio. Cadastre produtos na área da loja." : "Nada encontrado com essa busca."}
        </div>
      ) : (
        grupos.map(([c, lista]) => (
          <section key={c} className="coluna" style={{ gap: 12 }}>
            <div className="secao-cat"><h2>{CATEGORIAS[c]}</h2><span className="conta">{lista.length}</span></div>
            <div className="produtos">
              {lista.map((p) => <CartaoProduto key={p.id} p={p} promo={precoPromocional(p, promocoes)} aoAbrir={() => setAberto(p)} />)}
            </div>
          </section>
        ))
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
            <ShoppingBag size={19} /> {local ? "Ver pedido" : "Ver sacola"} <span className="qtd">{qtdTotal}</span>
            <span className="direita">{brl(subtotal)}</span>
          </button>
        </div>
      )}

      {verCarrinho && (
        <Modal titulo={local ? "Seu pedido" : "Sua sacola"} aoFechar={() => setVerCarrinho(false)}>
          <Sacola itens={carrinho} setItens={setCarrinho} />
          <div className="linha entre" style={{ marginTop: 16 }}>
            <span className="forte">Subtotal {brl(subtotal)}</span>
            <button className="btn primario" disabled={!carrinho.length} onClick={() => { setVerCarrinho(false); setCheckout(true); }}>
              Continuar
            </button>
          </div>
        </Modal>
      )}

      {checkout && !local && (
        <Checkout
          itens={carrinho}
          promocoes={promocoes}
          aoFechar={() => setCheckout(false)}
          aoConcluir={(pedido) => { setCarrinho([]); setCheckout(false); window.location.hash = `#/pedido/${pedido.id}`; }}
        />
      )}
      {checkout && local && (
        <CheckoutLocal
          canal={canal}
          mesa={mesa}
          itens={carrinho}
          promocoes={promocoes}
          aoFechar={() => setCheckout(false)}
          aoConcluir={(pedido) => { setCarrinho([]); setCheckout(false); aoConcluirLocal(pedido); }}
        />
      )}
    </div>
  );
}

function CartaoProduto({ p, promo, aoAbrir }) {
  const menor = Math.min(...p.tamanhos.map((t) => t.preco));
  const varios = p.tamanhos.length > 1;
  return (
    <button className="produto" onClick={aoAbrir}>
      <div className="foto" style={p.imagem ? { backgroundImage: `url(${p.imagem})` } : null}>
        <FotoProduto produto={p} />
        {promo && <span className="selo">-{promo.valor}%</span>}
      </div>
      <div className="info">
        <h3>{p.nome}</h3>
        <div className="desc">{p.descricao}</div>
        <div className="rodape-card">
          <span className="etiqueta">
            {varios && <small>a partir de</small>}
            {promo && <span className="riscado">{brl(menor)}</span>}
            <span className="preco">{brl(promo ? menor * (1 - promo.valor / 100) : menor)}</span>
          </span>
          <span className="mais" aria-hidden="true"><Plus size={18} /></span>
        </div>
      </div>
    </button>
  );
}

function Sacola({ itens, setItens }) {
  if (!itens.length) return <div className="vazio">Nada aqui ainda.</div>;
  const mudar = (chave, delta) =>
    setItens(itens.map((i) => (i.chave === chave ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)));
  return (
    <div className="coluna">
      {itens.map((i) => (
        <div key={i.chave} className="linha" style={{ borderBottom: "1px solid var(--linha)", paddingBottom: 10, alignItems: "flex-start", flexWrap: "nowrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="forte">{i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""}</div>
            <div className="suave pequeno">{i.tamanho}{i.sabor2 ? " · meio a meio" : ""}{i.obs ? ` · ${i.obs}` : ""}</div>
            <div className="preco pequeno">{brl(i.precoUnit * i.qtd)}</div>
          </div>
          <div className="linha" style={{ gap: 4, flexWrap: "nowrap" }}>
            <button className="btn pequeno" onClick={() => mudar(i.chave, -1)} aria-label="Menos"><Minus size={14} /></button>
            <span style={{ minWidth: 20, textAlign: "center" }} className="forte">{i.qtd}</span>
            <button className="btn pequeno" onClick={() => mudar(i.chave, 1)} aria-label="Mais"><Plus size={14} /></button>
            <button className="btn pequeno perigo" onClick={() => setItens(itens.filter((x) => x.chave !== i.chave))} aria-label="Remover"><Trash2 size={14} /></button>
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
      <div className="coluna" style={{ gap: 14 }}>
        {produto.imagem ? (
          <img src={produto.imagem} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 14 }} />
        ) : (produto.categoria === "pizza" || produto.categoria === "doce") && (
          <div style={{ background: "var(--forno)", borderRadius: 14, display: "grid", placeItems: "center", padding: 18 }}>
            <PizzaIlustrada nome={produto.nome} doce={produto.categoria === "doce"} tamanho={150} />
          </div>
        )}
        <div className="suave">{produto.descricao}</div>

        {produto.tamanhos.length > 1 && (
          <div className="coluna" style={{ gap: 8 }}>
            <div className="rotulo">Tamanho</div>
            {produto.tamanhos.map((t) => (
              <button key={t.nome} className={"opcao" + (tamanho === t.nome ? " sel" : "")} onClick={() => setTamanho(t.nome)}>
                <span style={{ flex: 1 }} className="forte">{t.nome}</span>
                <span className="preco">{brl(t.preco)}</span>
              </button>
            ))}
          </div>
        )}

        {produto.meioAMeio && opcoesMeio.length > 0 && (
          <div className="coluna" style={{ gap: 8 }}>
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
          </div>
        )}

        <label className="campo">
          Observação
          <textarea rows={2} placeholder="Ex.: sem cebola, bem assada…" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>

        <div className="linha entre">
          <div className="linha" style={{ gap: 6 }}>
            <button className="btn" onClick={() => setQtd(Math.max(1, qtd - 1))} aria-label="Menos"><Minus size={16} /></button>
            <span className="forte" style={{ minWidth: 26, textAlign: "center", fontSize: 18 }}>{qtd}</span>
            <button className="btn" onClick={() => setQtd(qtd + 1)} aria-label="Mais"><Plus size={16} /></button>
          </div>
          <button
            className="btn primario grande"
            disabled={meio && !segundo}
            onClick={() =>
              aoAdicionar({
                chave: uid(), produtoId: produto.id, nome: produto.nome, categoria: produto.categoria, tamanho,
                sabor2: segundo ? { id: segundo.id, nome: segundo.nome } : null, qtd, precoUnit, obs: obs.trim(),
              })
            }
          >
            Adicionar · {brl(precoUnit * qtd)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
