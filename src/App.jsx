import React from "react";
import "./artefato.css";

const {
  useState,
  useEffect,
  useMemo,
  useCallback
} = React;

/* ---------------- helpers ---------------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const num = v => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};
const money = v => num(v).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const STATUS_ETAPA = ["Não iniciada", "Em andamento", "Concluída"];
/* Fluxo do pedido: Aberto → Liberado para produção → Em produção → Concluído → Expedição → Encerrado */
const STATUS_PEDIDO = ["Aberto", "Liberado para produção", "Em produção", "Concluído", "Expedição", "Encerrado", "Cancelado"];
const FLUXO_PEDIDO = {
  'Aberto': ['Liberado para produção', 'Cancelado'],
  'Liberado para produção': ['Em produção', 'Aberto', 'Cancelado'],
  'Em produção': ['Concluído', 'Cancelado'],
  'Concluído': ['Expedição'],
  'Expedição': ['Encerrado'],
  'Encerrado': [],
  'Cancelado': ['Aberto']
};
function proximoStatusPedido(atual) {
  return FLUXO_PEDIDO[atual] || [];
}
// só gera OP a partir daqui
function podeGerarOP(pedido) {
  const st = pedido.status || 'Aberto';
  return st === 'Aberto' || st === 'Liberado para produção';
}
const STATUS_COMPRA = ["Solicitado", "Comprado", "Recebido"];
/* --- Jornada de trabalho da fábrica ---
   Seg a sex: 06:00–12:00 e 13:00–15:48  (8h48 = 528 min)
   Extensão até 18:00 com autorização de superior (+2h12 = 132 min → 660 min)
   Sábado: 06:00–12:00 (360 min), somente com autorização de superior */
const JORNADA = {
  inicioManha: '06:00',
  fimManha: '12:00',
  inicioTarde: '13:00',
  fimTarde: '15:48',
  extensaoAte: '18:00',
  sabadoInicio: '06:00',
  sabadoFim: '12:00'
};
const LIMITE_CARGA_MIN = 8 * 60 + 48; // 528 min — jornada normal seg-sex
const LIMITE_CARGA_APROVACAO_MAX_MIN = 11 * 60; // 660 min — até as 18:00 com autorização
const LIMITE_SABADO_MIN = 6 * 60; // 360 min — sábado só com autorização
const HORAS_MES_PADRAO = 220; // referência de horas trabalhadas por mês para converter salário em custo/hora

function diaSemana(dataISO) {
  if (!dataISO) return null;
  return new Date(dataISO + 'T12:00:00').getDay(); // 0=dom … 6=sáb
}
function ehSabado(dataISO) {
  return diaSemana(dataISO) === 6;
}
function ehDomingo(dataISO) {
  return diaSemana(dataISO) === 0;
}

// capacidade do dia em minutos: {normal, maximo, exigeAutorizacao, rotulo}
function capacidadeDoDia(dataISO) {
  if (ehDomingo(dataISO)) return {
    normal: 0,
    maximo: 0,
    sempreAutoriza: true,
    rotulo: 'Domingo — sem expediente'
  };
  if (ehSabado(dataISO)) return {
    normal: 0,
    maximo: LIMITE_SABADO_MIN,
    sempreAutoriza: true,
    rotulo: `Sábado ${JORNADA.sabadoInicio}–${JORNADA.sabadoFim} (só com autorização)`
  };
  return {
    normal: LIMITE_CARGA_MIN,
    maximo: LIMITE_CARGA_APROVACAO_MAX_MIN,
    sempreAutoriza: false,
    rotulo: `${JORNADA.inicioManha}–${JORNADA.fimManha} e ${JORNADA.inicioTarde}–${JORNADA.fimTarde} (extensão até ${JORNADA.extensaoAte} com autorização)`
  };
}
function minParaHHMM(min) {
  const m = Math.round(num(min));
  const h = Math.floor(m / 60),
    r = m % 60;
  return `${h}:${String(r).padStart(2, '0')}`;
}
/* A etapa dentro da OP guarda uma cópia dos tempos feita quando a OP foi criada.
   Esta função devolve a etapa com os tempos ATUAIS do cadastro (Departamentos → Etapas). */
function etapaAtual(et, db) {
  if (!et || !db) return et;
  const def = (db.etapasProducao || []).find(e => e.id === et.etapaProducaoId);
  if (!def) return et;
  return {
    ...et,
    nome: def.nome || et.nome,
    departamentoId: def.departamentoId || et.departamentoId,
    modoTempo: def.modoTempo || 'peca',
    tempoProducao: def.tempoProducao,
    unidadeTempo: def.unidadeTempo,
    tamanhoLote: def.tamanhoLote,
    tamanhoEquipe: def.tamanhoEquipe
  };
}
function cargaEtapaOP(et, qtdBase, qtdTotalOP, db) {
  return cargaEtapaMinutos(etapaAtual(et, db), qtdBase, qtdTotalOP);
}
function cargaEtapaMinutos(etapa, qtdBase, qtdTotalOP) {
  const t = num(etapa.tempoProducao);
  let baseMin = t;
  if (etapa.unidadeTempo === 'seg') baseMin = t / 60;else if (etapa.unidadeTempo === 'hora') baseMin = t * 60;
  if (etapa.modoTempo === 'lote' || etapa.modoTempo === 'equipe') {
    // o tempo cadastrado é o ciclo para produzir um lote de N peças.
    // Se a quantidade do lote não estiver informada, assume a quantidade da própria OP.
    const lote = num(etapa.tamanhoLote) > 0 ? num(etapa.tamanhoLote) : num(qtdTotalOP) > 0 ? num(qtdTotalOP) : 1;
    const lotesNecessarios = num(qtdBase) / lote;
    return baseMin * lotesNecessarios;
  }
  return baseMin * num(qtdBase); // 'peca': tempo por unidade × quantidade
}
function labelUnidadeTempo(u) {
  return u === 'seg' ? 'seg' : u === 'hora' ? 'h' : 'min';
}
function labelModoTempo(etapa) {
  if (etapa.tempoProducao === undefined || etapa.tempoProducao === null || etapa.tempoProducao === '' || num(etapa.tempoProducao) <= 0) {
    return 'sem tempo cadastrado';
  }
  const lote = num(etapa.tamanhoLote);
  if (etapa.modoTempo === 'lote') {
    return lote > 0 ? `${etapa.tempoProducao} ${labelUnidadeTempo(etapa.unidadeTempo)} / lote de ${lote} peças` : `${etapa.tempoProducao} ${labelUnidadeTempo(etapa.unidadeTempo)} do início ao fim da OP`;
  }
  if (etapa.modoTempo === 'equipe') {
    const eq = num(etapa.tamanhoEquipe) || '?';
    return lote > 0 ? `${etapa.tempoProducao} ${labelUnidadeTempo(etapa.unidadeTempo)} / lote de ${lote} peças (equipe de ${eq})` : `${etapa.tempoProducao} ${labelUnidadeTempo(etapa.unidadeTempo)} do início ao fim da OP (equipe de ${eq})`;
  }
  return `${etapa.tempoProducao} ${labelUnidadeTempo(etapa.unidadeTempo)} / peça`;
}

/* --- custo de mão de obra baseado na média salarial dos colaboradores de cada departamento --- */
function mediaSalarialDepartamento(db, departamentoId) {
  const grupo = db.colaboradores.filter(c => c.departamentoId === departamentoId && c.status !== 'Inativo' && num(c.salario) > 0);
  if (grupo.length === 0) return null;
  const soma = grupo.reduce((s, c) => s + num(c.salario), 0);
  return soma / grupo.length;
}
function custoPorMinutoDepartamento(db, departamentoId) {
  const media = mediaSalarialDepartamento(db, departamentoId);
  if (media === null) return null;
  return media / HORAS_MES_PADRAO / 60;
}
// custo de mão de obra por peça de uma etapa cadastrada — só é um valor fixo no modo "por peça";
// nos modos "lote"/"equipe" o tempo por peça depende da quantidade de cada OP, então retorna null (variável)
/* Custo de mão de obra diluído por peça.
   - modo "peça": tempo da peça × custo/min
   - modo "lote": (tempo do lote ÷ peças do lote) × custo/min
   - modo "equipe": idem, multiplicado pelo nº de pessoas que trabalham no ciclo */
function custoMaoDeObraPorPeca(etapaDef, db) {
  if (!etapaDef) return null;
  // por lote/equipe só é fixo por peça quando a quantidade do lote está informada
  if (etapaDef.modoTempo !== 'peca' && !(num(etapaDef.tamanhoLote) > 0)) return null;
  const custoMin = custoPorMinutoDepartamento(db, etapaDef.departamentoId);
  if (custoMin === null) return null;
  const minutosPorPeca = cargaEtapaMinutos(etapaDef, 1, 1); // já diluído pelo tamanho do lote
  const pessoas = etapaDef.modoTempo === 'equipe' ? Math.max(num(etapaDef.tamanhoEquipe), 1) : 1;
  return custoMin * minutosPorPeca * pessoas;
}
const emptyDb = () => ({
  materiais: [],
  produtos: [],
  pedidos: [],
  ops: [],
  compras: [],
  movimentacoes: [],
  departamentos: [],
  etapasProducao: [],
  aprovacoesCarga: [],
  colaboradores: [],
  clientes: [],
  fornecedores: [],
  equipamentos: [],
  logs: [],
  mensagens: [],
  apontamentos: [],
  permissoes: null,
  categoriasMaterial: [],
  categoriasProduto: [],
  gruposProduto: [],
  subgruposProduto: [],
  orcamentos: [],
  solicitacoesArte: [],
  seq: {
    pedido: 100,
    op: 100,
    compra: 100,
    orcamento: 100,
    arte: 1
  }
});

/* Comprime/redimensiona uma imagem antes de guardar como data URL —
   evita que fotos de celular (vários MB) inflem os registros. */
function comprimirImagem(file, maxDim = 1400, qualidade = 0.82) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const escala = maxDim / Math.max(width, height);
          width = Math.round(width * escala);
          height = Math.round(height * escala);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', qualidade));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(file);
  });
}

/* --- geração de código sequencial por categoria/grupo --- */
function proximoSequencial(lista, prefixo) {
  const usados = lista.map(x => String(x.codigo || '')).filter(c => c.startsWith(prefixo + '-')).map(c => parseInt(c.slice(prefixo.length + 1), 10)).filter(n => !isNaN(n));
  const max = usados.length ? Math.max(...usados) : 0;
  return `${prefixo}-${String(max + 1).padStart(4, '0')}`;
}
const PERFIS = ['Administrador', 'Gestor', 'Colaborador'];
// permissões por perfil
/* Áreas do sistema — usadas na tela de Perfis de acesso */
const ABAS_SISTEMA = [{
  id: 'painel',
  label: 'Painel'
}, {
  id: 'pessoas',
  label: 'Cadastros'
}, {
  id: 'estrutura',
  label: 'Departamentos'
}, {
  id: 'vendas',
  label: 'Pedidos'
}, {
  id: 'producao',
  label: 'Produção'
}, {
  id: 'arte',
  label: 'Criação'
}, {
  id: 'relatorios',
  label: 'Relatórios'
}, {
  id: 'chat',
  label: 'Chat interno'
}];
const ACOES_SISTEMA = [{
  id: 'cadastros',
  label: 'Criar e editar cadastros',
  ajuda: 'clientes, fornecedores, materiais, produtos, equipamentos'
}, {
  id: 'producao',
  label: 'Lançar produção',
  ajuda: 'iniciar e concluir etapas nas OPs'
}, {
  id: 'pessoas',
  label: 'Gerenciar colaboradores',
  ajuda: 'cadastrar, editar e excluir pessoas'
}, {
  id: 'financeiro',
  label: 'Ver valores financeiros',
  ajuda: 'salários, custos, preços e margens'
}, {
  id: 'admin',
  label: 'Administrar o sistema',
  ajuda: 'perfis de acesso, exclusões críticas e backup'
}];

/* Permissões padrão de cada perfil. Podem ser alteradas em Cadastros → Perfis de acesso. */
const PERM_PADRAO = {
  'Administrador': {
    abas: ['painel', 'pessoas', 'estrutura', 'vendas', 'producao', 'arte', 'relatorios', 'chat'],
    acoes: {
      cadastros: true,
      producao: true,
      pessoas: true,
      financeiro: true,
      admin: true
    }
  },
  'Gestor': {
    abas: ['painel', 'pessoas', 'estrutura', 'vendas', 'producao', 'arte', 'relatorios', 'chat'],
    acoes: {
      cadastros: true,
      producao: true,
      pessoas: false,
      financeiro: false,
      admin: false
    }
  },
  'Colaborador': {
    abas: ['producao', 'chat'],
    acoes: {
      cadastros: false,
      producao: true,
      pessoas: false,
      financeiro: false,
      admin: false
    }
  }
};
const PERM = {
  'Administrador': {
    ...PERM_PADRAO['Administrador'],
    financeiro: true,
    pessoas: true
  },
  'Gestor': {
    ...PERM_PADRAO['Gestor'],
    financeiro: false,
    pessoas: false
  },
  'Colaborador': {
    ...PERM_PADRAO['Colaborador'],
    financeiro: false,
    pessoas: false
  }
};

/* Resolve as permissões efetivas: padrão do perfil → configuração salva → exceção do colaborador. */
function resolverPermissoes(colab, db) {
  const perfil = colab && colab.perfil || 'Colaborador';
  const base = db && db.permissoes && db.permissoes[perfil] || PERM_PADRAO[perfil] || PERM_PADRAO['Colaborador'];
  const excecao = colab && colab.permissoes || null; // exceção individual
  const abas = excecao && Array.isArray(excecao.abas) ? excecao.abas : base.abas || [];
  const acoes = {
    ...(base.acoes || {}),
    ...(excecao && excecao.acoes || {})
  };
  return {
    abas,
    acoes,
    financeiro: !!acoes.financeiro,
    pessoas: !!acoes.pessoas,
    perfil
  };
}
/* --- validação de duplicidade de cadastro --- */
function normaliza(v) {
  return String(v || '').trim().toLowerCase().replace(/[.\-\/\s]/g, '');
}
// campos: [{key:'nome', label:'Nome', soDigitos:false}, ...]
// retorna mensagem de erro se encontrar duplicado, ou null
function checarDuplicidade(lista, registro, campos) {
  for (const campo of campos) {
    const valor = normaliza(registro[campo.key]);
    if (!valor) continue; // campo vazio não bloqueia
    const conflito = lista.find(item => item.id !== registro.id && normaliza(item[campo.key]) === valor);
    if (conflito) {
      return `Já existe um cadastro com o mesmo ${campo.label}: "${conflito.nome || conflito[campo.key]}". Não é permitido cadastro duplicado.`;
    }
  }
  return null;
}
function permDe(usuario) {
  if (usuario && usuario._perm) return usuario._perm; // resolvidas no login
  return usuario && PERM[usuario.perfil] || PERM['Colaborador'];
}

/* Autorização aplicada na ação, não só na tela.
   area: 'pessoas' | 'financeiro' | 'cadastros' | 'producao' | 'admin' */
function podeExecutar(usuario, area) {
  const perm = permDe(usuario);
  if (perm && perm.acoes && Object.prototype.hasOwnProperty.call(perm.acoes, area)) return !!perm.acoes[area];
  // segurança: se a área não foi configurada, só administrador passa
  return (usuario && usuario.perfil) === 'Administrador';
}
// usada dentro das funções de salvar/excluir; bloqueia e registra a tentativa
function exigirPermissao(usuario, area, update, oQue) {
  if (podeExecutar(usuario, area)) return true;
  alert(`Seu perfil (${usuario && usuario.perfil || 'Colaborador'}) não tem permissão para ${oQue}.`);
  if (update) update(d => {
    registrarLog(d, usuario, 'Ação bloqueada por permissão', oQue);
    return d;
  });
  return false;
}
function agoraISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
// registra uma entrada no log; recebe o objeto db já em modo de escrita
function registrarLog(d, usuario, acao, detalhe) {
  if (!d.logs) d.logs = [];
  d.logs.push({
    id: uid(),
    quando: agoraISO(),
    data: todayISO(),
    quem: usuario ? usuario.nome : 'Sistema',
    perfil: usuario ? usuario.perfil : '—',
    acao,
    detalhe: detalhe || ''
  });
  if (d.logs.length > 500) d.logs = d.logs.slice(-500);
}

/* ---------------- persistence ---------------- */
/* ==========================================================
   SEGURANÇA — senhas com hash, primeiro acesso e sessão
   Nenhuma senha fica no código nem é gravada em texto puro.
========================================================== */
const ADMIN_PADRAO_NOME = 'Administrador';
const SESSAO_INATIVIDADE_MIN = 30; // desconecta após 30 min sem uso
const MAX_TENTATIVAS = 5; // bloqueio temporário após 5 erros
const BLOQUEIO_MIN = 10;
function gerarSalt() {
  const a = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Hash SHA-256 com salt. Sem crypto.subtle (contexto não seguro),
   cai para um hash local — mais fraco, mas ainda não guarda texto puro. */
async function hashSenha(senha, salt) {
  const dado = salt + '::' + senha;
  try {
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(dado));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {/* segue para o alternativo */}
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < dado.length; i++) {
    h1 = (h1 ^ dado.charCodeAt(i)) * 16777619 >>> 0;
    h2 = (h2 + dado.charCodeAt(i) * (i + 7)) * 2654435761 >>> 0;
  }
  return 'fb' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
async function definirSenha(colab, senha) {
  const salt = gerarSalt();
  const hash = await hashSenha(senha, salt);
  return {
    ...colab,
    senhaSalt: salt,
    senhaHash: hash,
    senha: undefined,
    precisaTrocarSenha: false,
    senhaDefinidaEm: agoraISO()
  };
}

/* Confere a senha. Cadastros antigos guardavam texto puro: nesse caso
   valida uma única vez e sinaliza para migrar para hash. */
async function conferirSenha(colab, senha) {
  if (colab.senhaHash && colab.senhaSalt) {
    const h = await hashSenha(senha, colab.senhaSalt);
    return {
      ok: h === colab.senhaHash,
      migrar: false
    };
  }
  if (colab.senha && String(colab.senha).length > 0) {
    return {
      ok: String(colab.senha) === senha,
      migrar: true
    }; // legado
  }
  return {
    ok: false,
    semSenha: true
  };
}
function temSenhaDefinida(c) {
  return !!(c.senhaHash && c.senhaSalt || c.senha && String(c.senha).length > 0);
}
function forcaSenha(s) {
  const t = String(s || '');
  if (t.length < 6) return {
    ok: false,
    msg: 'A senha precisa ter ao menos 6 caracteres.'
  };
  if (!/[A-Za-z]/.test(t) || !/[0-9]/.test(t)) return {
    ok: false,
    msg: 'Use ao menos uma letra e um número.'
  };
  return {
    ok: true,
    msg: 'Senha válida.'
  };
}

/* Garante que sempre exista UM administrador para não travar o acesso.
   Se não houver nenhum, cria um sem senha — que será definida no primeiro acesso.
   Nunca sobrescreve a senha de um administrador existente. */
function garantirAdminPadrao(db) {
  const temAdmin = db.colaboradores.some(c => c.perfil === 'Administrador' && c.status !== 'Inativo');
  if (temAdmin) return db;
  const legado = db.colaboradores.find(c => (c.nome || '').trim().toLowerCase() === 'renato monteiro');
  if (legado) {
    legado.perfil = 'Administrador';
    legado.status = 'Ativo';
    if (!temSenhaDefinida(legado)) legado.precisaTrocarSenha = true;
    return db;
  }
  db.colaboradores.unshift({
    id: uid(),
    nome: ADMIN_PADRAO_NOME,
    cpf: '',
    rg: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    email: '',
    cargo: '',
    funcoes: ['Administrador do sistema'],
    departamentoId: '',
    dataAdmissao: todayISO(),
    salario: 0,
    status: 'Ativo',
    perfil: 'Administrador',
    precisaTrocarSenha: true,
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    observacoes: ''
  });
  return db;
}
const LIMITE_ANEXO_BYTES = 400 * 1024;

/* ==========================================================
   PERSISTÊNCIA — um registro por chave (não mais um blob único)
   ----------------------------------------------------------
   O window.storage aqui é sempre o Supabase (instalado por
   storage.js antes deste app montar — se a conexão falhar, o app
   nem chega a subir). Cada item de cada coleção vira uma linha
   própria na tabela app_storage, na chave `<colecao>:<id>`, do
   mesmo jeito que o resto do sistema já faz. Isso elimina o teto
   de tamanho de um blob único: cada registro é independente.
========================================================== */
const COLECOES_ARRAY = ['materiais', 'produtos', 'pedidos', 'ops', 'compras', 'movimentacoes', 'departamentos', 'etapasProducao', 'aprovacoesCarga', 'colaboradores', 'clientes', 'fornecedores', 'equipamentos', 'logs', 'mensagens', 'apontamentos', 'categoriasMaterial', 'categoriasProduto', 'gruposProduto', 'subgruposProduto', 'orcamentos', 'solicitacoesArte'];
const CAMPOS_UNICOS = ['permissoes', 'seq'];
const PREFIXO = 'confeccao-erp';

function tamanhoBase(db) {
  try {
    return JSON.stringify(db).length;
  } catch (e) {
    return 0;
  }
}

async function loadDb() {
  const base = emptyDb();
  try {
    await Promise.all(COLECOES_ARRAY.map(async (colecao) => {
      const { keys } = await window.storage.list(`${PREFIXO}:${colecao}:`);
      const itens = await Promise.all((keys || []).map(async (chave) => {
        try {
          const r = await window.storage.get(chave);
          return r && r.value ? JSON.parse(r.value) : null;
        } catch (e) {
          return null;
        }
      }));
      base[colecao] = itens.filter(Boolean);
    }));
    await Promise.all(CAMPOS_UNICOS.map(async (campo) => {
      try {
        const r = await window.storage.get(`${PREFIXO}:${campo}`);
        if (r && r.value) base[campo] = JSON.parse(r.value);
      } catch (e) {/* mantém o padrão de emptyDb() */}
    }));
  } catch (e) {/* base parcialmente carregada — segue com o que veio */}
  return garantirAdminPadrao(base);
}

async function persistDb(next, prev) {
  const anterior = prev || emptyDb();
  const falhas = [];
  await Promise.all(COLECOES_ARRAY.map(async (colecao) => {
    const antigos = new Map((anterior[colecao] || []).map(it => [it.id, it]));
    const novos = new Map((next[colecao] || []).map(it => [it.id, it]));
    const tarefas = [];
    for (const [id, item] of novos) {
      const anteriorItem = antigos.get(id);
      if (!anteriorItem || JSON.stringify(anteriorItem) !== JSON.stringify(item)) {
        tarefas.push(window.storage.set(`${PREFIXO}:${colecao}:${id}`, JSON.stringify(item)));
      }
    }
    for (const id of antigos.keys()) {
      if (!novos.has(id)) tarefas.push(window.storage.delete(`${PREFIXO}:${colecao}:${id}`));
    }
    if (tarefas.length) {
      try {
        await Promise.all(tarefas);
      } catch (e) {
        falhas.push(colecao);
      }
    }
  }));
  await Promise.all(CAMPOS_UNICOS.map(async (campo) => {
    if (JSON.stringify(anterior[campo]) !== JSON.stringify(next[campo])) {
      try {
        await window.storage.set(`${PREFIXO}:${campo}`, JSON.stringify(next[campo]));
      } catch (e) {
        falhas.push(campo);
      }
    }
  }));
  if (falhas.length) {
    return `Não foi possível salvar: ${falhas.join(', ')}. Verifique a conexão e tente novamente.`;
  }
  return null;
}

function rotuloArmazenamento() {
  return { texto: 'Salvo no banco de dados compartilhado', tone: 'ok' };
}

/* ---------------- small UI atoms ---------------- */
function Field({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, label), children);
}
function Badge({
  tone,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "badge " + tone
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), children);
}
function Modal({
  title,
  onClose,
  children,
  wide
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-backdrop",
    onMouseDown: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal",
    style: wide ? {
      maxWidth: 820
    } : {}
  }, /*#__PURE__*/React.createElement("h3", null, title), children));
}
function Empty({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "empty"
  }, text);
}

/* ==========================================================
   APP
========================================================== */
function App() {
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState('painel');
  const [ready, setReady] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [trocarSenha, setTrocarSenha] = useState(false);
  const [ultimaAtividade, setUltimaAtividade] = useState(Date.now());

  // controle de sessão: encerra após inatividade
  useEffect(() => {
    if (!usuario) return;
    const marcar = () => setUltimaAtividade(Date.now());
    ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => window.addEventListener(ev, marcar));
    const timer = setInterval(() => {
      if (Date.now() - ultimaAtividade > SESSAO_INATIVIDADE_MIN * 60000) {
        setUsuario(null);
        alert(`Sessão encerrada após ${SESSAO_INATIVIDADE_MIN} minutos sem uso. Entre novamente.`);
      }
    }, 30000);
    return () => {
      ['click', 'keydown', 'mousemove', 'touchstart'].forEach(ev => window.removeEventListener(ev, marcar));
      clearInterval(timer);
    };
  }, [usuario, ultimaAtividade]);
  useEffect(() => {
    loadDb().then(d => {
      setDb(d);
      setReady(true);
    });
  }, []);
  const update = useCallback(mutator => {
    setDb(prev => {
      const next = mutator(JSON.parse(JSON.stringify(prev)));
      persistDb(next, prev).then(erro => setErroSalvar(erro));
      return next;
    });
  }, []);
  if (!ready || !db) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 60,
        fontFamily: 'var(--mono)',
        color: '#8a8577'
      }
    }, "Carregando ERP…");
  }

  // acesso sempre autenticado — não há mais entrada livre
  if (!usuario) {
    return /*#__PURE__*/React.createElement(Login, {
      db: db,
      update: update,
      onEntrar: u => {
        setUsuario(u);
        setUltimaAtividade(Date.now());
        setTab(permDe(u).abas[0]);
      }
    });
  }
  const usuarioAtual = db.colaboradores.find(c => c.id === usuario.id) || usuario;
  // usuário desativado durante a sessão perde o acesso na hora
  if (usuarioAtual.status === 'Inativo') {
    setTimeout(() => setUsuario(null), 0);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 60,
        fontFamily: 'var(--mono)'
      }
    }, "Acesso revogado. Recarregando…");
  }
  const perm = permDe(usuarioAtual);
  const NAV_TODOS = [{
    id: 'painel',
    n: '1',
    label: 'Painel'
  }, {
    id: 'pessoas',
    n: '2',
    label: 'Cadastros'
  }, {
    id: 'estrutura',
    n: '3',
    label: 'Departamentos'
  }, {
    id: 'vendas',
    n: '4',
    label: 'Pedidos'
  }, {
    id: 'producao',
    n: '5',
    label: 'Produção'
  }, {
    id: 'arte',
    n: '6',
    label: 'Criação'
  }, {
    id: 'relatorios',
    n: '7',
    label: 'Relatórios'
  }, {
    id: 'chat',
    n: '8',
    label: 'Chat interno'
  }];
  const NAV = NAV_TODOS.filter(n => perm.abas.includes(n.id));
  const tabAtual = perm.abas.includes(tab) ? tab : perm.abas[0];
  const curLabel = (NAV.find(n => n.id === tabAtual) || {}).label || '';
  function sair() {
    if (!confirm('Sair do sistema?')) return;
    update(d => {
      registrarLog(d, usuarioAtual, 'Saiu do sistema', '');
      return d;
    });
    setUsuario(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tag"
  }, "Sistema Interno"), /*#__PURE__*/React.createElement("h1", null, "Confecção ERP")), /*#__PURE__*/React.createElement("div", {
    className: "nav"
  }, NAV.map(item => /*#__PURE__*/React.createElement("button", {
    key: item.id,
    className: tabAtual === item.id ? 'active' : '',
    onClick: () => setTab(item.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, item.n), item.label))), /*#__PURE__*/React.createElement("div", {
    className: "sidebar-foot"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: '#EDEAE4',
      fontFamily: 'var(--body)',
      fontSize: 12,
      fontWeight: 600
    }
  }, usuarioAtual.nome), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, usuarioAtual.perfil), /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      color: '#EDEAE4',
      borderColor: 'rgba(255,255,255,0.25)'
    },
    onClick: () => setTrocarSenha(true)
  }, "Senha"), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      color: '#EDEAE4',
      borderColor: 'rgba(255,255,255,0.25)'
    },
    onClick: sair
  }, "Sair")))), /*#__PURE__*/React.createElement("div", {
    className: "mobile-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "tag"
  }, "Confecção ERP · ", usuarioAtual.perfil), /*#__PURE__*/React.createElement("div", {
    className: "cur"
  }, curLabel)), usuario && /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      color: '#EDEAE4',
      borderColor: 'rgba(255,255,255,0.25)'
    },
    onClick: sair
  }, "Sair")), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, erroSalvar && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: 'var(--bad)',
      background: 'var(--bad-bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      color: 'var(--bad)',
      fontWeight: 600,
      flex: 1
    }
  }, "⚠ ", erroSalvar), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setErroSalvar(null)
  }, "Dispensar"))), tabAtual === 'painel' && /*#__PURE__*/React.createElement(Painel, {
    db: db,
    update: update,
    setTab: setTab
  }), tabAtual === 'pessoas' && /*#__PURE__*/React.createElement(GrupoCadastros, {
    db: db,
    update: update,
    usuario: usuarioAtual,
    perm: perm
  }), tabAtual === 'estrutura' && /*#__PURE__*/React.createElement(GrupoEstrutura, {
    db: db,
    update: update,
    perm: perm
  }), tabAtual === 'vendas' && /*#__PURE__*/React.createElement(GrupoVendas, {
    db: db,
    update: update,
    setTab: setTab
  }), tabAtual === 'producao' && /*#__PURE__*/React.createElement(GrupoProducao, {
    db: db,
    update: update,
    usuario: usuarioAtual
  }), tabAtual === 'arte' && /*#__PURE__*/React.createElement(Criacao, {
    db: db,
    update: update,
    usuario: usuarioAtual
  }), tabAtual === 'relatorios' && /*#__PURE__*/React.createElement(GrupoRelatorios, {
    db: db,
    perm: perm
  }), tabAtual === 'chat' && /*#__PURE__*/React.createElement(ChatInterno, {
    db: db,
    update: update,
    usuario: usuarioAtual
  })), trocarSenha && /*#__PURE__*/React.createElement(TrocarSenhaModal, {
    usuario: usuarioAtual,
    update: update,
    onClose: () => setTrocarSenha(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "bottom-nav"
  }, NAV.map(item => /*#__PURE__*/React.createElement("button", {
    key: item.id,
    className: tabAtual === item.id ? 'active' : '',
    onClick: () => setTab(item.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "num"
  }, item.n), item.label.split(' ')[0]))));
}
function TrocarSenhaModal({
  usuario,
  update,
  onClose
}) {
  const [atual, setAtual] = useState('');
  const [nova1, setNova1] = useState('');
  const [nova2, setNova2] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function salvar() {
    setErro('');
    if (temSenhaDefinida(usuario)) {
      const r = await conferirSenha(usuario, atual);
      if (!r.ok) {
        setErro('Senha atual incorreta.');
        return;
      }
    }
    const v = forcaSenha(nova1);
    if (!v.ok) {
      setErro(v.msg);
      return;
    }
    if (nova1 !== nova2) {
      setErro('As senhas não conferem.');
      return;
    }
    setOcupado(true);
    const atualizado = await definirSenha(usuario, nova1);
    setOcupado(false);
    update(d => {
      d.colaboradores = d.colaboradores.map(x => x.id === usuario.id ? {
        ...x,
        ...atualizado
      } : x);
      registrarLog(d, usuario, 'Alterou a própria senha', '');
      return d;
    });
    setOk(true);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Alterar senha",
    onClose: onClose
  }, ok ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: 'var(--ok)',
      fontWeight: 600,
      marginBottom: 12
    }
  }, "✓ Senha alterada com sucesso."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: onClose
  }, "Fechar"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 12
    }
  }, "Usuário: ", /*#__PURE__*/React.createElement("strong", null, usuario.nome)), temSenhaDefinida(usuario) && /*#__PURE__*/React.createElement(Field, {
    label: "Senha atual"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: atual,
    onChange: e => {
      setAtual(e.target.value);
      setErro('');
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nova senha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: nova1,
    onChange: e => {
      setNova1(e.target.value);
      setErro('');
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Repita a nova senha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: nova2,
    onChange: e => {
      setNova2(e.target.value);
      setErro('');
    },
    onKeyDown: e => {
      if (e.key === 'Enter') salvar();
    }
  })), nova1 && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: forcaSenha(nova1).ok ? 'var(--ok)' : 'var(--warn)',
      marginBottom: 8
    }
  }, forcaSenha(nova1).msg), erro && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: 'var(--bad)',
      marginBottom: 10,
      fontWeight: 600
    }
  }, erro), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: salvar,
    disabled: ocupado
  }, ocupado ? 'Salvando…' : 'Alterar senha'))));
}

/* ==========================================================
   LOGIN
========================================================== */
function Login({
  db,
  update,
  onEntrar
}) {
  const [nomeId, setNomeId] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // primeiro acesso / troca obrigatória
  const [definindo, setDefinindo] = useState(null); // colaborador
  const [nova1, setNova1] = useState('');
  const [nova2, setNova2] = useState('');
  const ativos = db.colaboradores.filter(c => c.status !== 'Inativo');
  const selecionado = db.colaboradores.find(x => x.id === nomeId);
  function registrar(colab, acao, detalhe) {
    update(d => {
      registrarLog(d, colab ? {
        nome: colab.nome,
        perfil: colab.perfil
      } : null, acao, detalhe);
      return d;
    });
  }

  // bloqueio temporário por tentativas seguidas
  function bloqueioAtivo(c) {
    if (!c || !c.bloqueadoAte) return null;
    const agora = new Date();
    const ate = new Date(c.bloqueadoAte);
    return ate > agora ? ate : null;
  }
  async function entrar() {
    setErro('');
    const c = selecionado;
    if (!c) {
      setErro('Selecione um usuário.');
      return;
    }
    if (c.status === 'Inativo') {
      setErro('Usuário inativo — acesso bloqueado. Procure um administrador.');
      registrar(c, 'Acesso negado', 'usuário inativo');
      return;
    }
    const ate = bloqueioAtivo(c);
    if (ate) {
      setErro(`Muitas tentativas. Tente novamente após ${ate.toLocaleTimeString('pt-BR').slice(0, 5)}.`);
      return;
    }
    if (!temSenhaDefinida(c)) {
      setDefinindo(c); // primeiro acesso: define a senha agora
      return;
    }
    setOcupado(true);
    const r = await conferirSenha(c, senha);
    setOcupado(false);
    if (!r.ok) {
      const tentativas = num(c.tentativasFalhas) + 1;
      update(d => {
        d.colaboradores = d.colaboradores.map(x => {
          if (x.id !== c.id) return x;
          const bloq = tentativas >= MAX_TENTATIVAS ? new Date(Date.now() + BLOQUEIO_MIN * 60000).toISOString() : x.bloqueadoAte;
          return {
            ...x,
            tentativasFalhas: tentativas,
            bloqueadoAte: bloq
          };
        });
        registrarLog(d, {
          nome: c.nome,
          perfil: c.perfil
        }, 'Acesso negado', `senha incorreta (tentativa ${tentativas} de ${MAX_TENTATIVAS})`);
        return d;
      });
      setErro(tentativas >= MAX_TENTATIVAS ? `Senha incorreta. Usuário bloqueado por ${BLOQUEIO_MIN} minutos.` : `Senha incorreta. Restam ${MAX_TENTATIVAS - tentativas} tentativa(s).`);
      return;
    }
    if (c.precisaTrocarSenha) {
      setDefinindo(c);
      return;
    }
    update(d => {
      d.colaboradores = d.colaboradores.map(x => x.id === c.id ? {
        ...x,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoAcesso: agoraISO(),
        ...(r.migrar ? {} : {})
      } : x);
      registrarLog(d, c, 'Entrou no sistema', `perfil ${c.perfil || 'Colaborador'}`);
      return d;
    });

    // migra senha legada em texto puro para hash
    if (r.migrar) {
      const atualizado = await definirSenha(c, senha);
      update(d => {
        d.colaboradores = d.colaboradores.map(x => x.id === c.id ? {
          ...x,
          ...atualizado
        } : x);
        registrarLog(d, c, 'Senha migrada', 'senha antiga convertida para hash');
        return d;
      });
    }
    onEntrar(c);
  }
  async function salvarNovaSenha() {
    const v = forcaSenha(nova1);
    if (!v.ok) {
      setErro(v.msg);
      return;
    }
    if (nova1 !== nova2) {
      setErro('As senhas não conferem.');
      return;
    }
    setOcupado(true);
    const atualizado = await definirSenha(definindo, nova1);
    setOcupado(false);
    update(d => {
      d.colaboradores = d.colaboradores.map(x => x.id === definindo.id ? {
        ...x,
        ...atualizado,
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoAcesso: agoraISO()
      } : x);
      registrarLog(d, definindo, 'Senha definida', 'primeiro acesso ou troca obrigatória');
      registrarLog(d, definindo, 'Entrou no sistema', `perfil ${definindo.perfil || 'Colaborador'}`);
      return d;
    });
    onEntrar({
      ...definindo,
      ...atualizado
    });
  }
  const semSenhaAinda = selecionado && !temSenhaDefinida(selecionado);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--mono)',
      fontSize: 10,
      letterSpacing: '.16em',
      color: 'var(--thread-dark)',
      textTransform: 'uppercase'
    }
  }, "Sistema Interno"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--display)',
      fontSize: 30,
      margin: '4px 0 0 0'
    }
  }, "Confecção ERP")), definindo ? /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Definir senha — ", definindo.nome), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 12
    }
  }, temSenhaDefinida(definindo) ? 'É necessário trocar a senha para continuar.' : 'Primeiro acesso: crie sua senha para entrar no sistema.', ' ', "Mínimo de 6 caracteres, com letras e números."), /*#__PURE__*/React.createElement(Field, {
    label: "Nova senha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: nova1,
    onChange: e => {
      setNova1(e.target.value);
      setErro('');
    }
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Repita a nova senha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: nova2,
    onChange: e => {
      setNova2(e.target.value);
      setErro('');
    },
    onKeyDown: e => {
      if (e.key === 'Enter') salvarNovaSenha();
    }
  })), nova1 && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: forcaSenha(nova1).ok ? 'var(--ok)' : 'var(--warn)',
      marginBottom: 8
    }
  }, forcaSenha(nova1).msg), erro && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: 'var(--bad)',
      marginBottom: 10,
      fontWeight: 600
    }
  }, erro), /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: () => {
      setDefinindo(null);
      setNova1('');
      setNova2('');
      setErro('');
    }
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    style: {
      flex: 1,
      justifyContent: 'center'
    },
    onClick: salvarNovaSenha,
    disabled: ocupado
  }, ocupado ? 'Salvando…' : 'Salvar e entrar'))) : /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Entrar"), /*#__PURE__*/React.createElement(Field, {
    label: "Usuário"
  }, /*#__PURE__*/React.createElement("select", {
    value: nomeId,
    onChange: e => {
      setNomeId(e.target.value);
      setErro('');
      setSenha('');
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Selecione…"), ativos.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.nome, " — ", c.perfil || 'Colaborador')))), semSenhaAinda ? /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      background: 'var(--warn-bg)',
      color: 'var(--warn)',
      padding: '8px 10px',
      borderRadius: 6,
      marginBottom: 10,
      fontWeight: 600
    }
  }, "Este usuário ainda não tem senha. Clique em “Definir senha” para criar a sua no primeiro acesso.") : /*#__PURE__*/React.createElement(Field, {
    label: "Senha"
  }, /*#__PURE__*/React.createElement("input", {
    type: "password",
    value: senha,
    onChange: e => {
      setSenha(e.target.value);
      setErro('');
    },
    onKeyDown: e => {
      if (e.key === 'Enter') entrar();
    },
    placeholder: "••••••"
  })), erro && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: 'var(--bad)',
      marginBottom: 10,
      fontWeight: 600
    }
  }, erro), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    style: {
      width: '100%',
      justifyContent: 'center'
    },
    onClick: entrar,
    disabled: ocupado || !nomeId
  }, ocupado ? 'Verificando…' : semSenhaAinda ? 'Definir senha' : 'Entrar')), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, "Senhas são guardadas com hash, nunca em texto puro. Após ", MAX_TENTATIVAS, " tentativas o usuário fica bloqueado por ", BLOQUEIO_MIN, " minutos.")));
}
function SubTabs({
  tabs,
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "tabs-strip",
    style: {
      marginBottom: 18
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: active === t.id ? 'active' : '',
    onClick: () => onChange(t.id)
  }, t.label)));
}

/* ---- Grupo 2: Cadastros (pessoas) ---- */
function GrupoCadastros({
  db,
  update,
  usuario,
  perm
}) {
  const [sub, setSub] = useState('clientes');
  const podeFin = !perm || perm.financeiro;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 2"), /*#__PURE__*/React.createElement("h2", null, "Cadastros"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'clientes',
      label: 'Clientes'
    }, {
      id: 'fornecedores',
      label: 'Fornecedores'
    }, {
      id: 'colaboradores',
      label: 'Colaboradores'
    }, {
      id: 'equipamentos',
      label: 'Equipamentos'
    }, {
      id: 'materiais',
      label: 'Materiais'
    }, {
      id: 'estoque',
      label: 'Estoque'
    }, {
      id: 'orcamentos',
      label: 'Orçamentos'
    }, {
      id: 'compras',
      label: 'Compras'
    }, {
      id: 'produtos',
      label: podeFin ? 'Produtos & Custo' : 'Produtos'
    }, {
      id: 'log',
      label: 'Log de acesso'
    }]
  }), sub === 'clientes' && /*#__PURE__*/React.createElement(Clientes, {
    db: db,
    update: update
  }), sub === 'fornecedores' && /*#__PURE__*/React.createElement(Fornecedores, {
    db: db,
    update: update
  }), sub === 'colaboradores' && /*#__PURE__*/React.createElement(Colaboradores, {
    db: db,
    update: update,
    usuario: usuario
  }), sub === 'equipamentos' && /*#__PURE__*/React.createElement(Equipamentos, {
    db: db,
    update: update
  }), sub === 'materiais' && /*#__PURE__*/React.createElement(Materiais, {
    db: db,
    update: update
  }), sub === 'estoque' && /*#__PURE__*/React.createElement(Estoque, {
    db: db,
    update: update
  }), sub === 'orcamentos' && /*#__PURE__*/React.createElement(Orcamentos, {
    db: db,
    update: update
  }), sub === 'compras' && /*#__PURE__*/React.createElement(Compras, {
    db: db,
    update: update
  }), sub === 'produtos' && /*#__PURE__*/React.createElement(Produtos, {
    db: db,
    update: update,
    podeFin: podeFin
  }), sub === 'log' && /*#__PURE__*/React.createElement(LogColaboradores, {
    db: db
  }));
}

/* ---- Log de acesso e alterações ---- */
function LogColaboradores({
  db
}) {
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [quem, setQuem] = useState('');
  const logs = (db.logs || []).filter(l => {
    if (ini && l.data < ini) return false;
    if (fim && l.data > fim) return false;
    if (quem && l.quem !== quem) return false;
    return true;
  }).slice().reverse();
  const pessoas = Array.from(new Set((db.logs || []).map(l => l.quem))).sort();
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: ini,
    onChange: e => setIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fim,
    onChange: e => setFim(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Usuário"
  }, /*#__PURE__*/React.createElement("select", {
    value: quem,
    onChange: e => setQuem(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), pessoas.map(p => /*#__PURE__*/React.createElement("option", {
    key: p,
    value: p
  }, p))))), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      setIni('');
      setFim('');
      setQuem('');
    }
  }, "Limpar")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, logs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum registro de log no período."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Quando"), /*#__PURE__*/React.createElement("th", null, "Quem"), /*#__PURE__*/React.createElement("th", null, "Perfil"), /*#__PURE__*/React.createElement("th", null, "Ação"), /*#__PURE__*/React.createElement("th", null, "Detalhe"))), /*#__PURE__*/React.createElement("tbody", null, logs.map(l => /*#__PURE__*/React.createElement("tr", {
    key: l.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, l.quando), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, /*#__PURE__*/React.createElement("strong", null, l.quem)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, l.perfil), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, l.acao), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, l.detalhe)))))));
}

/* ---- Grupo 6: Relatórios consolidados ---- */
function GrupoRelatorios({
  db,
  perm
}) {
  const [sub, setSub] = useState('vendas');
  const podeFin = !perm || perm.financeiro;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 6"), /*#__PURE__*/React.createElement("h2", null, "Relatórios"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'producao',
      label: 'Produção & Produtividade'
    }, {
      id: 'vendas',
      label: 'Vendas'
    }, {
      id: 'materiais',
      label: 'Materiais & Custos'
    }, {
      id: 'cadastros',
      label: 'Cadastros'
    }]
  }), sub === 'producao' && /*#__PURE__*/React.createElement(RelatoriosProducao, {
    db: db
  }), sub === 'vendas' && /*#__PURE__*/React.createElement(RelatoriosVendas, {
    db: db
  }), sub === 'materiais' && /*#__PURE__*/React.createElement(RelatoriosMateriais, {
    db: db,
    podeFin: podeFin
  }), sub === 'cadastros' && /*#__PURE__*/React.createElement(RelatoriosPessoas, {
    db: db
  }));
}

/* ==========================================================
   CHAT INTERNO — mensagens particulares entre colaboradores
========================================================== */
function ChatInterno({
  db,
  update,
  usuario
}) {
  const [aba, setAba] = useState('colaboradores');
  const [comQuem, setComQuem] = useState(''); // chave: 'col:<nome>' ou 'cli:<id>'
  const [texto, setTexto] = useState('');
  const [anexo, setAnexo] = useState(null);
  const eu = usuario ? usuario.nome : '';

  // só administrador e vendedor enxergam a aba de clientes
  const meuCadastro = db.colaboradores.find(c => c.nome === eu);
  const podeClientes = usuario && usuario.perfil === 'Administrador' || ehVendedor(meuCadastro || usuario);
  const contatosColab = db.colaboradores.filter(c => c.status !== 'Inativo' && c.nome !== eu).map(c => ({
    chave: 'col:' + c.nome,
    nome: c.nome,
    sub: (db.departamentos.find(d => d.id === c.departamentoId) || {}).nome || funcoesColaborador(c).join(', ') || '—'
  }));
  const contatosCliente = (podeClientes ? db.clientes : []).map(c => ({
    chave: 'cli:' + c.id,
    nome: c.nome,
    sub: [c.responsavel, c.cidade].filter(Boolean).join(' · ') || 'cliente'
  }));
  const contatos = aba === 'clientes' ? contatosCliente : contatosColab;
  const atual = contatos.find(c => c.chave === comQuem);
  const mensagens = db.mensagens || [];
  const conversa = mensagens.filter(m => m.de === eu && m.paraChave === comQuem || m.deChave === comQuem && m.para === eu || !m.paraChave && (m.de === eu && 'col:' + m.para === comQuem || 'col:' + m.de === comQuem && m.para === eu)).sort((a, b) => (a.quando || '').localeCompare(b.quando || ''));
  function chaveDe(m) {
    return m.paraChave || 'col:' + m.para;
  }
  function naoLidasDe(chave) {
    return mensagens.filter(m => m.para === eu && !m.lido && (m.deChave === chave || 'col:' + m.de === chave)).length;
  }
  function ultimaCom(chave) {
    const list = mensagens.filter(m => m.de === eu && chaveDe(m) === chave || m.para === eu && (m.deChave === chave || 'col:' + m.de === chave));
    return list.length ? list[list.length - 1] : null;
  }
  function abrir(chave) {
    setComQuem(chave);
    update(d => {
      d.mensagens = (d.mensagens || []).map(m => m.para === eu && !m.lido && (m.deChave === chave || 'col:' + m.de === chave) ? {
        ...m,
        lido: true
      } : m);
      return d;
    });
  }
  async function onArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) url = await comprimirImagem(file, 900, 0.7);else {
        if (file.size > 300 * 1024) {
          alert('Arquivo muito grande (máx. 300 KB).');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
          r.readAsDataURL(file);
        });
      }
      setAnexo({
        nome: file.name,
        tipo: ehImagem ? 'imagem' : 'documento',
        url
      });
    } catch (err) {
      alert('Não foi possível anexar: ' + (err && err.message));
    }
  }
  function enviar() {
    const t = texto.trim();
    if (!t && !anexo || !atual) return;
    update(d => {
      d.mensagens = [...(d.mensagens || []), {
        id: uid(),
        de: eu,
        deChave: 'col:' + eu,
        para: atual.nome,
        paraChave: atual.chave,
        tipoContato: aba === 'clientes' ? 'cliente' : 'colaborador',
        texto: t,
        anexo: anexo || null,
        quando: agoraISO(),
        lido: false
      }];
      if (d.mensagens.length > 500) d.mensagens = d.mensagens.slice(-500);
      return d;
    });
    setTexto('');
    setAnexo(null);
  }
  function apagar(id) {
    if (!confirm('Apagar esta mensagem?')) return;
    update(d => {
      d.mensagens = (d.mensagens || []).filter(m => m.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 7"), /*#__PURE__*/React.createElement("h2", null, "Chat interno"))), podeClientes && /*#__PURE__*/React.createElement(SubTabs, {
    active: aba,
    onChange: a => {
      setAba(a);
      setComQuem('');
    },
    tabs: [{
      id: 'colaboradores',
      label: 'Colaboradores'
    }, {
      id: 'clientes',
      label: 'Clientes'
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "chat-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "chat-lista panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Conversando como"), /*#__PURE__*/React.createElement("strong", null, eu || '—')), contatos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: aba === 'clientes' ? 'Nenhum cliente cadastrado.' : 'Nenhum outro colaborador cadastrado.'
  })) : contatos.map(c => {
    const n = naoLidasDe(c.chave);
    const ult = ultimaCom(c.chave);
    return /*#__PURE__*/React.createElement("button", {
      key: c.chave,
      className: "chat-contato" + (comQuem === c.chave ? ' ativo' : ''),
      onClick: () => abrir(c.chave)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        flex: 1
      }
    }, c.nome), n > 0 && /*#__PURE__*/React.createElement("span", {
      className: "chat-badge"
    }, n)), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, c.sub), ult && /*#__PURE__*/React.createElement("div", {
      className: "small muted chat-previa"
    }, ult.de === eu ? 'você: ' : '', ult.anexo ? ult.anexo.tipo === 'imagem' ? '📷 foto ' : '📎 arquivo ' : '', ult.texto));
  })), /*#__PURE__*/React.createElement("div", {
    className: "chat-conversa panel",
    style: {
      padding: 0
    }
  }, !atual ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 30
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Selecione um contato para conversar."
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("strong", null, atual.nome), /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, aba === 'clientes' ? 'Contato de cliente' : 'Conversa particular', " — visível apenas dentro do sistema")), /*#__PURE__*/React.createElement("div", {
    className: "chat-mensagens"
  }, conversa.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      textAlign: 'center',
      padding: 20
    }
  }, "Nenhuma mensagem ainda."), conversa.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    className: "chat-msg" + (m.de === eu ? ' minha' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "bolha"
  }, m.anexo && (m.anexo.tipo === 'imagem' ? /*#__PURE__*/React.createElement("a", {
    href: m.anexo.url,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    className: "chat-img",
    src: m.anexo.url,
    alt: m.anexo.nome
  })) : /*#__PURE__*/React.createElement("a", {
    className: "chat-arq",
    href: m.anexo.url,
    download: m.anexo.nome
  }, "📄 ", m.anexo.nome)), m.texto, /*#__PURE__*/React.createElement("div", {
    className: "hora"
  }, m.quando, m.de === eu && (m.lido ? ' · lida' : ' · enviada'))), m.de === eu && /*#__PURE__*/React.createElement("button", {
    className: "chat-del",
    onClick: () => apagar(m.id),
    title: "Apagar"
  }, "×")))), anexo && /*#__PURE__*/React.createElement("div", {
    className: "chat-previa-anexo"
  }, anexo.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    src: anexo.url,
    alt: anexo.nome
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, "📄"), /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      flex: 1,
      wordBreak: 'break-word'
    }
  }, anexo.nome), /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => setAnexo(null)
  }, "Remover")), /*#__PURE__*/React.createElement("div", {
    className: "chat-envio"
  }, /*#__PURE__*/React.createElement("label", {
    className: "btn ghost sm chat-acao",
    title: "Anexar arquivo ou foto"
  }, "📎", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
    style: {
      display: 'none'
    },
    onChange: onArquivo
  })), /*#__PURE__*/React.createElement("label", {
    className: "btn ghost sm chat-acao",
    title: "Tirar foto com a câmera"
  }, "📷", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    style: {
      display: 'none'
    },
    onChange: onArquivo
  })), /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: texto,
    onChange: e => setTexto(e.target.value),
    placeholder: "Escreva sua mensagem…",
    onKeyDown: e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviar();
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: enviar,
    disabled: !texto.trim() && !anexo
  }, "Enviar"))))));
}
function GrupoVendas({
  db,
  update,
  setTab
}) {
  const [sub, setSub] = useState('pedidos');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 4"), /*#__PURE__*/React.createElement("h2", null, "Pedidos de Venda"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'pedidos',
      label: 'Pedidos'
    }, {
      id: 'relatorios',
      label: 'Relatórios de vendas'
    }]
  }), sub === 'pedidos' && /*#__PURE__*/React.createElement(Pedidos, {
    db: db,
    update: update,
    setTab: setTab
  }), sub === 'relatorios' && /*#__PURE__*/React.createElement(RelatoriosVendas, {
    db: db
  }));
}

/* ---- Grupo 5: Departamentos & Etapas ---- */
function GrupoEstrutura({
  db,
  update,
  perm
}) {
  const [sub, setSub] = useState('departamentos');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 5"), /*#__PURE__*/React.createElement("h2", null, "Departamentos & Etapas"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'departamentos',
      label: 'Departamentos'
    }, {
      id: 'etapas',
      label: 'Etapas de Produção'
    }]
  }), sub === 'departamentos' && /*#__PURE__*/React.createElement(Departamentos, {
    db: db,
    update: update
  }), sub === 'etapas' && /*#__PURE__*/React.createElement(EtapasProducao, {
    db: db,
    update: update
  }));
}

/* ---- Grupo 6: Produção ---- */
function GrupoProducao({
  db,
  update,
  usuario
}) {
  const [sub, setSub] = useState('pedidos');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 5"), /*#__PURE__*/React.createElement("h2", null, "Produção"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'pedidos',
      label: 'Pedidos a produzir'
    }, {
      id: 'apontamento',
      label: 'Lançamento de produção'
    }, {
      id: 'cronograma',
      label: 'Cronograma / PCP'
    }]
  }), sub === 'pedidos' && /*#__PURE__*/React.createElement(PedidosParaProduzir, {
    db: db,
    update: update,
    irParaOPs: () => setSub('apontamento')
  }), sub === 'apontamento' && /*#__PURE__*/React.createElement(LancamentoProducao, {
    db: db,
    update: update,
    usuario: usuario
  }), sub === 'cronograma' && /*#__PURE__*/React.createElement(Cronograma, {
    db: db,
    update: update,
    usuario: usuario
  }));
}

/* ==========================================================
   LANÇAMENTO DE PRODUÇÃO — iniciar / em aberto / concluir
   Fluxo: escolhe OP + etapa + colaborador + quantidade,
   o sistema projeta o horário de término pela meta.
   Ao concluir, informa peças boas, defeitos e retrabalho,
   e o sistema calcula tempo real, eficiência e nota A/B/C.
========================================================== */
function classificarEficiencia(pct) {
  if (pct >= 95) return {
    nota: 'A',
    tone: 'ok',
    texto: 'A — dentro ou acima da meta'
  };
  if (pct >= 80) return {
    nota: 'B',
    tone: 'warn',
    texto: 'B — abaixo da meta'
  };
  return {
    nota: 'C',
    tone: 'bad',
    texto: 'C — bem abaixo da meta'
  };
}
function minutosEntre(iniISO, fimISO) {
  const a = new Date(String(iniISO).replace(' ', 'T'));
  const b = new Date(String(fimISO).replace(' ', 'T'));
  const d = (b - a) / 60000;
  return isNaN(d) ? 0 : Math.max(d, 0);
}
function somaMinutos(quandoISO, minutos) {
  const d = new Date(String(quandoISO).replace(' ', 'T'));
  d.setMinutes(d.getMinutes() + Math.round(minutos));
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* Disponibilidade do colaborador a partir das produções em aberto.
   Devolve até quando ele está ocupado e em quê. */
function disponibilidadeColaborador(nome, emAberto) {
  const meus = emAberto.filter(a => (a.equipe || [a.colaborador]).some(n => normaliza(n) === normaliza(nome)));
  if (meus.length === 0) return {
    livre: true
  };
  // o mais tarde entre os términos previstos
  let fim = null,
    ref = null;
  meus.forEach(a => {
    const f = a.previsaoFim || a.inicio;
    if (!fim || String(f) > String(fim)) {
      fim = f;
      ref = a;
    }
  });
  return {
    livre: false,
    ocupadoAte: fim,
    etapa: ref ? ref.etapaNome : '',
    op: ref ? ref.opRotulo : '',
    janelas: meus
  };
}
function rotuloDisponibilidade(d) {
  if (d.livre) return 'livre agora';
  return `ocupado até ${String(d.ocupadoAte).replace('T', ' ')} · ${d.etapa}`;
}
// duas janelas de tempo se sobrepõem?
function sobrepoe(ini1, fim1, ini2, fim2) {
  const a1 = new Date(String(ini1).replace(' ', 'T')),
    b1 = new Date(String(fim1).replace(' ', 'T'));
  const a2 = new Date(String(ini2).replace(' ', 'T')),
    b2 = new Date(String(fim2).replace(' ', 'T'));
  return a1 < b2 && a2 < b1;
}
function LancamentoProducao({
  db,
  update,
  usuario
}) {
  const [aberta, setAberta] = useState(null); // opId expandida
  const [abaOP, setAbaOP] = useState('atividades');
  const [iniciando, setIniciando] = useState(null); // {opId, etapaIdx}
  const [concluir, setConcluir] = useState(null);
  const [verConcluidas, setVerConcluidas] = useState(false);
  const [relatorioOP, setRelatorioOP] = useState(null);
  const apontamentos = db.apontamentos || [];
  const emAberto = apontamentos.filter(a => !a.fim);
  const concluidos = apontamentos.filter(a => a.fim).slice().reverse();

  // OPs com pelo menos uma etapa pendente
  const opsAbertas = db.ops.filter(op => op.etapas.some(e => e.status !== 'Concluída'));
  function apontamentoDaEtapa(opId, idx) {
    return emAberto.find(a => a.opId === opId && a.etapaIdx === idx);
  }
  function iniciar(op, idx, dados) {
    const et = op.etapas[idx];
    const minPorPeca = cargaEtapaOP(et, 1, op.quantidade, db);
    const base = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
    const qtd = num(dados.quantidade) > 0 ? num(dados.quantidade) : Math.max(base - num(et.qtdConcluida), 0);
    const responsaveis = dados.modo === 'equipe' ? dados.equipe : dados.colaborador ? [dados.colaborador] : [];
    if (responsaveis.length === 0) {
      alert('Selecione o colaborador.');
      return;
    }
    const minPrevistos = minPorPeca * qtd / responsaveis.length;
    const inicio = dados.inicio || agoraISO();
    const fimPrevisto = somaMinutos(inicio, minPrevistos || 1);

    // nunca duplicar o mesmo colaborador na mesma data e horário
    for (const n of responsaveis) {
      const d = disponibilidadeColaborador(n, emAberto);
      if (!d.livre) {
        const choque = (d.janelas || []).find(a => sobrepoe(inicio, fimPrevisto, a.inicio, a.previsaoFim || a.inicio));
        if (choque) {
          alert(`${n} já está produzindo "${choque.etapa}" (${choque.opRotulo}) das ${String(choque.inicio).slice(11)} às ${String(choque.previsaoFim || '').slice(11)}.\n\nEsse colaborador fica livre a partir de ${String(d.ocupadoAte).replace('T', ' ')}. Ajuste o horário de início ou conclua a produção anterior.`);
          return;
        }
      }
    }

    // a mesma máquina também não pode receber dois trabalhos no mesmo horário
    const equipUsado = dados.equipamentoId || et.equipamentoId || '';
    if (equipUsado) {
      const choqueMaq = emAberto.find(a => a.equipamentoId === equipUsado && sobrepoe(inicio, fimPrevisto, a.inicio, a.previsaoFim || a.inicio));
      if (choqueMaq) {
        const maq = (db.equipamentos || []).find(q => q.id === equipUsado);
        alert(`A máquina ${maq ? maq.codigo + ' · ' + maq.nome : ''} já está ocupada com "${choqueMaq.etapaNome}" (${choqueMaq.opRotulo}) até ${String(choqueMaq.previsaoFim || '').replace('T', ' ')}.`);
        return;
      }
      const q = (db.equipamentos || []).find(x => x.id === equipUsado);
      if (q && (q.status || 'Operando') === 'Em manutenção' && !confirm(`${q.codigo} · ${q.nome} está marcada como "Em manutenção". Usar mesmo assim?`)) return;
    }
    update(d => {
      d.apontamentos = [...(d.apontamentos || []), {
        id: uid(),
        opId: op.id,
        opRotulo: rotuloOP(op),
        etapaIdx: idx,
        etapaNome: et.nome,
        departamentoId: et.departamentoId || '',
        equipamentoId: equipUsado,
        modo: dados.modo,
        colaborador: responsaveis[0],
        equipe: responsaveis,
        quantidade: qtd,
        minPorPeca,
        metaHora: minPorPeca > 0 ? Math.floor(60 / minPorPeca) : 0,
        minPrevistos,
        inicio,
        previsaoFim: fimPrevisto,
        semTempoPadrao: !(minPorPeca > 0),
        camposSetor: dados.camposSetor || {},
        fim: null,
        qtdBoas: 0,
        qtdDefeito: 0,
        qtdRetrabalho: 0,
        observacao: ''
      }];
      d.ops = d.ops.map(o => {
        if (o.id !== op.id) return o;
        const etapas = o.etapas.slice();
        etapas[idx] = {
          ...etapas[idx],
          equipamentoId: equipUsado || etapas[idx].equipamentoId,
          status: etapas[idx].status === 'Não iniciada' ? 'Em andamento' : etapas[idx].status,
          dataInicio: etapas[idx].dataInicio || inicio.slice(0, 10)
        };
        return {
          ...o,
          etapas
        };
      });
      registrarLog(d, usuario, 'Iniciou produção', `${rotuloOP(op)} · ${et.nome} · ${responsaveis.join(', ')} · ${qtd} peças`);
      return d;
    });
    setIniciando(null);
  }
  function salvarConclusao(dados) {
    update(d => {
      const ap = (d.apontamentos || []).find(a => a.id === dados.id);
      if (!ap) return d;
      const fim = agoraISO();
      const minReais = minutosEntre(ap.inicio, fim);
      const boas = num(dados.qtdBoas);
      const pessoas = (ap.equipe || [ap.colaborador]).length || 1;
      const minPrevistosBoas = ap.minPorPeca * boas / pessoas;
      const eficiencia = minReais > 0 ? minPrevistosBoas / minReais * 100 : 0;
      const pecasHora = minReais > 0 ? boas / (minReais / 60) : 0;
      d.apontamentos = (d.apontamentos || []).map(a => a.id !== dados.id ? a : {
        ...a,
        fim,
        minReais,
        qtdBoas: boas,
        qtdDefeito: num(dados.qtdDefeito),
        qtdRetrabalho: num(dados.qtdRetrabalho),
        observacao: dados.observacao || '',
        anexos: dados.anexos || [],
        eficiencia,
        pecasHora,
        nota: classificarEficiencia(eficiencia).nota
      });
      d.ops = d.ops.map(o => {
        if (o.id !== ap.opId) return o;
        const etapas = o.etapas.slice();
        const et = etapas[ap.etapaIdx];
        if (!et) return o;
        const base = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(o.quantidade);
        const acumulado = num(et.qtdConcluida) + boas;
        const completou = acumulado >= base;
        etapas[ap.etapaIdx] = {
          ...et,
          qtdConcluida: acumulado,
          status: completou ? 'Concluída' : 'Em andamento',
          dataConclusao: completou ? todayISO() : ''
        };
        return {
          ...o,
          etapas
        };
      });
      registrarLog(d, usuario, 'Concluiu produção', `${ap.opRotulo} · ${ap.etapaNome} · ${boas} boas, ${num(dados.qtdDefeito)} defeito, ${num(dados.qtdRetrabalho)} retrabalho`);
      return d;
    });
    setConcluir(null);
  }
  function cancelarApontamento(ap) {
    if (!confirm('Cancelar esta produção em aberto?')) return;
    update(d => {
      d.apontamentos = (d.apontamentos || []).filter(a => a.id !== ap.id);
      return d;
    });
  }
  function excluirOP(op) {
    if (!exigirPermissao(usuario, 'cadastros', update, 'excluir ordens de produção')) return;
    if (!confirm(`Excluir a ${rotuloOP(op)}?`)) return;
    update(d => {
      d.ops = d.ops.filter(o => o.id !== op.id);
      d.apontamentos = (d.apontamentos || []).filter(a => a.opId !== op.id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontFamily: 'var(--display)',
      fontSize: 16,
      margin: '0 0 10px 0'
    }
  }, "Ordens em aberto"), opsAbertas.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma Ordem de Produção em aberto. Gere uma OP a partir de um pedido."
  }), opsAbertas.map(op => {
    const pedido = db.pedidos.find(p => p.id === op.pedidoId);
    const produto = db.produtos.find(p => p.id === op.produtoId);
    const expandida = aberta === op.id;
    const pendentes = op.etapas.filter(e => e.status !== 'Concluída');
    const deptosPend = new Set(pendentes.map(e => e.departamentoId || '_sem')).size;
    const totalMin = op.etapas.reduce((sm, e) => {
      const b = num(e.qtdRecebida) > 0 ? num(e.qtdRecebida) : num(op.quantidade);
      return sm + cargaEtapaOP(e, b, op.quantidade, db);
    }, 0);
    const atrasada = op.entrega && op.entrega < todayISO();
    const necessidades = opNecessidades(op, db);
    const anexos = op.anexos || [];
    return /*#__PURE__*/React.createElement("div", {
      key: op.id,
      className: "op-card"
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-head",
      onClick: () => {
        setAberta(expandida ? null : op.id);
        setAbaOP('atividades');
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "op-seta"
    }, expandida ? '⌄' : '›'), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-titulo"
    }, rotuloOP(op), " · ", pedido ? pedido.cliente : '—'), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, produto ? produto.nome : '—', " (", op.quantidade, ")", anexos.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " · 📎 ", anexos.length)), /*#__PURE__*/React.createElement("div", {
      className: "op-badges"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tag " + (atrasada ? 'tag-bad' : 'tag-ok')
    }, atrasada ? 'Fora do prazo' : 'Dentro do prazo'), /*#__PURE__*/React.createElement("span", {
      className: "tag"
    }, "Entrega: ", fmtDate(op.entrega)), /*#__PURE__*/React.createElement("span", {
      className: "tag"
    }, "Total estimado: ", minParaHHMM(totalMin)), /*#__PURE__*/React.createElement("span", {
      className: "tag"
    }, deptosPend, " departamento", deptosPend > 1 ? 's' : '', " pendente", deptosPend > 1 ? 's' : ''))), /*#__PURE__*/React.createElement("div", {
      className: "row-actions",
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      title: "Relatório da OP",
      onClick: () => setRelatorioOP(op)
    }, "🖨"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      title: "Excluir",
      onClick: () => excluirOP(op)
    }, "🗑"))), expandida && /*#__PURE__*/React.createElement("div", {
      className: "op-corpo"
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-abas"
    }, /*#__PURE__*/React.createElement("button", {
      className: abaOP === 'atividades' ? 'ativa' : '',
      onClick: () => setAbaOP('atividades')
    }, "Atividades"), /*#__PURE__*/React.createElement("button", {
      className: abaOP === 'materiais' ? 'ativa' : '',
      onClick: () => setAbaOP('materiais')
    }, "Materiais (", necessidades.length, ")"), /*#__PURE__*/React.createElement("button", {
      className: abaOP === 'arquivos' ? 'ativa' : '',
      onClick: () => setAbaOP('arquivos')
    }, "Arquivos (", anexos.length, ")")), abaOP === 'atividades' && op.etapas.map((et, idx) => {
      const dep = db.departamentos.find(d => d.id === et.departamentoId);
      const ap = apontamentoDaEtapa(op.id, idx);
      const base = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const restante = Math.max(base - num(et.qtdConcluida), 0);
      const minPorPeca = cargaEtapaOP(et, 1, op.quantidade, db);
      const estim = cargaEtapaOP(et, restante || base, op.quantidade, db);
      const concluida = et.status === 'Concluída';
      const abrindo = iniciando && iniciando.opId === op.id && iniciando.etapaIdx === idx;
      return /*#__PURE__*/React.createElement("div", {
        key: idx,
        className: "ativ " + (concluida ? 'ativ-ok' : ap ? 'ativ-run' : '')
      }, /*#__PURE__*/React.createElement("div", {
        className: "ativ-linha"
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "ativ-nome"
      }, idx + 1, ". ", et.nome, /*#__PURE__*/React.createElement("span", {
        className: "muted"
      }, " (", dep ? dep.nome : 'sem depto', " · ", produto ? produto.nome : '—', ")")), /*#__PURE__*/React.createElement("div", {
        className: "small muted"
      }, minParaHHMM(estim), " · ", minPorPeca > 0 ? `padrão ${labelModoTempo(etapaAtual(et, db))} · meta ${Math.floor(60 / minPorPeca)} pç/h` : /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--bad)'
        }
      }, "sem tempo cadastrado na etapa"), ' · ', num(et.qtdConcluida), "/", base, " pç", (() => {
        const q = (db.equipamentos || []).find(x => x.id === et.equipamentoId);
        return q ? /*#__PURE__*/React.createElement(React.Fragment, null, " · ", q.codigo) : null;
      })(), ap && /*#__PURE__*/React.createElement(React.Fragment, null, " · ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--thread-dark)',
          fontWeight: 600
        }
      }, "prev. ", ap.previsaoFim)))), concluida ? /*#__PURE__*/React.createElement(Badge, {
        tone: "ok"
      }, "Concluída") : ap ? /*#__PURE__*/React.createElement("div", {
        className: "row-actions"
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn accent sm",
        onClick: () => setConcluir(ap)
      }, "■ Concluir"), /*#__PURE__*/React.createElement("button", {
        className: "btn ghost sm",
        onClick: () => cancelarApontamento(ap)
      }, "Cancelar")) : /*#__PURE__*/React.createElement("button", {
        className: "btn escuro sm",
        onClick: () => setIniciando(abrindo ? null : {
          opId: op.id,
          etapaIdx: idx
        })
      }, "▶ Iniciar")), ap && /*#__PURE__*/React.createElement("div", {
        className: "proj-box"
      }, /*#__PURE__*/React.createElement("div", {
        className: "small",
        style: {
          marginBottom: 6
        }
      }, "Em produção por ", /*#__PURE__*/React.createElement("strong", null, (ap.equipe || [ap.colaborador]).join(', ')), " desde ", String(ap.inicio).replace('T', ' '), " · ", ap.quantidade, " peças", (() => {
        const q = (db.equipamentos || []).find(x => x.id === ap.equipamentoId);
        return q ? /*#__PURE__*/React.createElement(React.Fragment, null, " · máquina ", /*#__PURE__*/React.createElement("strong", null, q.codigo, " · ", q.nome)) : null;
      })()), ap.semTempoPadrao || !(num(ap.minPorPeca) > 0) ? /*#__PURE__*/React.createElement("div", {
        className: "small",
        style: {
          color: 'var(--bad)',
          fontWeight: 600
        }
      }, "Sem tempo de produção cadastrado nesta etapa — não há como projetar a conclusão.") : /*#__PURE__*/React.createElement("div", {
        className: "proj-grid"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "k"
      }, "Conclusão prevista"), /*#__PURE__*/React.createElement("div", {
        className: "v"
      }, String(ap.previsaoFim).replace('T', ' '))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "k"
      }, "Duração prevista"), /*#__PURE__*/React.createElement("div", {
        className: "v"
      }, minParaHHMM(ap.minPrevistos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "k"
      }, "Meta"), /*#__PURE__*/React.createElement("div", {
        className: "v"
      }, ap.metaHora, " pç/h")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "k"
      }, "Decorrido"), /*#__PURE__*/React.createElement("div", {
        className: "v"
      }, minParaHHMM(minutosEntre(ap.inicio, agoraISO())))))), abrindo && !ap && !concluida && /*#__PURE__*/React.createElement(FormIniciarEtapa, {
        etapa: et,
        dep: dep,
        restante: restante,
        db: db,
        emAberto: emAberto,
        minPorPeca: minPorPeca,
        onCancelar: () => setIniciando(null),
        onIniciar: dados => iniciar(op, idx, dados)
      }));
    }), abaOP === 'materiais' && (necessidades.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
      text: "Este produto não tem ficha técnica."
    }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Necessário"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Estoque"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Falta"))), /*#__PURE__*/React.createElement("tbody", null, necessidades.map(n => /*#__PURE__*/React.createElement("tr", {
      key: n.materialId
    }, /*#__PURE__*/React.createElement("td", null, n.nome), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, n.necessario, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, n.disponivel, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: n.falta > 0 ? {
        color: 'var(--bad)',
        fontWeight: 700
      } : {}
    }, n.falta || '—')))))), abaOP === 'arquivos' && (anexos.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
      text: "Nenhum arquivo anexado a esta OP."
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10
      }
    }, anexos.map(a => /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        width: 130,
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: 8,
        background: '#fff'
      }
    }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("a", {
      href: a.url,
      target: "_blank",
      rel: "noopener noreferrer"
    }, /*#__PURE__*/React.createElement("img", {
      src: a.url,
      alt: a.nome,
      style: {
        width: '100%',
        height: 80,
        objectFit: 'cover',
        borderRadius: 4
      }
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        height: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0ede6',
        borderRadius: 4,
        fontSize: 26
      }
    }, "📄"), /*#__PURE__*/React.createElement("div", {
      className: "small",
      style: {
        wordBreak: 'break-word',
        marginTop: 6
      }
    }, a.nome)))))));
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      flex: 1
    }
  }, "Produções concluídas ", /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, concluidos.length)), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setVerConcluidas(!verConcluidas)
  }, verConcluidas ? 'Ocultar' : 'Ver histórico')), verConcluidas && (concluidos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma produção concluída ainda."
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      padding: '0 18px 10px 18px'
    }
  }, "🟢 A (95%+) · 🟡 B (80–94%) · 🔴 C (abaixo de 80%). A meta considera apenas peças boas."), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Colaborador"), /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Boas"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Defeito"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Retrab."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Previsto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Real"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Pç/h"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Eficiência"), /*#__PURE__*/React.createElement("th", null, "Nota"))), /*#__PURE__*/React.createElement("tbody", null, concluidos.map(ap => {
    const cls = classificarEficiencia(num(ap.eficiencia));
    const pessoas = (ap.equipe || [ap.colaborador]).length || 1;
    return /*#__PURE__*/React.createElement("tr", {
      key: ap.id,
      className: 'linha-nota-' + cls.nota
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, (ap.equipe || [ap.colaborador]).join(', ')), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, ap.fim)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, ap.opRotulo), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, ap.etapaNome, (ap.anexos || []).length > 0 && /*#__PURE__*/React.createElement("span", {
      title: `${ap.anexos.length} anexo(s)`
    }, " 📎", ap.anexos.length), ap.observacao && /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, ap.observacao), (ap.anexos || []).filter(x => x.tipo === 'imagem').length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        marginTop: 4
      }
    }, (ap.anexos || []).filter(x => x.tipo === 'imagem').map(x => /*#__PURE__*/React.createElement("a", {
      key: x.id,
      href: x.url,
      target: "_blank",
      rel: "noopener noreferrer"
    }, /*#__PURE__*/React.createElement("img", {
      src: x.url,
      alt: x.nome,
      style: {
        width: 40,
        height: 40,
        objectFit: 'cover',
        borderRadius: 4,
        border: '1px solid var(--line)'
      }
    }))))), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, ap.qtdBoas), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: num(ap.qtdDefeito) > 0 ? {
        color: 'var(--bad)',
        fontWeight: 600
      } : {}
    }, ap.qtdDefeito || '—'), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: num(ap.qtdRetrabalho) > 0 ? {
        color: 'var(--warn)',
        fontWeight: 600
      } : {}
    }, ap.qtdRetrabalho || '—'), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, minParaHHMM(ap.minPorPeca * ap.qtdBoas / pessoas)), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, minParaHHMM(ap.minReais)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, num(ap.pecasHora).toFixed(0)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", null, num(ap.eficiencia).toFixed(1), "%")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: cls.tone
    }, cls.nota)));
  })))))), concluir && /*#__PURE__*/React.createElement(ConcluirProducaoModal, {
    ap: concluir,
    onClose: () => setConcluir(null),
    onSalvar: salvarConclusao
  }), relatorioOP && (() => {
    const ped = db.pedidos.find(p => p.id === relatorioOP.pedidoId);
    const prod = db.produtos.find(p => p.id === relatorioOP.produtoId);
    return /*#__PURE__*/React.createElement(Modal, {
      title: `Relatório — ${rotuloOP(relatorioOP)}`,
      onClose: () => setRelatorioOP(null),
      wide: true
    }, /*#__PURE__*/React.createElement(RelatorioOP, {
      op: relatorioOP,
      db: db,
      pedido: ped,
      produto: prod,
      necessidades: opNecessidades(relatorioOP, db)
    }), /*#__PURE__*/React.createElement("div", {
      className: "modal-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost",
      onClick: () => setRelatorioOP(null)
    }, "Fechar")));
  })());
}

/* formulário inline de início da atividade, com campos próprios do setor */
function FormIniciarEtapa({
  etapa,
  dep,
  restante,
  db,
  emAberto,
  minPorPeca,
  onCancelar,
  onIniciar
}) {
  const [modo, setModo] = useState('individual');
  const [colaborador, setColaborador] = useState('');
  const [equipe, setEquipe] = useState([]);
  const [quantidade, setQuantidade] = useState(String(restante || ''));
  const [inicio, setInicio] = useState(agoraISO().replace(' ', 'T'));
  const [campos, setCampos] = useState({});
  const [equipamentoId, setEquipamentoId] = useState(etapa.equipamentoId || '');
  const maquinas = maquinasDaEtapa(etapa, db);
  const doDep = db.colaboradores.filter(c => c.status !== 'Inativo' && c.departamentoId === etapa.departamentoId);
  const outros = db.colaboradores.filter(c => c.status !== 'Inativo' && c.departamentoId !== etapa.departamentoId);
  const nomeDep = normaliza(dep && dep.nome || '');

  // campos extras conforme o setor
  const extras = [];
  if (nomeDep.includes('corte')) extras.push({
    k: 'tecido',
    label: 'Tipo de tecido',
    ph: 'Ex.: Malha 100% algodão'
  }, {
    k: 'consumo',
    label: 'Consumo (metros)',
    ph: 'Ex.: 12.5',
    tipo: 'number'
  });
  if (nomeDep.includes('silk') || nomeDep.includes('grava')) extras.push({
    k: 'cores',
    label: 'Cores / Pantone',
    ph: 'Ex.: Preto + Branco'
  }, {
    k: 'fotolito',
    label: 'Fotolito / tela',
    ph: 'Ex.: Tela 120 fios'
  });
  if (nomeDep.includes('costura')) extras.push({
    k: 'linha',
    label: 'Linha / cor',
    ph: 'Ex.: Linha 120 branca'
  });
  const nomes = modo === 'equipe' ? equipe : colaborador ? [colaborador] : [];
  return /*#__PURE__*/React.createElement("div", {
    className: "form-iniciar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Colaborador"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (modo === 'individual' ? 'escuro' : 'ghost'),
    onClick: () => setModo('individual')
  }, "Individual"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (modo === 'equipe' ? 'escuro' : 'ghost'),
    onClick: () => setModo('equipe')
  }, "Equipe")), modo === 'individual' ? /*#__PURE__*/React.createElement("select", {
    value: colaborador,
    onChange: e => setColaborador(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Selecione…"), doDep.length > 0 && /*#__PURE__*/React.createElement("optgroup", {
    label: dep ? dep.nome : 'Departamento'
  }, doDep.map(c => {
    const d = disponibilidadeColaborador(c.nome, emAberto || []);
    return /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.nome
    }, c.nome, " — ", rotuloDisponibilidade(d));
  })), outros.length > 0 && /*#__PURE__*/React.createElement("optgroup", {
    label: "Outros departamentos"
  }, outros.map(c => {
    const d = disponibilidadeColaborador(c.nome, emAberto || []);
    return /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.nome
    }, c.nome, " — ", rotuloDisponibilidade(d));
  }))) : /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5,
      marginBottom: 6
    }
  }, equipe.map(n => /*#__PURE__*/React.createElement("span", {
    key: n,
    className: "chip-col"
  }, n, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setEquipe(equipe.filter(x => x !== n))
  }, "×"))), equipe.length === 0 && /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "Nenhum colaborador na equipe.")), /*#__PURE__*/React.createElement("select", {
    value: "",
    onChange: e => {
      if (e.target.value) setEquipe([...equipe, e.target.value]);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "+ adicionar à equipe"), [...doDep, ...outros].filter(c => !equipe.includes(c.nome)).map(c => {
    const d = disponibilidadeColaborador(c.nome, emAberto || []);
    return /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.nome
    }, c.nome, " — ", rotuloDisponibilidade(d));
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "Equipamento utilizado"
  }, maquinas.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Nenhum equipamento cadastrado em ", dep ? dep.nome : 'este departamento', ".") : /*#__PURE__*/React.createElement("select", {
    value: equipamentoId,
    onChange: e => setEquipamentoId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— sem equipamento / manual —"), maquinas.map(q => {
    const ocupa = (emAberto || []).find(a => a.equipamentoId === q.id);
    const st = (q.status || 'Operando') !== 'Operando' ? ` (${q.status})` : '';
    return /*#__PURE__*/React.createElement("option", {
      key: q.id,
      value: q.id
    }, q.codigo, " · ", q.nome, st, ocupa ? ` — em uso até ${String(ocupa.previsaoFim || '').replace('T', ' ').slice(11)}` : '');
  }))), extras.map(x => /*#__PURE__*/React.createElement(Field, {
    key: x.k,
    label: x.label
  }, /*#__PURE__*/React.createElement("input", {
    type: x.tipo || 'text',
    value: campos[x.k] || '',
    placeholder: x.ph,
    onChange: e => setCampos({
      ...campos,
      [x.k]: e.target.value
    })
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade a produzir"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    value: quantidade,
    onChange: e => setQuantidade(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Início (quando)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "datetime-local",
    value: inicio,
    onChange: e => setInicio(e.target.value)
  }))), (() => {
    if (nomes.length === 0) return null;
    const mp = num(minPorPeca);
    const prev = mp > 0 ? mp * num(quantidade) / nomes.length : 0;
    const ini = inicio.replace('T', ' ');
    const fim = mp > 0 ? somaMinutos(ini, prev) : null;
    const conflitos = nomes.map(n => {
      const d = disponibilidadeColaborador(n, emAberto || []);
      if (d.livre) return null;
      const bate = (d.janelas || []).some(a => sobrepoe(ini, fim || somaMinutos(ini, 1), a.inicio, a.previsaoFim || a.inicio));
      return {
        nome: n,
        disp: d,
        bate
      };
    }).filter(Boolean);
    return /*#__PURE__*/React.createElement(React.Fragment, null, mp > 0 && /*#__PURE__*/React.createElement("div", {
      className: "proj-box",
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "proj-grid"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "Conclusão prevista"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, fim)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "Duração"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, minParaHHMM(prev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "Meta"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, Math.floor(60 / mp), " pç/h")), nomes.length > 1 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "k"
    }, "Divisão"), /*#__PURE__*/React.createElement("div", {
      className: "v"
    }, nomes.length, " pessoas")))), (() => {
      if (!equipamentoId) return null;
      const choque = (emAberto || []).find(a => a.equipamentoId === equipamentoId && sobrepoe(ini, fim || somaMinutos(ini, 1), a.inicio, a.previsaoFim || a.inicio));
      if (!choque) return null;
      const q = (db.equipamentos || []).find(x => x.id === equipamentoId);
      return /*#__PURE__*/React.createElement("div", {
        className: "small",
        style: {
          background: 'var(--bad-bg)',
          color: 'var(--bad)',
          padding: '8px 10px',
          borderRadius: 6,
          marginBottom: 8,
          fontWeight: 600
        }
      }, "⛔ ", q ? `${q.codigo} · ${q.nome}` : 'A máquina', " já está em uso em ", /*#__PURE__*/React.createElement("strong", null, choque.etapaNome), " (", choque.opRotulo, ") até", ' ', /*#__PURE__*/React.createElement("strong", null, String(choque.previsaoFim || '').replace('T', ' ')), ". Escolha outra máquina ou ajuste o horário.");
    })(), conflitos.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.nome,
      className: "small",
      style: {
        background: c.bate ? 'var(--bad-bg)' : 'var(--warn-bg)',
        color: c.bate ? 'var(--bad)' : 'var(--warn)',
        padding: '8px 10px',
        borderRadius: 6,
        marginBottom: 8,
        fontWeight: 600
      }
    }, c.bate ? '⛔' : '⚠', " ", c.nome, " está em ", /*#__PURE__*/React.createElement("strong", null, c.disp.etapa), " (", c.disp.op, ") e fica livre em", ' ', /*#__PURE__*/React.createElement("strong", null, String(c.disp.ocupadoAte).replace('T', ' ')), ".", c.bate && ' O horário escolhido conflita — ajuste o início ou conclua a produção anterior.')));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "row-actions",
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    style: {
      flex: 1,
      justifyContent: 'center'
    },
    disabled: nomes.length === 0 || num(quantidade) <= 0,
    onClick: () => onIniciar({
      modo,
      colaborador,
      equipe,
      quantidade,
      inicio: inicio.replace('T', ' '),
      camposSetor: campos,
      equipamentoId
    })
  }, "▶ Iniciar ", etapa.nome), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onCancelar
  }, "Cancelar")));
}
function ConcluirProducaoModal({
  ap,
  onClose,
  onSalvar
}) {
  const [qtdBoas, setQtdBoas] = useState(String(ap.quantidade));
  const [temDefeito, setTemDefeito] = useState(null);
  const [qtdDefeito, setQtdDefeito] = useState('');
  const [qtdRetrabalho, setQtdRetrabalho] = useState('');
  const [observacao, setObservacao] = useState('');
  const [anexos, setAnexos] = useState([]);
  const pessoas = (ap.equipe || [ap.colaborador]).length || 1;
  const minReais = minutosEntre(ap.inicio, agoraISO());
  const boas = num(qtdBoas);
  const semTempoPadrao = !(num(ap.minPorPeca) > 0);
  const minPrevistos = num(ap.minPorPeca) * boas / pessoas;
  const podeMedir = !semTempoPadrao && minReais > 0;
  const eficiencia = podeMedir ? minPrevistos / minReais * 100 : 0;
  const cls = classificarEficiencia(eficiencia);
  const inicioNoFuturo = new Date(String(ap.inicio).replace(' ', 'T')) > new Date();
  async function onArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) url = await comprimirImagem(file);else {
        if (file.size > 300 * 1024) {
          alert('Documento muito grande (máx. 300 KB).');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
          r.readAsDataURL(file);
        });
      }
      setAnexos(a => [...a, {
        id: uid(),
        nome: file.name,
        tipo: ehImagem ? 'imagem' : 'documento',
        url,
        quando: agoraISO()
      }]);
    } catch (err) {
      alert('Não foi possível anexar: ' + (err && err.message));
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Concluir produção — ${ap.etapaNome}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 12
    }
  }, ap.opRotulo, " · ", (ap.equipe || [ap.colaborador]).join(', '), " · iniciada em ", ap.inicio, ap.previsaoFim && /*#__PURE__*/React.createElement(React.Fragment, null, " · previsão ", ap.previsaoFim), pessoas > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, " · equipe de ", pessoas)), inicioNoFuturo && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      background: 'var(--warn-bg)',
      color: 'var(--warn)',
      padding: '8px 10px',
      borderRadius: 6,
      marginBottom: 12,
      fontWeight: 600
    }
  }, "A data de início está no futuro, então o tempo real ainda é 0:00. Ajuste o início na atividade se foi engano."), semTempoPadrao && /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      background: 'var(--warn-bg)',
      color: 'var(--warn)',
      padding: '8px 10px',
      borderRadius: 6,
      marginBottom: 12,
      fontWeight: 600
    }
  }, "Esta etapa não tem tempo de produção cadastrado — sem isso não há meta, e a eficiência não pode ser calculada. Cadastre o tempo em Departamentos → Etapas para medir o desempenho."), /*#__PURE__*/React.createElement("div", {
    className: "painel-meta",
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tempo real"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, minParaHHMM(minReais))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tempo previsto"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, semTempoPadrao ? '—' : minParaHHMM(minPrevistos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Eficiência"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      color: !podeMedir ? '#8a8577' : cls.tone === 'ok' ? 'var(--ok)' : cls.tone === 'warn' ? 'var(--warn)' : 'var(--bad)'
    }
  }, podeMedir ? eficiencia.toFixed(1) + '%' : '—')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Nota"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, podeMedir ? cls.nota : '—'))), /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade de peças boas produzidas"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    value: qtdBoas,
    onChange: e => setQtdBoas(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Houve peças com defeito?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (temDefeito === false ? 'accent' : 'ghost'),
    onClick: () => {
      setTemDefeito(false);
      setQtdDefeito('');
      setQtdRetrabalho('');
    }
  }, "Não"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (temDefeito === true ? 'accent' : 'ghost'),
    onClick: () => setTemDefeito(true)
  }, "Sim"))), temDefeito && /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade com defeito"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    value: qtdDefeito,
    onChange: e => setQtdDefeito(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade para retrabalho"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "0",
    value: qtdRetrabalho,
    onChange: e => setQtdRetrabalho(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Anexar foto ou arquivo ", anexos.length > 0 && `(${anexos.length})`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "btn ghost sm",
    style: {
      cursor: 'pointer'
    }
  }, "📎 Anexar arquivo", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
    style: {
      display: 'none'
    },
    onChange: onArquivo
  })), /*#__PURE__*/React.createElement("label", {
    className: "btn ghost sm",
    style: {
      cursor: 'pointer'
    }
  }, "📷 Tirar foto", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    style: {
      display: 'none'
    },
    onChange: onArquivo
  })), /*#__PURE__*/React.createElement("span", {
    className: "small muted",
    style: {
      alignSelf: 'center'
    }
  }, temDefeito ? 'registre a foto do defeito encontrado' : 'foto da peça pronta, ocorrência, etiqueta…')), anexos.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10
    }
  }, anexos.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      width: 120,
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 6,
      background: '#fff'
    }
  }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("a", {
    href: a.url,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    src: a.url,
    alt: a.nome,
    style: {
      width: '100%',
      height: 70,
      objectFit: 'cover',
      borderRadius: 4
    }
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 70,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0ede6',
      borderRadius: 4,
      fontSize: 24
    }
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      wordBreak: 'break-word',
      margin: '4px 0'
    }
  }, a.nome), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn danger sm",
    onClick: () => setAnexos(x => x.filter(y => y.id !== a.id))
  }, "Remover"))))), /*#__PURE__*/React.createElement(Field, {
    label: "Observação"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: observacao,
    onChange: e => setObservacao(e.target.value),
    placeholder: "Ocorrências, motivo do atraso, causa do defeito…"
  })), podeMedir && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 10
    }
  }, cls.texto, ". A meta considera apenas as peças boas — defeitos reduzem a eficiência proporcionalmente."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    disabled: temDefeito === null || boas < 0,
    onClick: () => onSalvar({
      id: ap.id,
      qtdBoas,
      qtdDefeito,
      qtdRetrabalho,
      observacao,
      anexos
    })
  }, "Concluir produção")));
}
function SelectComCadastro({
  label,
  valor,
  onChange,
  lista,
  campoDb,
  update,
  placeholderCod,
  placeholderNome,
  pai,
  filtro
}) {
  const [aberto, setAberto] = useState(false);
  const [cod, setCod] = useState('');
  const [nome, setNome] = useState('');
  const opcoes = filtro ? lista.filter(filtro) : lista;
  function criar() {
    const c = cod.trim().toUpperCase(),
      n = nome.trim();
    if (!c || !n) return;
    const dup = lista.find(x => normaliza(x.codigo) === normaliza(c) || normaliza(x.nome) === normaliza(n));
    if (dup) {
      alert(`Já existe: "${dup.codigo} · ${dup.nome}".`);
      return;
    }
    const novo = {
      id: uid(),
      codigo: c,
      nome: n,
      ...(pai ? {
        [pai.campo]: pai.valor || ''
      } : {})
    };
    update(d => {
      d[campoDb] = [...(d[campoDb] || []), novo];
      return d;
    });
    onChange(novo.id);
    setCod('');
    setNome('');
    setAberto(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: valor || '',
    onChange: e => onChange(e.target.value),
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), opcoes.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.codigo, " · ", x.nome))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (aberto ? 'accent' : 'ghost'),
    onClick: () => setAberto(!aberto),
    title: "Cadastrar nova"
  }, aberto ? '×' : '+')), aberto && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: cod,
    onChange: e => setCod(e.target.value.toUpperCase()),
    placeholder: placeholderCod,
    maxLength: "6",
    style: {
      width: 90
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: nome,
    onChange: e => setNome(e.target.value),
    placeholder: placeholderNome,
    style: {
      flex: 1
    },
    onKeyDown: e => {
      if (e.key === 'Enter') criar();
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn accent sm",
    onClick: criar,
    disabled: !cod.trim() || !nome.trim()
  }, "Criar")));
}

/* ==========================================================
   1. MATERIAIS
========================================================== */
function Materiais({
  db,
  update
}) {
  const [modal, setModal] = useState(null); // {} novo ou material existente
  const [q, setQ] = useState('');
  const list = db.materiais.filter(m => {
    const s = q.toLowerCase();
    return !s || m.nome.toLowerCase().includes(s) || m.codigo.toLowerCase().includes(s) || (m.categoria || '').toLowerCase().includes(s);
  });
  function save(mat) {
    const erro = checarDuplicidade(db.materiais, mat, [{
      key: 'codigo',
      label: 'código'
    }, {
      key: 'nome',
      label: 'nome'
    }]);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (mat.id) {
        d.materiais = d.materiais.map(m => m.id === mat.id ? mat : m);
      } else {
        d.materiais.push({
          ...mat,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este material?')) return;
    update(d => {
      d.materiais = d.materiais.filter(m => m.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Materiais"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo material")), /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por código, nome ou categoria…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum material cadastrado ainda."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Código"), /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Categoria"), /*#__PURE__*/React.createElement("th", null, "Cor"), /*#__PURE__*/React.createElement("th", null, "Un."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Estoque"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mínimo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo"), /*#__PURE__*/React.createElement("th", null, "Fornecedor"), /*#__PURE__*/React.createElement("th", null, "Local"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.map(m => {
    const baixo = num(m.estoqueAtual) <= num(m.estoqueMinimo);
    return /*#__PURE__*/React.createElement("tr", {
      key: m.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, m.codigo), /*#__PURE__*/React.createElement("td", null, m.nome), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, ((db.categoriasMaterial || []).find(c => c.id === m.categoriaId) || {}).nome || m.categoria || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, m.cor), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, m.unidade), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: baixo ? {
        color: 'var(--bad)',
        fontWeight: 700
      } : {}
    }, num(m.estoqueAtual)), /*#__PURE__*/React.createElement("td", {
      className: "num muted"
    }, num(m.estoqueMinimo)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(m.custo)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, m.fornecedor), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, m.localizacao), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(m)
    }, "Editar"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(m.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(MaterialModal, {
    mat: modal,
    db: db,
    update: update,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function MaterialModal({
  mat,
  db,
  update,
  onClose,
  onSave
}) {
  const cats = db.categoriasMaterial || [];
  const [f, setF] = useState({
    codigo: '',
    nome: '',
    categoriaId: '',
    categoria: '',
    cor: '',
    unidade: 'm',
    estoqueAtual: 0,
    estoqueMinimo: 0,
    custo: 0,
    fornecedorId: '',
    fornecedor: '',
    localizacao: '',
    ...mat
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));

  // ao escolher a categoria, gera o código com o prefixo dela (só para cadastro novo)
  function escolherCategoria(catId) {
    const cat = (db.categoriasMaterial || []).find(c => c.id === catId);
    setF(prev => ({
      ...prev,
      categoriaId: catId,
      categoria: cat ? cat.nome : '',
      codigo: !prev.id && cat ? proximoSequencial(db.materiais, cat.codigo) : prev.codigo
    }));
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: mat.id ? 'Editar material' : 'Novo material',
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(SelectComCadastro, {
    label: "Categoria",
    valor: f.categoriaId,
    onChange: escolherCategoria,
    lista: cats,
    campoDb: "categoriasMaterial",
    update: update,
    placeholderCod: "TEC",
    placeholderNome: "Tecidos"
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Código (gerado pela categoria)"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.codigo,
    onChange: e => set('codigo', e.target.value),
    placeholder: "Selecione a categoria"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nome"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value),
    placeholder: "Tecido Oxford"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Cor"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.cor,
    onChange: e => set('cor', e.target.value),
    placeholder: "Royal"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Unidade"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.unidade,
    onChange: e => set('unidade', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "m"
  }, "m (metro)"), /*#__PURE__*/React.createElement("option", {
    value: "un"
  }, "un (unidade)"), /*#__PURE__*/React.createElement("option", {
    value: "kg"
  }, "kg"), /*#__PURE__*/React.createElement("option", {
    value: "rolo"
  }, "rolo"), /*#__PURE__*/React.createElement("option", {
    value: "pct"
  }, "pacote"))), /*#__PURE__*/React.createElement(Field, {
    label: "Custo unitário (R$)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.custo,
    onChange: e => set('custo', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Estoque atual"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.estoqueAtual,
    onChange: e => set('estoqueAtual', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Estoque mínimo"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.estoqueMinimo,
    onChange: e => set('estoqueMinimo', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fornecedor"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.fornecedorId || '',
    onChange: e => {
      const forn = db.fornecedores.find(x => x.id === e.target.value);
      setF(prev => ({
        ...prev,
        fornecedorId: e.target.value,
        fornecedor: forn ? forn.nome : ''
      }));
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, f.fornecedor && !f.fornecedorId ? f.fornecedor : '—'), db.fornecedores.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Localização no estoque"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.localizacao,
    onChange: e => set('localizacao', e.target.value),
    placeholder: "Prateleira A3"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.codigo || !f.nome
  }, "Salvar")));
}

/* ==========================================================
   D. DEPARTAMENTOS
========================================================== */
function Departamentos({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  function save(dep) {
    update(d => {
      if (dep.id) {
        d.departamentos = d.departamentos.map(x => x.id === dep.id ? dep : x);
      } else {
        d.departamentos.push({
          ...dep,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    const emUso = db.etapasProducao.filter(e => e.departamentoId === id).length;
    const msg = emUso ? `Este departamento está vinculado a ${emUso} etapa(s) de produção. Excluir mesmo assim? As etapas ficarão sem departamento.` : 'Excluir este departamento?';
    if (!confirm(msg)) return;
    update(d => {
      d.departamentos = d.departamentos.filter(x => x.id !== id);
      d.etapasProducao = d.etapasProducao.map(e => e.departamentoId === id ? {
        ...e,
        departamentoId: ''
      } : e);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Departamentos"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo departamento")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, db.departamentos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum departamento cadastrado. Ex: Corte, Costura, Silk, Revisão, Embalagem."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Responsável"), /*#__PURE__*/React.createElement("th", null, "Descrição"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Colaboradores"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Média salarial"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Etapas vinculadas"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, db.departamentos.map(dep => {
    const qtdEtapas = db.etapasProducao.filter(e => e.departamentoId === dep.id).length;
    const qtdColab = db.colaboradores.filter(c => c.departamentoId === dep.id && c.status !== 'Inativo').length;
    const media = mediaSalarialDepartamento(db, dep.id);
    return /*#__PURE__*/React.createElement("tr", {
      key: dep.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, dep.nome)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, dep.responsavel), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, dep.descricao), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, qtdColab), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, media === null ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "—") : money(media)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, qtdEtapas), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(dep)
    }, "Editar"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(dep.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(DepartamentoModal, {
    dep: modal,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function DepartamentoModal({
  dep,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    nome: '',
    responsavel: '',
    descricao: '',
    ...dep
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: dep.id ? 'Editar departamento' : 'Novo departamento',
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nome"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value),
    placeholder: "Corte"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Responsável"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.responsavel,
    onChange: e => set('responsavel', e.target.value)
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Descrição"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.descricao,
    onChange: e => set('descricao', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome
  }, "Salvar")));
}

/* ==========================================================
   T. ETAPAS DE PRODUÇÃO & TEMPOS
========================================================== */
function EtapasProducao({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  function save(et) {
    update(d => {
      if (et.id) {
        d.etapasProducao = d.etapasProducao.map(x => x.id === et.id ? et : x);
      } else {
        d.etapasProducao.push({
          ...et,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir esta etapa de produção? Ela deixará de entrar nas novas Ordens de Produção e no cálculo de custo.')) return;
    update(d => {
      d.etapasProducao = d.etapasProducao.filter(x => x.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Etapas de produção & tempos"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({}),
    disabled: db.departamentos.length === 0
  }, "+ Nova etapa")), db.departamentos.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      marginBottom: 16
    }
  }, "Cadastre ao menos um departamento antes de criar etapas de produção."), db.etapasProducao.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma etapa de produção cadastrada. Ex: Corte, Costura, Revisão — cada uma vinculada a um departamento, com seu tempo de produção."
  }) : (() => {
    // agrupa as etapas por departamento
    const grupos = [];
    const porDep = {};
    db.etapasProducao.forEach(et => {
      const k = et.departamentoId || '_sem';
      if (!porDep[k]) {
        porDep[k] = {
          dep: db.departamentos.find(d => d.id === et.departamentoId),
          itens: []
        };
        grupos.push({
          k,
          ...porDep[k]
        });
      }
      porDep[k].itens.push(et);
    });
    return grupos.map(g => {
      const itens = porDep[g.k].itens;
      let somaMin = 0,
        temVariavel = false,
        somaCusto = 0;
      itens.forEach(et => {
        if (et.modoTempo === 'peca' || num(et.tamanhoLote) > 0) somaMin += cargaEtapaMinutos(et, 1, 1);else temVariavel = true;
        const c = custoMaoDeObraPorPeca(et, db);
        if (c !== null) somaCusto += c;
      });
      return /*#__PURE__*/React.createElement("div", {
        key: g.k,
        style: {
          marginBottom: 18
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '0 0 8px 0',
          flexWrap: 'wrap'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 6,
          height: 18,
          background: 'var(--thread)',
          borderRadius: 3
        }
      }), /*#__PURE__*/React.createElement("h3", {
        style: {
          margin: 0
        }
      }, g.dep ? g.dep.nome : 'Sem departamento'), /*#__PURE__*/React.createElement("span", {
        className: "small muted"
      }, itens.length, " etapa", itens.length > 1 ? 's' : '', " · ", somaMin.toFixed(2), " min/peça", temVariavel && ' (+ variáveis)', " · ", /*#__PURE__*/React.createElement("strong", null, money(somaCusto)), "/peça", (() => {
        const md = mediaSalarialDepartamento(db, g.k === '_sem' ? '' : g.dep && g.dep.id);
        return md === null ? /*#__PURE__*/React.createElement("span", {
          style: {
            color: 'var(--bad)'
          }
        }, " · sem base salarial") : /*#__PURE__*/React.createElement(React.Fragment, null, " · média salarial ", money(md));
      })())), /*#__PURE__*/React.createElement("div", {
        className: "panel",
        style: {
          padding: 0,
          marginBottom: 0
        }
      }, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
        style: {
          width: 30
        }
      }, "#"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", {
        className: "num"
      }, "Tempo"), /*#__PURE__*/React.createElement("th", {
        className: "num"
      }, "Min/peça"), /*#__PURE__*/React.createElement("th", {
        className: "num"
      }, "Custo/min"), /*#__PURE__*/React.createElement("th", {
        className: "num"
      }, "Custo da etapa"), /*#__PURE__*/React.createElement("th", {
        style: {
          width: 150
        }
      }))), /*#__PURE__*/React.createElement("tbody", null, itens.map((et, i) => {
        const custo = custoMaoDeObraPorPeca(et, db);
        const cMin = custoPorMinutoDepartamento(db, et.departamentoId);
        const mPeca = et.modoTempo === 'peca' || num(et.tamanhoLote) > 0 ? cargaEtapaMinutos(et, 1, 1) : null;
        return /*#__PURE__*/React.createElement("tr", {
          key: et.id
        }, /*#__PURE__*/React.createElement("td", {
          className: "small muted"
        }, i + 1), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, et.nome)), /*#__PURE__*/React.createElement("td", {
          className: "num small"
        }, labelModoTempo(et)), /*#__PURE__*/React.createElement("td", {
          className: "num small"
        }, mPeca !== null ? mPeca.toFixed(3) : /*#__PURE__*/React.createElement("span", {
          className: "muted"
        }, "informe o lote"), et.modoTempo !== 'peca' && num(et.tamanhoLote) > 0 && /*#__PURE__*/React.createElement("div", {
          className: "muted",
          style: {
            fontSize: 10
          }
        }, "lote ", num(et.tamanhoLote), " pçs")), /*#__PURE__*/React.createElement("td", {
          className: "num small"
        }, cMin === null ? /*#__PURE__*/React.createElement("span", {
          className: "muted"
        }, "—") : money(cMin)), /*#__PURE__*/React.createElement("td", {
          className: "num small"
        }, /*#__PURE__*/React.createElement("strong", null, custo === null ? /*#__PURE__*/React.createElement("span", {
          className: "muted"
        }, et.modoTempo === 'peca' ? 'sem equipe no depto.' : 'informe o lote') : money(custo))), /*#__PURE__*/React.createElement("td", {
          className: "row-actions"
        }, /*#__PURE__*/React.createElement("button", {
          className: "btn ghost sm",
          onClick: () => setModal(et)
        }, "Editar"), /*#__PURE__*/React.createElement("button", {
          className: "btn danger sm",
          onClick: () => remove(et.id)
        }, "Excluir")));
      })))));
    });
  })(), modal !== null && /*#__PURE__*/React.createElement(EtapaProducaoModal, {
    et: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function EtapaProducaoModal({
  et,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    nome: '',
    departamentoId: db.departamentos[0]?.id || '',
    modoTempo: 'peca',
    tempoProducao: 0,
    unidadeTempo: 'seg',
    tamanhoEquipe: '',
    tamanhoLote: '',
    ...et
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));

  // equipamentos do departamento — apenas informativo; a máquina é escolhida na OP
  const maquinasDoDepto = (db.equipamentos || []).filter(q => q.departamentoId === f.departamentoId && (q.status || 'Operando') !== 'Baixado');
  const depNome = (db.departamentos.find(d => d.id === f.departamentoId) || {}).nome || '';
  return /*#__PURE__*/React.createElement(Modal, {
    title: et.id ? 'Editar etapa de produção' : 'Nova etapa de produção',
    onClose: onClose
  }, /*#__PURE__*/React.createElement(Field, {
    label: "1. Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.departamentoId,
    onChange: e => set('departamentoId', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— selecione —"), db.departamentos.map(dep => /*#__PURE__*/React.createElement("option", {
    key: dep.id,
    value: dep.id
  }, dep.nome)))), maquinasDoDepto.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: -8,
      marginBottom: 12
    }
  }, "Equipamentos disponíveis em ", depNome, ": ", maquinasDoDepto.map(q => `${q.codigo} · ${q.nome}`).join(' | '), ". A máquina é escolhida na Ordem de Produção."), /*#__PURE__*/React.createElement(Field, {
    label: "2. Nome da etapa"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value),
    placeholder: "Chulear bolso, Viés de barra, Presponto…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Como o tempo é medido"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (f.modoTempo === 'peca' ? 'accent' : 'ghost'),
    onClick: () => set('modoTempo', 'peca')
  }, "Por peça"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (f.modoTempo === 'lote' ? 'accent' : 'ghost'),
    onClick: () => set('modoTempo', 'lote')
  }, "Por lote"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (f.modoTempo === 'equipe' ? 'accent' : 'ghost'),
    onClick: () => set('modoTempo', 'equipe')
  }, "Por equipe"))), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: f.modoTempo === 'peca' ? '3. Tempo da peça' : f.modoTempo === 'lote' ? '3. Tempo para a OP inteira' : '3. Tempo do ciclo da equipe'
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.tempoProducao,
    onChange: e => set('tempoProducao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "4. Unidade de tempo"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.unidadeTempo,
    onChange: e => set('unidadeTempo', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "seg"
  }, "segundos"), /*#__PURE__*/React.createElement("option", {
    value: "min"
  }, "minutos"), /*#__PURE__*/React.createElement("option", {
    value: "hora"
  }, "horas"))), (f.modoTempo === 'lote' || f.modoTempo === 'equipe') && /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade de peças do lote"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "1",
    min: "1",
    value: f.tamanhoLote,
    onChange: e => set('tamanhoLote', e.target.value),
    placeholder: "Ex: 50"
  })), f.modoTempo === 'equipe' && /*#__PURE__*/React.createElement(Field, {
    label: "Nº de colaboradores na equipe"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "1",
    value: f.tamanhoEquipe,
    onChange: e => set('tamanhoEquipe', e.target.value),
    placeholder: "Ex: 4"
  }))), (f.modoTempo === 'lote' || f.modoTempo === 'equipe') && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: -6,
      marginBottom: 14
    }
  }, num(f.tamanhoLote) > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, "O tempo informado produz ", /*#__PURE__*/React.createElement("strong", null, num(f.tamanhoLote)), " peças", ' ', "— equivale a ", /*#__PURE__*/React.createElement("strong", null, cargaEtapaMinutos(f, 1, 1).toFixed(3), " min por peça"), ".", ' ', "Uma OP de 500 peças levaria ", minParaHHMM(cargaEtapaMinutos(f, 500, 500)), ".") : /*#__PURE__*/React.createElement(React.Fragment, null, "Sem a quantidade do lote, o sistema assume que o tempo cobre a quantidade inteira de cada Ordem de Produção.")), (() => {
    // custo da etapa calculado pelo custo médio de mão de obra do departamento
    const equipe = db.colaboradores.filter(c => c.departamentoId === f.departamentoId && c.status !== 'Inativo' && num(c.salario) > 0);
    const media = mediaSalarialDepartamento(db, f.departamentoId);
    const custoMin = custoPorMinutoDepartamento(db, f.departamentoId);
    const lote = num(f.tamanhoLote);
    const porLote = f.modoTempo === 'lote' || f.modoTempo === 'equipe';
    const temBase = f.modoTempo === 'peca' || lote > 0;
    const minPeca = temBase ? cargaEtapaMinutos(f, 1, 1) : null;
    const pessoas = f.modoTempo === 'equipe' ? Math.max(num(f.tamanhoEquipe), 1) : 1;
    const custoPeca = custoMin !== null && minPeca !== null ? custoMin * minPeca * pessoas : null;
    const minLote = custoMin !== null && lote > 0 ? cargaEtapaMinutos(f, lote, lote) : null;
    const custoLote = minLote !== null ? custoMin * minLote * pessoas : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        background: '#fff',
        marginBottom: 14
      }
    }, /*#__PURE__*/React.createElement("h3", null, "Custo da etapa — base: custo médio de mão de obra"), !f.departamentoId ? /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, "Selecione o departamento para calcular o custo.") : media === null ? /*#__PURE__*/React.createElement("div", {
      className: "small",
      style: {
        color: 'var(--bad)'
      }
    }, depNome ? `O departamento ${depNome} não tem colaboradores ativos com salário cadastrado.` : 'Departamento sem equipe cadastrada.', ' ', "Sem essa base não é possível calcular o custo da etapa.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Colaboradores considerados"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, equipe.length, " em ", depNome)), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Custo médio de mão de obra (mensal)"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(media))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Custo por hora (", HORAS_MES_PADRAO, "h/mês)"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(media / HORAS_MES_PADRAO))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Custo por minuto"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(custoMin))), porLote && lote > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tempo do lote"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, minLote !== null ? `${minParaHHMM(minLote)} para ${lote} peças` : '—')), custoLote !== null && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Custo do lote inteiro"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(custoLote))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Diluição por peça"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, minLote !== null ? `${money(custoLote)} ÷ ${lote} peças` : '—'))), f.modoTempo === 'equipe' && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Pessoas na equipe (multiplica o custo)"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, "× ", pessoas)), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tempo por peça"), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, minPeca !== null ? `${minPeca.toFixed(3)} min` : 'informe a quantidade do lote')), /*#__PURE__*/React.createElement("tr", {
      style: {
        background: 'var(--ok-bg)'
      }
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, "Custo da etapa por peça")), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", {
      style: {
        color: 'var(--ok)'
      }
    }, custoPeca !== null ? money(custoPeca) : 'informe a quantidade do lote'))))), custoPeca !== null && /*#__PURE__*/React.createElement("div", {
      className: "small muted",
      style: {
        marginTop: 8
      }
    }, "Referência: ", money(custoPeca * 100), " a cada 100 peças · ", money(custoPeca * 1000), " a cada 1.000 peças. O valor é recalculado sozinho quando a média salarial do departamento muda.")));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome || !f.departamentoId
  }, "Salvar")));
}
function EnderecoFields({
  f,
  set
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "CEP"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.cep,
    onChange: e => set('cep', e.target.value),
    placeholder: "00000-000"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Endereço"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.endereco,
    onChange: e => set('endereco', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Número"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.numero,
    onChange: e => set('numero', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Complemento"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.complemento,
    onChange: e => set('complemento', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Bairro"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.bairro,
    onChange: e => set('bairro', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Cidade"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.cidade,
    onChange: e => set('cidade', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "UF"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.uf,
    onChange: e => set('uf', e.target.value.toUpperCase().slice(0, 2)),
    maxLength: "2"
  })));
}
const ENDERECO_VAZIO = {
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: ''
};

/* ==========================================================
   RH. COLABORADORES
========================================================== */
function Colaboradores({
  db,
  update,
  usuario
}) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState('');
  const list = db.colaboradores.filter(c => {
    const s = q.toLowerCase();
    return !s || c.nome.toLowerCase().includes(s) || funcoesColaborador(c).some(fn => fn.toLowerCase().includes(s));
  });
  const CAMPOS_COLAB = [{
    key: 'nome',
    label: 'nome'
  }, {
    key: 'cpf',
    label: 'CPF'
  }, {
    key: 'rg',
    label: 'RG'
  }];
  function save(c) {
    if (!exigirPermissao(usuario, 'pessoas', update, 'criar ou alterar colaboradores')) return;
    const erro = checarDuplicidade(db.colaboradores, c, CAMPOS_COLAB);
    if (erro) {
      alert(erro);
      return;
    }
    // só administrador concede perfil de administrador
    if (c.perfil === 'Administrador' && !podeExecutar(usuario, 'admin')) {
      alert('Apenas um administrador pode conceder o perfil de Administrador.');
      return;
    }
    update(d => {
      if (c.id) {
        const antes = d.colaboradores.find(x => x.id === c.id) || {};
        d.colaboradores = d.colaboradores.map(x => x.id === c.id ? c : x);
        const mudancas = [];
        if (antes.perfil !== c.perfil) mudancas.push(`perfil: ${antes.perfil || '—'} → ${c.perfil}`);
        if ((antes.senha || '') !== (c.senha || '')) mudancas.push(c.senha ? 'senha definida/alterada' : 'senha removida (acesso bloqueado)');
        if (antes.status !== c.status) mudancas.push(`status: ${antes.status || '—'} → ${c.status}`);
        registrarLog(d, usuario, 'Editou colaborador', `${c.nome}${mudancas.length ? ' — ' + mudancas.join('; ') : ''}`);
      } else {
        d.colaboradores.push({
          ...c,
          id: uid()
        });
        registrarLog(d, usuario, 'Cadastrou colaborador', `${c.nome} · perfil ${c.perfil}${c.senha ? '' : ' (sem senha — acesso bloqueado)'}`);
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!exigirPermissao(usuario, 'pessoas', update, 'excluir colaboradores')) return;
    const c = db.colaboradores.find(x => x.id === id);
    if (c && c.id === (usuario && usuario.id)) {
      alert('Você não pode excluir o próprio usuário.');
      return;
    }
    const admins = db.colaboradores.filter(x => x.perfil === 'Administrador' && x.status !== 'Inativo');
    if (c && c.perfil === 'Administrador' && admins.length <= 1) {
      alert('Este é o único administrador ativo. Cadastre outro antes de excluí-lo.');
      return;
    }
    if (!confirm('Excluir este colaborador? O histórico de produção dele será mantido.')) return;
    update(d => {
      d.colaboradores = d.colaboradores.filter(x => x.id !== id);
      registrarLog(d, usuario, 'Excluiu colaborador', c ? c.nome : '');
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Colaboradores"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo colaborador")), /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por nome ou função…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum colaborador cadastrado."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Funções"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Admissão"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Salário"), /*#__PURE__*/React.createElement("th", null, "Perfil"), /*#__PURE__*/React.createElement("th", null, "Acesso"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.map(c => {
    const dep = db.departamentos.find(d => d.id === c.departamentoId);
    const temSenha = temSenhaDefinida(c);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, c.nome), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, c.celular || c.telefone)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, funcoesColaborador(c).join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, dep ? dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.dataAdmissao)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(c.salario)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, c.perfil || 'Colaborador'), /*#__PURE__*/React.createElement("td", null, temSenha ? /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Liberado") : /*#__PURE__*/React.createElement(Badge, {
      tone: "bad"
    }, "Bloqueado")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: c.status === 'Inativo' ? 'idle' : 'ok'
    }, c.status || 'Ativo')), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(c)
    }, "Editar"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(c.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(ColaboradorModal, {
    col: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function ColaboradorModal({
  col,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    nome: '',
    cpf: '',
    rg: '',
    dataNascimento: '',
    telefone: '',
    celular: '',
    email: '',
    cargo: '',
    funcoes: [],
    departamentoId: '',
    dataAdmissao: todayISO(),
    salario: 0,
    status: 'Ativo',
    perfil: 'Colaborador',
    ...ENDERECO_VAZIO,
    observacoes: '',
    ...col
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  const [novaFuncao, setNovaFuncao] = useState('');
  const listaFuncoes = funcoesColaborador(f);
  const sugestoesFuncao = Array.from(new Set(['Vendedor', 'Costureira', 'Costureiro', 'Cortador', 'Enfestador', 'Gravador', 'Revisor', 'Embalador', 'Auxiliar', 'Supervisor', 'Mecânico', ...db.colaboradores.flatMap(c => funcoesColaborador(c))])).sort();
  function addFuncao() {
    const v = novaFuncao.trim();
    if (!v) return;
    if (listaFuncoes.some(x => normaliza(x) === normaliza(v))) {
      setNovaFuncao('');
      return;
    }
    setF(prev => ({
      ...prev,
      funcoes: [...funcoesColaborador(prev), v],
      cargo: ''
    }));
    setNovaFuncao('');
  }
  function rmFuncao(nome) {
    setF(prev => ({
      ...prev,
      funcoes: funcoesColaborador(prev).filter(x => x !== nome),
      cargo: ''
    }));
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: col.id ? 'Editar colaborador' : 'Novo colaborador',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Nome completo"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "CPF"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.cpf,
    onChange: e => set('cpf', e.target.value),
    placeholder: "000.000.000-00"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "RG"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.rg,
    onChange: e => set('rg', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data de nascimento"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.dataNascimento,
    onChange: e => set('dataNascimento', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Telefone"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.telefone,
    onChange: e => set('telefone', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Celular / WhatsApp"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.celular,
    onChange: e => set('celular', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "E-mail"
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: f.email,
    onChange: e => set('email', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Funções (pode ter mais de uma)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: novaFuncao,
    onChange: e => setNovaFuncao(e.target.value),
    list: "funcoes-sugeridas",
    placeholder: "Costureira, Cortador, Vendedor…",
    onKeyDown: e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFuncao();
      }
    }
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "funcoes-sugeridas"
  }, sugestoesFuncao.map(x => /*#__PURE__*/React.createElement("option", {
    key: x,
    value: x
  }))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn accent sm",
    onClick: addFuncao,
    disabled: !novaFuncao.trim()
  }, "+")), listaFuncoes.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 6
    }
  }, listaFuncoes.map(fn => /*#__PURE__*/React.createElement("span", {
    key: fn,
    className: "chip-col"
  }, fn, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => rmFuncao(fn)
  }, "×")))), listaFuncoes.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 4
    }
  }, "Nenhuma função definida.")), /*#__PURE__*/React.createElement(Field, {
    label: "Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.departamentoId,
    onChange: e => set('departamentoId', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), db.departamentos.map(dep => /*#__PURE__*/React.createElement("option", {
    key: dep.id,
    value: dep.id
  }, dep.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Data de admissão"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.dataAdmissao,
    onChange: e => set('dataAdmissao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Salário mensal (R$)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.salario,
    onChange: e => set('salario', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Status"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.status,
    onChange: e => set('status', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "Ativo"
  }, "Ativo"), /*#__PURE__*/React.createElement("option", {
    value: "Inativo"
  }, "Inativo")))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Acesso ao sistema"), /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Perfil de acesso"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.perfil,
    onChange: e => set('perfil', e.target.value)
  }, PERFIS.map(p => /*#__PURE__*/React.createElement("option", {
    key: p,
    value: p
  }, p)))), /*#__PURE__*/React.createElement(Field, {
    label: "Senha"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      flex: 1
    }
  }, temSenhaDefinida(f) ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ok)',
      fontWeight: 600
    }
  }, "definida"), f.senhaDefinidaEm && /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, " em ", f.senhaDefinidaEm)) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--bad)',
      fontWeight: 600
    }
  }, "não definida — acesso bloqueado")), temSenhaDefinida(f) && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: () => {
      if (!confirm('Redefinir a senha deste colaborador? Ele terá de criar uma nova no próximo acesso.')) return;
      setF(prev => ({
        ...prev,
        senhaHash: undefined,
        senhaSalt: undefined,
        senha: undefined,
        precisaTrocarSenha: true,
        tentativasFalhas: 0,
        bloqueadoAte: null
      }));
    }
  }, "Redefinir")))), /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, f.perfil === 'Administrador' && 'Administrador: acesso total ao sistema.', f.perfil === 'Gestor' && 'Gestor: acesso restrito — não vê cadastros de colaboradores/clientes nem dados financeiros.', f.perfil === 'Colaborador' && 'Colaborador: acesso somente ao módulo de Produção.', !temSenhaDefinida(f) && ' · O colaborador define a própria senha no primeiro acesso; ela nunca é digitada aqui.')), /*#__PURE__*/React.createElement(EnderecoFields, {
    f: f,
    set: set
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Observações"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacoes,
    onChange: e => set('observacoes', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome
  }, "Salvar")));
}

/* ==========================================================
   EQ. EQUIPAMENTOS
========================================================== */
const STATUS_EQUIP = ['Operando', 'Em manutenção', 'Parado', 'Baixado'];
function Equipamentos({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [q, setQ] = useState('');
  const [fDep, setFDep] = useState('');
  const [fStatus, setFStatus] = useState('');
  const lista = (db.equipamentos || []).filter(e => {
    const s = q.toLowerCase();
    if (s && !(e.nome || '').toLowerCase().includes(s) && !(e.codigo || '').toLowerCase().includes(s) && !(e.numeroSerie || '').toLowerCase().includes(s) && !(e.marca || '').toLowerCase().includes(s)) return false;
    if (fDep && e.departamentoId !== fDep) return false;
    if (fStatus && (e.status || 'Operando') !== fStatus) return false;
    return true;
  });
  function save(eq) {
    const erro = checarDuplicidade(db.equipamentos || [], eq, [{
      key: 'codigo',
      label: 'código'
    }, {
      key: 'numeroSerie',
      label: 'número de série'
    }]);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (eq.id) {
        d.equipamentos = d.equipamentos.map(x => x.id === eq.id ? eq : x);
      } else {
        d.equipamentos = [...(d.equipamentos || []), {
          ...eq,
          id: uid()
        }];
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este equipamento?')) return;
    update(d => {
      d.equipamentos = d.equipamentos.filter(x => x.id !== id);
      return d;
    });
  }
  const emManutencao = lista.filter(e => e.status === 'Em manutenção').length;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Equipamentos e máquinas"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo equipamento")), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Buscar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Nome, código, série ou marca…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: fDep,
    onChange: e => setFDep(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), db.departamentos.map(d => /*#__PURE__*/React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Situação"
  }, /*#__PURE__*/React.createElement("select", {
    value: fStatus,
    onChange: e => setFStatus(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), STATUS_EQUIP.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st))))), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      setQ('');
      setFDep('');
      setFStatus('');
    }
  }, "Limpar filtros")), emManutencao > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: 'var(--warn)',
      background: 'var(--warn-bg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      color: 'var(--warn)',
      fontWeight: 600
    }
  }, "⚠ ", emManutencao, " equipamento(s) em manutenção.")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, lista.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum equipamento cadastrado. Ex: máquina reta, overlock, galoneira, prensa térmica."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Código"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Marca / Modelo"), /*#__PURE__*/React.createElement("th", null, "Nº de série"), /*#__PURE__*/React.createElement("th", null, "Aquisição"), /*#__PURE__*/React.createElement("th", null, "Próx. manutenção"), /*#__PURE__*/React.createElement("th", null, "Situação"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, lista.map(eq => {
    const dep = db.departamentos.find(d => d.id === eq.departamentoId);
    const st = eq.status || 'Operando';
    const tone = st === 'Operando' ? 'ok' : st === 'Em manutenção' ? 'warn' : st === 'Parado' ? 'bad' : 'idle';
    const atrasada = eq.proximaManutencao && eq.proximaManutencao < todayISO();
    return /*#__PURE__*/React.createElement("tr", {
      key: eq.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, /*#__PURE__*/React.createElement("strong", null, eq.codigo)), /*#__PURE__*/React.createElement("td", null, eq.nome), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, dep ? dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, [eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, eq.numeroSerie || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(eq.dataAquisicao)), /*#__PURE__*/React.createElement("td", {
      className: "small",
      style: atrasada ? {
        color: 'var(--bad)',
        fontWeight: 600
      } : {}
    }, fmtDate(eq.proximaManutencao), atrasada && ' ⚠'), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: tone
    }, st)), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(eq)
    }, "Editar"), /*#__PURE__*/React.createElement("button", {
      className: "btn accent sm",
      onClick: () => setHistorico(eq)
    }, "Histórico"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(eq.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(EquipamentoModal, {
    eq: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }), historico && /*#__PURE__*/React.createElement(HistoricoEquipamentoModal, {
    eq: historico,
    db: db,
    update: update,
    onClose: () => setHistorico(null)
  }));
}

/* ==========================================================
   FICHA DE HISTÓRICO DO EQUIPAMENTO
========================================================== */
function coletarUsoEquipamento(eq, db) {
  // percorre todas as OPs e recolhe as etapas executadas nesta máquina
  const usos = [];
  db.ops.forEach(op => {
    op.etapas.forEach(et => {
      if (et.equipamentoId !== eq.id) return;
      const qtdBase = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const cargaMin = cargaEtapaOP(et, qtdBase, op.quantidade, db);
      const pedido = db.pedidos.find(p => p.id === op.pedidoId);
      const produto = db.produtos.find(p => p.id === op.produtoId);
      const dep = db.departamentos.find(d => d.id === et.departamentoId);
      usos.push({
        op,
        opRotulo: rotuloOP(op),
        pedido,
        produto,
        dep,
        etapa: et,
        nomeEtapa: et.nome,
        operadores: responsaveisEtapa(et),
        qtd: qtdBase,
        produzido: num(et.qtdConcluida),
        cargaMin,
        data: et.dataInicio || '',
        dataFim: et.dataConclusao || '',
        status: et.status
      });
    });
  });
  return usos.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}
function HistoricoEquipamentoModal({
  eq,
  db,
  update,
  onClose
}) {
  const [aba, setAba] = useState('resumo');
  const usos = useMemo(() => coletarUsoEquipamento(eq, db), [eq, db]);
  const manutencoes = (eq.manutencoes || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const dep = db.departamentos.find(d => d.id === eq.departamentoId);
  const tempoTotal = usos.reduce((s, u) => s + u.cargaMin, 0);
  const pecasTotal = usos.reduce((s, u) => s + u.produzido, 0);
  const opsUnicas = Array.from(new Set(usos.map(u => u.opRotulo)));
  const custoManut = manutencoes.reduce((s, m) => s + num(m.custo), 0);

  // tempo de serviço por operador
  const porOperador = {};
  usos.forEach(u => {
    const lista = u.operadores.length ? u.operadores : ['(sem operador informado)'];
    const fatia = u.cargaMin / lista.length;
    lista.forEach(nome => {
      if (!porOperador[nome]) porOperador[nome] = {
        nome,
        min: 0,
        pecas: 0,
        etapas: new Set(),
        execucoes: 0
      };
      porOperador[nome].min += fatia;
      porOperador[nome].pecas += u.produzido / lista.length;
      porOperador[nome].etapas.add(u.nomeEtapa);
      porOperador[nome].execucoes += 1;
    });
  });
  const operadores = Object.values(porOperador).sort((a, b) => b.min - a.min);

  // fluxo de produção: etapas que passam por esta máquina
  const porEtapa = {};
  usos.forEach(u => {
    if (!porEtapa[u.nomeEtapa]) porEtapa[u.nomeEtapa] = {
      nome: u.nomeEtapa,
      dep: u.dep,
      min: 0,
      pecas: 0,
      execucoes: 0
    };
    porEtapa[u.nomeEtapa].min += u.cargaMin;
    porEtapa[u.nomeEtapa].pecas += u.produzido;
    porEtapa[u.nomeEtapa].execucoes += 1;
  });
  const etapas = Object.values(porEtapa).sort((a, b) => b.min - a.min);
  function addManutencao(m) {
    update(d => {
      d.equipamentos = d.equipamentos.map(x => x.id === eq.id ? {
        ...x,
        manutencoes: [...(x.manutencoes || []), {
          ...m,
          id: uid()
        }],
        ultimaManutencao: m.data || x.ultimaManutencao
      } : x);
      return d;
    });
  }
  function rmManutencao(id) {
    if (!confirm('Excluir este registro de manutenção?')) return;
    update(d => {
      d.equipamentos = d.equipamentos.map(x => x.id === eq.id ? {
        ...x,
        manutencoes: (x.manutencoes || []).filter(m => m.id !== id)
      } : x);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Histórico — ${eq.codigo} · ${eq.nome}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / salvar como PDF")), /*#__PURE__*/React.createElement(SubTabs, {
    active: aba,
    onChange: setAba,
    tabs: [{
      id: 'resumo',
      label: 'Resumo'
    }, {
      id: 'fluxo',
      label: `Fluxo de produção (${etapas.length})`
    }, {
      id: 'operadores',
      label: `Operadores (${operadores.length})`
    }, {
      id: 'ops',
      label: `Ordens de produção (${opsUnicas.length})`
    }, {
      id: 'manutencao',
      label: `Peças trocadas (${manutencoes.length})`
    }]
  }), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, aba === 'resumo' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h2", null, "Ficha do Equipamento"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, eq.codigo, " · ", eq.nome, " · Emitida em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tipo"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, eq.tipo || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Departamento"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, dep ? dep.nome : '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Situação"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, eq.status || 'Operando')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Localização"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, eq.localizacao || '—'))), /*#__PURE__*/React.createElement("h4", null, "Identificação"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Marca / Modelo"), /*#__PURE__*/React.createElement("td", null, [eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—')), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Número de série"), /*#__PURE__*/React.createElement("td", null, eq.numeroSerie || '—')), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Patrimônio"), /*#__PURE__*/React.createElement("td", null, eq.patrimonio || '—')), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Aquisição"), /*#__PURE__*/React.createElement("td", null, fmtDate(eq.dataAquisicao), " ", num(eq.valorAquisicao) > 0 && `· ${money(eq.valorAquisicao)}`)), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Fornecedor"), /*#__PURE__*/React.createElement("td", null, eq.fornecedor || '—')), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Última manutenção"), /*#__PURE__*/React.createElement("td", null, fmtDate(eq.ultimaManutencao))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Próxima manutenção"), /*#__PURE__*/React.createElement("td", null, fmtDate(eq.proximaManutencao))))), /*#__PURE__*/React.createElement("h4", null, "Utilização acumulada"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Tempo total de máquina"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, minParaHHMM(tempoTotal)), " (", (tempoTotal / 60).toFixed(1), " h)")), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Peças produzidas"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, Math.round(pecasTotal)))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Ordens de produção atendidas"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, opsUnicas.length))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Etapas distintas executadas"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, etapas.length))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Operadores distintos"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, operadores.length))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Registros de manutenção"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, manutencoes.length), custoManut > 0 && ` · ${money(custoManut)}`)))), eq.observacoes && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Observações"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, eq.observacoes))), aba === 'fluxo' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Fluxo de produção nesta máquina"), etapas.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Esta máquina ainda não foi alocada em nenhuma etapa de OP."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Execuções"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Peças"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tempo de máquina"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "% do uso"))), /*#__PURE__*/React.createElement("tbody", null, etapas.map((e, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, e.nome)), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, e.dep ? e.dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, e.execucoes), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, Math.round(e.pecas)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, minParaHHMM(e.min)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, tempoTotal > 0 ? Math.round(e.min / tempoTotal * 100) : 0, "%")))))), aba === 'operadores' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Quem operou o equipamento"), operadores.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum operador registrado ainda."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Operador"), /*#__PURE__*/React.createElement("th", null, "Etapas executadas"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Execuções"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Peças"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tempo de serviço"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "% do uso"))), /*#__PURE__*/React.createElement("tbody", null, operadores.map((o, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, o.nome)), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, Array.from(o.etapas).join(', ')), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, o.execucoes), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, Math.round(o.pecas)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, minParaHHMM(o.min)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, tempoTotal > 0 ? Math.round(o.min / tempoTotal * 100) : 0, "%")))))), aba === 'ops' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Ordens de produção que passaram por esta máquina"), usos.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma OP registrada para esta máquina."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Data"), /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Operador(es)"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tempo"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, usos.map((u, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, fmtDate(u.data)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, /*#__PURE__*/React.createElement("strong", null, u.opRotulo)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, u.pedido ? u.pedido.cliente : '—'), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, u.produto ? u.produto.nome : '—'), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, u.nomeEtapa), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, u.operadores.join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, u.produzido, "/", u.qtd), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, minParaHHMM(u.cargaMin)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, u.status)))))), aba === 'manutencao' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Manutenções e peças trocadas"), manutencoes.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma manutenção registrada."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Data"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "Peças trocadas"), /*#__PURE__*/React.createElement("th", null, "Serviço executado"), /*#__PURE__*/React.createElement("th", null, "Responsável"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Parada"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, manutencoes.map(m => /*#__PURE__*/React.createElement("tr", {
    key: m.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, fmtDate(m.data)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    tone: m.tipo === 'Corretiva' ? 'bad' : m.tipo === 'Preventiva' ? 'ok' : 'info'
  }, m.tipo)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, m.pecas || '—'), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, m.servico || '—'), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, m.responsavel || '—'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(m.custo)), /*#__PURE__*/React.createElement("td", {
    className: "num small"
  }, num(m.horasParada) > 0 ? `${m.horasParada} h` : '—'), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => rmManutencao(m.id)
  }, "Excluir")))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "5",
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Custo total")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(custoManut))), /*#__PURE__*/React.createElement("td", {
    colSpan: "2"
  })))))), aba === 'manutencao' && /*#__PURE__*/React.createElement(NovaManutencao, {
    db: db,
    onAdd: addManutencao
  }), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar")));
}
function NovaManutencao({
  db,
  onAdd
}) {
  const vazio = {
    data: todayISO(),
    tipo: 'Preventiva',
    pecas: '',
    servico: '',
    responsavel: '',
    custo: 0,
    horasParada: 0
  };
  const [f, setF] = useState(vazio);
  const set = (k, v) => setF(p => ({
    ...p,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      background: '#fff',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Registrar manutenção / troca de peça"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.data,
    onChange: e => set('data', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Tipo"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.tipo,
    onChange: e => set('tipo', e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "Preventiva"), /*#__PURE__*/React.createElement("option", null, "Corretiva"), /*#__PURE__*/React.createElement("option", null, "Ajuste / Regulagem"))), /*#__PURE__*/React.createElement(Field, {
    label: "Responsável / Técnico"
  }, /*#__PURE__*/React.createElement("input", {
    list: "tecnicos-manut",
    value: f.responsavel,
    onChange: e => set('responsavel', e.target.value)
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "tecnicos-manut"
  }, db.colaboradores.filter(c => c.status !== 'Inativo').map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.nome
  })), db.fornecedores.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.nome
  })))), /*#__PURE__*/React.createElement(Field, {
    label: "Custo (R$)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.custo,
    onChange: e => set('custo', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Horas de parada"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.5",
    value: f.horasParada,
    onChange: e => set('horasParada', e.target.value)
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Peças trocadas"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.pecas,
    onChange: e => set('pecas', e.target.value),
    placeholder: "Agulha, correia, motor, lançadeira…"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Serviço executado"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.servico,
    onChange: e => set('servico', e.target.value)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => {
      onAdd(f);
      setF(vazio);
    },
    disabled: !f.data || !f.pecas.trim() && !f.servico.trim()
  }, "+ Registrar"));
}
function EquipamentoModal({
  eq,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    codigo: '',
    nome: '',
    tipo: '',
    departamentoId: '',
    marca: '',
    modelo: '',
    numeroSerie: '',
    patrimonio: '',
    dataAquisicao: '',
    valorAquisicao: 0,
    fornecedorId: '',
    fornecedor: '',
    localizacao: '',
    ultimaManutencao: '',
    proximaManutencao: '',
    status: 'Operando',
    observacoes: '',
    manutencoes: [],
    ...eq
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: eq.id ? 'Editar equipamento' : 'Novo equipamento',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Código"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.codigo,
    onChange: e => set('codigo', e.target.value),
    placeholder: "EQ-001"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nome do equipamento"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value),
    placeholder: "Máquina Overlock"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Tipo"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.tipo,
    onChange: e => set('tipo', e.target.value),
    placeholder: "Costura / Corte / Gravação"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.departamentoId,
    onChange: e => set('departamentoId', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), db.departamentos.map(d => /*#__PURE__*/React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Marca"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.marca,
    onChange: e => set('marca', e.target.value),
    placeholder: "Singer, Juki…"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Modelo"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.modelo,
    onChange: e => set('modelo', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Número de série"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.numeroSerie,
    onChange: e => set('numeroSerie', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nº de patrimônio"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.patrimonio,
    onChange: e => set('patrimonio', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Localização"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.localizacao,
    onChange: e => set('localizacao', e.target.value),
    placeholder: "Setor / posição na linha"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data de aquisição"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.dataAquisicao,
    onChange: e => set('dataAquisicao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Valor de aquisição (R$)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.valorAquisicao,
    onChange: e => set('valorAquisicao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fornecedor"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.fornecedorId || '',
    onChange: e => {
      const forn = db.fornecedores.find(x => x.id === e.target.value);
      setF(prev => ({
        ...prev,
        fornecedorId: e.target.value,
        fornecedor: forn ? forn.nome : ''
      }));
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, f.fornecedor && !f.fornecedorId ? f.fornecedor : '—'), db.fornecedores.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Última manutenção"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.ultimaManutencao,
    onChange: e => set('ultimaManutencao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Próxima manutenção"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.proximaManutencao,
    onChange: e => set('proximaManutencao', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Situação"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.status,
    onChange: e => set('status', e.target.value)
  }, STATUS_EQUIP.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st))))), /*#__PURE__*/React.createElement(Field, {
    label: "Observações"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacoes,
    onChange: e => set('observacoes', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome || !f.codigo
  }, "Salvar")));
}

/* ==========================================================
   CL. CLIENTES
========================================================== */
function Clientes({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState('');
  const list = db.clientes.filter(c => {
    const s = q.toLowerCase();
    return !s || (c.nome || '').toLowerCase().includes(s) || (c.nomeFantasia || '').toLowerCase().includes(s) || (c.documento || '').includes(s);
  });
  const CAMPOS_CLI = [{
    key: 'nome',
    label: 'nome / razão social'
  }, {
    key: 'documento',
    label: 'CPF/CNPJ'
  }, {
    key: 'ie',
    label: 'inscrição estadual'
  }];
  function save(c) {
    const erro = checarDuplicidade(db.clientes, c, CAMPOS_CLI);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (c.id) {
        d.clientes = d.clientes.map(x => x.id === c.id ? c : x);
      } else {
        d.clientes.push({
          ...c,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este cliente?')) return;
    update(d => {
      d.clientes = d.clientes.filter(c => c.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Clientes"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo cliente")), /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por nome, fantasia ou CPF/CNPJ…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum cliente cadastrado."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome / Razão Social"), /*#__PURE__*/React.createElement("th", null, "Fantasia"), /*#__PURE__*/React.createElement("th", null, "CPF/CNPJ"), /*#__PURE__*/React.createElement("th", null, "Contato"), /*#__PURE__*/React.createElement("th", null, "Cidade/UF"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, c.nome), " ", /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, c.tipo === 'PJ' ? 'PJ' : 'PF')), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, c.nomeFantasia), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, c.documento), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, c.celular || c.telefone), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, c.cidade, c.uf ? `/${c.uf}` : ''), /*#__PURE__*/React.createElement("td", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setModal(c)
  }, "Editar"), /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => remove(c.id)
  }, "Excluir"))))))), modal !== null && /*#__PURE__*/React.createElement(ClienteModal, {
    cli: modal,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function ClienteModal({
  cli,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    tipo: 'PJ',
    nome: '',
    nomeFantasia: '',
    documento: '',
    ie: '',
    indicadorIE: 'Contribuinte',
    telefone: '',
    celular: '',
    responsavel: '',
    email: '',
    ...ENDERECO_VAZIO,
    observacoes: '',
    ...cli
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: cli.id ? 'Editar cliente' : 'Novo cliente',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Tipo"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (f.tipo === 'PJ' ? 'accent' : 'ghost'),
    onClick: () => set('tipo', 'PJ')
  }, "Pessoa Jurídica"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn sm " + (f.tipo === 'PF' ? 'accent' : 'ghost'),
    onClick: () => set('tipo', 'PF')
  }, "Pessoa Física"))), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: f.tipo === 'PJ' ? 'Razão Social' : 'Nome completo'
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value)
  })), f.tipo === 'PJ' && /*#__PURE__*/React.createElement(Field, {
    label: "Nome Fantasia"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nomeFantasia,
    onChange: e => set('nomeFantasia', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: f.tipo === 'PJ' ? 'CNPJ' : 'CPF'
  }, /*#__PURE__*/React.createElement("input", {
    value: f.documento,
    onChange: e => set('documento', e.target.value)
  })), f.tipo === 'PJ' && /*#__PURE__*/React.createElement(Field, {
    label: "Inscrição Estadual"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.ie,
    onChange: e => set('ie', e.target.value)
  })), f.tipo === 'PJ' && /*#__PURE__*/React.createElement(Field, {
    label: "Indicador da IE"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.indicadorIE,
    onChange: e => set('indicadorIE', e.target.value)
  }, /*#__PURE__*/React.createElement("option", null, "Contribuinte"), /*#__PURE__*/React.createElement("option", null, "Isento"), /*#__PURE__*/React.createElement("option", null, "Não contribuinte"))), /*#__PURE__*/React.createElement(Field, {
    label: "Telefone"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.telefone,
    onChange: e => set('telefone', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Celular / WhatsApp"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.celular,
    onChange: e => set('celular', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nome do responsável"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.responsavel,
    onChange: e => set('responsavel', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "E-mail"
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: f.email,
    onChange: e => set('email', e.target.value)
  }))), /*#__PURE__*/React.createElement(EnderecoFields, {
    f: f,
    set: set
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Observações"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacoes,
    onChange: e => set('observacoes', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome
  }, "Salvar")));
}

/* ==========================================================
   FO. FORNECEDORES
========================================================== */
function Fornecedores({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  const [q, setQ] = useState('');
  const list = db.fornecedores.filter(f => {
    const s = q.toLowerCase();
    return !s || (f.nome || '').toLowerCase().includes(s) || (f.nomeFantasia || '').toLowerCase().includes(s) || (f.categoria || '').toLowerCase().includes(s);
  });
  const CAMPOS_FORN = [{
    key: 'nome',
    label: 'nome / razão social'
  }, {
    key: 'documento',
    label: 'CNPJ/CPF'
  }, {
    key: 'ie',
    label: 'inscrição estadual'
  }];
  function save(f) {
    const erro = checarDuplicidade(db.fornecedores, f, CAMPOS_FORN);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (f.id) {
        d.fornecedores = d.fornecedores.map(x => x.id === f.id ? f : x);
      } else {
        d.fornecedores.push({
          ...f,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este fornecedor?')) return;
    update(d => {
      d.fornecedores = d.fornecedores.filter(f => f.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Fornecedores"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo fornecedor")), /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por nome, fantasia ou categoria…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum fornecedor cadastrado."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome / Razão Social"), /*#__PURE__*/React.createElement("th", null, "Fantasia"), /*#__PURE__*/React.createElement("th", null, "CNPJ/CPF"), /*#__PURE__*/React.createElement("th", null, "Categoria"), /*#__PURE__*/React.createElement("th", null, "Contato"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.map(f => /*#__PURE__*/React.createElement("tr", {
    key: f.id
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, f.nome)), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, f.nomeFantasia), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, f.documento), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, f.categoria), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, f.celular || f.telefone), /*#__PURE__*/React.createElement("td", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setModal(f)
  }, "Editar"), /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => remove(f.id)
  }, "Excluir"))))))), modal !== null && /*#__PURE__*/React.createElement(FornecedorModal, {
    forn: modal,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function FornecedorModal({
  forn,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    nome: '',
    nomeFantasia: '',
    documento: '',
    ie: '',
    telefone: '',
    celular: '',
    contato: '',
    email: '',
    categoria: '',
    condicaoPagamento: '',
    ...ENDERECO_VAZIO,
    observacoes: '',
    ...forn
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: forn.id ? 'Editar fornecedor' : 'Novo fornecedor',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Razão Social / Nome"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nome Fantasia"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.nomeFantasia,
    onChange: e => set('nomeFantasia', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "CNPJ/CPF"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.documento,
    onChange: e => set('documento', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Inscrição Estadual"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.ie,
    onChange: e => set('ie', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Telefone"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.telefone,
    onChange: e => set('telefone', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Celular / WhatsApp"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.celular,
    onChange: e => set('celular', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Nome do contato"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.contato,
    onChange: e => set('contato', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "E-mail"
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: f.email,
    onChange: e => set('email', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Categoria / O que fornece"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.categoria,
    onChange: e => set('categoria', e.target.value),
    placeholder: "Tecidos, aviamentos…"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Condição de pagamento"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.condicaoPagamento,
    onChange: e => set('condicaoPagamento', e.target.value),
    placeholder: "30/60 dias, à vista…"
  }))), /*#__PURE__*/React.createElement(EnderecoFields, {
    f: f,
    set: set
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Observações"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacoes,
    onChange: e => set('observacoes', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.nome
  }, "Salvar")));
}

/* ==========================================================
   2 & 3. PRODUTOS + FICHA TÉCNICA
========================================================== */
function Produtos({
  db,
  update,
  podeFin = true
}) {
  const [modal, setModal] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [q, setQ] = useState('');
  const list = db.produtos.filter(p => {
    const s = q.toLowerCase();
    return !s || p.nome.toLowerCase().includes(s) || p.codigo.toLowerCase().includes(s);
  });
  function save(p) {
    const erro = checarDuplicidade(db.produtos, p, [{
      key: 'codigo',
      label: 'código'
    }, {
      key: 'nome',
      label: 'nome'
    }]);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (p.id) {
        d.produtos = d.produtos.map(x => x.id === p.id ? p : x);
      } else {
        d.produtos.push({
          ...p,
          id: uid()
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este produto?')) return;
    update(d => {
      d.produtos = d.produtos.filter(p => p.id !== id);
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Produtos, ficha técnica & custo unitário"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({})
  }, "+ Novo produto")), /*#__PURE__*/React.createElement("div", {
    className: "searchbar"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por código ou nome…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), list.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum produto cadastrado ainda. Cadastre materiais primeiro para montar a ficha técnica."
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))',
      gap: 14
    }
  }, list.map(p => /*#__PURE__*/React.createElement("div", {
    className: "panel",
    key: p.id,
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("h3", null, p.nome, " ", /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, p.codigo)), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8
    }
  }, p.categoria, (() => {
    const t = db.materiais.find(m => m.id === p.tecidoId);
    return t ? ` · ${t.nome}` : '';
  })(), p.medidas ? ` · ${p.medidas}` : ''), p.observacoes && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8,
      fontStyle: 'italic'
    }
  }, p.observacoes), etapasDoProduto(p).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Etapas:"), " ", etapasDoProduto(p).map(x => {
    const et = (db.etapasProducao || []).find(e => e.id === x.etapaId);
    return et ? et.nome : null;
  }).filter(Boolean).join(' → ')), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Ficha técnica")), (p.fichaTecnica || []).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Sem materiais definidos") : /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: '0 0 10px 0',
      paddingLeft: 16
    }
  }, (p.fichaTecnica || []).map((it, i) => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    return /*#__PURE__*/React.createElement("li", {
      key: i,
      className: "small"
    }, it.quantidade, " ", mat ? mat.unidade : '', " de ", mat ? mat.nome : '(material removido)');
  })), /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => setModal(p)
  }, "Editar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => setFicha(p)
  }, "Ficha técnica"), /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => remove(p.id)
  }, "Excluir"))))), modal !== null && /*#__PURE__*/React.createElement(ProdutoModal, {
    produto: modal,
    db: db,
    update: update,
    onClose: () => setModal(null),
    onSave: save
  }), ficha && /*#__PURE__*/React.createElement(FichaTecnicaModal, {
    produto: ficha,
    db: db,
    podeFin: podeFin,
    onClose: () => setFicha(null)
  }));
}

/* ==========================================================
   FICHA TÉCNICA DO PRODUTO — visualização, impressão e PDF
========================================================== */
function FichaTecnicaModal({
  produto,
  db,
  podeFin = true,
  onClose
}) {
  const cat = (db.categoriasProduto || []).find(c => c.id === produto.categoriaId);
  const grupo = (db.gruposProduto || []).find(g => g.id === produto.grupoId);
  const sub = (db.subgruposProduto || []).find(sg => sg.id === produto.subgrupoId);
  const tecido = db.materiais.find(m => m.id === produto.tecidoId);
  const custo = custoUnitarioProduto(produto, db);
  const imagens = (produto.arquivos || []).filter(a => a.tipo === 'imagem');
  const documentos = (produto.arquivos || []).filter(a => a.tipo !== 'imagem');
  const materiais = (produto.fichaTecnica || []).map(it => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    const qtd = num(it.quantidade);
    const custoUnit = mat ? num(mat.custo) : 0;
    return {
      mat,
      qtd,
      custoUnit,
      total: qtd * custoUnit
    };
  });
  const totalMat = materiais.reduce((s, l) => s + l.total, 0);
  const doProd = etapasDoProduto(produto);
  const listaOper = doProd.length ? doProd.map(x => ({
    et: (db.etapasProducao || []).find(e => e.id === x.etapaId),
    equipamentoId: x.equipamentoId
  })).filter(x => x.et) : (db.etapasProducao || []).map(et => ({
    et,
    equipamentoId: ''
  }));
  const operacoes = listaOper.map(({
    et,
    equipamentoId
  }) => {
    const dep = db.departamentos.find(d => d.id === et.departamentoId);
    const maq = (db.equipamentos || []).find(q => q.id === equipamentoId);
    const c = custoMaoDeObraPorPeca(et, db);
    return {
      et,
      dep,
      maq,
      custo: c
    };
  });
  const totalMO = operacoes.reduce((s, o) => s + (o.custo || 0), 0);
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Ficha técnica — ${produto.nome}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / salvar como PDF")), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Ficha Técnica de Produto"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, "Confecção ERP · Emitida em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Código"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, produto.codigo)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Categoria"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, cat ? cat.nome : '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Grupo / Subgrupo"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, [grupo && grupo.nome, sub && sub.nome].filter(Boolean).join(' / ') || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Medida"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, produto.medidas || '—'))), imagens.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "ficha-hero"
  }, /*#__PURE__*/React.createElement("img", {
    src: imagens[0].url,
    alt: imagens[0].nome
  }), imagens.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "ficha-hero-mini"
  }, imagens.slice(1).map(a => /*#__PURE__*/React.createElement("img", {
    key: a.id,
    src: a.url,
    alt: a.nome
  })))), /*#__PURE__*/React.createElement("h4", null, "Descrição"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      marginBottom: 8
    }
  }, produto.nome), tecido && /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Tecido base: ", /*#__PURE__*/React.createElement("strong", null, tecido.codigo, " · ", tecido.nome)), produto.observacoes && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontSize: 12.5,
      borderLeft: '3px solid var(--thread)',
      paddingLeft: 10
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Observações:"), " ", produto.observacoes), /*#__PURE__*/React.createElement("h4", null, "Consumo de materiais"), materiais.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Nenhum material definido na ficha técnica.") : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Código"), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Consumo / peça"), podeFin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo unit."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo / peça")))), /*#__PURE__*/React.createElement("tbody", null, materiais.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, l.mat ? l.mat.codigo : '—'), /*#__PURE__*/React.createElement("td", null, l.mat ? l.mat.nome : '(material removido)'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, l.qtd, " ", l.mat ? l.mat.unidade : ''), podeFin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(l.custoUnit)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(l.total))))), podeFin && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "4",
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Total de materiais")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(totalMat)))))), /*#__PURE__*/React.createElement("h4", null, "Operações de produção"), operacoes.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Nenhuma etapa de produção cadastrada.") : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tempo"), podeFin && /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo M.O. / peça"))), /*#__PURE__*/React.createElement("tbody", null, operacoes.map((o, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", null, o.et.nome), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, o.dep ? o.dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, o.maq ? `${o.maq.codigo} · ${o.maq.nome}` : '—'), /*#__PURE__*/React.createElement("td", {
    className: "num small"
  }, labelModoTempo(o.et)), podeFin && /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, o.custo === null ? /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "variável") : money(o.custo)))), podeFin && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "4",
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Total de mão de obra")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(totalMO)))))), podeFin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Custo unitário de produção"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Materiais"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(custo.custoMat))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, "Mão de obra"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(custo.custoMO))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, "Custo total por peça")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(custo.total)))))), (custo.moVariavel || custo.moSemBase) && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 6
    }
  }, custo.moVariavel && 'Há etapas por lote/equipe cujo custo varia conforme a quantidade da OP. ', custo.moSemBase && 'Há departamentos sem colaboradores cadastrados (sem base salarial).')), documentos.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Documentos anexados"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: 18
    }
  }, documentos.map(a => /*#__PURE__*/React.createElement("li", {
    key: a.id,
    className: "small"
  }, a.nome)))), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, "Conferência técnica"), /*#__PURE__*/React.createElement("div", null, "Aprovação do cliente"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar")));
}
function ProdutoModal({
  produto,
  db,
  update,
  onClose,
  onSave
}) {
  const cats = db.categoriasProduto || [];
  const grupos = db.gruposProduto || [];
  const subgrupos = db.subgruposProduto || [];
  // tecidos disponíveis vêm do cadastro de materiais (categoria cujo nome contém "tecid" ou "malha")
  const tecidos = db.materiais.filter(m => {
    const cat = (db.categoriasMaterial || []).find(c => c.id === m.categoriaId);
    const alvo = normaliza(cat && cat.nome || '') + normaliza(m.categoria || '');
    return alvo.includes('tecid') || alvo.includes('malha');
  });
  const [f, setF] = useState({
    codigo: '',
    nome: '',
    categoriaId: '',
    grupoId: '',
    subgrupoId: '',
    tecidoId: '',
    categoria: '',
    medidas: '',
    observacoes: '',
    arquivos: [],
    fichaTecnica: [],
    ...produto,
    etapas: etapasDoProduto(produto || {})
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));

  // descrição = categoria + grupo + subgrupo + tipo de tecido + medida
  function montarDescricao(x) {
    const cat = (db.categoriasProduto || []).find(c => c.id === x.categoriaId);
    const g = (db.gruposProduto || []).find(y => y.id === x.grupoId);
    const sg = (db.subgruposProduto || []).find(y => y.id === x.subgrupoId);
    const tec = db.materiais.find(m => m.id === x.tecidoId);
    const base = [cat && cat.nome, g && g.nome, sg && sg.nome, tec && tec.nome, x.medidas].filter(v => v && String(v).trim()).join(' ');
    const obs = (x.observacoes || '').trim();
    return obs ? `${base} — ${obs}` : base; // observação entra como complemento informativo
  }

  // gera o código sequencial a partir de categoria + grupo + subgrupo
  function gerarCodigo(catId, grupoId, subId) {
    const cat = (db.categoriasProduto || []).find(c => c.id === catId);
    if (!cat) return '';
    const g = (db.gruposProduto || []).find(x => x.id === grupoId);
    const sg = (db.subgruposProduto || []).find(x => x.id === subId);
    const prefixo = [cat.codigo, g && g.codigo, sg && sg.codigo].filter(Boolean).join('.');
    return proximoSequencial(db.produtos, prefixo);
  }
  function setClassificacao(patch) {
    setF(prev => {
      const novo = {
        ...prev,
        ...patch
      };
      const cat = (db.categoriasProduto || []).find(c => c.id === novo.categoriaId);
      novo.categoria = cat ? cat.nome : '';
      if (!prev.id) novo.codigo = gerarCodigo(novo.categoriaId, novo.grupoId, novo.subgrupoId);
      novo.nome = montarDescricao(novo);
      return novo;
    });
  }

  // itens já escolhidos não podem ser reutilizados em outra linha
  const etapasUsadas = f.etapas.map(l => l.etapaId).filter(Boolean);
  const etapasDisponiveis = (db.etapasProducao || []).filter(x => !etapasUsadas.includes(x.id));
  const materiaisUsados = (f.fichaTecnica || []).map(x => x.materialId).filter(Boolean);
  const materiaisDisponiveis = db.materiais.filter(m => !materiaisUsados.includes(m.id));
  function addItemEtapa() {
    if ((db.etapasProducao || []).length === 0) {
      alert('Cadastre etapas de produção antes.');
      return;
    }
    if (etapasDisponiveis.length === 0) {
      alert('Todas as etapas cadastradas já foram adicionadas a este produto.');
      return;
    }
    set('etapas', [...f.etapas, {
      id: uid(),
      etapaId: etapasDisponiveis[0].id,
      equipamentoId: ''
    }]);
  }
  function updItemEtapa(i, patch) {
    const arr = f.etapas.slice();
    arr[i] = {
      ...arr[i],
      ...patch
    };
    set('etapas', arr);
  }
  function rmItemEtapa(i) {
    const arr = f.etapas.slice();
    arr.splice(i, 1);
    set('etapas', arr);
  }
  async function onArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) {
        url = await comprimirImagem(file); // redimensiona e comprime para caber no armazenamento
      } else {
        if (file.size > 300 * 1024) {
          alert('Documento muito grande (máx. 300 KB). Anexe um arquivo menor ou use um link.');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
          r.readAsDataURL(file);
        });
      }
      set('arquivos', [...(f.arquivos || []), {
        id: uid(),
        nome: file.name,
        tipo: ehImagem ? 'imagem' : 'documento',
        url
      }]);
    } catch (err) {
      alert('Não foi possível anexar o arquivo: ' + (err && err.message ? err.message : 'erro desconhecido'));
    }
  }
  function rmArquivo(id) {
    set('arquivos', (f.arquivos || []).filter(a => a.id !== id));
  }
  function addItemFicha() {
    if (db.materiais.length === 0) {
      alert('Cadastre materiais antes de montar a ficha técnica.');
      return;
    }
    if (materiaisDisponiveis.length === 0) {
      alert('Todos os materiais cadastrados já estão na ficha técnica deste produto.');
      return;
    }
    set('fichaTecnica', [...f.fichaTecnica, {
      materialId: materiaisDisponiveis[0].id,
      quantidade: 1
    }]);
  }
  function updItemFicha(i, patch) {
    const arr = f.fichaTecnica.slice();
    arr[i] = {
      ...arr[i],
      ...patch
    };
    set('fichaTecnica', arr);
  }
  function rmItemFicha(i) {
    const arr = f.fichaTecnica.slice();
    arr.splice(i, 1);
    set('fichaTecnica', arr);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: produto.id ? 'Editar produto' : 'Novo produto',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(SelectComCadastro, {
    label: "Categoria",
    valor: f.categoriaId,
    onChange: v => setClassificacao({
      categoriaId: v
    }),
    lista: cats,
    campoDb: "categoriasProduto",
    update: update,
    placeholderCod: "CAM",
    placeholderNome: "Camisetas"
  }), /*#__PURE__*/React.createElement(SelectComCadastro, {
    label: "Grupo",
    valor: f.grupoId,
    onChange: v => setClassificacao({
      grupoId: v,
      subgrupoId: ''
    }),
    lista: grupos,
    campoDb: "gruposProduto",
    update: update,
    placeholderCod: "MAL",
    placeholderNome: "Malha"
  }), /*#__PURE__*/React.createElement(SelectComCadastro, {
    label: "Subgrupo",
    valor: f.subgrupoId,
    onChange: v => setClassificacao({
      subgrupoId: v
    }),
    lista: subgrupos,
    campoDb: "subgruposProduto",
    update: update,
    placeholderCod: "PV",
    placeholderNome: "Malha PV",
    pai: {
      campo: 'grupoId',
      valor: f.grupoId
    },
    filtro: sg => !f.grupoId || sg.grupoId === f.grupoId
  }), /*#__PURE__*/React.createElement(Field, {
    label: "Tipo de tecido (do cadastro de materiais)"
  }, tecidos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Nenhum tecido cadastrado em Materiais (categoria \"Tecidos\" ou \"Malha\").") : /*#__PURE__*/React.createElement("select", {
    value: f.tecidoId,
    onChange: e => setClassificacao({
      tecidoId: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), tecidos.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.codigo, " · ", m.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Medida"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.medidas,
    onChange: e => setClassificacao({
      medidas: e.target.value
    }),
    placeholder: "Tam. M / 70x90cm"
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Código (gerado pela classificação)"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.codigo,
    onChange: e => set('codigo', e.target.value),
    placeholder: "Selecione a categoria"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Descrição do produto — gerada por categoria + grupo + subgrupo + tecido + medida"), /*#__PURE__*/React.createElement("input", {
    value: f.nome,
    onChange: e => set('nome', e.target.value),
    placeholder: "Preencha a classificação acima"
  }), montarDescricao(f) && montarDescricao(f) !== f.nome && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 6
    }
  }, "Sugestão: ", /*#__PURE__*/React.createElement("strong", null, montarDescricao(f)), ' ', /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "link-btn",
    onClick: () => set('nome', montarDescricao(f))
  }, "usar"))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Imagens e documentos do produto ", /*#__PURE__*/React.createElement("span", {
    className: "muted",
    style: {
      textTransform: 'none'
    }
  }, "(imagens são comprimidas automaticamente)")), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
    onChange: onArquivo
  }), (f.arquivos || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10
    }
  }, (f.arquivos || []).map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      width: 130,
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 8,
      background: '#fff'
    }
  }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    src: a.url,
    alt: a.nome,
    style: {
      width: '100%',
      height: 80,
      objectFit: 'cover',
      borderRadius: 4
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0ede6',
      borderRadius: 4,
      fontSize: 26
    }
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      wordBreak: 'break-word',
      margin: '6px 0'
    }
  }, a.nome), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn danger sm",
    onClick: () => rmArquivo(a.id)
  }, "Remover"))))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Etapas de produção — na ordem de execução"), (db.etapasProducao || []).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Nenhuma etapa cadastrada — crie em \"Departamentos & Etapas\".") : /*#__PURE__*/React.createElement("div", null, f.etapas.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8
    }
  }, "Nenhuma etapa adicionada."), f.etapas.map((linha, i) => {
    /* etapas já escolhidas em outras linhas — não aparecem de novo no select */
    const et = (db.etapasProducao || []).find(e => e.id === linha.etapaId);
    const custo = et ? custoMaoDeObraPorPeca(et, db) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 6,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        width: 18
      }
    }, i + 1, "."), /*#__PURE__*/React.createElement("select", {
      value: linha.etapaId,
      onChange: e => updItemEtapa(i, {
        etapaId: e.target.value,
        equipamentoId: ''
      }),
      style: {
        flex: 1,
        minWidth: 220
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "— selecione a etapa —"), (db.etapasProducao || []).filter(x => x.id === linha.etapaId || !etapasUsadas.includes(x.id)).map(x => {
      const d2 = db.departamentos.find(d => d.id === x.departamentoId);
      return /*#__PURE__*/React.createElement("option", {
        key: x.id,
        value: x.id
      }, x.nome, d2 ? ` · ${d2.nome}` : '');
    })), /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        width: 80,
        textAlign: 'right',
        fontFamily: 'var(--mono)'
      }
    }, et ? `${et.tempoProducao} ${labelUnidadeTempo(et.unidadeTempo)}` : ''), /*#__PURE__*/React.createElement("span", {
      className: "small",
      style: {
        width: 80,
        textAlign: 'right',
        fontFamily: 'var(--mono)',
        fontWeight: 600
      }
    }, custo === null ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "informe o lote") : money(custo)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn danger sm",
      onClick: () => rmItemEtapa(i)
    }, "×"));
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: addItemEtapa,
    disabled: etapasDisponiveis.length === 0
  }, etapasDisponiveis.length === 0 ? 'Todas as etapas já foram adicionadas' : '+ Adicionar etapa'), f.etapas.length > 0 && (() => {
    const linhas = f.etapas.map(l => {
      const et = (db.etapasProducao || []).find(e => e.id === l.etapaId);
      if (!et) return null;
      const dep = db.departamentos.find(d => d.id === et.departamentoId);
      const min = cargaEtapaMinutos(et, 1, 1); // minutos por peça
      const media = mediaSalarialDepartamento(db, et.departamentoId);
      const custoMin = custoPorMinutoDepartamento(db, et.departamentoId);
      const custo = custoMaoDeObraPorPeca(et, db);
      return {
        et,
        dep,
        min,
        media,
        custoMin,
        custo
      };
    }).filter(Boolean);
    const totalMin = linhas.reduce((a, l) => a + (l.et.modoTempo === 'peca' ? l.min : 0), 0);
    const total = linhas.reduce((a, l) => a + (l.custo || 0), 0);
    const variavel = linhas.some(l => l.et.modoTempo !== 'peca');
    const semBase = linhas.some(l => l.media === null);
    return /*#__PURE__*/React.createElement("div", {
      className: "panel",
      style: {
        background: '#fff',
        marginTop: 10,
        marginBottom: 0
      }
    }, /*#__PURE__*/React.createElement("h3", null, "Custo de produção por peça — tempo × média salarial"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Tempo/peça"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Média salarial"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Custo/min"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Custo/peça"))), /*#__PURE__*/React.createElement("tbody", null, linhas.map((l, i) => /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, l.et.nome), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, l.dep ? l.dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, l.et.modoTempo === 'peca' ? `${l.min.toFixed(2)} min` : /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "variável")), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, l.media === null ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "sem equipe") : money(l.media)), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, l.custoMin === null ? '—' : money(l.custoMin)), /*#__PURE__*/React.createElement("td", {
      className: "num small"
    }, /*#__PURE__*/React.createElement("strong", null, l.custo === null ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "—") : money(l.custo))))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: "2",
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Totais")), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", null, totalMin.toFixed(2), " min")), /*#__PURE__*/React.createElement("td", {
      colSpan: "2"
    }), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", null, money(total)))))), /*#__PURE__*/React.createElement("div", {
      className: "small muted",
      style: {
        marginTop: 8
      }
    }, "Base: média salarial dos colaboradores ativos de cada departamento ÷ ", HORAS_MES_PADRAO, "h/mês = custo por minuto, multiplicado pelo tempo da etapa. Total: ", /*#__PURE__*/React.createElement("strong", null, minParaHHMM(totalMin)), " de mão de obra por peça.", variavel && ' Há etapas por lote/equipe cujo custo depende da quantidade da OP.', semBase && ' Há departamentos sem colaboradores cadastrados.'));
  })())), /*#__PURE__*/React.createElement(Field, {
    label: "Observações"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "3",
    value: f.observacoes,
    onChange: e => setClassificacao({
      observacoes: e.target.value
    }),
    placeholder: "Detalhes de acabamento, instruções de produção, observações do cliente…"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Ficha técnica — consumo de materiais"), f.fichaTecnica.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8
    }
  }, "Nenhum material adicionado."), f.fichaTecnica.map((it, i) => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 6,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("select", {
      value: it.materialId,
      onChange: e => updItemFicha(i, {
        materialId: e.target.value
      }),
      style: {
        flex: 2
      }
    }, db.materiais.filter(m => m.id === it.materialId || !materiaisUsados.includes(m.id)).map(m => /*#__PURE__*/React.createElement("option", {
      key: m.id,
      value: m.id
    }, m.codigo ? `${m.codigo} · ${m.nome}` : m.nome))), /*#__PURE__*/React.createElement("input", {
      type: "number",
      step: "0.001",
      value: it.quantidade,
      onChange: e => updItemFicha(i, {
        quantidade: e.target.value
      }),
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        width: 40
      }
    }, mat ? mat.unidade : ''), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn danger sm",
      onClick: () => rmItemFicha(i)
    }, "×"));
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: addItemFicha,
    disabled: materiaisDisponiveis.length === 0
  }, materiaisDisponiveis.length === 0 ? 'Todos os materiais já foram adicionados' : '+ Adicionar material')), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.codigo || !f.nome
  }, "Salvar")));
}

/* ==========================================================
   4. PEDIDOS
========================================================== */
// itens do pedido, aceitando o formato antigo (um produto só)
function itensPedido(p) {
  if (Array.isArray(p.itens) && p.itens.length) return p.itens;
  if (p.produtoId) return [{
    id: 'legado',
    produtoId: p.produtoId,
    quantidade: p.quantidade,
    observacao: ''
  }];
  return [];
}
function totalPecasPedido(p) {
  return itensPedido(p).reduce((s, i) => s + num(i.quantidade), 0);
}

// monta as etapas de uma OP a partir do produto
function montarEtapasOP(produto, d) {
  const doProduto = etapasDoProduto(produto);
  const lista = doProduto.length ? doProduto.map(x => ({
    def: d.etapasProducao.find(e => e.id === x.etapaId),
    equipamentoId: x.equipamentoId
  })).filter(x => x.def) : d.etapasProducao.map(def => ({
    def,
    equipamentoId: ''
  }));
  return lista.map(({
    def,
    equipamentoId
  }) => ({
    etapaProducaoId: def.id,
    departamentoId: def.departamentoId || null,
    nome: def.nome || '(etapa removida)',
    modoTempo: def.modoTempo || 'peca',
    tempoProducao: def.tempoProducao || 0,
    unidadeTempo: def.unidadeTempo || 'seg',
    tamanhoEquipe: def.tamanhoEquipe || '',
    tamanhoLote: def.tamanhoLote || '',
    equipamentoId: equipamentoId || '',
    // já vem alocado do cadastro do produto
    status: 'Não iniciada',
    qtdRecebida: 0,
    qtdConcluida: 0,
    responsaveis: [],
    dataInicio: '',
    dataConclusao: '',
    observacao: ''
  }));
}

/* Gera uma OP por produto do pedido.
   As OPs herdam o número do pedido e recebem sufixo sequencial: 00101a, 00101b, 00101c… */
function gerarOPsDoPedido(pedido, d) {
  const itens = itensPedido(pedido);
  const existentes = d.ops.filter(o => o.pedidoId === pedido.id);
  // trava de duplicidade: um item só pode ter uma OP
  const jaExistentes = existentes.length;
  let criadas = 0;
  itens.forEach((item, i) => {
    const produto = d.produtos.find(p => p.id === item.produtoId);
    if (!produto) return;
    if (existentes.some(o => o.itemId === item.id)) return; // já tem OP para este item
    const sufixo = itens.length > 1 ? sufixoPorIndice(jaExistentes + criadas) : '';
    d.ops.push({
      id: uid(),
      numero: pedido.numero,
      sufixo,
      pedidoId: pedido.id,
      itemId: item.id,
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      entrega: pedido.prazoEntrega,
      observacaoItem: item.observacao || '',
      etapas: montarEtapasOP(produto, d),
      anexos: (item.anexos || []).map(a => ({
        ...a
      })) // arquivos do produto no pedido seguem para a OP
    });
    criadas++;
  });
  if (criadas > 0) d.pedidos = d.pedidos.map(p => p.id === pedido.id ? {
    ...p,
    status: 'Em produção'
  } : p);
  return criadas;
}
function Pedidos({
  db,
  update,
  setTab
}) {
  const [modal, setModal] = useState(null);
  const [ficha, setFicha] = useState(null);
  function save(p) {
    update(d => {
      if (p.id) {
        d.pedidos = d.pedidos.map(x => x.id === p.id ? p : x);
      } else {
        const numero = d.seq.pedido++;
        d.pedidos.push({
          ...p,
          id: uid(),
          numero,
          status: 'Aberto'
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este pedido? As OPs vinculadas continuarão existindo.')) return;
    update(d => {
      d.pedidos = d.pedidos.filter(p => p.id !== id);
      return d;
    });
  }
  function gerarOP(pedido) {
    if (db.etapasProducao.length === 0) {
      alert('Nenhuma etapa de produção cadastrada. Cadastre em "Departamentos & Etapas".');
      return;
    }
    const itens = itensPedido(pedido);
    if (itens.length === 0) {
      alert('Este pedido não tem produtos.');
      return;
    }
    if (!podeGerarOP(pedido)) {
      alert(`Este pedido está como "${pedido.status}". Libere-o para produção antes de gerar a OP.`);
      return;
    }
    const existentes = db.ops.filter(o => o.pedidoId === pedido.id);
    if (itens.every(it => existentes.some(o => o.itemId === it.id))) {
      alert('Todos os produtos deste pedido já têm OP. Use a aba Produção para visualizar ou editar.');
      return;
    }
    update(d => {
      gerarOPsDoPedido(pedido, d);
      return d;
    });
    if (setTab) setTab('producao');
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Pedidos de venda"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({}),
    disabled: db.produtos.length === 0
  }, "+ Novo pedido")), db.produtos.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty",
    style: {
      marginBottom: 16
    }
  }, "Cadastre ao menos um produto antes de lançar pedidos."), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, db.pedidos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum pedido lançado."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", null, "Vendedor"), /*#__PURE__*/React.createElement("th", null, "Produtos"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total peças"), /*#__PURE__*/React.createElement("th", null, "Data pedido"), /*#__PURE__*/React.createElement("th", null, "Entrega"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "OPs"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, db.pedidos.slice().sort((a, b) => b.numero - a.numero).map(p => {
    const itens = itensPedido(p);
    const ops = db.ops.filter(op => op.pedidoId === p.id);
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", String(p.numero).padStart(5, '0')), /*#__PURE__*/React.createElement("td", null, p.cliente), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, p.vendedor || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, itens.map((it, i) => {
      const prod = db.produtos.find(x => x.id === it.produtoId);
      return /*#__PURE__*/React.createElement("div", {
        key: i
      }, prod ? prod.nome : '—', " ", /*#__PURE__*/React.createElement("span", {
        className: "muted"
      }, "(", num(it.quantidade), ")"));
    })), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, totalPecasPedido(p)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(p.dataPedido)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(p.prazoEntrega)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusPedidoBadge, {
      status: p.status
    })), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, ops.length === 0 ? '—' : ops.map(o => rotuloOP(o)).join(', ')), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(p)
    }, "Editar"), /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setFicha(p)
    }, "Ficha"), itens.some(it => !ops.some(o => o.itemId === it.id)) && podeGerarOP(p) && /*#__PURE__*/React.createElement("button", {
      className: "btn accent sm",
      onClick: () => gerarOP(p)
    }, "Gerar OP"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(p.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(PedidoModal, {
    pedido: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }), ficha && /*#__PURE__*/React.createElement(FichaPedidoModal, {
    pedido: ficha,
    db: db,
    onClose: () => setFicha(null)
  }));
}

/* ==========================================================
   MOTOR DE PROGRAMAÇÃO — FIFO com alocação de horários
   Respeita a jornada, evita o mesmo colaborador ou o mesmo
   equipamento em dois trabalhos no mesmo horário.
========================================================== */
function hhmm(min) {
  const m = Math.round(min),
    h = Math.floor(m / 60),
    r = m % 60;
  return `${String(h).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}
function somaDias(dataISO, n) {
  const d = new Date(dataISO + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
// janelas de trabalho do dia, em minutos desde 00:00
// máquinas disponíveis para uma etapa: as do departamento dela
function maquinasDaEtapa(et, db) {
  return (db.equipamentos || []).filter(q => (q.status || 'Operando') !== 'Baixado' && (!et.departamentoId || q.departamentoId === et.departamentoId));
}

/* Cronograma alimentado pelos lançamentos de produção.
   Cada apontamento (em aberto ou concluído) vira um bloco na agenda. */
function segmentosCronograma(db) {
  const segs = [];
  (db.apontamentos || []).forEach(ap => {
    const op = db.ops.find(o => o.id === ap.opId);
    const produto = op ? db.produtos.find(p => p.id === op.produtoId) : null;
    const pedido = op ? db.pedidos.find(p => p.id === op.pedidoId) : null;
    const dep = db.departamentos.find(x => x.id === ap.departamentoId);
    const maq = (db.equipamentos || []).find(q => q.id === ap.equipamentoId);
    const et = op ? op.etapas[ap.etapaIdx] : null;
    const iniTxt = String(ap.inicio || '').replace('T', ' ');
    const data = iniTxt.slice(0, 10);
    if (!data) return;
    const hh = Number(iniTxt.slice(11, 13)) || 0,
      mm = Number(iniTxt.slice(14, 16)) || 0;
    const ini = hh * 60 + mm;
    const dur = ap.fim ? num(ap.minReais) : num(ap.minPrevistos);
    const fim = ini + Math.max(dur, 1);
    segs.push({
      ap,
      op,
      etapa: et || {
        nome: ap.etapaNome,
        status: ap.fim ? 'Concluída' : 'Em andamento'
      },
      etapaIdx: ap.etapaIdx,
      pedido,
      produto,
      dep,
      maq,
      responsaveis: (ap.equipe || [ap.colaborador]).filter(Boolean),
      data,
      ini,
      fim,
      min: Math.max(dur, 1),
      concluido: !!ap.fim
    });
  });
  return segs.sort((a, b) => a.data === b.data ? a.ini - b.ini : a.data.localeCompare(b.data));
}

/* Detecta dias em que a carga programada passa da jornada de um colaborador. */
function sobrecargaPorDia(segs) {
  const mapa = {};
  segs.forEach(sg => {
    sg.responsaveis.forEach(n => {
      const k = sg.data + '|' + n;
      if (!mapa[k]) mapa[k] = {
        data: sg.data,
        colaborador: n,
        min: 0
      };
      mapa[k].min += sg.min / sg.responsaveis.length;
    });
  });
  return Object.values(mapa).map(x => {
    const cap = capacidadeDoDia(x.data);
    const limite = cap.normal || cap.maximo;
    return {
      ...x,
      limite,
      excedente: x.min - limite,
      cap
    };
  }).filter(x => x.excedente > 1).sort((a, b) => b.excedente - a.excedente);
}

// total já apontado numa etapa
function totalApontado(et) {
  return (et.apontamentos || []).reduce((s, a) => s + num(a.quantidade), 0);
}

/* ==========================================================
   FICHA DE PEDIDO DE VENDA — impressão / PDF
========================================================== */
function FichaPedidoModal({
  pedido,
  db,
  onClose
}) {
  const cliente = db.clientes.find(c => c.id === pedido.clienteId);
  const itens = itensPedido(pedido);
  const ops = db.ops.filter(o => o.pedidoId === pedido.id);
  const anexos = pedido.anexos || [];
  const imagens = anexos.filter(a => a.tipo === 'imagem');
  const documentos = anexos.filter(a => a.tipo !== 'imagem');
  const linhas = itens.map(it => {
    const prod = db.produtos.find(p => p.id === it.produtoId);
    const custo = prod ? custoUnitarioProduto(prod, db) : {
      total: 0
    };
    const qtd = num(it.quantidade);
    return {
      it,
      prod,
      qtd,
      custoUnit: custo.total,
      custoTotal: custo.total * qtd
    };
  });
  const totalPecas = linhas.reduce((s, l) => s + l.qtd, 0);
  const totalCusto = linhas.reduce((s, l) => s + l.custoTotal, 0);
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Pedido de venda #${String(pedido.numero).padStart(5, '0')}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / salvar como PDF")), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Pedido de Venda"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, "Nº ", String(pedido.numero).padStart(5, '0'), " · Confecção ERP · Emitido em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Cliente"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pedido.cliente || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Vendedor"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pedido.vendedor || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Data do pedido"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, fmtDate(pedido.dataPedido))), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Prazo de entrega"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, fmtDate(pedido.prazoEntrega))), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Status"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pedido.status || 'Aberto'))), cliente && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Dados do cliente"), /*#__PURE__*/React.createElement("div", {
    className: "small"
  }, cliente.nomeFantasia && /*#__PURE__*/React.createElement(React.Fragment, null, "Nome fantasia: ", /*#__PURE__*/React.createElement("strong", null, cliente.nomeFantasia), /*#__PURE__*/React.createElement("br", null)), cliente.documento && /*#__PURE__*/React.createElement(React.Fragment, null, cliente.tipo === 'PJ' ? 'CNPJ' : 'CPF', ": ", cliente.documento, cliente.ie ? ` · IE: ${cliente.ie}` : '', /*#__PURE__*/React.createElement("br", null)), (cliente.responsavel || cliente.celular || cliente.telefone) && /*#__PURE__*/React.createElement(React.Fragment, null, "Contato: ", [cliente.responsavel, cliente.celular || cliente.telefone, cliente.email].filter(Boolean).join(' · '), /*#__PURE__*/React.createElement("br", null)), (cliente.endereco || cliente.cidade) && /*#__PURE__*/React.createElement(React.Fragment, null, "Endereço: ", [cliente.endereco, cliente.numero, cliente.complemento, cliente.bairro, cliente.cidade && `${cliente.cidade}${cliente.uf ? '/' + cliente.uf : ''}`, cliente.cep].filter(Boolean).join(', ')))), imagens.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "ficha-hero"
  }, /*#__PURE__*/React.createElement("img", {
    src: imagens[0].url,
    alt: imagens[0].nome
  }), imagens.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "ficha-hero-mini"
  }, imagens.slice(1).map(a => /*#__PURE__*/React.createElement("img", {
    key: a.id,
    src: a.url,
    alt: a.nome
  })))), /*#__PURE__*/React.createElement("h4", null, "Itens do pedido"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "#"), /*#__PURE__*/React.createElement("th", null, "Código"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo unit."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo total"), /*#__PURE__*/React.createElement("th", null, "Observação"))), /*#__PURE__*/React.createElement("tbody", null, linhas.map((l, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, i + 1), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, l.prod ? l.prod.codigo : '—'), /*#__PURE__*/React.createElement("td", null, l.prod ? l.prod.nome : '(produto removido)'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, l.qtd), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(l.custoUnit)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(l.custoTotal)), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, l.it.observacao || '—', (l.it.anexos || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 6
    }
  }, (l.it.anexos || []).map(a => a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    key: a.id,
    src: a.url,
    alt: a.nome,
    style: {
      width: 70,
      height: 70,
      objectFit: 'cover',
      border: '1px solid var(--line)',
      borderRadius: 4
    }
  }) : /*#__PURE__*/React.createElement("span", {
    key: a.id,
    className: "small"
  }, "📄 ", a.nome)))))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "3",
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("strong", null, "Totais")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, totalPecas)), /*#__PURE__*/React.createElement("td", null), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(totalCusto))), /*#__PURE__*/React.createElement("td", null)))), ops.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Ordens de produção geradas"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Entrega"), /*#__PURE__*/React.createElement("th", null, "Situação"))), /*#__PURE__*/React.createElement("tbody", null, ops.map(o => {
    const prod = db.produtos.find(p => p.id === o.produtoId);
    const info = opStatusInfo(o);
    return /*#__PURE__*/React.createElement("tr", {
      key: o.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, rotuloOP(o))), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, prod ? prod.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, o.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(o.entrega)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, info.label, " · ", info.etapaAtual));
  })))), pedido.observacoes && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Observações"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5
    }
  }, pedido.observacoes)), documentos.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Documentos anexados"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: 0,
      paddingLeft: 18
    }
  }, documentos.map(a => /*#__PURE__*/React.createElement("li", {
    key: a.id,
    className: "small"
  }, a.nome)))), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, pedido.vendedor ? `Vendedor: ${pedido.vendedor}` : 'Assinatura do vendedor'), /*#__PURE__*/React.createElement("div", null, "Aprovação do cliente"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar")));
}
function StatusPedidoBadge({
  status
}) {
  const mapa = {
    'Aberto': 'idle',
    'Liberado para produção': 'warn',
    'Em produção': 'info',
    'Concluído': 'ok',
    'Expedição': 'info',
    'Encerrado': 'ok',
    'Cancelado': 'bad'
  };
  return /*#__PURE__*/React.createElement(Badge, {
    tone: mapa[status] || 'idle'
  }, status);
}
function PedidoModal({
  pedido,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState(() => ({
    cliente: '',
    clienteId: '',
    vendedor: '',
    vendedorId: '',
    dataPedido: todayISO(),
    prazoEntrega: '',
    observacoes: '',
    status: 'Aberto',
    itens: [],
    anexos: [],
    ...pedido,
    itens: pedido && pedido.id ? itensPedido(pedido) : [{
      id: uid(),
      produtoId: db.produtos[0]?.id || '',
      quantidade: 1,
      observacao: '',
      anexos: []
    }]
  }));
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  function addItem() {
    if (db.produtos.length === 0) {
      alert('Cadastre produtos antes.');
      return;
    }
    set('itens', [...f.itens, {
      id: uid(),
      produtoId: db.produtos[0].id,
      quantidade: 1,
      observacao: '',
      anexos: []
    }]);
  }

  // anexos vinculados ao produto dentro do pedido
  async function anexarNoItem(i, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) url = await comprimirImagem(file);else {
        if (file.size > 300 * 1024) {
          alert('Documento muito grande (máx. 300 KB).');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
          r.readAsDataURL(file);
        });
      }
      const atuais = f.itens[i].anexos || [];
      updItem(i, {
        anexos: [...atuais, {
          id: uid(),
          nome: file.name,
          tipo: ehImagem ? 'imagem' : 'documento',
          url,
          quando: agoraISO()
        }]
      });
    } catch (err) {
      alert('Não foi possível anexar: ' + (err && err.message));
    }
  }
  function rmAnexoItem(i, anexoId) {
    const atuais = f.itens[i].anexos || [];
    updItem(i, {
      anexos: atuais.filter(a => a.id !== anexoId)
    });
  }
  function updItem(i, patch) {
    const a = f.itens.slice();
    a[i] = {
      ...a[i],
      ...patch
    };
    set('itens', a);
  }
  function rmItem(i) {
    const a = f.itens.slice();
    a.splice(i, 1);
    set('itens', a);
  }
  async function onArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) {
        url = await comprimirImagem(file);
      } else {
        if (file.size > 300 * 1024) {
          alert('Documento muito grande (máx. 300 KB).');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler.'));
          r.readAsDataURL(file);
        });
      }
      set('anexos', [...(f.anexos || []), {
        id: uid(),
        nome: file.name,
        tipo: ehImagem ? 'imagem' : 'documento',
        url
      }]);
    } catch (err) {
      alert('Não foi possível anexar: ' + (err && err.message));
    }
  }
  function rmAnexo(id) {
    set('anexos', (f.anexos || []).filter(a => a.id !== id));
  }
  const totalPecas = f.itens.reduce((s, i) => s + num(i.quantidade), 0);
  const totalCusto = f.itens.reduce((s, i) => {
    const prod = db.produtos.find(p => p.id === i.produtoId);
    return s + (prod ? custoUnitarioProduto(prod, db).total * num(i.quantidade) : 0);
  }, 0);
  return /*#__PURE__*/React.createElement(Modal, {
    title: pedido.id ? 'Editar pedido' : 'Novo pedido de venda',
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Cliente"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.clienteId || '',
    onChange: e => {
      const cli = db.clientes.find(x => x.id === e.target.value);
      setF(prev => ({
        ...prev,
        clienteId: e.target.value,
        cliente: cli ? cli.nome : ''
      }));
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, f.cliente && !f.clienteId ? f.cliente : '— selecione —'), db.clientes.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Vendedor"
  }, (() => {
    const vendedores = db.colaboradores.filter(c => c.status !== 'Inativo' && ehVendedor(c));
    const lista = vendedores.length ? vendedores : db.colaboradores.filter(c => c.status !== 'Inativo');
    return /*#__PURE__*/React.createElement("select", {
      value: f.vendedorId || '',
      onChange: e => {
        const v = db.colaboradores.find(x => x.id === e.target.value);
        setF(prev => ({
          ...prev,
          vendedorId: e.target.value,
          vendedor: v ? v.nome : ''
        }));
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, f.vendedor && !f.vendedorId ? f.vendedor : '— selecione —'), lista.map(c => /*#__PURE__*/React.createElement("option", {
      key: c.id,
      value: c.id
    }, c.nome)));
  })()), /*#__PURE__*/React.createElement(Field, {
    label: "Status"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.status,
    onChange: e => set('status', e.target.value)
  }, STATUS_PEDIDO.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st)))), /*#__PURE__*/React.createElement(Field, {
    label: "Data do pedido"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.dataPedido,
    onChange: e => set('dataPedido', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Prazo de entrega"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.prazoEntrega,
    onChange: e => set('prazoEntrega', e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Produtos do pedido — cada produto gera uma Ordem de Produção própria"), f.itens.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 8
    }
  }, "Nenhum produto adicionado."), f.itens.map((it, i) => {
    const prod = db.produtos.find(p => p.id === it.produtoId);
    const custo = prod ? custoUnitarioProduto(prod, db).total : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: it.id || i,
      className: "panel",
      style: {
        background: '#fff',
        padding: '10px 12px',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        width: 60,
        fontFamily: 'var(--mono)'
      }
    }, "OP …", f.itens.length > 1 ? sufixoPorIndice(i) : ''), /*#__PURE__*/React.createElement("select", {
      value: it.produtoId,
      onChange: e => updItem(i, {
        produtoId: e.target.value
      }),
      style: {
        flex: 2
      }
    }, db.produtos.map(p => /*#__PURE__*/React.createElement("option", {
      key: p.id,
      value: p.id
    }, p.codigo, " · ", p.nome))), /*#__PURE__*/React.createElement("input", {
      type: "number",
      min: "1",
      value: it.quantidade,
      onChange: e => updItem(i, {
        quantidade: e.target.value
      }),
      style: {
        width: 100
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        width: 110,
        textAlign: 'right',
        fontFamily: 'var(--mono)'
      }
    }, money(custo * num(it.quantidade))), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn danger sm",
      onClick: () => rmItem(i)
    }, "×")), /*#__PURE__*/React.createElement("input", {
      value: it.observacao || '',
      onChange: e => updItem(i, {
        observacao: e.target.value
      }),
      placeholder: "Observação deste item (grade, cores, estampa…)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginTop: 8,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("label", {
      className: "btn ghost sm",
      style: {
        cursor: 'pointer'
      }
    }, "📎 Anexar arquivo do item", /*#__PURE__*/React.createElement("input", {
      type: "file",
      accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
      style: {
        display: 'none'
      },
      onChange: e => anexarNoItem(i, e)
    })), /*#__PURE__*/React.createElement("label", {
      className: "btn ghost sm",
      style: {
        cursor: 'pointer'
      }
    }, "📷 Foto", /*#__PURE__*/React.createElement("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      style: {
        display: 'none'
      },
      onChange: e => anexarNoItem(i, e)
    })), /*#__PURE__*/React.createElement("span", {
      className: "small muted"
    }, (it.anexos || []).length > 0 ? `${(it.anexos || []).length} arquivo(s) neste produto` : 'layout, arte, medidas aprovadas…')), (it.anexos || []).length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8
      }
    }, (it.anexos || []).map(a => /*#__PURE__*/React.createElement("div", {
      key: a.id,
      style: {
        width: 110,
        border: '1px solid var(--line)',
        borderRadius: 6,
        padding: 6,
        background: 'var(--canvas-panel)'
      }
    }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("a", {
      href: a.url,
      target: "_blank",
      rel: "noopener noreferrer"
    }, /*#__PURE__*/React.createElement("img", {
      src: a.url,
      alt: a.nome,
      style: {
        width: '100%',
        height: 64,
        objectFit: 'cover',
        borderRadius: 4
      }
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0ede6',
        borderRadius: 4,
        fontSize: 22
      }
    }, "📄"), /*#__PURE__*/React.createElement("div", {
      className: "small",
      style: {
        wordBreak: 'break-word',
        margin: '4px 0'
      }
    }, a.nome), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "btn danger sm",
      onClick: () => rmAnexoItem(i, a.id)
    }, "Remover")))));
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn ghost sm",
    onClick: addItem
  }, "+ Adicionar produto"), f.itens.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 8
    }
  }, f.itens.length, " produto(s) · ", /*#__PURE__*/React.createElement("strong", null, totalPecas), " peças · custo estimado ", /*#__PURE__*/React.createElement("strong", null, money(totalCusto)), f.itens.length > 1 && ' · serão geradas ' + f.itens.length + ' OPs (sufixos a, b, c…)')), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Imagens e arquivos do pedido ", /*#__PURE__*/React.createElement("span", {
    className: "muted",
    style: {
      textTransform: 'none'
    }
  }, "(imagens são comprimidas automaticamente)")), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
    onChange: onArquivo
  }), (f.anexos || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10
    }
  }, (f.anexos || []).map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      width: 130,
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 8,
      background: '#fff'
    }
  }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    src: a.url,
    alt: a.nome,
    style: {
      width: '100%',
      height: 80,
      objectFit: 'cover',
      borderRadius: 4
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0ede6',
      borderRadius: 4,
      fontSize: 26
    }
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      wordBreak: 'break-word',
      margin: '6px 0'
    }
  }, a.nome), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn danger sm",
    onClick: () => rmAnexo(a.id)
  }, "Remover"))))), /*#__PURE__*/React.createElement(Field, {
    label: "Observações do pedido"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacoes,
    onChange: e => set('observacoes', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.cliente || !f.prazoEntrega || f.itens.length === 0 || f.itens.some(i => !i.produtoId)
  }, "Salvar")));
}
function opNecessidades(op, db) {
  const produto = db.produtos.find(p => p.id === op.produtoId);
  if (!produto) return [];
  return (produto.fichaTecnica || []).map(it => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    const necessario = num(it.quantidade) * num(op.quantidade);
    const disponivel = mat ? num(mat.estoqueAtual) : 0;
    const consumido = db.movimentacoes.filter(mv => mv.opId === op.id && mv.materialId === it.materialId && mv.tipo === 'Saída').reduce((s, mv) => s + num(mv.quantidade), 0);
    const sobra = db.movimentacoes.filter(mv => mv.opId === op.id && mv.materialId === it.materialId && mv.tipo === 'Devolução').reduce((s, mv) => s + num(mv.quantidade), 0);
    const falta = Math.max(necessario - disponivel, 0);
    return {
      materialId: it.materialId,
      nome: mat ? mat.nome : '(removido)',
      unidade: mat ? mat.unidade : '',
      necessario,
      disponivel,
      falta,
      consumido,
      sobra
    };
  });
}
function opStatusInfo(op) {
  const etapas = op.etapas;
  const allDone = etapas.every(e => e.status === 'Concluída');
  const anyStarted = etapas.some(e => e.status !== 'Não iniciada');
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const entrega = op.entrega ? new Date(op.entrega + 'T00:00:00') : null;
  let tone = 'idle',
    label = 'Não iniciado';
  if (allDone) {
    tone = 'ok';
    label = 'Concluída';
  } else if (!anyStarted) {
    tone = 'idle';
    label = 'Não iniciado';
  } else if (entrega) {
    const diff = (entrega - hoje) / (1000 * 60 * 60 * 24);
    if (diff < 0) {
      tone = 'bad';
      label = 'Atrasado';
    } else if (diff <= 3) {
      tone = 'warn';
      label = 'Atenção';
    } else {
      tone = 'ok';
      label = 'No prazo';
    }
  } else {
    tone = 'warn';
    label = 'Em andamento';
  }
  const etapaAtualObj = etapas.find(e => e.status !== 'Concluída');
  return {
    tone,
    label,
    etapaAtual: etapaAtualObj ? etapaAtualObj.nome : 'Concluída',
    etapaAtualDepId: etapaAtualObj ? etapaAtualObj.departamentoId : null,
    produzido: etapaAtualObj ? num(etapaAtualObj.qtdConcluida) : num(op.quantidade)
  };
}
function RelatorioOP({
  op,
  db,
  pedido,
  produto,
  necessidades
}) {
  const info = opStatusInfo(op);
  const anexos = op.anexos || [];
  const imagens = anexos.filter(a => a.tipo === 'imagem');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / salvar como PDF")), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Ordem de Produção — ", rotuloOP(op)), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, "Confecção ERP · Emitido em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Cliente"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pedido ? pedido.cliente : '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Produto"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, produto ? produto.nome : '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Quantidade"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, op.quantidade)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Entrega"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, fmtDate(op.entrega)))), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, "Situação geral: ", /*#__PURE__*/React.createElement("strong", null, info.label), " · Etapa atual: ", /*#__PURE__*/React.createElement("strong", null, info.etapaAtual)), /*#__PURE__*/React.createElement("h4", null, "Etapas de produção — responsáveis e projeção"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "#"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Colaborador responsável"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Tempo padrão"), /*#__PURE__*/React.createElement("th", null, "Início previsto"), /*#__PURE__*/React.createElement("th", null, "Conclusão prevista"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Concluída"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, (() => {
    let totalMin = 0;
    const linhas = op.etapas.map((et, i) => {
      const dep = db.departamentos.find(d => d.id === et.departamentoId);
      const maq = (db.equipamentos || []).find(q => q.id === et.equipamentoId);
      const base = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const restante = Math.max(base - num(et.qtdConcluida), 0);
      const carga = cargaEtapaOP(et, restante || base, op.quantidade, db);
      const minPeca = cargaEtapaOP(et, 1, op.quantidade, db);
      totalMin += carga;

      // projeção: usa a programação do PCP quando existir, senão o apontamento em curso
      const aps = (db.apontamentos || []).filter(a => a.opId === op.id && a.etapaIdx === i);
      const ap = aps.find(a => !a.fim) || aps[aps.length - 1];
      const iniPrev = ap ? String(ap.inicio).replace('T', ' ') : et.dataInicio ? fmtDate(et.dataInicio) : '—';
      const fimPrev = ap ? String(ap.fim || ap.previsaoFim || '').replace('T', ' ') || '—' : '—';
      const resp = responsaveisEtapa(et);
      const respAp = ap ? ap.equipe || [ap.colaborador] : [];
      const nomes = Array.from(new Set([...resp, ...respAp]));
      return /*#__PURE__*/React.createElement("tr", {
        key: i
      }, /*#__PURE__*/React.createElement("td", {
        className: "small muted"
      }, i + 1), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, et.nome)), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, dep ? dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, nomes.length ? nomes.join(', ') : /*#__PURE__*/React.createElement("span", {
        className: "muted"
      }, "a definir"), ap && !ap.fim && /*#__PURE__*/React.createElement("div", {
        className: "small",
        style: {
          color: 'var(--thread-dark)'
        }
      }, "em produção")), /*#__PURE__*/React.createElement("td", {
        className: "small muted"
      }, maq ? `${maq.codigo} · ${maq.nome}` : '—'), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, base), /*#__PURE__*/React.createElement("td", {
        className: "num small"
      }, minPeca > 0 ? minParaHHMM(carga) : /*#__PURE__*/React.createElement("span", {
        className: "muted"
      }, "sem tempo"), minPeca > 0 && /*#__PURE__*/React.createElement("div", {
        className: "muted",
        style: {
          fontSize: 10
        }
      }, Math.floor(60 / minPeca), " pç/h")), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, iniPrev), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, fimPrev), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, et.qtdConcluida || 0), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, et.status));
    });
    return /*#__PURE__*/React.createElement(React.Fragment, null, linhas, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
      colSpan: "6",
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("strong", null, "Tempo total de produção estimado")), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", null, minParaHHMM(totalMin))), /*#__PURE__*/React.createElement("td", {
      colSpan: "4"
    })));
  })())), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 6
    }
  }, "As datas vêm dos lançamentos de produção. Etapas sem colaborador definido aparecem como \"a definir\"."), necessidades.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Controle de materiais"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Necessário"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Disponível"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Falta"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Consumido"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Sobra"))), /*#__PURE__*/React.createElement("tbody", null, necessidades.map(n => /*#__PURE__*/React.createElement("tr", {
    key: n.materialId
  }, /*#__PURE__*/React.createElement("td", null, n.nome), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, n.necessario, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, n.disponivel, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, n.falta, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, n.consumido, " ", n.unidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, n.sobra, " ", n.unidade)))))), imagens.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h4", null, "Imagens anexadas"), /*#__PURE__*/React.createElement("div", {
    className: "rep-imgs"
  }, imagens.map(a => /*#__PURE__*/React.createElement("img", {
    key: a.id,
    src: a.url,
    alt: a.nome
  })))), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, "Conferência de material"), /*#__PURE__*/React.createElement("div", null, "Conferência final / expedição"))));
}
function StatusEtapaBadge({
  status
}) {
  const tone = status === 'Concluída' ? 'ok' : status === 'Em andamento' ? 'warn' : 'idle';
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone
  }, status);
}

/* ==========================================================
   C. CRONOGRAMA DE PRODUÇÃO POR DEPARTAMENTO
========================================================== */
function buildCronograma(db) {
  // varre todas as etapas de todas as OPs que têm data de início e monta a carga horária
  const porColaboradorDia = {}; // chave: data|colaborador -> {data,colaborador,totalMin,itens:[]}
  const porDeptoDia = {}; // chave: data|departamentoId -> {data,departamentoId,totalMin}
  const porMaquinaDia = {}; // chave: data|equipamento|tipo -> carga de máquina

  db.ops.forEach(op => {
    op.etapas.forEach(et => {
      if (!et.dataInicio) return;
      const qtdBase = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const cargaMin = cargaEtapaOP(et, qtdBase, op.quantidade, db);
      if (cargaMin <= 0) return;
      const colaboradores = responsaveisEtapa(et);
      const lista = colaboradores.length ? colaboradores : ['(sem responsável definido)'];
      const cargaPorPessoa = cargaMin / lista.length;
      lista.forEach(colaborador => {
        const kC = et.dataInicio + '|' + colaborador;
        if (!porColaboradorDia[kC]) porColaboradorDia[kC] = {
          data: et.dataInicio,
          colaborador,
          totalMin: 0,
          itens: []
        };
        porColaboradorDia[kC].totalMin += cargaPorPessoa;
        porColaboradorDia[kC].itens.push({
          opRotulo: rotuloOP(op),
          etapa: et.nome,
          cargaMin: cargaPorPessoa
        });
      });
      const depId = et.departamentoId || '_sem';
      const kD = et.dataInicio + '|' + depId;
      if (!porDeptoDia[kD]) porDeptoDia[kD] = {
        data: et.dataInicio,
        departamentoId: depId,
        totalMin: 0,
        itens: []
      };
      porDeptoDia[kD].totalMin += cargaMin;
      porDeptoDia[kD].itens.push({
        opRotulo: rotuloOP(op),
        etapa: et.nome,
        cargaMin
      });

      // carga de máquina: por equipamento alocado, ou agrupada pelo tipo quando ainda não alocada
      const chaveMaq = et.equipamentoId ? 'eq:' + et.equipamentoId : null;
      if (chaveMaq) {
        const kM = et.dataInicio + '|' + chaveMaq;
        if (!porMaquinaDia[kM]) porMaquinaDia[kM] = {
          data: et.dataInicio,
          equipamentoId: et.equipamentoId || '',
          tipo: '',
          alocada: !!et.equipamentoId,
          totalMin: 0,
          itens: []
        };
        porMaquinaDia[kM].totalMin += cargaMin;
        porMaquinaDia[kM].itens.push({
          opRotulo: rotuloOP(op),
          etapa: et.nome,
          cargaMin
        });
      }
    });
  });
  return {
    colaboradores: Object.values(porColaboradorDia).sort((a, b) => a.data === b.data ? a.colaborador.localeCompare(b.colaborador) : a.data.localeCompare(b.data)),
    departamentos: Object.values(porDeptoDia).sort((a, b) => a.data.localeCompare(b.data)),
    maquinas: Object.values(porMaquinaDia).sort((a, b) => a.data.localeCompare(b.data))
  };
}
function Cronograma({
  db,
  update,
  usuario
}) {
  const [fIni, setFIni] = useState('');
  const [fFim, setFFim] = useState('');
  const [fDep, setFDep] = useState('');
  const [fCol, setFCol] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [detalhe, setDetalhe] = useState(null); // {opId, etapaIdx}

  const segmentos = useMemo(() => segmentosCronograma(db), [db]);
  const filtrados = segmentos.filter(sg => {
    if (fIni && sg.data < fIni) return false;
    if (fFim && sg.data > fFim) return false;
    if (fDep && (sg.etapa.departamentoId || '') !== fDep) return false;
    if (fCol && !sg.responsaveis.some(n => normaliza(n) === normaliza(fCol))) return false;
    if (fStatus && sg.etapa.status !== fStatus) return false;
    return true;
  });

  // agrupa por data → departamento → colaborador
  const porDia = {};
  filtrados.forEach(sg => {
    if (!porDia[sg.data]) porDia[sg.data] = {};
    const kd = sg.dep ? sg.dep.id : '_sem';
    if (!porDia[sg.data][kd]) porDia[sg.data][kd] = {
      dep: sg.dep,
      itens: []
    };
    porDia[sg.data][kd].itens.push(sg);
  });
  const dias = Object.keys(porDia).sort();
  const nomesColab = Array.from(new Set(db.colaboradores.filter(c => c.status !== 'Inativo').map(c => c.nome))).sort();
  const totalMin = filtrados.reduce((s, x) => s + x.min, 0);
  const etapasUnicas = new Set(filtrados.map(x => x.op.id + '|' + x.etapaIdx)).size;
  function limpar() {
    setFIni('');
    setFFim('');
    setFDep('');
    setFCol('');
    setFStatus('');
  }
  const etapaAberta = detalhe ? (() => {
    const op = db.ops.find(o => o.id === detalhe.opId);
    return op ? {
      op,
      et: op.etapas[detalhe.etapaIdx],
      idx: detalhe.etapaIdx
    } : null;
  })() : null;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Cronograma / PCP — programação e realizado"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / PDF")), /*#__PURE__*/React.createElement(PainelSobrecarga, {
    segs: filtrados,
    db: db,
    update: update,
    usuario: usuario
  }), /*#__PURE__*/React.createElement(ResumoRealizado, {
    db: db,
    fIni: fIni,
    fFim: fFim,
    fDep: fDep,
    fCol: fCol
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel no-print"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fIni,
    onChange: e => setFIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fFim,
    onChange: e => setFFim(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: fDep,
    onChange: e => setFDep(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), db.departamentos.map(d => /*#__PURE__*/React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Colaborador"
  }, /*#__PURE__*/React.createElement("select", {
    value: fCol,
    onChange: e => setFCol(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), nomesColab.map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n)))), /*#__PURE__*/React.createElement(Field, {
    label: "Situação da etapa"
  }, /*#__PURE__*/React.createElement("select", {
    value: fStatus,
    onChange: e => setFStatus(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), STATUS_ETAPA.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: limpar
  }, "Limpar filtros")))), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Cronograma de Produção"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, "Emitido em ", fmtDate(todayISO()), (fIni || fFim) && ` · período ${fIni ? fmtDate(fIni) : 'início'} a ${fFim ? fmtDate(fFim) : 'fim'}`, fDep && ` · ${(db.departamentos.find(d => d.id === fDep) || {}).nome}`, fCol && ` · ${fCol}`), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Dias programados"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, dias.length)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Etapas"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, etapasUnicas)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tempo total"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, minParaHHMM(totalMin))), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Jornada"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      fontSize: 12
    }
  }, JORNADA.inicioManha, "–", JORNADA.fimManha, " · ", JORNADA.inicioTarde, "–", JORNADA.fimTarde))), dias.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma produção lançada para os filtros escolhidos. Inicie uma produção em Produção → Lançamento de produção."
  }) : dias.map(data => {
    const deps = porDia[data];
    const totalDia = Object.values(deps).reduce((s, g) => s + g.itens.reduce((a, b) => a + b.min, 0), 0);
    const cap = capacidadeDoDia(data);
    return /*#__PURE__*/React.createElement("div", {
      key: data,
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement("h4", null, ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diaSemana(data)], ", ", fmtDate(data), /*#__PURE__*/React.createElement("span", {
      className: "small muted",
      style: {
        fontWeight: 400
      }
    }, " · ", minParaHHMM(totalDia), " programados · ", cap.rotulo)), Object.values(deps).map((g, gi) => {
      // dentro do departamento, agrupa por colaborador
      const porCol = {};
      g.itens.forEach(sg => {
        sg.responsaveis.forEach(n => {
          if (!porCol[n]) porCol[n] = [];
          porCol[n].push(sg);
        });
      });
      return /*#__PURE__*/React.createElement("div", {
        key: gi,
        style: {
          marginBottom: 10
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '8px 0 4px 0'
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          width: 5,
          height: 14,
          background: 'var(--thread)',
          borderRadius: 3
        }
      }), /*#__PURE__*/React.createElement("strong", {
        style: {
          fontFamily: 'var(--display)',
          fontSize: 13
        }
      }, g.dep ? g.dep.nome : 'Sem departamento')), Object.entries(porCol).map(([nome, itens]) => {
        const minCol = itens.reduce((a, b) => a + b.min, 0);
        return /*#__PURE__*/React.createElement("div", {
          key: nome,
          style: {
            marginBottom: 8
          }
        }, /*#__PURE__*/React.createElement("div", {
          className: "small",
          style: {
            margin: '4px 0',
            fontWeight: 600
          }
        }, "👤 ", nome, " ", /*#__PURE__*/React.createElement("span", {
          className: "muted",
          style: {
            fontWeight: 400
          }
        }, "· ", minParaHHMM(minCol))), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Horário"), /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", {
          className: "num"
        }, "Qtd."), /*#__PURE__*/React.createElement("th", {
          className: "num"
        }, "Concluído"), /*#__PURE__*/React.createElement("th", null, "Situação"), /*#__PURE__*/React.createElement("th", {
          className: "no-print"
        }))), /*#__PURE__*/React.createElement("tbody", null, itens.sort((a, b) => a.ini - b.ini).map((sg, i) => {
          const et = sg.etapa;
          const tone = et.status === 'Concluída' ? 'ok' : et.status === 'Em andamento' ? 'warn' : 'idle';
          const qtdBase = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(sg.op.quantidade);
          const temAnexo = (et.anexos || []).length > 0;
          return /*#__PURE__*/React.createElement("tr", {
            key: i
          }, /*#__PURE__*/React.createElement("td", {
            className: "small",
            style: {
              fontFamily: 'var(--mono)'
            }
          }, hhmm(sg.ini), "–", hhmm(sg.fim)), /*#__PURE__*/React.createElement("td", {
            className: "small"
          }, /*#__PURE__*/React.createElement("strong", null, rotuloOP(sg.op))), /*#__PURE__*/React.createElement("td", {
            className: "small"
          }, sg.produto ? sg.produto.nome : '—'), /*#__PURE__*/React.createElement("td", {
            className: "small"
          }, et.nome, et.observacao && ' 📝', temAnexo && ' 📎'), /*#__PURE__*/React.createElement("td", {
            className: "small muted"
          }, sg.maq ? sg.maq.codigo : '—'), /*#__PURE__*/React.createElement("td", {
            className: "num"
          }, qtdBase), /*#__PURE__*/React.createElement("td", {
            className: "num"
          }, num(et.qtdConcluida) || '—'), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
            tone: tone
          }, et.status)), /*#__PURE__*/React.createElement("td", {
            className: "no-print"
          }, /*#__PURE__*/React.createElement("button", {
            className: "btn ghost sm",
            onClick: () => setDetalhe({
              opId: sg.op.id,
              etapaIdx: sg.etapaIdx
            })
          }, "Abrir")));
        }))));
      }));
    }));
  }), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, "Responsável pela programação"), /*#__PURE__*/React.createElement("div", null, "Supervisão de produção"))), etapaAberta && /*#__PURE__*/React.createElement(EtapaCronogramaModal, {
    op: etapaAberta.op,
    etapa: etapaAberta.et,
    idx: etapaAberta.idx,
    db: db,
    update: update,
    onClose: () => setDetalhe(null)
  }));
}

/* ==========================================================
   ETAPA NO CRONOGRAMA — observação, anexos e finalização
========================================================== */
/* Comparativo previsto × realizado, alimentado pelos apontamentos de produção */
/* Só aparece quando algum dia passa da jornada — aí sim oferece a autorização
   para estender o expediente ou usar o sábado. */
function PainelSobrecarga({
  segs,
  db,
  update,
  usuario
}) {
  const casos = sobrecargaPorDia(segs || []);
  if (casos.length === 0) return null;
  function autorizar(c) {
    const quem = usuario && usuario.nome || '';
    if (!podeExecutar(usuario, 'cadastros')) {
      alert('Somente gestores e administradores podem autorizar carga acima da jornada.');
      return;
    }
    if (!confirm(`Autorizar ${c.colaborador} a trabalhar ${minParaHHMM(c.min)} em ${fmtDate(c.data)}?\n\nJornada normal: ${minParaHHMM(c.limite)} · excedente: ${minParaHHMM(c.excedente)}.`)) return;
    update(d => {
      d.aprovacoesCarga = [...(d.aprovacoesCarga || []), {
        id: uid(),
        data: c.data,
        colaborador: c.colaborador,
        aprovador: quem,
        observacao: `carga de ${minParaHHMM(c.min)} (limite ${minParaHHMM(c.limite)})`,
        criadoEm: agoraISO()
      }];
      registrarLog(d, usuario, 'Autorizou carga acima da jornada', `${c.colaborador} · ${fmtDate(c.data)} · ${minParaHHMM(c.min)}`);
      return d;
    });
  }
  function jaAutorizado(c) {
    return (db.aprovacoesCarga || []).some(a => a.data === c.data && a.colaborador === c.colaborador);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: 'var(--bad)',
      background: 'var(--bad-bg)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: 'var(--bad)'
    }
  }, "⚠ Demanda acima da jornada de trabalho"), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      marginBottom: 10
    }
  }, "A programação de ", casos.length, " colaborador(es)/dia ultrapassa a jornada. Trabalhar além disso — estender até ", JORNADA.extensaoAte, " ou usar o sábado (", JORNADA.sabadoInicio, "–", JORNADA.sabadoFim, ") — exige autorização de um superior."), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Data"), /*#__PURE__*/React.createElement("th", null, "Colaborador"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Programado"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Jornada"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Excedente"), /*#__PURE__*/React.createElement("th", null, "Situação"), /*#__PURE__*/React.createElement("th", {
    className: "no-print"
  }))), /*#__PURE__*/React.createElement("tbody", null, casos.map((c, i) => {
    const ok = jaAutorizado(c);
    const acimaTeto = c.min > c.cap.maximo;
    return /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.data), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][diaSemana(c.data)])), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, c.colaborador)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, minParaHHMM(c.min)), /*#__PURE__*/React.createElement("td", {
      className: "num muted"
    }, minParaHHMM(c.limite)), /*#__PURE__*/React.createElement("td", {
      className: "num",
      style: {
        color: 'var(--bad)',
        fontWeight: 700
      }
    }, "+", minParaHHMM(c.excedente)), /*#__PURE__*/React.createElement("td", null, acimaTeto ? /*#__PURE__*/React.createElement(Badge, {
      tone: "bad"
    }, "Acima do teto de ", minParaHHMM(c.cap.maximo)) : ok ? /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Autorizado") : /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, "Aguardando autorização")), /*#__PURE__*/React.createElement("td", {
      className: "no-print"
    }, !ok && !acimaTeto && /*#__PURE__*/React.createElement("button", {
      className: "btn accent sm",
      onClick: () => autorizar(c)
    }, "Autorizar"), acimaTeto && /*#__PURE__*/React.createElement("span", {
      className: "small muted"
    }, "redistribua a carga")));
  }))));
}
function ResumoRealizado({
  db,
  fIni,
  fFim,
  fDep,
  fCol
}) {
  const aps = (db.apontamentos || []).filter(a => {
    if (!a.fim) return false;
    const dia = String(a.fim).slice(0, 10);
    if (fIni && dia < fIni) return false;
    if (fFim && dia > fFim) return false;
    if (fDep && (a.departamentoId || '') !== fDep) return false;
    if (fCol && !(a.equipe || [a.colaborador]).some(n => normaliza(n) === normaliza(fCol))) return false;
    return true;
  });
  if (aps.length === 0) return null;
  const boas = aps.reduce((s, a) => s + num(a.qtdBoas), 0);
  const defeito = aps.reduce((s, a) => s + num(a.qtdDefeito), 0);
  const retrab = aps.reduce((s, a) => s + num(a.qtdRetrabalho), 0);
  const minReal = aps.reduce((s, a) => s + num(a.minReais), 0);
  const minPrev = aps.reduce((s, a) => {
    const p = (a.equipe || [a.colaborador]).length || 1;
    return s + num(a.minPorPeca) * num(a.qtdBoas) / p;
  }, 0);
  const ef = minReal > 0 ? minPrev / minReal * 100 : 0;
  const cls = classificarEficiencia(ef);
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Realizado no período ", /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, aps.length, " apontamentos")), /*#__PURE__*/React.createElement("div", {
    className: "painel-meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Peças boas"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, boas)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Defeito / retrabalho"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, defeito, " / ", retrab)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tempo previsto"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, minParaHHMM(minPrev))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Tempo real"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, minParaHHMM(minReal))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Eficiência"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      color: cls.tone === 'ok' ? 'var(--ok)' : cls.tone === 'warn' ? 'var(--warn)' : 'var(--bad)'
    }
  }, ef.toFixed(1), "% · ", cls.nota))));
}
function EtapaCronogramaModal({
  op,
  etapa,
  idx,
  db,
  update,
  onClose
}) {
  const [obs, setObs] = useState(etapa.observacao || '');
  const [qtdFinal, setQtdFinal] = useState('');
  const dep = db.departamentos.find(d => d.id === etapa.departamentoId);
  const maq = (db.equipamentos || []).find(q => q.id === etapa.equipamentoId);
  const produto = db.produtos.find(p => p.id === op.produtoId);
  const qtdBase = num(etapa.qtdRecebida) > 0 ? num(etapa.qtdRecebida) : num(op.quantidade);
  const jaFeito = num(etapa.qtdConcluida);
  const restante = Math.max(qtdBase - jaFeito, 0);
  function patchEtapa(patch) {
    update(d => {
      d.ops = d.ops.map(o => {
        if (o.id !== op.id) return o;
        const etapas = o.etapas.slice();
        etapas[idx] = {
          ...etapas[idx],
          ...patch
        };
        return {
          ...o,
          etapas
        };
      });
      return d;
    });
  }
  function salvarObs() {
    patchEtapa({
      observacao: obs
    });
  }
  async function onArquivo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) url = await comprimirImagem(file);else {
        if (file.size > 300 * 1024) {
          alert('Documento muito grande (máx. 300 KB).');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler.'));
          r.readAsDataURL(file);
        });
      }
      patchEtapa({
        anexos: [...(etapa.anexos || []), {
          id: uid(),
          nome: file.name,
          tipo: ehImagem ? 'imagem' : 'documento',
          url,
          quando: agoraISO()
        }]
      });
    } catch (err) {
      alert('Não foi possível anexar: ' + (err && err.message));
    }
  }
  function rmAnexo(id) {
    patchEtapa({
      anexos: (etapa.anexos || []).filter(a => a.id !== id)
    });
  }
  function finalizar(tipo) {
    const q = tipo === 'total' ? restante : num(qtdFinal);
    if (tipo === 'parcial' && (q <= 0 || q > restante)) {
      alert(`Informe uma quantidade entre 1 e ${restante}.`);
      return;
    }
    const novoTotal = jaFeito + q;
    const completou = novoTotal >= qtdBase;
    const registro = {
      id: uid(),
      quando: agoraISO(),
      tipo,
      quantidade: q,
      acumulado: novoTotal,
      observacao: obs
    };
    patchEtapa({
      qtdConcluida: novoTotal,
      status: completou ? 'Concluída' : 'Em andamento',
      dataConclusao: completou ? todayISO() : '',
      observacao: obs,
      finalizacoes: [...(etapa.finalizacoes || []), registro]
    });
    setQtdFinal('');
    if (!completou) {
      alert(`Produção parcial registrada: ${q} peça(s). Restam ${qtdBase - novoTotal} — a etapa e a OP continuam em aberto.`);
    }
    onClose();
  }
  const finalizacoes = etapa.finalizacoes || [];
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${rotuloOP(op)} · ${etapa.nome}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 12
    }
  }, produto ? produto.nome : '—', " · ", dep ? dep.nome : 'sem departamento', " · ", maq ? `${maq.codigo} · ${maq.nome}` : 'sem equipamento', ' · ', "Responsável: ", /*#__PURE__*/React.createElement("strong", null, responsaveisEtapa(etapa).join(', ') || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid",
    style: {
      gridTemplateColumns: 'repeat(4,1fr)',
      display: 'grid',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Quantidade"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, qtdBase)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Concluído"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, jaFeito)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Restante"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      color: restante > 0 ? 'var(--bad)' : 'var(--ok)'
    }
  }, restante)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Situação"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      fontSize: 14
    }
  }, etapa.status))), /*#__PURE__*/React.createElement(Field, {
    label: "Observação da etapa"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "3",
    value: obs,
    onChange: e => setObs(e.target.value),
    placeholder: "Ocorrências, ajustes, defeitos encontrados…"
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: salvarObs,
    style: {
      marginBottom: 14
    }
  }, "Salvar observação"), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Anexar foto ou arquivo"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*,.pdf,.doc,.docx,.xls,.xlsx",
    onChange: onArquivo
  }), (etapa.anexos || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10
    }
  }, (etapa.anexos || []).map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: {
      width: 130,
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: 8,
      background: '#fff'
    }
  }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    src: a.url,
    alt: a.nome,
    style: {
      width: '100%',
      height: 80,
      objectFit: 'cover',
      borderRadius: 4
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      height: 80,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0ede6',
      borderRadius: 4,
      fontSize: 26
    }
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      wordBreak: 'break-word',
      margin: '6px 0'
    }
  }, a.nome), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 6
    }
  }, a.quando || ''), /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: () => rmAnexo(a.id)
  }, "Remover"))))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      background: '#fff'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Finalizar produção"), restante <= 0 ? /*#__PURE__*/React.createElement("div", {
    className: "small",
    style: {
      color: 'var(--ok)',
      fontWeight: 600
    }
  }, "Etapa concluída — ", jaFeito, " de ", qtdBase, " peças.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: `Quantidade produzida (restam ${restante})`
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    min: "1",
    max: restante,
    value: qtdFinal,
    onChange: e => setQtdFinal(e.target.value),
    placeholder: String(restante)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => finalizar('parcial'),
    disabled: !qtdFinal
  }, "Finalizar parcial"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => finalizar('total')
  }, "Finalizar total (", restante, ")"))), /*#__PURE__*/React.createElement("div", {
    className: "small muted"
  }, "Na finalização parcial a etapa fica ", /*#__PURE__*/React.createElement("strong", null, "Em andamento"), " e a Ordem de Produção permanece ", /*#__PURE__*/React.createElement("strong", null, "em aberto"), " com o saldo restante."))), finalizacoes.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px 0 18px'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Histórico de apontamentos")), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Quando"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Quantidade"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Acumulado"), /*#__PURE__*/React.createElement("th", null, "Observação"))), /*#__PURE__*/React.createElement("tbody", null, finalizacoes.slice().reverse().map(x => /*#__PURE__*/React.createElement("tr", {
    key: x.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, x.quando), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    tone: x.tipo === 'total' ? 'ok' : 'warn'
  }, x.tipo === 'total' ? 'Total' : 'Parcial')), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, x.quantidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, x.acumulado, "/", qtdBase), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, x.observacao || '—')))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar")));
}
function AprovacaoModal({
  row,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    data: row.data,
    colaborador: row.colaborador,
    aprovador: '',
    observacao: ''
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Solicitar aprovação de carga horária",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 14
    }
  }, row.colaborador, " está programado com ", /*#__PURE__*/React.createElement("strong", null, minParaHHMM(row.totalMin)), " em ", fmtDate(row.data), ehSabado(row.data) ? ' — trabalho aos sábados exige autorização de superior.' : `, acima da jornada normal de ${minParaHHMM(LIMITE_CARGA_MIN)} (extensão permitida até ${JORNADA.extensaoAte}).`, ' ', "Informe quem está autorizando."), /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Aprovado por (superior)"
  }, /*#__PURE__*/React.createElement("input", {
    value: f.aprovador,
    onChange: e => set('aprovador', e.target.value),
    placeholder: "Nome do gestor/administrador"
  }))), /*#__PURE__*/React.createElement(Field, {
    label: "Observação (opcional)"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacao,
    onChange: e => set('observacao', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.aprovador
  }, "Aprovar carga")));
}

/* ==========================================================
   ORÇAMENTOS DE COMPRA — propostas e comparativo
========================================================== */
function totalProposta(p, quantidade) {
  return num(p.valorUnitario) * num(quantidade) + num(p.frete);
}
function analisarPropostas(orc) {
  const props = orc.propostas || [];
  if (props.length === 0) return {
    props: [],
    melhorPreco: null,
    melhorPrazo: null,
    recomendada: null
  };
  const comTotal = props.map(p => ({
    ...p,
    total: totalProposta(p, orc.quantidade)
  }));
  const menorTotal = Math.min(...comTotal.map(p => p.total));
  const prazos = comTotal.map(p => num(p.prazoEntregaDias)).filter(n => n > 0);
  const menorPrazo = prazos.length ? Math.min(...prazos) : null;
  const maiorTotal = Math.max(...comTotal.map(p => p.total));
  const analisadas = comTotal.map(p => {
    const economia = maiorTotal - p.total;
    const percAcima = menorTotal > 0 ? (p.total - menorTotal) / menorTotal * 100 : 0;
    const vantagens = [];
    if (p.total === menorTotal) vantagens.push('menor preço total');
    if (menorPrazo !== null && num(p.prazoEntregaDias) === menorPrazo) vantagens.push('entrega mais rápida');
    if (num(p.frete) === 0) vantagens.push('sem frete');
    return {
      ...p,
      economia,
      percAcima,
      vantagens
    };
  });

  // recomendação: menor preço; em empate de preço, menor prazo
  const recomendada = analisadas.slice().sort((a, b) => a.total === b.total ? num(a.prazoEntregaDias) - num(b.prazoEntregaDias) : a.total - b.total)[0];
  return {
    props: analisadas,
    menorTotal,
    menorPrazo,
    recomendada
  };
}
function Orcamentos({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  const [abertoId, setAbertoId] = useState(null);
  const orcamentos = db.orcamentos || [];
  const aberto = orcamentos.find(o => o.id === abertoId);
  function save(o) {
    update(d => {
      if (o.id) {
        d.orcamentos = d.orcamentos.map(x => x.id === o.id ? o : x);
      } else {
        const numero = d.seq.orcamento = (d.seq.orcamento || 100) + 1;
        d.orcamentos = [...(d.orcamentos || []), {
          ...o,
          id: uid(),
          numero,
          propostas: []
        }];
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir este orçamento e todas as suas propostas?')) return;
    update(d => {
      d.orcamentos = d.orcamentos.filter(o => o.id !== id);
      return d;
    });
    if (abertoId === id) setAbertoId(null);
  }
  function salvarPropostas(orcId, propostas) {
    update(d => {
      d.orcamentos = d.orcamentos.map(o => o.id === orcId ? {
        ...o,
        propostas
      } : o);
      return d;
    });
  }
  function gerarCompra(orc, proposta) {
    if (!confirm(`Gerar pedido de compra com a proposta de ${proposta.fornecedor}?`)) return;
    update(d => {
      const numero = d.seq.compra++;
      d.compras.push({
        id: uid(),
        numero,
        materialId: orc.materialId,
        quantidade: orc.quantidade,
        fornecedor: proposta.fornecedor,
        valor: totalProposta(proposta, orc.quantidade),
        dataPedido: todayISO(),
        previsaoChegada: '',
        status: 'Solicitado'
      });
      d.orcamentos = d.orcamentos.map(o => o.id === orc.id ? {
        ...o,
        status: 'Fechado',
        propostaEscolhidaId: proposta.id
      } : o);
      return d;
    });
    alert('Pedido de compra gerado na aba Compras.');
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Orçamentos e cotações"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({}),
    disabled: db.materiais.length === 0
  }, "+ Novo orçamento")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, orcamentos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum orçamento aberto. Crie um orçamento e cadastre as propostas dos fornecedores para comparar."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Data"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Propostas"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Melhor preço"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, orcamentos.slice().sort((a, b) => b.numero - a.numero).map(o => {
    const mat = db.materiais.find(m => m.id === o.materialId);
    const an = analisarPropostas(o);
    return /*#__PURE__*/React.createElement("tr", {
      key: o.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", o.numero), /*#__PURE__*/React.createElement("td", null, mat ? mat.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, o.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(o.data)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, (o.propostas || []).length), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, an.recomendada ? money(an.recomendada.total) : /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, "—")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: o.status === 'Fechado' ? 'ok' : 'warn'
    }, o.status || 'Em cotação')), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setAbertoId(o.id)
    }, "Propostas"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(o.id)
    }, "Excluir")));
  })))), orcamentos.length > 0 && /*#__PURE__*/React.createElement(RelatorioMelhorCompra, {
    db: db,
    orcamentos: orcamentos
  }), modal !== null && /*#__PURE__*/React.createElement(OrcamentoModal, {
    orc: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }), aberto && /*#__PURE__*/React.createElement(PropostasModal, {
    orc: aberto,
    db: db,
    onClose: () => setAbertoId(null),
    onSave: salvarPropostas,
    onGerarCompra: gerarCompra
  }));
}
function OrcamentoModal({
  orc,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    materialId: db.materiais[0]?.id || '',
    quantidade: 1,
    data: todayISO(),
    observacao: '',
    status: 'Em cotação',
    ...orc
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: orc.id ? 'Editar orçamento' : 'Novo orçamento',
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Material"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.materialId,
    onChange: e => set('materialId', e.target.value)
  }, db.materiais.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.codigo, " · ", m.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade a cotar"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.quantidade,
    onChange: e => set('quantidade', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.data,
    onChange: e => set('data', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Status"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.status,
    onChange: e => set('status', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "Em cotação"
  }, "Em cotação"), /*#__PURE__*/React.createElement("option", {
    value: "Fechado"
  }, "Fechado")))), /*#__PURE__*/React.createElement(Field, {
    label: "Observação"
  }, /*#__PURE__*/React.createElement("textarea", {
    rows: "2",
    value: f.observacao,
    onChange: e => set('observacao', e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.materialId
  }, "Salvar")));
}
function PropostasModal({
  orc,
  db,
  onClose,
  onSave,
  onGerarCompra
}) {
  const [props, setProps] = useState(() => JSON.parse(JSON.stringify(orc.propostas || [])));
  const [dirty, setDirty] = useState(false);
  const mat = db.materiais.find(m => m.id === orc.materialId);
  const an = analisarPropostas({
    ...orc,
    propostas: props
  });
  function add() {
    setProps(p => [...p, {
      id: uid(),
      fornecedor: '',
      valorUnitario: 0,
      frete: 0,
      prazoEntregaDias: 0,
      condicaoPagamento: '',
      observacao: ''
    }]);
    setDirty(true);
  }
  function upd(i, patch) {
    setProps(p => {
      const a = p.slice();
      a[i] = {
        ...a[i],
        ...patch
      };
      return a;
    });
    setDirty(true);
  }
  function rm(i) {
    if (!confirm('Remover esta proposta?')) return;
    setProps(p => p.filter((_, x) => x !== i));
    setDirty(true);
  }
  function salvar() {
    onSave(orc.id, props);
    setDirty(false);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Orçamento #${orc.numero} — ${mat ? mat.nome : ''}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginBottom: 14
    }
  }, "Quantidade cotada: ", /*#__PURE__*/React.createElement("strong", null, orc.quantidade, " ", mat ? mat.unidade : ''), mat && num(mat.custo) > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " · Custo atual cadastrado: ", /*#__PURE__*/React.createElement("strong", null, money(num(mat.custo) * num(orc.quantidade))), " no total")), props.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma proposta cadastrada. Adicione as propostas recebidas dos fornecedores para comparar."
  }), props.map((p, i) => {
    const analise = an.props.find(x => x.id === p.id) || {};
    const melhor = an.recomendada && an.recomendada.id === p.id;
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      className: "panel",
      style: {
        marginBottom: 10,
        borderColor: melhor ? 'var(--ok)' : 'var(--line)',
        background: melhor ? 'var(--ok-bg)' : 'var(--canvas-panel)'
      }
    }, /*#__PURE__*/React.createElement("h3", null, "Proposta ", i + 1, melhor && /*#__PURE__*/React.createElement("span", {
      className: "badge ok"
    }, /*#__PURE__*/React.createElement("span", {
      className: "dot"
    }), "Melhor opção")), /*#__PURE__*/React.createElement("div", {
      className: "grid3"
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Fornecedor"
    }, /*#__PURE__*/React.createElement("select", {
      value: p.fornecedor,
      onChange: e => upd(i, {
        fornecedor: e.target.value
      })
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Selecione…"), db.fornecedores.map(x => /*#__PURE__*/React.createElement("option", {
      key: x.id,
      value: x.nome
    }, x.nome)), p.fornecedor && !db.fornecedores.some(x => x.nome === p.fornecedor) && /*#__PURE__*/React.createElement("option", {
      value: p.fornecedor
    }, p.fornecedor))), /*#__PURE__*/React.createElement(Field, {
      label: "Valor unitário (R$)"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      step: "0.01",
      value: p.valorUnitario,
      onChange: e => upd(i, {
        valorUnitario: e.target.value
      })
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Frete (R$)"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      step: "0.01",
      value: p.frete,
      onChange: e => upd(i, {
        frete: e.target.value
      })
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Prazo de entrega (dias)"
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      value: p.prazoEntregaDias,
      onChange: e => upd(i, {
        prazoEntregaDias: e.target.value
      })
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Condição de pagamento"
    }, /*#__PURE__*/React.createElement("input", {
      value: p.condicaoPagamento,
      onChange: e => upd(i, {
        condicaoPagamento: e.target.value
      }),
      placeholder: "30/60 dias"
    })), /*#__PURE__*/React.createElement(Field, {
      label: "Observação"
    }, /*#__PURE__*/React.createElement("input", {
      value: p.observacao,
      onChange: e => upd(i, {
        observacao: e.target.value
      })
    }))), /*#__PURE__*/React.createElement("div", {
      className: "small",
      style: {
        marginBottom: 8
      }
    }, "Total: ", /*#__PURE__*/React.createElement("strong", null, money(analise.total || 0)), analise.percAcima > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--bad)'
      }
    }, " · ", analise.percAcima.toFixed(1), "% acima da melhor"), analise.vantagens && analise.vantagens.length > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--ok)'
      }
    }, " · Vantagens: ", analise.vantagens.join(', '))), /*#__PURE__*/React.createElement("div", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => rm(i)
    }, "Remover proposta"), !dirty && p.fornecedor && /*#__PURE__*/React.createElement("button", {
      className: "btn accent sm",
      onClick: () => onGerarCompra(orc, {
        ...p,
        total: analise.total
      })
    }, "Fechar compra com este")));
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: add
  }, "+ Adicionar proposta"), an.props.length > 1 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Comparativo"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Fornecedor"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Unitário"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Frete"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Prazo"), /*#__PURE__*/React.createElement("th", null, "Vantagens"))), /*#__PURE__*/React.createElement("tbody", null, an.props.slice().sort((a, b) => a.total - b.total).map(p => /*#__PURE__*/React.createElement("tr", {
    key: p.id
  }, /*#__PURE__*/React.createElement("td", null, p.fornecedor || '—', " ", an.recomendada.id === p.id && /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, "melhor")), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(p.valorUnitario)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(p.frete)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, /*#__PURE__*/React.createElement("strong", null, money(p.total))), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, num(p.prazoEntregaDias) || '—', " d"), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, p.vantagens.join(', ') || '—')))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: salvar,
    disabled: !dirty
  }, "Salvar propostas")));
}
function RelatorioMelhorCompra({
  db,
  orcamentos
}) {
  const linhas = orcamentos.map(o => {
    const an = analisarPropostas(o);
    const mat = db.materiais.find(m => m.id === o.materialId);
    if (!an.recomendada) return null;
    const maior = Math.max(...an.props.map(p => p.total));
    return {
      orc: o,
      mat,
      melhor: an.recomendada,
      economia: maior - an.recomendada.total,
      qtdPropostas: an.props.length
    };
  }).filter(Boolean);
  const economiaTotal = linhas.reduce((s, l) => s + l.economia, 0);
  return /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Relatório de melhor compra"), linhas.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Cadastre propostas nos orçamentos para gerar o comparativo de melhor compra."
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Orç."), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Propostas"), /*#__PURE__*/React.createElement("th", null, "Melhor fornecedor"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Prazo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Economia"))), /*#__PURE__*/React.createElement("tbody", null, linhas.map(l => /*#__PURE__*/React.createElement("tr", {
    key: l.orc.id
  }, /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, "#", l.orc.numero), /*#__PURE__*/React.createElement("td", null, l.mat ? l.mat.nome : '—'), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, l.orc.quantidade), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, l.qtdPropostas), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, l.melhor.fornecedor || '—')), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(l.melhor.total)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, num(l.melhor.prazoEntregaDias) || '—', " d"), /*#__PURE__*/React.createElement("td", {
    className: "num",
    style: {
      color: 'var(--ok)'
    }
  }, l.economia > 0 ? money(l.economia) : '—'))))), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 10
    }
  }, "Economia potencial somada (comparando a melhor proposta com a mais cara de cada orçamento): ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--ok)'
    }
  }, money(economiaTotal)))));
}

/* ==========================================================
   7. COMPRAS
========================================================== */
function Compras({
  db,
  update
}) {
  const [modal, setModal] = useState(null);
  function save(c) {
    update(d => {
      if (c.id) {
        d.compras = d.compras.map(x => x.id === c.id ? c : x);
      } else {
        const numero = d.seq.compra++;
        d.compras.push({
          ...c,
          id: uid(),
          numero
        });
      }
      return d;
    });
    setModal(null);
  }
  function remove(id) {
    if (!confirm('Excluir esta compra?')) return;
    update(d => {
      d.compras = d.compras.filter(c => c.id !== id);
      return d;
    });
  }
  function avancarStatus(c) {
    const idx = STATUS_COMPRA.indexOf(c.status);
    const novo = STATUS_COMPRA[Math.min(idx + 1, STATUS_COMPRA.length - 1)];
    update(d => {
      d.compras = d.compras.map(x => x.id === c.id ? {
        ...x,
        status: novo
      } : x);
      if (novo === 'Recebido') {
        const mat = d.materiais.find(m => m.id === c.materialId);
        if (mat) {
          mat.estoqueAtual = num(mat.estoqueAtual) + num(c.quantidade);
        }
        d.movimentacoes.push({
          id: uid(),
          tipo: 'Entrada',
          materialId: c.materialId,
          quantidade: c.quantidade,
          opId: null,
          data: todayISO(),
          origem: `Compra #${c.numero}`
        });
      }
      return d;
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Compras de materiais"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal({}),
    disabled: db.materiais.length === 0
  }, "+ Nova compra")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, db.compras.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma compra registrada."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Fornecedor"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Valor"), /*#__PURE__*/React.createElement("th", null, "Data pedido"), /*#__PURE__*/React.createElement("th", null, "Previsão"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, db.compras.slice().sort((a, b) => b.numero - a.numero).map(c => {
    const mat = db.materiais.find(m => m.id === c.materialId);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", c.numero), /*#__PURE__*/React.createElement("td", null, mat ? mat.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, c.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, c.fornecedor), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(c.valor)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.dataPedido)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.previsaoChegada)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusCompraBadge, {
      status: c.status
    })), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setModal(c)
    }, "Editar"), c.status !== 'Recebido' && /*#__PURE__*/React.createElement("button", {
      className: "btn accent sm",
      onClick: () => avancarStatus(c)
    }, "Avançar"), /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => remove(c.id)
    }, "Excluir")));
  })))), modal !== null && /*#__PURE__*/React.createElement(CompraModal, {
    compra: modal,
    db: db,
    onClose: () => setModal(null),
    onSave: save
  }));
}
function StatusCompraBadge({
  status
}) {
  const tone = status === 'Recebido' ? 'ok' : status === 'Comprado' ? 'info' : 'warn';
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone
  }, status);
}
function CompraModal({
  compra,
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    materialId: db.materiais[0]?.id || '',
    quantidade: 1,
    fornecedor: '',
    fornecedorId: '',
    valor: 0,
    dataPedido: todayISO(),
    previsaoChegada: '',
    status: 'Solicitado',
    ...compra
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: compra.id ? 'Editar compra' : 'Nova compra',
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Material"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.materialId,
    onChange: e => set('materialId', e.target.value)
  }, db.materiais.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: f.quantidade,
    onChange: e => set('quantidade', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Fornecedor"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.fornecedorId || '',
    onChange: e => {
      const forn = db.fornecedores.find(x => x.id === e.target.value);
      setF(prev => ({
        ...prev,
        fornecedorId: e.target.value,
        fornecedor: forn ? forn.nome : ''
      }));
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, f.fornecedor && !f.fornecedorId ? f.fornecedor : '— selecione —'), db.fornecedores.map(x => /*#__PURE__*/React.createElement("option", {
    key: x.id,
    value: x.id
  }, x.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Valor total (R$)"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.valor,
    onChange: e => set('valor', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data do pedido"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.dataPedido,
    onChange: e => set('dataPedido', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Previsão de chegada"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.previsaoChegada,
    onChange: e => set('previsaoChegada', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Status"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.status,
    onChange: e => set('status', e.target.value)
  }, STATUS_COMPRA.map(s => /*#__PURE__*/React.createElement("option", {
    key: s,
    value: s
  }, s))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.materialId
  }, "Salvar")));
}

/* ==========================================================
   8. ESTOQUE
========================================================== */
function Estoque({
  db,
  update
}) {
  const [modal, setModal] = useState(false);
  const [fMat, setFMat] = useState('');
  const [fCat, setFCat] = useState('');
  const [fSit, setFSit] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fIni, setFIni] = useState('');
  const [fFim, setFFim] = useState('');
  const [fOp, setFOp] = useState('');
  const [q, setQ] = useState('');
  const materiaisFiltrados = db.materiais.filter(m => {
    if (fCat && m.categoriaId !== fCat) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(m.nome || '').toLowerCase().includes(s) && !(m.codigo || '').toLowerCase().includes(s)) return false;
    }
    const baixo = num(m.estoqueAtual) <= num(m.estoqueMinimo);
    if (fSit === 'baixo' && !baixo) return false;
    if (fSit === 'normal' && baixo) return false;
    return true;
  });
  const movsFiltradas = db.movimentacoes.filter(mv => {
    if (fMat && mv.materialId !== fMat) return false;
    if (fTipo && mv.tipo !== fTipo) return false;
    if (fIni && mv.data < fIni) return false;
    if (fFim && mv.data > fFim) return false;
    if (fOp === 'com' && !mv.opId) return false;
    if (fOp === 'sem' && mv.opId) return false;
    return true;
  });
  function limpar() {
    setFMat('');
    setFCat('');
    setFSit('');
    setFTipo('');
    setFIni('');
    setFFim('');
    setFOp('');
    setQ('');
  }
  function excluirMov(mv) {
    if (!confirm('Excluir esta movimentação? O estoque do material será estornado.')) return;
    update(d => {
      const mat = d.materiais.find(m => m.id === mv.materialId);
      if (mat) {
        if (mv.tipo === 'Entrada' || mv.tipo === 'Devolução') mat.estoqueAtual = num(mat.estoqueAtual) - num(mv.quantidade);
        if (mv.tipo === 'Saída') mat.estoqueAtual = num(mat.estoqueAtual) + num(mv.quantidade);
      }
      d.movimentacoes = d.movimentacoes.filter(x => x.id !== mv.id);
      return d;
    });
  }
  function registrar(mv) {
    update(d => {
      const mat = d.materiais.find(m => m.id === mv.materialId);
      if (mat) {
        if (mv.tipo === 'Entrada' || mv.tipo === 'Devolução') mat.estoqueAtual = num(mat.estoqueAtual) + num(mv.quantidade);
        if (mv.tipo === 'Saída') mat.estoqueAtual = num(mat.estoqueAtual) - num(mv.quantidade);
      }
      d.movimentacoes.push({
        ...mv,
        id: uid(),
        origem: mv.opId ? `OP vinculada` : 'Manual'
      });
      return d;
    });
    setModal(false);
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Estoque & movimentações"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => setModal(true),
    disabled: db.materiais.length === 0
  }, "+ Nova movimentação")), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Buscar material"
  }, /*#__PURE__*/React.createElement("input", {
    placeholder: "Nome ou código…",
    value: q,
    onChange: e => setQ(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Categoria"
  }, /*#__PURE__*/React.createElement("select", {
    value: fCat,
    onChange: e => setFCat(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), (db.categoriasMaterial || []).map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Situação do estoque"
  }, /*#__PURE__*/React.createElement("select", {
    value: fSit,
    onChange: e => setFSit(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), /*#__PURE__*/React.createElement("option", {
    value: "baixo"
  }, "Abaixo do mínimo"), /*#__PURE__*/React.createElement("option", {
    value: "normal"
  }, "Normal"))), /*#__PURE__*/React.createElement(Field, {
    label: "Movimentação — material"
  }, /*#__PURE__*/React.createElement("select", {
    value: fMat,
    onChange: e => setFMat(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), db.materiais.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Movimentação — tipo"
  }, /*#__PURE__*/React.createElement("select", {
    value: fTipo,
    onChange: e => setFTipo(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), /*#__PURE__*/React.createElement("option", {
    value: "Entrada"
  }, "Entrada"), /*#__PURE__*/React.createElement("option", {
    value: "Saída"
  }, "Saída"), /*#__PURE__*/React.createElement("option", {
    value: "Devolução"
  }, "Devolução"))), /*#__PURE__*/React.createElement(Field, {
    label: "Vínculo com OP"
  }, /*#__PURE__*/React.createElement("select", {
    value: fOp,
    onChange: e => setFOp(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), /*#__PURE__*/React.createElement("option", {
    value: "com"
  }, "Somente com OP"), /*#__PURE__*/React.createElement("option", {
    value: "sem"
  }, "Somente sem OP"))), /*#__PURE__*/React.createElement(Field, {
    label: "Data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fIni,
    onChange: e => setFIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fFim,
    onChange: e => setFFim(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: limpar
  }, "Limpar filtros")))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Estoque atual ", /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, materiaisFiltrados.length)), materiaisFiltrados.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum material no filtro."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Estoque"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mínimo"), /*#__PURE__*/React.createElement("th", null, "Situação"))), /*#__PURE__*/React.createElement("tbody", null, materiaisFiltrados.map(m => {
    const baixo = num(m.estoqueAtual) <= num(m.estoqueMinimo);
    return /*#__PURE__*/React.createElement("tr", {
      key: m.id
    }, /*#__PURE__*/React.createElement("td", null, m.nome), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, num(m.estoqueAtual), " ", m.unidade), /*#__PURE__*/React.createElement("td", {
      className: "num muted"
    }, num(m.estoqueMinimo), " ", m.unidade), /*#__PURE__*/React.createElement("td", null, baixo ? /*#__PURE__*/React.createElement(Badge, {
      tone: "bad"
    }, "Abaixo do mínimo") : /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Normal")));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px 0 20px'
    }
  }, /*#__PURE__*/React.createElement("h3", null, "Movimentações ", /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, movsFiltradas.length))), movsFiltradas.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma movimentação no filtro."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Data"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Origem"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, movsFiltradas.slice().reverse().map(mv => {
    const mat = db.materiais.find(m => m.id === mv.materialId);
    const op = db.ops.find(o => o.id === mv.opId);
    const tone = mv.tipo === 'Entrada' ? 'ok' : mv.tipo === 'Saída' ? 'bad' : 'info';
    return /*#__PURE__*/React.createElement("tr", {
      key: mv.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(mv.data)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: tone
    }, mv.tipo)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, mat ? mat.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, num(mv.quantidade)), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, op ? rotuloOP(op) : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, mv.origem), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: "btn danger sm",
      onClick: () => excluirMov(mv)
    }, "Excluir")));
  })))), modal && /*#__PURE__*/React.createElement(MovimentacaoModal, {
    db: db,
    onClose: () => setModal(false),
    onSave: registrar
  }));
}
function MovimentacaoModal({
  db,
  onClose,
  onSave
}) {
  const [f, setF] = useState({
    tipo: 'Entrada',
    materialId: db.materiais[0]?.id || '',
    quantidade: 1,
    opId: '',
    data: todayISO()
  });
  const set = (k, v) => setF(prev => ({
    ...prev,
    [k]: v
  }));
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Nova movimentação de estoque",
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid2"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Tipo"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.tipo,
    onChange: e => set('tipo', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "Entrada"
  }, "Entrada (compra de material)"), /*#__PURE__*/React.createElement("option", {
    value: "Saída"
  }, "Saída (enviado para OP)"), /*#__PURE__*/React.createElement("option", {
    value: "Devolução"
  }, "Devolução (sobra volta ao estoque)"))), /*#__PURE__*/React.createElement(Field, {
    label: "Material"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.materialId,
    onChange: e => set('materialId', e.target.value)
  }, db.materiais.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.id,
    value: m.id
  }, m.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Quantidade"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    step: "0.01",
    value: f.quantidade,
    onChange: e => set('quantidade', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: f.data,
    onChange: e => set('data', e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "OP vinculada (opcional)"
  }, /*#__PURE__*/React.createElement("select", {
    value: f.opId,
    onChange: e => set('opId', e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "— nenhuma —"), db.ops.map(op => /*#__PURE__*/React.createElement("option", {
    key: op.id,
    value: op.id
  }, rotuloOP(op)))))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: () => onSave(f),
    disabled: !f.materialId
  }, "Registrar")));
}

/* ==========================================================
   Dados de teste — linha completa da camiseta
========================================================== */
function criarDadosTesteCamiseta(d) {
  // --- Departamentos ---
  const depCorte = {
    id: uid(),
    nome: 'Corte',
    responsavel: 'Supervisor de Corte',
    descricao: 'Enfesto, risco e corte do tecido'
  };
  const depSilk = {
    id: uid(),
    nome: 'Silk',
    responsavel: 'Supervisor de Gravação',
    descricao: 'Gravação silk/DTF das estampas'
  };
  const depPrep = {
    id: uid(),
    nome: 'Preparação',
    responsavel: 'Supervisor de Preparação',
    descricao: 'Separação de kits e aviamentos'
  };
  const depCostura = {
    id: uid(),
    nome: 'Costura',
    responsavel: 'Supervisora de Costura',
    descricao: 'Overlock, galoneira e reta'
  };
  const depAcab = {
    id: uid(),
    nome: 'Acabamento',
    responsavel: 'Supervisor de Acabamento',
    descricao: 'Revisão, limpeza e embalagem'
  };
  d.departamentos.push(depCorte, depSilk, depPrep, depCostura, depAcab);

  // --- Colaboradores (base para a média salarial de cada departamento) ---
  const colabs = [{
    nome: 'Ana Souza',
    funcoes: ['Cortadora', 'Supervisora de Corte'],
    departamentoId: depCorte.id,
    salario: 2400,
    perfil: 'Gestor'
  }, {
    nome: 'Marcos Vieira',
    funcoes: ['Vendedor'],
    departamentoId: '',
    salario: 2800
  }, {
    nome: 'Bruno Lima',
    cargo: 'Enfestador',
    departamentoId: depCorte.id,
    salario: 2200
  }, {
    nome: 'Carla Dias',
    cargo: 'Gravadora',
    departamentoId: depSilk.id,
    salario: 2300
  }, {
    nome: 'Diego Alves',
    cargo: 'Auxiliar Silk',
    departamentoId: depSilk.id,
    salario: 2000
  }, {
    nome: 'Eliane Costa',
    cargo: 'Auxiliar',
    departamentoId: depPrep.id,
    salario: 1900
  }, {
    nome: 'Fábio Ramos',
    funcoes: ['Costureiro', 'Mecânico de máquinas'],
    departamentoId: depCostura.id,
    salario: 2600
  }, {
    nome: 'Gabriela Nunes',
    cargo: 'Costureira',
    departamentoId: depCostura.id,
    salario: 2500
  }, {
    nome: 'Helena Prado',
    cargo: 'Costureira',
    departamentoId: depCostura.id,
    salario: 2450
  }, {
    nome: 'Igor Martins',
    cargo: 'Revisor',
    departamentoId: depAcab.id,
    salario: 2100
  }, {
    nome: 'Julia Freitas',
    cargo: 'Embaladora',
    departamentoId: depAcab.id,
    salario: 1950
  }];
  colabs.forEach((c, i) => {
    d.colaboradores.push({
      id: uid(),
      nome: c.nome,
      cpf: '',
      rg: '',
      dataNascimento: '',
      telefone: '',
      celular: '',
      email: '',
      cargo: '',
      funcoes: c.funcoes || (c.cargo ? [c.cargo] : []),
      departamentoId: c.departamentoId,
      dataAdmissao: '2025-03-01',
      salario: c.salario,
      status: 'Ativo',
      perfil: c.perfil || 'Colaborador',
      precisaTrocarSenha: true,
      // cada um define a senha no 1º acesso
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      observacoes: ''
    });
  });
  garantirAdminPadrao(d);

  // --- Materiais ---
  // --- Classificações ---
  const catTecido = {
    id: uid(),
    codigo: 'TEC',
    nome: 'Tecidos'
  };
  const catAviamento = {
    id: uid(),
    codigo: 'AVI',
    nome: 'Aviamentos'
  };
  const catInsumo = {
    id: uid(),
    codigo: 'INS',
    nome: 'Insumos'
  };
  const catEmbal = {
    id: uid(),
    codigo: 'EMB',
    nome: 'Embalagens'
  };
  d.categoriasMaterial.push(catTecido, catAviamento, catInsumo, catEmbal);
  const catProdCam = {
    id: uid(),
    codigo: 'AVE',
    nome: 'Aventais'
  };
  const grpMalha = {
    id: uid(),
    codigo: 'OXF',
    nome: 'Oxford'
  };
  const sgPV = {
    id: uid(),
    codigo: 'PAD',
    nome: 'Padrão',
    grupoId: grpMalha.id
  };
  d.categoriasProduto.push(catProdCam);
  d.gruposProduto.push(grpMalha);
  d.subgruposProduto.push(sgPV);
  const mMalha = {
    id: uid(),
    categoriaId: catTecido.id,
    codigo: 'TEC-0001',
    nome: 'Tecido Oxford Royal',
    categoria: 'Tecido',
    cor: 'Royal',
    unidade: 'kg',
    estoqueAtual: 500,
    estoqueMinimo: 80,
    custo: 38.00,
    fornecedor: 'Malharia Central',
    localizacao: 'Prateleira A1'
  };
  const mGola = {
    id: uid(),
    categoriaId: catAviamento.id,
    codigo: 'AVI-0001',
    nome: 'Viés Preto',
    categoria: 'Aviamento',
    cor: 'Preto',
    unidade: 'm',
    estoqueAtual: 1600,
    estoqueMinimo: 300,
    custo: 4.50,
    fornecedor: 'Aviamentos SP',
    localizacao: 'Prateleira B2'
  };
  const mLinha = {
    id: uid(),
    categoriaId: catAviamento.id,
    codigo: 'AVI-0002',
    nome: 'Linha de Costura 120',
    categoria: 'Aviamento',
    cor: 'Branco',
    unidade: 'm',
    estoqueAtual: 15000,
    estoqueMinimo: 3000,
    custo: 0.02,
    fornecedor: 'Aviamentos SP',
    localizacao: 'Prateleira B3'
  };
  const mTinta = {
    id: uid(),
    categoriaId: catInsumo.id,
    codigo: 'INS-0001',
    nome: 'Tinta Plastisol Preta',
    categoria: 'Insumo',
    cor: 'Preto',
    unidade: 'kg',
    estoqueAtual: 12,
    estoqueMinimo: 4,
    custo: 95.00,
    fornecedor: 'Silk Supply',
    localizacao: 'Prateleira C1'
  };
  const mEtiqueta = {
    id: uid(),
    categoriaId: catAviamento.id,
    codigo: 'AVI-0003',
    nome: 'Etiqueta de Composição',
    categoria: 'Aviamento',
    cor: '—',
    unidade: 'un',
    estoqueAtual: 380,
    estoqueMinimo: 500,
    custo: 0.12,
    fornecedor: 'Etiquetas Brasil',
    localizacao: 'Gaveta D1'
  };
  const mEmbalagem = {
    id: uid(),
    categoriaId: catEmbal.id,
    codigo: 'EMB-0001',
    nome: 'Saco Plástico 30x40',
    categoria: 'Embalagem',
    cor: '—',
    unidade: 'un',
    estoqueAtual: 1500,
    estoqueMinimo: 400,
    custo: 0.18,
    fornecedor: 'Embala Mais',
    localizacao: 'Prateleira E1'
  };
  d.materiais.push(mMalha, mGola, mLinha, mTinta, mEtiqueta, mEmbalagem);

  // --- Equipamentos / máquinas ---
  const equipamentos = [{
    codigo: 'EQ-001',
    nome: 'Enfestadeira',
    tipo: 'Enfesto',
    departamentoId: depCorte.id
  }, {
    codigo: 'EQ-002',
    nome: 'Máquina de Corte',
    tipo: 'Corte',
    departamentoId: depCorte.id
  }, {
    codigo: 'EQ-003',
    nome: 'Carrossel Silk',
    tipo: 'Silk',
    departamentoId: depSilk.id
  }, {
    codigo: 'EQ-004',
    nome: 'Lavadora de Telas',
    tipo: 'Revelação',
    departamentoId: depSilk.id
  }, {
    codigo: 'EQ-005',
    nome: 'Overloque 1',
    tipo: 'Overloque',
    departamentoId: depCostura.id
  }, {
    codigo: 'EQ-006',
    nome: 'Overloque 2',
    tipo: 'Overloque',
    departamentoId: depCostura.id
  }, {
    codigo: 'EQ-007',
    nome: 'Reta 1',
    tipo: 'Reta',
    departamentoId: depCostura.id
  }, {
    codigo: 'EQ-008',
    nome: 'Reta 2',
    tipo: 'Reta',
    departamentoId: depCostura.id
  }, {
    codigo: 'EQ-009',
    nome: 'Reta 3',
    tipo: 'Reta',
    departamentoId: depCostura.id
  }, {
    codigo: 'EQ-010',
    nome: 'Mesa de Revisão',
    tipo: 'Revisão',
    departamentoId: depAcab.id
  }];
  equipamentos.forEach(eq => {
    d.equipamentos.push({
      id: uid(),
      ...eq,
      marca: '',
      modelo: '',
      numeroSerie: '',
      patrimonio: '',
      dataAquisicao: '',
      valorAquisicao: 0,
      fornecedorId: '',
      fornecedor: '',
      localizacao: '',
      ultimaManutencao: '',
      proximaManutencao: '',
      status: 'Operando',
      observacoes: '',
      manutencoes: []
    });
  });
  // histórico de manutenção de exemplo em duas máquinas
  const eqOver1 = d.equipamentos.find(x => x.codigo === 'EQ-005');
  const eqReta1 = d.equipamentos.find(x => x.codigo === 'EQ-007');
  if (eqOver1) {
    eqOver1.manutencoes = [{
      id: uid(),
      data: '2026-05-14',
      tipo: 'Preventiva',
      pecas: 'Agulhas, óleo lubrificante',
      servico: 'Limpeza geral e troca de agulhas.',
      responsavel: 'Técnico externo',
      custo: 180,
      horasParada: 2
    }, {
      id: uid(),
      data: '2026-07-02',
      tipo: 'Corretiva',
      pecas: 'Lançadeira',
      servico: 'Substituição da lançadeira por desgaste.',
      responsavel: 'Técnico externo',
      custo: 420,
      horasParada: 6
    }];
    eqOver1.ultimaManutencao = '2026-07-02';
    eqOver1.proximaManutencao = '2026-10-02';
  }
  if (eqReta1) {
    eqReta1.manutencoes = [{
      id: uid(),
      data: '2026-06-20',
      tipo: 'Ajuste / Regulagem',
      pecas: '',
      servico: 'Regulagem de tensão da linha.',
      responsavel: 'Fábio Ramos',
      custo: 0,
      horasParada: 1
    }];
    eqReta1.ultimaManutencao = '2026-06-20';
  }

  // --- Etapas de produção, por departamento e tipo de máquina ---
  const E = (nome, depId, seg) => ({
    id: uid(),
    nome,
    departamentoId: depId,
    modoTempo: 'peca',
    tempoProducao: seg,
    unidadeTempo: 'seg',
    tamanhoEquipe: ''
  });

  // Corte
  const eRisco = E('Risco', depCorte.id, 20, 'Enfesto');
  const eEnfesto = E('Enfesto', depCorte.id, 25, 'Enfesto');
  const eCorte = E('Corte', depCorte.id, 45, 'Corte');
  const eAmarracao = E('Amarração', depCorte.id, 15, '');
  // Silk screen
  const eRevelacao = E('Revelação de Tela', depSilk.id, 10, 'Revelação');
  const eMistura = E('Mistura de Tinta', depSilk.id, 8, '');
  const eAmostra = E('Amostra e Aprovação', depSilk.id, 6, 'Silk');
  const eProdSilk = E('Produção Silk', depSilk.id, 55, 'Silk');
  // Separação
  const eSeparacao = E('Separação de Materiais', depPrep.id, 35, '');
  // Costura (conforme sequência operacional do avental)
  const eChulearBolso = E('Chulear bolso', depCostura.id, 5, 'Overloque');
  const eDobraBolso = E('Dobra do bolso', depCostura.id, 5, 'Reta');
  const eFixarBolso = E('Fixação do bolso', depCostura.id, 45, 'Reta');
  const eViesBarra = E('Viés de barra', depCostura.id, 45, 'Reta');
  const eViesPescoco = E('Viés do pescoço', depCostura.id, 30, 'Reta');
  const ePresponto = E('Presponto', depCostura.id, 20, 'Reta');
  // Acabamento
  const eRevisao = E('Revisão', depAcab.id, 40, 'Revisão');
  const eEmbalar = E('Embalagem', depAcab.id, 35, '');
  d.etapasProducao.push(eRisco, eEnfesto, eCorte, eAmarracao, eRevelacao, eMistura, eAmostra, eProdSilk, eSeparacao, eChulearBolso, eDobraBolso, eFixarBolso, eViesBarra, eViesPescoco, ePresponto, eRevisao, eEmbalar);

  // --- Produto: avental ---
  const prod = {
    id: uid(),
    codigo: 'AVE.OXF.PAD-0001',
    nome: 'Aventais Oxford Padrão Tecido Oxford Royal Único — com bolso frontal e viés contrastante',
    categoriaId: catProdCam.id,
    grupoId: grpMalha.id,
    subgrupoId: sgPV.id,
    categoria: 'Aventais',
    medidas: 'Único',
    tecidoId: mMalha.id,
    arquivos: [],
    observacoes: 'Com bolso frontal e viés contrastante',
    etapas: [eRisco, eEnfesto, eCorte, eAmarracao, eRevelacao, eMistura, eAmostra, eProdSilk, eSeparacao, eChulearBolso, eDobraBolso, eFixarBolso, eViesBarra, eViesPescoco, ePresponto, eRevisao, eEmbalar].map((et, i) => {
      // já deixa uma máquina do tipo alocada, alternando entre as iguais
      const doDep = d.equipamentos.filter(q => q.departamentoId === et.departamentoId);
      return {
        id: uid(),
        etapaId: et.id,
        equipamentoId: doDep.length ? doDep[i % doDep.length].id : ''
      };
    }),
    fichaTecnica: [{
      materialId: mMalha.id,
      quantidade: 0.75
    }, {
      materialId: mGola.id,
      quantidade: 2.30
    }, {
      materialId: mLinha.id,
      quantidade: 18
    }, {
      materialId: mTinta.id,
      quantidade: 0.010
    }, {
      materialId: mEtiqueta.id,
      quantidade: 1
    }, {
      materialId: mEmbalagem.id,
      quantidade: 1
    }]
  };
  d.produtos.push(prod);

  // --- Cliente ---
  const cliente = {
    id: uid(),
    tipo: 'PJ',
    nome: 'Uniformes Delta Ltda',
    nomeFantasia: 'Delta Uniformes',
    documento: '12.345.678/0001-90',
    ie: '110.042.490.114',
    indicadorIE: 'Contribuinte',
    telefone: '(11) 4002-8922',
    celular: '(11) 98877-6655',
    responsavel: 'Marcos Pereira',
    email: 'compras@deltauniformes.com.br',
    cep: '01310-000',
    endereco: 'Av. Paulista',
    numero: '1000',
    complemento: 'Sala 42',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    observacoes: 'Cliente recorrente.'
  };
  d.clientes.push(cliente);

  // --- Fornecedor ---
  d.fornecedores.push({
    id: uid(),
    nome: 'Malharia Central Ltda',
    nomeFantasia: 'Malharia Central',
    documento: '98.765.432/0001-10',
    ie: '',
    telefone: '(11) 3322-1100',
    celular: '(11) 97766-5544',
    contato: 'Roberto Silva',
    email: 'vendas@malhariacentral.com.br',
    categoria: 'Tecidos e malhas',
    condicaoPagamento: '30/60 dias',
    cep: '03015-000',
    endereco: 'Rua do Tecido',
    numero: '250',
    complemento: '',
    bairro: 'Brás',
    cidade: 'São Paulo',
    uf: 'SP',
    observacoes: ''
  });

  // --- Pedido ---
  const hoje = new Date();
  const entrega = new Date(hoje);
  entrega.setDate(entrega.getDate() + 12);
  const entregaISO = entrega.toISOString().slice(0, 10);
  const numeroPedido = d.seq.pedido++;
  const pedido = {
    id: uid(),
    numero: numeroPedido,
    cliente: cliente.nome,
    clienteId: cliente.id,
    vendedor: 'Marcos Vieira',
    dataPedido: todayISO(),
    prazoEntrega: entregaISO,
    anexos: [],
    itens: [{
      id: uid(),
      produtoId: prod.id,
      quantidade: 500,
      observacao: 'Estampa frente peito, 1 cor. Grade: 100 P, 200 M, 150 G, 50 GG.'
    }],
    observacoes: 'Entregar em caixas de 25 peças.',
    status: 'Em produção'
  };
  d.pedidos.push(pedido);

  // --- Ordem de Produção (com etapas em andamento) ---
  const d1 = new Date(hoje);
  const d2 = new Date(hoje);
  d2.setDate(d2.getDate() + 1);
  const d3 = new Date(hoje);
  d3.setDate(d3.getDate() + 2);
  const iso = x => x.toISOString().slice(0, 10);
  const numeroOP = numeroPedido; // a OP herda o número do pedido
  const defs = [eRisco, eEnfesto, eCorte, eAmarracao, eRevelacao, eMistura, eAmostra, eProdSilk, eSeparacao, eChulearBolso, eDobraBolso, eFixarBolso, eViesBarra, eViesPescoco, ePresponto, eRevisao, eEmbalar];
  // progresso por índice de defs (17 etapas)
  const P = (status, rec, conc, resp, ini2, fim2, obs) => ({
    status,
    qtdRecebida: rec,
    qtdConcluida: conc,
    responsaveis: resp,
    dataInicio: ini2,
    dataConclusao: fim2,
    observacao: obs || ''
  });
  const progresso = [P('Concluída', 500, 500, ['Bruno Lima'], iso(d1), iso(d1), 'Risco conferido.'), P('Concluída', 500, 500, ['Bruno Lima'], iso(d1), iso(d1), 'Enfesto sem perdas.'), P('Concluída', 500, 500, ['Ana Souza'], iso(d1), iso(d1), ''), P('Concluída', 500, 500, ['Ana Souza'], iso(d1), iso(d1), ''), P('Concluída', 500, 500, ['Carla Dias'], iso(d2), iso(d2), ''), P('Concluída', 500, 500, ['Diego Alves'], iso(d2), iso(d2), ''), P('Concluída', 500, 500, ['Carla Dias'], iso(d2), iso(d2), 'Amostra aprovada pelo cliente.'), P('Concluída', 500, 498, ['Carla Dias', 'Diego Alves'], iso(d2), iso(d2), '2 peças com falha de gravação.'), P('Concluída', 498, 498, ['Eliane Costa'], iso(d2), iso(d2), ''), P('Em andamento', 498, 400, ['Gabriela Nunes'], iso(d3), '', ''), P('Em andamento', 498, 380, ['Helena Prado'], iso(d3), '', ''), P('Em andamento', 498, 310, ['Fábio Ramos'], iso(d3), '', 'Em produção.'), P('Não iniciada', 0, 0, ['Gabriela Nunes'], '', '', ''), P('Não iniciada', 0, 0, ['Helena Prado'], '', '', ''), P('Não iniciada', 0, 0, ['Fábio Ramos'], '', '', ''), P('Não iniciada', 0, 0, ['Igor Martins'], '', '', ''), P('Não iniciada', 0, 0, ['Julia Freitas'], '', '', '')];
  const etapasOP = defs.map((def, i) => {
    // aloca a primeira máquina disponível do tipo, distribuindo entre as iguais
    const doDep = d.equipamentos.filter(eq => eq.departamentoId === def.departamentoId);
    const maquina = doDep.length ? doDep[i % doDep.length] : null;
    return {
      etapaProducaoId: def.id,
      departamentoId: def.departamentoId,
      nome: def.nome,
      modoTempo: def.modoTempo,
      tempoProducao: def.tempoProducao,
      unidadeTempo: def.unidadeTempo,
      tamanhoEquipe: def.tamanhoEquipe,
      tamanhoLote: def.tamanhoLote || '',
      equipamentoId: maquina ? maquina.id : '',
      ...progresso[i]
    };
  });
  const op = {
    id: uid(),
    numero: numeroOP,
    sufixo: '',
    pedidoId: pedido.id,
    produtoId: prod.id,
    quantidade: 500,
    entrega: entregaISO,
    etapas: etapasOP,
    anexos: []
  };
  d.ops.push(op);

  // --- Movimentações de estoque ligadas à OP (saída de material para produção) ---
  const saidas = [{
    materialId: mMalha.id,
    quantidade: 90
  }, {
    materialId: mGola.id,
    quantidade: 275
  }, {
    materialId: mLinha.id,
    quantidade: 6000
  }, {
    materialId: mTinta.id,
    quantidade: 4
  }];
  saidas.forEach(s => {
    const mat = d.materiais.find(m => m.id === s.materialId);
    if (mat) mat.estoqueAtual = num(mat.estoqueAtual) - s.quantidade;
    d.movimentacoes.push({
      id: uid(),
      tipo: 'Saída',
      materialId: s.materialId,
      quantidade: s.quantidade,
      opId: op.id,
      data: iso(d1),
      origem: rotuloOP(op)
    });
  });

  // --- Compra pendente (etiqueta está abaixo do necessário para a OP) ---
  const numeroCompra = d.seq.compra++;
  d.compras.push({
    id: uid(),
    numero: numeroCompra,
    materialId: mEtiqueta.id,
    quantidade: 1000,
    fornecedor: 'Etiquetas Brasil',
    valor: 120.00,
    dataPedido: todayISO(),
    previsaoChegada: iso(d3),
    status: 'Comprado'
  });
  return d;
}

/* --- responsáveis de uma etapa: sempre como array, aceitando o formato antigo (string) --- */
/* Etapas do produto — aceita o formato antigo (lista de ids) e o novo
   (lista de objetos com etapa + equipamento definido no cadastro do produto). */
function etapasDoProduto(produto) {
  const lista = produto && produto.etapas || [];
  return lista.map(x => typeof x === 'string' ? {
    id: x,
    etapaId: x,
    equipamentoId: ''
  } : {
    id: x.id || x.etapaId,
    etapaId: x.etapaId,
    equipamentoId: x.equipamentoId || ''
  });
}

// rótulo da OP: número do pedido + sufixo sequencial (a, b, c…) quando o pedido tem vários produtos
function rotuloOP(op) {
  if (!op) return '—';
  return `OP ${String(op.numero).padStart(5, '0')}${op.sufixo || ''}`;
}
function sufixoPorIndice(i) {
  return '/' + String.fromCharCode(65 + i);
} // 0->/A, 1->/B …

/* Funções do colaborador — aceita o formato antigo (campo `cargo` em texto)
   e o novo (`funcoes`, lista com uma ou mais funções). */
function funcoesColaborador(c) {
  if (!c) return [];
  if (Array.isArray(c.funcoes) && c.funcoes.length) return c.funcoes;
  if (c.cargo && String(c.cargo).trim()) return String(c.cargo).split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  return [];
}
function ehVendedor(c) {
  return funcoesColaborador(c).some(f => normaliza(f).includes('vended'));
}
function responsaveisEtapa(et) {
  if (Array.isArray(et.responsaveis)) return et.responsaveis;
  if (et.responsavel && String(et.responsavel).trim()) return [String(et.responsavel).trim()];
  return [];
}

/* --- custo unitário de produção do produto (materiais + mão de obra) --- */
function custoUnitarioProduto(produto, db) {
  let custoMat = 0;
  (produto.fichaTecnica || []).forEach(it => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    if (mat) custoMat += num(it.quantidade) * num(mat.custo);
  });
  let custoMO = 0,
    moVariavel = false,
    moSemBase = false;
  const doProduto = etapasDoProduto(produto);
  const listaEtapas = doProduto.length ? doProduto.map(x => (db.etapasProducao || []).find(e => e.id === x.etapaId)).filter(Boolean) : db.etapasProducao || [];
  listaEtapas.forEach(def => {
    if (def.modoTempo !== 'peca') {
      moVariavel = true;
      return;
    }
    const c = custoMaoDeObraPorPeca(def, db);
    if (c === null) {
      moSemBase = true;
      return;
    }
    custoMO += c;
  });
  return {
    custoMat,
    custoMO,
    total: custoMat + custoMO,
    moVariavel,
    moSemBase
  };
}

/* ==========================================================
   RELATÓRIOS
========================================================== */
function RelatoriosPessoas({
  db
}) {
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [grupo, setGrupo] = useState('todos'); // todos | clientes | fornecedores | colaboradores

  // filtro de período aplicado à data de cadastro/admissão disponível em cada grupo
  const noPeriodo = dataISO => {
    if (!ini && !fim) return true;
    if (!dataISO) return false;
    if (ini && dataISO < ini) return false;
    if (fim && dataISO > fim) return false;
    return true;
  };
  const colaboradores = db.colaboradores.filter(c => noPeriodo(c.dataAdmissao));
  const clientes = db.clientes; // cadastro de cliente não tem data — só é filtrado quando o período está vazio
  const fornecedores = db.fornecedores;
  const filtroDataAtivo = !!(ini || fim);
  const mostra = g => grupo === 'todos' || grupo === g;
  const porDep = db.departamentos.map(dep => {
    const g = colaboradores.filter(c => c.departamentoId === dep.id && c.status !== 'Inativo');
    const folha = g.reduce((s, c) => s + num(c.salario), 0);
    return {
      dep,
      qtd: g.length,
      folha,
      media: g.length ? folha / g.length : 0
    };
  });
  const semDep = colaboradores.filter(c => !c.departamentoId && c.status !== 'Inativo');
  const ativos = colaboradores.filter(c => c.status !== 'Inativo');
  const folhaTotal = ativos.reduce((s, c) => s + num(c.salario), 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: ini,
    onChange: e => setIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fim,
    onChange: e => setFim(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Grupo de cadastro"
  }, /*#__PURE__*/React.createElement("select", {
    value: grupo,
    onChange: e => setGrupo(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "todos"
  }, "Todos os grupos"), /*#__PURE__*/React.createElement("option", {
    value: "clientes"
  }, "Clientes"), /*#__PURE__*/React.createElement("option", {
    value: "fornecedores"
  }, "Fornecedores"), /*#__PURE__*/React.createElement("option", {
    value: "colaboradores"
  }, "Colaboradores"), /*#__PURE__*/React.createElement("option", {
    value: "equipamentos"
  }, "Equipamentos")))), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      setIni('');
      setFim('');
      setGrupo('todos');
    }
  }, "Limpar filtros"), filtroDataAtivo && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 8
    }
  }, "Período aplicado à data de admissão dos colaboradores. Clientes e fornecedores não têm data de cadastro registrada.")), /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi accent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Colaboradores ativos"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, ativos.length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Folha mensal"), /*#__PURE__*/React.createElement("div", {
    className: "val",
    style: {
      fontSize: 22
    }
  }, money(folhaTotal))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Clientes"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, clientes.length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Equipamentos"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, (db.equipamentos || []).length))), mostra('colaboradores') && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Quadro por departamento"), porDep.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum departamento cadastrado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Colaboradores"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Folha mensal"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Média salarial"))), /*#__PURE__*/React.createElement("tbody", null, porDep.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.dep.id
  }, /*#__PURE__*/React.createElement("td", null, r.dep.nome), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.qtd), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(r.folha)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.qtd ? money(r.media) : /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "—")))), semDep.length > 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "muted"
  }, "(sem departamento)"), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, semDep.length), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, money(semDep.reduce((s, c) => s + num(c.salario), 0))), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, "—"))))), mostra('colaboradores') && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Colaboradores ", filtroDataAtivo && /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "(admitidos no período)")), colaboradores.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum colaborador no filtro."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Cargo"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Admissão"), /*#__PURE__*/React.createElement("th", null, "Perfil"), /*#__PURE__*/React.createElement("th", null, "Acesso"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, colaboradores.map(c => {
    const dep = db.departamentos.find(d => d.id === c.departamentoId);
    const temSenha = temSenhaDefinida(c);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id
    }, /*#__PURE__*/React.createElement("td", null, c.nome), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, funcoesColaborador(c).join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, dep ? dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.dataAdmissao)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, c.perfil || 'Colaborador'), /*#__PURE__*/React.createElement("td", null, temSenha ? /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Liberado") : /*#__PURE__*/React.createElement(Badge, {
      tone: "bad"
    }, "Bloqueado")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: c.status === 'Inativo' ? 'idle' : 'ok'
    }, c.status || 'Ativo')));
  })))), mostra('clientes') && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Clientes"), clientes.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum cliente cadastrado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome / Razão Social"), /*#__PURE__*/React.createElement("th", null, "Tipo"), /*#__PURE__*/React.createElement("th", null, "CPF/CNPJ"), /*#__PURE__*/React.createElement("th", null, "Contato"), /*#__PURE__*/React.createElement("th", null, "Cidade/UF"))), /*#__PURE__*/React.createElement("tbody", null, clientes.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.id
  }, /*#__PURE__*/React.createElement("td", null, c.nome), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, c.tipo), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, c.documento), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, c.celular || c.telefone), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, c.cidade, c.uf ? `/${c.uf}` : '')))))), mostra('equipamentos') && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Equipamentos"), (db.equipamentos || []).length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum equipamento cadastrado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Código"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", null, "Departamento"), /*#__PURE__*/React.createElement("th", null, "Marca/Modelo"), /*#__PURE__*/React.createElement("th", null, "Próx. manutenção"), /*#__PURE__*/React.createElement("th", null, "Situação"))), /*#__PURE__*/React.createElement("tbody", null, (db.equipamentos || []).map(eq => {
    const dep = db.departamentos.find(d => d.id === eq.departamentoId);
    const st = eq.status || 'Operando';
    const tone = st === 'Operando' ? 'ok' : st === 'Em manutenção' ? 'warn' : st === 'Parado' ? 'bad' : 'idle';
    return /*#__PURE__*/React.createElement("tr", {
      key: eq.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, eq.codigo), /*#__PURE__*/React.createElement("td", null, eq.nome), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, dep ? dep.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, [eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(eq.proximaManutencao)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      tone: tone
    }, st)));
  })))), mostra('fornecedores') && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Fornecedores"), fornecedores.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum fornecedor cadastrado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome / Razão Social"), /*#__PURE__*/React.createElement("th", null, "CNPJ/CPF"), /*#__PURE__*/React.createElement("th", null, "Categoria"), /*#__PURE__*/React.createElement("th", null, "Contato"), /*#__PURE__*/React.createElement("th", null, "Condição pgto."))), /*#__PURE__*/React.createElement("tbody", null, fornecedores.map(f => /*#__PURE__*/React.createElement("tr", {
    key: f.id
  }, /*#__PURE__*/React.createElement("td", null, f.nome), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, f.documento), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, f.categoria), /*#__PURE__*/React.createElement("td", {
    className: "small"
  }, f.celular || f.telefone), /*#__PURE__*/React.createElement("td", {
    className: "small muted"
  }, f.condicaoPagamento)))))));
}
function RelatoriosMateriais({
  db,
  podeFin = true
}) {
  const [fCat, setFCat] = useState('');
  const [fCatProd, setFCatProd] = useState('');
  const [fIni, setFIni] = useState('');
  const [fFim, setFFim] = useState('');
  const [fStatusCompra, setFStatusCompra] = useState('');
  const materiais = db.materiais.filter(m => !fCat || m.categoriaId === fCat);
  const produtos = db.produtos.filter(p => !fCatProd || p.categoriaId === fCatProd);
  const compras = db.compras.filter(c => {
    if (fStatusCompra && c.status !== fStatusCompra) return false;
    if (fIni && c.dataPedido < fIni) return false;
    if (fFim && c.dataPedido > fFim) return false;
    return true;
  });
  const valorEstoque = materiais.reduce((s, m) => s + num(m.estoqueAtual) * num(m.custo), 0);
  const abaixoMin = materiais.filter(m => num(m.estoqueAtual) <= num(m.estoqueMinimo));
  const comprasAbertas = compras.filter(c => c.status !== 'Recebido');
  const valorCompras = comprasAbertas.reduce((s, c) => s + num(c.valor), 0);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Categoria de material"
  }, /*#__PURE__*/React.createElement("select", {
    value: fCat,
    onChange: e => setFCat(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), (db.categoriasMaterial || []).map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Categoria de produto"
  }, /*#__PURE__*/React.createElement("select", {
    value: fCatProd,
    onChange: e => setFCatProd(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todas"), (db.categoriasProduto || []).map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Status da compra"
  }, /*#__PURE__*/React.createElement("select", {
    value: fStatusCompra,
    onChange: e => setFStatusCompra(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), STATUS_COMPRA.map(st => /*#__PURE__*/React.createElement("option", {
    key: st,
    value: st
  }, st)))), /*#__PURE__*/React.createElement(Field, {
    label: "Compras — data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fIni,
    onChange: e => setFIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Compras — data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fFim,
    onChange: e => setFFim(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      setFCat('');
      setFCatProd('');
      setFIni('');
      setFFim('');
      setFStatusCompra('');
    }
  }, "Limpar filtros")))), /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi accent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Valor em estoque"), /*#__PURE__*/React.createElement("div", {
    className: "val",
    style: {
      fontSize: 22
    }
  }, money(valorEstoque))), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Materiais"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, materiais.length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Abaixo do mínimo"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, abaixoMin.length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Compras em aberto"), /*#__PURE__*/React.createElement("div", {
    className: "val",
    style: {
      fontSize: 22
    }
  }, money(valorCompras)))), !podeFin && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: 'var(--warn)',
      background: 'var(--warn-bg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      color: 'var(--warn)',
      fontWeight: 600
    }
  }, "Seu perfil não tem acesso a valores financeiros (custos, preços e valor de estoque).")), podeFin && /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Custo unitário de produção por produto"), produtos.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum produto no filtro."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Materiais"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mão de obra"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo total / peça"), /*#__PURE__*/React.createElement("th", null, "Observação"))), /*#__PURE__*/React.createElement("tbody", null, produtos.map(p => {
    const c = custoUnitarioProduto(p, db);
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, p.nome), " ", /*#__PURE__*/React.createElement("span", {
      className: "small muted"
    }, p.codigo)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(c.custoMat)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(c.custoMO)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, /*#__PURE__*/React.createElement("strong", null, money(c.total))), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, c.moVariavel && 'etapa por lote/equipe (M.O. variável) ', c.moSemBase && 'depto. sem colaboradores', !c.moVariavel && !c.moSemBase && '—'));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Posição de estoque"), materiais.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum material no filtro."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Estoque"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Mínimo"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Custo unit."), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Valor total"), /*#__PURE__*/React.createElement("th", null, "Situação"))), /*#__PURE__*/React.createElement("tbody", null, materiais.map(m => {
    const baixo = num(m.estoqueAtual) <= num(m.estoqueMinimo);
    return /*#__PURE__*/React.createElement("tr", {
      key: m.id
    }, /*#__PURE__*/React.createElement("td", null, m.nome), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, num(m.estoqueAtual), " ", m.unidade), /*#__PURE__*/React.createElement("td", {
      className: "num muted"
    }, num(m.estoqueMinimo)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(m.custo)), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(num(m.estoqueAtual) * num(m.custo))), /*#__PURE__*/React.createElement("td", null, baixo ? /*#__PURE__*/React.createElement(Badge, {
      tone: "bad"
    }, "Repor") : /*#__PURE__*/React.createElement(Badge, {
      tone: "ok"
    }, "Normal")));
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Compras ", fStatusCompra || fIni || fFim ? /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "(no filtro)") : /*#__PURE__*/React.createElement("span", {
    className: "small muted"
  }, "em aberto")), comprasAbertas.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma compra no filtro."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Material"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Fornecedor"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Valor"), /*#__PURE__*/React.createElement("th", null, "Previsão"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, comprasAbertas.map(c => {
    const mat = db.materiais.find(m => m.id === c.materialId);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", c.numero), /*#__PURE__*/React.createElement("td", null, mat ? mat.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, c.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, c.fornecedor), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, money(c.valor)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(c.previsaoChegada)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusCompraBadge, {
      status: c.status
    })));
  })))));
}
function RelatoriosProducao({
  db
}) {
  const [fIni, setFIni] = useState('');
  const [fFim, setFFim] = useState('');
  const [fDep, setFDep] = useState('');
  const [fCol, setFCol] = useState('');
  const aps = (db.apontamentos || []).filter(a => {
    if (!a.fim) return false;
    const dia = String(a.fim).slice(0, 10);
    if (fIni && dia < fIni) return false;
    if (fFim && dia > fFim) return false;
    if (fDep && (a.departamentoId || '') !== fDep) return false;
    if (fCol && !(a.equipe || [a.colaborador]).some(n => normaliza(n) === normaliza(fCol))) return false;
    return true;
  });
  const prevDe = a => {
    const p = (a.equipe || [a.colaborador]).length || 1;
    return num(a.minPorPeca) * num(a.qtdBoas) / p;
  };
  const totBoas = aps.reduce((s, a) => s + num(a.qtdBoas), 0);
  const totDef = aps.reduce((s, a) => s + num(a.qtdDefeito), 0);
  const totRet = aps.reduce((s, a) => s + num(a.qtdRetrabalho), 0);
  const totReal = aps.reduce((s, a) => s + num(a.minReais), 0);
  const totPrev = aps.reduce((s, a) => s + prevDe(a), 0);
  const efGeral = totReal > 0 ? totPrev / totReal * 100 : 0;
  const refugo = totBoas + totDef > 0 ? totDef / (totBoas + totDef) * 100 : 0;
  function agrupar(chaveFn) {
    const m = {};
    aps.forEach(a => {
      const chaves = chaveFn(a);
      (Array.isArray(chaves) ? chaves : [chaves]).forEach(k => {
        if (!k) return;
        if (!m[k]) m[k] = {
          k,
          boas: 0,
          def: 0,
          ret: 0,
          real: 0,
          prev: 0,
          n: 0
        };
        const p = (a.equipe || [a.colaborador]).length || 1;
        m[k].boas += num(a.qtdBoas) / (Array.isArray(chaves) ? p : 1);
        m[k].def += num(a.qtdDefeito) / (Array.isArray(chaves) ? p : 1);
        m[k].ret += num(a.qtdRetrabalho) / (Array.isArray(chaves) ? p : 1);
        m[k].real += num(a.minReais);
        m[k].prev += prevDe(a) / (Array.isArray(chaves) ? p : 1);
        m[k].n++;
      });
    });
    return Object.values(m).map(x => ({
      ...x,
      ef: x.real > 0 ? x.prev / x.real * 100 : 0
    })).sort((a, b) => b.boas - a.boas);
  }
  const porColab = agrupar(a => a.equipe || [a.colaborador]);
  const porDep = agrupar(a => {
    const d = db.departamentos.find(x => x.id === a.departamentoId);
    return d ? d.nome : '(sem departamento)';
  });
  const porEtapa = agrupar(a => a.etapaNome);
  const porOP = agrupar(a => a.opRotulo);
  function Tabela({
    titulo,
    dados,
    rotulo
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "panel"
    }, /*#__PURE__*/React.createElement("h3", null, titulo), dados.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
      text: "Sem apontamentos no período."
    }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, rotulo), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Apont."), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Boas"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Defeito"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Retrab."), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Previsto"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Real"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Pç/h"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Eficiência"), /*#__PURE__*/React.createElement("th", null, "Nota"))), /*#__PURE__*/React.createElement("tbody", null, dados.map((r, i) => {
      const cls = classificarEficiencia(r.ef);
      const ph = r.real > 0 ? r.boas / (r.real / 60) : 0;
      return /*#__PURE__*/React.createElement("tr", {
        key: i,
        className: 'linha-nota-' + cls.nota
      }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, r.k)), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, r.n), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, Math.round(r.boas)), /*#__PURE__*/React.createElement("td", {
        className: "num",
        style: r.def > 0 ? {
          color: 'var(--bad)'
        } : {}
      }, Math.round(r.def) || '—'), /*#__PURE__*/React.createElement("td", {
        className: "num",
        style: r.ret > 0 ? {
          color: 'var(--warn)'
        } : {}
      }, Math.round(r.ret) || '—'), /*#__PURE__*/React.createElement("td", {
        className: "num small"
      }, minParaHHMM(r.prev)), /*#__PURE__*/React.createElement("td", {
        className: "num small"
      }, minParaHHMM(r.real)), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, ph.toFixed(0)), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, /*#__PURE__*/React.createElement("strong", null, r.ef.toFixed(1), "%")), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
        tone: cls.tone
      }, cls.nota)));
    }))));
  }
  const clsGeral = classificarEficiencia(efGeral);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel no-print"
  }, /*#__PURE__*/React.createElement("h3", null, "Filtros"), /*#__PURE__*/React.createElement("div", {
    className: "grid3"
  }, /*#__PURE__*/React.createElement(Field, {
    label: "Data início"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fIni,
    onChange: e => setFIni(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Data fim"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: fFim,
    onChange: e => setFFim(e.target.value)
  })), /*#__PURE__*/React.createElement(Field, {
    label: "Departamento"
  }, /*#__PURE__*/React.createElement("select", {
    value: fDep,
    onChange: e => setFDep(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), db.departamentos.map(d => /*#__PURE__*/React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.nome)))), /*#__PURE__*/React.createElement(Field, {
    label: "Colaborador"
  }, /*#__PURE__*/React.createElement("select", {
    value: fCol,
    onChange: e => setFCol(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Todos"), db.colaboradores.filter(c => c.status !== 'Inativo').map(c => /*#__PURE__*/React.createElement("option", {
    key: c.id,
    value: c.nome
  }, c.nome)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      setFIni('');
      setFFim('');
      setFDep('');
      setFCol('');
    }
  }, "Limpar"), /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir")))), aps.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma produção concluída no filtro. Os indicadores vêm dos lançamentos em Produção → Lançamento de produção."
  }) : /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Produção & Produtividade"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, fIni || fFim ? `Período ${fIni ? fmtDate(fIni) : 'início'} a ${fFim ? fmtDate(fFim) : 'hoje'}` : 'Todos os períodos', " · Emitido em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Peças boas"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, totBoas)), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Refugo"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, refugo.toFixed(1), "%")), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Previsto × Real"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      fontSize: 13
    }
  }, minParaHHMM(totPrev), " × ", minParaHHMM(totReal))), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Eficiência geral"), /*#__PURE__*/React.createElement("div", {
    className: "v",
    style: {
      color: clsGeral.tone === 'ok' ? 'var(--ok)' : clsGeral.tone === 'warn' ? 'var(--warn)' : 'var(--bad)'
    }
  }, efGeral.toFixed(1), "% · ", clsGeral.nota))), /*#__PURE__*/React.createElement(Tabela, {
    titulo: "Produtividade por colaborador",
    dados: porColab,
    rotulo: "Colaborador"
  }), /*#__PURE__*/React.createElement(Tabela, {
    titulo: "Produtividade por departamento",
    dados: porDep,
    rotulo: "Departamento"
  }), /*#__PURE__*/React.createElement(Tabela, {
    titulo: "Produtividade por etapa",
    dados: porEtapa,
    rotulo: "Etapa"
  }), /*#__PURE__*/React.createElement(Tabela, {
    titulo: "Produtividade por Ordem de Produção",
    dados: porOP,
    rotulo: "OP"
  }), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, "Supervisão de produção"), /*#__PURE__*/React.createElement("div", null, "Conferência"))));
}
function RelatoriosVendas({
  db
}) {
  const totalPecas = db.pedidos.reduce((s, p) => s + totalPecasPedido(p), 0);
  const porStatus = STATUS_PEDIDO.map(st => ({
    st,
    qtd: db.pedidos.filter(p => p.status === st).length
  }));
  const porCliente = Object.entries(db.pedidos.reduce((acc, p) => {
    acc[p.cliente] = (acc[p.cliente] || 0) + totalPecasPedido(p);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const porProduto = Object.entries(db.pedidos.reduce((acc, p) => {
    itensPedido(p).forEach(it => {
      const prod = db.produtos.find(x => x.id === it.produtoId);
      const k = prod ? prod.nome : '—';
      acc[k] = (acc[k] || 0) + num(it.quantidade);
    });
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi accent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Pedidos"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, db.pedidos.length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Peças pedidas"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, totalPecas)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Em produção"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, db.pedidos.filter(p => p.status === 'Em produção').length)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Concluídos"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, db.pedidos.filter(p => p.status === 'Concluído').length))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Pedidos por status"), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Pedidos"))), /*#__PURE__*/React.createElement("tbody", null, porStatus.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.st
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusPedidoBadge, {
    status: r.st
  })), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.qtd)))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Peças por cliente"), porCliente.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum pedido lançado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Peças"))), /*#__PURE__*/React.createElement("tbody", null, porCliente.map(([k, v]) => /*#__PURE__*/React.createElement("tr", {
    key: k
  }, /*#__PURE__*/React.createElement("td", null, k), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, v)))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Peças por vendedor"), (() => {
    const porVend = Object.entries(db.pedidos.reduce((acc, p) => {
      const k = p.vendedor || '(sem vendedor)';
      if (!acc[k]) acc[k] = {
        pedidos: 0,
        pecas: 0
      };
      acc[k].pedidos++;
      acc[k].pecas += totalPecasPedido(p);
      return acc;
    }, {})).sort((a, b) => b[1].pecas - a[1].pecas);
    return porVend.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
      text: "Nenhum pedido lançado."
    }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Vendedor"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Pedidos"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Peças"))), /*#__PURE__*/React.createElement("tbody", null, porVend.map(([k, v]) => /*#__PURE__*/React.createElement("tr", {
      key: k
    }, /*#__PURE__*/React.createElement("td", null, k), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, v.pedidos), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, v.pecas)))));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Peças por produto"), porProduto.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum pedido lançado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Peças"))), /*#__PURE__*/React.createElement("tbody", null, porProduto.map(([k, v]) => /*#__PURE__*/React.createElement("tr", {
    key: k
  }, /*#__PURE__*/React.createElement("td", null, k), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, v)))))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Todos os pedidos"), db.pedidos.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum pedido lançado."
  }) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", null, "Vendedor"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Pedido"), /*#__PURE__*/React.createElement("th", null, "Entrega"), /*#__PURE__*/React.createElement("th", null, "Status"))), /*#__PURE__*/React.createElement("tbody", null, db.pedidos.slice().sort((a, b) => b.numero - a.numero).map(p => {
    const itens = itensPedido(p);
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", String(p.numero).padStart(5, '0')), /*#__PURE__*/React.createElement("td", null, p.cliente), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, p.vendedor || '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, itens.map(it => {
      const prod = db.produtos.find(x => x.id === it.produtoId);
      return prod ? prod.nome : '—';
    }).join(', ')), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, totalPecasPedido(p)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(p.dataPedido)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(p.prazoEntrega)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusPedidoBadge, {
      status: p.status
    })));
  })))));
}

/* ==========================================================
   Pedidos para produzir (dentro do grupo Produção)
========================================================== */
function PedidosParaProduzir({
  db,
  update,
  irParaOPs
}) {
  const [relatorio, setRelatorio] = useState(null);
  function gerarOP(pedido) {
    if (db.etapasProducao.length === 0) {
      alert('Nenhuma etapa de produção cadastrada.');
      return;
    }
    const itens = itensPedido(pedido);
    if (itens.length === 0) {
      alert('Este pedido não tem produtos.');
      return;
    }
    if (!podeGerarOP(pedido)) {
      alert(`Este pedido está como "${pedido.status}". Só é possível gerar OP a partir de "Aberto" ou "Liberado para produção".`);
      return;
    }
    const existentes = db.ops.filter(o => o.pedidoId === pedido.id);
    const semOP = itens.filter(it => !existentes.some(o => o.itemId === it.id));
    if (semOP.length === 0) {
      alert('Todos os produtos deste pedido já têm Ordem de Produção. Abra a OP existente para visualizar ou editar.');
      irParaOPs();
      return;
    }
    if (semOP.length > 1 && !confirm(`Serão geradas ${semOP.length} OPs (sufixos /A, /B, /C…). Continuar?`)) return;
    update(d => {
      gerarOPsDoPedido(pedido, d);
      return d;
    });
    irParaOPs();
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, db.pedidos.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhum pedido de venda lançado. Cadastre em Pedidos."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nº"), /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", null, "Produtos"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Total peças"), /*#__PURE__*/React.createElement("th", null, "Entrega"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "OPs"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, db.pedidos.slice().sort((a, b) => b.numero - a.numero).map(p => {
    const itens = itensPedido(p);
    const ops = db.ops.filter(o => o.pedidoId === p.id);
    return /*#__PURE__*/React.createElement("tr", {
      key: p.id
    }, /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, "#", String(p.numero).padStart(5, '0')), /*#__PURE__*/React.createElement("td", null, p.cliente), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, itens.map((it, i) => {
      const prod = db.produtos.find(x => x.id === it.produtoId);
      return /*#__PURE__*/React.createElement("div", {
        key: i
      }, prod ? prod.nome : '—', " ", /*#__PURE__*/React.createElement("span", {
        className: "muted"
      }, "(", num(it.quantidade), ")"));
    })), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, totalPecasPedido(p)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(p.prazoEntrega)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(StatusPedidoBadge, {
      status: p.status
    })), /*#__PURE__*/React.createElement("td", {
      className: "small muted"
    }, ops.length === 0 ? '—' : ops.map(o => rotuloOP(o)).join(', ')), /*#__PURE__*/React.createElement("td", {
      className: "row-actions"
    }, (() => {
      const semOP = itens.filter(it => !ops.some(o => o.itemId === it.id));
      if (semOP.length === 0) return /*#__PURE__*/React.createElement("button", {
        className: "btn accent sm",
        onClick: () => setRelatorio(p)
      }, "Andamento");
      if (!podeGerarOP(p)) return /*#__PURE__*/React.createElement("span", {
        className: "small muted"
      }, "libere o pedido para produzir");
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
        className: "btn accent sm",
        onClick: () => gerarOP(p)
      }, "Gerar ", semOP.length > 1 ? `${semOP.length} OPs` : 'OP'), ops.length > 0 && /*#__PURE__*/React.createElement("button", {
        className: "btn ghost sm",
        onClick: () => setRelatorio(p)
      }, "Andamento"));
    })()));
  })))), relatorio && /*#__PURE__*/React.createElement(RelatorioAndamentoPedido, {
    pedido: relatorio,
    db: db,
    onClose: () => setRelatorio(null)
  }));
}

/* ==========================================================
   RELATÓRIO DE ANDAMENTO — todas as etapas do pedido
========================================================== */
function RelatorioAndamentoPedido({
  pedido,
  db,
  onClose
}) {
  const ops = db.ops.filter(o => o.pedidoId === pedido.id);
  const cliente = db.clientes.find(c => c.id === pedido.clienteId);

  // consolida os números do pedido inteiro
  let totEtapas = 0,
    totConcluidas = 0,
    totAndamento = 0,
    totMin = 0,
    minConcluido = 0;
  ops.forEach(op => {
    op.etapas.forEach(et => {
      const qtdBase = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const carga = cargaEtapaOP(et, qtdBase, op.quantidade, db);
      totEtapas++;
      totMin += carga;
      if (et.status === 'Concluída') {
        totConcluidas++;
        minConcluido += carga;
      } else if (et.status === 'Em andamento') {
        totAndamento++;
        const prog = num(op.quantidade) > 0 ? num(et.qtdConcluida) / num(op.quantidade) : 0;
        minConcluido += carga * Math.min(prog, 1);
      }
    });
  });
  const pctEtapas = totEtapas > 0 ? Math.round(totConcluidas / totEtapas * 100) : 0;
  const pctTempo = totMin > 0 ? Math.round(minConcluido / totMin * 100) : 0;
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Andamento da produção — Pedido #${String(pedido.numero).padStart(5, '0')}`,
    onClose: onClose,
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: () => window.print()
  }, "🖨️ Imprimir / salvar como PDF")), /*#__PURE__*/React.createElement("div", {
    className: "report-doc"
  }, /*#__PURE__*/React.createElement("h2", null, "Andamento da Produção"), /*#__PURE__*/React.createElement("div", {
    className: "rep-sub"
  }, "Pedido nº ", String(pedido.numero).padStart(5, '0'), " · Emitido em ", fmtDate(todayISO())), /*#__PURE__*/React.createElement("div", {
    className: "rep-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Cliente"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pedido.cliente || '—')), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Entrega"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, fmtDate(pedido.prazoEntrega))), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Etapas concluídas"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, totConcluidas, "/", totEtapas, " · ", pctEtapas, "%")), /*#__PURE__*/React.createElement("div", {
    className: "rep-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Avanço por tempo"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, pctTempo, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '6px 0 4px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      background: '#e6e2d8',
      borderRadius: 6,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pctTempo}%`,
      height: '100%',
      background: 'var(--ok)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 4
    }
  }, minParaHHMM(minConcluido), " de ", minParaHHMM(totMin), " de produção realizados · ", totAndamento, " etapa(s) em andamento")), cliente && /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: 8
    }
  }, [cliente.documento, cliente.responsavel, cliente.celular || cliente.telefone].filter(Boolean).join(' · ')), ops.length === 0 ? /*#__PURE__*/React.createElement(Empty, {
    text: "Nenhuma OP gerada para este pedido."
  }) : ops.map(op => {
    const produto = db.produtos.find(p => p.id === op.produtoId);
    const info = opStatusInfo(op);
    const concl = op.etapas.filter(e => e.status === 'Concluída').length;

    // agrupa as etapas por departamento, preservando a ordem
    const grupos = [];
    const porDep = {};
    op.etapas.forEach((et, idx) => {
      const k = et.departamentoId || '_sem';
      if (!porDep[k]) {
        porDep[k] = {
          dep: db.departamentos.find(d => d.id === et.departamentoId),
          itens: []
        };
        grupos.push({
          k,
          ...porDep[k]
        });
      }
      porDep[k].itens.push({
        et,
        idx
      });
    });
    return /*#__PURE__*/React.createElement("div", {
      key: op.id,
      style: {
        marginTop: 18
      }
    }, /*#__PURE__*/React.createElement("h4", null, rotuloOP(op), " — ", produto ? produto.nome : '—', " · ", op.quantidade, " peças"), /*#__PURE__*/React.createElement("div", {
      className: "small muted",
      style: {
        marginBottom: 8
      }
    }, "Situação: ", /*#__PURE__*/React.createElement("strong", null, info.label), " · Etapa atual: ", /*#__PURE__*/React.createElement("strong", null, info.etapaAtual), " ·", ' ', concl, "/", op.etapas.length, " etapas concluídas · Entrega ", fmtDate(op.entrega)), grupos.map(g => /*#__PURE__*/React.createElement("div", {
      key: g.k,
      style: {
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '8px 0 4px 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 5,
        height: 14,
        background: 'var(--thread)',
        borderRadius: 3
      }
    }), /*#__PURE__*/React.createElement("strong", {
      style: {
        fontFamily: 'var(--display)',
        fontSize: 13
      }
    }, g.dep ? g.dep.nome : 'Sem departamento')), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "#"), /*#__PURE__*/React.createElement("th", null, "Etapa"), /*#__PURE__*/React.createElement("th", null, "Equipamento"), /*#__PURE__*/React.createElement("th", null, "Responsável"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Recebido"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Concluído"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "%"), /*#__PURE__*/React.createElement("th", null, "Início"), /*#__PURE__*/React.createElement("th", null, "Conclusão"), /*#__PURE__*/React.createElement("th", {
      className: "num"
    }, "Tempo"), /*#__PURE__*/React.createElement("th", null, "Situação"))), /*#__PURE__*/React.createElement("tbody", null, porDep[g.k].itens.map(({
      et,
      idx
    }) => {
      const qtdBase = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const carga = cargaEtapaOP(et, qtdBase, op.quantidade, db);
      const base = num(et.qtdRecebida) > 0 ? num(et.qtdRecebida) : num(op.quantidade);
      const pct = base > 0 ? Math.round(num(et.qtdConcluida) / base * 100) : 0;
      const maq = (db.equipamentos || []).find(q => q.id === et.equipamentoId);
      const tone = et.status === 'Concluída' ? 'ok' : et.status === 'Em andamento' ? 'warn' : 'idle';
      return /*#__PURE__*/React.createElement("tr", {
        key: idx
      }, /*#__PURE__*/React.createElement("td", {
        className: "small muted"
      }, idx + 1), /*#__PURE__*/React.createElement("td", null, et.nome), /*#__PURE__*/React.createElement("td", {
        className: "small muted"
      }, maq ? maq.codigo : '—'), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, responsaveisEtapa(et).join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, num(et.qtdRecebida) || '—'), /*#__PURE__*/React.createElement("td", {
        className: "num"
      }, num(et.qtdConcluida) || '—'), /*#__PURE__*/React.createElement("td", {
        className: "num",
        style: pct >= 100 ? {
          color: 'var(--ok)',
          fontWeight: 600
        } : {}
      }, pct, "%"), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, fmtDate(et.dataInicio)), /*#__PURE__*/React.createElement("td", {
        className: "small"
      }, fmtDate(et.dataConclusao)), /*#__PURE__*/React.createElement("td", {
        className: "num small"
      }, minParaHHMM(carga)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
        tone: tone
      }, et.status)));
    }))))));
  }), /*#__PURE__*/React.createElement("div", {
    className: "rep-sign"
  }, /*#__PURE__*/React.createElement("div", null, "Responsável pela produção"), /*#__PURE__*/React.createElement("div", null, "Conferência final"))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "Fechar")));
}

/* ==========================================================
   9. PAINEL DE PRODUÇÃO
========================================================== */
function Painel({
  db,
  update,
  setTab
}) {
  const opsAtivas = db.ops.filter(op => !op.etapas.every(e => e.status === 'Concluída'));
  const opsConcluidas = db.ops.length - opsAtivas.length;
  const kpi = useMemo(() => {
    let atrasado = 0,
      atencao = 0,
      noprazo = 0,
      naoiniciado = 0,
      concluida = 0;
    opsAtivas.forEach(op => {
      const info = opStatusInfo(op);
      if (info.label === 'Atrasado') atrasado++;else if (info.label === 'Atenção') atencao++;else if (info.label === 'No prazo') noprazo++;else if (info.label === 'Não iniciado') naoiniciado++;else concluida++;
    });
    return {
      atrasado,
      atencao,
      noprazo,
      naoiniciado,
      concluida,
      total: opsAtivas.length
    };
  }, [opsAtivas]);
  const materiaisBaixos = db.materiais.filter(m => num(m.estoqueAtual) <= num(m.estoqueMinimo)).length;
  const vazio = db.produtos.length === 0 && db.ops.length === 0 && db.materiais.length === 0;
  function carregarTeste() {
    if (!confirm('Carregar a linha de teste completa (avental)? Serão criados departamentos, colaboradores, equipamentos, materiais, etapas, produto, cliente, fornecedor, pedido e uma OP em andamento.')) return;
    update(d => criarDadosTesteCamiseta(d));
  }
  function baixarBackup() {
    try {
      const json = JSON.stringify(db, null, 2);
      const blob = new Blob([json], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-confeccao-erp-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Não foi possível gerar o backup: ' + (e && e.message));
    }
  }
  function restaurarBackup(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Restaurar este backup? Todos os dados atuais serão substituídos.')) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dados = JSON.parse(reader.result);
        if (!dados || typeof dados !== 'object' || !Array.isArray(dados.colaboradores)) {
          alert('Arquivo inválido — não parece um backup deste sistema.');
          return;
        }
        update(() => garantirAdminPadrao({
          ...emptyDb(),
          ...dados
        }));
        alert('Backup restaurado.');
      } catch (err) {
        alert('Arquivo inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
  }
  function limparTudo() {
    if (!confirm('Apagar TODOS os dados do sistema (departamentos, colaboradores, materiais, produtos, pedidos, OPs, compras e estoque)? Esta ação não pode ser desfeita.')) return;
    if (!confirm('Confirma definitivamente? Tudo será apagado.')) return;
    update(() => garantirAdminPadrao(emptyDb()));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Módulo 9"), /*#__PURE__*/React.createElement("h2", null, "Painel de Produção")), /*#__PURE__*/React.createElement("div", {
    className: "row-actions"
  }, vazio ? /*#__PURE__*/React.createElement("button", {
    className: "btn accent",
    onClick: carregarTeste
  }, "Carregar linha de teste (avental)") : /*#__PURE__*/React.createElement("button", {
    className: "btn danger sm",
    onClick: limparTudo
  }, "Limpar todos os dados"))), /*#__PURE__*/React.createElement("div", {
    className: "kpis"
  }, /*#__PURE__*/React.createElement("div", {
    className: "kpi accent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "OPs ativas"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, kpi.total)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "No prazo"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, kpi.noprazo)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Atenção"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, kpi.atencao)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Atrasadas"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, kpi.atrasado)), /*#__PURE__*/React.createElement("div", {
    className: "kpi"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lbl"
  }, "Concluídas"), /*#__PURE__*/React.createElement("div", {
    className: "val"
  }, opsConcluidas))), /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("h3", null, "Backup dos dados"), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: {
      marginTop: -6,
      marginBottom: 10
    }
  }, "Os dados ficam salvos no banco de dados compartilhado (Supabase) — todos os dispositivos veem as mesmas informações. Baixe um backup periodicamente por segurança.", ' ', "Base atual: ", /*#__PURE__*/React.createElement("strong", null, (tamanhoBase(db) / 1024 / 1024).toFixed(2), " MB")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: rotuloArmazenamento().tone
  }, rotuloArmazenamento().texto)), /*#__PURE__*/React.createElement("div", {
    className: "row-actions",
    style: {
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn accent sm",
    onClick: baixarBackup
  }, "⬇ Baixar backup (.json)"), /*#__PURE__*/React.createElement("label", {
    className: "btn ghost sm",
    style: {
      cursor: 'pointer'
    }
  }, "⬆ Restaurar backup", /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json,.json",
    style: {
      display: 'none'
    },
    onChange: restaurarBackup
  })))), materiaisBaixos > 0 && /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      borderColor: 'var(--bad)',
      background: 'var(--bad-bg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "small",
    style: {
      color: 'var(--bad)',
      fontWeight: 600
    }
  }, "⚠ ", materiaisBaixos, " material(is) abaixo do estoque mínimo."), ' ', /*#__PURE__*/React.createElement("button", {
    className: "link-btn",
    onClick: () => setTab('estoque')
  }, "Ver estoque")), /*#__PURE__*/React.createElement("div", {
    className: "legend"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--ok)'
    }
  }), "Dentro do prazo"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--warn)'
    }
  }), "Atenção"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--bad)'
    }
  }), "Atrasado"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dot",
    style: {
      background: 'var(--idle)'
    }
  }), "Não iniciado")), /*#__PURE__*/React.createElement("div", {
    className: "panel",
    style: {
      padding: 0
    }
  }, opsAtivas.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20
    }
  }, /*#__PURE__*/React.createElement(Empty, {
    text: opsConcluidas > 0 ? `Nenhuma OP em andamento — ${opsConcluidas} concluída(s).` : "Nenhuma OP em andamento. Gere uma OP a partir de um pedido."
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "OP"), /*#__PURE__*/React.createElement("th", null, "Cliente"), /*#__PURE__*/React.createElement("th", null, "Produto"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Etapa atual"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Produzido"), /*#__PURE__*/React.createElement("th", null, "Entrega"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, opsAtivas.slice().sort((a, b) => b.numero - a.numero).map(op => {
    const pedido = db.pedidos.find(p => p.id === op.pedidoId);
    const produto = db.produtos.find(p => p.id === op.produtoId);
    const info = opStatusInfo(op);
    const dotColor = info.tone === 'ok' ? 'var(--ok)' : info.tone === 'warn' ? 'var(--warn)' : info.tone === 'bad' ? 'var(--bad)' : 'var(--idle)';
    return /*#__PURE__*/React.createElement("tr", {
      key: op.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "dot",
      style: {
        background: dotColor,
        marginRight: 8
      }
    }), rotuloOP(op)), /*#__PURE__*/React.createElement("td", null, pedido ? pedido.cliente : '—'), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, produto ? produto.nome : '—'), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, op.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, info.etapaAtual), /*#__PURE__*/React.createElement("td", {
      className: "num"
    }, info.produzido, "/", op.quantidade), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, fmtDate(op.entrega)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: "btn ghost sm",
      onClick: () => setTab('producao')
    }, "Ver OP")));
  })))));
}

/* ==========================================================
   MÓDULO 6 — CRIAÇÃO (Solicitação de Arte)
========================================================== */
const TIPOS_PERSONALIZACAO = ["Silk", "Bordado", "Sublimação", "Outro"];
const LOCAIS_PERSONALIZACAO = ["Frente", "Costas", "Manga", "Bolso", "Lateral", "Centralizado", "Canto superior direito", "Canto superior esquerdo", "Outro"];

function resumoItensArte(itens) {
  return (itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(', ') || '—';
}

function GaleriaAnexos({ itens, onRemover }) {
  if (!itens || itens.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }
  }, itens.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.id,
    style: { border: '1px solid var(--line)', borderRadius: 6, padding: 4, width: 74, textAlign: 'center' }
  }, a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
    src: a.url,
    alt: a.nome,
    style: { width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }
  }) : /*#__PURE__*/React.createElement("div", {
    style: { width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }
  }, "📄"), /*#__PURE__*/React.createElement("div", {
    className: "small muted",
    style: { fontSize: 9, wordBreak: 'break-word', maxHeight: 24, overflow: 'hidden' }
  }, a.nome), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "btn danger sm",
    style: { marginTop: 4, padding: '2px 6px', fontSize: 10 },
    onClick: () => onRemover(a.id)
  }, "Remover"))));
}

function SolicitacaoArteModal({ sol, db, onClose, onSave }) {
  const ehEdicao = !!sol.id;
  const [f, setF] = useState({
    ehAlteracao: false,
    clienteId: '',
    itens: [],
    tamanhoProduto: '',
    corProduto: '',
    tecidoMaterial: '',
    tipoPersonalizacao: 'Silk',
    tipoPersonalizacaoOutro: '',
    localPersonalizacao: 'Frente',
    localPersonalizacaoOutro: '',
    tamanhoEstampa: '',
    corEstampa: '',
    fotosProduto: [],
    arquivosLogo: [],
    textoArte: '',
    arquivosReferencia: [],
    observacoesCliente: '',
    descricaoAlteracao: '',
    ...sol
  });
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const [produtoSel, setProdutoSel] = useState('');
  const [qtdSel, setQtdSel] = useState(1);
  const produtosDisponiveis = (db.produtos || []).filter(p => !f.itens.some(it => it.produtoId === p.id));

  function addItem() {
    if (!produtoSel) return;
    const p = db.produtos.find(x => x.id === produtoSel);
    if (!p) return;
    set('itens', [...f.itens, { id: uid(), produtoId: p.id, produtoNomeSnap: p.nome, quantidade: num(qtdSel) || 1 }]);
    setProdutoSel('');
    setQtdSel(1);
  }
  function rmItem(id) {
    set('itens', f.itens.filter(i => i.id !== id));
  }

  async function onArquivo(campo, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ehImagem = file.type.startsWith('image/');
    try {
      let url;
      if (ehImagem) {
        url = await comprimirImagem(file);
      } else {
        if (file.size > LIMITE_ANEXO_BYTES) {
          alert('Arquivo muito grande (máx. 400 KB). Anexe um arquivo menor.');
          return;
        }
        url = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo.'));
          r.readAsDataURL(file);
        });
      }
      set(campo, [...(f[campo] || []), { id: uid(), nome: file.name, tipo: ehImagem ? 'imagem' : 'documento', url }]);
    } catch (err) {
      alert('Não foi possível anexar o arquivo: ' + (err && err.message ? err.message : 'erro desconhecido'));
    }
  }
  function rmArquivo(campo, id) {
    set(campo, (f[campo] || []).filter(a => a.id !== id));
  }

  function salvar() {
    if (!f.clienteId) {
      alert('Selecione o cliente.');
      return;
    }
    if (f.itens.length === 0) {
      alert('Adicione ao menos um produto.');
      return;
    }
    if (f.ehAlteracao && !f.descricaoAlteracao.trim()) {
      alert('Descreva o que precisa ser alterado.');
      return;
    }
    const cliente = db.clientes.find(c => c.id === f.clienteId);
    onSave({ ...f, clienteNomeSnap: cliente ? cliente.nome : '' });
  }

  return /*#__PURE__*/React.createElement(Modal, {
    title: ehEdicao ? 'Editar solicitação de arte' : 'Nova solicitação de arte',
    onClose: onClose,
    wide: true
  },
    /*#__PURE__*/React.createElement("div", { className: "row-actions", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: 'btn sm ' + (!f.ehAlteracao ? 'accent' : 'ghost'),
        onClick: () => set('ehAlteracao', false)
      }, "Arte nova"),
      /*#__PURE__*/React.createElement("button", {
        type: "button",
        className: 'btn sm ' + (f.ehAlteracao ? 'accent' : 'ghost'),
        onClick: () => set('ehAlteracao', true)
      }, "Alteração de arte")
    ),
    /*#__PURE__*/React.createElement("div", { className: "grid2" },
      /*#__PURE__*/React.createElement(Field, { label: "Cliente" },
        /*#__PURE__*/React.createElement("select", {
          value: f.clienteId,
          onChange: e => set('clienteId', e.target.value)
        },
          /*#__PURE__*/React.createElement("option", { value: "" }, "Selecione…"),
          (db.clientes || []).map(c => /*#__PURE__*/React.createElement("option", { key: c.id, value: c.id }, c.nome))
        )
      )
    ),
    /*#__PURE__*/React.createElement(Field, { label: "Produtos e quantidades" },
      /*#__PURE__*/React.createElement("div", { className: "row-actions", style: { flexWrap: 'wrap', alignItems: 'center' } },
        /*#__PURE__*/React.createElement("select", {
          value: produtoSel,
          onChange: e => setProdutoSel(e.target.value),
          style: { minWidth: 200 }
        },
          /*#__PURE__*/React.createElement("option", { value: "" }, "Selecione um produto…"),
          produtosDisponiveis.map(p => /*#__PURE__*/React.createElement("option", { key: p.id, value: p.id }, p.nome))
        ),
        /*#__PURE__*/React.createElement("input", {
          type: "number",
          min: "1",
          value: qtdSel,
          onChange: e => setQtdSel(e.target.value),
          style: { width: 80 }
        }),
        /*#__PURE__*/React.createElement("button", { type: "button", className: "btn ghost sm", onClick: addItem }, "+ Adicionar")
      ),
      f.itens.length > 0 && /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
        f.itens.map(it => /*#__PURE__*/React.createElement("span", {
          key: it.id,
          className: "badge idle",
          style: { cursor: 'default' }
        }, `${it.produtoNomeSnap} (${it.quantidade})`, /*#__PURE__*/React.createElement("button", {
          type: "button",
          onClick: () => rmItem(it.id),
          style: { marginLeft: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }
        }, "✕")))
      )
    ),
    f.ehAlteracao ? /*#__PURE__*/React.createElement(Field, { label: "O que precisa ser alterado (seja específico)" },
      /*#__PURE__*/React.createElement("textarea", {
        rows: 4,
        value: f.descricaoAlteracao,
        onChange: e => set('descricaoAlteracao', e.target.value),
        placeholder: 'Ex: "Alterar a logo do peito de 10 cm para 8 cm e trocar a cor branca por dourada." — evite descrições vagas como "cliente pediu para mudar".'
      })
    ) : /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "grid3" },
        /*#__PURE__*/React.createElement(Field, { label: "Tamanho/medida do produto" },
          /*#__PURE__*/React.createElement("input", { value: f.tamanhoProduto, onChange: e => set('tamanhoProduto', e.target.value) })),
        /*#__PURE__*/React.createElement(Field, { label: "Cor do produto" },
          /*#__PURE__*/React.createElement("input", { value: f.corProduto, onChange: e => set('corProduto', e.target.value) })),
        /*#__PURE__*/React.createElement(Field, { label: "Tecido/material" },
          /*#__PURE__*/React.createElement("input", { value: f.tecidoMaterial, onChange: e => set('tecidoMaterial', e.target.value) }))
      ),
      /*#__PURE__*/React.createElement("div", { className: "grid2" },
        /*#__PURE__*/React.createElement(Field, { label: "Tipo de personalização" },
          /*#__PURE__*/React.createElement("select", {
            value: f.tipoPersonalizacao,
            onChange: e => set('tipoPersonalizacao', e.target.value)
          }, TIPOS_PERSONALIZACAO.map(t => /*#__PURE__*/React.createElement("option", { key: t, value: t }, t))),
          f.tipoPersonalizacao === 'Outro' && /*#__PURE__*/React.createElement("input", {
            style: { marginTop: 6 },
            value: f.tipoPersonalizacaoOutro,
            onChange: e => set('tipoPersonalizacaoOutro', e.target.value),
            placeholder: "Especifique"
          })
        ),
        /*#__PURE__*/React.createElement(Field, { label: "Local da personalização" },
          /*#__PURE__*/React.createElement("select", {
            value: f.localPersonalizacao,
            onChange: e => set('localPersonalizacao', e.target.value)
          }, LOCAIS_PERSONALIZACAO.map(t => /*#__PURE__*/React.createElement("option", { key: t, value: t }, t))),
          f.localPersonalizacao === 'Outro' && /*#__PURE__*/React.createElement("input", {
            style: { marginTop: 6 },
            value: f.localPersonalizacaoOutro,
            onChange: e => set('localPersonalizacaoOutro', e.target.value),
            placeholder: "Especifique"
          })
        )
      ),
      /*#__PURE__*/React.createElement("div", { className: "grid2" },
        /*#__PURE__*/React.createElement(Field, { label: "Tamanho da estampa/logo" },
          /*#__PURE__*/React.createElement("input", { value: f.tamanhoEstampa, onChange: e => set('tamanhoEstampa', e.target.value), placeholder: "Ex: 10cm x 8cm" })),
        /*#__PURE__*/React.createElement(Field, { label: "Cor da estampa" },
          /*#__PURE__*/React.createElement("input", { value: f.corEstampa, onChange: e => set('corEstampa', e.target.value) }))
      ),
      /*#__PURE__*/React.createElement(Field, { label: "Foto do produto" },
        /*#__PURE__*/React.createElement("input", { type: "file", accept: "image/*", onChange: e => onArquivo('fotosProduto', e) }),
        /*#__PURE__*/React.createElement(GaleriaAnexos, { itens: f.fotosProduto, onRemover: id => rmArquivo('fotosProduto', id) })
      ),
      /*#__PURE__*/React.createElement(Field, { label: "Logo/arquivo do cliente" },
        /*#__PURE__*/React.createElement("input", { type: "file", onChange: e => onArquivo('arquivosLogo', e) }),
        /*#__PURE__*/React.createElement(GaleriaAnexos, { itens: f.arquivosLogo, onRemover: id => rmArquivo('arquivosLogo', id) })
      ),
      /*#__PURE__*/React.createElement(Field, { label: "Texto que deve entrar na arte" },
        /*#__PURE__*/React.createElement("textarea", { rows: 2, value: f.textoArte, onChange: e => set('textoArte', e.target.value), placeholder: "Escrever exatamente como deverá aparecer." })
      ),
      /*#__PURE__*/React.createElement(Field, { label: "Referência (foto, modelo ou exemplo enviado pelo cliente)" },
        /*#__PURE__*/React.createElement("input", { type: "file", onChange: e => onArquivo('arquivosReferencia', e) }),
        /*#__PURE__*/React.createElement(GaleriaAnexos, { itens: f.arquivosReferencia, onRemover: id => rmArquivo('arquivosReferencia', id) })
      ),
      /*#__PURE__*/React.createElement(Field, { label: "Observações do cliente" },
        /*#__PURE__*/React.createElement("textarea", { rows: 2, value: f.observacoesCliente, onChange: e => set('observacoesCliente', e.target.value) })
      )
    ),
    /*#__PURE__*/React.createElement("div", { className: "modal-actions" },
      /*#__PURE__*/React.createElement("button", { className: "btn ghost", onClick: onClose }, "Cancelar"),
      /*#__PURE__*/React.createElement("button", { className: "btn accent", onClick: salvar }, "Salvar solicitação")
    )
  );
}

function ImprimirSolicitacaoArte({ sol, onClose }) {
  const linhas = [
    { k: 'Cliente', v: sol.clienteNomeSnap || '—' },
    { k: 'Produto(s)', v: resumoItensArte(sol.itens) }
  ];
  if (sol.ehAlteracao) {
    linhas.push({ k: 'O que precisa ser alterado', v: sol.descricaoAlteracao || '—' });
  } else {
    linhas.push(
      { k: 'Tamanho/medida do produto', v: sol.tamanhoProduto || '—' },
      { k: 'Cor do produto', v: sol.corProduto || '—' },
      { k: 'Tecido/material', v: sol.tecidoMaterial || '—' },
      { k: 'Tipo de personalização', v: (sol.tipoPersonalizacao === 'Outro' ? sol.tipoPersonalizacaoOutro : sol.tipoPersonalizacao) || '—' },
      { k: 'Local da personalização', v: (sol.localPersonalizacao === 'Outro' ? sol.localPersonalizacaoOutro : sol.localPersonalizacao) || '—' },
      { k: 'Tamanho da estampa/logo', v: sol.tamanhoEstampa || '—' },
      { k: 'Cor da estampa', v: sol.corEstampa || '—' },
      { k: 'Texto que deve entrar na arte', v: sol.textoArte || '—' }
    );
    if ((sol.observacoesCliente || '').trim()) linhas.push({ k: 'Observações do cliente', v: sol.observacoesCliente });
  }
  const anexos = [...(sol.fotosProduto || []), ...(sol.arquivosLogo || []), ...(sol.arquivosReferencia || [])];
  return /*#__PURE__*/React.createElement(Modal, {
    title: `${sol.ehAlteracao ? 'Alteração' : 'Solicitação'} de arte #${String(sol.numero).padStart(3, '0')}`,
    onClose: onClose,
    wide: true
  },
    /*#__PURE__*/React.createElement("div", { style: { marginBottom: 12 } },
      /*#__PURE__*/React.createElement("button", { className: "btn accent sm", onClick: () => window.print() }, "🖨️ Imprimir / salvar como PDF")
    ),
    /*#__PURE__*/React.createElement("div", { className: "report-doc" },
      /*#__PURE__*/React.createElement("h2", null, sol.ehAlteracao ? 'Alteração de Arte' : 'Solicitação de Arte'),
      /*#__PURE__*/React.createElement("div", { className: "rep-sub" }, `Confecção ERP · Pedido #${String(sol.numero).padStart(3, '0')} · Emitido em ${fmtDate(todayISO())}`),
      /*#__PURE__*/React.createElement("div", { className: "rep-grid" },
        linhas.map(l => /*#__PURE__*/React.createElement("div", { className: "rep-box", key: l.k },
          /*#__PURE__*/React.createElement("div", { className: "k" }, l.k),
          /*#__PURE__*/React.createElement("div", { className: "v" }, l.v)
        ))
      ),
      anexos.length > 0 && /*#__PURE__*/React.createElement("div", { style: { marginTop: 16 } },
        /*#__PURE__*/React.createElement("div", { className: "rep-sub", style: { marginBottom: 8 } }, "Anexos"),
        /*#__PURE__*/React.createElement("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
          anexos.map(a => a.tipo === 'imagem' ? /*#__PURE__*/React.createElement("img", {
            key: a.id,
            src: a.url,
            alt: a.nome,
            style: { width: 160, height: 160, objectFit: 'contain', border: '1px solid var(--line)', borderRadius: 6, background: '#fff' }
          }) : /*#__PURE__*/React.createElement("div", {
            key: a.id,
            className: "small",
            style: { border: '1px solid var(--line)', borderRadius: 6, padding: 8 }
          }, "📄 ", a.nome))
        )
      )
    )
  );
}

function Criacao({ db, update, usuario }) {
  const [modal, setModal] = useState(null);
  const [imprimir, setImprimir] = useState(null);
  const [q, setQ] = useState('');
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const lista = (db.solicitacoesArte || [])
    .filter(s => mostrarConcluidas ? s.status === 'concluida' : s.status !== 'concluida')
    .filter(s => {
      const t = q.toLowerCase();
      return !t || (s.clienteNomeSnap || '').toLowerCase().includes(t) || resumoItensArte(s.itens).toLowerCase().includes(t);
    })
    .slice().reverse();

  function salvar(s) {
    update(d => {
      d.solicitacoesArte = d.solicitacoesArte || [];
      if (s.id) {
        d.solicitacoesArte = d.solicitacoesArte.map(x => x.id === s.id ? s : x);
      } else {
        const numero = (d.seq && d.seq.arte) || 1;
        d.seq = { ...(d.seq || {}), arte: numero + 1 };
        d.solicitacoesArte.push({ ...s, id: uid(), numero, status: 'pendente', criadaEm: agoraISO() });
      }
      registrarLog(d, usuario, s.id ? 'Editou solicitação de arte' : 'Criou solicitação de arte', s.clienteNomeSnap || '');
      return d;
    });
    setModal(null);
  }
  function alternarStatus(s) {
    update(d => {
      d.solicitacoesArte = (d.solicitacoesArte || []).map(x => x.id === s.id ? {
        ...x,
        status: x.status === 'concluida' ? 'pendente' : 'concluida',
        concluidaEm: x.status === 'concluida' ? null : agoraISO()
      } : x);
      return d;
    });
  }
  function excluir(id) {
    if (!confirm('Excluir esta solicitação de arte?')) return;
    update(d => {
      d.solicitacoesArte = (d.solicitacoesArte || []).filter(x => x.id !== id);
      return d;
    });
  }

  return /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { className: "page-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("div", { className: "eyebrow" }, "Módulo 6"),
        /*#__PURE__*/React.createElement("h2", null, "Criação — Solicitação de Arte")
      ),
      /*#__PURE__*/React.createElement("button", { className: "btn accent", onClick: () => setModal({}) }, "+ Nova solicitação")
    ),
    /*#__PURE__*/React.createElement("div", { className: "searchbar" },
      /*#__PURE__*/React.createElement("input", { placeholder: "Buscar por cliente ou produto…", value: q, onChange: e => setQ(e.target.value) })
    ),
    /*#__PURE__*/React.createElement("div", { className: "row-actions", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("button", {
        className: 'btn sm ' + (!mostrarConcluidas ? 'accent' : 'ghost'),
        onClick: () => setMostrarConcluidas(false)
      }, "Pendentes"),
      /*#__PURE__*/React.createElement("button", {
        className: 'btn sm ' + (mostrarConcluidas ? 'accent' : 'ghost'),
        onClick: () => setMostrarConcluidas(true)
      }, "Concluídas")
    ),
    /*#__PURE__*/React.createElement("div", { className: "panel", style: { padding: 0 } },
      lista.length === 0 ? /*#__PURE__*/React.createElement("div", { style: { padding: 20 } },
        /*#__PURE__*/React.createElement(Empty, { text: "Nenhuma solicitação de arte encontrada." })
      ) : /*#__PURE__*/React.createElement("table", null,
        /*#__PURE__*/React.createElement("thead", null,
          /*#__PURE__*/React.createElement("tr", null,
            /*#__PURE__*/React.createElement("th", null, "#"),
            /*#__PURE__*/React.createElement("th", null, "Cliente"),
            /*#__PURE__*/React.createElement("th", null, "Produto(s)"),
            /*#__PURE__*/React.createElement("th", null, "Tipo"),
            /*#__PURE__*/React.createElement("th", null)
          )
        ),
        /*#__PURE__*/React.createElement("tbody", null,
          lista.map(s => /*#__PURE__*/React.createElement("tr", { key: s.id },
            /*#__PURE__*/React.createElement("td", { className: "small muted" }, String(s.numero).padStart(3, '0')),
            /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, s.clienteNomeSnap || '—')),
            /*#__PURE__*/React.createElement("td", { className: "small" }, resumoItensArte(s.itens)),
            /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, { tone: s.ehAlteracao ? 'warn' : 'ok' }, s.ehAlteracao ? 'Alteração' : 'Arte nova')),
            /*#__PURE__*/React.createElement("td", { className: "row-actions" },
              /*#__PURE__*/React.createElement("button", { className: "btn ghost sm", onClick: () => setModal(s) }, "Editar"),
              /*#__PURE__*/React.createElement("button", { className: "btn ghost sm", onClick: () => setImprimir(s) }, "Imprimir"),
              /*#__PURE__*/React.createElement("button", { className: "btn ghost sm", onClick: () => alternarStatus(s) }, s.status === 'concluida' ? 'Reabrir' : 'Concluir'),
              /*#__PURE__*/React.createElement("button", { className: "btn danger sm", onClick: () => excluir(s.id) }, "Excluir")
            )
          ))
        )
      )
    ),
    modal !== null && /*#__PURE__*/React.createElement(SolicitacaoArteModal, { sol: modal, db: db, onClose: () => setModal(null), onSave: salvar }),
    imprimir !== null && /*#__PURE__*/React.createElement(ImprimirSolicitacaoArte, { sol: imprimir, onClose: () => setImprimir(null) })
  );
}

export default App;
