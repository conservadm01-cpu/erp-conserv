import { useState } from "react";
import { Zap, Bike, Copy } from "lucide-react";
import { salvarItem, uid, obter } from "../db.js";
import {
  brl, arred, useConfig, calcularEntrega, aplicarPromocoes, PAGAMENTOS, movimentarCarteira,
} from "../logic.js";
import { Modal, Campo, toast, numero } from "../ui.jsx";
import { useClienteAtual, Identificacao } from "../cliente.jsx";
import EscolherEndereco from "./Endereco.jsx";

export default function Checkout({ itens, promocoes, aoFechar, aoConcluir }) {
  const [cfg] = useConfig();
  const [cliente, , recarregarCliente] = useClienteAtual();
  const [enderecoId, setEnderecoId] = useState(null);
  const [novoEndereco, setNovoEndereco] = useState(false);
  const [dedicada, setDedicada] = useState(false);
  const [cupom, setCupom] = useState("");
  const [cupomDigitado, setCupomDigitado] = useState("");
  const [metodo, setMetodo] = useState("");
  const [usarCarteira, setUsarCarteira] = useState(false);
  const [trocoPara, setTrocoPara] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!cliente) {
    return (
      <Modal titulo="Finalizar pedido" aoFechar={aoFechar}>
        <Identificacao titulo="Antes de tudo, seu celular" aoEntrar={() => recarregarCliente()} />
      </Modal>
    );
  }

  const enderecos = cliente.enderecos || [];
  const endereco = enderecos.find((e) => e.id === enderecoId) || (enderecoId === null ? enderecos[0] : null);
  const entrega = endereco ? calcularEntrega(cfg, endereco, dedicada) : null;
  const entregaNormal = endereco ? calcularEntrega(cfg, endereco, false) : null;
  const entregaDedicada = endereco ? calcularEntrega(cfg, endereco, true) : null;

  const subtotal = arred(itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0));
  const { descontos, cupomAplicado, cupomErro } = aplicarPromocoes(promocoes, itens, entrega, cupom);
  const descontoItens = arred(descontos.filter((d) => !d.frete).reduce((s, d) => s + d.valor, 0));
  const descontoFrete = arred(descontos.filter((d) => d.frete).reduce((s, d) => s + d.valor, 0));
  const descontoTotal = arred(Math.min(subtotal, descontoItens) + descontoFrete);
  const total = arred(Math.max(0, subtotal + (entrega?.total || 0) - descontoTotal));

  const pg = cfg.pagamentos;
  const saldo = cliente.saldo || 0;
  const carteiraDisponivel = pg.carteira.ativo && saldo > 0;
  const usoCarteira = usarCarteira && carteiraDisponivel ? arred(Math.min(saldo, total)) : 0;
  const aPagar = arred(total - usoCarteira);
  const metodos = Object.keys(PAGAMENTOS).filter((k) => k !== "carteira" && pg[k]?.ativo);

  const problemas = [];
  if (!endereco) problemas.push("Escolha o endereço de entrega.");
  if (entrega?.foraDoRaio) problemas.push(`Fora da área de entrega (máx. ${cfg.entrega.raioMaxKm} km).`);
  if (aPagar > 0 && !metodo) problemas.push("Escolha a forma de pagamento.");
  if (metodo === "dinheiro" && trocoPara && numero(trocoPara) < aPagar) problemas.push("O valor para troco é menor que o total.");

  async function salvarEndereco(e) {
    const novo = { id: uid(), ...e };
    const atualizado = { ...cliente, enderecos: [...enderecos, novo] };
    await salvarItem("cliente", atualizado);
    await recarregarCliente();
    setEnderecoId(novo.id);
    setNovoEndereco(false);
  }

  async function confirmar() {
    if (problemas.length) return;
    setEnviando(true);
    try {
      // Confere o saldo na hora de fechar, para não gastar duas vezes.
      if (usoCarteira > 0) {
        const atual = await obter(`cliente:${cliente.id}`);
        if ((atual?.saldo || 0) < usoCarteira) throw new Error("Seu saldo mudou. Revise o pagamento.");
      }
      const agora = new Date().toISOString();
      const pedido = {
        id: uid(),
        numero: String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0"),
        criadoEm: agora,
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
        endereco: { texto: endereco.texto, complemento: endereco.complemento, lat: endereco.lat, lng: endereco.lng },
        itens: itens.map(({ chave, ...i }) => i),
        subtotal,
        descontos,
        descontoTotal,
        entrega,
        total,
        usoCarteira,
        aPagar,
        pagamento: { metodo: aPagar > 0 ? metodo : "carteira", trocoPara: metodo === "dinheiro" ? numero(trocoPara) || null : null },
        cupom: cupomAplicado ? cupomAplicado.codigo : null,
        status: "recebido",
        historico: [{ status: "recebido", em: agora }],
        motoboyId: null,
        previsaoEm: new Date(Date.now() + entrega.minutos * 60000).toISOString(),
      };
      await salvarItem("pedido", pedido);
      if (usoCarteira > 0) await movimentarCarteira(cliente.id, -usoCarteira, `Pagamento do pedido #${pedido.numero}`, pedido.id);
      for (const d of descontos) {
        const p = promocoes.find((x) => x.id === d.promocaoId);
        if (p) await salvarItem("promocao", { ...p, usos: (p.usos || 0) + 1 });
      }
      toast("Pedido enviado! 🍕");
      aoConcluir(pedido);
    } catch (e) {
      toast("Erro: " + e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Finalizar pedido" aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 18 }}>
        <div className="linha entre pequeno">
          <span>Olá, <b>{cliente.nome}</b></span>
          <span className="suave">{cliente.telefone}</span>
        </div>

        <section className="coluna">
          <h3>Entregar em</h3>
          {!novoEndereco && enderecos.map((e) => (
            <button key={e.id} className={"opcao" + (endereco?.id === e.id ? " sel" : "")} onClick={() => setEnderecoId(e.id)}>
              <div>
                <div className="forte">{e.rotulo || "Endereço"}</div>
                <div className="suave pequeno">{e.complemento ? e.complemento + " — " : ""}{e.texto}</div>
              </div>
            </button>
          ))}
          {novoEndereco || !enderecos.length ? (
            <EscolherEndereco aoSalvar={salvarEndereco} aoCancelar={enderecos.length ? () => setNovoEndereco(false) : null} />
          ) : (
            <button className="btn" onClick={() => setNovoEndereco(true)}>+ Novo endereço</button>
          )}
        </section>

        {endereco && !novoEndereco && entregaNormal && (
          <section className="coluna">
            <h3>Tipo de entrega</h3>
            <button className={"opcao" + (!dedicada ? " sel" : "")} onClick={() => setDedicada(false)}>
              <Bike size={22} />
              <div style={{ flex: 1 }}>
                <div className="forte">Padrão</div>
                <div className="suave pequeno">{entregaNormal.km.toFixed(1)} km · cerca de {entregaNormal.minutos} min</div>
              </div>
              <span className="preco">{brl(entregaNormal.total)}</span>
            </button>
            {cfg.entrega.dedicada.ativo && (
              <button className={"opcao" + (dedicada ? " sel" : "")} onClick={() => setDedicada(true)}>
                <Zap size={22} color="#d97706" />
                <div style={{ flex: 1 }}>
                  <div className="forte">Dedicada / expressa</div>
                  <div className="suave pequeno">{cfg.entrega.dedicada.descricao} Cerca de {entregaDedicada.minutos} min.</div>
                </div>
                <span className="preco">{brl(entregaDedicada.total)}</span>
              </button>
            )}
            {entrega?.foraDoRaio && <div className="pequeno" style={{ color: "#b91c1c" }}>Este endereço está fora da nossa área de entrega.</div>}
          </section>
        )}

        <section className="coluna">
          <h3>Cupom</h3>
          <div className="linha" style={{ flexWrap: "nowrap" }}>
            <input className="in" placeholder="Código do cupom" value={cupomDigitado} onChange={(e) => setCupomDigitado(e.target.value.toUpperCase())} />
            <button className="btn" onClick={() => setCupom(cupomDigitado)}>Aplicar</button>
          </div>
          {cupom && cupomAplicado && <div className="pequeno" style={{ color: "#15803d" }}>Cupom {cupomAplicado.codigo} aplicado.</div>}
          {cupom && cupomErro && <div className="pequeno" style={{ color: "#b91c1c" }}>{cupomErro}</div>}
        </section>

        <section className="coluna">
          <h3>Pagamento</h3>
          {carteiraDisponivel && (
            <label className="opcao" style={usarCarteira ? { borderColor: "#15803d", background: "#f0fbf3" } : null}>
              <input type="checkbox" checked={usarCarteira} onChange={(e) => setUsarCarteira(e.target.checked)} />
              <div style={{ flex: 1 }}>
                <div className="forte">Usar saldo da carteira</div>
                <div className="suave pequeno">Disponível: {brl(saldo)}</div>
              </div>
              {usarCarteira && <span className="forte" style={{ color: "#15803d" }}>-{brl(usoCarteira)}</span>}
            </label>
          )}
          {aPagar > 0 && metodos.map((k) => (
            <button key={k} className={"opcao" + (metodo === k ? " sel" : "")} onClick={() => setMetodo(k)}>
              <div style={{ flex: 1 }}>
                <div className="forte">{PAGAMENTOS[k].nome}</div>
                <div className="suave pequeno">{PAGAMENTOS[k].detalhe}</div>
              </div>
            </button>
          ))}
          {aPagar > 0 && metodo === "pix" && pg.pix.chave && (
            <div className="cartao pequeno linha entre" style={{ background: "#f0fbf3" }}>
              <span>Chave Pix: <b>{pg.pix.chave}</b></span>
              <button className="btn pequeno" onClick={() => { navigator.clipboard?.writeText(pg.pix.chave); toast("Chave copiada"); }}><Copy size={14} /> Copiar</button>
            </div>
          )}
          {aPagar > 0 && metodo === "dinheiro" && (
            <Campo rotulo="Troco para quanto? (deixe vazio se não precisar)" inputMode="decimal" placeholder="Ex.: 100" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} />
          )}
        </section>

        <section className="resumo cartao">
          <div><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          {entrega && <div><span>Entrega ({entrega.km.toFixed(1)} km)</span><span>{brl(entrega.taxa)}</span></div>}
          {entrega?.dedicada && <div><span>Adicional entrega dedicada</span><span>{brl(entrega.adicionalDedicada)}</span></div>}
          {descontos.map((d) => <div key={d.promocaoId} className="desc"><span>{d.nome}</span><span>-{brl(d.valor)}</span></div>)}
          {usoCarteira > 0 && <div className="desc"><span>Saldo da carteira</span><span>-{brl(usoCarteira)}</span></div>}
          <div className="total"><span>A pagar</span><span>{brl(aPagar)}</span></div>
          {cfg.carteira.cashbackPercentual > 0 && (
            <div className="suave pequeno">Você ganha {cfg.carteira.cashbackPercentual}% de cashback na carteira quando o pedido for entregue.</div>
          )}
        </section>

        {problemas.length > 0 && <div className="suave pequeno">{problemas[0]}</div>}
        <button className="btn primario bloco" style={{ padding: 14, fontSize: 16 }} disabled={!!problemas.length || enviando} onClick={confirmar}>
          {enviando ? "Enviando…" : `Fazer pedido · ${brl(aPagar)}`}
        </button>
      </div>
    </Modal>
  );
}
