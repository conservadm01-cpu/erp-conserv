import { useEffect, useState, useCallback } from "react";
import { listar, obter, gravar, salvarItem, uid } from "./db.js";

// ---------- Formatação ----------
export const brl = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const hora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
export const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
export const soDigitos = (s) => String(s || "").replace(/\D/g, "");
export const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;

// ---------- Configuração da loja ----------
export const CONFIG_PADRAO = {
  loja: {
    nome: "Pizzaria",
    telefone: "",
    endereco: "",
    lat: -23.55052,
    lng: -46.633308,
  },
  adminPin: "1234",
  pagamentos: {
    pix: { ativo: true, chave: "" },
    credito: { ativo: true },
    debito: { ativo: true },
    dinheiro: { ativo: true },
    vale: { ativo: false },
    carteira: { ativo: true },
  },
  entrega: {
    taxaBase: 5,
    kmInclusos: 3,
    valorKmExtra: 1.5,
    raioMaxKm: 12,
    fatorRota: 1.3, // distância em linha reta x fator ≈ distância pelas ruas
    velocidadeKmh: 25,
    tempoPreparoMin: 25,
    dedicada: {
      ativo: true,
      adicionalFixo: 7,
      adicionalPercentual: 0, // % sobre a taxa de entrega normal
      descricao: "Motoboy exclusivo: sai assim que a pizza fica pronta e vai direto, sem outras paradas.",
    },
  },
  carteira: { cashbackPercentual: 5 },
  motoboy: { repassePorEntrega: 5, repasseKm: 0.5, repasseDedicada: 5 },
};

export const PAGAMENTOS = {
  pix: { nome: "Pix", detalhe: "Pague agora pela chave Pix" },
  credito: { nome: "Cartão de crédito", detalhe: "Maquininha na entrega" },
  debito: { nome: "Cartão de débito", detalhe: "Maquininha na entrega" },
  dinheiro: { nome: "Dinheiro", detalhe: "Informe se precisa de troco" },
  vale: { nome: "Vale-refeição", detalhe: "Maquininha na entrega" },
  carteira: { nome: "Saldo da carteira", detalhe: "Usa seu saldo/cashback" },
};

function mesclar(padrao, salvo) {
  if (!salvo || typeof salvo !== "object" || Array.isArray(salvo)) return salvo ?? padrao;
  const out = { ...padrao };
  for (const k of Object.keys(salvo)) {
    out[k] = padrao && typeof padrao[k] === "object" && !Array.isArray(padrao[k])
      ? mesclar(padrao[k], salvo[k])
      : salvo[k];
  }
  return out;
}

// ---------- Status do pedido ----------
export const STATUS = {
  recebido: { nome: "Pedido recebido", curto: "Recebido", cor: "#6d5bd0" },
  preparo: { nome: "Em preparo", curto: "Preparo", cor: "#d97706" },
  pronto: { nome: "Pronto, aguardando motoboy", curto: "Pronto", cor: "#0e7490" },
  em_rota: { nome: "Saiu para entrega", curto: "Em rota", cor: "#2563eb" },
  entregue: { nome: "Entregue", curto: "Entregue", cor: "#15803d" },
  cancelado: { nome: "Cancelado", curto: "Cancelado", cor: "#b91c1c" },
};
export const FLUXO = ["recebido", "preparo", "pronto", "em_rota", "entregue"];

export const CATEGORIAS = {
  pizza: "Pizzas",
  doce: "Pizzas doces",
  bebida: "Bebidas",
  sobremesa: "Sobremesas",
  outros: "Outros",
};

// ---------- Hooks de dados ----------
// Recarrega a cada `intervalo` ms e também quando esta aba (ou outra aba,
// no modo demonstração) grava algo na coleção.
function useAtualizacao(colecao, carregar, intervalo) {
  useEffect(() => {
    carregar();
    const t = intervalo ? setInterval(carregar, intervalo) : null;
    const aoMudar = (e) => { if (!colecao || e.detail === colecao) carregar(); };
    const aoMudarOutraAba = (e) => { if (e.key && e.key.startsWith("pz:")) carregar(); };
    window.addEventListener("pz-mudou", aoMudar);
    window.addEventListener("storage", aoMudarOutraAba);
    return () => {
      if (t) clearInterval(t);
      window.removeEventListener("pz-mudou", aoMudar);
      window.removeEventListener("storage", aoMudarOutraAba);
    };
  }, [colecao, carregar, intervalo]);
}

export function useColecao(colecao, intervalo = 0) {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const carregar = useCallback(async () => {
    try {
      setItens(await listar(colecao));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregado(true);
    }
  }, [colecao]);
  useAtualizacao(colecao, carregar, intervalo);
  return [itens, carregado, carregar];
}

export function useRegistro(chave, intervalo = 0) {
  const [valor, setValor] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const carregar = useCallback(async () => {
    if (!chave) { setValor(null); setCarregado(true); return; }
    try {
      setValor(await obter(chave));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregado(true);
    }
  }, [chave]);
  useAtualizacao(chave ? chave.split(":")[0] : null, carregar, intervalo);
  return [valor, carregado, carregar];
}

export function useConfig() {
  const [salvo, carregado] = useRegistro("config", 30000);
  return [mesclar(CONFIG_PADRAO, salvo), carregado];
}

export const salvarConfig = (cfg) => gravar("config", cfg);

// ---------- Geolocalização ----------
export function distanciaKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function buscarEndereco(texto) {
  const q = encodeURIComponent(texto);
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&countrycodes=br&q=${q}`,
    { headers: { "Accept-Language": "pt-BR" } }
  );
  if (!r.ok) throw new Error("Falha ao buscar endereço");
  const dados = await r.json();
  return dados.map((d) => ({ texto: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

export async function enderecoDaPosicao(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const d = await r.json();
    return d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function posicaoAtual() {
  return new Promise((ok, falha) => {
    if (!navigator.geolocation) return falha(new Error("Este aparelho não oferece geolocalização."));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => falha(new Error(e.message || "Não foi possível obter a localização.")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// ---------- Valor da entrega ----------
// taxa = taxaBase + (km além dos inclusos x valorKmExtra)
// entrega dedicada = taxa + adicionalFixo + adicionalPercentual% da taxa
export function calcularEntrega(cfg, destino, dedicada) {
  const e = cfg.entrega;
  const reta = distanciaKm(cfg.loja, destino);
  if (reta == null) return null;
  const km = arred(reta * (e.fatorRota || 1));
  const foraDoRaio = e.raioMaxKm > 0 && km > e.raioMaxKm;
  const extraKm = Math.max(0, km - (e.kmInclusos || 0));
  const taxa = arred((e.taxaBase || 0) + extraKm * (e.valorKmExtra || 0));
  const usaDedicada = !!(dedicada && e.dedicada.ativo);
  const adicional = usaDedicada
    ? arred((e.dedicada.adicionalFixo || 0) + (taxa * (e.dedicada.adicionalPercentual || 0)) / 100)
    : 0;
  const minutos = Math.round((e.tempoPreparoMin || 0) * (usaDedicada ? 0.85 : 1) + (km / (e.velocidadeKmh || 25)) * 60);
  return { km, taxa, dedicada: usaDedicada, adicionalDedicada: adicional, total: arred(taxa + adicional), foraDoRaio, minutos };
}

// ---------- Promoções ----------
const HOJE = () => new Date();

export function promocaoValida(p, agora = HOJE()) {
  if (!p.ativo) return false;
  if (p.inicio && agora < new Date(p.inicio + "T00:00:00")) return false;
  if (p.fim && agora > new Date(p.fim + "T23:59:59")) return false;
  if (p.diasSemana && p.diasSemana.length && !p.diasSemana.includes(agora.getDay())) return false;
  if (p.limiteUsos && (p.usos || 0) >= p.limiteUsos) return false;
  return true;
}

function baseDaPromocao(p, itens) {
  if (p.alvo === "categoria") return itens.filter((i) => i.categoria === p.alvoId).reduce((s, i) => s + i.precoUnit * i.qtd, 0);
  if (p.alvo === "produto") return itens.filter((i) => i.produtoId === p.alvoId).reduce((s, i) => s + i.precoUnit * i.qtd, 0);
  return itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0);
}

// Retorna os descontos aplicáveis. Promoções automáticas entram sozinhas;
// cupom só entra se o código bater. Frete grátis zera só a taxa normal —
// o adicional da entrega dedicada continua sendo cobrado.
export function aplicarPromocoes(promocoes, itens, entrega, codigoCupom) {
  const subtotal = itens.reduce((s, i) => s + i.precoUnit * i.qtd, 0);
  const codigo = (codigoCupom || "").trim().toUpperCase();
  const descontos = [];
  let cupomAplicado = null;
  let cupomErro = null;

  for (const p of promocoes) {
    const ehCupom = p.tipo === "cupom";
    if (ehCupom && (!codigo || (p.codigo || "").toUpperCase() !== codigo)) continue;
    if (!promocaoValida(p)) {
      if (ehCupom) cupomErro = "Cupom fora da validade ou esgotado.";
      continue;
    }
    if (p.pedidoMinimo && subtotal < p.pedidoMinimo) {
      if (ehCupom) cupomErro = `Cupom válido para pedidos a partir de ${brl(p.pedidoMinimo)}.`;
      continue;
    }
    let valor = 0;
    if (p.descontoTipo === "frete") {
      valor = entrega ? entrega.taxa : 0;
    } else {
      const base = baseDaPromocao(p, itens);
      if (base <= 0) continue;
      valor = p.descontoTipo === "percentual" ? (base * (p.valor || 0)) / 100 : Math.min(base, p.valor || 0);
    }
    valor = arred(valor);
    if (valor <= 0) continue;
    descontos.push({ promocaoId: p.id, nome: p.nome || p.codigo, valor, frete: p.descontoTipo === "frete" });
    if (ehCupom) cupomAplicado = p;
  }

  // Só um desconto de frete conta.
  let viuFrete = false;
  const finais = descontos.filter((d) => {
    if (!d.frete) return true;
    if (viuFrete) return false;
    viuFrete = true;
    return true;
  });
  if (codigo && !cupomAplicado && !cupomErro) cupomErro = "Cupom não encontrado.";
  return { descontos: finais, cupomAplicado, cupomErro };
}

export function precoPromocional(produto, promocoes) {
  // Mostra no catálogo o selo de promoção automática que atinge o produto.
  return promocoes.find(
    (p) =>
      p.tipo !== "cupom" &&
      p.descontoTipo === "percentual" &&
      !p.pedidoMinimo &&
      promocaoValida(p) &&
      ((p.alvo === "produto" && p.alvoId === produto.id) || (p.alvo === "categoria" && p.alvoId === produto.categoria))
  );
}

// ---------- Carteira do cliente ----------
export async function movimentarCarteira(clienteId, valor, descricao, pedidoId) {
  const cliente = await obter(`cliente:${clienteId}`);
  if (!cliente) return null;
  const mov = { id: uid(), em: new Date().toISOString(), valor: arred(valor), descricao, pedidoId: pedidoId || null };
  cliente.saldo = arred((cliente.saldo || 0) + valor);
  cliente.movimentos = [mov, ...(cliente.movimentos || [])];
  await salvarItem("cliente", cliente);
  return cliente;
}

// ---------- Pedidos ----------
export async function mudarStatus(pedido, status, extra = {}, cfg) {
  const atualizado = {
    ...pedido,
    ...extra,
    status,
    historico: [...(pedido.historico || []), { status, em: new Date().toISOString() }],
  };
  // Cashback entra na carteira só quando o pedido é entregue, uma única vez.
  if (status === "entregue" && !pedido.cashbackCreditado && cfg) {
    const pct = cfg.carteira.cashbackPercentual || 0;
    const base = (pedido.subtotal || 0) - (pedido.descontoTotal || 0);
    const valor = arred((base * pct) / 100);
    if (valor > 0 && pedido.cliente?.id) {
      await movimentarCarteira(pedido.cliente.id, valor, `Cashback do pedido #${pedido.numero}`, pedido.id);
    }
    atualizado.cashbackCreditado = valor;
  }
  // Cancelou: devolve o saldo de carteira que tinha sido usado.
  if (status === "cancelado" && pedido.usoCarteira > 0 && !pedido.carteiraEstornada && pedido.cliente?.id) {
    await movimentarCarteira(pedido.cliente.id, pedido.usoCarteira, `Estorno do pedido #${pedido.numero}`, pedido.id);
    atualizado.carteiraEstornada = true;
  }
  await salvarItem("pedido", atualizado);
  return atualizado;
}

export function repasseMotoboy(pedido, cfg) {
  const m = cfg.motoboy;
  return arred(
    (m.repassePorEntrega || 0) +
      (pedido.entrega?.km || 0) * (m.repasseKm || 0) +
      (pedido.entrega?.dedicada ? m.repasseDedicada || 0 : 0)
  );
}

export const ehHoje = (iso) => iso && new Date(iso).toDateString() === new Date().toDateString();

// ---------- Dados de exemplo ----------
export async function criarExemplos() {
  const produtos = [
    ["Margherita", "pizza", "Molho de tomate, mussarela, tomate e manjericão fresco", [["Broto", 32], ["Média", 46], ["Grande", 58]]],
    ["Calabresa", "pizza", "Mussarela, calabresa fatiada e cebola roxa", [["Broto", 30], ["Média", 44], ["Grande", 55]]],
    ["Portuguesa", "pizza", "Presunto, ovos, cebola, ervilha, azeitona e mussarela", [["Broto", 34], ["Média", 49], ["Grande", 62]]],
    ["Frango com catupiry", "pizza", "Frango desfiado temperado e catupiry original", [["Broto", 34], ["Média", 49], ["Grande", 62]]],
    ["Quatro queijos", "pizza", "Mussarela, provolone, parmesão e gorgonzola", [["Broto", 36], ["Média", 52], ["Grande", 66]]],
    ["Chocolate com morango", "doce", "Chocolate ao leite e morangos frescos", [["Broto", 32], ["Média", 45]]],
    ["Refrigerante 2L", "bebida", "Coca-Cola, Guaraná ou Fanta", [["Único", 14]]],
    ["Suco natural 500ml", "bebida", "Laranja, limão ou maracujá", [["Único", 10]]],
    ["Petit gâteau", "sobremesa", "Com sorvete de creme", [["Único", 19]]],
  ];
  for (const [nome, categoria, descricao, tamanhos] of produtos) {
    await salvarItem("produto", {
      id: uid(), nome, categoria, descricao, imagem: "", ativo: true, meioAMeio: categoria === "pizza" || categoria === "doce",
      tamanhos: tamanhos.map(([n, p]) => ({ nome: n, preco: p })),
    });
  }
  await salvarItem("promocao", {
    id: uid(), nome: "Terça da pizza: 15% off em pizzas", tipo: "automatica", descontoTipo: "percentual", valor: 15,
    alvo: "categoria", alvoId: "pizza", diasSemana: [2], ativo: true,
  });
  await salvarItem("promocao", {
    id: uid(), nome: "Frete grátis acima de R$ 120", tipo: "automatica", descontoTipo: "frete", valor: 0,
    alvo: "pedido", pedidoMinimo: 120, diasSemana: [], ativo: true,
  });
  await salvarItem("promocao", {
    id: uid(), nome: "Primeira compra", tipo: "cupom", codigo: "BEMVINDO", descontoTipo: "valor", valor: 10,
    alvo: "pedido", pedidoMinimo: 50, diasSemana: [], ativo: true,
  });
  await salvarItem("motoboy", {
    id: uid(), nome: "Carlos", telefone: "", veiculo: "Honda CG 160", placa: "ABC1D23", pin: "1111", ativo: true,
  });
}
