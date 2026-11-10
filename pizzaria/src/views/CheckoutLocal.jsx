import { useState } from "react";
import { salvarItem, uid, obter } from "../db.js";
import { brl, arred, soDigitos, useConfig, aplicarPromocoes, PAGAMENTOS } from "../logic.js";
import { Modal, Campo, toast } from "../ui.jsx";

// Fechamento de pedido para quem está na loja: na mesa (QR code) ou no
// totem do balcão. Não tem endereço nem frete; o pagamento é feito no
// caixa/na mesa, então aqui só se registra como o cliente pretende pagar.
export default function CheckoutLocal({ canal, mesa, itens, promocoes, aoFechar, aoConcluir }) {
  const [cfg] = useConfig();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cupom, setCupom] = useState("");
  const [cupomDigitado, setCupomDigitado] = useState("");
  const [metodo, setMetodo] = useState(canal === "mesa" ? "conta" : "");
  const [enviando, setEnviando] = useState(false);

  const subtotal = arred(itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0));
  // Sem entrega, promoções de frete grátis não se aplicam.
  const { descontos, cupomAplicado, cupomErro } = aplicarPromocoes(promocoes, itens, null, cupom);
  const descontoTotal = arred(Math.min(subtotal, descontos.reduce((s, d) => s + d.valor, 0)));
  const total = arred(subtotal - descontoTotal);
  const metodos = Object.keys(PAGAMENTOS).filter((k) => k !== "carteira" && cfg.pagamentos[k]?.ativo);

  const problemas = [];
  if (canal === "balcao" && !nome.trim()) problemas.push("Diga um nome para chamarmos você.");
  if (canal === "balcao" && !metodo) problemas.push("Escolha como vai pagar no caixa.");
  if (telefone && soDigitos(telefone).length < 10) problemas.push("Celular incompleto (com DDD) — ou deixe em branco.");

  async function confirmar() {
    if (problemas.length) return;
    setEnviando(true);
    try {
      // Celular é opcional: serve para acumular cashback na carteira.
      let cliente = null;
      const id = soDigitos(telefone);
      if (id.length >= 10) {
        cliente = await obter(`cliente:${id}`);
        if (!cliente) {
          cliente = { id, nome: nome.trim() || "Cliente", telefone, enderecos: [], saldo: 0, movimentos: [], criadoEm: new Date().toISOString() };
          await salvarItem("cliente", cliente);
        }
      }
      const agora = new Date().toISOString();
      const pedido = {
        id: uid(),
        numero: String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0"),
        criadoEm: agora,
        canal,
        mesa: canal === "mesa" ? Number(mesa) : null,
        nomeChamada: nome.trim(),
        cliente: cliente ? { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone } : null,
        endereco: null,
        itens: itens.map(({ chave, ...i }) => i),
        subtotal,
        descontos,
        descontoTotal,
        entrega: { km: 0, taxa: 0, adicionalDedicada: 0, total: 0, dedicada: false, minutos: cfg.salao.tempoPreparoMin },
        total,
        usoCarteira: 0,
        aPagar: total,
        pagamento: { metodo: metodo === "conta" ? "conta" : metodo, trocoPara: null },
        pago: false,
        cupom: cupomAplicado ? cupomAplicado.codigo : null,
        status: "recebido",
        historico: [{ status: "recebido", em: agora }],
        motoboyId: null,
        previsaoEm: new Date(Date.now() + cfg.salao.tempoPreparoMin * 60000).toISOString(),
      };
      await salvarItem("pedido", pedido);
      for (const d of descontos) {
        const p = promocoes.find((x) => x.id === d.promocaoId);
        if (p) await salvarItem("promocao", { ...p, usos: (p.usos || 0) + 1 });
      }
      aoConcluir(pedido);
    } catch (e) {
      toast("Erro: " + e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={canal === "mesa" ? `Pedido da mesa ${mesa}` : "Finalizar pedido"} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 18 }}>
        <section className="coluna">
          <div className="campos">
            <Campo
              rotulo={canal === "balcao" ? "Seu nome (para chamarmos)" : "Seu nome (opcional)"}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Campo
              rotulo="Celular para cashback (opcional)"
              type="tel"
              inputMode="tel"
              placeholder="(11) 98888-7777"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
            />
          </div>
          {cfg.carteira.cashbackPercentual > 0 && (
            <div className="suave pequeno">Informe o celular e ganhe {cfg.carteira.cashbackPercentual}% de volta na sua carteira para usar no próximo pedido.</div>
          )}
        </section>

        <section className="coluna">
          <h3>Cupom</h3>
          <div className="linha" style={{ flexWrap: "nowrap" }}>
            <input className="in" placeholder="Código do cupom" value={cupomDigitado} onChange={(e) => setCupomDigitado(e.target.value.toUpperCase())} />
            <button className="btn" onClick={() => setCupom(cupomDigitado)}>Aplicar</button>
          </div>
          {cupom && cupomAplicado && <div className="pequeno" style={{ color: "var(--manjericao)" }}>Cupom {cupomAplicado.codigo} aplicado.</div>}
          {cupom && cupomErro && <div className="pequeno" style={{ color: "var(--erro)" }}>{cupomErro}</div>}
        </section>

        <section className="coluna">
          <h3>Pagamento</h3>
          {canal === "mesa" && (
            <button className={"opcao" + (metodo === "conta" ? " sel" : "")} onClick={() => setMetodo("conta")}>
              <div style={{ flex: 1 }}>
                <div className="forte">Pôr na conta da mesa</div>
                <div className="suave pequeno">Você paga tudo de uma vez quando pedir a conta.</div>
              </div>
            </button>
          )}
          {metodos.map((k) => (
            <button key={k} className={"opcao" + (metodo === k ? " sel" : "")} onClick={() => setMetodo(k)}>
              <div style={{ flex: 1 }}>
                <div className="forte">{PAGAMENTOS[k].nome}</div>
                <div className="suave pequeno">{canal === "mesa" ? "Pagar este pedido na mesa" : "Pagar no caixa ao retirar"}</div>
              </div>
            </button>
          ))}
        </section>

        <section className="resumo cartao">
          <div><span>Subtotal</span><span>{brl(subtotal)}</span></div>
          {descontos.map((d) => <div key={d.promocaoId} className="desc"><span>{d.nome}</span><span>-{brl(d.valor)}</span></div>)}
          <div className="total"><span>Total</span><span>{brl(total)}</span></div>
          {canal === "mesa" && cfg.salao.taxaServicoPercentual > 0 && (
            <div className="suave pequeno">A taxa de serviço ({cfg.salao.taxaServicoPercentual}%) entra no fechamento da conta.</div>
          )}
        </section>

        {problemas.length > 0 && <div className="suave pequeno">{problemas[0]}</div>}
        <button className="btn primario bloco grande" disabled={!!problemas.length || enviando} onClick={confirmar}>
          {enviando ? "Enviando…" : `Enviar pedido para a cozinha · ${brl(total)}`}
        </button>
      </div>
    </Modal>
  );
}
