import { useState } from "react";
import { Zap, Map as MapIcon, LayoutGrid } from "lucide-react";
import { salvarItem } from "../../db.js";
import {
  brl, hora, STATUS, PAGAMENTOS, useColecao, useConfig, mudarStatus, ehHoje, repasseMotoboy,
} from "../../logic.js";
import { Modal, SeloStatus, toast } from "../../ui.jsx";
import Mapa from "../../Mapa.jsx";

const COLUNAS = ["recebido", "preparo", "pronto", "em_rota"];
const PROXIMO = { recebido: "preparo", preparo: "pronto", pronto: "em_rota", em_rota: "entregue" };
const ACAO = { recebido: "Iniciar preparo", preparo: "Marcar pronto", pronto: "Saiu p/ entrega", em_rota: "Entregue" };
const AO_VIVO_MS = 2 * 60 * 1000;

export default function Pedidos() {
  const [cfg] = useConfig();
  const [pedidos] = useColecao("pedido", 5000);
  const [motoboys] = useColecao("motoboy", 30000);
  const [locs] = useColecao("loc", 5000);
  const [aberto, setAberto] = useState(null);
  const [modo, setModo] = useState("quadro");

  const ativos = pedidos.filter((p) => COLUNAS.includes(p.status)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const hoje = pedidos.filter((p) => ehHoje(p.criadoEm));
  const entreguesHoje = hoje.filter((p) => p.status === "entregue");
  const faturamento = entreguesHoje.reduce((s, p) => s + p.total, 0);
  const ativosMotoboys = motoboys.filter((m) => m.ativo !== false);
  const pedidoAberto = aberto && pedidos.find((p) => p.id === aberto);

  // Motoboy com posição recente (últimos 2 min) = online no mapa.
  const posicoes = {};
  for (const m of motoboys) {
    const l = locs.find((x) => x.motoboyId === m.id);
    if (l && Date.now() - new Date(l.em).getTime() < AO_VIVO_MS) posicoes[m.id] = l;
  }

  async function avancar(p) {
    const prox = PROXIMO[p.status];
    if (prox === "em_rota" && !p.motoboyId) return setAberto(p.id);
    await mudarStatus(p, prox, {}, cfg);
  }

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Indicador rotulo="Pedidos hoje" valor={hoje.filter((p) => p.status !== "cancelado").length} />
        <Indicador rotulo="Em andamento" valor={ativos.length} />
        <Indicador rotulo="Entregues hoje" valor={entreguesHoje.length} />
        <Indicador rotulo="Faturamento hoje" valor={brl(faturamento)} />
      </div>

      <div className="linha">
        <div className="abas" style={{ margin: 0 }}>
          <button className={modo === "quadro" ? "ativo" : ""} onClick={() => setModo("quadro")}><LayoutGrid size={14} /> Quadro</button>
          <button className={modo === "mapa" ? "ativo" : ""} onClick={() => setModo("mapa")}><MapIcon size={14} /> Mapa ao vivo</button>
        </div>
        <span className="suave pequeno direita">Atualiza sozinho a cada 5 s</span>
      </div>

      {modo === "mapa" ? (
        <div className="coluna">
          <Mapa
            altura={460}
            seguir={false}
            pontos={[
              { id: "loja", lat: cfg.loja.lat, lng: cfg.loja.lng, emoji: "🍕", rotulo: cfg.loja.nome },
              ...ativos.map((p) => ({ id: p.id, lat: p.endereco.lat, lng: p.endereco.lng, emoji: p.entrega?.dedicada ? "⚡" : "🏠", rotulo: `#${p.numero} ${p.cliente.nome} — ${STATUS[p.status].curto}` })),
              ...Object.entries(posicoes).map(([id, l]) => ({ id: "m" + id, lat: l.lat, lng: l.lng, emoji: "🛵", rotulo: motoboys.find((m) => m.id === id)?.nome })),
            ]}
          />
          <div className="linha pequeno">
            {ativosMotoboys.map((m) => (
              <span key={m.id} className="selo claro">{posicoes[m.id] ? "🟢" : "⚪"} {m.nome}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="kanban">
          {COLUNAS.map((s) => {
            const lista = ativos.filter((p) => p.status === s);
            return (
              <div key={s} className="col">
                <h3><span>{STATUS[s].curto}</span><span className="suave">{lista.length}</span></h3>
                {lista.map((p) => (
                  <div key={p.id} className="cartao coluna" style={{ padding: 10, gap: 6, cursor: "pointer", ...(p.entrega?.dedicada ? { borderColor: "#d97706" } : {}) }} onClick={() => setAberto(p.id)}>
                    <div className="linha entre">
                      <span className="forte">#{p.numero}</span>
                      <span className="suave pequeno">{hora(p.criadoEm)}</span>
                    </div>
                    <div className="pequeno">{p.cliente.nome}</div>
                    <div className="suave pequeno">{p.itens.map((i) => `${i.qtd}× ${i.nome}${i.sabor2 ? "/" + i.sabor2.nome : ""} ${i.tamanho}`).join(", ")}</div>
                    <div className="linha entre pequeno">
                      {p.entrega?.dedicada ? <span className="selo" style={{ background: "#d97706" }}><Zap size={11} /> Dedicada</span> : <span />}
                      <span className="preco">{brl(p.total)}</span>
                    </div>
                    {p.motoboyId && <div className="pequeno">🛵 {motoboys.find((m) => m.id === p.motoboyId)?.nome || "—"}</div>}
                    <button className="btn pequeno primario" onClick={(e) => { e.stopPropagation(); avancar(p); }}>{ACAO[s]}</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="cartao">
        <h3 style={{ marginBottom: 8 }}>Finalizados hoje</h3>
        <table className="tabela">
          <thead><tr><th>#</th><th>Cliente</th><th>Hora</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>
            {hoje.filter((p) => !COLUNAS.includes(p.status)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((p) => (
              <tr key={p.id} onClick={() => setAberto(p.id)} style={{ cursor: "pointer" }}>
                <td>{p.numero}</td><td>{p.cliente.nome}</td><td>{hora(p.criadoEm)}</td><td><SeloStatus status={p.status} /></td><td>{brl(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pedidoAberto && <DetalhePedido p={pedidoAberto} cfg={cfg} motoboys={ativosMotoboys} posicoes={posicoes} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

function Indicador({ rotulo, valor }) {
  return (
    <div className="cartao">
      <div className="suave pequeno">{rotulo}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{valor}</div>
    </div>
  );
}

function DetalhePedido({ p, cfg, motoboys, posicoes, aoFechar }) {
  const [motoboyId, setMotoboyId] = useState(p.motoboyId || "");
  const finalizado = p.status === "entregue" || p.status === "cancelado";

  async function atribuir() {
    await salvarItem("pedido", { ...p, motoboyId: motoboyId || null });
    toast(motoboyId ? "Motoboy definido" : "Motoboy removido");
  }

  return (
    <Modal titulo={`Pedido #${p.numero}`} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 14 }}>
        <div className="linha entre">
          <SeloStatus status={p.status} />
          <a className="pequeno" href={`#/pedido/${p.id}`} target="_blank" rel="noreferrer">Ver como o cliente vê ↗</a>
        </div>
        <div>
          <div className="forte">{p.cliente.nome} · {p.cliente.telefone}</div>
          <div className="pequeno">📍 {p.endereco.complemento ? <b>{p.endereco.complemento} — </b> : ""}{p.endereco.texto}</div>
          <div className="suave pequeno">{p.entrega?.km?.toFixed(1)} km {p.entrega?.dedicada ? "· ⚡ ENTREGA DEDICADA — sair direto, sem outras paradas" : ""}</div>
        </div>

        <div className="resumo">
          {p.itens.map((i, k) => (
            <div key={k}>
              <span>{i.qtd}× {i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""} ({i.tamanho}){i.obs ? <em className="suave"> — {i.obs}</em> : ""}</span>
              <span>{brl(i.precoUnit * i.qtd)}</span>
            </div>
          ))}
          <div><span>Entrega</span><span>{brl(p.entrega?.taxa)}</span></div>
          {p.entrega?.dedicada && <div><span>Adicional dedicada</span><span>{brl(p.entrega.adicionalDedicada)}</span></div>}
          {(p.descontos || []).map((d) => <div key={d.promocaoId} className="desc"><span>{d.nome}</span><span>-{brl(d.valor)}</span></div>)}
          {p.usoCarteira > 0 && <div className="desc"><span>Carteira</span><span>-{brl(p.usoCarteira)}</span></div>}
          <div className="total"><span>Cobrar na entrega / pago</span><span>{brl(p.aPagar)}</span></div>
          <div className="suave pequeno">
            {PAGAMENTOS[p.pagamento.metodo]?.nome}{p.pagamento.trocoPara ? ` · levar troco para ${brl(p.pagamento.trocoPara)} (${brl(p.pagamento.trocoPara - p.aPagar)})` : ""}
          </div>
        </div>

        {!finalizado && (
          <div className="coluna">
            <div className="forte pequeno">Motoboy</div>
            <div className="linha" style={{ flexWrap: "nowrap" }}>
              <select className="in" value={motoboyId} onChange={(e) => setMotoboyId(e.target.value)}>
                <option value="">— nenhum —</option>
                {motoboys.map((m) => (
                  <option key={m.id} value={m.id}>{posicoes[m.id] ? "🟢 " : ""}{m.nome}</option>
                ))}
              </select>
              <button className="btn" onClick={atribuir}>Salvar</button>
            </div>
            {p.motoboyId && <div className="suave pequeno">Repasse ao motoboy: {brl(repasseMotoboy(p, cfg))}</div>}
          </div>
        )}

        {!finalizado && (
          <div className="linha">
            <button className="btn perigo" onClick={async () => { if (confirm("Cancelar este pedido?")) { await mudarStatus(p, "cancelado", {}, cfg); aoFechar(); } }}>
              Cancelar pedido
            </button>
            {PROXIMO[p.status] && (
              <button
                className="btn primario direita"
                disabled={p.status === "pronto" && !p.motoboyId}
                title={p.status === "pronto" && !p.motoboyId ? "Defina o motoboy antes" : ""}
                onClick={() => mudarStatus(p, PROXIMO[p.status], {}, cfg)}
              >
                {ACAO[p.status]}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
