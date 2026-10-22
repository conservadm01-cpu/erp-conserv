import { useEffect, useState } from "react";
import { Pizza, ClipboardList, Wallet, Store, Bike } from "lucide-react";
import { modoDemo, modoTeste, listar, salvarItem, armazem } from "./db.js";
import { useConfig, criarExemplos, CONFIG_PADRAO } from "./logic.js";
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

// Na versão de teste a loja já abre com cardápio, promoções, um motoboy e
// uma cliente com endereço salvo, para dar para testar tudo na hora.
let preparando = null;
function prepararTeste() {
  preparando = preparando || semearTeste();
  return preparando;
}
async function semearTeste() {
  if ((await listar("produto")).length) return;
  await criarExemplos();
  const { lat, lng } = CONFIG_PADRAO.loja;
  await salvarItem("cliente", {
    id: "11988887777", nome: "Ana (exemplo)", telefone: "(11) 98888-7777", saldo: 8,
    movimentos: [{ id: "boasvindas", em: new Date().toISOString(), valor: 8, descricao: "Crédito de boas-vindas (exemplo)" }],
    enderecos: [{ id: "casa", rotulo: "Casa", texto: "Endereço de exemplo, a ~2,5 km da pizzaria", complemento: "Nº 120", lat: lat - 0.017, lng: lng - 0.009 }],
    criadoEm: new Date().toISOString(),
  });
  armazem.set("pz-cliente-id", "11988887777");
  window.dispatchEvent(new CustomEvent("pz-mudou", { detail: "cliente" }));
}

export default function App() {
  const rota = useRota();
  useEffect(() => { if (modoTeste) prepararTeste().catch(console.error); }, []);
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
      {modoTeste ? (
        <div className="aviso-demo">
          Versão de teste: dados de exemplo, salvos só neste navegador. GPS e mapas reais ficam desligados; o trajeto do motoboy é simulado.
        </div>
      ) : modoDemo && (
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
