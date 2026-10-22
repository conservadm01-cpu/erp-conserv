import { useCallback, useState } from "react";
import { Search, LocateFixed } from "lucide-react";
import { buscarEndereco, enderecoDaPosicao, posicaoAtual } from "../logic.js";
import { Campo } from "../ui.jsx";
import Mapa from "../Mapa.jsx";

// Escolhe um endereço com coordenadas: busca por texto, "usar minha
// localização" ou toque no mapa para ajustar o ponto exato da entrega.
export default function EscolherEndereco({ inicial, aoSalvar, aoCancelar, textoBotao = "Usar este endereço", comRotulo = true }) {
  const [busca, setBusca] = useState(inicial?.texto || "");
  const [resultados, setResultados] = useState([]);
  const [ponto, setPonto] = useState(inicial?.lat != null ? inicial : null);
  const [complemento, setComplemento] = useState(inicial?.complemento || "");
  const [rotulo, setRotulo] = useState(inicial?.rotulo || "Casa");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function procurar(e) {
    e.preventDefault();
    if (busca.trim().length < 4) return;
    setOcupado(true); setMsg("");
    try {
      const r = await buscarEndereco(busca);
      setResultados(r);
      if (!r.length) setMsg("Nenhum endereço encontrado. Tente incluir número, bairro e cidade.");
      if (r.length === 1) { setPonto(r[0]); setResultados([]); }
    } catch (err) { setMsg(err.message); } finally { setOcupado(false); }
  }

  async function minhaLocalizacao() {
    setOcupado(true); setMsg("");
    try {
      const p = await posicaoAtual();
      const texto = await enderecoDaPosicao(p.lat, p.lng);
      setPonto({ ...p, texto }); setBusca(texto); setResultados([]);
    } catch (err) { setMsg(err.message); } finally { setOcupado(false); }
  }

  const ajustar = useCallback(async (p) => {
    setPonto((atual) => ({ ...p, texto: atual?.texto || "" }));
    const texto = await enderecoDaPosicao(p.lat, p.lng);
    setPonto({ ...p, texto });
  }, []);

  return (
    <div className="coluna">
      <form className="linha" onSubmit={procurar} style={{ flexWrap: "nowrap" }}>
        <input className="in" placeholder="Rua, número, bairro, cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <button className="btn" disabled={ocupado} title="Buscar"><Search size={16} /></button>
      </form>
      <button type="button" className="btn" onClick={minhaLocalizacao} disabled={ocupado}>
        <LocateFixed size={16} /> Usar minha localização atual
      </button>
      {msg && <div className="pequeno" style={{ color: "#b91c1c" }}>{msg}</div>}
      {resultados.length > 1 && (
        <div className="coluna" style={{ gap: 6 }}>
          {resultados.map((r, i) => (
            <button key={i} type="button" className="opcao pequeno" onClick={() => { setPonto(r); setResultados([]); }}>{r.texto}</button>
          ))}
        </div>
      )}
      {ponto && (
        <>
          <Mapa pontos={[{ id: "dest", lat: ponto.lat, lng: ponto.lng, emoji: "🏠", rotulo: "Entrega" }]} altura={220} aoClicar={ajustar} seguir={false} />
          <div className="suave pequeno">📍 {ponto.texto || "…"} — toque no mapa para ajustar o ponto exato.</div>
          <div className="campos">
            <Campo rotulo="Número / complemento" placeholder="Ex.: 120, apto 32, bloco B" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            {comRotulo && <Campo rotulo="Nome do endereço" placeholder="Casa, Trabalho…" value={rotulo} onChange={(e) => setRotulo(e.target.value)} />}
          </div>
        </>
      )}
      <div className="linha">
        {aoCancelar && <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>}
        <button type="button" className="btn primario direita" disabled={!ponto} onClick={() => aoSalvar({ ...ponto, complemento: complemento.trim(), rotulo: rotulo.trim() })}>
          {textoBotao}
        </button>
      </div>
    </div>
  );
}
