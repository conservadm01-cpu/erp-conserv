import { Phone, MessageCircle } from "lucide-react";
import { brl, hora, STATUS, FLUXO, PAGAMENTOS, useConfig, useRegistro, distanciaKm, soDigitos } from "../logic.js";
import Mapa from "../Mapa.jsx";

// Posição do motoboy é considerada "ao vivo" se chegou nos últimos 2 min.
const AO_VIVO_MS = 2 * 60 * 1000;

export default function Acompanhar({ id }) {
  const [cfg] = useConfig();
  const [pedido, carregado] = useRegistro(id ? `pedido:${id}` : null, 5000);
  const motoboyId = pedido?.motoboyId;
  const [motoboy] = useRegistro(motoboyId ? `motoboy:${motoboyId}` : null, 60000);
  const [loc] = useRegistro(motoboyId && pedido?.status === "em_rota" ? `loc:${motoboyId}` : null, 5000);

  if (!carregado) return <div className="vazio">Carregando pedido…</div>;
  if (!pedido) return <div className="vazio">Pedido não encontrado.</div>;

  const st = pedido.status;
  const idxAtual = FLUXO.indexOf(st);
  const quando = (s) => (pedido.historico || []).filter((h) => h.status === s).pop()?.em;
  const aoVivo = loc && Date.now() - new Date(loc.em).getTime() < AO_VIVO_MS;

  let eta = null;
  if (st === "em_rota" && aoVivo) {
    const km = distanciaKm(loc, pedido.endereco) * (cfg.entrega.fatorRota || 1);
    eta = { km, min: Math.max(1, Math.round((km / (cfg.entrega.velocidadeKmh || 25)) * 60)) };
  }

  const pontos = [
    { id: "loja", lat: cfg.loja.lat, lng: cfg.loja.lng, emoji: "🍕", rotulo: cfg.loja.nome },
    { id: "dest", lat: pedido.endereco.lat, lng: pedido.endereco.lng, emoji: "🏠", rotulo: "Você" },
  ];
  // A linha tracejada liga os pontos na ordem: pizzaria → motoboy → cliente.
  if (st === "em_rota" && aoVivo) pontos.splice(1, 0, { id: "moto", lat: loc.lat, lng: loc.lng, emoji: "🛵", rotulo: motoboy?.nome || "Motoboy" });

  const zapLoja = soDigitos(cfg.loja.telefone);

  return (
    <div className="coluna" style={{ gap: 16, maxWidth: 680, margin: "0 auto" }}>
      <div className="linha entre">
        <h1>Pedido #{pedido.numero}</h1>
        <span className="selo" style={{ background: STATUS[st]?.cor }}>{STATUS[st]?.nome}</span>
      </div>

      {st !== "cancelado" && st !== "entregue" && (
        <div className="cartao" style={{ background: "#fff4e0", borderColor: "#f1d29e" }}>
          {eta ? (
            <div className="linha"><span className="pulso" /> <b>{motoboy?.nome || "O motoboy"}</b> está a {eta.km.toFixed(1)} km — chega em cerca de <b>{eta.min} min</b>.</div>
          ) : st === "em_rota" ? (
            <div>Seu pedido saiu para entrega. Aguardando o sinal de GPS do motoboy…</div>
          ) : (
            <div>Previsão de entrega: <b>{hora(pedido.previsaoEm)}</b>{pedido.entrega?.dedicada ? " · entrega dedicada ⚡" : ""}</div>
          )}
        </div>
      )}

      <Mapa pontos={pontos} altura={300} />

      <div className="cartao">
        {st === "cancelado" ? (
          <div style={{ color: "#b91c1c" }}>Este pedido foi cancelado{pedido.usoCarteira > 0 ? "; o saldo da carteira usado foi devolvido" : ""}.</div>
        ) : (
          <ul className="timeline">
            {FLUXO.map((s, i) => (
              <li key={s} className={i < idxAtual ? "feito" : i === idxAtual ? "feito atual" : ""}>
                <span className="ponto" />
                <span style={{ flex: 1 }}>{STATUS[s].nome}</span>
                <span className="pequeno suave">{hora(quando(s))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {motoboy && (st === "em_rota" || st === "pronto") && (
        <div className="cartao linha">
          <span style={{ fontSize: 28 }}>🛵</span>
          <div style={{ flex: 1 }}>
            <div className="forte">{motoboy.nome}</div>
            <div className="suave pequeno">{motoboy.veiculo} {motoboy.placa ? `· ${motoboy.placa}` : ""}</div>
          </div>
          {motoboy.telefone && <a className="btn" href={`tel:${soDigitos(motoboy.telefone)}`}><Phone size={16} /></a>}
        </div>
      )}

      <div className="cartao resumo">
        <h3 style={{ marginBottom: 8 }}>Itens</h3>
        {pedido.itens.map((i, k) => (
          <div key={k}>
            <span>{i.qtd}× {i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""} <span className="suave pequeno">({i.tamanho})</span></span>
            <span>{brl(i.precoUnit * i.qtd)}</span>
          </div>
        ))}
        <div><span>Entrega{pedido.entrega?.dedicada ? " dedicada" : ""}</span><span>{brl(pedido.entrega?.total)}</span></div>
        {(pedido.descontos || []).map((d) => <div key={d.promocaoId} className="desc"><span>{d.nome}</span><span>-{brl(d.valor)}</span></div>)}
        {pedido.usoCarteira > 0 && <div className="desc"><span>Carteira</span><span>-{brl(pedido.usoCarteira)}</span></div>}
        <div className="total"><span>Total a pagar</span><span>{brl(pedido.aPagar)}</span></div>
        <div className="suave pequeno">
          {PAGAMENTOS[pedido.pagamento.metodo]?.nome}
          {pedido.pagamento.trocoPara ? ` · troco para ${brl(pedido.pagamento.trocoPara)}` : ""}
        </div>
        <div className="suave pequeno" style={{ marginTop: 6 }}>📍 {pedido.endereco.complemento ? pedido.endereco.complemento + " — " : ""}{pedido.endereco.texto}</div>
      </div>

      {zapLoja && (
        <a className="btn" href={`https://wa.me/55${zapLoja}?text=${encodeURIComponent(`Olá! Sobre o pedido #${pedido.numero}`)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> Falar com a pizzaria
        </a>
      )}
    </div>
  );
}
