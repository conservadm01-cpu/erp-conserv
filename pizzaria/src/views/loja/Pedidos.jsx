import { useState } from "react";
import { Zap, Map as MapIcon, LayoutGrid } from "lucide-react";
import { salvarItem } from "../../db.js";
import {
  brl, hora, STATUS, CANAIS, canalDo, ehLocal, fluxoDo, nomeStatus, rotuloPedido, nomePagamento,
  useColecao, useConfig, mudarStatus, ehHoje, repasseMotoboy,
} from "../../logic.js";
import { Modal, SeloStatus, toast, BotaoConfirmar } from "../../ui.jsx";
import Mapa from "../../Mapa.jsx";

const COLUNAS = ["recebido", "preparo", "pronto", "em_rota"];
const AO_VIVO_MS = 2 * 60 * 1000;

const proximo = (p) => {
  const f = fluxoDo(p);
  return f[f.indexOf(p.status) + 1];
};
function acao(p) {
  const prox = proximo(p);
  if (prox === "preparo") return "Iniciar preparo";
  if (prox === "pronto") return "Marcar pronto";
  if (prox === "em_rota") return "Saiu p/ entrega";
  if (prox === "entregue") return canalDo(p) === "mesa" ? "Servido na mesa" : canalDo(p) === "balcao" ? "Retirado" : "Entregue";
  return null;
}

export default function Pedidos() {
  const [cfg] = useConfig();
  const [pedidos] = useColecao("pedido", 5000);
  const [motoboys] = useColecao("motoboy", 30000);
  const [locs] = useColecao("loc", 5000);
  const [aberto, setAberto] = useState(null);
  const [modo, setModo] = useState("quadro");
  const [filtro, setFiltro] = useState("todos");

  const doFiltro = (p) => filtro === "todos" || (filtro === "salao" ? ehLocal(p) : !ehLocal(p));
  const ativos = pedidos.filter((p) => COLUNAS.includes(p.status) && doFiltro(p)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  const hoje = pedidos.filter((p) => ehHoje(p.criadoEm));
  const validosHoje = hoje.filter((p) => p.status !== "cancelado");
  const faturamento = validosHoje.filter((p) => p.status === "entregue" || p.pago).reduce((s, p) => s + p.total, 0);
  const ticket = validosHoje.length ? validosHoje.reduce((s, p) => s + p.total, 0) / validosHoje.length : 0;
  const ativosMotoboys = motoboys.filter((m) => m.ativo !== false);
  const pedidoAberto = aberto && pedidos.find((p) => p.id === aberto);

  // Motoboy com posição recente (últimos 2 min) = online no mapa.
  const posicoes = {};
  for (const m of motoboys) {
    const l = locs.find((x) => x.motoboyId === m.id);
    if (l && Date.now() - new Date(l.em).getTime() < AO_VIVO_MS) posicoes[m.id] = l;
  }

  async function avancar(p) {
    const prox = proximo(p);
    if (prox === "em_rota" && !p.motoboyId) return setAberto(p.id);
    await mudarStatus(p, prox, {}, cfg);
  }

  const colunas = COLUNAS.filter((s) => s !== "em_rota" || filtro !== "salao");

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div className="indicadores">
        <Indicador rotulo="Pedidos hoje" valor={validosHoje.length} />
        <Indicador rotulo="Em andamento" valor={pedidos.filter((p) => COLUNAS.includes(p.status)).length} />
        <Indicador rotulo="Ticket médio" valor={brl(ticket)} />
        <Indicador rotulo="Faturado hoje" valor={brl(faturamento)} />
      </div>

      <div className="linha">
        <div className="abas" style={{ margin: 0 }}>
          <button className={filtro === "todos" ? "ativo" : ""} onClick={() => setFiltro("todos")}>Todos</button>
          <button className={filtro === "delivery" ? "ativo" : ""} onClick={() => setFiltro("delivery")}>🛵 Delivery</button>
          <button className={filtro === "salao" ? "ativo" : ""} onClick={() => setFiltro("salao")}>🍽️ Salão e balcão</button>
        </div>
        <div className="abas direita" style={{ margin: 0 }}>
          <button className={modo === "quadro" ? "ativo" : ""} onClick={() => setModo("quadro")}><LayoutGrid size={14} /> Quadro</button>
          <button className={modo === "mapa" ? "ativo" : ""} onClick={() => setModo("mapa")}><MapIcon size={14} /> Mapa</button>
        </div>
      </div>

      {modo === "mapa" ? (
        <div className="coluna">
          <Mapa
            altura={460}
            seguir={false}
            pontos={[
              { id: "loja", lat: cfg.loja.lat, lng: cfg.loja.lng, emoji: "🍕", rotulo: cfg.loja.nome },
              ...ativos.filter((p) => !ehLocal(p)).map((p) => ({ id: p.id, lat: p.endereco.lat, lng: p.endereco.lng, emoji: p.entrega?.dedicada ? "⚡" : "🏠", rotulo: `#${p.numero} ${p.cliente?.nome || ""} — ${STATUS[p.status].curto}` })),
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
          {colunas.map((s) => {
            const lista = ativos.filter((p) => p.status === s);
            return (
              <div key={s} className="col">
                <h3><span><span className="ponto" style={{ background: STATUS[s].cor }} />{STATUS[s].curto}</span><span className="suave">{lista.length}</span></h3>
                {lista.map((p) => (
                  <div key={p.id} className={`ticket ${canalDo(p)}${p.entrega?.dedicada ? " dedicada" : ""}`} onClick={() => setAberto(p.id)}>
                    <div className="linha entre">
                      <span className="forte">{CANAIS[canalDo(p)].emoji} {rotuloPedido(p)}</span>
                      <span className="suave pequeno tabular">{hora(p.criadoEm)}</span>
                    </div>
                    {(p.nomeChamada || p.cliente?.nome) && <div className="pequeno">{p.nomeChamada || p.cliente.nome}</div>}
                    <div className="suave pequeno">{p.itens.map((i) => `${i.qtd}× ${i.nome}${i.sabor2 ? "/" + i.sabor2.nome : ""}${i.tamanho === "Único" ? "" : " " + i.tamanho}`).join(", ")}</div>
                    <div className="linha entre pequeno">
                      {p.entrega?.dedicada ? <span className="selo" style={{ background: "var(--ambar)" }}><Zap size={11} /> Dedicada</span> : <span />}
                      <span className="preco">{brl(p.total)}</span>
                    </div>
                    {p.motoboyId && <div className="pequeno">🛵 {motoboys.find((m) => m.id === p.motoboyId)?.nome || "—"}</div>}
                    {acao(p) && <button className="btn pequeno primario" onClick={(e) => { e.stopPropagation(); avancar(p); }}>{acao(p)}</button>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="cartao">
        <h3 style={{ marginBottom: 8 }}>Finalizados hoje</h3>
        <div className="rolagem">
          <table className="tabela">
            <thead><tr><th>Pedido</th><th>Canal</th><th>Cliente</th><th>Hora</th><th>Status</th><th className="num">Total</th></tr></thead>
            <tbody>
              {hoje.filter((p) => !COLUNAS.includes(p.status)).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).map((p) => (
                <tr key={p.id} onClick={() => setAberto(p.id)} style={{ cursor: "pointer" }}>
                  <td className="forte">{rotuloPedido(p)}</td>
                  <td>{CANAIS[canalDo(p)].nome}</td>
                  <td>{p.nomeChamada || p.cliente?.nome || "—"}</td>
                  <td className="tabular">{hora(p.criadoEm)}</td>
                  <td><SeloStatus status={p.status} /></td>
                  <td className="num">{brl(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pedidoAberto && <DetalhePedido p={pedidoAberto} cfg={cfg} motoboys={ativosMotoboys} posicoes={posicoes} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

export function Indicador({ rotulo, valor, detalhe }) {
  return (
    <div className="indicador">
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{valor}</div>
      {detalhe && <div className="suave pequeno">{detalhe}</div>}
    </div>
  );
}

function DetalhePedido({ p, cfg, motoboys, posicoes, aoFechar }) {
  const [motoboyId, setMotoboyId] = useState(p.motoboyId || "");
  const finalizado = p.status === "entregue" || p.status === "cancelado";
  const local = ehLocal(p);
  const prox = proximo(p);

  async function atribuir() {
    await salvarItem("pedido", { ...p, motoboyId: motoboyId || null });
    toast(motoboyId ? "Motoboy definido" : "Motoboy removido");
  }

  return (
    <Modal titulo={`${CANAIS[canalDo(p)].emoji} ${rotuloPedido(p)}`} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 14 }}>
        <div className="linha entre">
          <span className="linha" style={{ gap: 8 }}><SeloStatus status={p.status} /> <span className="pequeno suave">{nomeStatus(p)}</span></span>
          <a className="pequeno" href={`#/pedido/${p.id}`} target="_blank" rel="noreferrer">Ver como o cliente vê ↗</a>
        </div>
        <div>
          <div className="forte">{p.nomeChamada || p.cliente?.nome || "Cliente sem nome"}{p.cliente?.telefone ? ` · ${p.cliente.telefone}` : ""}</div>
          {local ? (
            <div className="pequeno suave">Pedido nº {p.numero} · {CANAIS[canalDo(p)].nome}{p.mesa ? ` ${p.mesa}` : ""} · feito às {hora(p.criadoEm)}</div>
          ) : (
            <>
              <div className="pequeno">📍 {p.endereco.complemento ? <b>{p.endereco.complemento} — </b> : ""}{p.endereco.texto}</div>
              <div className="suave pequeno">{p.entrega?.km?.toFixed(1)} km {p.entrega?.dedicada ? "· ⚡ ENTREGA DEDICADA — sair direto, sem outras paradas" : ""}</div>
            </>
          )}
        </div>

        <div className="resumo">
          {p.itens.map((i, k) => (
            <div key={k}>
              <span>{i.qtd}× {i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""} ({i.tamanho}){i.obs ? <em className="suave"> — {i.obs}</em> : ""}</span>
              <span>{brl(i.precoUnit * i.qtd)}</span>
            </div>
          ))}
          {!local && <div><span>Entrega</span><span>{brl(p.entrega?.taxa)}</span></div>}
          {p.entrega?.dedicada && <div><span>Adicional dedicada</span><span>{brl(p.entrega.adicionalDedicada)}</span></div>}
          {(p.descontos || []).map((d) => <div key={d.promocaoId} className="desc"><span>{d.nome}</span><span>-{brl(d.valor)}</span></div>)}
          {p.usoCarteira > 0 && <div className="desc"><span>Carteira</span><span>-{brl(p.usoCarteira)}</span></div>}
          <div className="total"><span>{p.pago ? "Pago" : "A receber"}</span><span>{brl(p.aPagar)}</span></div>
          <div className="suave pequeno">
            {nomePagamento(p.pagamento.metodo)}{p.pagamento.trocoPara ? ` · levar troco para ${brl(p.pagamento.trocoPara)} (${brl(p.pagamento.trocoPara - p.aPagar)})` : ""}
          </div>
        </div>

        {!finalizado && !local && (
          <div className="coluna">
            <div className="rotulo">Motoboy</div>
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
            <BotaoConfirmar className="btn perigo" texto="Confirmar cancelamento" aoConfirmar={async () => { await mudarStatus(p, "cancelado", {}, cfg); aoFechar(); }}>
              Cancelar pedido
            </BotaoConfirmar>
            {prox && (
              <button
                className="btn primario direita"
                disabled={prox === "em_rota" && !p.motoboyId}
                title={prox === "em_rota" && !p.motoboyId ? "Defina o motoboy antes" : ""}
                onClick={() => mudarStatus(p, prox, {}, cfg)}
              >
                {acao(p)}
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
