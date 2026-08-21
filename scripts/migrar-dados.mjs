// Migra os dados reais do sistema atual (prefixos antigos: setor:, material:,
// produto:, colaborador:, cliente:, etapa:, mensagem:, ordem_producao:,
// solicitacao_arte:, acesso:, registro:, grupo_produto:, consumo_material:,
// vinculo:, tamanho:, solicitacao_compra:) para o formato do sistema novo
// (prefixo confeccao-erp:<colecao>:<id>), sem apagar ou sobrescrever nada do
// que já existe — só ADICIONA linhas novas na mesma tabela app_storage.
//
// Uso:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/migrar-dados.mjs [--dry-run]
//
// --dry-run mostra o que seria gravado sem gravar nada.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!URL || !KEY) {
  console.error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de rodar.");
  process.exit(1);
}

const supabase = createClient(URL, KEY);
const TABLE = "app_storage";
const NOVO_PREFIXO = "confeccao-erp";

const uid = () => Math.random().toString(36).slice(2, 9);
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const hoje = () => new Date().toISOString().slice(0, 10);

function mimParaCategoria(tipo) {
  return tipo && String(tipo).startsWith("image/") ? "imagem" : "documento";
}
function migrarArquivo(a) {
  if (!a) return null;
  return { id: a.id || uid(), nome: a.nome || "arquivo", tipo: a.tipo && (a.tipo === "imagem" || a.tipo === "documento") ? a.tipo : mimParaCategoria(a.tipo), url: a.url || a.dataUrl || "" };
}
function mapaPerfil(p) {
  const t = String(p || "").trim().toLowerCase();
  if (t === "administrador") return "Administrador";
  if (t === "gestor") return "Gestor";
  return "Colaborador";
}

async function buscarTudo() {
  const PAGE = 1000;
  let de = 0;
  const linhas = [];
  for (;;) {
    const { data, error } = await supabase.from(TABLE).select("key, value").range(de, de + PAGE - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < PAGE) break;
    de += PAGE;
  }
  return linhas;
}

function agrupar(linhas, prefixo) {
  const p = prefixo + ":";
  return linhas
    .filter((l) => l.key.startsWith(p))
    .map((l) => {
      let v = l.value;
      if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { /* mantém string */ } }
      return v;
    });
}

async function gravar(colecao, id, registro) {
  const chave = `${NOVO_PREFIXO}:${colecao}:${id}`;
  if (DRY_RUN) return chave;
  const { error } = await supabase.from(TABLE).upsert({ key: chave, value: JSON.stringify(registro), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`${chave}: ${error.message}`);
  return chave;
}

async function main() {
  console.log(DRY_RUN ? "== MODO SIMULAÇÃO (nada será gravado) ==" : "== MIGRANDO DADOS ==");
  const linhas = await buscarTudo();
  console.log(`Lidas ${linhas.length} linhas de ${TABLE}.`);

  const setores = agrupar(linhas, "setor");
  const materiais = agrupar(linhas, "material");
  const produtos = agrupar(linhas, "produto");
  const consumos = agrupar(linhas, "consumo_material");
  const vinculos = agrupar(linhas, "vinculo");
  const tamanhos = agrupar(linhas, "tamanho");
  const grupos = agrupar(linhas, "grupo_produto");
  const colaboradores = agrupar(linhas, "colaborador");
  const clientes = agrupar(linhas, "cliente");
  const mensagens = agrupar(linhas, "mensagem");
  const etapas = agrupar(linhas, "etapa");
  const ordens = agrupar(linhas, "ordem_producao");
  const solicitacoesArte = agrupar(linhas, "solicitacao_arte");
  const acessos = agrupar(linhas, "acesso");
  const registros = agrupar(linhas, "registro");
  const solicitacoesCompra = agrupar(linhas, "solicitacao_compra");

  const tamanhoPorId = new Map(tamanhos.map((t) => [t.id, t.nome]));
  const contagens = {};
  let gravados = 0;

  // --- departamentos (de setor) ---
  for (const s of setores) {
    await gravar("departamentos", s.id, { id: s.id, nome: s.nome || "", responsavel: "", descricao: "", _tipoOriginal: s.tipo || null });
    gravados++;
  }
  contagens.departamentos = setores.length;

  // --- materiais ---
  for (const m of materiais) {
    await gravar("materiais", m.id, {
      id: m.id, codigo: m.codigo || "", nome: m.nome || "", categoriaId: "", categoria: "", cor: "",
      unidade: m.unidade || "un", estoqueAtual: num(m.quantidadeEstoque), estoqueMinimo: num(m.estoqueMinimo),
      custo: num(m.preco), fornecedorId: m.fornecedorId || "", fornecedor: m.fornecedorNomeSnap || "", localizacao: "",
      _estoqueMaximoOriginal: m.estoqueMaximo ?? null, _sequenciaOriginal: m.sequencia ?? null
    });
    gravados++;
  }
  contagens.materiais = materiais.length;

  // --- grupos de produto ---
  for (const g of grupos) {
    await gravar("gruposProduto", g.id, { id: g.id, codigo: g.codigo || null, nome: g.nome || "" });
    gravados++;
  }
  contagens.gruposProduto = grupos.length;

  // --- produtos (funde tamanho -> medidas, consumo_material -> fichaTecnica, vinculo -> etapas) ---
  for (const p of produtos) {
    const fichaTecnica = consumos.filter((c) => c.produtoId === p.id).map((c) => ({ materialId: c.materialId, quantidade: num(c.quantidadePorPeca) }));
    const etapasProduto = vinculos.filter((v) => v.produtoId === p.id).sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((v) => ({ etapaId: v.etapaId, equipamentoId: "", tempoEstimadoSeg: v.tempoEstimadoSeg }));
    const medidas = tamanhoPorId.get(p.tamanhoId) || "";
    await gravar("produtos", p.id, {
      id: p.id, codigo: p.codigo || "", nome: p.nome || "", categoriaId: "", grupoId: p.grupoProdutoId || "", subgrupoId: "",
      tecidoId: p.materialTecidoId || "", categoria: "", medidas, observacoes: "", arquivos: [], fichaTecnica, etapas: etapasProduto,
      _tamanhoOriginal: p.tamanhoNomeSnap || medidas || null
    });
    gravados++;
  }
  contagens.produtos = produtos.length;

  // --- colaboradores ---
  for (const c of colaboradores) {
    await gravar("colaboradores", c.id, {
      id: c.id, nome: c.nome || "", cpf: "", rg: "", dataNascimento: "", telefone: "", celular: "", email: "",
      cargo: "", funcoes: c.funcao ? [c.funcao] : [], departamentoId: "", dataAdmissao: hoje(),
      salario: num(c.salarioMensal), status: "Ativo", perfil: mapaPerfil(c.perfil),
      senha: c.senha || undefined, precisaTrocarSenha: !c.senha,
      cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", observacoes: ""
    });
    gravados++;
  }
  contagens.colaboradores = colaboradores.length;

  // --- clientes ---
  for (const c of clientes) {
    await gravar("clientes", c.id, {
      id: c.id, tipo: "PJ", nome: c.nome || "", nomeFantasia: "", documento: "", ie: "", indicadorIE: "Contribuinte",
      telefone: "", celular: "", responsavel: c.contato || "", email: "",
      cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", observacoes: c.observacao || ""
    });
    gravados++;
  }
  contagens.clientes = clientes.length;

  // --- mensagens (chat) ---
  for (const m of mensagens) {
    await gravar("mensagens", m.id, { id: m.id, autorNome: m.autorNome || "", autorPerfil: mapaPerfil(m.autorPerfil), texto: m.texto || "", criadoEm: m.criadoEm || new Date().toISOString() });
    gravados++;
  }
  contagens.mensagens = mensagens.length;

  // --- etapasProducao (de etapa) ---
  for (const e of etapas) {
    await gravar("etapasProducao", e.id, {
      id: e.id, nome: e.nome || "", departamentoId: e.setorId || "",
      modoTempo: e.tipoCalculo === "lote" || e.tipoCalculo === "equipe" ? e.tipoCalculo : "peca",
      tempoProducao: "", unidadeTempo: "min", tamanhoLote: "", tamanhoEquipe: ""
    });
    gravados++;
  }
  contagens.etapasProducao = etapas.length;

  // --- solicitacoesArte (formato pode já estar próximo do novo; migra os campos conhecidos e preserva o resto) ---
  let seqArte = 1;
  for (const s of solicitacoesArte) {
    const numero = s.numero || seqArte;
    seqArte = Math.max(seqArte, numero + 1);
    await gravar("solicitacoesArte", s.id, {
      id: s.id, numero, ehAlteracao: !!s.ehAlteracao, status: s.status === "concluida" || s.concluidaEm ? "concluida" : "pendente",
      clienteId: s.clienteId || "", clienteNomeSnap: s.clienteNomeSnap || "",
      itens: Array.isArray(s.itens) ? s.itens : (s.produtoId ? [{ id: uid(), produtoId: s.produtoId, produtoNomeSnap: s.produtoNomeSnap || "", quantidade: 1 }] : []),
      tamanhoProduto: s.tamanhoProduto || s.medidas || "", corProduto: s.corProduto || "", tecidoMaterial: s.tecidoMaterial || "",
      tipoPersonalizacao: s.tipoPersonalizacao || "", tipoPersonalizacaoOutro: s.tipoPersonalizacaoOutro || "",
      localPersonalizacao: s.localPersonalizacao || "", localPersonalizacaoOutro: s.localPersonalizacaoOutro || "",
      tamanhoEstampa: s.tamanhoEstampa || "", corEstampa: s.corEstampa || "",
      fotosProduto: (s.fotosProduto || []).map(migrarArquivo).filter(Boolean),
      arquivosLogo: (s.arquivosLogo || s.arquivos || []).map(migrarArquivo).filter(Boolean),
      textoArte: s.textoArte || s.detalhesProjeto || "",
      arquivosReferencia: (s.arquivosReferencia || []).map(migrarArquivo).filter(Boolean),
      observacoesCliente: s.observacoesCliente || "", descricaoAlteracao: s.descricaoAlteracao || "",
      criadaEm: s.criadaEm || new Date().toISOString(), concluidaEm: s.concluidaEm || null,
      _tipoOriginal: s.tipo || null
    });
    gravados++;
  }
  contagens.solicitacoesArte = solicitacoesArte.length;
  if (!DRY_RUN && solicitacoesArte.length) {
    await gravar("_meta_seq_arte_hint", "valor", { proximo: seqArte });
  }

  // --- logs (de acesso — histórico de login) ---
  for (const a of acessos) {
    await gravar("logs", a.id, { id: a.id, quando: (a.dataHora || "").replace("T", " ").slice(0, 16), data: (a.dataHora || "").slice(0, 10), quem: a.nome || "", perfil: "—", acao: "Login", detalhe: "" });
    gravados++;
  }
  contagens.logs = acessos.length;

  // --- ops (de ordem_producao) — melhor esforço: 1 produto por OP (usa o primeiro item) ---
  for (const o of ordens) {
    const primeiroItem = (o.itens || [])[0] || {};
    await gravar("ops", o.id, {
      id: o.id, numero: o.numero, clienteId: o.clienteId || "", clienteNomeSnap: o.clienteNomeSnap || "",
      produtoId: primeiroItem.produtoId || "", produtoNomeSnap: primeiroItem.produtoNomeSnap || "",
      quantidade: num(primeiroItem.quantidade),
      etapas: (o.etapas || []).map((e) => ({ etapaId: e.etapaId, nome: e.etapaNomeSnap || "", status: e.concluida ? "Concluída" : "Não iniciada", qtdConcluida: 0, qtdRecebida: 0 })),
      dataEntrega: o.dataEntrega || "", status: o.status === "aberta" ? "Aberta" : (o.status || "Aberta"),
      anexos: (o.anexos || []).map(migrarArquivo).filter(Boolean),
      criadaEm: o.criadaEm || new Date().toISOString(), concluidaEm: o.concluidaEm || null,
      _itensOriginais: o.itens || null
    });
    gravados++;
  }
  contagens.ops = ordens.length;

  // --- apontamentos (de registro) — melhor esforço ---
  for (const r of registros) {
    await gravar("apontamentos", r.id, {
      id: r.id, opId: r.ordemProducaoId || "", etapaIdx: typeof r.ordemEtapaIndex === "number" ? r.ordemEtapaIndex : null,
      colaboradorIds: r.colaboradorIds || [], quantidade: num(r.quantidade), inicio: r.inicio || "", fim: null,
      status: r.status || "aberto", _origem: r
    });
    gravados++;
  }
  contagens.apontamentos = registros.length;

  // --- compras (de solicitacao_compra) — melhor esforço ---
  for (const c of solicitacoesCompra) {
    await gravar("compras", c.id, {
      id: c.id, materialId: c.materialId || "", quantidade: num(c.quantidade), observacao: c.observacao || "",
      status: c.status === "pendente" ? "Solicitado" : c.status === "comprado" ? "Comprado" : c.status === "recebido" ? "Recebido" : "Solicitado",
      criadoEm: c.criadoEm || new Date().toISOString()
    });
    gravados++;
  }
  contagens.compras = solicitacoesCompra.length;

  console.log("\nResumo:");
  for (const [k, v] of Object.entries(contagens)) console.log(`  ${k}: ${v}`);
  console.log(`\nTotal de registros ${DRY_RUN ? "que seriam gravados" : "gravados"}: ${gravados}`);
  if (DRY_RUN) console.log("\n(nada foi gravado — rode sem --dry-run para migrar de verdade)");
}

main().catch((e) => { console.error("ERRO:", e.message || e); process.exit(1); });
