import { useEffect, useState } from "react";
import { brl, useConfig, salvarConfig, calcularEntrega, PAGAMENTOS } from "../../logic.js";
import { Campo, numero, toast } from "../../ui.jsx";
import EscolherEndereco from "../Endereco.jsx";

export default function Configuracoes() {
  const [cfgSalva, carregado] = useConfig();
  const [cfg, setCfg] = useState(null);
  const [mudandoEndereco, setMudandoEndereco] = useState(false);

  useEffect(() => { if (carregado && !cfg) setCfg(cfgSalva); }, [carregado, cfgSalva, cfg]);
  if (!cfg) return <div className="vazio">Carregando…</div>;

  // Atualiza um caminho tipo "entrega.dedicada.adicionalFixo".
  const set = (caminho, valor) => {
    const novo = structuredClone(cfg);
    const partes = caminho.split(".");
    let o = novo;
    for (const p of partes.slice(0, -1)) o = o[p];
    o[partes[partes.length - 1]] = valor;
    setCfg(novo);
  };
  const num = (caminho) => ({
    inputMode: "decimal",
    value: caminho.split(".").reduce((o, k) => o[k], cfg),
    onChange: (e) => set(caminho, e.target.value),
  });

  async function salvar() {
    const n = structuredClone(cfg);
    const e = n.entrega;
    for (const k of ["taxaBase", "kmInclusos", "valorKmExtra", "raioMaxKm", "fatorRota", "velocidadeKmh", "tempoPreparoMin"]) e[k] = numero(e[k]);
    e.dedicada.adicionalFixo = numero(e.dedicada.adicionalFixo);
    e.dedicada.adicionalPercentual = numero(e.dedicada.adicionalPercentual);
    n.carteira.cashbackPercentual = numero(n.carteira.cashbackPercentual);
    for (const k of Object.keys(n.motoboy)) n.motoboy[k] = numero(n.motoboy[k]);
    if (!/^\d{4,8}$/.test(String(n.adminPin))) return toast("O PIN da loja deve ter de 4 a 8 números.");
    await salvarConfig(n);
    setCfg(n);
    toast("Configurações salvas");
  }

  // Simulação da tabela de frete com os valores atuais do formulário.
  const simular = (km, dedicada) => {
    const c = structuredClone(cfg);
    for (const k of ["taxaBase", "kmInclusos", "valorKmExtra", "raioMaxKm"]) c.entrega[k] = numero(c.entrega[k]);
    c.entrega.fatorRota = 1;
    c.entrega.dedicada.adicionalFixo = numero(c.entrega.dedicada.adicionalFixo);
    c.entrega.dedicada.adicionalPercentual = numero(c.entrega.dedicada.adicionalPercentual);
    const destino = { lat: c.loja.lat + km / 111.2, lng: c.loja.lng };
    return calcularEntrega(c, destino, dedicada);
  };

  return (
    <div className="coluna" style={{ gap: 16, maxWidth: 760 }}>
      <section className="cartao coluna">
        <h3>Loja</h3>
        <div className="campos">
          <Campo rotulo="Nome da pizzaria" value={cfg.loja.nome} onChange={(e) => set("loja.nome", e.target.value)} />
          <Campo rotulo="WhatsApp da loja" value={cfg.loja.telefone} onChange={(e) => set("loja.telefone", e.target.value)} />
          <Campo rotulo="PIN da área da loja" inputMode="numeric" value={cfg.adminPin} onChange={(e) => set("adminPin", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="pequeno">📍 {cfg.loja.endereco || "Endereço não definido — o frete é calculado a partir daqui."}</div>
        {mudandoEndereco ? (
          <EscolherEndereco
            comRotulo={false}
            inicial={{ texto: cfg.loja.endereco, lat: cfg.loja.lat, lng: cfg.loja.lng }}
            textoBotao="Definir como endereço da loja"
            aoCancelar={() => setMudandoEndereco(false)}
            aoSalvar={(e) => { setCfg({ ...cfg, loja: { ...cfg.loja, endereco: e.texto, lat: e.lat, lng: e.lng } }); setMudandoEndereco(false); }}
          />
        ) : (
          <button className="btn" onClick={() => setMudandoEndereco(true)}>Alterar endereço / ponto no mapa</button>
        )}
      </section>

      <section className="cartao coluna">
        <h3>Meios de pagamento</h3>
        {Object.keys(PAGAMENTOS).map((k) => (
          <div key={k} className="linha">
            <label className="check" style={{ minWidth: 200 }}>
              <input type="checkbox" checked={!!cfg.pagamentos[k]?.ativo} onChange={(e) => set(`pagamentos.${k}.ativo`, e.target.checked)} />
              {PAGAMENTOS[k].nome}
            </label>
            <span className="suave pequeno">{PAGAMENTOS[k].detalhe}</span>
          </div>
        ))}
        {cfg.pagamentos.pix.ativo && (
          <Campo rotulo="Chave Pix (mostrada ao cliente)" value={cfg.pagamentos.pix.chave} onChange={(e) => set("pagamentos.pix.chave", e.target.value)} />
        )}
      </section>

      <section className="cartao coluna">
        <h3>Valor da entrega</h3>
        <div className="campos">
          <Campo rotulo="Taxa base (R$)" {...num("entrega.taxaBase")} />
          <Campo rotulo="Km inclusos na taxa" {...num("entrega.kmInclusos")} />
          <Campo rotulo="R$ por km extra" {...num("entrega.valorKmExtra")} />
          <Campo rotulo="Raio máximo (km, 0 = sem limite)" {...num("entrega.raioMaxKm")} />
        </div>
        <div className="campos">
          <Campo rotulo="Fator de rota (reta → ruas)" {...num("entrega.fatorRota")} />
          <Campo rotulo="Velocidade média (km/h)" {...num("entrega.velocidadeKmh")} />
          <Campo rotulo="Tempo de preparo (min)" {...num("entrega.tempoPreparoMin")} />
        </div>

        <h3 style={{ marginTop: 8 }}>⚡ Entrega dedicada (plus)</h3>
        <label className="check">
          <input type="checkbox" checked={cfg.entrega.dedicada.ativo} onChange={(e) => set("entrega.dedicada.ativo", e.target.checked)} /> Oferecer entrega dedicada
        </label>
        {cfg.entrega.dedicada.ativo && (
          <>
            <div className="campos">
              <Campo rotulo="Adicional fixo (R$)" {...num("entrega.dedicada.adicionalFixo")} />
              <Campo rotulo="Adicional % sobre a taxa" {...num("entrega.dedicada.adicionalPercentual")} />
            </div>
            <Campo rotulo="Descrição para o cliente" value={cfg.entrega.dedicada.descricao} onChange={(e) => set("entrega.dedicada.descricao", e.target.value)} />
          </>
        )}

        <table className="tabela" style={{ marginTop: 6 }}>
          <thead><tr><th>Distância</th><th>Padrão</th>{cfg.entrega.dedicada.ativo && <th>Dedicada</th>}</tr></thead>
          <tbody>
            {[1, 3, 5, 8, 12].map((km) => {
              const a = simular(km, false), b = simular(km, true);
              return (
                <tr key={km}>
                  <td>{km} km</td>
                  <td>{a.foraDoRaio ? "fora da área" : brl(a.total)}</td>
                  {cfg.entrega.dedicada.ativo && <td>{b.foraDoRaio ? "fora da área" : brl(b.total)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="cartao coluna">
        <h3>Carteira do cliente</h3>
        <Campo rotulo="Cashback (% do pedido, creditado quando entregue)" {...num("carteira.cashbackPercentual")} />
      </section>

      <section className="cartao coluna">
        <h3>Repasse ao motoboy</h3>
        <div className="campos">
          <Campo rotulo="Por entrega (R$)" {...num("motoboy.repassePorEntrega")} />
          <Campo rotulo="Por km (R$)" {...num("motoboy.repasseKm")} />
          <Campo rotulo="Bônus entrega dedicada (R$)" {...num("motoboy.repasseDedicada")} />
        </div>
      </section>

      <button className="btn primario" style={{ position: "sticky", bottom: 12, padding: 14 }} onClick={salvar}>Salvar configurações</button>
    </div>
  );
}
