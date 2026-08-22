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
const STATUS_COMPRA = ["Solicitado", "Comprado", "Recebido"];
/* --- Jornada de trabalho da fábrica ---
   Seg a sex: 06:00–12:00 e 13:00–15:48  (8h48 = 528 min)
   Extensão até 18:00 com autorização de superior (+2h12 = 132 min → 660 min)
   Sábado: 06:00–12:00 (360 min), somente com autorização de superior */
function minParaHHMM(min) {
  const m = Math.round(num(min));
  const h = Math.floor(m / 60),
    r = m % 60;
  return `${h}:${String(r).padStart(2, '0')}`;
}
const emptyDb = () => ({
  materiais: [],
  produtos: [],
  compras: [],
  movimentacoes: [],
  colaboradores: [],
  clientes: [],
  fornecedores: [],
  equipamentos: [],
  logs: [],
  mensagens: [],
  permissoes: null,
  categoriasMaterial: [],
  categoriasProduto: [],
  gruposProduto: [],
  subgruposProduto: [],
  orcamentos: [],
  seq: {
    compra: 100,
    orcamento: 100
  }
});

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
    abas: ['painel', 'pessoas', 'relatorios', 'chat'],
    acoes: {
      cadastros: true,
      pessoas: true,
      financeiro: true,
      admin: true
    }
  },
  'Gestor': {
    abas: ['painel', 'pessoas', 'relatorios', 'chat'],
    acoes: {
      cadastros: true,
      pessoas: false,
      financeiro: false,
      admin: false
    }
  },
  'Colaborador': {
    abas: ['chat'],
    acoes: {
      cadastros: false,
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
const COLECOES_ARRAY = ['materiais', 'produtos', 'compras', 'movimentacoes', 'colaboradores', 'clientes', 'fornecedores', 'equipamentos', 'logs', 'mensagens', 'categoriasMaterial', 'categoriasProduto', 'gruposProduto', 'subgruposProduto', 'orcamentos'];
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
    id: 'relatorios',
    n: '3',
    label: 'Relatórios'
  }, {
    id: 'chat',
    n: '4',
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
  const [sub, setSub] = useState('materiais');
  const podeFin = !perm || perm.financeiro;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Grupo 6"), /*#__PURE__*/React.createElement("h2", null, "Relatórios"))), /*#__PURE__*/React.createElement(SubTabs, {
    active: sub,
    onChange: setSub,
    tabs: [{
      id: 'materiais',
      label: 'Materiais & Custos'
    }, {
      id: 'cadastros',
      label: 'Cadastros'
    }]
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
    sub: funcoesColaborador(c).join(', ') || '—'
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
  })) : /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Nome"), /*#__PURE__*/React.createElement("th", null, "Funções"), /*#__PURE__*/React.createElement("th", null, "Admissão"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Salário"), /*#__PURE__*/React.createElement("th", null, "Perfil"), /*#__PURE__*/React.createElement("th", null, "Acesso"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, list.map(c => {
    const temSenha = temSenhaDefinida(c);
    return /*#__PURE__*/React.createElement("tr", {
      key: c.id
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("strong", null, c.nome), /*#__PURE__*/React.createElement("div", {
      className: "small muted"
    }, c.celular || c.telefone)), /*#__PURE__*/React.createElement("td", {
      className: "small"
    }, funcoesColaborador(c).join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
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
  const [fStatus, setFStatus] = useState('');
  const lista = (db.equipamentos || []).filter(e => {
    const s = q.toLowerCase();
    if (s && !(e.nome || '').toLowerCase().includes(s) && !(e.codigo || '').toLowerCase().includes(s) && !(e.numeroSerie || '').toLowerCase().includes(s) && !(e.marca || '').toLowerCase().includes(s)) return false;
    if (fStatus && (e.status || 'Operando') !== fStatus) return false;
    return true;
  });
  function save(eq) {
    const erro = checarDuplicidade(db.equipamentos || [], eq, [{ key: 'codigo', label: 'código' }, { key: 'numeroSerie', label: 'número de série' }]);
    if (erro) {
      alert(erro);
      return;
    }
    update(d => {
      if (eq.id) {
        d.equipamentos = d.equipamentos.map(x => x.id === eq.id ? eq : x);
      } else {
        d.equipamentos = [...(d.equipamentos || []), { ...eq, id: uid() }];
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
  return <div>
    <div className="page-head">
      <div className="eyebrow">Equipamentos e máquinas</div>
      <button className="btn accent" onClick={() => setModal({})}>+ Novo equipamento</button>
    </div>
    <div className="panel">
      <h3>Filtros</h3>
      <div className="grid3">
        <Field label="Buscar">
          <input placeholder="Nome, código, série ou marca…" value={q} onChange={e => setQ(e.target.value)} />
        </Field>
        <Field label="Situação">
          <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
            <option value="">Todas</option>
            {STATUS_EQUIP.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </Field>
      </div>
      <button className="btn ghost sm" onClick={() => { setQ(''); setFStatus(''); }}>Limpar filtros</button>
    </div>
    {emManutencao > 0 && <div className="panel" style={{ borderColor: 'var(--warn)', background: 'var(--warn-bg)' }}>
      <span className="small" style={{ color: 'var(--warn)', fontWeight: 600 }}>⚠ {emManutencao} equipamento(s) em manutenção.</span>
    </div>}
    <div className="panel" style={{ padding: 0 }}>
      {lista.length === 0 ? <div style={{ padding: 20 }}><Empty text="Nenhum equipamento cadastrado. Ex: máquina reta, overlock, galoneira, prensa térmica." /></div> : <table>
        <thead>
          <tr>
            <th>Código</th><th>Equipamento</th><th>Marca / Modelo</th><th>Nº de série</th><th>Aquisição</th><th>Próx. manutenção</th><th>Situação</th><th></th>
          </tr>
        </thead>
        <tbody>
          {lista.map(eq => {
            const st = eq.status || 'Operando';
            const tone = st === 'Operando' ? 'ok' : st === 'Em manutenção' ? 'warn' : st === 'Parado' ? 'bad' : 'idle';
            const atrasada = eq.proximaManutencao && eq.proximaManutencao < todayISO();
            return <tr key={eq.id}>
              <td className="small muted"><strong>{eq.codigo}</strong></td>
              <td>{eq.nome}</td>
              <td className="small">{[eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—'}</td>
              <td className="small muted">{eq.numeroSerie || '—'}</td>
              <td className="small">{fmtDate(eq.dataAquisicao)}</td>
              <td className="small" style={atrasada ? { color: 'var(--bad)', fontWeight: 600 } : {}}>{fmtDate(eq.proximaManutencao)}{atrasada && ' ⚠'}</td>
              <td><Badge tone={tone}>{st}</Badge></td>
              <td className="row-actions">
                <button className="btn ghost sm" onClick={() => setModal(eq)}>Editar</button>
                <button className="btn accent sm" onClick={() => setHistorico(eq)}>Histórico</button>
                <button className="btn danger sm" onClick={() => remove(eq.id)}>Excluir</button>
              </td>
            </tr>;
          })}
        </tbody>
      </table>}
    </div>
    {modal !== null && <EquipamentoModal eq={modal} db={db} onClose={() => setModal(null)} onSave={save} />}
    {historico && <HistoricoEquipamentoModal eq={historico} db={db} update={update} onClose={() => setHistorico(null)} />}
  </div>;
}

/* ==========================================================
   FICHA DE HISTÓRICO DO EQUIPAMENTO
========================================================== */
function HistoricoEquipamentoModal({
  eq,
  db,
  update,
  onClose
}) {
  const manutencoes = (eq.manutencoes || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const custoManut = manutencoes.reduce((s, m) => s + num(m.custo), 0);
  function addManutencao(m) {
    update(d => {
      d.equipamentos = d.equipamentos.map(x => x.id === eq.id ? {
        ...x,
        manutencoes: [...(x.manutencoes || []), { ...m, id: uid() }],
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
  return <Modal title={`Histórico — ${eq.codigo} · ${eq.nome}`} onClose={onClose} wide>
    <div style={{ marginBottom: 12 }}>
      <button className="btn accent sm" onClick={() => window.print()}>🖨️ Imprimir / salvar como PDF</button>
    </div>
    <div className="report-doc">
      <h2>Ficha do Equipamento</h2>
      <div className="rep-sub">{eq.codigo} · {eq.nome} · Emitida em {fmtDate(todayISO())}</div>
      <div className="rep-grid">
        <div className="rep-box"><div className="k">Tipo</div><div className="v">{eq.tipo || '—'}</div></div>
        <div className="rep-box"><div className="k">Situação</div><div className="v">{eq.status || 'Operando'}</div></div>
        <div className="rep-box"><div className="k">Localização</div><div className="v">{eq.localizacao || '—'}</div></div>
      </div>
      <h4>Identificação</h4>
      <table><tbody>
        <tr><td>Marca / Modelo</td><td>{[eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—'}</td></tr>
        <tr><td>Número de série</td><td>{eq.numeroSerie || '—'}</td></tr>
        <tr><td>Patrimônio</td><td>{eq.patrimonio || '—'}</td></tr>
        <tr><td>Aquisição</td><td>{fmtDate(eq.dataAquisicao)} {num(eq.valorAquisicao) > 0 && `· ${money(eq.valorAquisicao)}`}</td></tr>
        <tr><td>Fornecedor</td><td>{eq.fornecedor || '—'}</td></tr>
        <tr><td>Última manutenção</td><td>{fmtDate(eq.ultimaManutencao)}</td></tr>
        <tr><td>Próxima manutenção</td><td>{fmtDate(eq.proximaManutencao)}</td></tr>
      </tbody></table>
      {eq.observacoes && <><h4>Observações</h4><div style={{ fontSize: 12.5 }}>{eq.observacoes}</div></>}
      <h4>Manutenções e peças trocadas</h4>
      {manutencoes.length === 0 ? <Empty text="Nenhuma manutenção registrada." /> : <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Peças trocadas</th><th>Serviço executado</th><th>Responsável</th><th className="num">Custo</th><th className="num">Parada</th><th></th></tr></thead>
        <tbody>
          {manutencoes.map(m => <tr key={m.id}>
            <td className="small">{fmtDate(m.data)}</td>
            <td><Badge tone={m.tipo === 'Corretiva' ? 'bad' : m.tipo === 'Preventiva' ? 'ok' : 'info'}>{m.tipo}</Badge></td>
            <td className="small">{m.pecas || '—'}</td>
            <td className="small muted">{m.servico || '—'}</td>
            <td className="small">{m.responsavel || '—'}</td>
            <td className="num">{money(m.custo)}</td>
            <td className="num small">{num(m.horasParada) > 0 ? `${m.horasParada} h` : '—'}</td>
            <td><button className="btn danger sm" onClick={() => rmManutencao(m.id)}>Excluir</button></td>
          </tr>)}
          <tr>
            <td colSpan="5" style={{ textAlign: 'right' }}><strong>Custo total</strong></td>
            <td className="num"><strong>{money(custoManut)}</strong></td>
            <td colSpan="2"></td>
          </tr>
        </tbody>
      </table>}
    </div>
    <NovaManutencao db={db} onAdd={addManutencao} />
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Fechar</button>
    </div>
  </Modal>;
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
  }, p.observacoes), /*#__PURE__*/React.createElement("div", {
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
    return { mat, qtd, custoUnit, total: qtd * custoUnit };
  });
  const totalMat = materiais.reduce((s, l) => s + l.total, 0);
  return <Modal title={`Ficha técnica — ${produto.nome}`} onClose={onClose} wide>
    <div style={{ marginBottom: 12 }}>
      <button className="btn accent sm" onClick={() => window.print()}>🖨️ Imprimir / salvar como PDF</button>
    </div>
    <div className="report-doc">
      <h2>Ficha Técnica de Produto</h2>
      <div className="rep-sub">Confecção ERP · Emitida em {fmtDate(todayISO())}</div>
      <div className="rep-grid">
        <div className="rep-box"><div className="k">Código</div><div className="v">{produto.codigo}</div></div>
        <div className="rep-box"><div className="k">Categoria</div><div className="v">{cat ? cat.nome : '—'}</div></div>
        <div className="rep-box"><div className="k">Grupo / Subgrupo</div><div className="v">{[grupo && grupo.nome, sub && sub.nome].filter(Boolean).join(' / ') || '—'}</div></div>
        <div className="rep-box"><div className="k">Medida</div><div className="v">{produto.medidas || '—'}</div></div>
      </div>
      {imagens.length > 0 && <div className="ficha-hero">
        <img src={imagens[0].url} alt={imagens[0].nome} />
        {imagens.length > 1 && <div className="ficha-hero-mini">{imagens.slice(1).map(a => <img key={a.id} src={a.url} alt={a.nome} />)}</div>}
      </div>}
      <h4>Descrição</h4>
      <div style={{ fontSize: 13, marginBottom: 8 }}>{produto.nome}</div>
      {tecido && <div className="small muted">Tecido base: <strong>{tecido.codigo} · {tecido.nome}</strong></div>}
      {produto.observacoes && <div style={{ marginTop: 8, fontSize: 12.5, borderLeft: '3px solid var(--thread)', paddingLeft: 10 }}><strong>Observações:</strong> {produto.observacoes}</div>}
      <h4>Consumo de materiais</h4>
      {materiais.length === 0 ? <div className="small muted">Nenhum material definido na ficha técnica.</div> : <table>
        <thead><tr><th>Código</th><th>Material</th><th className="num">Consumo / peça</th>{podeFin && <><th className="num">Custo unit.</th><th className="num">Custo / peça</th></>}</tr></thead>
        <tbody>
          {materiais.map((l, i) => <tr key={i}>
            <td className="small muted">{l.mat ? l.mat.codigo : '—'}</td>
            <td>{l.mat ? l.mat.nome : '(material removido)'}</td>
            <td className="num">{l.qtd} {l.mat ? l.mat.unidade : ''}</td>
            {podeFin && <><td className="num">{money(l.custoUnit)}</td><td className="num">{money(l.total)}</td></>}
          </tr>)}
          {podeFin && <tr>
            <td colSpan="2" style={{ textAlign: 'right' }}><strong>Total de materiais</strong></td>
            <td></td>
            <td></td>
            <td className="num"><strong>{money(totalMat)}</strong></td>
          </tr>}
        </tbody>
      </table>}
      {podeFin && <>
        <h4>Custo unitário de produção</h4>
        <table><tbody>
          <tr><td><strong>Custo de materiais por peça</strong></td><td className="num"><strong>{money(custo.total)}</strong></td></tr>
        </tbody></table>
        <div className="small muted" style={{ marginTop: 6 }}>O custo de mão de obra não entra aqui — é calculado depois, pelo colaborador real apontado em cada produção.</div>
      </>}
      {documentos.length > 0 && <>
        <h4>Documentos anexados</h4>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{documentos.map(a => <li key={a.id} className="small">{a.nome}</li>)}</ul>
      </>}
      <div className="rep-sign"><div>Conferência técnica</div><div>Aprovação do cliente</div></div>
    </div>
    <div className="modal-actions">
      <button className="btn ghost" onClick={onClose}>Fechar</button>
    </div>
  </Modal>;
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

  const materiaisUsados = (f.fichaTecnica || []).map(x => x.materialId).filter(Boolean);
  const materiaisDisponiveis = db.materiais.filter(m => !materiaisUsados.includes(m.id));
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
  }, "Remover"))))), /*#__PURE__*/React.createElement(Field, {
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
  }, "Qtd."), /*#__PURE__*/React.createElement("th", null, "Origem"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, movsFiltradas.slice().reverse().map(mv => {
    const mat = db.materiais.find(m => m.id === mv.materialId);
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
  }))), /*#__PURE__*/React.createElement("div", {
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
function funcoesColaborador(c) {
  if (!c) return [];
  if (Array.isArray(c.funcoes) && c.funcoes.length) return c.funcoes;
  if (c.cargo && String(c.cargo).trim()) return String(c.cargo).split(/[,;/]+/).map(x => x.trim()).filter(Boolean);
  return [];
}
function ehVendedor(c) {
  return funcoesColaborador(c).some(f => normaliza(f).includes('vended'));
}
function custoUnitarioProduto(produto, db) {
  let custoMat = 0;
  (produto.fichaTecnica || []).forEach(it => {
    const mat = db.materiais.find(m => m.id === it.materialId);
    if (mat) custoMat += num(it.quantidade) * num(mat.custo);
  });
  return {
    custoMat,
    total: custoMat
  };
}

function RelatoriosPessoas({
  db
}) {
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [grupo, setGrupo] = useState('todos'); // todos | clientes | fornecedores | colaboradores | equipamentos

  const noPeriodo = dataISO => {
    if (!ini && !fim) return true;
    if (!dataISO) return false;
    if (ini && dataISO < ini) return false;
    if (fim && dataISO > fim) return false;
    return true;
  };
  const colaboradores = db.colaboradores.filter(c => noPeriodo(c.dataAdmissao));
  const clientes = db.clientes;
  const fornecedores = db.fornecedores;
  const filtroDataAtivo = !!(ini || fim);
  const mostra = g => grupo === 'todos' || grupo === g;
  const ativos = colaboradores.filter(c => c.status !== 'Inativo');
  const folhaTotal = ativos.reduce((s, c) => s + num(c.salario), 0);

  return <div>
    <div className="panel">
      <h3>Filtros</h3>
      <div className="grid3">
        <Field label="Data início"><input type="date" value={ini} onChange={e => setIni(e.target.value)} /></Field>
        <Field label="Data fim"><input type="date" value={fim} onChange={e => setFim(e.target.value)} /></Field>
        <Field label="Grupo de cadastro">
          <select value={grupo} onChange={e => setGrupo(e.target.value)}>
            <option value="todos">Todos os grupos</option>
            <option value="clientes">Clientes</option>
            <option value="fornecedores">Fornecedores</option>
            <option value="colaboradores">Colaboradores</option>
            <option value="equipamentos">Equipamentos</option>
          </select>
        </Field>
      </div>
      <button className="btn ghost sm" onClick={() => { setIni(''); setFim(''); setGrupo('todos'); }}>Limpar filtros</button>
      {filtroDataAtivo && <div className="small muted" style={{ marginTop: 8 }}>Período aplicado à data de admissão dos colaboradores. Clientes e fornecedores não têm data de cadastro registrada.</div>}
    </div>
    <div className="kpis">
      <div className="kpi accent"><div className="lbl">Colaboradores ativos</div><div className="val">{ativos.length}</div></div>
      <div className="kpi"><div className="lbl">Folha mensal</div><div className="val" style={{ fontSize: 22 }}>{money(folhaTotal)}</div></div>
      <div className="kpi"><div className="lbl">Clientes</div><div className="val">{clientes.length}</div></div>
      <div className="kpi"><div className="lbl">Equipamentos</div><div className="val">{(db.equipamentos || []).length}</div></div>
    </div>
    {mostra('colaboradores') && <div className="panel">
      <h3>Colaboradores {filtroDataAtivo && <span className="small muted">(admitidos no período)</span>}</h3>
      {colaboradores.length === 0 ? <Empty text="Nenhum colaborador no filtro." /> : <table>
        <thead><tr><th>Nome</th><th>Cargo</th><th>Admissão</th><th>Perfil</th><th>Acesso</th><th>Status</th></tr></thead>
        <tbody>
          {colaboradores.map(c => {
            const temSenha = temSenhaDefinida(c);
            return <tr key={c.id}>
              <td>{c.nome}</td>
              <td className="small">{funcoesColaborador(c).join(', ') || '—'}</td>
              <td className="small">{fmtDate(c.dataAdmissao)}</td>
              <td className="small">{c.perfil || 'Colaborador'}</td>
              <td>{temSenha ? <Badge tone="ok">Liberado</Badge> : <Badge tone="bad">Bloqueado</Badge>}</td>
              <td><Badge tone={c.status === 'Inativo' ? 'idle' : 'ok'}>{c.status || 'Ativo'}</Badge></td>
            </tr>;
          })}
        </tbody>
      </table>}
    </div>}
    {mostra('clientes') && <div className="panel">
      <h3>Clientes</h3>
      {clientes.length === 0 ? <Empty text="Nenhum cliente cadastrado." /> : <table>
        <thead><tr><th>Nome / Razão Social</th><th>Tipo</th><th>CPF/CNPJ</th><th>Contato</th><th>Cidade/UF</th></tr></thead>
        <tbody>
          {clientes.map(c => <tr key={c.id}>
            <td>{c.nome}</td>
            <td className="small">{c.tipo}</td>
            <td className="small muted">{c.documento}</td>
            <td className="small">{c.celular || c.telefone}</td>
            <td className="small muted">{c.cidade}{c.uf ? `/${c.uf}` : ''}</td>
          </tr>)}
        </tbody>
      </table>}
    </div>}
    {mostra('equipamentos') && <div className="panel">
      <h3>Equipamentos</h3>
      {(db.equipamentos || []).length === 0 ? <Empty text="Nenhum equipamento cadastrado." /> : <table>
        <thead><tr><th>Código</th><th>Equipamento</th><th>Marca/Modelo</th><th>Próx. manutenção</th><th>Situação</th></tr></thead>
        <tbody>
          {(db.equipamentos || []).map(eq => {
            const st = eq.status || 'Operando';
            const tone = st === 'Operando' ? 'ok' : st === 'Em manutenção' ? 'warn' : st === 'Parado' ? 'bad' : 'idle';
            return <tr key={eq.id}>
              <td className="small muted">{eq.codigo}</td>
              <td>{eq.nome}</td>
              <td className="small">{[eq.marca, eq.modelo].filter(Boolean).join(' / ') || '—'}</td>
              <td className="small">{fmtDate(eq.proximaManutencao)}</td>
              <td><Badge tone={tone}>{st}</Badge></td>
            </tr>;
          })}
        </tbody>
      </table>}
    </div>}
    {mostra('fornecedores') && <div className="panel">
      <h3>Fornecedores</h3>
      {fornecedores.length === 0 ? <Empty text="Nenhum fornecedor cadastrado." /> : <table>
        <thead><tr><th>Nome / Razão Social</th><th>CNPJ/CPF</th><th>Categoria</th><th>Contato</th><th>Condição pgto.</th></tr></thead>
        <tbody>
          {fornecedores.map(f => <tr key={f.id}>
            <td>{f.nome}</td>
            <td className="small muted">{f.documento}</td>
            <td className="small">{f.categoria}</td>
            <td className="small">{f.celular || f.telefone}</td>
            <td className="small muted">{f.condicaoPagamento}</td>
          </tr>)}
        </tbody>
      </table>}
    </div>}
  </div>;
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
function Painel({
  db,
  update,
  setTab
}) {
  const materiaisBaixos = db.materiais.filter(m => num(m.estoqueAtual) <= num(m.estoqueMinimo)).length;
  function baixarBackup() {
    try {
      const json = JSON.stringify(db, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
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
        update(() => garantirAdminPadrao({ ...emptyDb(), ...dados }));
        alert('Backup restaurado.');
      } catch (err) {
        alert('Arquivo inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
  }
  function limparTudo() {
    if (!confirm('Apagar TODOS os dados do sistema (colaboradores, materiais, produtos, clientes, fornecedores, equipamentos, compras e estoque)? Esta ação não pode ser desfeita.')) return;
    if (!confirm('Confirma definitivamente? Tudo será apagado.')) return;
    update(() => garantirAdminPadrao(emptyDb()));
  }
  return <div>
    <div className="page-head">
      <div>
        <div className="eyebrow">Painel</div>
        <h2>Visão geral</h2>
      </div>
      <button className="btn danger sm" onClick={limparTudo}>Limpar todos os dados</button>
    </div>
    <div className="panel">
      <h3>Backup dos dados</h3>
      <div className="small muted" style={{ marginTop: -6, marginBottom: 10 }}>
        Os dados ficam salvos no banco de dados compartilhado (Supabase) — todos os dispositivos veem as mesmas informações. Baixe um backup periodicamente por segurança.
        {' '}Base atual: <strong>{(tamanhoBase(db) / 1024 / 1024).toFixed(2)} MB</strong>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Badge tone={rotuloArmazenamento().tone}>{rotuloArmazenamento().texto}</Badge>
      </div>
      <div className="row-actions" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <button className="btn accent sm" onClick={baixarBackup}>⬇ Baixar backup (.json)</button>
        <label className="btn ghost sm" style={{ cursor: 'pointer' }}>
          ⬆ Restaurar backup
          <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={restaurarBackup} />
        </label>
      </div>
    </div>
    {materiaisBaixos > 0 && <div className="panel" style={{ borderColor: 'var(--bad)', background: 'var(--bad-bg)' }}>
      <span className="small" style={{ color: 'var(--bad)', fontWeight: 600 }}>⚠ {materiaisBaixos} material(is) abaixo do estoque mínimo.</span>
      {' '}<button className="link-btn" onClick={() => setTab('pessoas')}>Ver estoque</button>
    </div>}
  </div>;
}

export default App;
