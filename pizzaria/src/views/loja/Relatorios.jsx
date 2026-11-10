import { useState } from "react";
import { brl, arred, useColecao, useConfig, CANAIS, canalDo, nomePagamento, repasseMotoboy } from "../../logic.js";
import { Indicador } from "./Pedidos.jsx";

const PERIODOS = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
};

function intervalo(periodo) {
  const ini = new Date();
  ini.setHours(0, 0, 0, 0);
  let fim = new Date(ini.getTime() + 86400000);
  if (periodo === "ontem") { fim = new Date(ini); ini.setDate(ini.getDate() - 1); }
  if (periodo === "7d") ini.setDate(ini.getDate() - 6);
  if (periodo === "30d") ini.setDate(ini.getDate() - 29);
  if (periodo === "mes") ini.setDate(1);
  return [ini.getTime(), fim.getTime()];
}

function Barras({ linhas, formatar = brl }) {
  const max = Math.max(1, ...linhas.map((l) => l.valor));
  return (
    <div className="coluna" style={{ gap: 9 }}>
      {linhas.map((l) => (
        <div key={l.nome} className="coluna" style={{ gap: 4 }}>
          <div className="linha entre pequeno"><span className="forte">{l.nome}</span><span className="tabular">{l.extra ? `${l.extra} · ` : ""}{formatar(l.valor)}</span></div>
          <div className="barra"><span style={{ width: `${(l.valor / max) * 100}%` }} /></div>
        </div>
      ))}
      {!linhas.length && <div className="suave pequeno">Sem dados no período.</div>}
    </div>
  );
}

export default function Relatorios() {
  const [cfg] = useConfig();
  const [pedidos] = useColecao("pedido", 30000);
  const [contas] = useColecao("conta", 30000);
  const [periodo, setPeriodo] = useState("hoje");
  const [ini, fim] = intervalo(periodo);
  const noPeriodo = (iso) => { const t = new Date(iso).getTime(); return t >= ini && t < fim; };

  const doPeriodo = pedidos.filter((p) => noPeriodo(p.criadoEm));
  const validos = doPeriodo.filter((p) => p.status !== "cancelado");
  const cancelados = doPeriodo.length - validos.length;
  const bruto = arred(validos.reduce((s, p) => s + p.subtotal, 0));
  const descontos = arred(validos.reduce((s, p) => s + (p.descontoTotal || 0), 0));
  const fretes = arred(validos.reduce((s, p) => s + (p.entrega?.total || 0), 0));
  const servico = arred(contas.filter((c) => noPeriodo(c.em)).reduce((s, c) => s + (c.servico || 0), 0));
  const liquido = arred(validos.reduce((s, p) => s + p.total, 0) + servico);
  const ticket = validos.length ? liquido / validos.length : 0;
  const repasses = arred(validos.filter((p) => p.motoboyId && p.status === "entregue").reduce((s, p) => s + repasseMotoboy(p, cfg), 0));

  // Fechamento de caixa: quanto entrou por forma de pagamento.
  const porPagamento = {};
  for (const p of validos) {
    const m = p.pagamento?.metodo || "outro";
    porPagamento[m] = (porPagamento[m] || 0) + (p.aPagar || 0);
    if (p.usoCarteira > 0) porPagamento.carteira = (porPagamento.carteira || 0) + p.usoCarteira;
  }
  const porCanal = Object.keys(CANAIS).map((c) => {
    const l = validos.filter((p) => canalDo(p) === c);
    return { nome: `${CANAIS[c].emoji} ${CANAIS[c].nome}`, valor: arred(l.reduce((s, p) => s + p.total, 0)), extra: `${l.length} pedidos` };
  }).filter((l) => l.valor > 0);

  const produtos = {};
  for (const p of validos) {
    for (const i of p.itens) {
      const nome = i.sabor2 ? `${i.nome} / ${i.sabor2.nome}` : i.nome;
      produtos[nome] = produtos[nome] || { qtd: 0, valor: 0 };
      produtos[nome].qtd += i.qtd;
      produtos[nome].valor += i.qtd * i.precoUnit;
    }
  }
  const top = Object.entries(produtos).sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 10);

  const porHora = Array.from({ length: 24 }, () => 0);
  for (const p of validos) porHora[new Date(p.criadoEm).getHours()]++;
  const horasUsadas = porHora.map((q, h) => [h, q]).filter(([, q]) => q > 0);
  const hMin = horasUsadas.length ? Math.min(...horasUsadas.map(([h]) => h)) : 17;
  const hMax = horasUsadas.length ? Math.max(...horasUsadas.map(([h]) => h)) : 23;
  const maxHora = Math.max(1, ...porHora);

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div className="linha">
        <h2>Caixa e relatórios</h2>
        <div className="abas direita" style={{ margin: 0 }}>
          {Object.entries(PERIODOS).map(([k, v]) => (
            <button key={k} className={periodo === k ? "ativo" : ""} onClick={() => setPeriodo(k)}>{v}</button>
          ))}
        </div>
      </div>

      <div className="indicadores">
        <Indicador rotulo="Faturamento" valor={brl(liquido)} detalhe={`${validos.length} pedidos`} />
        <Indicador rotulo="Ticket médio" valor={brl(ticket)} />
        <Indicador rotulo="Descontos dados" valor={brl(descontos)} />
        <Indicador rotulo="Taxas de entrega" valor={brl(fretes)} detalhe={servico ? `+ ${brl(servico)} de serviço` : null} />
        <Indicador rotulo="Repasse motoboys" valor={brl(repasses)} />
        <Indicador rotulo="Cancelados" valor={cancelados} />
      </div>

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="cartao coluna">
          <h3>Fechamento por forma de pagamento</h3>
          <Barras linhas={Object.entries(porPagamento).map(([m, v]) => ({ nome: nomePagamento(m), valor: arred(v) })).sort((a, b) => b.valor - a.valor)} />
          <div className="suave pequeno">Inclui taxa de entrega. A taxa de serviço das mesas aparece à parte, no indicador acima.</div>
        </div>
        <div className="cartao coluna">
          <h3>Vendas por canal</h3>
          <Barras linhas={porCanal} />
        </div>
      </div>

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="cartao">
          <h3 style={{ marginBottom: 8 }}>Mais vendidos</h3>
          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Produto</th><th className="num">Qtd.</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {top.map(([nome, d]) => (
                  <tr key={nome}><td>{nome}</td><td className="num">{d.qtd}</td><td className="num">{brl(d.valor)}</td></tr>
                ))}
              </tbody>
            </table>
            {!top.length && <div className="suave pequeno" style={{ paddingTop: 8 }}>Sem vendas no período.</div>}
          </div>
        </div>
        <div className="cartao coluna">
          <h3>Pedidos por horário</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 150, paddingTop: 10 }}>
            {porHora.slice(hMin, hMax + 1).map((q, i) => (
              <div key={i} className="coluna" style={{ flex: 1, alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <span className="pequeno tabular">{q || ""}</span>
                <div style={{ width: "100%", maxWidth: 34, height: `${(q / maxHora) * 100}%`, minHeight: q ? 4 : 1, background: q ? "var(--tomate)" : "var(--linha)", borderRadius: "6px 6px 0 0" }} />
                <span className="pequeno suave tabular">{hMin + i}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
