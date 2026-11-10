import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BellRing, Printer, MonitorSmartphone, Tv } from "lucide-react";
import { salvarItem, removerItem, uid } from "../../db.js";
import { brl, hora, arred, useColecao, useConfig, PAGAMENTOS, nomeStatus, ehHoje } from "../../logic.js";
import { Modal, SeloStatus, toast } from "../../ui.jsx";

export const linkApp = (rota) => `${window.location.origin}${window.location.pathname}#/${rota}`;

export function QR({ texto, tamanho = 180 }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(texto, { margin: 1, width: tamanho * 2, color: { dark: "#16251d", light: "#ffffff" } }).then(setSrc).catch(() => setSrc(""));
  }, [texto, tamanho]);
  return src ? <img className="qr" src={src} alt={`QR code para ${texto}`} style={{ maxWidth: tamanho }} /> : null;
}

const abertosDaMesa = (pedidos, n) =>
  pedidos.filter((p) => p.canal === "mesa" && p.mesa === n && !p.pago && p.status !== "cancelado");

export default function Salao() {
  const [cfg] = useConfig();
  const [pedidos] = useColecao("pedido", 5000);
  const [chamados] = useColecao("chamado", 5000);
  const [mesaAberta, setMesaAberta] = useState(null);
  const [verQrs, setVerQrs] = useState(false);

  const mesas = Array.from({ length: cfg.salao.mesas || 0 }, (_, i) => i + 1);
  const balcaoHoje = pedidos.filter((p) => p.canal === "balcao" && ehHoje(p.criadoEm) && !p.pago && p.status !== "cancelado");

  return (
    <div className="coluna" style={{ gap: 18 }}>
      <div className="linha">
        <h2>Salão</h2>
        <div className="linha direita">
          <a className="btn" href={linkApp("totem")} target="_blank" rel="noreferrer"><MonitorSmartphone size={16} /> Abrir totem</a>
          <a className="btn" href={linkApp("painel")} target="_blank" rel="noreferrer"><Tv size={16} /> Abrir painel da TV</a>
          <button className="btn escuro" onClick={() => setVerQrs(true)}><Printer size={16} /> QR codes das mesas</button>
        </div>
      </div>

      {chamados.length > 0 && (
        <div className="cartao coluna" style={{ borderColor: "var(--tomate)", background: "var(--destaque-fundo)" }}>
          <h3><BellRing size={17} style={{ verticalAlign: -3 }} /> Chamados</h3>
          {chamados.sort((a, b) => a.em.localeCompare(b.em)).map((c) => (
            <div key={c.mesa} className="linha">
              <span className="forte">Mesa {c.mesa}</span>
              <span>{c.tipo === "conta" ? "pediu a conta" : "chamou um atendente"}</span>
              <span className="suave pequeno tabular">{hora(c.em)}</span>
              <button className="btn pequeno direita" onClick={() => removerItem("chamado", c.mesa)}>Atendido</button>
            </div>
          ))}
        </div>
      )}

      <div className="mesas">
        {mesas.map((n) => {
          const abertos = abertosDaMesa(pedidos, n);
          const consumo = abertos.reduce((s, p) => s + p.total, 0);
          const chamou = chamados.some((c) => c.mesa === n);
          return (
            <button key={n} className={"mesa" + (abertos.length ? " ocupada" : "")} onClick={() => setMesaAberta(n)} style={chamou ? { boxShadow: "0 0 0 3px var(--tomate)" } : null}>
              <span className="rotulo" style={{ color: "inherit", opacity: 0.6 }}>Mesa</span>
              <span className="num">{n}</span>
              {abertos.length ? (
                <>
                  <span className="forte tabular">{brl(consumo)}</span>
                  <span className="pequeno suave">{abertos.length} pedido(s) · desde {hora(abertos.map((p) => p.criadoEm).sort()[0])}</span>
                </>
              ) : (
                <span className="pequeno suave">Livre</span>
              )}
              {chamou && <span className="selo" style={{ background: "var(--tomate)" }}>🔔 chamando</span>}
            </button>
          );
        })}
      </div>

      {balcaoHoje.length > 0 && (
        <div className="cartao coluna">
          <h3>Balcão — a receber no caixa</h3>
          {balcaoHoje.map((p) => (
            <div key={p.id} className="linha">
              <span className="forte">Senha {String(p.numero).slice(-3)}</span>
              <span>{p.nomeChamada}</span>
              <SeloStatus status={p.status} />
              <span className="suave pequeno">{PAGAMENTOS[p.pagamento.metodo]?.nome}</span>
              <span className="preco direita">{brl(p.total)}</span>
              <button className="btn pequeno verde" onClick={async () => { await salvarItem("pedido", { ...p, pago: true, pagoEm: new Date().toISOString() }); toast("Pagamento registrado"); }}>Recebido</button>
            </div>
          ))}
        </div>
      )}

      {mesaAberta && <ContaMesa n={mesaAberta} pedidos={abertosDaMesa(pedidos, mesaAberta)} cfg={cfg} aoFechar={() => setMesaAberta(null)} />}
      {verQrs && (
        <Modal titulo="QR codes das mesas" aoFechar={() => setVerQrs(false)}>
          <div className="suave pequeno" style={{ marginBottom: 10 }}>Imprima e cole em cada mesa. O cliente aponta a câmera e já cai no cardápio da mesa dele.</div>
          <div className="mesas">
            {mesas.map((n) => (
              <div key={n} className="cartao coluna" style={{ alignItems: "center", gap: 6, padding: 10 }}>
                <QR texto={linkApp(`mesa/${n}`)} tamanho={130} />
                <span className="forte">Mesa {n}</span>
              </div>
            ))}
          </div>
          <button className="btn primario bloco" style={{ marginTop: 12 }} onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
        </Modal>
      )}
    </div>
  );
}

function ContaMesa({ n, pedidos, cfg, aoFechar }) {
  const [servico, setServico] = useState(true);
  const [metodo, setMetodo] = useState("credito");
  const consumo = arred(pedidos.reduce((s, p) => s + p.total, 0));
  const taxa = servico ? arred((consumo * (cfg.salao.taxaServicoPercentual || 0)) / 100) : 0;
  const total = arred(consumo + taxa);
  const metodos = Object.keys(PAGAMENTOS).filter((k) => k !== "carteira" && cfg.pagamentos[k]?.ativo);

  async function fecharConta() {
    const agora = new Date().toISOString();
    for (const p of pedidos) {
      await salvarItem("pedido", { ...p, pago: true, pagoEm: agora, pagamento: { ...p.pagamento, metodo } });
    }
    await salvarItem("conta", { id: uid(), mesa: n, pedidos: pedidos.map((p) => p.id), consumo, servico: taxa, total, metodo, em: agora });
    await removerItem("chamado", n).catch(() => {});
    toast(`Conta da mesa ${n} fechada: ${brl(total)}`);
    aoFechar();
  }

  return (
    <Modal titulo={`Mesa ${n}`} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 14 }}>
        <div className="linha" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <QR texto={linkApp(`mesa/${n}`)} tamanho={110} />
          <div className="coluna" style={{ gap: 4 }}>
            <span className="pequeno suave">Link da mesa</span>
            <a className="pequeno" href={linkApp(`mesa/${n}`)} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all" }}>{linkApp(`mesa/${n}`)}</a>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <div className="vazio">Mesa livre, sem pedidos em aberto.</div>
        ) : (
          <>
            <div className="resumo">
              {pedidos.flatMap((p) => p.itens.map((i, k) => (
                <div key={p.id + k}>
                  <span>{i.qtd}× {i.nome}{i.sabor2 ? ` / ${i.sabor2.nome}` : ""} <span className="suave pequeno">({i.tamanho}) · {nomeStatus(p)}</span></span>
                  <span>{brl(i.precoUnit * i.qtd)}</span>
                </div>
              )))}
              {pedidos.some((p) => p.descontoTotal > 0) && (
                <div className="desc"><span>Descontos</span><span>-{brl(pedidos.reduce((s, p) => s + (p.descontoTotal || 0), 0))}</span></div>
              )}
              <div><span>Consumo</span><span>{brl(consumo)}</span></div>
              <label className="check" style={{ justifyContent: "space-between" }}>
                <span><input type="checkbox" checked={servico} onChange={(e) => setServico(e.target.checked)} /> Taxa de serviço ({cfg.salao.taxaServicoPercentual}%)</span>
                <span>{brl(taxa)}</span>
              </label>
              <div className="total"><span>Total</span><span>{brl(total)}</span></div>
            </div>
            <div className="coluna" style={{ gap: 6 }}>
              <div className="rotulo">Forma de pagamento</div>
              <div className="linha">
                {metodos.map((k) => (
                  <button key={k} className={"btn pequeno" + (metodo === k ? " escuro" : "")} onClick={() => setMetodo(k)}>{PAGAMENTOS[k].nome}</button>
                ))}
              </div>
            </div>
            <button className="btn verde grande" onClick={fecharConta}>Fechar conta · {brl(total)}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
