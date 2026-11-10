import { useEffect, useMemo, useState } from "react";
import { PizzaIlustrada } from "../ui.jsx";
import { useColecao, useConfig, useRegistro, precoPromocional, promocaoValida, CATEGORIAS } from "../logic.js";

// Cardápio para TV / monitor do salão (abrir em tela cheia num navegador,
// Smart TV, TV box ou Raspberry Pi). Usa a mesma configuração das telas
// LCD: #/painel/<id-da-tela>; sem id, mostra todas as categorias.
export default function Painel({ telaId }) {
  const [cfg] = useConfig();
  const [produtos] = useColecao("produto", 60000);
  const [promocoes] = useColecao("promocao", 60000);
  const [tela] = useRegistro(telaId ? `tela:${telaId}` : null, 60000);
  const [prontos] = useRegistro("prontos", 5000);
  const [pagina, setPagina] = useState(0);
  const [agora, setAgora] = useState(new Date());

  const config = tela || { categorias: [], itensPorPagina: 8, segundosPorPagina: 12, mostrarProntos: true, mostrarDescricao: true };
  const segundos = Math.max(4, Number(config.segundosPorPagina) || 12);
  const paginas = useMemo(() => {
    const porPagina = Math.max(1, Number(config.itensPorPagina) || 8);
    const cats = config.categorias?.length ? config.categorias : null;
    const out = [];
    const ativos = produtos.filter((p) => p.ativo !== false && (!cats || cats.includes(p.categoria)));
    for (const c of Object.keys(CATEGORIAS)) {
      const l = ativos.filter((p) => p.categoria === c).sort((a, b) => a.nome.localeCompare(b.nome));
      for (let i = 0; i < l.length; i += porPagina) out.push({ c, itens: l.slice(i, i + porPagina) });
    }
    return out;
  }, [produtos, config.categorias, config.itensPorPagina]);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => setPagina((p) => p + 1), segundos * 1000);
    return () => clearInterval(t);
  }, [segundos]);

  const atual = paginas.length ? paginas[pagina % paginas.length] : null;
  const promosAtivas = promocoes.filter((p) => p.tipo !== "cupom" && promocaoValida(p));
  const listaProntos = prontos?.l || [];
  const mostrarProntos = config.mostrarProntos !== false;

  return (
    <div className="painel" onDoubleClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>
      <header>
        <PizzaIlustrada nome={cfg.loja.nome} tamanho={64} className="logo" />
        <h1>{cfg.loja.nome}</h1>
        <span className="relogio">{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </header>
      <main>
        <section className="pagina">
          {atual ? (
            <>
              <h2>{CATEGORIAS[atual.c]} <small>{tela?.nome || "CARDÁPIO"}</small></h2>
              <div className="itens">
                {atual.itens.map((p) => {
                  const promo = precoPromocional(p, promocoes);
                  const fator = promo ? 1 - promo.valor / 100 : 1;
                  return (
                    <div key={p.id} className={"item" + (promo ? " promo" : "")}>
                      <span className="nome">{p.nome}{promo && <span className="tag">-{promo.valor}%</span>}</span>
                      <span className="valor">
                        {p.tamanhos.map((t) => (
                          <span key={t.nome} className="tam">
                            {p.tamanhos.length > 1 && <small>{t.nome}</small>}
                            {(t.preco * fator).toFixed(2).replace(".", ",")}
                          </span>
                        ))}
                      </span>
                      {config.mostrarDescricao !== false && p.descricao && <span className="desc">{p.descricao}</span>}
                    </div>
                  );
                })}
              </div>
              {paginas.length > 1 && (
                <div className="pontos-pag">
                  {paginas.map((_, i) => <span key={i} className={i === pagina % paginas.length ? "on" : ""} />)}
                </div>
              )}
            </>
          ) : (
            <h2>Cardápio em breve</h2>
          )}
        </section>
        {mostrarProntos && (
          <aside className="prontos">
            <h3>Pronto! Retire</h3>
            {listaProntos.length === 0 && <span style={{ opacity: 0.5 }}>—</span>}
            {listaProntos.map((s) => <span key={s} className="senha">{s}</span>)}
          </aside>
        )}
      </main>
      <footer>
        <span className="corre">
          {(promosAtivas.length ? promosAtivas.map((p) => "★ " + p.nome) : ["★ Peça pelo QR code da sua mesa ou no totem"]).join("     ")}
          {"     ★ Peça também pelo delivery"}
        </span>
      </footer>
    </div>
  );
}
