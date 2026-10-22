import { useEffect, useState } from "react";
import { Pizza, ClipboardList, Wallet, Store, Bike } from "lucide-react";
import { modoDemo } from "./db.js";
import { useConfig } from "./logic.js";
import { Toasts } from "./ui.jsx";
import Cardapio from "./views/Cardapio.jsx";
import MeusPedidos from "./views/MeusPedidos.jsx";
import Carteira from "./views/Carteira.jsx";
import Acompanhar from "./views/Acompanhar.jsx";
import Loja from "./views/Loja.jsx";
import Motoboy from "./views/Motoboy.jsx";

// Rotas por hash (#/...), funcionam em qualquer hospedagem estática.
function useRota() {
  const ler = () => (window.location.hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  const [rota, setRota] = useState(ler);
  useEffect(() => {
    const f = () => { setRota(ler()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return rota;
}

export default function App() {
  const rota = useRota();
  const [cfg] = useConfig();
  const pagina = rota[0] || "";
  const areaInterna = pagina === "loja" || pagina === "motoboy";

  let tela;
  if (pagina === "pedidos") tela = <MeusPedidos />;
  else if (pagina === "carteira") tela = <Carteira />;
  else if (pagina === "pedido") tela = <Acompanhar id={rota[1]} />;
  else if (pagina === "loja") tela = <Loja aba={rota[1] || "pedidos"} />;
  else if (pagina === "motoboy") tela = <Motoboy />;
  else tela = <Cardapio />;

  const link = (href, rotulo, Icone, ativo) => (
    <a href={href} className={ativo ? "ativo" : ""}><Icone size={16} />{rotulo}</a>
  );

  return (
    <>
      <header className="topo">
        <a className="marca" href="#/">🍕 {cfg.loja.nome}</a>
        <nav>
          {pagina === "loja" ? (
            link("#/loja", "Loja", Store, true)
          ) : pagina === "motoboy" ? (
            link("#/motoboy", "Motoboy", Bike, true)
          ) : (
            <>
              {link("#/", "Cardápio", Pizza, pagina === "")}
              {link("#/pedidos", "Pedidos", ClipboardList, pagina === "pedidos" || pagina === "pedido")}
              {link("#/carteira", "Carteira", Wallet, pagina === "carteira")}
            </>
          )}
        </nav>
      </header>
      {modoDemo && (
        <div className="aviso-demo">
          Modo demonstração: dados salvos só neste navegador. Configure o Supabase para usar de verdade.
        </div>
      )}
      <main className="conteudo">{tela}</main>
      {!areaInterna && (
        <footer className="suave pequeno" style={{ textAlign: "center", paddingBottom: 100 }}>
          <a href="#/loja">Área da loja</a> · <a href="#/motoboy">Sou motoboy</a>
        </footer>
      )}
      {areaInterna && (
        <footer className="suave pequeno" style={{ textAlign: "center", padding: 20 }}>
          <a href="#/">Voltar ao cardápio</a>
        </footer>
      )}
      <Toasts />
    </>
  );
}
