import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock, Users, Package, BarChart3, Plus, Trash2, X, Play, Loader2, ClipboardList, Paperclip, Check, ChevronUp, ChevronDown, ListOrdered, Scissors, Printer, MessageCircle, Send, Pin, Smartphone, Palette } from "lucide-react";

// ---------- Identidade visual (tema de confecção) ----------
// Fonte de destaque "Fraunces" (serifada, com entalhes que lembram costura)
// para títulos e momentos de maior peso; "Inter" segue como fonte de
// trabalho para o restante da interface — leve e legível no chão de fábrica.
const FONT_DISPLAY = "'Fraunces', 'Georgia', serif";
const FONT_BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Adicionado: carrega as fontes e define uma textura sutil de "tecido"
// (trama cruzada) no fundo da aplicação — o pano de fundo de uma
// confecção, sem competir com o conteúdo.
function IdentidadeVisualGlobal() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&family=Inter:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; }
      body { -webkit-font-smoothing: antialiased; }
      .textura-tecido {
        background-image:
          repeating-linear-gradient(45deg, rgba(47,74,99,0.035) 0, rgba(47,74,99,0.035) 1px, transparent 1px, transparent 10px),
          repeating-linear-gradient(-45deg, rgba(47,74,99,0.035) 0, rgba(47,74,99,0.035) 1px, transparent 1px, transparent 10px);
      }
      .costura-topo {
        border-top: 1px dashed rgba(42,32,21,0.22);
      }
      .costura-base {
        border-bottom: 1px dashed rgba(205,185,138,0.4);
      }
    `}</style>
  );
}

// ---------- Helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);

// Adicionado: ordena listas de registros dos relatórios do mais recente
// para o mais antigo (hora decrescente); quando duas linhas têm a mesma
// hora, desempata por etapa e depois por operador, para a ordem ficar
// estável em vez de mudar a cada atualização da tela.
function ordenarRegistrosRelatorio(regs, { hora, etapa, operador }) {
  return [...regs].sort((a, b) => {
    const diffHora = new Date(hora(b)) - new Date(hora(a));
    if (diffHora !== 0) return diffHora;
    const diffEtapa = (etapa(a) || "").localeCompare(etapa(b) || "");
    if (diffEtapa !== 0) return diffEtapa;
    return (operador(a) || "").localeCompare(operador(b) || "");
  });
}

// Classificação: A = 95-100% (ou melhor que o previsto) | B = 80-94% | C = abaixo de 80%
const CLASS_INFO = {
  A: { label: "A", desc: "95–100% da meta (ou melhor)", color: "#1a7a4c", bg: "#e6f4ec" },
  B: { label: "B", desc: "80–94% da meta", color: "#1d6fa5", bg: "#e7f1f8" },
  C: { label: "C", desc: "< 80% da meta", color: "#b13232", bg: "#f8e6e6" },
};
function classify(eficiencia) {
  if (eficiencia >= 95) return "A";
  if (eficiencia >= 80) return "B";
  return "C";
}
function mediaEficiencia(regs) {
  if (!regs.length) return 0;
  const soma = regs.reduce((s, r) => s + Math.min(100, r.eficiencia), 0);
  return Math.round((soma / regs.length) * 10) / 10;
}

// Cor do status da etapa: laranja = em aberto, verde = concluída dentro da meta, vermelho = concluída com atraso/perda
const COR_INFO = {
  laranja: { label: "Em aberto", color: "#b5820a", bg: "#fdf3e0", dot: "#e0a72a" },
  verde: { label: "Concluída", color: "#1a7a4c", bg: "#e6f4ec", dot: "#2fa968" },
  vermelho: { label: "Atraso/perda", color: "#b13232", bg: "#f8e6e6", dot: "#d04a4a" },
};
function corDoRegistro(status, classificacao) {
  if (status === "aberto") return "laranja";
  return classificacao === "C" ? "vermelho" : "verde";
}

// Adicionado: dimensiona o tempo estimado de uma etapa dentro de uma
// Ordem de Produção — "por lote" é um tempo fixo (não multiplica pela
// quantidade), "por peça" multiplica pela quantidade daquele produto no
// lote (uma OP pode reunir mais de um produto, cada um com sua própria
// quantidade).
function duracaoEtapaOP(passo, quantidade) {
  const tempo = passo?.tempoEstimadoSeg || 0;
  return passo?.tipoCalculo === "lote" ? tempo : tempo * quantidade;
}

// Adicionado: limites de jornada usados na liberação de produção —
// 9h/dia é a carga diária considerada saudável por colaborador (220h
// no mês, mesma base usada no cálculo de custo de mão de obra), 12h/dia
// é o teto absoluto, e entre os dois só um Gestor ou Administrador pode
// autorizar a programação.
const JORNADA_DIARIA_HORAS = 8;
const JORNADA_MAXIMA_HORAS = 12;
// Adicionado: base usada para converter salário mensal em valor-hora ao
// estimar custo de mão de obra (jornada padrão CLT) — reaproveitada nos
// relatórios de custo por período/OP e no custo estimado por peça do
// cadastro de produtos.
const HORAS_MES_PADRAO = 220;
const fmtMoeda = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Adicionado: jornada produtiva usada para projetar datas de entrega —
// cada 9h de trabalho acumulado (por departamento) equivale a mais um
// dia de calendário, em vez de tratar a produção como se rodasse 24h
// por dia sem parar.
const HORAS_PRODUTIVAS_DIA = 9;

// Adicionado: projeta a data/hora em que um total de segundos de
// trabalho fica pronto, considerando a jornada produtiva por dia a
// partir de uma data de início — cada bloco cheio de 9h empurra a
// previsão em mais um dia de calendário (mesmo horário), e o restante
// (menos de 9h) soma direto em cima disso.
function projetarDataUtil(segundosTrabalho, dataInicio) {
  const segPorDia = HORAS_PRODUTIVAS_DIA * 3600;
  const seg = Math.max(0, segundosTrabalho);
  const dias = Math.floor(seg / segPorDia);
  const restoSeg = seg % segPorDia;
  const data = new Date(dataInicio);
  data.setDate(data.getDate() + dias);
  return new Date(data.getTime() + restoSeg * 1000);
}

// Adicionado: estima quantas horas um registro (aberto ou concluído)
// ocupa do dia do colaborador — usa o tempo já apurado quando a etapa
// foi concluída, ou a meta dimensionada (por peça ou por lote) enquanto
// ainda está em aberto.
function duracaoRegistroSeg(r) {
  if (r.tempoEstimadoSeg != null) return r.tempoEstimadoSeg;
  if (r.tempoEstimadoBaseSeg != null) {
    return r.tipoCalculoEtapa === "lote" ? r.tempoEstimadoBaseSeg : r.tempoEstimadoBaseSeg * (r.quantidade || 1);
  }
  return r.tempoRealSeg || 0;
}

// Adicionado: monta o cronograma planejado da OP (início/fim previstos de
// cada etapa a partir da abertura, incluindo etapas de todos os produtos
// da OP), usado para exibir o dimensionamento total assim que a OP é
// criada. Cada departamento (setor) tem seu próprio cursor de tempo —
// Corte e Silk, por exemplo, não disputam a mesma linha do tempo, já que
// rodam com equipes diferentes em paralelo; só as etapas de um MESMO
// departamento se encadeiam uma depois da outra. Dentro de cada
// departamento, o tempo avança à razão de uma jornada produtiva de 9h
// por dia (não 24h corridas).
function cronogramaEstaticoOP(op) {
  const cursoresPorSetor = new Map();
  return (op.etapas || []).map(passo => {
    const duracaoSeg = passo.duracaoEstimadaSeg ?? duracaoEtapaOP(passo, passo.quantidade || 1);
    const chaveSetor = passo.setorId || passo.setorNomeSnap || "—";
    const inicioPlanejado = cursoresPorSetor.get(chaveSetor) || new Date(op.criadaEm);
    const fimPlanejado = projetarDataUtil(duracaoSeg, inicioPlanejado);
    cursoresPorSetor.set(chaveSetor, fimPlanejado);
    return { ...passo, duracaoEstimadaSeg: duracaoSeg, inicioPlanejado, fimPlanejado };
  });
}

// Adicionado: soma, por departamento (setor), o tempo estimado das
// etapas ainda não concluídas de uma OP — base para projetar o prazo
// considerando que cada departamento tem sua própria fila.
function segundosRestantesPorSetor(etapas) {
  const mapa = new Map();
  (etapas || []).filter(p => !p.concluida).forEach(p => {
    const chave = p.setorId || p.setorNomeSnap || "—";
    const atual = mapa.get(chave) || 0;
    mapa.set(chave, atual + (p.duracaoEstimadaSeg ?? duracaoEtapaOP(p, p.quantidade || 1)));
  });
  return mapa;
}

// Adicionado: classifica o andamento da OP frente à data de entrega —
// para OPs em aberto, projeta a conclusão por departamento (etapas
// ainda não concluídas daquele setor, a 9h produtivas por dia a partir
// de agora) e usa o departamento mais carregado (o gargalo) como
// previsão da OP inteira — departamentos diferentes rodam em paralelo,
// então a OP só termina quando o mais lento deles terminar; para OPs
// concluídas, compara a data real de conclusão com a data de entrega.
function avaliarPrazoOP(op) {
  if (!op.dataEntrega) return null;
  const entrega = new Date(op.dataEntrega + "T23:59:59");
  if (op.status === "concluida") {
    if (!op.concluidaEm) return null;
    const concluida = new Date(op.concluidaEm);
    return concluida <= entrega
      ? { label: "Entregue no prazo", color: "#1a7a4c", bg: "#e6f4ec" }
      : { label: "Entregue com atraso", color: "#b13232", bg: "#f8e6e6" };
  }
  const agora = new Date();
  let previsao = agora;
  segundosRestantesPorSetor(op.etapas).forEach(segundos => {
    const fimSetor = projetarDataUtil(segundos, agora);
    if (fimSetor > previsao) previsao = fimSetor;
  });
  return previsao <= entrega
    ? { label: "Dentro do prazo", color: "#1a7a4c", bg: "#e6f4ec", previsao }
    : { label: "Fora do prazo", color: "#b13232", bg: "#f8e6e6", previsao };
}

const FALTA_TIPOS = [
  { key: "horas", label: "Horas", unidade: "hora(s)", pesoPorUnidade: 1 },
  { key: "dias", label: "Dias (dispensa)", unidade: "dia(s)", pesoPorUnidade: 5 },
  { key: "falta_justificada", label: "Falta justificada (atestado)", unidade: "dia(s)", pesoPorUnidade: 4 },
  { key: "falta_injustificada", label: "Falta sem justificativa", unidade: "dia(s)", pesoPorUnidade: 10 },
];
const faltaInfo = (key) => FALTA_TIPOS.find(t => t.key === key) || FALTA_TIPOS[0];

const COMPORTAMENTO_OPCOES = [
  { key: "ruim", label: "Ruim", color: "#b13232", bg: "#f8e6e6" },
  { key: "regular", label: "Regular", color: "#b5820a", bg: "#faf1dc" },
  { key: "bom", label: "Bom", color: "#1d6fa5", bg: "#e7f1f8" },
  { key: "acima_media", label: "Acima da média", color: "#1a7a4c", bg: "#e6f4ec" },
];
const comportamentoInfo = (key) => COMPORTAMENTO_OPCOES.find(c => c.key === key) || null;

function fmtSec(totalSec) {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function nowLocalInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function toLocalInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getPeriodRange(preset, customStart, customEnd) {
  const now = new Date();
  let start, end;
  if (preset === "dia") {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    end = new Date(now); end.setHours(23, 59, 59, 999);
  } else if (preset === "semana") {
    start = startOfWeek(now);
    end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
  } else if (preset === "quinzena") {
    const day = now.getDate();
    if (day <= 15) {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 16, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
  } else if (preset === "mes") {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (preset === "bimestre") {
    const startMonth = Math.floor(now.getMonth() / 2) * 2;
    start = new Date(now.getFullYear(), startMonth, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), startMonth + 2, 0, 23, 59, 59);
  } else if (preset === "trimestre") {
    const startMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), startMonth, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59);
  } else if (preset === "ano") {
    start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else {
    start = customStart ? new Date(customStart + "T00:00:00") : new Date(0);
    end = customEnd ? new Date(customEnd + "T23:59:59") : new Date();
  }
  return { start, end };
}

// ---------- Dados iniciais ----------
const SEED_SETORES = [
  { key: "costura", nome: "Costura" },
  { key: "corte", nome: "Corte" },
  { key: "silk", nome: "Silk" },
  { key: "preparacao", nome: "Preparação" },
];


// ---------- Storage hooks ----------
// Corrigido: os cadastros (setores, etapas, produtos, vínculos, colaboradores,
// equipes) antes eram salvos como um único array dentro de uma única chave.
// Se duas pessoas editassem cadastros ao mesmo tempo em celulares
// diferentes, a última a salvar sobrescrevia por completo o trabalho da
// outra. Agora cada item vive em sua própria chave (mesmo padrão já usado
// para registros de produção), mas o hook continua expondo a mesma
// interface [itens, definirTodos, carregado] para não exigir mudanças nos
// componentes que já usavam useCollection. Também migra automaticamente
// dados salvos no formato antigo (uma chave só), preservando cadastros
// já feitos antes desta correção.
function useRecordCollectionArray(prefix, legacyKey) {
  const [items, setItemsState] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const listRes = await window.storage.list(prefix + ":", true);
        const keys = (listRes && listRes.keys) || [];
        let values = (await Promise.all(keys.map(async (k) => {
          try {
            const r = await window.storage.get(k, true);
            return r && r.value ? JSON.parse(r.value) : null;
          } catch (e) { return null; }
        }))).filter(Boolean);

        if (values.length === 0 && legacyKey) {
          try {
            const legado = await window.storage.get(legacyKey, true);
            if (legado && legado.value) {
              const antigos = JSON.parse(legado.value);
              if (Array.isArray(antigos) && antigos.length > 0) {
                await Promise.all(antigos.map(item => window.storage.set(`${prefix}:${item.id}`, JSON.stringify(item), true)));
                await window.storage.delete(legacyKey, true).catch(() => {});
                values = antigos;
              }
            }
          } catch (e) {
            // sem dado no formato antigo
          }
        }

        if (alive) setItemsState(values);
      } catch (e) {
        // prefixo ainda sem nenhum item
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [prefix, legacyKey]);

  async function setAll(next) {
    const nextIds = new Set(next.map(x => x.id));
    const toRemove = items.filter(x => !nextIds.has(x.id));
    const toSave = next.filter(x => {
      const antigo = items.find(p => p.id === x.id);
      return !antigo || JSON.stringify(antigo) !== JSON.stringify(x);
    });
    setItemsState(next);
    try {
      await Promise.all([
        ...toRemove.map(x => window.storage.delete(`${prefix}:${x.id}`, true)),
        ...toSave.map(x => window.storage.set(`${prefix}:${x.id}`, JSON.stringify(x), true)),
      ]);
    } catch (e) {
      console.error("Falha ao salvar", prefix, e);
    }
  }

  return [items, setAll, loaded];
}

// Coleção onde cada item vive em sua própria chave — evita que dois usuários
// gravando ao mesmo tempo sobrescrevam um ao outro (o que acontece quando a
// coleção inteira é salva como um único array em uma única chave).
function useRecordCollection(prefix) {
  const [items, setItemsState] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const listRes = await window.storage.list(prefix + ":", true);
        const keys = (listRes && listRes.keys) || [];
        const values = await Promise.all(keys.map(async (k) => {
          try {
            const r = await window.storage.get(k, true);
            return r && r.value ? JSON.parse(r.value) : null;
          } catch (e) { return null; }
        }));
        if (alive) setItemsState(values.filter(Boolean));
      } catch (e) {
        // prefixo ainda sem nenhum item
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, [prefix]);

  async function salvar(record) {
    setItemsState(prev => {
      const existe = prev.some(x => x.id === record.id);
      return existe ? prev.map(x => x.id === record.id ? record : x) : [record, ...prev];
    });
    try { await window.storage.set(`${prefix}:${record.id}`, JSON.stringify(record), true); } catch (e) { console.error("Falha ao salvar", prefix, e); }
  }
  async function salvarVarios(records) {
    setItemsState(prev => [...records, ...prev]);
    try { await Promise.all(records.map(r => window.storage.set(`${prefix}:${r.id}`, JSON.stringify(r), true))); } catch (e) { console.error("Falha ao salvar", prefix, e); }
  }
  async function remover(id) {
    setItemsState(prev => prev.filter(x => x.id !== id));
    try { await window.storage.delete(`${prefix}:${id}`, true); } catch (e) { console.error("Falha ao remover", prefix, e); }
  }

  return { items, loaded, salvar, salvarVarios, remover };
}

// ---------- UI atoms ----------
function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b5d49", marginBottom: 5, letterSpacing: 0.2 }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
  border: "1.5px solid #d9cfb7", fontSize: 15, background: "#fff", color: "#2a2015", outline: "none",
};
// Adicionado: botão-link discreto para ações secundárias de "abrir formulário
// inline" (ex.: cadastro rápido de material/fornecedor sem sair da tela).
const linkButtonStyle = {
  background: "none", border: "none", padding: "6px 0 0", margin: 0,
  fontSize: 12.5, fontWeight: 700, color: "#2f4a63", cursor: "pointer", textDecoration: "underline",
};
function Select({ value, onChange, children, ...rest }) {
  return <select value={value} onChange={onChange} style={{ ...inputStyle, appearance: "auto" }} {...rest}>{children}</select>;
}
// Adicionado: Badge e StatusDot ganharam a forma de uma etiqueta de roupa
// (die-cut tag) — borda pontilhada como uma costura e um pequeno "furo" de
// pingente — reaproveitada nos dois lugares onde a classificação aparece,
// para virar um elemento reconhecível da identidade visual do app.
function Badge({ cls }) {
  const info = CLASS_INFO[cls];
  if (!info) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
      padding: "2px 8px 2px 5px", borderRadius: "3px 9px 9px 3px", fontSize: 12, fontWeight: 700,
      color: info.color, background: info.bg, border: `1px dashed ${info.color}`, minWidth: 24, lineHeight: 1.5,
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: info.color, opacity: 0.5, display: "inline-block" }} />
      {info.label}
    </span>
  );
}
function StatusDot({ cor }) {
  const info = COR_INFO[cor];
  if (!info) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700,
      color: info.color, background: info.bg, padding: "2px 9px 2px 8px", borderRadius: "3px 9px 9px 3px",
      border: `1px dashed ${info.color}`, lineHeight: 1.6,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: info.dot, display: "inline-block" }} />
      {info.label}
    </span>
  );
}
function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#c7b89a" : "#2f4a63", color: "#fff", border: "none",
      borderRadius: 9, padding: "11px 16px", fontSize: 14.5, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex",
      alignItems: "center", gap: 6, justifyContent: "center", ...style,
    }}>{children}</button>
  );
}
function IconButton({ onClick, children, title, danger, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      border: "none", background: "transparent", cursor: disabled ? "not-allowed" : "pointer",
      color: disabled ? "#b8ab92" : (danger ? "#b13232" : "#6b5d49"), padding: 6, borderRadius: 6,
      display: "inline-flex", alignItems: "center", opacity: disabled ? 0.6 : 1,
    }}>{children}</button>
  );
}
function Card({ children, style }) {
  return <div style={{ background: "#fffdf9", border: "1px solid #e6ddc8", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(28,43,57,0.05)", ...style }}>{children}</div>;
}
function ToggleChip({ ativo, onClick, children, colorAtivo }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "7px 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
      border: "1.5px solid " + (ativo ? (colorAtivo || "#2f4a63") : "#d9cfb7"),
      background: ativo ? (colorAtivo || "#2f4a63") : "#fff",
      color: ativo ? "#fff" : "#6b5d49",
    }}>{children}</button>
  );
}

// ---------- App principal ----------
export default function App() {
  const [tab, setTab] = useState("producao");
  const [relatorioImpressao, setRelatorioImpressao] = useState(null);
  // Adicionado: relatório de itens em aberto por departamento (agrupado
  // por etapa, colaborador ou função), com ação de imprimir.
  const [relatorioAbertosImpressao, setRelatorioAbertosImpressao] = useState(null);
  // Adicionado: impressão em grade (tabela) reaproveitada em três telas —
  // a própria Ordem de Produção (todas as etapas), a lista de operações
  // em aberto e o histórico de produção.
  const [relatorioGradeImpressao, setRelatorioGradeImpressao] = useState(null);

  const [setores, setSetores, setoresLoaded] = useRecordCollectionArray("setor", "setores_v2");
  const [etapas, setEtapas, etapasLoaded] = useRecordCollectionArray("etapa", "etapas_v2");
  const [produtos, setProdutos, produtosLoaded] = useRecordCollectionArray("produto", "produtos_v2");
  // Adicionado: grupo de produto e tamanho são cadastros próprios do
  // produto — cada um com um código numérico sequencial atribuído na
  // ordem em que é criado (ex.: "AVENTAL" = grupo 001), usado para
  // montar o código do produto (grupo.tipo.tamanho).
  //
  // Corrigido: o produto busca o tecido direto na base de Materiais, e o
  // segmento "tipo" do código do produto é o próprio código de cadastro
  // do material escolhido (cada material tem o seu, sequencial, igual
  // grupo/tamanho). "Cor" e "Tipo de material" foram removidos.
  //
  // Corrigido: grupo de produto (categoria do produto, ex.: AVENTAL) e
  // grupo de materiais (categoria do material, ex.: TECIDO) eram o mesmo
  // cadastro compartilhado — agora são dois cadastros independentes,
  // cada um com sua própria sequência numérica.
  const [gruposProduto, setGruposProduto, gruposProdutoLoaded] = useRecordCollectionArray("grupo_produto", null);
  const [gruposMaterial, setGruposMaterial, gruposMaterialLoaded] = useRecordCollectionArray("grupo_material", null);
  const [tamanhos, setTamanhos, tamanhosLoaded] = useRecordCollectionArray("tamanho", null);
  const [vinculos, setVinculos, vinculosLoaded] = useRecordCollectionArray("vinculo", "vinculos_v2");
  const [colaboradores, setColaboradores, colabLoaded] = useRecordCollectionArray("colaborador", "colaboradores_v2");
  const [equipes, setEquipes, equipesLoaded] = useRecordCollectionArray("equipe", "equipes_v2");
  // Adicionado: cadastro simples de clientes, para amarrar a Ordem de
  // Produção a quem encomendou o lote.
  const [clientes, setClientes, clientesLoaded] = useRecordCollectionArray("cliente", null);
  // Adicionado: cadastro de materiais (com estoque) e ficha de consumo por
  // produto (quanto de cada material uma peça consome), para alimentar a
  // aba de Consumo e permitir baixa automática de estoque quando uma OP é
  // concluída.
  const [materiais, setMateriais, materiaisLoaded] = useRecordCollectionArray("material", null);
  const [consumosMaterial, setConsumosMaterial, consumosMaterialLoaded] = useRecordCollectionArray("consumo_material", null);
  const { items: movimentacoesMaterial, loaded: movimentacoesMaterialLoaded, salvarVarios: salvarMovimentacoesMaterial } = useRecordCollection("movimentacao_material");
  // Adicionado: livro de movimentações de estoque — entradas manuais (ex.:
  // conferência, doação) e entradas de compras aprovadas. Fica separado
  // de "movimentacao_material" (que registra só as baixas automáticas de
  // produção) para não misturar semânticas, mas as duas alimentam juntas
  // o relatório de controle de materiais.
  const { items: movimentacoesEstoque, loaded: movimentacoesEstoqueLoaded, salvar: salvarMovimentacaoEstoque } = useRecordCollection("movimentacao_estoque");
  // Adicionado: solicitação de compras (o que precisa comprar) e cotações
  // recebidas de fornecedores para cada solicitação (negociação) — ao
  // escolher a cotação vencedora, o pedido é fechado e o estoque do
  // material recebe entrada automática pelo valor negociado.
  const { items: solicitacoesCompra, loaded: solicitacoesCompraLoaded, salvar: salvarSolicitacaoCompra, remover: removerSolicitacaoCompra } = useRecordCollection("solicitacao_compra");
  const { items: cotacoesCompra, loaded: cotacoesCompraLoaded, salvar: salvarCotacaoCompra, remover: removerCotacaoCompra } = useRecordCollection("cotacao_compra");
  // Adicionado: cadastro de fornecedores (usado nas cotações de compra,
  // com histórico das últimas compras fechadas com cada um) e de
  // equipamentos/máquinas por departamento (usado ao iniciar uma etapa
  // de produção, para registrar em qual máquina o trabalho foi feito).
  const [fornecedores, setFornecedores, fornecedoresLoaded] = useRecordCollectionArray("fornecedor", null);
  const [equipamentos, setEquipamentos, equipamentosLoaded] = useRecordCollectionArray("equipamento", null);
  // Adicionado: feriados cadastrados pela fábrica — usados na liberação
  // de produção para impedir programar domingos e feriados, e para
  // exigir autorização de Gestor/Administrador aos sábados.
  const [feriados, setFeriados, feriadosLoaded] = useRecordCollectionArray("feriado", null);
  const { items: registros, loaded: registrosLoaded, salvar: salvarRegistro, remover: removerRegistro } = useRecordCollection("registro");
  const { items: avaliacoes, loaded: avaliacoesLoaded, salvar: salvarAvaliacao, remover: removerAvaliacao } = useRecordCollection("avaliacao");
  const { items: anexos, loaded: anexosLoaded, salvarVarios: salvarAnexos, remover: removerAnexo } = useRecordCollection("anexo");
  const { items: acessos, loaded: acessosLoaded, salvar: salvarAcesso } = useRecordCollection("acesso");
  // Adicionado: Ordens de Produção (OP) — controle sequencial de um lote
  // desde a primeira etapa (normalmente Corte) até a última do produto.
  const { items: ordensProducao, loaded: ordensLoaded, salvar: salvarOrdemProducao, remover: removerOrdemProducao } = useRecordCollection("ordem_producao");
  // Adicionado: fila de solicitações de arte para o(a) arte-finalista —
  // pedidos que precisam ser resolvidos antes da produção começar.
  const { items: solicitacoesArte, loaded: solicitacoesArteLoaded, salvar: salvarSolicitacaoArte, remover: removerSolicitacaoArte } = useRecordCollection("solicitacao_arte");
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  // Adicionado: alerta de mensagens novas do chat interno — contador no
  // ícone do Chat no menu inferior, e um aviso rápido na tela quando
  // chega mensagem nova e a pessoa não está na aba de Chat. A "última
  // leitura" fica salva no localStorage do aparelho (não por pessoa,
  // já que o login aqui é só escolher o nome, sem sessão própria).
  const [mensagensChat, setMensagensChat] = useState([]);
  const [avisoNovaMensagem, setAvisoNovaMensagem] = useState(null);
  const ultimaMensagemIdRef = useRef(null);
  const [ultimaLeituraChat, setUltimaLeituraChat] = useState(() => {
    try { return localStorage.getItem("chat_ultima_leitura"); } catch (e) { return null; }
  });

  useEffect(() => {
    let ativo = true;
    async function verificarMensagens() {
      try {
        const listaRes = await window.storage.list("mensagem:", true);
        const chaves = (listaRes && listaRes.keys) || [];
        const valores = (await Promise.all(chaves.map(async (k) => {
          try { const r = await window.storage.get(k, true); return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; }
        }))).filter(Boolean);
        valores.sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
        if (ativo) setMensagensChat(valores);
      } catch (e) {
        // sem mensagens ainda, ou falha momentânea — tenta de novo no próximo ciclo
      }
    }
    verificarMensagens();
    const intervalo = setInterval(verificarMensagens, 6000);
    return () => { ativo = false; clearInterval(intervalo); };
  }, []);

  // Mostra o aviso rápido só quando chega uma mensagem realmente nova
  // (diferente da última vista), de outra pessoa, e a tela de Chat não
  // está aberta no momento.
  useEffect(() => {
    if (mensagensChat.length === 0) return;
    const ultima = mensagensChat[mensagensChat.length - 1];
    if (ultimaMensagemIdRef.current === null) {
      ultimaMensagemIdRef.current = ultima.id;
      return;
    }
    if (ultima.id === ultimaMensagemIdRef.current) return;
    ultimaMensagemIdRef.current = ultima.id;
    if (tab !== "chat" && ultima.autorNome !== usuarioAtual?.nome) {
      setAvisoNovaMensagem(ultima);
      const t = setTimeout(() => setAvisoNovaMensagem(atual => (atual && atual.id === ultima.id ? null : atual)), 5000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagensChat]);

  // Abrir a aba de Chat marca tudo como lido.
  useEffect(() => {
    if (tab !== "chat") return;
    const agora = new Date().toISOString();
    try { localStorage.setItem("chat_ultima_leitura", agora); } catch (e) {}
    setUltimaLeituraChat(agora);
    setAvisoNovaMensagem(null);
  }, [tab]);

  const mensagensNaoLidas = mensagensChat.filter(m =>
    m.autorNome !== usuarioAtual?.nome && (!ultimaLeituraChat || new Date(m.criadoEm) > new Date(ultimaLeituraChat))
  ).length;

  const allLoaded = setoresLoaded && etapasLoaded && produtosLoaded && vinculosLoaded && colabLoaded
    && equipesLoaded && registrosLoaded && avaliacoesLoaded && anexosLoaded && acessosLoaded && ordensLoaded && clientesLoaded
    && materiaisLoaded && consumosMaterialLoaded && movimentacoesMaterialLoaded && solicitacoesCompraLoaded && cotacoesCompraLoaded
    && fornecedoresLoaded && equipamentosLoaded && movimentacoesEstoqueLoaded && feriadosLoaded && solicitacoesArteLoaded
    && gruposProdutoLoaded && gruposMaterialLoaded && tamanhosLoaded;
  const [seedChecked, setSeedChecked] = useState(false);

  // Adicionado: os três perfis de acesso definem quais abas o usuário
  // logado enxerga no menu inferior. Colaborador só acompanha a própria
  // produção (e agora também o chat interno); Gestor toca a operação do
  // dia a dia; Administrador tem acesso completo, incluindo compras,
  // cadastros e dados sensíveis (salário, senha e perfil dos
  // colaboradores). O chat interno fica liberado pros três perfis, já
  // que é um canal de conversa entre todo mundo que usa o sistema.
  const PERFIS_ACESSO = {
    administrador: { label: "Administrador", abas: ["producao", "arte", "avaliacao", "consumo", "relatorios", "cadastros", "chat"] },
    gestor: { label: "Gestor", abas: ["producao", "arte", "avaliacao", "consumo", "relatorios", "cadastros", "chat"] },
    colaborador: { label: "Colaborador", abas: ["producao", "chat"] },
  };
  const perfilAtual = PERFIS_ACESSO[usuarioAtual?.perfil] || PERFIS_ACESSO.colaborador;

  // Adicionado: dá baixa no estoque dos materiais consumidos por uma OP
  // assim que ela é concluída (todas as etapas de todos os produtos do
  // pedido). O consumo é calculado a partir da ficha de consumo de cada
  // produto (Cadastros → Produtos → Consumo de materiais) multiplicada
  // pela quantidade daquele produto na OP. Cada baixa gera um registro de
  // movimentação para consulta na aba Consumo.
  async function darBaixaMateriaisDaOP(op) {
    const itens = op.itens && op.itens.length ? op.itens : (op.produtoId ? [{ produtoId: op.produtoId, quantidade: op.quantidade }] : []);
    const ajustesPorMaterial = new Map(); // materialId -> quantidade a subtrair
    const movimentacoes = [];
    itens.forEach(item => {
      const consumosDoProduto = consumosMaterial.filter(c => c.produtoId === item.produtoId);
      consumosDoProduto.forEach(c => {
        const qtdConsumida = Math.round((c.quantidadePorPeca || 0) * item.quantidade * 1000) / 1000;
        if (qtdConsumida <= 0) return;
        ajustesPorMaterial.set(c.materialId, (ajustesPorMaterial.get(c.materialId) || 0) + qtdConsumida);
        movimentacoes.push({
          id: uid(), materialId: c.materialId, produtoId: item.produtoId, produtoNomeSnap: item.produtoNomeSnap,
          ordemProducaoId: op.id, ordemProducaoNumero: op.numero,
          quantidadeProduzida: item.quantidade, quantidadeConsumida: qtdConsumida,
          criadoEm: new Date().toISOString(),
        });
      });
    });
    if (ajustesPorMaterial.size === 0) return;
    const materiaisAtualizados = materiais.map(m => ajustesPorMaterial.has(m.id)
      ? { ...m, quantidadeEstoque: Math.round((m.quantidadeEstoque - ajustesPorMaterial.get(m.id)) * 1000) / 1000 }
      : m);
    // Preenche o nome do material (snapshot) nas movimentações antes de salvar.
    const movimentacoesComSnap = movimentacoes.map(mv => ({
      ...mv,
      materialNomeSnap: materiaisAtualizados.find(m => m.id === mv.materialId)?.nome || "—",
      materialUnidadeSnap: materiaisAtualizados.find(m => m.id === mv.materialId)?.unidade || "",
      // Preço unitário no momento da baixa — guardado no snapshot para o
      // relatório de custos não mudar retroativamente se o preço do
      // material for reajustado depois.
      precoUnitarioSnap: materiaisAtualizados.find(m => m.id === mv.materialId)?.preco ?? null,
      saldoResultante: materiaisAtualizados.find(m => m.id === mv.materialId)?.quantidadeEstoque ?? null,
    }));
    await setMateriais(materiaisAtualizados);
    await salvarMovimentacoesMaterial(movimentacoesComSnap);
  }

  // Corrigido/reorganizado: departamentos (Corte, Silk, Preparação etc.)
  // agora podem ser iniciados em qualquer ordem pelo gestor — não é mais
  // obrigatório concluir um para "liberar" o próximo. Uma etapa "por
  // peça" pode agora ser dividida em mais de um registro (outro
  // colaborador ou outro dia assume o restante da quantidade) — por
  // isso a etapa não fica vinculada a um único registro; ela é marcada
  // "concluída" quando a SOMA das peças boas dos registros concluídos
  // vinculados a ela atinge a quantidade total da etapa.
  async function salvarRegistroComOrdem(registro) {
    await salvarRegistro(registro);
    if (registro.ordemProducaoId && registro.ordemEtapaIndex != null) {
      const op = ordensProducao.find(o => o.id === registro.ordemProducaoId);
      if (op) {
        // Mescla o registro recém-salvo com os já existentes, já que o
        // estado "registros" do React pode ainda não refletir esta
        // gravação no mesmo instante.
        const registrosAtualizados = registros.some(r => r.id === registro.id)
          ? registros.map(r => r.id === registro.id ? registro : r)
          : [...registros, registro];
        const etapasAtualizadas = op.etapas.map((e, i) => {
          if (i !== registro.ordemEtapaIndex) return e;
          const ligados = registrosAtualizados.filter(r => r.ordemProducaoId === op.id && r.ordemEtapaIndex === i && r.status === "concluido");
          const quantidadeConcluida = ligados.reduce((s, r) => s + (r.quantidadeBoa ?? r.quantidade ?? 0), 0);
          return { ...e, concluida: quantidadeConcluida >= e.quantidade };
        });
        const todasConcluidas = etapasAtualizadas.every(e => e.concluida);
        const opAtualizada = {
          ...op,
          etapas: etapasAtualizadas,
          status: todasConcluidas ? "concluida" : "aberta",
          concluidaEm: todasConcluidas ? new Date().toISOString() : (op.concluidaEm || null),
        };
        await salvarOrdemProducao(opAtualizada);
        if (todasConcluidas && op.status !== "concluida") {
          await darBaixaMateriaisDaOP(opAtualizada);
        }
      }
    }
  }

  // Adicionado: como a etapa não depende mais de um único registro
  // vinculado, cancelar um registro em aberto não precisa mais tocar na
  // OP — a quantidade em aberto dele simplesmente deixa de contar na
  // soma assim que ele é removido, liberando aquele saldo para ser
  // reprogramado.
  async function removerRegistroComOrdem(id) {
    await removerRegistro(id);
  }

  // Adicionado: ao excluir uma Ordem de Produção, os registros de
  // lançamento vinculados a ela (as atividades já iniciadas/concluídas
  // em cada departamento) ficariam órfãos apontando para uma OP que não
  // existe mais — em vez disso, excluir a OP também excluir todos esses
  // registros junto. Essa exclusão é restrita a administrador (gating
  // feito na tela, em OrdensProducao.cancelarOP).
  async function removerOrdemComRegistros(id) {
    const registrosDaOP = registros.filter(r => r.ordemProducaoId === id);
    await Promise.all(registrosDaOP.map(r => removerRegistro(r.id)));
    await removerOrdemProducao(id);
  }

  useEffect(() => {
    if (!allLoaded || seedChecked) return;
    setSeedChecked(true);
    if (setores.length === 0) {
      // Corrigido: o app deixou de ser uma prévia/demonstração e passou a
      // ser usado de verdade — por isso a semente não cria mais produto,
      // etapas, vínculos, colaborador nem histórico de produção fictícios
      // (isso só confundia quem está configurando os dados reais da
      // fábrica). Só os departamentos (Corte, Silk, Costura, Preparação)
      // continuam sendo criados, por serem um ponto de partida útil de
      // verdade — o resto (produtos, materiais, colaboradores) fica por
      // conta do cadastro de cada confecção.
      const TIPO_POR_SETOR_KEY = { costura: "padrao", corte: "corte", silk: "silk", preparacao: "padrao" };
      const novosSetores = SEED_SETORES.map(s => ({ id: uid(), nome: s.nome, tipo: TIPO_POR_SETOR_KEY[s.key] || "padrao", _key: s.key }));
      setSetores(novosSetores.map(({ _key, ...s }) => s));
    }
    // Adicionado: garante um colaborador Administrador por padrão sempre
    // que não existir nenhum — independente do restante dos dados, tanto
    // num banco totalmente vazio quanto num banco que já tinha outros
    // dados cadastrados (ex.: publicado e usado antes desse recurso
    // existir). Sem isso não haveria como acessar Cadastros, Compras nem
    // os relatórios restritos depois de publicado.
    if (!colaboradores.some(c => c.perfil === "administrador")) {
      setColaboradores([...colaboradores, { id: uid(), nome: "Renato Monteiro", funcao: "Administrador", perfil: "administrador" }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLoaded]);

  if (!allLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4efe2" }}>
        <Loader2 size={26} style={{ animation: "spin 1s linear infinite", color: "#2f4a63" }} />
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (relatorioImpressao) {
    return <RelatorioImpressao payload={relatorioImpressao} onFechar={() => { setRelatorioImpressao(null); setTab("producao"); }} />;
  }

  if (relatorioAbertosImpressao) {
    return <RelatorioAbertosImpressao payload={relatorioAbertosImpressao} onFechar={() => { setRelatorioAbertosImpressao(null); setTab("relatorios"); }} />;
  }

  if (relatorioGradeImpressao) {
    return <RelatorioGradeImpressao payload={relatorioGradeImpressao} onFechar={() => { setRelatorioGradeImpressao(null); setTab("producao"); }} />;
  }

  if (!usuarioAtual) {
    return (
      <LoginGate
        colaboradores={colaboradores}
        onEntrar={async (colaboradorId, nome, perfil) => {
          const entrada = { id: uid(), colaboradorId: colaboradorId || null, nome, dataHora: new Date().toISOString() };
          await salvarAcesso(entrada);
          setUsuarioAtual({ colaboradorId, nome, perfil: perfil || "colaborador" });
          const abasPermitidas = (PERFIS_ACESSO[perfil] || PERFIS_ACESSO.colaborador).abas;
          if (!abasPermitidas.includes(tab)) setTab(abasPermitidas[0]);
        }}
      />
    );
  }

  const ehAdministrador = perfilAtual === PERFIS_ACESSO.administrador;

  return (
    <div className="textura-tecido" style={{ minHeight: "100vh", background: "#f4efe2", fontFamily: FONT_BODY, paddingBottom: 78 }}>
      <IdentidadeVisualGlobal />
      <header className="costura-base" style={{ background: "linear-gradient(160deg, #1c2b39 0%, #2f4a63 100%)", color: "#fff", padding: "18px 18px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: "rgba(205,185,138,0.16)",
            border: "1px dashed rgba(205,185,138,0.55)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}>
            <Scissors size={17} color="#cdb98a" />
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.8, color: "#cdb98a", textTransform: "uppercase" }}>Chão de fábrica</div>
            <div style={{ fontSize: 21, fontWeight: 700, marginTop: 2, fontFamily: FONT_DISPLAY }}>Controle de Produção</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#cdb98a" }}>{usuarioAtual.nome}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>{perfilAtual.label}</div>
          <button onClick={() => setUsuarioAtual(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: 0, marginTop: 2 }}>trocar usuário</button>
        </div>
      </header>

      {avisoNovaMensagem && (
        <div
          onClick={() => { setTab("chat"); setAvisoNovaMensagem(null); }}
          style={{
            position: "fixed", top: 10, left: 12, right: 12, zIndex: 20, maxWidth: 616, margin: "0 auto",
            background: "#1c2b39", color: "#fff", borderRadius: 10, padding: "10px 14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
            border: "1px dashed #cdb98a",
          }}
        >
          <MessageCircle size={17} color="#cdb98a" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#cdb98a" }}>Nova mensagem de {avisoNovaMensagem.autorNome}</div>
            <div style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {avisoNovaMensagem.texto || ((avisoNovaMensagem.anexos || []).length > 0 ? "📎 anexo" : "")}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setAvisoNovaMensagem(null); }} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", padding: 4, flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>
      )}

      <main style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
        {tab === "producao" && perfilAtual.abas.includes("producao") && (
          <Producao
            setores={setores} produtos={produtos} etapas={etapas} vinculos={vinculos}
            colaboradores={colaboradores} equipes={equipes} equipamentos={equipamentos}
            registros={registros} onSalvarRegistro={salvarRegistroComOrdem} onRemoverRegistro={removerRegistroComOrdem}
            ordensProducao={ordensProducao} onSalvarOrdem={salvarOrdemProducao} onRemoverOrdem={removerOrdemComRegistros}
            clientes={clientes} onImprimirGrade={setRelatorioGradeImpressao} feriados={feriados}
            podeAutorizarCargaExtra={usuarioAtual.perfil === "administrador" || usuarioAtual.perfil === "gestor"}
            consumosMaterial={consumosMaterial} materiais={materiais} ehAdministrador={ehAdministrador}
          />
        )}
        {tab === "arte" && perfilAtual.abas.includes("arte") && (
          <Criacao
            solicitacoes={solicitacoesArte} onSalvarSolicitacao={salvarSolicitacaoArte} onRemoverSolicitacao={removerSolicitacaoArte}
            produtos={produtos} setProdutos={setProdutos}
            clientes={clientes} setClientes={setClientes}
            onImprimirGrade={setRelatorioGradeImpressao}
          />
        )}
        {tab === "avaliacao" && perfilAtual.abas.includes("avaliacao") && (
          <Avaliacao colaboradores={colaboradores} avaliacoes={avaliacoes} onSalvarAvaliacao={salvarAvaliacao} onRemoverAvaliacao={removerAvaliacao} />
        )}
        {tab === "consumo" && perfilAtual.abas.includes("consumo") && (
          <ConsumoProdutos
            materiais={materiais} setMateriais={setMateriais} produtos={produtos} consumosMaterial={consumosMaterial}
            movimentacoesMaterial={movimentacoesMaterial}
            movimentacoesEstoque={movimentacoesEstoque} onSalvarMovimentacaoEstoque={salvarMovimentacaoEstoque}
            solicitacoesCompra={solicitacoesCompra} onSalvarSolicitacaoCompra={salvarSolicitacaoCompra} onRemoverSolicitacaoCompra={removerSolicitacaoCompra}
            cotacoesCompra={cotacoesCompra} onSalvarCotacaoCompra={salvarCotacaoCompra} onRemoverCotacaoCompra={removerCotacaoCompra}
            fornecedores={fornecedores} setFornecedores={setFornecedores} ehAdministrador={ehAdministrador}
          />
        )}
        {tab === "relatorios" && perfilAtual.abas.includes("relatorios") && (
          <Relatorios
            registros={registros} produtos={produtos} etapas={etapas} colaboradores={colaboradores} setores={setores}
            avaliacoes={avaliacoes} onGerarRelatorio={setRelatorioImpressao} onGerarRelatorioAbertos={setRelatorioAbertosImpressao}
            movimentacoesMaterial={movimentacoesMaterial} movimentacoesEstoque={movimentacoesEstoque}
            materiais={materiais} solicitacoesCompra={solicitacoesCompra} cotacoesCompra={cotacoesCompra}
            ehAdministrador={ehAdministrador} ordensProducao={ordensProducao} consumosMaterial={consumosMaterial}
            onImprimirGrade={setRelatorioGradeImpressao}
          />
        )}
        {tab === "cadastros" && perfilAtual.abas.includes("cadastros") && (
          <Cadastros
            produtos={produtos} setProdutos={setProdutos}
            etapas={etapas} setEtapas={setEtapas}
            vinculos={vinculos} setVinculos={setVinculos}
            colaboradores={colaboradores} setColaboradores={setColaboradores}
            setores={setores} setSetores={setSetores}
            equipes={equipes} setEquipes={setEquipes}
            anexos={anexos} onSalvarAnexos={salvarAnexos} onRemoverAnexo={removerAnexo}
            acessos={acessos}
            clientes={clientes} setClientes={setClientes}
            materiais={materiais} setMateriais={setMateriais}
            consumosMaterial={consumosMaterial} setConsumosMaterial={setConsumosMaterial}
            fornecedores={fornecedores} setFornecedores={setFornecedores}
            equipamentos={equipamentos} setEquipamentos={setEquipamentos}
            solicitacoesCompra={solicitacoesCompra} cotacoesCompra={cotacoesCompra}
            feriados={feriados} setFeriados={setFeriados}
            gruposProduto={gruposProduto} setGruposProduto={setGruposProduto}
            gruposMaterial={gruposMaterial} setGruposMaterial={setGruposMaterial}
            tamanhos={tamanhos} setTamanhos={setTamanhos}
            ehAdministrador={ehAdministrador}
          />
        )}
        {tab === "chat" && perfilAtual.abas.includes("chat") && (
          <ChatInterno usuarioAtual={usuarioAtual} ehAdministrador={ehAdministrador} colaboradores={colaboradores} />
        )}
      </main>

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, background: "#fffdf7",
        borderTop: "1px dashed #cdb98a", display: "flex", padding: "6px 8px calc(env(safe-area-inset-bottom,0px) + 6px)",
        boxShadow: "0 -2px 10px rgba(28,43,57,0.06)",
      }}>
        {[
          { key: "producao", label: "Produção", icon: Clock },
          { key: "arte", label: "Criação", icon: Palette },
          { key: "avaliacao", label: "Avaliação", icon: Users },
          { key: "consumo", label: "Materiais", icon: Package },
          { key: "chat", label: "Chat", icon: MessageCircle, badge: mensagensNaoLidas },
          { key: "relatorios", label: "Relatórios", icon: BarChart3 },
          { key: "cadastros", label: "Cadastros", icon: ClipboardList },
        ].filter(({ key }) => perfilAtual.abas.includes(key)).map(({ key, label, icon: Icon, badge }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, background: "transparent", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "6px 4px", color: tab === key ? "#2f4a63" : "#a3937a",
          }}>
            <span style={{
              position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 26, borderRadius: 7,
              background: tab === key ? "#f4ecd8" : "transparent",
              border: tab === key ? "1px dashed #cdb98a" : "1px solid transparent",
            }}>
              <Icon size={19} strokeWidth={tab === key ? 2.4 : 2} />
              {badge > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 999,
                  background: "#b13232", color: "#fff", fontSize: 9.5, fontWeight: 800, lineHeight: "15px", textAlign: "center",
                  border: "1.5px solid #fffdf7",
                }}>{badge > 9 ? "9+" : badge}</span>
              )}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: tab === key ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---------- Produção (iniciar, acompanhar em aberto, concluir) ----------
// ---------- Portão de identificação (log de acesso) ----------
function LoginGate({ colaboradores, onEntrar }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [nomeLivre, setNomeLivre] = useState("");
  // Corrigido: antes desse controle de perfil existir, qualquer pessoa que
  // digitasse o nome via "acesso" no login e via tudo no app. Deixar
  // "Colaborador" como padrão aqui quebrava esse fluxo silenciosamente
  // (a pessoa digitava o nome, apertava Entrar, e via só a aba Produção
  // sem entender por quê). Agora o padrão é Administrador — continua
  // funcionando como antes — e a restrição só se aplica quando alguém
  // escolhe deliberadamente "Colaborador" aqui, ou quando entra por um
  // cadastro de colaborador que tenha esse perfil definido.
  const [perfilLivre, setPerfilLivre] = useState("administrador");
  const [senhaDigitada, setSenhaDigitada] = useState("");
  const [erroSenha, setErroSenha] = useState(false);
  // Adicionado: opção de fixar um atalho do sistema na área de trabalho
  // (ou tela inicial, no celular) direto pela tela de login, antes de
  // escolher usuário/senha. Quando o navegador suporta a instalação
  // automática (Chrome/Edge/Android), um clique já resolve; nos demais
  // (Safari/iOS, Firefox), mostramos o passo a passo manual.
  const [podeInstalar, setPodeInstalar] = useState(!!window.__deferredInstallPrompt);
  const [jaInstalado] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const [mostrarInstrucoesAtalho, setMostrarInstrucoesAtalho] = useState(false);
  useEffect(() => {
    function atualizar() { setPodeInstalar(!!window.__deferredInstallPrompt); }
    window.addEventListener("pwa-install-available", atualizar);
    return () => window.removeEventListener("pwa-install-available", atualizar);
  }, []);
  async function fixarAtalho() {
    const evento = window.__deferredInstallPrompt;
    if (!evento) { setMostrarInstrucoesAtalho(v => !v); return; }
    evento.prompt();
    await evento.userChoice;
    window.__deferredInstallPrompt = null;
    setPodeInstalar(false);
  }
  // Adicionado: no celular o atalho vai para a "tela inicial", não para
  // uma "área de trabalho" — o rótulo e o ícone do botão se adaptam ao
  // aparelho pra fazer sentido em cada um.
  const noCelular = /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const instrucoesAtalho = (() => {
    const ua = navigator.userAgent || "";
    if (/iphone|ipad|ipod/i.test(ua)) return "No Safari, toque no ícone de compartilhar (□↑) e depois em \"Adicionar à Tela de Início\".";
    if (/android/i.test(ua)) return "Toque no menu (⋮) do navegador e depois em \"Adicionar à tela inicial\" ou \"Instalar app\".";
    return "Clique no ícone de instalação (⊕) na barra de endereço do navegador, ou abra o menu (⋮) → \"Instalar Controle de Produção\".";
  })();
  const usandoNomeLivre = !colaboradorId;
  const colaboradorSelecionado = colaboradorId ? colaboradores.find(x => x.id === colaboradorId) : null;
  const precisaSenha = !!(colaboradorSelecionado && colaboradorSelecionado.senha);

  function entrar() {
    if (colaboradorId) {
      if (precisaSenha && senhaDigitada !== colaboradorSelecionado.senha) {
        setErroSenha(true);
        return;
      }
      // Corrigido: colaboradores cadastrados antes de existir o campo
      // "perfil" não têm esse valor salvo — cair para "colaborador" aqui
      // os trancaria de repente fora de tudo que viam antes. O padrão
      // seguro é manter acesso completo até um administrador definir um
      // perfil específico para esse colaborador em Cadastros.
      onEntrar(colaboradorId, colaboradorSelecionado.nome, colaboradorSelecionado.perfil || "administrador");
    } else if (nomeLivre.trim()) {
      onEntrar(null, nomeLivre.trim(), perfilLivre);
    }
  }
  const podeEntrar = (colaboradorId && (!precisaSenha || senhaDigitada.length > 0)) || nomeLivre.trim().length > 0;

  return (
    <div className="textura-tecido" style={{ minHeight: "100vh", background: "linear-gradient(160deg, #1c2b39 0%, #2f4a63 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT_BODY }}>
      <IdentidadeVisualGlobal />
      <div style={{ background: "#fffdf7", borderRadius: 14, padding: 24, width: "100%", maxWidth: 360, border: "1px dashed #cdb98a", boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: "#f4ecd8", border: "1px dashed #cdb98a",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          <Scissors size={19} color="#2f4a63" />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>Controle de Produção</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: "#1c2b39", marginTop: 2, marginBottom: 16, fontFamily: FONT_DISPLAY }}>Quem está usando o sistema agora?</div>

        {!jaInstalado && (
          <div style={{ marginBottom: 16 }}>
            <button type="button" onClick={fixarAtalho} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              background: "#f4ecd8", border: "1px dashed #cdb98a", borderRadius: 9, padding: "9px 12px",
              fontSize: 12.5, fontWeight: 700, color: "#6b5d49", cursor: "pointer",
            }}>
              {noCelular ? <Smartphone size={14} /> : <Pin size={14} />} {noCelular ? "Fixar atalho na tela inicial" : "Fixar atalho na área de trabalho"}
            </button>
            {mostrarInstrucoesAtalho && !podeInstalar && (
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 6, lineHeight: 1.4 }}>{instrucoesAtalho}</div>
            )}
          </div>
        )}

        {colaboradores.length > 0 && (
          <Field label="Sou um colaborador cadastrado">
            <Select value={colaboradorId} onChange={e => { setColaboradorId(e.target.value); if (e.target.value) setNomeLivre(""); setSenhaDigitada(""); setErroSenha(false); }}>
              <option value="">Selecione…</option>
              {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </Field>
        )}

        {precisaSenha && (
          <Field label="Senha">
            <input type="password" value={senhaDigitada} onChange={e => { setSenhaDigitada(e.target.value); setErroSenha(false); }} placeholder="Digite sua senha" style={inputStyle} onKeyDown={e => e.key === "Enter" && entrar()} />
            {erroSenha && <div style={{ fontSize: 12, color: "#b13232", marginTop: 5 }}>Senha incorreta.</div>}
          </Field>
        )}

        {usandoNomeLivre && (
          <Field label={colaboradores.length > 0 ? "Ou digite seu nome" : "Seu nome"}>
            <input value={nomeLivre} onChange={e => setNomeLivre(e.target.value)} placeholder="Digite seu nome" style={inputStyle} />
          </Field>
        )}
        {usandoNomeLivre && nomeLivre.trim() && (
          <Field label="Perfil de acesso">
            <Select value={perfilLivre} onChange={e => setPerfilLivre(e.target.value)}>
              <option value="colaborador">Colaborador</option>
              <option value="gestor">Gestor</option>
              <option value="administrador">Administrador</option>
            </Select>
            <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Colaborador só vê a aba Produção. Gestor e Administrador veem tudo.</div>
          </Field>
        )}

        <PrimaryButton onClick={entrar} disabled={!podeEntrar} style={{ width: "100%" }}>Entrar</PrimaryButton>
      </div>
    </div>
  );
}


// ---------- Produção (iniciar, acompanhar em aberto, concluir) ----------
function Producao({ setores, produtos, etapas, vinculos, colaboradores, equipes, equipamentos, registros, onSalvarRegistro, onRemoverRegistro, ordensProducao, onSalvarOrdem, onRemoverOrdem, clientes, onImprimirGrade, podeAutorizarCargaExtra, feriados, consumosMaterial, materiais, ehAdministrador }) {
  const [sub, setSub] = useState("ordens");
  const abertos = registros.filter(r => r.status === "aberto");
  const concluidos = registros.filter(r => r.status === "concluido");

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "ordens", label: "Ordens" },
          { key: "aberto", label: `Em aberto${abertos.length ? ` (${abertos.length})` : ""}` },
          { key: "historico", label: "Histórico" },
        ].map(s => (
          <button key={s.key} onClick={() => setSub(s.key)} style={{
            flex: "1 1 30%", border: "1.5px solid " + (sub === s.key ? "#2f4a63" : "#d9cfb7"),
            background: sub === s.key ? "#2f4a63" : "#fff",
            color: sub === s.key ? "#fff" : "#6b5d49",
            borderRadius: 9, padding: "9px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>

      {sub === "aberto" && (
        <EmAberto
          abertos={abertos} produtos={produtos} etapas={etapas} setores={setores} colaboradores={colaboradores}
          onSalvarRegistro={onSalvarRegistro} onRemoverRegistro={onRemoverRegistro} onImprimirGrade={onImprimirGrade}
          consumosMaterial={consumosMaterial} materiais={materiais}
          ordensProducao={ordensProducao} onSalvarOrdem={onSalvarOrdem}
        />
      )}
      {sub === "historico" && (
        <HistoricoConcluidos concluidos={concluidos} produtos={produtos} etapas={etapas} setores={setores} colaboradores={colaboradores} onImprimirGrade={onImprimirGrade} ordensProducao={ordensProducao} />
      )}
      {sub === "ordens" && (
        <OrdensProducao
          ordensProducao={ordensProducao} produtos={produtos} etapas={etapas} setores={setores} vinculos={vinculos}
          colaboradores={colaboradores} equipes={equipes} equipamentos={equipamentos} registros={registros} onSalvarOrdem={onSalvarOrdem} onRemoverOrdem={onRemoverOrdem}
          onSalvarRegistro={onSalvarRegistro} onImprimirGrade={onImprimirGrade} podeAutorizarCargaExtra={podeAutorizarCargaExtra} feriados={feriados}
          clientes={clientes} consumosMaterial={consumosMaterial} materiais={materiais} ehAdministrador={ehAdministrador}
        />
      )}
    </div>
  );
}

// ---------- Em aberto (lista de processos abertos + concluir) ----------
function EmAberto({ abertos, produtos, etapas, setores, colaboradores, onSalvarRegistro, onRemoverRegistro, onImprimirGrade, consumosMaterial, materiais, ordensProducao, onSalvarOrdem }) {
  // Adicionado: monta a lista de materiais necessários de um item em
  // aberto — mesma conta usada na Ordem de Produção (consumo por peça ×
  // quantidade do item), pra quem está executando ver aqui na tela de
  // trabalho o que precisa separar, sem ter que voltar na OP.
  function materiaisDoRegistro(r) {
    return (consumosMaterial || [])
      .filter(c => c.produtoId === r.produtoId)
      .map(c => {
        const material = (materiais || []).find(m => m.id === c.materialId);
        return {
          id: c.id, nome: material?.nome || "—", unidade: material?.unidade || "",
          quantidade: Math.round((c.quantidadePorPeca || 0) * (r.quantidade || 0) * 1000) / 1000,
          estoque: material?.quantidadeEstoque ?? null,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }
  // A marcação de "separado" continua guardada na etapa da OP — assim o
  // que for marcado aqui aparece igual na Ordem de Produção e vice-versa.
  function separadosDoRegistro(r) {
    const op = (ordensProducao || []).find(o => o.id === r.ordemProducaoId);
    const etapa = op && r.ordemEtapaIndex != null ? op.etapas[r.ordemEtapaIndex] : null;
    return etapa?.materiaisSeparados || [];
  }
  async function alternarSeparado(r, consumoId) {
    const op = (ordensProducao || []).find(o => o.id === r.ordemProducaoId);
    if (!op || r.ordemEtapaIndex == null) return;
    const etapasAtualizadas = op.etapas.map((e, i) => {
      if (i !== r.ordemEtapaIndex) return e;
      const atuais = e.materiaisSeparados || [];
      return { ...e, materiaisSeparados: atuais.includes(consumoId) ? atuais.filter(id => id !== consumoId) : [...atuais, consumoId] };
    });
    await onSalvarOrdem({ ...op, etapas: etapasAtualizadas });
  }

  const [concluindoId, setConcluindoId] = useState(null);
  // Adicionado: comentários por item em aberto — quem está executando
  // pode registrar uma ocorrência (ex.: "tecido veio com falha no rolo 3")
  // e anexar foto/arquivo como evidência. Fica gravado no próprio
  // registro, então aparece pra qualquer pessoa que abrir esse item.
  const [comentandoId, setComentandoId] = useState(null);
  const [textoComentario, setTextoComentario] = useState("");
  const [anexosComentario, setAnexosComentario] = useState([]);
  const anexoComentarioRef = useRef(null);

  async function lerArquivos(fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) { alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`); continue; }
      const dataUrl = await new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    return novos;
  }
  async function anexarNoComentario(fileList) {
    const novos = await lerArquivos(fileList);
    if (novos.length) setAnexosComentario(a => [...a, ...novos]);
  }
  function abrirComentario(id) {
    setComentandoId(comentandoId === id ? null : id);
    setTextoComentario(""); setAnexosComentario([]);
  }
  async function salvarComentario(r) {
    if (!textoComentario.trim() && anexosComentario.length === 0) return;
    const comentario = {
      id: uid(), texto: textoComentario.trim(), anexos: anexosComentario,
      autor: (r.colaboradorIds || []).map(nomeColab).join(", ") || "—",
      criadoEm: new Date().toISOString(),
    };
    await onSalvarRegistro({ ...r, comentarios: [...(r.comentarios || []), comentario] });
    setComentandoId(null); setTextoComentario(""); setAnexosComentario([]);
  }
  async function removerComentario(r, comentarioId) {
    if (!window.confirm("Excluir este comentário?")) return;
    await onSalvarRegistro({ ...r, comentarios: (r.comentarios || []).filter(c => c.id !== comentarioId) });
  }

  const [filtroSetorId, setFiltroSetorId] = useState("");
  const [filtroEtapaId, setFiltroEtapaId] = useState("");
  const [filtroColaboradorId, setFiltroColaboradorId] = useState("");
  // Corrigido: usa a "foto" do nome guardada no registro (snapshot) como
  // reserva quando o item de cadastro foi renomeado ou excluído depois.
  const nomeProduto = (r) => produtos.find(p => p.id === r.produtoId)?.nome || r.produtoNomeSnap || "—";
  const nomeEtapa = (r) => etapas.find(e => e.id === r.etapaId)?.nome || r.etapaNomeSnap || "—";
  const nomeSetor = (r) => setores.find(s => s.id === r.setorId)?.nome || r.setorNomeSnap || "—";
  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";

  // Adicionado: filtros por setor, colaborador e etapa na lista de
  // processos em aberto, montados a partir do que realmente está em
  // aberto no momento (evita listar setores/etapas sem nenhum item aqui).
  const opcoesSetor = useMemo(() => {
    const map = new Map();
    abertos.forEach(r => { if (r.setorId && !map.has(r.setorId)) map.set(r.setorId, nomeSetor(r)); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [abertos, setores]);
  const opcoesEtapa = useMemo(() => {
    const map = new Map();
    abertos.forEach(r => { if (r.etapaId && !map.has(r.etapaId)) map.set(r.etapaId, nomeEtapa(r)); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [abertos, etapas]);
  const opcoesColaborador = useMemo(() => {
    const map = new Map();
    abertos.forEach(r => (r.colaboradorIds || []).forEach(id => { if (!map.has(id)) map.set(id, nomeColab(id)); }));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [abertos, colaboradores]);

  const filtrados = ordenarRegistrosRelatorio(
    abertos.filter(r =>
      (!filtroSetorId || r.setorId === filtroSetorId)
      && (!filtroEtapaId || r.etapaId === filtroEtapaId)
      && (!filtroColaboradorId || (r.colaboradorIds || []).includes(filtroColaboradorId))
    ),
    { hora: r => r.inicio, etapa: nomeEtapa, operador: r => (r.colaboradorIds || []).map(nomeColab).join(", ") }
  );
  const temFiltroAtivo = filtroSetorId || filtroEtapaId || filtroColaboradorId;
  function limparFiltros() { setFiltroSetorId(""); setFiltroEtapaId(""); setFiltroColaboradorId(""); }

  // Adicionado: agrupa os processos em aberto pela Ordem de Produção a
  // que pertencem, com uma chave para minimizar/maximizar cada OP — útil
  // quando uma ordem tem vários departamentos abertos ao mesmo tempo,
  // pra recolher o que já foi conferido e focar só no que falta olhar.
  const [opsColapsadas, setOpsColapsadas] = useState(() => new Set());
  function alternarColapsoOP(id) {
    setOpsColapsadas(atual => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }
  const gruposPorOP = useMemo(() => {
    const mapa = new Map();
    const semOP = [];
    filtrados.forEach(r => {
      if (!r.ordemProducaoId) { semOP.push(r); return; }
      if (!mapa.has(r.ordemProducaoId)) {
        const op = (ordensProducao || []).find(o => o.id === r.ordemProducaoId);
        mapa.set(r.ordemProducaoId, {
          ordemProducaoId: r.ordemProducaoId, numero: r.ordemProducaoNumero,
          clienteNomeSnap: op?.clienteNomeSnap || null, itens: [],
        });
      }
      mapa.get(r.ordemProducaoId).itens.push(r);
    });
    // filtrados já vem ordenado decrescente por hora — o primeiro item de
    // cada grupo é o mais recente dela, então ordenar os grupos por esse
    // item mantém a mesma convenção (mais recente primeiro).
    const grupos = Array.from(mapa.values()).sort((a, b) => new Date(b.itens[0].inicio) - new Date(a.itens[0].inicio));
    return { grupos, semOP };
  }, [filtrados, ordensProducao]);

  async function cancelar(id) {
    if (!window.confirm("Cancelar este processo em aberto? Essa ação não pode ser desfeita.")) return;
    await onRemoverRegistro(id);
  }

  // Adicionado: monta a grade (tabela) para impressão dos itens em
  // aberto, respeitando os filtros aplicados na tela.
  function imprimirGrade() {
    onImprimirGrade({
      titulo: "Operações em aberto",
      subtitulo: temFiltroAtivo ? "Com filtro aplicado" : "Todos os departamentos",
      geradoEm: new Date().toLocaleString("pt-BR"),
      colunas: [
        { key: "op", label: "OP" }, { key: "produto", label: "Produto" }, { key: "etapa", label: "Etapa" },
        { key: "setor", label: "Departamento" }, { key: "colaboradores", label: "Colaborador(es)" },
        { key: "quantidade", label: "Qtd.", align: "right" }, { key: "meta", label: "Meta/h", align: "right" },
        { key: "inicio", label: "Início", align: "right" },
      ],
      linhas: filtrados.map(r => ({
        op: r.ordemProducaoNumero != null ? `#${String(r.ordemProducaoNumero).padStart(3, "0")}` : "—",
        produto: nomeProduto(r), etapa: nomeEtapa(r), setor: nomeSetor(r),
        colaboradores: (r.colaboradorIds || []).map(nomeColab).join(", "),
        quantidade: r.quantidade,
        meta: (r.tipoCalculoEtapa !== "lote" && r.tempoEstimadoBaseSeg) ? `${Math.max(1, Math.floor(3600 / r.tempoEstimadoBaseSeg))}/h` : "—",
        inicio: new Date(r.inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      })),
    });
  }

  // Adicionado: renderiza o card de um processo em aberto — extraído para
  // função nomeada (em vez de inline no .map) porque agora é chamado
  // tanto dentro de cada grupo por OP quanto para os itens sem OP.
  function renderCardRegistro(r) {
    const projecao = r.projecaoFimISO ? new Date(r.projecaoFimISO) : null;
    const atrasado = projecao && new Date() > projecao;
    const metaHora = r.tipoCalculoEtapa !== "lote" && r.tempoEstimadoBaseSeg ? Math.max(1, Math.floor(3600 / r.tempoEstimadoBaseSeg)) : null;
    return (
      <Card key={r.id} style={{ padding: 14, borderLeft: "4px solid #e0a72a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <div>
            {r.ordemProducaoNumero != null && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#2f4a63", background: "#f4ecd8", padding: "2px 7px", borderRadius: 999, marginBottom: 4 }}>
                <ListOrdered size={10} /> OP #{String(r.ordemProducaoNumero).padStart(3, "0")}
              </div>
            )}
            <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{nomeProduto(r)} · {nomeSetor(r)}</div>
            <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{nomeEtapa(r)} · {r.colaboradorIds.map(nomeColab).join(", ")}</div>
            <div style={{ fontSize: 12, color: "#a3937a", marginTop: 3 }}>{r.quantidade} peças planejadas · início {new Date(r.inicio).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{r.equipamentoNomeSnap ? ` · ${r.equipamentoNomeSnap}` : ""}{metaHora ? ` · meta: ${metaHora} peças/h` : ""}</div>
          </div>
          <StatusDot cor="laranja" />
        </div>
        {projecao && (
          <div style={{ fontSize: 12.5, color: atrasado ? "#b13232" : "#6b5d49", marginBottom: 10 }}>
            Previsão de conclusão: <b>{projecao.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>{atrasado ? " — já passou do previsto" : ""}
          </div>
        )}
        {(() => {
          const mats = materiaisDoRegistro(r);
          if (mats.length === 0) return null;
          const separados = separadosDoRegistro(r);
          const podeMarcar = !!r.ordemProducaoId && r.ordemEtapaIndex != null;
          const totalSeparados = mats.filter(m => separados.includes(m.id)).length;
          const tudoSeparado = totalSeparados === mats.length;
          return (
            <div style={{ marginBottom: 10, paddingTop: 8, borderTop: "1px dashed #d9cfb7" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49" }}>Materiais para {r.quantidade} peças</span>
                {podeMarcar && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "2px 8px 2px 7px", borderRadius: "3px 8px 8px 3px",
                    color: tudoSeparado ? "#1a7a4c" : "#8a6510", background: tudoSeparado ? "#e6f4ec" : "#fdf3e0",
                    border: `1px dashed ${tudoSeparado ? "#1a7a4c" : "#b5820a"}`,
                  }}>{tudoSeparado ? "✓ tudo separado" : `${totalSeparados}/${mats.length} separados`}</span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {mats.map(m => {
                  const marcado = separados.includes(m.id);
                  const faltaEstoque = m.estoque != null && m.estoque < m.quantidade;
                  return (
                    <label key={m.id} style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: podeMarcar ? "pointer" : "default",
                      background: marcado ? "#e6f4ec" : faltaEstoque ? "#f8e6e6" : "#fff",
                      border: `1px solid ${marcado ? "#bfe3cf" : faltaEstoque ? "#e8c4c4" : "#e6ddc8"}`,
                      borderRadius: 7, padding: "6px 9px",
                    }}>
                      {podeMarcar && (
                        <input type="checkbox" checked={marcado} onChange={() => alternarSeparado(r, m.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                      )}
                      <span style={{ flex: 1, fontSize: 12, color: "#2a2015", textDecoration: marcado ? "line-through" : "none", opacity: marcado ? 0.65 : 1 }}>
                        {m.nome}
                        {faltaEstoque && !marcado && <span style={{ fontSize: 10.5, color: "#b13232", marginLeft: 6 }}>falta {Math.round((m.quantidade - m.estoque) * 1000) / 1000} {m.unidade}</span>}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: marcado ? "#1a7a4c" : "#2a2015" }}>{m.quantidade} {m.unidade}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })()}
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryButton onClick={() => setConcluindoId(concluindoId === r.id ? null : r.id)} style={{ flex: 1 }}>
            <Check size={16} /> Concluir
          </PrimaryButton>
          <button onClick={() => abrirComentario(r.id)} title="Comentar / anexar" style={{
            border: "1.5px solid #d9cfb7", background: comentandoId === r.id ? "#f4ecd8" : "#fff", borderRadius: 9,
            padding: "0 12px", color: "#2f4a63", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}>
            <MessageCircle size={15} />{(r.comentarios || []).length > 0 ? ` ${(r.comentarios || []).length}` : ""}
          </button>
          <IconButton onClick={() => cancelar(r.id)} danger title="Cancelar processo"><Trash2 size={16} /></IconButton>
        </div>

        {(r.comentarios || []).length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {(r.comentarios || []).map(c => (
              <div key={c.id} style={{ background: "#faf6ec", border: "1px solid #e6ddc8", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    {c.texto && <div style={{ fontSize: 12.5, color: "#2a2015", whiteSpace: "pre-wrap" }}>{c.texto}</div>}
                    <div style={{ fontSize: 10.5, color: "#a3937a", marginTop: 2 }}>
                      {c.autor} · {new Date(c.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <IconButton onClick={() => removerComentario(r, c.id)} danger title="Excluir comentário"><X size={13} /></IconButton>
                </div>
                {(c.anexos || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {c.anexos.map(a => (
                      a.tipo && a.tipo.startsWith("image/")
                        ? <img key={a.id} src={a.dataUrl} alt={a.nome} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 6, border: "1px solid #e6ddc8" }} />
                        : <a key={a.id} href={a.dataUrl} download={a.nome} style={{ fontSize: 11, color: "#2f4a63", border: "1px solid #e6ddc8", borderRadius: 6, padding: "4px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Paperclip size={11} /> {a.nome}</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {comentandoId === r.id && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
            <Field label="Comentário / ocorrência">
              <textarea value={textoComentario} onChange={e => setTextoComentario(e.target.value)} rows={2}
                placeholder="Ex.: tecido do rolo 3 veio com falha, avisar o corte"
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            {anexosComentario.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {anexosComentario.map(a => (
                  <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 6, overflow: "hidden" }}>
                    {a.tipo && a.tipo.startsWith("image/")
                      ? <img src={a.dataUrl} alt={a.nome} style={{ width: 54, height: 54, objectFit: "cover", display: "block" }} />
                      : <div style={{ width: 54, height: 54, display: "flex", alignItems: "center", justifyContent: "center", color: "#a3937a" }}><Paperclip size={16} /></div>}
                    <button onClick={() => setAnexosComentario(x => x.filter(y => y.id !== a.id))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 999, width: 17, height: 17, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
            <input ref={anexoComentarioRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }}
              onChange={e => { anexarNoComentario(e.target.files); e.target.value = ""; }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => anexoComentarioRef.current && anexoComentarioRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 8, padding: "8px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar</button>
              <PrimaryButton onClick={() => salvarComentario(r)} disabled={!textoComentario.trim() && anexosComentario.length === 0} style={{ flex: 1 }}>Salvar comentário</PrimaryButton>
            </div>
          </div>
        )}
        {concluindoId === r.id && (
          <ConcluirForm registro={r} onSalvarRegistro={onSalvarRegistro} onFechar={() => setConcluindoId(null)} colaboradores={colaboradores} />
        )}
      </Card>
    );
  }

  // Corrigido: os filtros de departamento/etapa/colaborador ficavam
  // escondidos quando não havia nenhum processo em aberto, porque a tela
  // retornava só a mensagem "Nenhum processo em aberto" antes de chegar
  // no card de filtros. Agora o card de filtros sempre aparece nesta
  // tela; a mensagem de vazio aparece só no lugar da lista.
  return (
    <div>
      <Card style={{ marginBottom: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1c2b39" }}>Filtrar</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {temFiltroAtivo && (
              <button onClick={limparFiltros} style={{ background: "transparent", border: "none", color: "#2f4a63", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>Limpar</button>
            )}
            <button onClick={imprimirGrade} disabled={filtrados.length === 0} style={{
              background: "transparent", border: "1px dashed " + (filtrados.length === 0 ? "#d9cfb7" : "#2f4a63"),
              color: filtrados.length === 0 ? "#a3937a" : "#2f4a63", fontSize: 11.5, fontWeight: 700,
              cursor: filtrados.length === 0 ? "not-allowed" : "pointer", padding: "4px 9px", borderRadius: "3px 9px 9px 3px",
            }}>Imprimir</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Departamento</span>
            <Select value={filtroSetorId} onChange={e => setFiltroSetorId(e.target.value)}>
              <option value="">Todos os departamentos</option>
              {opcoesSetor.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Select>
          </div>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Etapa</span>
            <Select value={filtroEtapaId} onChange={e => setFiltroEtapaId(e.target.value)}>
              <option value="">Todas as etapas</option>
              {opcoesEtapa.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Select>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Colaborador</span>
          <Select value={filtroColaboradorId} onChange={e => setFiltroColaboradorId(e.target.value)}>
            <option value="">Todos os colaboradores</option>
            {opcoesColaborador.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </Select>
        </div>
      </Card>

      {filtrados.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>
          {abertos.length === 0 ? "Nenhum processo em aberto no momento." : "Nenhum processo em aberto corresponde a esse filtro."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {gruposPorOP.grupos.map(g => {
            const colapsado = opsColapsadas.has(g.ordemProducaoId);
            return (
              <div key={g.ordemProducaoId}>
                <button onClick={() => alternarColapsoOP(g.ordemProducaoId)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  background: "#f4ecd8", border: "1px solid #e6ddc8", borderRadius: 9, padding: "8px 12px",
                  cursor: "pointer", marginBottom: colapsado ? 0 : 8,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#1c2b39" }}>
                    {colapsado ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    OP #{String(g.numero).padStart(3, "0")} · {g.clienteNomeSnap || "Sem cliente"}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49" }}>
                    {g.itens.length} em aberto
                  </span>
                </button>
                {!colapsado && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {g.itens.map(renderCardRegistro)}
                  </div>
                )}
              </div>
            );
          })}
          {gruposPorOP.semOP.length > 0 && (
            <div>
              {gruposPorOP.grupos.length > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#a3937a", margin: "0 2px 8px" }}>Sem ordem de produção vinculada</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gruposPorOP.semOP.map(renderCardRegistro)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConcluirForm({ registro, onSalvarRegistro, onFechar, colaboradores }) {
  const [fim, setFim] = useState(nowLocalInput());
  const [quantidadeReal, setQuantidadeReal] = useState(String(registro.quantidade));
  const [temDefeito, setTemDefeito] = useState(null);
  const [qtdDefeito, setQtdDefeito] = useState("");
  const [fotosDefeito, setFotosDefeito] = useState([]);
  const [temRetrabalho, setTemRetrabalho] = useState(null);
  const [tempoRetrabalhoMin, setTempoRetrabalhoMin] = useState("");
  // Adicionado: confirma (ou ajusta) quem de fato executou a atividade
  // na hora de concluir — por padrão já vem marcado quem foi escalado ao
  // iniciar, mas dá pra corrigir se quem terminou foi outra pessoa.
  const [colaboradorIdsExecucao, setColaboradorIdsExecucao] = useState(registro.colaboradorIds || []);
  const fotoInputRef = useRef(null);

  function toggleColaboradorExecucao(id) {
    setColaboradorIdsExecucao(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  const qtdNum = parseInt(quantidadeReal || "0", 10);
  const qtdDefeitoNum = Math.min(parseInt(qtdDefeito || "0", 10), qtdNum);
  const qtdBoaNum = Math.max(qtdNum - (temDefeito ? qtdDefeitoNum : 0), 0);
  const tempoRetrabalhoSeg = temRetrabalho ? Math.max(parseFloat(tempoRetrabalhoMin || "0"), 0) * 60 : 0;
  const tempoRetrabalhoPenalizadoSeg = tempoRetrabalhoSeg * 1.05;

  const podeSalvar = fim && qtdNum > 0 && new Date(fim) > new Date(registro.inicio)
    && colaboradorIdsExecucao.length > 0
    && temDefeito !== null && (!temDefeito || qtdDefeitoNum >= 0)
    && temRetrabalho !== null && (!temRetrabalho || tempoRetrabalhoSeg > 0);

  // Adicionado: ao marcar que houve peças com defeito, é possível anexar
  // fotos do defeito direto pelo celular (câmera ou galeria), guardadas
  // junto com o registro para consulta depois no histórico/relatório.
  async function anexarFotosDefeito(fileList) {
    const arquivos = Array.from(fileList || []);
    const novas = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) {
        alert(`"${file.name}" é maior que 4,5MB e não pode ser anexada.`);
        continue;
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novas.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    if (novas.length) setFotosDefeito(fotos => [...fotos, ...novas]);
  }
  function removerFotoDefeito(id) { setFotosDefeito(fotos => fotos.filter(f => f.id !== id)); }

  async function concluir() {
    if (!podeSalvar) return;
    const tempoRealSeg = (new Date(fim) - new Date(registro.inicio)) / 1000;
    const tempoRealConsideradoSeg = tempoRealSeg + tempoRetrabalhoPenalizadoSeg;
    // Corrigido: se a etapa não tinha tempo estimado cadastrado (vínculo
    // ausente), antes o app inventava uma meta igual ao tempo real e
    // sempre classificava como "A" (100%), escondendo o problema. Agora,
    // sem meta cadastrada, o registro fica sem eficiência/classificação
    // e é sinalizado como "sem meta" nos relatórios e no histórico.
    // Também respeita etapas "por lote" (tempo fixo, ex.: risco/enfesto no
    // Corte) em vez de sempre multiplicar o tempo estimado pela quantidade.
    const temMeta = registro.tempoEstimadoBaseSeg != null;
    const ehPorLote = registro.tipoCalculoEtapa === "lote";
    const tempoEstimadoSeg = temMeta
      ? (ehPorLote ? registro.tempoEstimadoBaseSeg : registro.tempoEstimadoBaseSeg * qtdBoaNum)
      : null;
    const eficiencia = temMeta && tempoRealConsideradoSeg > 0
      ? Math.min(100, Math.round((tempoEstimadoSeg / tempoRealConsideradoSeg) * 1000) / 10)
      : null;
    const classificacao = eficiencia != null ? classify(eficiencia) : null;
    const atualizado = {
      ...registro, status: "concluido", fim,
      colaboradorIds: colaboradorIdsExecucao,
      quantidade: qtdNum, quantidadeDefeito: temDefeito ? qtdDefeitoNum : 0, quantidadeBoa: qtdBoaNum,
      fotosDefeito: temDefeito ? fotosDefeito : [],
      tempoRetrabalhoMin: temRetrabalho ? Math.max(parseFloat(tempoRetrabalhoMin || "0"), 0) : 0,
      tempoRealSeg, tempoRealConsideradoSeg, tempoEstimadoSeg, eficiencia, classificacao,
      semMeta: !temMeta,
      cor: classificacao ? corDoRegistro("concluido", classificacao) : "laranja",
      concluidoEm: new Date().toISOString(),
    };
    await onSalvarRegistro(atualizado);
    onFechar();
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #efe8d8" }}>
      {registro.tempoEstimadoBaseSeg == null && (
        <div style={{ fontSize: 12.5, color: "#8a6510", background: "#fdf3e0", border: "1px solid #f2ddab", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
          Esta etapa não tem tempo estimado cadastrado — a conclusão será salva sem cálculo de eficiência (sem nota A/B/C).
        </div>
      )}
      <Field label="Colaborador(es) que executou(aram)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {colaboradores.map(c => (
            <ToggleChip key={c.id} ativo={colaboradorIdsExecucao.includes(c.id)} onClick={() => toggleColaboradorExecucao(c.id)}>{c.nome}</ToggleChip>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#a3937a", marginTop: 5 }}>Já vem marcado quem foi escalado ao iniciar — ajuste se quem concluiu foi outra pessoa.</div>
      </Field>
      <Field label="Horário de fim">
        <input type="datetime-local" value={fim} onChange={e => setFim(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="Quantidade produzida (real)">
        <input type="number" min="1" step="1" value={quantidadeReal} onChange={e => setQuantidadeReal(e.target.value)} style={inputStyle} />
      </Field>

      {qtdNum > 0 && (
        <Field label="Teve peças com defeito?">
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleChip ativo={temDefeito === false} onClick={() => { setTemDefeito(false); setQtdDefeito(""); }}>Não</ToggleChip>
            <ToggleChip ativo={temDefeito === true} colorAtivo="#b13232" onClick={() => setTemDefeito(true)}>Sim</ToggleChip>
          </div>
        </Field>
      )}
      {temDefeito === true && (
        <Field label="Quantidade com defeito">
          <input type="number" min="0" max={qtdNum} step="1" value={qtdDefeito} onChange={e => setQtdDefeito(e.target.value)} style={inputStyle} />
        </Field>
      )}
      {temDefeito === true && (
        <Field label="Foto do defeito (opcional)">
          {fotosDefeito.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
              {fotosDefeito.map(f => (
                <div key={f.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <img src={f.dataUrl} alt={f.nome} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
                  <button onClick={() => removerFotoDefeito(f.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fotoInputRef} type="file" multiple accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={e => { anexarFotosDefeito(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fotoInputRef.current && fotoInputRef.current.click()} style={{
            fontSize: 12.5, border: "1px solid #d9cfb7", background: "#fff", borderRadius: 7, padding: "7px 11px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#6b5d49",
          }}><Paperclip size={14} /> Anexar foto do defeito</button>
        </Field>
      )}
      {temDefeito !== null && qtdNum > 0 && (
        <div style={{ fontSize: 12.5, color: "#6b5d49", marginTop: -8, marginBottom: 14 }}>Peças boas: <b>{qtdBoaNum}</b> de {qtdNum}</div>
      )}

      {qtdNum > 0 && (
        <Field label="Houve retrabalho?">
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleChip ativo={temRetrabalho === false} onClick={() => { setTemRetrabalho(false); setTempoRetrabalhoMin(""); }}>Não</ToggleChip>
            <ToggleChip ativo={temRetrabalho === true} colorAtivo="#b13232" onClick={() => setTemRetrabalho(true)}>Sim</ToggleChip>
          </div>
        </Field>
      )}
      {temRetrabalho === true && (
        <Field label="Tempo de retrabalho (minutos)">
          <input type="number" min="0" step="1" value={tempoRetrabalhoMin} onChange={e => setTempoRetrabalhoMin(e.target.value)} style={inputStyle} />
          {tempoRetrabalhoSeg > 0 && <div style={{ fontSize: 12, color: "#b13232", marginTop: 5 }}>Desperdício considerado: {fmtSec(tempoRetrabalhoPenalizadoSeg)} (+5%)</div>}
        </Field>
      )}

      <PrimaryButton onClick={concluir} disabled={!podeSalvar} style={{ width: "100%" }}>Confirmar conclusão</PrimaryButton>
    </div>
  );
}

// ---------- Histórico de concluídos ----------
function HistoricoConcluidos({ concluidos, produtos, etapas, setores, colaboradores, onImprimirGrade, ordensProducao }) {
  const nomeProduto = (r) => produtos.find(p => p.id === r.produtoId)?.nome || r.produtoNomeSnap || "—";
  const nomeEtapa = (r) => etapas.find(e => e.id === r.etapaId)?.nome || r.etapaNomeSnap || "—";
  const nomeSetor = (r) => setores.find(s => s.id === r.setorId)?.nome || r.setorNomeSnap || "—";
  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";
  // Adicionado: cliente não vem direto no registro — vem da Ordem de
  // Produção a que ele pertence.
  const clienteDoRegistro = (r) => (ordensProducao || []).find(o => o.id === r.ordemProducaoId)?.clienteNomeSnap || null;
  const ordenados = [...concluidos].sort((a, b) => new Date(b.fim) - new Date(a.fim));

  // Adicionado: pesquisa do histórico por cliente, por número da Ordem
  // de Produção e por período (data de conclusão) — útil pra achar
  // rápido a produção de um pedido/cliente específico sem rolar a lista
  // inteira.
  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaOP, setBuscaOP] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const temFiltroAtivo = buscaCliente || buscaOP || dataInicio || dataFim;
  function limparFiltros() { setBuscaCliente(""); setBuscaOP(""); setDataInicio(""); setDataFim(""); }

  const filtrados = ordenados.filter(r => {
    if (buscaCliente && !(clienteDoRegistro(r) || "sem cliente").toLowerCase().includes(buscaCliente.trim().toLowerCase())) return false;
    if (buscaOP) {
      const termo = buscaOP.trim().toLowerCase().replace(/^#/, "");
      const numeroTxt = r.ordemProducaoNumero != null ? String(r.ordemProducaoNumero) : "";
      if (!numeroTxt.includes(termo)) return false;
    }
    if (dataInicio && new Date(r.fim) < new Date(dataInicio + "T00:00:00")) return false;
    if (dataFim && new Date(r.fim) > new Date(dataFim + "T23:59:59")) return false;
    return true;
  });

  // Adicionado: monta a grade (tabela) para impressão do histórico de
  // produção concluída filtrado na tela (não só os 40 mais recentes
  // mostrados abaixo).
  function imprimirGrade() {
    onImprimirGrade({
      titulo: "Histórico de produção",
      subtitulo: `${filtrados.length} ${filtrados.length !== 1 ? "produções concluídas" : "produção concluída"}${temFiltroAtivo ? " · com filtro aplicado" : ""}`,
      geradoEm: new Date().toLocaleString("pt-BR"),
      colunas: [
        { key: "op", label: "OP" }, { key: "cliente", label: "Cliente" }, { key: "produto", label: "Produto" }, { key: "etapa", label: "Etapa" },
        { key: "setor", label: "Departamento" }, { key: "colaboradores", label: "Colaborador(es)" },
        { key: "quantidade", label: "Qtd.", align: "right" }, { key: "eficiencia", label: "%", align: "right" },
        { key: "fim", label: "Concluído em", align: "right" },
      ],
      linhas: filtrados.map(r => ({
        op: r.ordemProducaoNumero != null ? `#${String(r.ordemProducaoNumero).padStart(3, "0")}` : "—",
        cliente: clienteDoRegistro(r) || "—",
        produto: nomeProduto(r), etapa: nomeEtapa(r), setor: nomeSetor(r),
        colaboradores: (r.colaboradorIds || []).map(nomeColab).join(", "),
        quantidade: r.quantidade, eficiencia: r.eficiencia != null ? `${Math.min(100, r.eficiencia)}%` : "—",
        fim: new Date(r.fim).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      })),
    });
  }

  if (ordenados.length === 0) {
    return <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma produção concluída ainda.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1c2b39" }}>Pesquisar</div>
          {temFiltroAtivo && (
            <button onClick={limparFiltros} style={{ background: "transparent", border: "none", color: "#2f4a63", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>Limpar</button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Cliente</span>
            <input value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} placeholder="Nome do cliente…" style={inputStyle} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Ordem de Produção</span>
            <input value={buscaOP} onChange={e => setBuscaOP(e.target.value)} placeholder="Nº da OP…" style={inputStyle} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>Período — de</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#6b5d49", marginBottom: 4 }}>até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={imprimirGrade} disabled={filtrados.length === 0} style={{
          background: "transparent", border: "1px dashed " + (filtrados.length === 0 ? "#d9cfb7" : "#2f4a63"),
          color: filtrados.length === 0 ? "#a3937a" : "#2f4a63", fontSize: 11.5, fontWeight: 700,
          cursor: filtrados.length === 0 ? "not-allowed" : "pointer", padding: "4px 9px", borderRadius: "3px 9px 9px 3px",
        }}>Imprimir</button>
      </div>
      {filtrados.length === 0 && (
        <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma produção concluída encontrada para essa pesquisa.</div>
      )}
      {filtrados.slice(0, 40).map(r => {
        const cor = r.cor || (r.classificacao ? corDoRegistro(r.status, r.classificacao) : "laranja");
        return (
          <Card key={r.id} style={{ padding: 12, borderLeft: `4px solid ${COR_INFO[cor].dot}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                {r.ordemProducaoNumero != null && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#2f4a63", background: "#f4ecd8", padding: "2px 7px", borderRadius: 999, marginBottom: 4 }}>
                    <ListOrdered size={10} /> OP #{String(r.ordemProducaoNumero).padStart(3, "0")}
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{nomeProduto(r)} · {nomeSetor(r)}</div>
                <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{nomeEtapa(r)} · {r.colaboradorIds.map(nomeColab).join(", ")}</div>
                <div style={{ fontSize: 12, color: "#a3937a", marginTop: 3 }}>
                  {r.quantidade} peças{r.quantidadeDefeito ? ` (${r.quantidadeDefeito} c/ defeito)` : ""}{r.tempoRetrabalhoMin ? ` · ${r.tempoRetrabalhoMin}min retrabalho` : ""} · {fmtSec(r.tempoRealSeg)} real{r.eficiencia != null ? ` · ${Math.min(100, r.eficiencia)}% da meta` : " · sem meta cadastrada"}{r.equipamentoNomeSnap ? ` · ${r.equipamentoNomeSnap}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {r.classificacao ? <Badge cls={r.classificacao} /> : <span style={{ fontSize: 11, fontWeight: 700, color: "#a3937a" }}>—</span>}
                <StatusDot cor={cor} />
              </div>
            </div>
            {r.fotosDefeito && r.fotosDefeito.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {r.fotosDefeito.map(f => (
                  <img key={f.id} src={f.dataUrl} alt={f.nome} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid #e6ddc8" }} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ---------- Ordens de Produção (controle sequencial do lote) ----------
// Adicionado: formulário compacto para o gestor definir apenas "quem" e
// "quando" de um departamento da OP — o quê (etapa), quanto (quantidade)
// e a meta de tempo já vêm dimensionados da própria Ordem de Produção.
function IniciarEtapaOPForm({ passo, setorObj, quantidadeAlvo, colaboradores, equipes, equipamentos, registros, podeAutorizarCargaExtra, feriados, onIniciar, onCancelar }) {
  const [modoEquipe, setModoEquipe] = useState(false);
  const [colaboradorIds, setColaboradorIds] = useState([]);
  const [equipeSalvaId, setEquipeSalvaId] = useState("");
  const [inicio, setInicio] = useState(nowLocalInput());
  const [equipamentoId, setEquipamentoId] = useState("");
  const [tipoTecido, setTipoTecido] = useState("");
  const [consumo, setConsumo] = useState("");
  const [fotolitoOk, setFotolitoOk] = useState(null);
  const [tamanhoArte, setTamanhoArte] = useState("");
  const [coresPantone, setCoresPantone] = useState([""]);
  const [autorizacaoConfirmada, setAutorizacaoConfirmada] = useState(false);
  // Adicionado: quantidade que será programada AGORA — pode ser menor
  // que o saldo da etapa (quantidadeAlvo); o restante fica em aberto
  // pra programar depois, com outro colaborador ou outro dia.
  const [quantidadeProgramar, setQuantidadeProgramar] = useState(String(quantidadeAlvo || 0));

  const tipoSetor = setorObj?.tipo || (
    (setorObj?.nome || "").trim().toLowerCase() === "corte" ? "corte" :
    (setorObj?.nome || "").trim().toLowerCase() === "silk" ? "silk" : "padrao"
  );
  const isCorte = tipoSetor === "corte";
  const isSilk = tipoSetor === "silk";
  const ehLote = passo.tipoCalculo === "lote";
  const tempoPorUnidadeSeg = passo.tempoEstimadoSeg || 0;
  const equipesDoSetor = useMemo(() => equipes.filter(eq => !eq.setorId || eq.setorId === passo.setorId), [equipes, passo.setorId]);
  // Adicionado: só oferece equipamentos ativos do mesmo departamento da
  // etapa (ou sem departamento definido), já que uma máquina de Corte não
  // faz sentido aparecer para uma etapa de Costura.
  const equipamentosDoSetor = useMemo(
    () => (equipamentos || []).filter(eq => (!eq.setorId || eq.setorId === passo.setorId) && eq.status !== "inativo"),
    [equipamentos, passo.setorId]
  );

  // Adicionado: só dias úteis (segunda a sexta) — domingo e feriado
  // cadastrado ficam totalmente bloqueados, sem exceção; sábado é
  // permitido mas sempre exige autorização de Gestor/Administrador,
  // mesmo dentro de 8h.
  const dataEscolhidaStr = inicio ? inicio.slice(0, 10) : "";
  const diaSemana = dataEscolhidaStr ? new Date(dataEscolhidaStr + "T12:00:00").getDay() : null;
  const ehDomingo = diaSemana === 0;
  const ehSabado = diaSemana === 6;
  const feriadoDoDia = dataEscolhidaStr ? (feriados || []).find(f => f.data === dataEscolhidaStr) : null;
  const diaBloqueadoTotal = ehDomingo || !!feriadoDoDia;

  // Adicionado: quantas horas cada colaborador já tem programadas nesse
  // dia (de qualquer OP), para calcular quantas peças ainda cabem no dia
  // dele sem passar de 8h (sem autorização) ou de 12h (teto absoluto).
  const horasExistentesPorColaborador = useMemo(() => {
    const map = {};
    if (!dataEscolhidaStr) return map;
    colaboradores.forEach(c => {
      map[c.id] = (registros || [])
        .filter(r => r.status !== "cancelado" && (r.colaboradorIds || []).includes(c.id) && r.inicio && r.inicio.slice(0, 10) === dataEscolhidaStr)
        .reduce((s, r) => s + duracaoRegistroSeg(r), 0) / 3600;
    });
    return map;
  }, [colaboradores, dataEscolhidaStr, registros]);

  // Adicionado: bloqueia o mesmo colaborador de iniciar duas produções
  // (a mesma etapa ou outra qualquer) na mesma data e horário — as
  // etapas dele são encadeadas: a próxima só pode começar depois que a
  // anterior termina (previsão de término, se ainda em aberto, ou
  // término real, se já concluída).
  const horarioLivrePorColaborador = useMemo(() => {
    const map = {};
    if (!dataEscolhidaStr) return map;
    colaboradores.forEach(c => {
      const doDia = (registros || []).filter(r => r.status !== "cancelado" && (r.colaboradorIds || []).includes(c.id) && r.inicio && r.inicio.slice(0, 10) === dataEscolhidaStr);
      if (doDia.length === 0) { map[c.id] = null; return; }
      const finsMs = doDia.map(r => {
        if (r.status === "concluido" && r.fim) return new Date(r.fim).getTime();
        if (r.projecaoFimISO) return new Date(r.projecaoFimISO).getTime();
        return new Date(r.inicio).getTime() + duracaoRegistroSeg(r) * 1000;
      });
      map[c.id] = Math.max(...finsMs);
    });
    return map;
  }, [colaboradores, dataEscolhidaStr, registros]);
  // Maior "horário livre" entre os colaboradores selecionados — o grupo
  // inteiro só pode começar quando todo mundo já estiver livre.
  const horarioMinimoPermitidoMs = colaboradorIds.length
    ? colaboradorIds.reduce((max, id) => {
        const livre = horarioLivrePorColaborador[id];
        return livre != null ? Math.max(max ?? 0, livre) : max;
      }, null)
    : null;
  const colaboradorQueDefineOMinimo = horarioMinimoPermitidoMs
    ? colaboradorIds.map(id => colaboradores.find(c => c.id === id)).find((c, i) => horarioLivrePorColaborador[colaboradorIds[i]] === horarioMinimoPermitidoMs)
    : null;
  const inicioMs = inicio ? new Date(inicio).getTime() : null;
  const inicioSobrepoe = !!(horarioMinimoPermitidoMs && inicioMs != null && inicioMs < horarioMinimoPermitidoMs);

  useEffect(() => {
    // Corrigido: quando o colaborador (ou a data) muda e ele já tem
    // compromisso até mais tarde, o início sobe sozinho pra logo depois
    // do término previsto — as etapas dele nunca ficam sobrepostas.
    if (horarioMinimoPermitidoMs && inicioMs != null && inicioMs < horarioMinimoPermitidoMs) {
      setInicio(toLocalInput(new Date(horarioMinimoPermitidoMs)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorIds.join(","), dataEscolhidaStr]);

  function pecasQueCabem(colaboradorId, tetoHoras) {
    const existentesSeg = (horasExistentesPorColaborador[colaboradorId] || 0) * 3600;
    const disponivelSeg = Math.max(0, tetoHoras * 3600 - existentesSeg);
    if (!tempoPorUnidadeSeg) return quantidadeAlvo;
    // Etapa "por lote" não dá pra dividir — ou cabe o lote inteiro no
    // tempo disponível, ou não cabe nada.
    if (ehLote) return disponivelSeg >= tempoPorUnidadeSeg ? quantidadeAlvo : 0;
    return Math.min(quantidadeAlvo, Math.floor(disponivelSeg / tempoPorUnidadeSeg));
  }
  // Bloqueia a SELEÇÃO da pessoa (não a etapa) quando ela já não cabe
  // nem uma peça no teto máximo de 12h desse dia.
  const colaboradorBloqueado = (id) => !!dataEscolhidaStr && pecasQueCabem(id, JORNADA_MAXIMA_HORAS) <= 0;

  const maxSemAutorizacaoGrupo = colaboradorIds.length && dataEscolhidaStr
    ? Math.min(...colaboradorIds.map(id => pecasQueCabem(id, JORNADA_DIARIA_HORAS)))
    : quantidadeAlvo;
  const maxComAutorizacaoGrupo = colaboradorIds.length && dataEscolhidaStr
    ? Math.min(...colaboradorIds.map(id => pecasQueCabem(id, JORNADA_MAXIMA_HORAS)))
    : quantidadeAlvo;

  useEffect(() => {
    // Corrigido: a quantidade a programar nunca passa do teto absoluto de
    // 12h do dia — se a seleção de colaborador ou a data mudar e reduzir
    // a capacidade disponível, o campo desce sozinho.
    setQuantidadeProgramar(q => String(ehLote ? quantidadeAlvo : Math.max(0, Math.min(parseFloat(q || "0") || quantidadeAlvo, maxComAutorizacaoGrupo))));
    setAutorizacaoConfirmada(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaboradorIds.join(","), inicio]);

  function toggleColaborador(id) {
    if (colaboradorBloqueado(id) && !colaboradorIds.includes(id)) return;
    setColaboradorIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }
  function usarEquipeSalva(id) {
    setEquipeSalvaId(id);
    const eq = equipes.find(e => e.id === id);
    // Corrigido: se a equipe salva tiver algum membro que não cabe mais
    // nesse dia, ele é deixado de fora da seleção — só aquele
    // colaborador fica de fora, o resto da equipe segue normalmente.
    if (eq) setColaboradorIds(eq.membros.filter(mid => !colaboradorBloqueado(mid)));
  }
  function atualizarCorPantone(i, valor) { setCoresPantone(cores => cores.map((c, idx) => idx === i ? valor : c)); }
  function adicionarCorPantone() { setCoresPantone(cores => [...cores, ""]); }
  function removerCorPantone(i) { setCoresPantone(cores => cores.filter((_, idx) => idx !== i)); }

  const quantidadeProgramarNum = ehLote ? quantidadeAlvo : Math.max(0, parseFloat(quantidadeProgramar || "0"));
  const precisaAutorizacaoHoras = quantidadeProgramarNum > maxSemAutorizacaoGrupo;
  const precisaAutorizacao = precisaAutorizacaoHoras || ehSabado;
  const saldoQueFicaraAberto = ehLote ? 0 : Math.max(0, Math.round((quantidadeAlvo - quantidadeProgramarNum) * 1000) / 1000);

  // Corrigido: a meta por hora (peças/h) saiu daqui e passou a aparecer
  // no relatório de itens em aberto — aqui, na Ordem de Produção, o que
  // interessa é a carga horária que essa escalação deixaria no dia de
  // cada colaborador selecionado (o que já estava programado + o tempo
  // desta etapa).
  const cargaHorariaProgramada = useMemo(() => {
    if (!inicio || colaboradorIds.length === 0) return [];
    const horasNovaEtapa = tempoPorUnidadeSeg ? (quantidadeProgramarNum * tempoPorUnidadeSeg) / 3600 : 0;
    return colaboradorIds.map(id => {
      const nome = colaboradores.find(c => c.id === id)?.nome || "—";
      const existentes = Math.round((horasExistentesPorColaborador[id] || 0) * 10) / 10;
      const total = Math.round((existentes + horasNovaEtapa) * 10) / 10;
      return { id, nome, existentes, novaEtapa: Math.round(horasNovaEtapa * 10) / 10, total };
    });
  }, [inicio, colaboradorIds, horasExistentesPorColaborador, tempoPorUnidadeSeg, quantidadeProgramarNum, colaboradores]);

  const podeIniciar = !diaBloqueadoTotal && !inicioSobrepoe && colaboradorIds.length > 0 && !!inicio
    && (!isCorte || tipoTecido.trim()) && (!isSilk || fotolitoOk !== null)
    && quantidadeProgramarNum > 0 && quantidadeProgramarNum <= maxComAutorizacaoGrupo
    && (!precisaAutorizacao || (podeAutorizarCargaExtra && autorizacaoConfirmada));

  function confirmar() {
    if (!podeIniciar) return;
    const equipamentoSelecionado = equipamentoId ? (equipamentos || []).find(e => e.id === equipamentoId) : null;
    onIniciar({
      colaboradorIds, inicio, quantidade: quantidadeProgramarNum,
      extras: {
        ...(equipamentoId ? { equipamentoId, equipamentoNomeSnap: equipamentoSelecionado?.nome || "—" } : {}),
        ...(isCorte ? { tipoTecido: tipoTecido.trim(), consumo: parseFloat(consumo || "0") } : {}),
        ...(isSilk ? { fotolitoOk, tamanhoArte: tamanhoArte.trim(), coresPantone: coresPantone.map(c => c.trim()).filter(Boolean) } : {}),
      },
    });
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
      <Field label="Colaborador">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <ToggleChip ativo={!modoEquipe} onClick={() => { setModoEquipe(false); setEquipeSalvaId(""); if (colaboradorIds.length > 1) setColaboradorIds(colaboradorIds.slice(0, 1)); }}>Individual</ToggleChip>
          <ToggleChip ativo={modoEquipe} onClick={() => setModoEquipe(true)}>Equipe</ToggleChip>
        </div>
        {!modoEquipe ? (
          <Select value={colaboradorIds[0] || ""} onChange={e => setColaboradorIds(e.target.value ? [e.target.value] : [])}>
            <option value="">Selecione…</option>
            {colaboradores.map(c => {
              const bloqueado = colaboradorBloqueado(c.id);
              return (
                <option key={c.id} value={c.id} disabled={bloqueado}>
                  {c.nome}{c.funcao ? ` · ${c.funcao}` : ""}{bloqueado ? ` — bloqueado (sem capacidade nesse dia)` : ""}
                </option>
              );
            })}
          </Select>
        ) : (
          <>
            {equipesDoSetor.length > 0 && (
              <Select value={equipeSalvaId} onChange={e => usarEquipeSalva(e.target.value)} style={{ marginBottom: 8 }}>
                <option value="">Usar equipe salva (opcional)…</option>
                {equipesDoSetor.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </Select>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {colaboradores.map(c => {
                const bloqueado = colaboradorBloqueado(c.id);
                return (
                  <ToggleChip
                    key={c.id}
                    ativo={colaboradorIds.includes(c.id)}
                    colorAtivo={bloqueado ? "#b13232" : undefined}
                    onClick={() => { if (bloqueado) return; toggleColaborador(c.id); setEquipeSalvaId(""); }}
                  >
                    {c.nome}{bloqueado ? " 🚫" : ""}
                  </ToggleChip>
                );
              })}
            </div>
            {colaboradores.some(c => colaboradorBloqueado(c.id)) && (
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 6 }}>🚫 = sem capacidade nesse dia — não pode ser escalado nessa data, mas o restante da equipe pode seguir normalmente.</div>
            )}
          </>
        )}
      </Field>

      {equipamentosDoSetor.length > 0 && (
        <Field label="Equipamento (opcional)">
          <Select value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)}>
            <option value="">Sem equipamento específico</option>
            {equipamentosDoSetor.map(eq => <option key={eq.id} value={eq.id}>{eq.nome}{eq.status === "manutencao" ? " (em manutenção)" : ""}</option>)}
          </Select>
        </Field>
      )}

      {!ehLote && (
        <Field label={`Quantidade a programar agora (de ${quantidadeAlvo} peças no total)`}>
          <input
            type="number" min="0" step="1" value={quantidadeProgramar}
            onChange={e => setQuantidadeProgramar(e.target.value)}
            max={maxComAutorizacaoGrupo} style={inputStyle}
          />
          {saldoQueFicaraAberto > 0 && (
            <div style={{ fontSize: 11.5, color: "#8a6510", marginTop: 5 }}>
              Restam {saldoQueFicaraAberto} peças em aberto — dá pra programar depois com outro colaborador ou outro dia.
            </div>
          )}
        </Field>
      )}

      {cargaHorariaProgramada.length > 0 && (
        <Field label="Carga horária programada no dia">
          <div style={{ border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden" }}>
            {cargaHorariaProgramada.map((c, i) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", fontSize: 12.5, color: "#2a2015", borderTop: i > 0 ? "1px solid #f4efe2" : "none" }}>
                <span>{c.nome}</span>
                <span><b>{c.total}h</b> {c.existentes > 0 ? `(${c.existentes}h já programadas + ${c.novaEtapa}h desta etapa)` : "no dia"}</span>
              </div>
            ))}
          </div>
        </Field>
      )}

      {isCorte && (
        <>
          <Field label="Tipo de tecido">
            <input value={tipoTecido} onChange={e => setTipoTecido(e.target.value)} placeholder="Ex.: Malha 100% algodão" style={inputStyle} />
          </Field>
          <Field label="Consumo (metros)">
            <input type="number" min="0" step="0.1" value={consumo} onChange={e => setConsumo(e.target.value)} placeholder="Ex.: 12.5" style={inputStyle} />
          </Field>
        </>
      )}
      {isSilk && (
        <>
          <Field label="Fotolito conferido?">
            <div style={{ display: "flex", gap: 8 }}>
              <ToggleChip ativo={fotolitoOk === false} colorAtivo="#b13232" onClick={() => setFotolitoOk(false)}>Não</ToggleChip>
              <ToggleChip ativo={fotolitoOk === true} onClick={() => setFotolitoOk(true)}>Sim</ToggleChip>
            </div>
          </Field>
          <Field label="Cores utilizadas (Pantone)">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {coresPantone.map((cor, i) => (
                <div key={i} style={{ display: "flex", gap: 6 }}>
                  <input value={cor} onChange={e => atualizarCorPantone(i, e.target.value)} placeholder={`Cor ${i + 1} — código Pantone`} style={{ ...inputStyle, flex: 1 }} />
                  {coresPantone.length > 1 && <IconButton onClick={() => removerCorPantone(i)} danger title="Remover"><X size={16} /></IconButton>}
                </div>
              ))}
              <button type="button" onClick={adicionarCorPantone} style={{ alignSelf: "flex-start", fontSize: 12, border: "1px solid #d9cfb7", background: "#fff", borderRadius: 7, padding: "5px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#6b5d49" }}>
                <Plus size={12} /> adicionar cor
              </button>
            </div>
          </Field>
          <Field label="Tamanho da arte">
            <input value={tamanhoArte} onChange={e => setTamanhoArte(e.target.value)} placeholder="Ex.: 20 x 15 cm" style={inputStyle} />
          </Field>
        </>
      )}

      <Field label="Início (quando)">
        <input type="datetime-local" value={inicio} onChange={e => setInicio(e.target.value)} style={inputStyle} />
      </Field>

      {diaBloqueadoTotal && (
        <div style={{ background: "#f8e6e6", border: "1.5px solid #b13232", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b13232", marginBottom: 3 }}>Data não permitida</div>
          <div style={{ fontSize: 12, color: "#6b5d49" }}>
            {ehDomingo ? "Domingo não é dia útil." : `Feriado${feriadoDoDia?.descricao ? ` — ${feriadoDoDia.descricao}` : ""}.`} Programação de produção só em dias úteis (segunda a sexta) ou sábado com autorização. Escolha outra data.
          </div>
        </div>
      )}

      {!diaBloqueadoTotal && inicioSobrepoe && (
        <div style={{ background: "#f8e6e6", border: "1.5px solid #b13232", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b13232", marginBottom: 3 }}>Horário sobreposto</div>
          <div style={{ fontSize: 12, color: "#6b5d49" }}>
            {colaboradorQueDefineOMinimo?.nome || "Esse colaborador"} só fica livre a partir de {new Date(horarioMinimoPermitidoMs).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} — as etapas dele são encadeadas, uma só pode começar depois que a anterior termina. Ajuste o horário de início.
          </div>
        </div>
      )}

      {!diaBloqueadoTotal && colaboradorIds.length > 0 && quantidadeProgramarNum > maxComAutorizacaoGrupo && (
        <div style={{ background: "#f8e6e6", border: "1.5px solid #b13232", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b13232", marginBottom: 3 }}>Quantidade acima do possível nesse dia</div>
          <div style={{ fontSize: 12, color: "#6b5d49" }}>
            No máximo {maxComAutorizacaoGrupo} peças cabem nesse dia para quem foi selecionado, mesmo com autorização (teto de {JORNADA_MAXIMA_HORAS}h/dia). Reduza a quantidade — o restante fica em aberto para outro colaborador ou outro dia.
          </div>
        </div>
      )}
      {!diaBloqueadoTotal && precisaAutorizacao && quantidadeProgramarNum > 0 && quantidadeProgramarNum <= maxComAutorizacaoGrupo && (
        <div style={{ background: "#fdf3e0", border: "1.5px dashed #b5820a", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#8a6510", marginBottom: 3 }}>
            {ehSabado && precisaAutorizacaoHoras ? "Sábado e carga acima de 8h" : ehSabado ? "Programação em sábado" : "Carga acima do desejável para o dia"}
          </div>
          <div style={{ fontSize: 12, color: "#6b5d49", marginBottom: podeAutorizarCargaExtra ? 8 : 0 }}>
            {ehSabado && <>Sábados sempre exigem autorização de um Gestor ou Administrador. </>}
            {precisaAutorizacaoHoras && <>Essa quantidade passa das {JORNADA_DIARIA_HORAS}h recomendadas para quem foi selecionado — até {JORNADA_MAXIMA_HORAS}h/dia exige autorização.</>}
          </div>
          {podeAutorizarCargaExtra ? (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 7, cursor: "pointer" }}>
              <input type="checkbox" checked={autorizacaoConfirmada} onChange={e => setAutorizacaoConfirmada(e.target.checked)} style={{ marginTop: 3 }} />
              <span style={{ fontSize: 12, color: "#8a6510", fontWeight: 600 }}>Autorizo esta programação como Gestor/Administrador.</span>
            </label>
          ) : (
            <div style={{ fontSize: 12, color: "#b13232", fontWeight: 600 }}>Peça para um Gestor ou Administrador iniciar esta etapa.</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <PrimaryButton onClick={confirmar} disabled={!podeIniciar} style={{ flex: 1 }}>
          <Play size={16} /> Iniciar {passo.etapaNomeSnap}
        </PrimaryButton>
        <button onClick={onCancelar} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

function OrdensProducao({ ordensProducao, produtos, etapas, setores, vinculos, colaboradores, equipes, equipamentos, registros, onSalvarOrdem, onRemoverOrdem, onSalvarRegistro, clientes, onImprimirGrade, podeAutorizarCargaExtra, feriados, consumosMaterial, materiais, ehAdministrador }) {
  const [clienteIdNovo, setClienteIdNovo] = useState("");
  const [dataEntregaNova, setDataEntregaNova] = useState("");
  const [produtoParaAdicionar, setProdutoParaAdicionar] = useState("");
  const [quantidadeParaAdicionar, setQuantidadeParaAdicionar] = useState("");
  const [itensNovo, setItensNovo] = useState([]); // [{produtoId, quantidade}]
  const [expandidoId, setExpandidoId] = useState(null);
  // Adicionado: o detalhe de uma OP em aberto (expandida) agora é
  // dividido em 3 folhas — Atividades (cronograma dos departamentos),
  // Materiais (o que precisa separar) e Arquivos (imagens/vídeos de
  // referência) — em vez de mostrar tudo empilhado de uma vez.
  const [abaDetalheOP, setAbaDetalheOP] = useState("atividades");
  function alternarExpandidoOP(id) {
    setExpandidoId(atual => (atual === id ? null : id));
    setAbaDetalheOP("atividades");
  }
  // Adicionado: anexar arquivo numa OP já aberta (além do anexo feito na
  // hora de criar) — usa um único input de arquivo compartilhado entre
  // todas as OPs da lista, sabendo em qual OP anexar pelo id guardado
  // em `anexandoOPId`.
  const [anexandoOPId, setAnexandoOPId] = useState(null);
  const anexoOPInputRef = useRef(null);
  async function anexarArquivoOP(op, fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) { alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`); continue; }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    if (novos.length) await onSalvarOrdem({ ...op, anexos: [...(op.anexos || []), ...novos] });
  }
  async function removerAnexoOP(op, anexoId) {
    await onSalvarOrdem({ ...op, anexos: (op.anexos || []).filter(a => a.id !== anexoId) });
  }
  const [iniciandoChave, setIniciandoChave] = useState(null);
  // Adicionado: imagem(ns) ou vídeo(s) de referência anexados antes de
  // abrir a OP (ex.: arte aprovada, foto de amostra, vídeo de instrução)
  // — aparecem depois no relatório impresso da própria OP.
  const [anexosNovaOP, setAnexosNovaOP] = useState([]);
  const anexoNovaOPInputRef = useRef(null);
  // Adicionado: campo de pesquisa das Ordens de Produção — busca pelo
  // número da OP, nome do cliente ou nome de algum produto do pedido.
  const [buscaOP, setBuscaOP] = useState("");
  function opCorresponde(op, termoBruto) {
    const termo = termoBruto.trim().toLowerCase();
    if (!termo) return true;
    const numeroTxt = `#${String(op.numero).padStart(3, "0")}`.toLowerCase();
    const clienteTxt = (op.clienteNomeSnap || "sem cliente").toLowerCase();
    const produtosTxt = (op.itens || []).map(it => it.produtoNomeSnap || "").join(" ").toLowerCase();
    return numeroTxt.includes(termo) || String(op.numero).includes(termo) || clienteTxt.includes(termo) || produtosTxt.includes(termo);
  }

  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";

  // Só produtos com etapas vinculadas podem entrar numa OP, já que é dali
  // que vem a sequência (definida pela ordem cadastrada em Cadastros →
  // Produtos).
  const produtosComSequencia = useMemo(
    () => produtos.filter(p => vinculos.some(v => v.produtoId === p.id)),
    [produtos, vinculos]
  );
  const produtosDisponiveisParaAdicionar = useMemo(
    () => produtosComSequencia.filter(p => !itensNovo.some(it => it.produtoId === p.id)),
    [produtosComSequencia, itensNovo]
  );
  const qtdParaAdicionarNum = parseInt(quantidadeParaAdicionar || "0", 10);
  const podeAdicionarItem = produtoParaAdicionar && qtdParaAdicionarNum > 0;

  // Corrigido: ao clicar em "Adicionar", a lista de produtos aparecia na
  // hora, mudando o layout — e o botão "remover" do item recém-criado
  // acabava caindo bem embaixo do toque que ainda estava terminando,
  // removendo o item imediatamente sem querer. Adiar a atualização em um
  // tick evita que a troca de layout aconteça durante o mesmo clique.
  function adicionarItem() {
    if (!podeAdicionarItem) return;
    const novoItem = { produtoId: produtoParaAdicionar, quantidade: qtdParaAdicionarNum };
    setTimeout(() => {
      setItensNovo(itens => [...itens, novoItem]);
      setProdutoParaAdicionar(""); setQuantidadeParaAdicionar("");
    }, 0);
  }
  function removerItem(produtoId) {
    setTimeout(() => {
      setItensNovo(itens => itens.filter(it => it.produtoId !== produtoId));
    }, 0);
  }

  // Adicionado: anexa imagem(ns) ou vídeo(s) de referência antes de abrir
  // a OP (ex.: arte aprovada pelo cliente, foto de amostra, vídeo de
  // instrução de montagem) — fica salvo na própria OP e aparece depois
  // no relatório impresso dela.
  async function anexarArquivoNovaOP(fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) {
        alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`);
        continue;
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    if (novos.length) setAnexosNovaOP(anexos => [...anexos, ...novos]);
  }
  function removerAnexoNovaOP(id) { setAnexosNovaOP(anexos => anexos.filter(a => a.id !== id)); }

  // Adicionado: soma o tempo dimensionado (por peça × quantidade, ou fixo
  // por lote) de todas as etapas de todos os produtos já adicionados ao
  // pedido, para mostrar de cara o tempo total de produção da OP.
  const tempoTotalPreview = useMemo(() => {
    return itensNovo.reduce((somaGeral, item) => {
      const vinculosDoItem = vinculos.filter(v => v.produtoId === item.produtoId);
      const somaItem = vinculosDoItem.reduce((soma, v) => {
        const etapa = etapas.find(e => e.id === v.etapaId);
        const tipoCalculo = etapa?.tipoCalculo || "peca";
        return soma + (tipoCalculo === "lote" ? v.tempoEstimadoSeg : v.tempoEstimadoSeg * item.quantidade);
      }, 0);
      return somaGeral + somaItem;
    }, 0);
  }, [itensNovo, vinculos, etapas]);

  // Adicionado: tempo de produção já comprometido, separado por
  // departamento (Corte, Silk, Preparação, Costura...). Cada departamento
  // tem sua própria equipe — a fila da Silk não atrasa o Corte — então
  // somar tudo junto superestimaria o prazo. Em vez disso: para cada
  // departamento que este pedido novo vai usar, soma o que já está
  // comprometido nas demais OPs em aberto + o que este pedido também
  // vai exigir, e projeta a data considerando {HORAS_PRODUTIVAS_DIA}h de
  // produção por dia. A entrega real do pedido é definida pelo
  // departamento mais carregado (o gargalo).
  const previsaoPorDepartamento = useMemo(() => {
    const mapa = new Map(); // chave do setor -> { nome, comprometidoSeg, novoSeg }
    function registrar(setorId, setorNome, campo, segundos) {
      if (!segundos) return;
      const chave = setorId || setorNome || "—";
      if (!mapa.has(chave)) mapa.set(chave, { nome: setorNome || "—", comprometidoSeg: 0, novoSeg: 0 });
      mapa.get(chave)[campo] += segundos;
    }
    (ordensProducao || []).filter(o => o.status === "aberta").forEach(o => {
      (o.etapas || []).filter(p => !p.concluida).forEach(p => {
        registrar(p.setorId, p.setorNomeSnap, "comprometidoSeg", p.duracaoEstimadaSeg ?? duracaoEtapaOP(p, p.quantidade || 1));
      });
    });
    itensNovo.forEach(item => {
      vinculos.filter(v => v.produtoId === item.produtoId).forEach(v => {
        const etapa = etapas.find(e => e.id === v.etapaId);
        const tipoCalculo = etapa?.tipoCalculo || "peca";
        const setor = setores.find(s => s.id === etapa?.setorId);
        const segundos = tipoCalculo === "lote" ? v.tempoEstimadoSeg : v.tempoEstimadoSeg * item.quantidade;
        registrar(etapa?.setorId, setor?.nome, "novoSeg", segundos);
      });
    });
    const agora = new Date();
    return Array.from(mapa.values())
      .filter(d => d.novoSeg > 0)
      .map(d => ({ ...d, totalSeg: d.comprometidoSeg + d.novoSeg, previsao: projetarDataUtil(d.comprometidoSeg + d.novoSeg, agora) }))
      .sort((a, b) => b.previsao - a.previsao);
  }, [ordensProducao, itensNovo, vinculos, etapas, setores]);
  const previsaoEntregaComFila = previsaoPorDepartamento[0]?.previsao || null;
  const previsaoDentroDoPrazo = previsaoEntregaComFila && dataEntregaNova
    ? previsaoEntregaComFila <= new Date(dataEntregaNova + "T23:59:59")
    : null;

  const podeAbrir = itensNovo.length > 0 && dataEntregaNova;

  async function abrirOP() {
    if (!podeAbrir) return;
    const clienteSelecionado = (clientes || []).find(c => c.id === clienteIdNovo);
    // Adicionado: a OP agora reúne as etapas de TODOS os produtos do
    // pedido, cada uma marcada com o produto a que pertence — assim o
    // gestor acompanha o pedido inteiro (mesmo com produtos diferentes)
    // numa única Ordem de Produção.
    const etapasSeq = itensNovo.flatMap(item => {
      const produto = produtos.find(p => p.id === item.produtoId);
      const vinculosDoItem = [...vinculos.filter(v => v.produtoId === item.produtoId)].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      return vinculosDoItem.map(v => {
        const etapa = etapas.find(e => e.id === v.etapaId);
        const setor = setores.find(s => s.id === etapa?.setorId);
        const tipoCalculo = etapa?.tipoCalculo || "peca";
        return {
          produtoId: item.produtoId, produtoNomeSnap: produto?.nome || "—", quantidade: item.quantidade,
          etapaId: v.etapaId,
          etapaNomeSnap: etapa?.nome || "—",
          setorId: etapa?.setorId || null,
          setorNomeSnap: setor?.nome || "—",
          tipoCalculo,
          // Adicionado: guarda o tempo estimado (base) e a duração já
          // dimensionada para a quantidade daquele produto — assim a OP
          // inteira já nasce com todos os departamentos (Corte, Silk,
          // Preparação e demais), de todos os produtos, prontos para
          // receber "quem" e "quando", sem depender do vínculo do
          // produto mudar depois.
          tempoEstimadoSeg: v.tempoEstimadoSeg,
          duracaoEstimadaSeg: tipoCalculo === "lote" ? v.tempoEstimadoSeg : v.tempoEstimadoSeg * item.quantidade,
          concluida: false,
        };
      });
    });
    const tempoEstimadoTotalSeg = etapasSeq.reduce((s, p) => s + p.duracaoEstimadaSeg, 0);
    // Corrigido: o número da OP era sequencial por cliente (cada cliente
    // tinha sua própria contagem #001, #002...) — isso fazia OPs de
    // clientes diferentes compartilharem o mesmo número, confundindo
    // quem olha a lista. Agora é uma sequência única de pedido, contada
    // entre todas as Ordens de Produção já abertas, não importa o cliente.
    const numero = ordensProducao.reduce((max, o) => Math.max(max, o.numero || 0), 0) + 1;
    const novaOP = {
      id: uid(), numero,
      clienteId: clienteIdNovo || null,
      clienteNomeSnap: clienteSelecionado ? clienteSelecionado.nome : null,
      // Adicionado: uma OP pode reunir mais de um produto — cada um com
      // sua própria quantidade — dentro do mesmo pedido do cliente.
      itens: itensNovo.map(it => ({ produtoId: it.produtoId, produtoNomeSnap: produtos.find(p => p.id === it.produtoId)?.nome || "—", quantidade: it.quantidade })),
      dataEntrega: dataEntregaNova,
      etapas: etapasSeq,
      tempoEstimadoTotalSeg,
      status: "aberta",
      // Adicionado: imagens/vídeos de referência anexados antes de abrir
      // a OP — aparecem no relatório impresso dela.
      anexos: anexosNovaOP,
      criadaEm: new Date().toISOString(), concluidaEm: null,
    };
    await onSalvarOrdem(novaOP);
    setClienteIdNovo(""); setDataEntregaNova(""); setItensNovo([]); setProdutoParaAdicionar(""); setQuantidadeParaAdicionar(""); setAnexosNovaOP([]);
  }

  // Adicionado: consolida os materiais necessários da OP inteira —
  // percorre todos os produtos do pedido, cruza com a ficha de consumo
  // de cada um (Cadastros → Produtos) e soma por material, para quem vai
  // separar saber de uma vez tudo que precisa pra aquela ordem.
  function materiaisDaOP(op) {
    const soma = {};
    (op.itens || []).forEach(item => {
      (consumosMaterial || []).filter(c => c.produtoId === item.produtoId).forEach(c => {
        const material = (materiais || []).find(m => m.id === c.materialId);
        const chave = c.materialId;
        if (!soma[chave]) soma[chave] = { id: chave, nome: material?.nome || "—", unidade: material?.unidade || "", quantidade: 0, estoque: material?.quantidadeEstoque ?? null };
        soma[chave].quantidade += (c.quantidadePorPeca || 0) * item.quantidade;
      });
    });
    return Object.values(soma)
      .map(m => ({ ...m, quantidade: Math.round(m.quantidade * 1000) / 1000 }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  // Adicionado: marca ou desmarca um material como separado na etapa de
  // Preparação — a marcação é gravada na própria etapa da OP, então
  // persiste ao recarregar e todo mundo que abrir a ordem vê o mesmo
  // estado da separação.
  async function alternarMaterialSeparado(op, indexEtapa, consumoId) {
    const etapasAtualizadas = op.etapas.map((e, i) => {
      if (i !== indexEtapa) return e;
      const atuais = e.materiaisSeparados || [];
      return {
        ...e,
        materiaisSeparados: atuais.includes(consumoId)
          ? atuais.filter(id => id !== consumoId)
          : [...atuais, consumoId],
      };
    });
    await onSalvarOrdem({ ...op, etapas: etapasAtualizadas });
  }

  // Adicionado: excluir uma OP é uma ação destrutiva — apaga também todos
  // os registros de lançamento já feitos em cada departamento dela (ver
  // removerOrdemComRegistros, em App). Por isso fica restrita a
  // administrador; a guarda aqui é defensiva, já que o botão nem aparece
  // pra quem não é administrador (ver renderização mais abaixo).
  async function cancelarOP(op) {
    if (!ehAdministrador) return;
    const registrosDaOP = registros.filter(r => r.ordemProducaoId === op.id).length;
    const aviso = registrosDaOP > 0
      ? `Cancelar a OP #${String(op.numero).padStart(3, "0")}? Isso também vai excluir ${registrosDaOP} registro(s) de lançamento já feitos nela. Essa ação não pode ser desfeita.`
      : `Cancelar a OP #${String(op.numero).padStart(3, "0")}? Essa ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;
    await onRemoverOrdem(op.id);
  }

  // Adicionado: monta a grade (tabela) para impressão de todas as etapas
  // de uma Ordem de Produção específica — mesma tabela sirva para uma OP
  // ainda em aberto (mostra o que já rodou e o que falta) ou já concluída.
  function imprimirGradeOP(op) {
    onImprimirGrade({
      titulo: `OP #${String(op.numero).padStart(3, "0")} — ${op.clienteNomeSnap || "Sem cliente"}`,
      subtitulo: (op.itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(", "),
      geradoEm: new Date().toLocaleString("pt-BR"),
      anexos: op.anexos || [],
      // Adicionado: a lista de materiais necessários da OP também vai
      // para o impresso, pra quem separa os materiais poder levar a folha.
      materiais: materiaisDaOP(op),
      colunas: [
        { key: "ordem", label: "#", align: "right" }, { key: "etapa", label: "Etapa" }, { key: "produto", label: "Produto" },
        { key: "setor", label: "Departamento" }, { key: "colaboradores", label: "Colaborador(es)" },
        { key: "status", label: "Status" }, { key: "tempo", label: "Tempo real", align: "right" },
      ],
      linhas: op.etapas.map((passo, i) => {
        const ligados = registros.filter(r => r.ordemProducaoId === op.id && r.ordemEtapaIndex === i);
        const abertos = ligados.filter(r => r.status === "aberto");
        const concluidosDaEtapa = ligados.filter(r => r.status === "concluido");
        const quantidadeConcluida = concluidosDaEtapa.reduce((s, r) => s + (r.quantidadeBoa ?? r.quantidade ?? 0), 0);
        const tempoTotalReal = concluidosDaEtapa.reduce((s, r) => s + (r.tempoRealSeg || 0), 0);
        const colaboradoresEnvolvidos = Array.from(new Set(ligados.flatMap(r => r.colaboradorIds || []))).map(nomeColab).join(", ");
        const status = passo.concluida ? "Concluída" : abertos.length ? `Em aberto (${quantidadeConcluida}/${passo.quantidade})` : quantidadeConcluida > 0 ? `Parcial (${quantidadeConcluida}/${passo.quantidade})` : "Não iniciada";
        return {
          ordem: i + 1, etapa: passo.etapaNomeSnap, produto: passo.produtoNomeSnap, setor: passo.setorNomeSnap,
          colaboradores: colaboradoresEnvolvidos || "—",
          status, tempo: tempoTotalReal > 0 ? fmtSec(tempoTotalReal) : "—",
        };
      }),
    });
  }

  // Corrigido/reorganizado: o gestor pode iniciar qualquer departamento da
  // OP a qualquer momento — não é mais preciso concluir um para liberar o
  // próximo. Só "quem" (colaborador) e "quando" (início) precisam ser
  // definidos; o quê, quanto e a meta de tempo já vêm da OP.
  async function iniciarDepartamento(op, index, dadosForm) {
    const passo = op.etapas[index];
    const quantidadeEscolhida = dadosForm.quantidade ?? passo.quantidade;
    const inicioDate = new Date(dadosForm.inicio);
    const duracaoSeg = duracaoEtapaOP(passo, quantidadeEscolhida || 1);
    const projecaoFim = isNaN(inicioDate.getTime()) ? null : new Date(inicioDate.getTime() + duracaoSeg * 1000);
    const registro = {
      id: uid(), status: "aberto",
      setorId: passo.setorId, produtoId: passo.produtoId, etapaId: passo.etapaId,
      colaboradorIds: dadosForm.colaboradorIds,
      setorNomeSnap: passo.setorNomeSnap, produtoNomeSnap: passo.produtoNomeSnap, etapaNomeSnap: passo.etapaNomeSnap,
      quantidade: quantidadeEscolhida, inicio: dadosForm.inicio,
      projecaoFimISO: projecaoFim ? projecaoFim.toISOString() : null,
      tempoEstimadoBaseSeg: passo.tempoEstimadoSeg, tipoCalculoEtapa: passo.tipoCalculo,
      ordemProducaoId: op.id, ordemProducaoNumero: op.numero, ordemEtapaIndex: index,
      ...(dadosForm.extras || {}),
      criadoEm: new Date().toISOString(),
    };
    await onSalvarRegistro(registro);
    setIniciandoChave(null);
  }

  const abertas = [...ordensProducao.filter(o => o.status === "aberta" && opCorresponde(o, buscaOP))].sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm));
  const concluidas = [...ordensProducao.filter(o => o.status === "concluida" && opCorresponde(o, buscaOP))].sort((a, b) => new Date(b.concluidaEm || 0) - new Date(a.concluidaEm || 0));

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 6, color: "#1c2b39" }}>Abrir nova Ordem de Produção</div>
        <div style={{ fontSize: 12.5, color: "#6b5d49", marginBottom: 12 }}>
          Todo processo de produção começa por aqui: ao abrir a OP, todos os departamentos (Corte, Silk, Preparação e os demais) já ficam prontos com o tempo dimensionado — o gestor só define quem e quando faz cada um, sem perder de vista o prazo de entrega.
        </div>
        {produtosComSequencia.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "#6b5d49", background: "#f4efe2", padding: 12, borderRadius: 8 }}>
            Nenhum produto tem etapas vinculadas ainda. Cadastre a sequência em Cadastros → Produtos.
          </div>
        ) : (
          <>
            <Field label="Cliente (opcional)">
              <Select value={clienteIdNovo} onChange={e => setClienteIdNovo(e.target.value)}>
                <option value="">Sem cliente definido</option>
                {(clientes || []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
              {(!clientes || clientes.length === 0) && (
                <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Cadastre clientes em Cadastros → Clientes.</div>
              )}
            </Field>

            <Field label="Produtos do pedido">
              {produtosDisponiveisParaAdicionar.length > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Select value={produtoParaAdicionar} onChange={e => setProdutoParaAdicionar(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Produto…</option>
                      {produtosDisponiveisParaAdicionar.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </Select>
                    <input type="number" min="1" step="1" value={quantidadeParaAdicionar} onChange={e => setQuantidadeParaAdicionar(e.target.value)} placeholder="Qtd." style={{ ...inputStyle, width: 78 }} />
                  </div>
                  <button type="button" onClick={adicionarItem} disabled={!podeAdicionarItem} style={{
                    marginTop: 8, width: "100%", border: "1.5px solid " + (podeAdicionarItem ? "#2f4a63" : "#d9cfb7"),
                    background: podeAdicionarItem ? "#2f4a63" : "#f4efe2", color: podeAdicionarItem ? "#fff" : "#a3937a",
                    borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700,
                    cursor: podeAdicionarItem ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    <Plus size={15} /> Adicionar produto ao pedido
                  </button>
                  {!podeAdicionarItem && (produtoParaAdicionar || quantidadeParaAdicionar) && (
                    <div style={{ fontSize: 11.5, color: "#b5820a", marginTop: 5 }}>
                      {!produtoParaAdicionar ? "Escolha um produto." : "Informe uma quantidade maior que zero."}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11.5, color: "#a3937a" }}>Todos os produtos disponíveis já foram adicionados.</div>
              )}
              {/* Corrigido: a lista de produtos já adicionados agora aparece
                  ABAIXO do formulário de adicionar, não acima. Antes, ao
                  adicionar um item, a lista surgia empurrando o botão
                  "Adicionar" para baixo — e o botão "remover" do item novo
                  acabava ocupando exatamente a posição da tela onde o toque
                  ainda estava, removendo o item por engano na hora. */}
              {itensNovo.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                  {itensNovo.map(it => {
                    const nomeProd = produtos.find(p => p.id === it.produtoId)?.nome || "—";
                    return (
                      <div key={it.produtoId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
                        <span style={{ fontSize: 13, color: "#2a2015" }}>{nomeProd} — {it.quantidade} peças</span>
                        <IconButton onClick={() => removerItem(it.produtoId)} danger title="Remover"><X size={14} /></IconButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </Field>

            {tempoTotalPreview > 0 && (
              <div style={{ background: "#f4ecd8", border: "1px solid #cfe3e0", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: "#1c2b39" }}>
                  Tempo de produção deste pedido: <b>{fmtSec(tempoTotalPreview)}</b> ({itensNovo.length} produto{itensNovo.length !== 1 ? "s" : ""})
                </div>
                {previsaoPorDepartamento.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #cdb98a" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Por departamento · {HORAS_PRODUTIVAS_DIA}h de produção por dia
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {previsaoPorDepartamento.map(d => (
                        <div key={d.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12, color: "#2a2015" }}>
                          <span>
                            {d.nome}
                            {d.comprometidoSeg > 0 && <span style={{ color: "#a3937a" }}> ({fmtSec(d.comprometidoSeg)} já na fila + {fmtSec(d.novoSeg)} deste pedido)</span>}
                          </span>
                          <b style={{ whiteSpace: "nowrap" }}>{d.previsao.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {previsaoEntregaComFila && (
                  <div style={{ fontSize: 12.5, color: "#1c2b39", marginTop: 8, paddingTop: 8, borderTop: "1px dashed #cdb98a" }}>
                    Previsão de entrega (departamento mais carregado): <b>{previsaoEntregaComFila.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</b>
                  </div>
                )}
              </div>
            )}
            <Field label="Data de entrega">
              <input type="date" value={dataEntregaNova} onChange={e => setDataEntregaNova(e.target.value)} style={inputStyle} />
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Prazo máximo — usada para classificar a OP como dentro ou fora do prazo.</div>
              {previsaoDentroDoPrazo != null && (
                <div style={{
                  fontSize: 11.5, fontWeight: 700, marginTop: 6, display: "inline-block", padding: "3px 9px", borderRadius: 999,
                  color: previsaoDentroDoPrazo ? "#1a7a4c" : "#b13232", background: previsaoDentroDoPrazo ? "#e6f4ec" : "#f8e6e6",
                }}>
                  {previsaoDentroDoPrazo ? "Prazo compatível com a fila atual" : "Fila atual pode atrasar esse prazo — considere uma data mais folgada"}
                </div>
              )}
            </Field>

            <Field label="Anexo de referência (imagem ou vídeo, opcional)">
              {anexosNovaOP.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                  {anexosNovaOP.map(a => (
                    <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                      {a.tipo && a.tipo.startsWith("image/") ? (
                        <img src={a.dataUrl} alt={a.nome} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
                      ) : a.tipo && a.tipo.startsWith("video/") ? (
                        <video src={a.dataUrl} style={{ width: "100%", height: 70, objectFit: "cover", display: "block", background: "#000" }} muted />
                      ) : (
                        <div style={{ width: "100%", height: 70, display: "flex", alignItems: "center", justifyContent: "center", color: "#a3937a" }}>
                          <Paperclip size={22} />
                        </div>
                      )}
                      <div style={{ fontSize: 9.5, color: "#6b5d49", padding: "3px 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                      <button onClick={() => removerAnexoNovaOP(a.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={anexoNovaOPInputRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }}
                onChange={e => { anexarArquivoNovaOP(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => anexoNovaOPInputRef.current && anexoNovaOPInputRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar imagem ou vídeo</button>
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Ex.: arte aprovada, foto de amostra, vídeo de instrução. Aparece no relatório impresso desta OP.</div>
            </Field>

            <PrimaryButton onClick={abrirOP} disabled={!podeAbrir} style={{ width: "100%" }}>
              <ListOrdered size={16} /> Abrir OP
            </PrimaryButton>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 16, padding: 12 }}>
        <Field label="Pesquisar ordens de produção">
          <input value={buscaOP} onChange={e => setBuscaOP(e.target.value)} placeholder="Nº da OP, cliente ou produto…" style={inputStyle} />
        </Field>
      </Card>

      <input
        ref={anexoOPInputRef} type="file" multiple accept="image/*,video/*" style={{ display: "none" }}
        onChange={e => {
          const op = ordensProducao.find(o => o.id === anexandoOPId);
          if (op) anexarArquivoOP(op, e.target.files);
          e.target.value = "";
        }}
      />

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Ordens em aberto</div>
      {abertas.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px", marginBottom: 16 }}>{buscaOP ? "Nenhuma ordem em aberto encontrada para essa pesquisa." : "Nenhuma ordem de produção em aberto."}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {abertas.map(op => {
          const prazo = avaliarPrazoOP(op);
          const cronograma = cronogramaEstaticoOP(op);
          const tempoTotal = op.tempoEstimadoTotalSeg ?? cronograma.reduce((s, p) => s + p.duracaoEstimadaSeg, 0);
          const pendentes = op.etapas.filter(e => !e.concluida).length;
          const expandido = expandidoId === op.id;
          const materiaisOP = expandido ? materiaisDaOP(op) : [];
          return (
            <Card key={op.id} style={{ padding: 14 }}>
              <div onClick={() => alternarExpandidoOP(op.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  {expandido ? <ChevronUp size={16} style={{ marginTop: 3, color: "#a3937a", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ marginTop: 3, color: "#a3937a", flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: "#1c2b39" }}>OP #{String(op.numero).padStart(3, "0")} · {op.clienteNomeSnap || "Sem cliente"}</div>
                    <div style={{ fontSize: 12, color: "#a3937a" }}>{(op.itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(", ")} · aberta em {new Date(op.criadaEm).toLocaleDateString("pt-BR")}{op.anexos && op.anexos.length > 0 ? ` · 📎 ${op.anexos.length}` : ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexShrink: 0 }}>
                  <IconButton onClick={(e) => { e.stopPropagation(); imprimirGradeOP(op); }} title="Imprimir grade da OP"><Printer size={15} /></IconButton>
                  {ehAdministrador && (
                    <IconButton onClick={(e) => { e.stopPropagation(); cancelarOP(op); }} danger title="Cancelar OP (exclui também os registros de lançamento)"><Trash2 size={15} /></IconButton>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: expandido ? 10 : 0 }}>
                {prazo && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: prazo.color, background: prazo.bg, padding: "3px 9px", borderRadius: 999 }}>{prazo.label}</span>
                )}
                {op.dataEntrega && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49", background: "#f4efe2", padding: "3px 9px", borderRadius: 999 }}>
                    Entrega: {new Date(op.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR")}
                  </span>
                )}
                {tempoTotal > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49", background: "#f4efe2", padding: "3px 9px", borderRadius: 999 }}>
                    Total estimado: {fmtSec(tempoTotal)}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49", background: "#f4efe2", padding: "3px 9px", borderRadius: 999 }}>
                  {pendentes === 0 ? "Todos os departamentos concluídos" : `${pendentes} departamento${pendentes !== 1 ? "s" : ""} pendente${pendentes !== 1 ? "s" : ""}`}
                </span>
              </div>

              {expandido && (
                <div style={{ display: "flex", gap: 6, marginTop: 4, marginBottom: 4 }}>
                  {[
                    { key: "atividades", label: "Atividades" },
                    { key: "materiais", label: `Materiais${materiaisOP.length ? ` (${materiaisOP.length})` : ""}` },
                    { key: "arquivos", label: `Arquivos${(op.anexos || []).length ? ` (${op.anexos.length})` : ""}` },
                  ].map(t => (
                    <button key={t.key} onClick={(e) => { e.stopPropagation(); setAbaDetalheOP(t.key); }} style={{
                      flex: 1, border: "1.5px solid " + (abaDetalheOP === t.key ? "#2f4a63" : "#d9cfb7"),
                      background: abaDetalheOP === t.key ? "#2f4a63" : "#fff", color: abaDetalheOP === t.key ? "#fff" : "#6b5d49",
                      borderRadius: 8, padding: "7px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    }}>{t.label}</button>
                  ))}
                </div>
              )}

              {expandido && abaDetalheOP === "materiais" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
                  {materiaisOP.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#a3937a" }}>Nenhum material vinculado aos produtos deste pedido.</div>
                  ) : (
                    <div style={{ border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden" }}>
                      {materiaisOP.map((m, idx) => {
                        const faltando = m.estoque != null && m.estoque < m.quantidade;
                        return (
                          <div key={m.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "6px 10px", fontSize: 12, color: "#2a2015",
                            borderTop: idx > 0 ? "1px solid #f4efe2" : "none",
                            background: faltando ? "#f8e6e6" : "transparent",
                          }}>
                            <span>{m.nome}</span>
                            <span style={{ textAlign: "right" }}>
                              <b>{m.quantidade} {m.unidade}</b>
                              {m.estoque != null && (
                                <span style={{ fontSize: 10.5, color: faltando ? "#b13232" : "#a3937a", marginLeft: 6 }}>
                                  {faltando ? `falta ${Math.round((m.quantidade - m.estoque) * 1000) / 1000} ${m.unidade}` : `estoque: ${m.estoque} ${m.unidade}`}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {expandido && abaDetalheOP === "arquivos" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
                  {(op.anexos || []).length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#a3937a", marginBottom: 10 }}>Nenhum arquivo anexado a este pedido ainda.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                      {op.anexos.map(a => (
                        <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                          {a.tipo && a.tipo.startsWith("image/") ? (
                            <a href={a.dataUrl} download={a.nome}><img src={a.dataUrl} alt={a.nome} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} /></a>
                          ) : a.tipo && a.tipo.startsWith("video/") ? (
                            <video src={a.dataUrl} controls style={{ width: "100%", height: 80, objectFit: "cover", display: "block", background: "#000" }} />
                          ) : (
                            <a href={a.dataUrl} download={a.nome} style={{ width: "100%", height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#a3937a" }}><Paperclip size={22} /></a>
                          )}
                          <div style={{ fontSize: 9.5, color: "#6b5d49", padding: "3px 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                          <button onClick={(e) => { e.stopPropagation(); removerAnexoOP(op, a.id); }} style={{ position: "absolute", top: 3, right: 3, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setAnexandoOPId(op.id); anexoOPInputRef.current && anexoOPInputRef.current.click(); }} style={{
                    fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
                  }}><Paperclip size={14} /> Anexar imagem ou vídeo</button>
                </div>
              )}

              {expandido && abaDetalheOP === "atividades" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
                {cronograma.map((passo, i) => {
                  const chave = `${op.id}:${i}`;
                  const registrosDaEtapa = registros.filter(r => r.ordemProducaoId === op.id && r.ordemEtapaIndex === i);
                  const abertosDaEtapa = registrosDaEtapa.filter(r => r.status === "aberto");
                  const concluidosDaEtapa = registrosDaEtapa.filter(r => r.status === "concluido");
                  const quantidadeConcluida = concluidosDaEtapa.reduce((s, r) => s + (r.quantidadeBoa ?? r.quantidade ?? 0), 0);
                  const quantidadeAlocadaAberta = abertosDaEtapa.reduce((s, r) => s + (r.quantidade ?? 0), 0);
                  // Corrigido: uma etapa "por peça" agora pode ser dividida
                  // entre mais de um colaborador/dia — o saldo que ainda
                  // não foi nem concluído nem alocado num registro em
                  // aberto continua disponível pra "Iniciar" de novo.
                  const saldoRestante = Math.max(0, Math.round((passo.quantidade - quantidadeConcluida - quantidadeAlocadaAberta) * 1000) / 1000);
                  const setorObj = setores.find(s => s.id === passo.setorId);
                  const emAndamento = abertosDaEtapa.length > 0;
                  // Adicionado: na etapa de Preparação, mostra a lista de
                  // materiais necessários pra essa quantidade — cruza a
                  // ficha de consumo do produto (Cadastros → Produtos)
                  // com a quantidade pedida nessa etapa da OP, pra quem
                  // for separar os materiais já saber quanto pegar.
                  const ehPreparacao = (passo.setorNomeSnap || "").toLowerCase().includes("preparaç") || (passo.setorNomeSnap || "").toLowerCase().includes("preparac");
                  const materiaisNecessarios = ehPreparacao
                    ? (consumosMaterial || []).filter(c => c.produtoId === passo.produtoId).map(c => {
                        const material = (materiais || []).find(m => m.id === c.materialId);
                        return {
                          id: c.id, nome: material?.nome || "—", unidade: material?.unidade || "",
                          quantidadeNecessaria: Math.round((c.quantidadePorPeca || 0) * passo.quantidade * 1000) / 1000,
                        };
                      })
                    : [];
                  return (
                    <div key={i} style={{
                      borderRadius: 8, padding: "8px 10px",
                      background: passo.concluida ? "#e6f4ec" : emAndamento ? "#fdf3e0" : "#f7f2e6",
                      border: passo.concluida ? "1px solid #bfe3cf" : emAndamento ? "1px solid #f2ddab" : "1px solid #efe8d8",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: passo.concluida ? "#1a7a4c" : emAndamento ? "#8a6510" : "#2a2015" }}>
                            {passo.concluida ? "✓ " : ""}{i + 1}. {passo.etapaNomeSnap} <span style={{ fontWeight: 500, color: "#a3937a" }}>({passo.setorNomeSnap} · {passo.produtoNomeSnap})</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#a3937a" }}>
                            {fmtSec(passo.duracaoEstimadaSeg)} · prev. {passo.inicioPlanejado.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {passo.inicioPlanejado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {!passo.concluida && (quantidadeConcluida > 0 || quantidadeAlocadaAberta > 0) && ` · ${quantidadeConcluida}/${passo.quantidade} peças concluídas`}
                          </div>
                        </div>
                        {passo.concluida ? (
                          <StatusDot cor="verde" />
                        ) : saldoRestante <= 0 ? (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a6510" }}>Em aberto</span>
                        ) : (
                          <button onClick={() => setIniciandoChave(iniciandoChave === chave ? null : chave)} style={{
                            fontSize: 11.5, fontWeight: 700, color: "#fff", background: "#2f4a63", border: "none",
                            borderRadius: 7, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                          }}>
                            <Play size={12} /> {quantidadeConcluida > 0 || quantidadeAlocadaAberta > 0 ? `Iniciar restante (${saldoRestante})` : "Iniciar"}
                          </button>
                        )}
                      </div>
                      {materiaisNecessarios.length > 0 && (() => {
                        // Adicionado: checklist de separação — cada material
                        // pode ser marcado como separado, e a marcação fica
                        // salva na própria etapa da OP (persiste ao recarregar
                        // e é vista por qualquer pessoa que abrir a ordem).
                        const separados = passo.materiaisSeparados || [];
                        const totalSeparados = materiaisNecessarios.filter(m => separados.includes(m.id)).length;
                        const tudoSeparado = totalSeparados === materiaisNecessarios.length;
                        return (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #d9cfb7" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#6b5d49" }}>Separação de materiais para {passo.quantidade} peças</span>
                              <span style={{
                                fontSize: 10.5, fontWeight: 700, padding: "2px 8px 2px 7px", borderRadius: "3px 8px 8px 3px",
                                color: tudoSeparado ? "#1a7a4c" : "#8a6510", background: tudoSeparado ? "#e6f4ec" : "#fdf3e0",
                                border: `1px dashed ${tudoSeparado ? "#1a7a4c" : "#b5820a"}`,
                              }}>
                                {tudoSeparado ? "✓ tudo separado" : `${totalSeparados}/${materiaisNecessarios.length} separados`}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {materiaisNecessarios.map(m => {
                                const marcado = separados.includes(m.id);
                                return (
                                  <label key={m.id} style={{
                                    display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                                    background: marcado ? "#e6f4ec" : "#fff", border: `1px solid ${marcado ? "#bfe3cf" : "#e6ddc8"}`,
                                    borderRadius: 7, padding: "6px 9px",
                                  }}>
                                    <input
                                      type="checkbox" checked={marcado}
                                      onChange={() => alternarMaterialSeparado(op, i, m.id)}
                                      style={{ width: 16, height: 16, flexShrink: 0 }}
                                    />
                                    <span style={{ flex: 1, fontSize: 12, color: "#2a2015", textDecoration: marcado ? "line-through" : "none", opacity: marcado ? 0.65 : 1 }}>{m.nome}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: marcado ? "#1a7a4c" : "#2a2015" }}>{m.quantidadeNecessaria} {m.unidade}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      {abertosDaEtapa.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                          {abertosDaEtapa.map(r => (
                            <div key={r.id} style={{ fontSize: 11, color: "#8a6510" }}>
                              {(r.colaboradorIds || []).map(nomeColab).join(", ")} · {r.quantidade} peças em aberto
                            </div>
                          ))}
                        </div>
                      )}
                      {iniciandoChave === chave && (
                        <IniciarEtapaOPForm
                          passo={passo} setorObj={setorObj} quantidadeAlvo={saldoRestante}
                          colaboradores={colaboradores} equipes={equipes} equipamentos={equipamentos}
                          registros={registros} podeAutorizarCargaExtra={podeAutorizarCargaExtra} feriados={feriados}
                          onIniciar={(dadosForm) => iniciarDepartamento(op, i, dadosForm)}
                          onCancelar={() => setIniciandoChave(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </Card>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Ordens concluídas</div>
      {concluidas.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>{buscaOP ? "Nenhuma ordem concluída encontrada para essa pesquisa." : "Nenhuma ordem de produção concluída ainda."}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {concluidas.slice(0, 30).map(op => {
          const expandido = expandidoId === op.id;
          const duracaoSeg = op.concluidaEm ? (new Date(op.concluidaEm) - new Date(op.criadaEm)) / 1000 : null;
          const prazo = avaliarPrazoOP(op);
          return (
            <Card key={op.id} style={{ padding: 0, overflow: "hidden" }}>
              <div onClick={() => setExpandidoId(expandido ? null : op.id)} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  {expandido ? <ChevronUp size={16} style={{ marginTop: 2, color: "#a3937a", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ marginTop: 2, color: "#a3937a", flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>OP #{String(op.numero).padStart(3, "0")} · {op.clienteNomeSnap || "Sem cliente"}</div>
                    <div style={{ fontSize: 12, color: "#a3937a" }}>{(op.itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(", ")} · {duracaoSeg != null ? `concluída em ${fmtSec(duracaoSeg)}` : "—"}{op.anexos && op.anexos.length > 0 ? ` · 📎 ${op.anexos.length}` : ""}</div>
                    {prazo && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: prazo.color, background: prazo.bg, padding: "2px 8px", borderRadius: 999 }}>{prazo.label}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <IconButton onClick={(e) => { e.stopPropagation(); imprimirGradeOP(op); }} title="Imprimir grade da OP"><Printer size={15} /></IconButton>
                  <StatusDot cor="verde" />
                </div>
              </div>
              {expandido && (
                <div style={{ borderTop: "1px solid #efe8d8", padding: 14, background: "#faf6ec" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {op.etapas.map((passo, i) => {
                      const concluidosDaEtapa = registros.filter(r => r.ordemProducaoId === op.id && r.ordemEtapaIndex === i && r.status === "concluido");
                      const tempoTotalReal = concluidosDaEtapa.reduce((s, r) => s + (r.tempoRealSeg || 0), 0);
                      const eficienciaMedia = concluidosDaEtapa.length ? mediaEficiencia(concluidosDaEtapa.filter(r => r.eficiencia != null)) : null;
                      return (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
                          <span style={{ fontSize: 12.5, color: "#2a2015" }}>{i + 1}. {passo.etapaNomeSnap} <span style={{ color: "#a3937a" }}>({passo.produtoNomeSnap})</span></span>
                          <span style={{ fontSize: 12, color: "#6b5d49", fontWeight: 600 }}>
                            {concluidosDaEtapa.length ? `${fmtSec(tempoTotalReal)}${eficienciaMedia != null ? ` · ${Math.min(100, eficienciaMedia)}%` : ""}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Avaliação (falta, atraso, comportamento, descrição) ----------
function Avaliacao({ colaboradores, avaliacoes, onSalvarAvaliacao, onRemoverAvaliacao }) {
  const [colaboradorId, setColaboradorId] = useState("");
  const [data, setData] = useState(todayStr());
  const [temFalta, setTemFalta] = useState(false);
  const [tipoFalta, setTipoFalta] = useState("horas");
  const [qtdFalta, setQtdFalta] = useState("");
  const [temAtraso, setTemAtraso] = useState(false);
  const [minutosAtraso, setMinutosAtraso] = useState("");
  const [comportamento, setComportamento] = useState("");
  const [descricao, setDescricao] = useState("");
  // Adicionado: anexo de arquivo na avaliação (ex.: atestado médico,
  // advertência assinada, foto de uma ocorrência) — mesma mecânica de
  // anexo usada no chat e nos comentários de produção.
  const [anexosAvaliacao, setAnexosAvaliacao] = useState([]);
  const anexoAvaliacaoRef = useRef(null);

  const infoFalta = faltaInfo(tipoFalta);
  const qtdFaltaNum = parseFloat(qtdFalta || "0");
  const minutosAtrasoNum = parseFloat(minutosAtraso || "0");

  const podeSalvar = colaboradorId && data && descricao.trim().length > 0
    && (!temFalta || qtdFaltaNum > 0)
    && (!temAtraso || minutosAtrasoNum > 0);

  async function anexarNaAvaliacao(fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) { alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`); continue; }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    if (novos.length) setAnexosAvaliacao(a => [...a, ...novos]);
  }
  function removerAnexoAvaliacao(id) { setAnexosAvaliacao(a => a.filter(x => x.id !== id)); }

  async function salvar() {
    if (!podeSalvar) return;
    const registro = {
      id: uid(), colaboradorId, data,
      temFalta, tipoFalta: temFalta ? tipoFalta : null, qtdFalta: temFalta ? qtdFaltaNum : 0, unidadeFalta: temFalta ? infoFalta.unidade : null,
      pesoFalta: temFalta ? Math.round(qtdFaltaNum * infoFalta.pesoPorUnidade * 10) / 10 : 0,
      temAtraso, minutosAtraso: temAtraso ? minutosAtrasoNum : 0,
      pesoAtraso: temAtraso ? Math.max(1, Math.round(minutosAtraso / 15)) : 0,
      comportamento: comportamento || null,
      descricao: descricao.trim(),
      anexos: anexosAvaliacao,
      criadoEm: new Date().toISOString(),
    };
    await onSalvarAvaliacao(registro);
    setTemFalta(false); setQtdFalta(""); setTemAtraso(false); setMinutosAtraso(""); setComportamento(""); setDescricao(""); setAnexosAvaliacao([]);
  }
  async function excluir(id) {
    if (!window.confirm("Excluir esta avaliação?")) return;
    await onRemoverAvaliacao(id);
  }
  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Nova avaliação</div>
        {colaboradores.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "#6b5d49", background: "#f4efe2", padding: 12, borderRadius: 8 }}>Cadastre colaboradores em Cadastros antes de lançar uma avaliação.</div>
        ) : (
          <>
            <Field label="Colaborador">
              <Select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)}>
                <option value="">Selecione…</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
            <Field label="Data">
              <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Falta">
              <div style={{ display: "flex", gap: 8, marginBottom: temFalta ? 10 : 0 }}>
                <ToggleChip ativo={!temFalta} onClick={() => setTemFalta(false)}>Não houve</ToggleChip>
                <ToggleChip ativo={temFalta} colorAtivo="#b13232" onClick={() => setTemFalta(true)}>Houve falta</ToggleChip>
              </div>
              {temFalta && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    {FALTA_TIPOS.map(t => (
                      <ToggleChip key={t.key} ativo={tipoFalta === t.key} onClick={() => setTipoFalta(t.key)}>{t.label}</ToggleChip>
                    ))}
                  </div>
                  <input type="number" min="0" step={infoFalta.unidade === "hora(s)" ? "0.5" : "1"} value={qtdFalta} onChange={e => setQtdFalta(e.target.value)} placeholder={`Quantidade em ${infoFalta.unidade}`} style={inputStyle} />
                </>
              )}
            </Field>

            <Field label="Atraso">
              <div style={{ display: "flex", gap: 8, marginBottom: temAtraso ? 10 : 0 }}>
                <ToggleChip ativo={!temAtraso} onClick={() => setTemAtraso(false)}>Não houve</ToggleChip>
                <ToggleChip ativo={temAtraso} colorAtivo="#b5820a" onClick={() => setTemAtraso(true)}>Houve atraso</ToggleChip>
              </div>
              {temAtraso && (
                <input type="number" min="0" step="1" value={minutosAtraso} onChange={e => setMinutosAtraso(e.target.value)} placeholder="Minutos de atraso" style={inputStyle} />
              )}
            </Field>

            <Field label="Comportamento (opcional)">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {COMPORTAMENTO_OPCOES.map(o => (
                  <ToggleChip key={o.key} ativo={comportamento === o.key} colorAtivo={o.color} onClick={() => setComportamento(comportamento === o.key ? "" : o.key)}>{o.label}</ToggleChip>
                ))}
              </div>
            </Field>

            <Field label="Descrição da avaliação (obrigatório)">
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o contexto da avaliação" rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>

            <Field label="Anexo (opcional)">
              {anexosAvaliacao.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {anexosAvaliacao.map(a => (
                    <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
                      {a.tipo && a.tipo.startsWith("image/")
                        ? <img src={a.dataUrl} alt={a.nome} style={{ width: 56, height: 56, objectFit: "cover", display: "block" }} />
                        : <div style={{ width: 56, height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#a3937a", gap: 2 }}>
                            <Paperclip size={15} />
                            <span style={{ fontSize: 8, padding: "0 3px", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 52 }}>{a.nome}</span>
                          </div>}
                      <button onClick={() => removerAnexoAvaliacao(a.id)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(255,255,255,0.92)", border: "none", borderRadius: 999, width: 17, height: 17, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={anexoAvaliacaoRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }}
                onChange={e => { anexarNaAvaliacao(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => anexoAvaliacaoRef.current && anexoAvaliacaoRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar arquivo</button>
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Ex.: atestado, advertência assinada, foto de uma ocorrência.</div>
            </Field>

            <PrimaryButton onClick={salvar} disabled={!podeSalvar} style={{ width: "100%" }}><Plus size={16} /> Salvar avaliação</PrimaryButton>
          </>
        )}
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Avaliações registradas</div>
      {avaliacoes.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma avaliação registrada.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {avaliacoes.slice(0, 20).map(a => (
          <Card key={a.id} style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{nomeColab(a.colaboradorId)}</div>
                <div style={{ fontSize: 12, color: "#a3937a", marginTop: 2 }}>{new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {a.temFalta && <span style={{ fontSize: 11, fontWeight: 700, color: "#b13232", background: "#f8e6e6", padding: "2px 8px", borderRadius: 999 }}>Falta: {faltaInfo(a.tipoFalta).label} ({a.qtdFalta} {a.unidadeFalta})</span>}
                  {a.temAtraso && <span style={{ fontSize: 11, fontWeight: 700, color: "#b5820a", background: "#faf1dc", padding: "2px 8px", borderRadius: 999 }}>Atraso: {a.minutosAtraso}min</span>}
                  {a.comportamento && comportamentoInfo(a.comportamento) && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: comportamentoInfo(a.comportamento).color, background: comportamentoInfo(a.comportamento).bg, padding: "2px 8px", borderRadius: 999 }}>{comportamentoInfo(a.comportamento).label}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6b5d49", marginTop: 6 }}>{a.descricao}</div>
                {(a.anexos || []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {a.anexos.map(anexo => (
                      anexo.tipo && anexo.tipo.startsWith("image/")
                        ? <a key={anexo.id} href={anexo.dataUrl} download={anexo.nome}><img src={anexo.dataUrl} alt={anexo.nome} style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 6, border: "1px solid #e6ddc8", display: "block" }} /></a>
                        : <a key={anexo.id} href={anexo.dataUrl} download={anexo.nome} style={{ fontSize: 11, color: "#2f4a63", border: "1px solid #e6ddc8", borderRadius: 6, padding: "4px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Paperclip size={11} /> {anexo.nome}</a>
                    ))}
                  </div>
                )}
              </div>
              <IconButton onClick={() => excluir(a.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Estúdio de posicionamento (encaixa a arte do cliente na foto
// do produto, com perspectiva) ----------
// Adicionado: não é uma simulação 3D de verdade (isso exigiria modelo 3D
// da peça, que o sistema não tem) — é um "warp" de perspectiva: a arte é
// deformada para encaixar no quadrilátero que o solicitante desenha por
// cima da foto, arrastando os 4 cantos com o mouse. Como o canvas 2D só
// faz transformações afins (sem perspectiva), a arte é desenhada em uma
// malha de pequenos triângulos, cada um com sua própria transformação
// afim — a técnica padrão para simular um warp de perspectiva sem WebGL.

// Mapeia o quadrado unitário (0,0)-(1,0)-(1,1)-(0,1) para um
// quadrilátero qualquer — fórmula clássica de "unit square to quad"
// (Heckbert). Usada porque a origem (a arte) sempre parte de um
// retângulo simples; só o destino (o que o usuário desenhou) é livre.
function mapaQuadrilatero(quad) {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) > 1e-9) {
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dy1 * dx3) / den;
    }
  }
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y,
    g, h,
  };
}
function aplicarMapaQuad(coef, u, v) {
  const denom = coef.g * u + coef.h * v + 1;
  return { x: (coef.a * u + coef.b * v + coef.c) / denom, y: (coef.d * u + coef.e * v + coef.f) / denom };
}
// Resolve o sistema 3x3 M·x = b por Cramer — usado para achar a
// transformação afim que leva um triângulo de origem a um de destino.
function resolverSistema3x3(M, b) {
  const det3 = (m) => (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
  const D = det3(M);
  if (Math.abs(D) < 1e-9) return null;
  const substituir = (col) => M.map((linha, i) => linha.map((v, j) => j === col ? b[i] : v));
  return [det3(substituir(0)) / D, det3(substituir(1)) / D, det3(substituir(2)) / D];
}
function afimDeTriangulo(S0, S1, S2, D0, D1, D2) {
  const M = [[S0.x, S0.y, 1], [S1.x, S1.y, 1], [S2.x, S2.y, 1]];
  const solX = resolverSistema3x3(M, [D0.x, D1.x, D2.x]);
  const solY = resolverSistema3x3(M, [D0.y, D1.y, D2.y]);
  if (!solX || !solY) return null;
  return [solX[0], solY[0], solX[1], solY[1], solX[2], solY[2]];
}
function desenharTrianguloWarp(ctx, img, S0, S1, S2, D0, D1, D2) {
  const m = afimDeTriangulo(S0, S1, S2, D0, D1, D2);
  if (!m) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(D0.x, D0.y); ctx.lineTo(D1.x, D1.y); ctx.lineTo(D2.x, D2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(...m);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
// Desenha a imagem `img` inteira deformada para caber no quadrilátero
// `quad` (4 pontos, na ordem: topo-esq, topo-dir, baixo-dir, baixo-esq),
// subdividindo em uma malha `grid` x `grid` de triângulos.
function desenharLogoWarpeada(ctx, img, quad, grid) {
  const coef = mapaQuadrilatero(quad);
  const passo = 1 / grid;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const u0 = i * passo, u1 = (i + 1) * passo, v0 = j * passo, v1 = (j + 1) * passo;
      const P00 = aplicarMapaQuad(coef, u0, v0), P10 = aplicarMapaQuad(coef, u1, v0);
      const P11 = aplicarMapaQuad(coef, u1, v1), P01 = aplicarMapaQuad(coef, u0, v1);
      const S00 = { x: u0 * img.width, y: v0 * img.height }, S10 = { x: u1 * img.width, y: v0 * img.height };
      const S11 = { x: u1 * img.width, y: v1 * img.height }, S01 = { x: u0 * img.width, y: v1 * img.height };
      desenharTrianguloWarp(ctx, img, S00, S10, S11, P00, P10, P11);
      desenharTrianguloWarp(ctx, img, S00, S11, S01, P00, P11, P01);
    }
  }
}
const LARGURA_EDICAO_MOCKUP = 320;
function carregarImagemDeDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Adicionado: em vez de pedir upload próprio dentro da ferramenta, o
// Estúdio de posicionamento usa direto as fotos do produto e as artes do
// cliente que já foram anexadas mais acima no formulário — escolhe uma
// de cada (se houver mais de uma) e arrasta os 4 cantos com o mouse.
function EstudioPosicionamento({ fotosProduto, arquivosLogo, tamanhoEstampa, onSalvar }) {
  const fotosImagem = (fotosProduto || []).filter(a => a.tipo && a.tipo.startsWith("image/"));
  const logosImagem = (arquivosLogo || []).filter(a => a.tipo && a.tipo.startsWith("image/"));
  const [fotoId, setFotoId] = useState("");
  const [logoId, setLogoId] = useState("");
  const [imagemProduto, setImagemProduto] = useState(null);
  const [logo, setLogo] = useState(null);
  const [cantos, setCantos] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [salvo, setSalvo] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (fotosImagem.length > 0 && !fotosImagem.some(a => a.id === fotoId)) setFotoId(fotosImagem[0].id);
    if (logosImagem.length > 0 && !logosImagem.some(a => a.id === logoId)) setLogoId(logosImagem[0].id);
  }, [fotosImagem, logosImagem]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const arquivo = fotosImagem.find(a => a.id === fotoId);
    if (!arquivo) { setImagemProduto(null); return; }
    let vivo = true;
    carregarImagemDeDataUrl(arquivo.dataUrl).then(img => { if (vivo) { setImagemProduto(img); setCantos(null); } });
    return () => { vivo = false; };
  }, [fotoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const arquivo = logosImagem.find(a => a.id === logoId);
    if (!arquivo) { setLogo(null); return; }
    let vivo = true;
    carregarImagemDeDataUrl(arquivo.dataUrl).then(img => { if (vivo) { setLogo(img); setCantos(null); } });
    return () => { vivo = false; };
  }, [logoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const alturaEdicao = imagemProduto ? Math.round(LARGURA_EDICAO_MOCKUP * imagemProduto.height / imagemProduto.width) : 0;

  // Posição inicial da arte: um retângulo no centro da foto, na
  // proporção do campo "Tamanho da estampa/logo" (ex.: "20 x 15 cm"),
  // quando preenchido — em vez de sempre um quadrado genérico. O
  // reposicionamento com o mouse continua livre depois disso.
  useEffect(() => {
    if (imagemProduto && logo && !cantos && alturaEdicao > 0) {
      const medida = (tamanhoEstampa || "").match(/(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)/);
      const proporcao = medida
        ? parseFloat(medida[1].replace(",", ".")) / parseFloat(medida[2].replace(",", "."))
        : (logo.width / logo.height) || 1;
      let w = LARGURA_EDICAO_MOCKUP * 0.4, h = w / proporcao;
      const alturaMax = alturaEdicao * 0.8;
      if (h > alturaMax) { w *= alturaMax / h; h = alturaMax; }
      const cx = LARGURA_EDICAO_MOCKUP / 2, cy = alturaEdicao / 2;
      setCantos([
        { x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 },
      ]);
    }
  }, [imagemProduto, logo, cantos, alturaEdicao, tamanhoEstampa]);

  useEffect(() => {
    if (!imagemProduto || !canvasRef.current || alturaEdicao === 0) return;
    const canvas = canvasRef.current;
    canvas.width = LARGURA_EDICAO_MOCKUP; canvas.height = alturaEdicao;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imagemProduto.img, 0, 0, canvas.width, canvas.height);
    if (logo && cantos) {
      desenharLogoWarpeada(ctx, logo.img, cantos, 18);
      ctx.beginPath();
      ctx.moveTo(cantos[0].x, cantos[0].y);
      cantos.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
      ctx.strokeStyle = "rgba(47,74,99,0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      cantos.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#2f4a63";
        ctx.stroke();
      });
    }
  }, [imagemProduto, logo, cantos, alturaEdicao]);

  function posicaoDoEvento(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const ponto = e.touches && e.touches[0] ? e.touches[0] : e;
    return {
      x: (ponto.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (ponto.clientY - rect.top) * (canvasRef.current.height / rect.height),
    };
  }
  function aoPressionar(e) {
    if (!cantos) return;
    const pos = posicaoDoEvento(e);
    const idx = cantos.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 18);
    if (idx >= 0) { setArrastando(idx); e.preventDefault(); }
  }
  function aoMover(e) {
    if (arrastando == null) return;
    e.preventDefault();
    const pos = posicaoDoEvento(e);
    setCantos(atual => atual.map((p, i) => i === arrastando
      ? { x: Math.max(0, Math.min(LARGURA_EDICAO_MOCKUP, pos.x)), y: Math.max(0, Math.min(alturaEdicao, pos.y)) }
      : p));
  }
  function aoSoltar() { setArrastando(null); }

  function salvarComposicao() {
    if (!imagemProduto || !logo || !cantos) return;
    // Refaz o desenho na resolução real da foto (não na de exibição),
    // pra sair com qualidade melhor no anexo salvo.
    const escala = imagemProduto.width / LARGURA_EDICAO_MOCKUP;
    const cantosReais = cantos.map(p => ({ x: p.x * escala, y: p.y * escala }));
    const canvasFinal = document.createElement("canvas");
    canvasFinal.width = imagemProduto.width; canvasFinal.height = imagemProduto.height;
    const ctx = canvasFinal.getContext("2d");
    ctx.drawImage(imagemProduto.img, 0, 0);
    desenharLogoWarpeada(ctx, logo.img, cantosReais, 24);
    onSalvar({ id: uid(), nome: `mockup-${Date.now()}.png`, tipo: "image/png", dataUrl: canvasFinal.toDataURL("image/png") });
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  if (fotosImagem.length === 0 || logosImagem.length === 0) {
    return (
      <Card style={{ marginTop: 4, marginBottom: 14, background: "#faf6ec" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1c2b39", marginBottom: 4 }}>Posicionar arte na foto (opcional)</div>
        <div style={{ fontSize: 11.5, color: "#6b5d49" }}>
          Envie uma foto do produto e um arquivo de imagem da arte do cliente (PNG/JPG) acima pra poder posicionar com o mouse.
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: 4, marginBottom: 14, background: "#faf6ec" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1c2b39", marginBottom: 4 }}>Posicionar arte na foto (opcional)</div>
      <div style={{ fontSize: 11.5, color: "#6b5d49", marginBottom: 10 }}>
        Escolha a foto do produto e a arte do cliente, depois arraste os 4 cantos com o mouse até encaixar na posição e na perspectiva do produto. Não é uma simulação 3D — é um posicionamento com perspectiva sobre a própria foto.
      </div>
      {(fotosImagem.length > 1 || logosImagem.length > 1) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <Field label="Foto do produto">
            <Select value={fotoId} onChange={e => setFotoId(e.target.value)}>
              {fotosImagem.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
          <Field label="Arte do cliente">
            <Select value={logoId} onChange={e => setLogoId(e.target.value)}>
              {logosImagem.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </Select>
          </Field>
        </div>
      )}
      {imagemProduto && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <canvas
            ref={canvasRef}
            style={{ width: LARGURA_EDICAO_MOCKUP, height: alturaEdicao, borderRadius: 8, border: "1px solid #e6ddc8", touchAction: "none", cursor: arrastando != null ? "grabbing" : logo ? "grab" : "default" }}
            onMouseDown={aoPressionar} onMouseMove={aoMover} onMouseUp={aoSoltar} onMouseLeave={aoSoltar}
            onTouchStart={aoPressionar} onTouchMove={aoMover} onTouchEnd={aoSoltar}
          />
        </div>
      )}
      {imagemProduto && logo && (
        <PrimaryButton onClick={salvarComposicao} style={{ width: "100%" }}>
          <Check size={16} /> {salvo ? "Salvo ✓" : "Salvar posicionamento"}
        </PrimaryButton>
      )}
    </Card>
  );
}

// ---------- Criação (solicitação de arte) ----------
// Adicionado: fila de solicitações de arte para o(a) arte-finalista,
// seguindo um modelo fixo de informações (cliente, produtos, medidas,
// personalização, arquivos, texto e observações) — o mesmo modelo que
// já era usado manualmente para pedir arte pelo grupo, agora dentro do
// sistema. Cada solicitação pode ser copiada como texto pronto (no
// mesmo formato) ou impressa trazendo a grade de informações + os
// arquivos do produto e do cliente.
const TIPOS_PERSONALIZACAO = ["Silk", "Bordado", "Sublimação", "Outro"];
// Corrigido: lista de locais de personalização ampliada, incluindo
// posições mais específicas (lateral, centralizado, cantos).
const LOCAIS_PERSONALIZACAO = ["Frente", "Costas", "Manga", "Bolso", "Lateral", "Centralizado", "Canto superior direito", "Canto superior esquerdo", "Outro"];

function resumoItens(itens) {
  return (itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(", ") || "—";
}

function gerarTextoSolicitacaoArte(s) {
  const personalizacao = s.tipoPersonalizacao === "Outro" ? (s.tipoPersonalizacaoOutro || "Outro") : (s.tipoPersonalizacao || "—");
  const local = s.localPersonalizacao === "Outro" ? (s.localPersonalizacaoOutro || "Outro") : (s.localPersonalizacao || "—");
  const linhas = [
    "📌 SOLICITAÇÃO DE ARTE", "",
    `👤 Cliente: ${s.clienteNomeSnap || "—"}`,
    "📦 Produto(s):",
    ...(s.itens || []).map(it => ` - ${it.produtoNomeSnap} — ${it.quantidade}`),
    `📏 Tamanho/medida do produto: ${s.tamanhoProduto || "—"}`,
    `🎨 Cor do produto: ${s.corProduto || "—"}`,
    `🧵 Tecido/material: ${s.tecidoMaterial || "—"}`,
    `🖨️ Tipo de personalização: ${personalizacao}`,
    `📍 Local da personalização: ${local}`,
    `📐 Tamanho da estampa/logo: ${s.tamanhoEstampa || "—"}`,
    `🎨 Cor da estampa: ${s.corEstampa || "—"}`, "",
    "🖼️ FOTO DO PRODUTO:",
    (s.fotosProduto || []).length > 0 ? `${s.fotosProduto.length} arquivo(s) anexado(s).` : "Nenhuma foto anexada ainda.", "",
    "🖼️ LOGO/ARQUIVO DO CLIENTE:",
    (s.arquivosLogo || []).length > 0 ? `${s.arquivosLogo.length} arquivo(s) anexado(s) na solicitação.` : "Nenhum arquivo anexado ainda.", "",
    "✍️ TEXTO QUE DEVE ENTRAR NA ARTE:",
    s.textoArte || "—", "",
    "📷 REFERÊNCIA:",
    (s.arquivosReferencia || []).length > 0 ? `${s.arquivosReferencia.length} arquivo(s) anexado(s).` : "Nenhuma referência anexada.", "",
    "📝 OBSERVAÇÕES DO CLIENTE:",
    s.observacoesCliente || "—",
  ];
  return linhas.join("\n");
}
function gerarTextoAlteracaoArte(s) {
  const linhas = [
    "📌 ALTERAÇÃO DE ARTE", "",
    `👤 Cliente: ${s.clienteNomeSnap || "—"}`,
    "📦 Produto(s):",
    ...(s.itens || []).map(it => ` - ${it.produtoNomeSnap} — ${it.quantidade}`), "",
    "✏️ O QUE PRECISA SER ALTERADO:",
    s.descricaoAlteracao || "—",
  ];
  if ((s.observacoesCliente || "").trim()) linhas.push("", "📝 OBSERVAÇÕES:", s.observacoesCliente);
  return linhas.join("\n");
}
async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch (e) {
    return false;
  }
}

function Criacao({ solicitacoes, onSalvarSolicitacao, onRemoverSolicitacao, produtos, setProdutos, clientes, setClientes, onImprimirGrade }) {
  const [ehAlteracao, setEhAlteracao] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  // Adicionado: agora dá pra pedir arte para mais de um produto na mesma
  // solicitação, cada um com sua própria quantidade — mesmo padrão de
  // "itens" já usado nas Ordens de Produção.
  const [itens, setItens] = useState([]);
  const [produtoParaAdicionar, setProdutoParaAdicionar] = useState("");
  const [quantidadeParaAdicionar, setQuantidadeParaAdicionar] = useState("");
  const [novoProdutoAberto, setNovoProdutoAberto] = useState(false);
  const [novoProdutoNome, setNovoProdutoNome] = useState("");
  // Nova arte
  const [tamanhoProduto, setTamanhoProduto] = useState("");
  const [corProduto, setCorProduto] = useState("");
  const [tecidoMaterial, setTecidoMaterial] = useState("");
  const [tipoPersonalizacao, setTipoPersonalizacao] = useState("");
  const [tipoPersonalizacaoOutro, setTipoPersonalizacaoOutro] = useState("");
  const [localPersonalizacao, setLocalPersonalizacao] = useState("");
  const [localPersonalizacaoOutro, setLocalPersonalizacaoOutro] = useState("");
  const [tamanhoEstampa, setTamanhoEstampa] = useState("");
  const [corEstampa, setCorEstampa] = useState("");
  // Adicionado: foto do produto — separada do arquivo do cliente — usada
  // tanto na impressão quanto no Estúdio de posicionamento.
  const [fotosProduto, setFotosProduto] = useState([]);
  const fotoProdutoRef = useRef(null);
  const [arquivosLogo, setArquivosLogo] = useState([]);
  const arquivoLogoRef = useRef(null);
  const [mockupsGerados, setMockupsGerados] = useState([]);
  const [textoArte, setTextoArte] = useState("");
  const [arquivosReferencia, setArquivosReferencia] = useState([]);
  const arquivoReferenciaRef = useRef(null);
  const [observacoesCliente, setObservacoesCliente] = useState("");
  // Alteração de arte
  const [descricaoAlteracao, setDescricaoAlteracao] = useState("");

  const [busca, setBusca] = useState("");
  const [expandidoId, setExpandidoId] = useState(null);
  const [copiadoId, setCopiadoId] = useState(null);

  async function criarClienteRapido(nomeBruto, aoCriar) {
    const nomeCriado = nomeBruto.trim();
    if (!nomeCriado) return;
    const existente = (clientes || []).find(c => c.nome.trim().toLowerCase() === nomeCriado.toLowerCase());
    if (existente) { aoCriar(existente.id); return; }
    const novo = { id: uid(), nome: nomeCriado, contato: "", observacao: "" };
    await setClientes([...(clientes || []), novo]);
    aoCriar(novo.id);
  }
  async function criarProduto() {
    if (!novoProdutoNome.trim()) return;
    const sequencia = produtos.reduce((max, p) => Math.max(max, p.sequencia || 0), 0) + 1;
    // Adicionado rapidamente por aqui, sem grupo/tecido/tamanho — por isso
    // ainda não tem um código completo (isso fica pendente até alguém
    // terminar o cadastro em Cadastros → Produtos).
    const p = { id: uid(), sequencia, codigo: null, nome: novoProdutoNome.trim().toUpperCase() };
    await setProdutos([...produtos, p]);
    setProdutoParaAdicionar(p.id);
    setNovoProdutoNome(""); setNovoProdutoAberto(false);
  }
  const produtosDisponiveisParaAdicionar = useMemo(
    () => [...produtos].sort((a, b) => a.nome.localeCompare(b.nome)).filter(p => !itens.some(it => it.produtoId === p.id)),
    [produtos, itens]
  );
  const qtdParaAdicionarNum = parseInt(quantidadeParaAdicionar || "0", 10);
  const podeAdicionarItem = !!produtoParaAdicionar && qtdParaAdicionarNum > 0;
  function adicionarItem() {
    if (!podeAdicionarItem) return;
    const produto = produtos.find(p => p.id === produtoParaAdicionar);
    setItens(atual => [...atual, { produtoId: produtoParaAdicionar, produtoNomeSnap: produto?.nome || "—", quantidade: qtdParaAdicionarNum }]);
    setProdutoParaAdicionar(""); setQuantidadeParaAdicionar("");
  }
  function removerItem(produtoId) { setItens(atual => atual.filter(it => it.produtoId !== produtoId)); }

  async function lerArquivos(fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) { alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`); continue; }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    return novos;
  }
  async function anexarFotoProduto(fileList) { const novos = await lerArquivos(fileList); if (novos.length) setFotosProduto(a => [...a, ...novos]); }
  async function anexarLogo(fileList) { const novos = await lerArquivos(fileList); if (novos.length) setArquivosLogo(a => [...a, ...novos]); }
  async function anexarReferencia(fileList) { const novos = await lerArquivos(fileList); if (novos.length) setArquivosReferencia(a => [...a, ...novos]); }
  function removerFotoProduto(id) { setFotosProduto(a => a.filter(x => x.id !== id)); }
  function removerArquivoLogo(id) { setArquivosLogo(a => a.filter(x => x.id !== id)); }
  function removerArquivoReferencia(id) { setArquivosReferencia(a => a.filter(x => x.id !== id)); }
  function removerMockup(id) { setMockupsGerados(a => a.filter(x => x.id !== id)); }

  // Adicionado: cliente e ao menos 1 produto (com quantidade) são
  // obrigatórios sempre — pra alteração de arte, também é preciso
  // descrever claramente o que precisa mudar.
  const podeCriar = !!clienteId && itens.length > 0 && (!ehAlteracao || descricaoAlteracao.trim().length > 0);

  function limparFormulario() {
    setClienteId(""); setItens([]); setProdutoParaAdicionar(""); setQuantidadeParaAdicionar("");
    setTamanhoProduto(""); setCorProduto(""); setTecidoMaterial("");
    setTipoPersonalizacao(""); setTipoPersonalizacaoOutro("");
    setLocalPersonalizacao(""); setLocalPersonalizacaoOutro("");
    setTamanhoEstampa(""); setCorEstampa("");
    setFotosProduto([]); setArquivosLogo([]); setMockupsGerados([]);
    setTextoArte(""); setArquivosReferencia([]); setObservacoesCliente("");
    setDescricaoAlteracao(""); setEhAlteracao(false);
  }

  async function criarSolicitacao() {
    if (!podeCriar) return;
    const cliente = (clientes || []).find(c => c.id === clienteId);
    // Adicionado: numeração sequencial da fila — sempre o maior número já
    // usado + 1, igual às Ordens de Produção.
    const numero = solicitacoes.reduce((max, s) => Math.max(max, s.numero || 0), 0) + 1;
    const nova = {
      id: uid(), numero,
      ehAlteracao,
      clienteId, clienteNomeSnap: cliente?.nome || "—",
      itens,
      status: "pendente",
      ...(ehAlteracao ? {
        descricaoAlteracao: descricaoAlteracao.trim(),
        observacoesCliente: observacoesCliente.trim(),
        arquivosReferencia,
      } : {
        tamanhoProduto: tamanhoProduto.trim(), corProduto: corProduto.trim(), tecidoMaterial: tecidoMaterial.trim(),
        tipoPersonalizacao, tipoPersonalizacaoOutro: tipoPersonalizacaoOutro.trim(),
        localPersonalizacao, localPersonalizacaoOutro: localPersonalizacaoOutro.trim(),
        tamanhoEstampa: tamanhoEstampa.trim(), corEstampa: corEstampa.trim(),
        fotosProduto, arquivosLogo, mockupsGerados,
        textoArte: textoArte.trim(), arquivosReferencia, observacoesCliente: observacoesCliente.trim(),
      }),
      criadaEm: new Date().toISOString(), concluidaEm: null,
    };
    await onSalvarSolicitacao(nova);
    limparFormulario();
  }

  async function alternarConcluida(s) {
    await onSalvarSolicitacao({
      ...s,
      status: s.status === "concluida" ? "pendente" : "concluida",
      concluidaEm: s.status === "concluida" ? null : new Date().toISOString(),
    });
  }
  async function excluir(id) {
    if (!window.confirm("Excluir esta solicitação?")) return;
    await onRemoverSolicitacao(id);
  }
  async function aoCopiar(s) {
    const texto = s.ehAlteracao ? gerarTextoAlteracaoArte(s) : gerarTextoSolicitacaoArte(s);
    const ok = await copiarTexto(texto);
    if (ok) { setCopiadoId(s.id); setTimeout(() => setCopiadoId(null), 2000); }
    else alert("Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.");
  }
  // Adicionado: impressão trazendo a grade de informações (com o nome do
  // cliente na primeira linha) e, em folha separada, os arquivos do
  // produto + do cliente — reaproveita o mesmo impresso já usado pelas
  // Ordens de Produção.
  function imprimirSolicitacao(s) {
    const linhas = [
      { campo: "Cliente", valor: s.clienteNomeSnap || "—" },
      { campo: "Produto(s)", valor: resumoItens(s.itens) },
    ];
    if (s.ehAlteracao) {
      linhas.push({ campo: "O que precisa ser alterado", valor: s.descricaoAlteracao || "—" });
    } else {
      linhas.push(
        { campo: "Tamanho/medida do produto", valor: s.tamanhoProduto || "—" },
        { campo: "Cor do produto", valor: s.corProduto || "—" },
        { campo: "Tecido/material", valor: s.tecidoMaterial || "—" },
        { campo: "Tipo de personalização", valor: (s.tipoPersonalizacao === "Outro" ? s.tipoPersonalizacaoOutro : s.tipoPersonalizacao) || "—" },
        { campo: "Local da personalização", valor: (s.localPersonalizacao === "Outro" ? s.localPersonalizacaoOutro : s.localPersonalizacao) || "—" },
        { campo: "Tamanho da estampa/logo", valor: s.tamanhoEstampa || "—" },
        { campo: "Cor da estampa", valor: s.corEstampa || "—" },
        { campo: "Texto que deve entrar na arte", valor: s.textoArte || "—" },
      );
    }
    if ((s.observacoesCliente || "").trim()) linhas.push({ campo: "Observações do cliente", valor: s.observacoesCliente });
    const anexos = [...(s.fotosProduto || []), ...(s.arquivosLogo || []), ...(s.mockupsGerados || []), ...(s.arquivosReferencia || [])];
    onImprimirGrade({
      titulo: `${s.ehAlteracao ? "Alteração" : "Solicitação"} de arte #${String(s.numero).padStart(3, "0")} — ${s.clienteNomeSnap || "Sem cliente"}`,
      subtitulo: resumoItens(s.itens),
      geradoEm: new Date().toLocaleString("pt-BR"),
      orientacao: "retrato",
      colunas: [{ key: "campo", label: "Campo" }, { key: "valor", label: "Informação" }],
      linhas,
      anexos,
    });
  }

  const filtradas = solicitacoes.filter(s => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return true;
    return (s.itens || []).some(it => (it.produtoNomeSnap || "").toLowerCase().includes(termo)) || (s.clienteNomeSnap || "").toLowerCase().includes(termo) || `#${String(s.numero).padStart(3, "0")}`.includes(termo);
  });
  const pendentes = [...filtradas.filter(s => s.status !== "concluida")].sort((a, b) => (a.numero || 0) - (b.numero || 0));
  const concluidas = [...filtradas.filter(s => s.status === "concluida")].sort((a, b) => new Date(b.concluidaEm || 0) - new Date(a.concluidaEm || 0));

  function renderGaleriaAnexo(arquivos, onRemover) {
    if (arquivos.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {arquivos.map(a => (
          <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
            {a.tipo && a.tipo.startsWith("image/")
              ? <img src={a.dataUrl} alt={a.nome} style={{ width: 56, height: 56, objectFit: "cover", display: "block" }} />
              : <div style={{ width: 56, height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#a3937a", gap: 2 }}>
                  <Paperclip size={15} />
                  <span style={{ fontSize: 8, padding: "0 3px", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 52 }}>{a.nome}</span>
                </div>}
            <button onClick={() => onRemover(a.id)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(255,255,255,0.92)", border: "none", borderRadius: 999, width: 17, height: 17, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
          </div>
        ))}
      </div>
    );
  }

  function renderGaleriaVisualizacao(titulo, arquivos) {
    if (!arquivos || arquivos.length === 0) return null;
    return (
      <>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6b5d49", marginTop: 10 }}>{titulo}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 4 }}>
          {arquivos.map(a => (
            a.tipo && a.tipo.startsWith("image/")
              ? <a key={a.id} href={a.dataUrl} download={a.nome}><img src={a.dataUrl} alt={a.nome} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #e6ddc8", display: "block" }} /></a>
              : <a key={a.id} href={a.dataUrl} download={a.nome} style={{ fontSize: 11, color: "#2f4a63", border: "1px solid #e6ddc8", borderRadius: 6, padding: "4px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Paperclip size={11} /> {a.nome}</a>
          ))}
        </div>
      </>
    );
  }

  function renderCardSolicitacao(s) {
    const expandido = expandidoId === s.id;
    const totalArquivos = (s.fotosProduto || []).length + (s.arquivosLogo || []).length;
    return (
      <Card key={s.id} style={{ padding: 14 }}>
        <div onClick={() => setExpandidoId(expandido ? null : s.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            {expandido ? <ChevronUp size={16} style={{ marginTop: 3, color: "#a3937a", flexShrink: 0 }} /> : <ChevronDown size={16} style={{ marginTop: 3, color: "#a3937a", flexShrink: 0 }} />}
            <div>
              {s.ehAlteracao && (
                <div style={{ display: "inline-flex", alignItems: "center", fontSize: 10.5, fontWeight: 700, color: "#b5820a", background: "#fbf0da", padding: "2px 7px", borderRadius: 999, marginBottom: 4 }}>
                  Alteração de arte
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: 14, color: "#1c2b39" }}>#{String(s.numero).padStart(3, "0")} · {resumoItens(s.itens)}</div>
              <div style={{ fontSize: 12, color: "#a3937a" }}>
                {s.clienteNomeSnap ? `${s.clienteNomeSnap} · ` : ""}criada em {new Date(s.criadaEm).toLocaleDateString("pt-BR")}{totalArquivos > 0 ? ` · 📎 ${totalArquivos}` : ""}
              </div>
            </div>
          </div>
          <StatusDot cor={s.status === "concluida" ? "verde" : "laranja"} />
        </div>
        {expandido && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#2a2015" }}>
              <div><b>Cliente:</b> {s.clienteNomeSnap || "—"}</div>
              <div><b>Produto(s):</b> {(s.itens || []).map(it => `${it.produtoNomeSnap} (${it.quantidade})`).join(", ") || "—"}</div>
              {s.ehAlteracao ? (
                <>
                  <div><b>O que precisa ser alterado:</b> <span style={{ whiteSpace: "pre-wrap" }}>{s.descricaoAlteracao}</span></div>
                  {s.observacoesCliente && <div><b>Observações:</b> {s.observacoesCliente}</div>}
                </>
              ) : (
                <>
                  {s.tamanhoProduto && <div><b>Tamanho/medida do produto:</b> {s.tamanhoProduto}</div>}
                  {s.corProduto && <div><b>Cor do produto:</b> {s.corProduto}</div>}
                  {s.tecidoMaterial && <div><b>Tecido/material:</b> {s.tecidoMaterial}</div>}
                  {s.tipoPersonalizacao && <div><b>Tipo de personalização:</b> {s.tipoPersonalizacao === "Outro" ? s.tipoPersonalizacaoOutro : s.tipoPersonalizacao}</div>}
                  {s.localPersonalizacao && <div><b>Local da personalização:</b> {s.localPersonalizacao === "Outro" ? s.localPersonalizacaoOutro : s.localPersonalizacao}</div>}
                  {s.tamanhoEstampa && <div><b>Tamanho da estampa/logo:</b> {s.tamanhoEstampa}</div>}
                  {s.corEstampa && <div><b>Cor da estampa:</b> {s.corEstampa}</div>}
                  {s.textoArte && <div><b>Texto que deve entrar na arte:</b> <span style={{ whiteSpace: "pre-wrap" }}>{s.textoArte}</span></div>}
                  {s.observacoesCliente && <div><b>Observações do cliente:</b> {s.observacoesCliente}</div>}
                </>
              )}
            </div>
            {renderGaleriaVisualizacao("Foto do produto", s.fotosProduto)}
            {renderGaleriaVisualizacao("Logo/arquivo do cliente", s.arquivosLogo)}
            {renderGaleriaVisualizacao("Posicionamento gerado", s.mockupsGerados)}
            {renderGaleriaVisualizacao("Referência", s.arquivosReferencia)}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={() => aoCopiar(s)} style={{
                flex: 1, minWidth: 120, border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "9px 10px",
                color: "#2f4a63", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Paperclip size={14} /> {copiadoId === s.id ? "Texto copiado ✓" : "Copiar texto"}
              </button>
              <IconButton onClick={() => imprimirSolicitacao(s)} title="Imprimir ordem de criação"><Printer size={15} /></IconButton>
              <PrimaryButton onClick={() => alternarConcluida(s)} style={{ flex: 1, minWidth: 140 }}>
                <Check size={16} /> {s.status === "concluida" ? "Reabrir" : "Marcar concluída"}
              </PrimaryButton>
              <IconButton onClick={() => excluir(s.id)} danger title="Excluir"><Trash2 size={16} /></IconButton>
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 6, color: "#1c2b39" }}>Nova solicitação de arte</div>
        <div style={{ fontSize: 12.5, color: "#6b5d49", marginBottom: 12 }}>
          Fila de pedidos para o(a) arte-finalista, na ordem em que chegam. Confirme com o cliente todas as informações antes de enviar — pedidos incompletos podem atrasar a criação.
        </div>
        <Field label="Tipo de pedido">
          <div style={{ display: "flex", gap: 8 }}>
            <ToggleChip ativo={!ehAlteracao} onClick={() => setEhAlteracao(false)}>Nova arte</ToggleChip>
            <ToggleChip ativo={ehAlteracao} colorAtivo="#b5820a" onClick={() => setEhAlteracao(true)}>Alteração de arte</ToggleChip>
          </div>
        </Field>

        <Field label="Cliente">
          <Select value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Selecione…</option>
            {[...(clientes || [])].sort((a, b) => a.nome.localeCompare(b.nome)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
          <button type="button" onClick={() => setNovoClienteAberto(v => !v)} style={linkButtonStyle}>
            {novoClienteAberto ? "Cancelar" : "+ Novo cliente"}
          </button>
          {novoClienteAberto && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={novoClienteNome} onChange={e => setNovoClienteNome(e.target.value)} placeholder="Nome do cliente" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarClienteRapido(novoClienteNome, id => { setClienteId(id); setNovoClienteNome(""); setNovoClienteAberto(false); })} />
              <PrimaryButton onClick={() => criarClienteRapido(novoClienteNome, id => { setClienteId(id); setNovoClienteNome(""); setNovoClienteAberto(false); })} disabled={!novoClienteNome.trim()}><Plus size={16} /></PrimaryButton>
            </div>
          )}
        </Field>

        <Field label="Produtos e quantidades">
          {produtosDisponiveisParaAdicionar.length > 0 ? (
            <>
              <div style={{ display: "flex", gap: 6 }}>
                <Select value={produtoParaAdicionar} onChange={e => setProdutoParaAdicionar(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Produto…</option>
                  {produtosDisponiveisParaAdicionar.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </Select>
                <input type="number" min="1" step="1" value={quantidadeParaAdicionar} onChange={e => setQuantidadeParaAdicionar(e.target.value)} placeholder="Qtd." style={{ ...inputStyle, width: 78 }} />
              </div>
              <button type="button" onClick={adicionarItem} disabled={!podeAdicionarItem} style={{
                marginTop: 8, width: "100%", border: "1.5px solid " + (podeAdicionarItem ? "#2f4a63" : "#d9cfb7"),
                background: podeAdicionarItem ? "#2f4a63" : "#f4efe2", color: podeAdicionarItem ? "#fff" : "#a3937a",
                borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700,
                cursor: podeAdicionarItem ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Plus size={15} /> Adicionar produto
              </button>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "#a3937a" }}>Todos os produtos cadastrados já foram adicionados.</div>
          )}
          <button type="button" onClick={() => setNovoProdutoAberto(v => !v)} style={linkButtonStyle}>
            {novoProdutoAberto ? "Cancelar" : "+ Cadastrar novo produto"}
          </button>
          {novoProdutoAberto && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={novoProdutoNome} onChange={e => setNovoProdutoNome(e.target.value)} placeholder="Nome do novo produto" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarProduto()} />
              <PrimaryButton onClick={criarProduto} disabled={!novoProdutoNome.trim()}><Plus size={16} /></PrimaryButton>
            </div>
          )}
          {itens.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {itens.map(it => (
                <div key={it.produtoId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
                  <span style={{ fontSize: 13, color: "#2a2015" }}>{it.produtoNomeSnap} — {it.quantidade} peças</span>
                  <IconButton onClick={() => removerItem(it.produtoId)} danger title="Remover"><X size={14} /></IconButton>
                </div>
              ))}
            </div>
          )}
        </Field>

        {ehAlteracao ? (
          <>
            <Field label="O que precisa ser alterado">
              <textarea value={descricaoAlteracao} onChange={e => setDescricaoAlteracao(e.target.value)} rows={3}
                placeholder={"Descreva claramente a mudança.\nEx.: Alterar a logo do peito de 10 cm para 8 cm e trocar a cor branca por dourada."}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              <div style={{ fontSize: 11, color: "#a3937a", marginTop: 4 }}>
                ❌ "Cliente pediu para mudar." — evite. ✅ Diga exatamente o que muda.
              </div>
            </Field>
            <Field label="Referência (opcional)">
              {renderGaleriaAnexo(arquivosReferencia, removerArquivoReferencia)}
              <input ref={arquivoReferenciaRef} type="file" multiple accept="image/*,.pdf" style={{ display: "none" }}
                onChange={e => { anexarReferencia(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => arquivoReferenciaRef.current && arquivoReferenciaRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar arquivo</button>
            </Field>
            <Field label="Observações (opcional)">
              <textarea value={observacoesCliente} onChange={e => setObservacoesCliente(e.target.value)} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Tamanho/medida do produto">
                <input value={tamanhoProduto} onChange={e => setTamanhoProduto(e.target.value)} placeholder="Ex.: M" style={inputStyle} />
              </Field>
              <Field label="Cor do produto">
                <input value={corProduto} onChange={e => setCorProduto(e.target.value)} placeholder="Ex.: Preto" style={inputStyle} />
              </Field>
            </div>
            <Field label="Tecido/material">
              <input value={tecidoMaterial} onChange={e => setTecidoMaterial(e.target.value)} placeholder="Ex.: Malha PV" style={inputStyle} />
            </Field>
            <Field label="Tipo de personalização">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TIPOS_PERSONALIZACAO.map(t => <ToggleChip key={t} ativo={tipoPersonalizacao === t} onClick={() => setTipoPersonalizacao(t)}>{t}</ToggleChip>)}
              </div>
              {tipoPersonalizacao === "Outro" && (
                <input value={tipoPersonalizacaoOutro} onChange={e => setTipoPersonalizacaoOutro(e.target.value)} placeholder="Qual?" style={{ ...inputStyle, marginTop: 8 }} />
              )}
            </Field>
            <Field label="Local da personalização">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {LOCAIS_PERSONALIZACAO.map(l => <ToggleChip key={l} ativo={localPersonalizacao === l} onClick={() => setLocalPersonalizacao(l)}>{l}</ToggleChip>)}
              </div>
              {localPersonalizacao === "Outro" && (
                <input value={localPersonalizacaoOutro} onChange={e => setLocalPersonalizacaoOutro(e.target.value)} placeholder="Qual?" style={{ ...inputStyle, marginTop: 8 }} />
              )}
            </Field>
            <Field label="Tamanho da estampa/logo">
              <input value={tamanhoEstampa} onChange={e => setTamanhoEstampa(e.target.value)} placeholder="Ex.: 20 x 15 cm" style={inputStyle} />
            </Field>
            <Field label="Cor da estampa">
              <input value={corEstampa} onChange={e => setCorEstampa(e.target.value)} placeholder="Ex.: Branco" style={inputStyle} />
            </Field>
            <Field label="Foto do produto">
              {renderGaleriaAnexo(fotosProduto, removerFotoProduto)}
              <input ref={fotoProdutoRef} type="file" multiple accept="image/*" style={{ display: "none" }}
                onChange={e => { anexarFotoProduto(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => fotoProdutoRef.current && fotoProdutoRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar foto</button>
            </Field>
            <Field label="Logo/arquivo do cliente">
              {renderGaleriaAnexo(arquivosLogo, removerArquivoLogo)}
              <input ref={arquivoLogoRef} type="file" multiple accept="image/*,.pdf,.ai,.eps,.cdr,.svg" style={{ display: "none" }}
                onChange={e => { anexarLogo(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => arquivoLogoRef.current && arquivoLogoRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar arquivo</button>
              <div style={{ fontSize: 11, color: "#a3937a", marginTop: 4 }}>De preferência em boa qualidade — PDF, CDR, AI, SVG ou PNG.</div>
            </Field>

            <EstudioPosicionamento
              fotosProduto={fotosProduto} arquivosLogo={arquivosLogo} tamanhoEstampa={tamanhoEstampa}
              onSalvar={arquivo => setMockupsGerados(a => [...a, arquivo])}
            />
            {renderGaleriaAnexo(mockupsGerados, removerMockup)}

            <Field label="Texto que deve entrar na arte">
              <textarea value={textoArte} onChange={e => setTextoArte(e.target.value)} rows={2}
                placeholder="Escreva exatamente como deverá aparecer" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            <Field label="Referência (opcional)">
              {renderGaleriaAnexo(arquivosReferencia, removerArquivoReferencia)}
              <input ref={arquivoReferenciaRef} type="file" multiple accept="image/*,.pdf" style={{ display: "none" }}
                onChange={e => { anexarReferencia(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => arquivoReferenciaRef.current && arquivoReferenciaRef.current.click()} style={{
                fontSize: 12.5, border: "1px dashed #cdb98a", background: "#f4ecd8", borderRadius: 7, padding: "7px 11px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#2f4a63", fontWeight: 700,
              }}><Paperclip size={14} /> Anexar arquivo</button>
              <div style={{ fontSize: 11, color: "#a3937a", marginTop: 4 }}>Foto, modelo ou exemplo que o cliente tenha enviado.</div>
            </Field>
            <Field label="Observações do cliente">
              <textarea value={observacoesCliente} onChange={e => setObservacoesCliente(e.target.value)} rows={2}
                placeholder="Qualquer detalhe adicional solicitado" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}

        <PrimaryButton onClick={criarSolicitacao} disabled={!podeCriar} style={{ width: "100%", marginTop: 4 }}>
          <Plus size={16} /> Adicionar à fila
        </PrimaryButton>
        {!podeCriar && <div style={{ fontSize: 11, color: "#a3937a", marginTop: 6, textAlign: "center" }}>{ehAlteracao ? "Selecione cliente, ao menos 1 produto e descreva o que precisa mudar." : "Selecione o cliente e ao menos 1 produto para poder adicionar."}</div>}
      </Card>

      <Card style={{ marginBottom: 16, padding: 12 }}>
        <Field label="Pesquisar">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº da solicitação, produto ou cliente…" style={inputStyle} />
        </Field>
      </Card>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Pendentes</div>
      {pendentes.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px", marginBottom: 16 }}>{busca ? "Nenhuma solicitação pendente encontrada para essa pesquisa." : "Nenhuma solicitação pendente."}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {pendentes.map(renderCardSolicitacao)}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Concluídas</div>
      {concluidas.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>{busca ? "Nenhuma solicitação concluída encontrada para essa pesquisa." : "Nenhuma solicitação concluída ainda."}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {concluidas.map(renderCardSolicitacao)}
      </div>
    </div>
  );
}
// ---------- Chat interno (conversa entre os usuários do sistema) ----------
// Adicionado: canal único de conversa entre todo mundo que usa o app —
// colaboradores, gestores e administradores. Como o armazenamento do app
// não tem um mecanismo de "tempo real", a tela busca mensagens novas a
// cada poucos segundos (function componentDidMount + intervalo) em vez de
// esperar o usuário recarregar a página.
function ChatInterno({ usuarioAtual, ehAdministrador, colaboradores }) {
  const [mensagens, setMensagens] = useState([]);
  const [carregado, setCarregado] = useState(false);
  const [texto, setTexto] = useState("");
  // Adicionado: anexos no chat — fotos, documentos ou qualquer arquivo,
  // pra mandar evidência junto com a mensagem (ex.: foto de um defeito,
  // PDF de uma ficha técnica).
  const [anexosChat, setAnexosChat] = useState([]);
  const anexoChatRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  // Adicionado: em muitas confecções o mesmo aparelho fica logado o dia
  // inteiro (ex.: um tablet fixo no chão de fábrica) — em vez de exigir
  // "trocar usuário" toda hora só pra mandar uma mensagem, este seletor
  // deixa claro de qual colaborador a mensagem está sendo enviada.
  const [remetenteSelecionado, setRemetenteSelecionado] = useState(usuarioAtual?.nome || "");
  const fimDaListaRef = useRef(null);
  const primeiraCargaRef = useRef(true);

  async function buscarMensagens() {
    try {
      const listaRes = await window.storage.list("mensagem:", true);
      const chaves = (listaRes && listaRes.keys) || [];
      const valores = (await Promise.all(chaves.map(async (k) => {
        try {
          const r = await window.storage.get(k, true);
          return r && r.value ? JSON.parse(r.value) : null;
        } catch (e) { return null; }
      }))).filter(Boolean);
      valores.sort((a, b) => new Date(a.criadoEm) - new Date(b.criadoEm));
      setMensagens(valores);
    } catch (e) {
      // sem mensagens ainda, ou falha momentânea de leitura — tenta de novo no próximo ciclo
    } finally {
      setCarregado(true);
    }
  }

  useEffect(() => {
    buscarMensagens();
    const intervalo = setInterval(buscarMensagens, 6000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fimDaListaRef.current) return;
    // Não força rolagem em toda atualização — só na primeira carga e
    // quando dá pra assumir que o usuário já está perto do fim da lista.
    const el = fimDaListaRef.current.parentElement;
    const pertoDoFim = el ? (el.scrollHeight - el.scrollTop - el.clientHeight) < 200 : true;
    if (primeiraCargaRef.current || pertoDoFim) {
      fimDaListaRef.current.scrollIntoView({ block: "end" });
    }
    primeiraCargaRef.current = false;
  }, [mensagens.length]);

  async function anexarNoChat(fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) { alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`); continue; }
      const dataUrl = await new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(file);
      });
      novos.push({ id: uid(), nome: file.name, tipo: file.type, dataUrl });
    }
    if (novos.length) setAnexosChat(a => [...a, ...novos]);
  }

  async function enviar() {
    const texto2 = texto.trim();
    // Corrigido: agora dá pra mandar só um anexo, sem escrever nada.
    if ((!texto2 && anexosChat.length === 0) || enviando) return;
    setEnviando(true);
    const nova = {
      id: uid(), autorNome: remetenteSelecionado || usuarioAtual?.nome || "Usuário", autorPerfil: usuarioAtual?.perfil || "colaborador",
      texto: texto2, anexos: anexosChat, criadoEm: new Date().toISOString(),
    };
    setMensagens(msgs => [...msgs, nova]);
    setTexto(""); setAnexosChat([]);
    try {
      await window.storage.set(`mensagem:${nova.id}`, JSON.stringify(nova), true);
    } catch (e) {
      // se falhar o envio, a próxima busca automática não vai trazer essa
      // mensagem — ela some da tela sozinha em até 6s, sem travar o chat.
    }
    setEnviando(false);
  }
  async function excluirMensagem(id) {
    if (!window.confirm("Excluir esta mensagem?")) return;
    setMensagens(msgs => msgs.filter(m => m.id !== id));
    try { await window.storage.delete(`mensagem:${id}`, true); } catch (e) {}
  }

  const labelPerfil = (p) => ({ administrador: "Administrador", gestor: "Gestor", colaborador: "Colaborador" }[p] || "");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 190px)" }}>
      <div style={{ fontSize: 12, color: "#a3937a", marginBottom: 8 }}>
        Conversa interna entre todo mundo que usa o sistema — some a cada mensagem nova em até 6 segundos.
      </div>
      <div style={{ flex: 1, overflowY: "auto", background: "#fffdf7", border: "1px solid #e6ddc8", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {!carregado ? (
          <div style={{ fontSize: 13, color: "#a3937a", textAlign: "center", marginTop: 20 }}>Carregando conversa…</div>
        ) : mensagens.length === 0 ? (
          <div style={{ fontSize: 13, color: "#a3937a", textAlign: "center", marginTop: 20 }}>Nenhuma mensagem ainda — comece a conversa.</div>
        ) : (
          mensagens.map(m => {
            const propria = m.autorNome === remetenteSelecionado;
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: propria ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "8px 12px", borderRadius: propria ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                  background: propria ? "#2f4a63" : "#f4ecd8", color: propria ? "#fff" : "#2a2015",
                  border: propria ? "none" : "1px dashed #cdb98a",
                }}>
                  {!propria && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8a6510", marginBottom: 2 }}>
                      {m.autorNome}{labelPerfil(m.autorPerfil) ? ` · ${labelPerfil(m.autorPerfil)}` : ""}
                    </div>
                  )}
                  {m.texto && <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.texto}</div>}
                  {(m.anexos || []).length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: m.texto ? 6 : 0, flexWrap: "wrap" }}>
                      {m.anexos.map(a => (
                        a.tipo && a.tipo.startsWith("image/")
                          ? <a key={a.id} href={a.dataUrl} download={a.nome}><img src={a.dataUrl} alt={a.nome} style={{ width: 110, maxHeight: 110, objectFit: "cover", borderRadius: 6, display: "block" }} /></a>
                          : <a key={a.id} href={a.dataUrl} download={a.nome} style={{
                              fontSize: 11.5, color: propria ? "#fff" : "#2f4a63", textDecoration: "none",
                              border: `1px solid ${propria ? "rgba(255,255,255,0.4)" : "#cdb98a"}`, borderRadius: 6,
                              padding: "5px 8px", display: "inline-flex", alignItems: "center", gap: 5,
                            }}><Paperclip size={12} /> {a.nome}</a>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: "#a3937a" }}>
                    {new Date(m.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {(propria || ehAdministrador) && (
                    <button onClick={() => excluirMensagem(m.id)} title="Excluir" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#a3937a", padding: 0, display: "flex" }}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={fimDaListaRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <span style={{ fontSize: 11.5, color: "#6b5d49", fontWeight: 600, whiteSpace: "nowrap" }}>Enviando como</span>
        <Select value={remetenteSelecionado} onChange={e => setRemetenteSelecionado(e.target.value)} style={{ padding: "6px 8px", fontSize: 12.5 }}>
          {usuarioAtual?.nome && <option value={usuarioAtual.nome}>{usuarioAtual.nome} (você)</option>}
          {(colaboradores || [])
            .filter(c => c.nome !== usuarioAtual?.nome)
            .map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </Select>
      </div>
      {anexosChat.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {anexosChat.map(a => (
            <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
              {a.tipo && a.tipo.startsWith("image/")
                ? <img src={a.dataUrl} alt={a.nome} style={{ width: 56, height: 56, objectFit: "cover", display: "block" }} />
                : <div style={{ width: 56, height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#a3937a", gap: 2 }}>
                    <Paperclip size={15} />
                    <span style={{ fontSize: 8, padding: "0 3px", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", maxWidth: 52 }}>{a.nome}</span>
                  </div>}
              <button onClick={() => setAnexosChat(x => x.filter(y => y.id !== a.id))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(255,255,255,0.92)", border: "none", borderRadius: 999, width: 17, height: 17, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
      <input ref={anexoChatRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }}
        onChange={e => { anexarNoChat(e.target.files); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button type="button" onClick={() => anexoChatRef.current && anexoChatRef.current.click()} title="Anexar documento, foto ou arquivo" style={{
          border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 8, padding: "0 12px",
          cursor: "pointer", color: "#2f4a63", display: "flex", alignItems: "center",
        }}><Paperclip size={16} /></button>
        <textarea
          value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva uma mensagem…" rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          style={{ ...inputStyle, flex: 1, resize: "none", fontFamily: "inherit" }}
        />
        <PrimaryButton onClick={enviar} disabled={(!texto.trim() && anexosChat.length === 0) || enviando} style={{ paddingLeft: 16, paddingRight: 16 }}>
          <Send size={16} />
        </PrimaryButton>
      </div>
    </div>
  );
}

// ---------- Consumo de produtos (materiais, estoque, movimentações e compras) ----------
// Adicionado: nova aba que reúne o estoque de materiais, o histórico de
// baixas automáticas geradas quando uma Ordem de Produção é concluída, e
// agora também as solicitações de compra com a negociação (cotações de
// fornecedores) de cada material.
function ConsumoProdutos({ materiais, setMateriais, produtos, consumosMaterial, movimentacoesMaterial, movimentacoesEstoque, onSalvarMovimentacaoEstoque, solicitacoesCompra, onSalvarSolicitacaoCompra, onRemoverSolicitacaoCompra, cotacoesCompra, onSalvarCotacaoCompra, onRemoverCotacaoCompra, fornecedores, setFornecedores, ehAdministrador }) {
  const [sub, setSub] = useState("estoque");
  const [filtroMaterialId, setFiltroMaterialId] = useState("");
  const [materialPreSelecionado, setMaterialPreSelecionado] = useState("");

  const nomeProduto = (id) => produtos.find(p => p.id === id)?.nome || "—";
  const consumoTotalPorMaterial = useMemo(() => {
    const map = {};
    movimentacoesMaterial.forEach(mv => {
      if (!map[mv.materialId]) map[mv.materialId] = 0;
      map[mv.materialId] += mv.quantidadeConsumida || 0;
    });
    return map;
  }, [movimentacoesMaterial]);

  // Adicionado: une as baixas automáticas de produção com as entradas
  // (manuais ou de compra aprovada) num único livro de movimentações —
  // essa é a visão de "controle de materiais" completa, entrada e saída.
  const movimentacoesUnificadas = useMemo(() => {
    const saidas = movimentacoesMaterial.map(mv => ({
      id: `saida:${mv.id}`, tipo: "saida", materialId: mv.materialId,
      materialNomeSnap: mv.materialNomeSnap, materialUnidadeSnap: mv.materialUnidadeSnap,
      quantidade: mv.quantidadeConsumida, saldoResultante: mv.saldoResultante,
      opNumero: mv.ordemProducaoNumero,
      detalhe: `${mv.produtoNomeSnap || nomeProduto(mv.produtoId)} · ${mv.quantidadeProduzida} peças produzidas`,
      criadoEm: mv.criadoEm,
    }));
    const entradas = (movimentacoesEstoque || []).map(mv => {
      const base = mv.motivo || (mv.origem === "compra" ? "Compra aprovada" : "Ajuste manual");
      // Adicionado: mostra o fornecedor da entrada manual junto do
      // motivo (a compra aprovada já mostrava o fornecedor da cotação).
      const fornecedorTexto = mv.fornecedorNomeSnap ? ` · ${mv.fornecedorNomeSnap}` : (mv.origem === "compra" ? " · —" : "");
      return {
        id: `estoque:${mv.id}`, tipo: mv.tipo, materialId: mv.materialId,
        materialNomeSnap: mv.materialNomeSnap, materialUnidadeSnap: mv.materialUnidadeSnap,
        quantidade: mv.quantidade, saldoResultante: mv.saldoResultante, opNumero: null,
        detalhe: `${base}${fornecedorTexto}`, precoUnitarioSnap: mv.precoUnitarioSnap ?? null,
        criadoEm: mv.criadoEm,
      };
    });
    return [...saidas, ...entradas]
      .filter(mv => !filtroMaterialId || mv.materialId === filtroMaterialId)
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  }, [movimentacoesMaterial, movimentacoesEstoque, filtroMaterialId]);

  const solicitacoesAbertas = solicitacoesCompra.filter(s => s.status !== "comprada" && s.status !== "cancelada").length;

  function solicitarCompra(materialId) {
    setMaterialPreSelecionado(materialId);
    setSub("compras");
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "estoque", label: "Estoque" },
          { key: "entrada", label: "Entrada" },
          { key: "movimentacoes", label: "Movimentações" },
          { key: "compras", label: `Compras${solicitacoesAbertas ? ` (${solicitacoesAbertas})` : ""}` },
        ].map(s => (
          <button key={s.key} onClick={() => setSub(s.key)} style={{
            flex: "1 1 30%", border: "1.5px solid " + (sub === s.key ? "#2f4a63" : "#d9cfb7"),
            background: sub === s.key ? "#2f4a63" : "#fff", color: sub === s.key ? "#fff" : "#6b5d49",
            borderRadius: 9, padding: "9px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>

      {sub === "estoque" && (
        materiais.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "#6b5d49", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 12, padding: 16 }}>
            Nenhum material cadastrado ainda. Cadastre em Cadastros → Materiais.
          </div>
        ) : (
          <>
            <Card style={{ marginBottom: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 12.5, color: "#6b5d49" }}>Valor total em estoque</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1c2b39" }}>
                  {materiais.reduce((s, m) => s + (m.quantidadeEstoque || 0) * (m.preco || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...materiais].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => {
                const estoqueBaixo = m.estoqueMinimo != null && m.quantidadeEstoque <= m.estoqueMinimo;
                const consumido = consumoTotalPorMaterial[m.id] || 0;
                const fmtPreco = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
                return (
                  <Card key={m.id} style={{ padding: 12, borderLeft: estoqueBaixo ? "4px solid #b13232" : "4px solid #2f4a63" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{m.nome}</div>
                        <div style={{ fontSize: 12, color: "#a3937a" }}>
                          consumido no total: {consumido} {m.unidade}
                          {m.estoqueMinimo != null ? ` · mínimo: ${m.estoqueMinimo} ${m.unidade}` : ""}
                        </div>
                        {fmtPreco(m.preco) && <div style={{ fontSize: 11.5, color: "#a3937a" }}>{fmtPreco(m.preco)}/{m.unidade}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: estoqueBaixo ? "#b13232" : "#1c2b39" }}>{m.quantidadeEstoque} {m.unidade}</div>
                        {estoqueBaixo && <div style={{ fontSize: 10.5, fontWeight: 700, color: "#b13232" }}>estoque baixo</div>}
                        {m.preco != null && <div style={{ fontSize: 11, color: "#a3937a" }}>{((m.quantidadeEstoque || 0) * m.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>}
                      </div>
                    </div>
                    {estoqueBaixo && (
                      <button onClick={() => solicitarCompra(m.id)} style={{
                        marginTop: 10, fontSize: 12, fontWeight: 700, color: "#2f4a63", background: "#f4ecd8",
                        border: "1px dashed #cdb98a", borderRadius: 7, padding: "6px 10px", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 5,
                      }}>Solicitar compra</button>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )
      )}

      {sub === "entrada" && (
        <EntradaMateriais
          materiais={materiais} setMateriais={setMateriais} onSalvarMovimentacaoEstoque={onSalvarMovimentacaoEstoque}
          fornecedores={fornecedores} setFornecedores={setFornecedores}
          movimentacoesEstoque={movimentacoesEstoque} solicitacoesCompra={solicitacoesCompra}
        />
      )}

      {sub === "movimentacoes" && (
        <>
          {materiais.length > 0 && (
            <Card style={{ marginBottom: 12, padding: 12 }}>
              <Field label="Material">
                <Select value={filtroMaterialId} onChange={e => setFiltroMaterialId(e.target.value)}>
                  <option value="">Todos os materiais</option>
                  {[...materiais].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Select>
              </Field>
            </Card>
          )}
          {movimentacoesUnificadas.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>
              Nenhuma movimentação registrada ainda. As saídas acontecem automaticamente quando uma Ordem de Produção é concluída; as entradas vêm de compras aprovadas ou de lançamentos manuais em Consumo → Entrada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {movimentacoesUnificadas.slice(0, 80).map(mv => (
                <Card key={mv.id} style={{ padding: 12, borderLeft: `4px solid ${mv.tipo === "entrada" ? "#1a7a4c" : "#b13232"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      {mv.opNumero != null && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#2f4a63", background: "#f4ecd8", padding: "2px 7px", borderRadius: 999, marginBottom: 4 }}>
                          <ListOrdered size={10} /> OP #{String(mv.opNumero).padStart(3, "0")}
                        </div>
                      )}
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{mv.materialNomeSnap || "—"}</div>
                      <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{mv.detalhe}</div>
                      <div style={{ fontSize: 12, color: "#a3937a", marginTop: 3 }}>{new Date(mv.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: mv.tipo === "entrada" ? "#1a7a4c" : "#b13232" }}>{mv.tipo === "entrada" ? "+" : "−"} {mv.quantidade} {mv.materialUnidadeSnap}</div>
                      {mv.saldoResultante != null && <div style={{ fontSize: 11, color: "#a3937a" }}>saldo: {mv.saldoResultante} {mv.materialUnidadeSnap}</div>}
                      {mv.precoUnitarioSnap != null && <div style={{ fontSize: 11, color: "#a3937a" }}>{mv.precoUnitarioSnap.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/{mv.materialUnidadeSnap}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {sub === "compras" && (
        <ComprasMateriais
          materiais={materiais} setMateriais={setMateriais}
          solicitacoesCompra={solicitacoesCompra} onSalvarSolicitacaoCompra={onSalvarSolicitacaoCompra} onRemoverSolicitacaoCompra={onRemoverSolicitacaoCompra}
          cotacoesCompra={cotacoesCompra} onSalvarCotacaoCompra={onSalvarCotacaoCompra} onRemoverCotacaoCompra={onRemoverCotacaoCompra}
          materialPreSelecionado={materialPreSelecionado} onLimparPreSelecao={() => setMaterialPreSelecionado("")}
          fornecedores={fornecedores} onSalvarMovimentacaoEstoque={onSalvarMovimentacaoEstoque} ehAdministrador={ehAdministrador}
        />
      )}
    </div>
  );
}

// ---------- Entrada de materiais ----------
// Adicionado: lançamento manual de entrada (ou saída) de estoque fora do
// fluxo de compras/produção — ex.: conferência de inventário, doação,
// devolução, perda. Fica registrado no livro de movimentações com o
// motivo informado.
function EntradaMateriais({ materiais, setMateriais, onSalvarMovimentacaoEstoque, fornecedores, setFornecedores, movimentacoesEstoque, solicitacoesCompra }) {
  const [materialId, setMaterialId] = useState("");
  const [tipo, setTipo] = useState("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  // Adicionado: fornecedor da entrada manual (ex.: compra avulsa, doação
  // recebida) — pré-preenche com o fornecedor cadastrado no material,
  // mas pode ser trocado para essa entrada específica.
  const [fornecedorId, setFornecedorId] = useState("");
  // Adicionado: preço unitário pago nesta entrada — quando informado,
  // atualiza o preço de referência do material (mesmo comportamento já
  // usado no fluxo de Compras), pra manter o custo de material dos
  // relatórios em dia mesmo em entradas lançadas manualmente.
  const [preco, setPreco] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  // Adicionado: cadastro rápido de material/fornecedor sem sair da tela
  // de Entrada — grava nas mesmas listas usadas em Cadastros → Materiais
  // e Cadastros → Fornecedores, então o que for criado aqui já aparece lá.
  const [novoMaterialAberto, setNovoMaterialAberto] = useState(false);
  const [novoMaterialNome, setNovoMaterialNome] = useState("");
  const [novoMaterialUnidade, setNovoMaterialUnidade] = useState("m");
  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState("");
  const [novoFornecedorContato, setNovoFornecedorContato] = useState("");

  // Adicionado: pesquisa/filtro de materiais para achar rápido o que
  // precisa de atenção antes de lançar uma entrada — por nome, por saldo
  // abaixo do mínimo, por já ter solicitação de compra em aberto, ou por
  // nunca ter tido uma compra registrada (sem histórico de preço).
  const [buscaMaterial, setBuscaMaterial] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("todos");
  const infoMateriais = useMemo(() => {
    const map = new Map();
    (materiais || []).forEach(m => {
      const entradasComPreco = (movimentacoesEstoque || [])
        .filter(mv => mv.materialId === m.id && mv.tipo === "entrada" && mv.precoUnitarioSnap != null)
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      const pendentes = (solicitacoesCompra || []).filter(s => s.materialId === m.id && s.status !== "comprada" && s.status !== "cancelada");
      map.set(m.id, {
        ultimaCompra: entradasComPreco[0] || null,
        pendentesCount: pendentes.length,
        abaixoMinimo: m.estoqueMinimo != null && m.quantidadeEstoque <= m.estoqueMinimo,
      });
    });
    return map;
  }, [materiais, movimentacoesEstoque, solicitacoesCompra]);
  const materiaisFiltrados = useMemo(() => {
    const termo = buscaMaterial.trim().toLowerCase();
    return [...materiais]
      .filter(m => !termo || m.nome.toLowerCase().includes(termo))
      .filter(m => {
        const info = infoMateriais.get(m.id);
        if (filtroRapido === "abaixo_minimo") return info?.abaixoMinimo;
        if (filtroRapido === "compra_pendente") return info?.pendentesCount > 0;
        if (filtroRapido === "sem_compra") return !info?.ultimaCompra;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [materiais, buscaMaterial, filtroRapido, infoMateriais]);

  const materialSelecionado = materiais.find(m => m.id === materialId);
  const infoMaterialSelecionado = materialId ? infoMateriais.get(materialId) : null;
  const qtdNum = parseFloat(quantidade || "0");
  const precoNum = parseFloat(preco || "0");
  const podeLancar = materialId && qtdNum > 0 && (tipo === "entrada" || (materialSelecionado && materialSelecionado.quantidadeEstoque >= qtdNum));

  function selecionarMaterial(id) {
    setMaterialId(id);
    const m = materiais.find(mm => mm.id === id);
    setFornecedorId(m?.fornecedorId || "");
    setPreco("");
  }

  async function criarMaterial() {
    if (!novoMaterialNome.trim()) return;
    const novo = { id: uid(), nome: novoMaterialNome.trim(), unidade: novoMaterialUnidade, quantidadeEstoque: 0, estoqueMinimo: null, estoqueMaximo: null, preco: null, fornecedorId: null, fornecedorNomeSnap: null };
    await setMateriais([...materiais, novo]);
    selecionarMaterial(novo.id);
    setNovoMaterialNome(""); setNovoMaterialUnidade("m"); setNovoMaterialAberto(false);
  }

  async function criarFornecedor() {
    if (!novoFornecedorNome.trim()) return;
    const novo = { id: uid(), nome: novoFornecedorNome.trim(), contato: novoFornecedorContato.trim(), categoria: "", observacao: "" };
    await setFornecedores([...(fornecedores || []), novo]);
    setFornecedorId(novo.id);
    setNovoFornecedorNome(""); setNovoFornecedorContato(""); setNovoFornecedorAberto(false);
  }

  async function lancar() {
    if (!podeLancar) return;
    const delta = tipo === "entrada" ? qtdNum : -qtdNum;
    const novoEstoque = Math.round((materialSelecionado.quantidadeEstoque + delta) * 1000) / 1000;
    const novoPreco = tipo === "entrada" && precoNum > 0 ? Math.round(precoNum * 100) / 100 : materialSelecionado.preco;
    await setMateriais(materiais.map(m => m.id === materialId ? { ...m, quantidadeEstoque: novoEstoque, preco: novoPreco } : m));
    const fornecedorNomeSnap = tipo === "entrada" && fornecedorId ? (fornecedores || []).find(f => f.id === fornecedorId)?.nome || null : null;
    await onSalvarMovimentacaoEstoque({
      id: uid(), materialId, materialNomeSnap: materialSelecionado.nome, materialUnidadeSnap: materialSelecionado.unidade,
      tipo, origem: "manual", quantidade: qtdNum, motivo: motivo.trim() || (tipo === "entrada" ? "Entrada manual" : "Saída manual"),
      fornecedorId: tipo === "entrada" ? (fornecedorId || null) : null, fornecedorNomeSnap,
      precoUnitarioSnap: tipo === "entrada" && precoNum > 0 ? novoPreco : null,
      saldoResultante: novoEstoque, criadoEm: new Date().toISOString(),
    });
    setMaterialId(""); setQuantidade(""); setMotivo(""); setTipo("entrada"); setFornecedorId(""); setPreco("");
    setConfirmado(true);
    setTimeout(() => setConfirmado(false), 2500);
  }

  return (
    <div>
      {materiais.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 10, color: "#1c2b39" }}>Pesquisar material</div>
          <Field label="Nome do material">
            <input value={buscaMaterial} onChange={e => setBuscaMaterial(e.target.value)} placeholder="Digite para filtrar a lista abaixo…" style={inputStyle} />
          </Field>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <ToggleChip ativo={filtroRapido === "todos"} onClick={() => setFiltroRapido("todos")}>Todos</ToggleChip>
            <ToggleChip ativo={filtroRapido === "abaixo_minimo"} colorAtivo="#b13232" onClick={() => setFiltroRapido("abaixo_minimo")}>Abaixo do mínimo</ToggleChip>
            <ToggleChip ativo={filtroRapido === "compra_pendente"} colorAtivo="#b5820a" onClick={() => setFiltroRapido("compra_pendente")}>Compra pendente</ToggleChip>
            <ToggleChip ativo={filtroRapido === "sem_compra"} onClick={() => setFiltroRapido("sem_compra")}>Sem compra registrada</ToggleChip>
          </div>
          <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 8 }}>
            {materiaisFiltrados.length} de {materiais.length} material(is) — escolha um abaixo no campo "Material".
          </div>
        </Card>
      )}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Entrada / saída manual de material</div>
        <div style={{ fontSize: 12.5, color: "#6b5d49", marginBottom: 12 }}>
          Use aqui para conferência de inventário, doação, devolução ou perda — qualquer ajuste de estoque que não veio de uma compra aprovada nem de uma baixa de produção.
        </div>
        {materiais.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#a3937a" }}>Cadastre materiais em Cadastros → Materiais primeiro.</div>
        ) : (
          <>
            <Field label="Material">
              <Select value={materialId} onChange={e => selecionarMaterial(e.target.value)}>
                <option value="">Selecione…</option>
                {materiaisFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome} ({m.quantidadeEstoque} {m.unidade} em estoque)</option>)}
              </Select>
              {materialId && infoMaterialSelecionado && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {infoMaterialSelecionado.abaixoMinimo && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b13232", background: "#f8e6e6", padding: "3px 9px", borderRadius: 999 }}>Abaixo do mínimo</span>
                  )}
                  {infoMaterialSelecionado.pendentesCount > 0 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#8a6510", background: "#fdf3e0", padding: "3px 9px", borderRadius: 999 }}>
                      {infoMaterialSelecionado.pendentesCount} solicitação{infoMaterialSelecionado.pendentesCount !== 1 ? "ões" : ""} de compra em aberto
                    </span>
                  )}
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#6b5d49", background: "#f4efe2", padding: "3px 9px", borderRadius: 999 }}>
                    {infoMaterialSelecionado.ultimaCompra
                      ? `Última compra: ${infoMaterialSelecionado.ultimaCompra.precoUnitarioSnap.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em ${new Date(infoMaterialSelecionado.ultimaCompra.criadoEm).toLocaleDateString("pt-BR")}${infoMaterialSelecionado.ultimaCompra.fornecedorNomeSnap ? ` (${infoMaterialSelecionado.ultimaCompra.fornecedorNomeSnap})` : ""}`
                      : "Sem compra registrada"}
                  </span>
                </div>
              )}
              <button type="button" onClick={() => setNovoMaterialAberto(v => !v)} style={linkButtonStyle}>
                {novoMaterialAberto ? "Cancelar" : "+ Cadastrar novo material"}
              </button>
              {novoMaterialAberto && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <input value={novoMaterialNome} onChange={e => setNovoMaterialNome(e.target.value)} placeholder="Nome do novo material" style={inputStyle} onKeyDown={e => e.key === "Enter" && criarMaterial()} />
                  </div>
                  <Select value={novoMaterialUnidade} onChange={e => setNovoMaterialUnidade(e.target.value)} style={{ width: 90 }}>
                    {UNIDADES_MATERIAL.map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                  <PrimaryButton onClick={criarMaterial} disabled={!novoMaterialNome.trim()}><Plus size={16} /></PrimaryButton>
                </div>
              )}
            </Field>
            <Field label="Tipo">
              <div style={{ display: "flex", gap: 8 }}>
                <ToggleChip ativo={tipo === "entrada"} onClick={() => setTipo("entrada")}>Entrada</ToggleChip>
                <ToggleChip ativo={tipo === "saida"} colorAtivo="#b13232" onClick={() => setTipo("saida")}>Saída</ToggleChip>
              </div>
            </Field>
            {tipo === "entrada" && (
              <Field label="Fornecedor (opcional)">
                <Select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                  <option value="">Sem fornecedor definido</option>
                  {[...(fornecedores || [])].sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </Select>
                <button type="button" onClick={() => setNovoFornecedorAberto(v => !v)} style={linkButtonStyle}>
                  {novoFornecedorAberto ? "Cancelar" : "+ Cadastrar novo fornecedor"}
                </button>
                {novoFornecedorAberto && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <input value={novoFornecedorNome} onChange={e => setNovoFornecedorNome(e.target.value)} placeholder="Nome do novo fornecedor" style={inputStyle} onKeyDown={e => e.key === "Enter" && criarFornecedor()} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input value={novoFornecedorContato} onChange={e => setNovoFornecedorContato(e.target.value)} placeholder="Contato (opcional)" style={inputStyle} onKeyDown={e => e.key === "Enter" && criarFornecedor()} />
                    </div>
                    <PrimaryButton onClick={criarFornecedor} disabled={!novoFornecedorNome.trim()}><Plus size={16} /></PrimaryButton>
                  </div>
                )}
              </Field>
            )}
            <Field label="Quantidade">
              <input type="number" min="0" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder={materialSelecionado ? `Em ${materialSelecionado.unidade}` : "Quantidade"} style={inputStyle} />
              {tipo === "saida" && materialSelecionado && qtdNum > materialSelecionado.quantidadeEstoque && (
                <div style={{ fontSize: 11.5, color: "#b13232", marginTop: 5 }}>Maior que o estoque atual ({materialSelecionado.quantidadeEstoque} {materialSelecionado.unidade}).</div>
              )}
            </Field>
            {tipo === "entrada" && (
              <Field label="Preço unitário pago (opcional)">
                <input
                  type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)}
                  placeholder={materialSelecionado?.preco != null ? `Atual: ${materialSelecionado.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Ex.: 18.90"}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: "#a3937a", marginTop: 5 }}>Se informado, atualiza o preço de referência deste material para as próximas compras e relatórios de custo.</div>
              </Field>
            )}
            <Field label="Motivo">
              <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: conferência de inventário, doação, perda" style={inputStyle} />
            </Field>
            <PrimaryButton onClick={lancar} disabled={!podeLancar} style={{ width: "100%" }}><Plus size={16} /> Lançar {tipo === "entrada" ? "entrada" : "saída"}</PrimaryButton>
            {confirmado && <div style={{ fontSize: 12.5, color: "#1a7a4c", fontWeight: 700, marginTop: 8 }}>✓ Lançamento registrado.</div>}
          </>
        )}
      </Card>
    </div>
  );
}

const STATUS_SOLICITACAO = {
  pendente: { label: "Pendente", color: "#b5820a", bg: "#fdf3e0" },
  cotando: { label: "Em cotação", color: "#1d6fa5", bg: "#e7f1f8" },
  aguardando_aprovacao: { label: "Aguardando aprovação", color: "#8a5fb0", bg: "#f1e9f7" },
  comprada: { label: "Comprada", color: "#1a7a4c", bg: "#e6f4ec" },
  cancelada: { label: "Cancelada", color: "#b13232", bg: "#f8e6e6" },
};

// Adicionado: solicitação de compra (o que falta comprar) e negociação —
// cada solicitação pode reunir várias cotações de fornecedores. Ao
// escolher a vencedora, um Gestor manda para aprovação de um
// Administrador; o próprio Administrador já aprova de cara. Só quando
// aprovada é que o estoque do material recebe entrada e o preço de
// referência é atualizado para o valor negociado.
function ComprasMateriais({ materiais, setMateriais, solicitacoesCompra, onSalvarSolicitacaoCompra, onRemoverSolicitacaoCompra, cotacoesCompra, onSalvarCotacaoCompra, onRemoverCotacaoCompra, materialPreSelecionado, onLimparPreSelecao, fornecedores, onSalvarMovimentacaoEstoque, ehAdministrador }) {
  const [materialId, setMaterialId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [expandidoId, setExpandidoId] = useState(null);
  const [fornecedorId, setFornecedorId] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("");

  useEffect(() => {
    if (materialPreSelecionado) {
      const m = materiais.find(x => x.id === materialPreSelecionado);
      setMaterialId(materialPreSelecionado);
      if (m) {
        const sugestao = m.estoqueMaximo != null ? Math.max(m.estoqueMaximo - m.quantidadeEstoque, 0) : "";
        setQuantidade(sugestao ? String(sugestao) : "");
      }
      onLimparPreSelecao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialPreSelecionado]);

  const nomeMaterial = (id) => materiais.find(m => m.id === id)?.nome || "—";
  const unidadeMaterial = (id) => materiais.find(m => m.id === id)?.unidade || "";

  async function criarSolicitacao() {
    const qtd = parseFloat(quantidade || "0");
    if (!materialId || !(qtd > 0)) return;
    await onSalvarSolicitacaoCompra({
      id: uid(), materialId, quantidade: qtd, observacao: observacao.trim(),
      status: "pendente", criadoEm: new Date().toISOString(),
    });
    setMaterialId(""); setQuantidade(""); setObservacao("");
  }
  async function cancelarSolicitacao(s) {
    if (!window.confirm("Cancelar esta solicitação de compra?")) return;
    await onSalvarSolicitacaoCompra({ ...s, status: "cancelada" });
  }
  async function excluirSolicitacao(s) {
    if (!window.confirm("Excluir esta solicitação e as cotações registradas nela?")) return;
    await Promise.all(cotacoesCompra.filter(c => c.solicitacaoId === s.id).map(c => onRemoverCotacaoCompra(c.id)));
    await onRemoverSolicitacaoCompra(s.id);
  }
  async function adicionarCotacao(s) {
    const preco = parseFloat(precoUnitario || "0");
    if (!fornecedorId || !(preco > 0)) return;
    const fornecedorSelecionado = (fornecedores || []).find(f => f.id === fornecedorId);
    await onSalvarCotacaoCompra({
      id: uid(), solicitacaoId: s.id, fornecedorId, fornecedorNomeSnap: fornecedorSelecionado?.nome || "—", precoUnitario: preco,
      prazoEntrega: prazoEntrega.trim(), condicaoPagamento: condicaoPagamento.trim(), criadoEm: new Date().toISOString(),
    });
    if (s.status === "pendente") await onSalvarSolicitacaoCompra({ ...s, status: "cotando" });
    setFornecedorId(""); setPrecoUnitario(""); setPrazoEntrega(""); setCondicaoPagamento("");
  }
  async function removerCotacao(c) { await onRemoverCotacaoCompra(c.id); }

  // Adicionado: efetiva a entrada de estoque de uma compra — dá entrada
  // pela quantidade solicitada, atualiza o preço de referência do
  // material para o valor negociado, e registra a movimentação no livro
  // de estoque (usado no relatório de controle de materiais).
  async function efetivarEntradaCompra(s, c) {
    const material = materiais.find(m => m.id === s.materialId);
    const novoEstoque = Math.round(((material?.quantidadeEstoque || 0) + s.quantidade) * 1000) / 1000;
    await setMateriais(materiais.map(m => m.id === s.materialId
      ? { ...m, quantidadeEstoque: novoEstoque, preco: c.precoUnitario }
      : m));
    await onSalvarMovimentacaoEstoque({
      id: uid(), materialId: s.materialId, materialNomeSnap: material?.nome || nomeMaterial(s.materialId), materialUnidadeSnap: material?.unidade || unidadeMaterial(s.materialId),
      tipo: "entrada", origem: "compra", quantidade: s.quantidade, fornecedorNomeSnap: c.fornecedorNomeSnap, solicitacaoId: s.id,
      saldoResultante: novoEstoque, criadoEm: new Date().toISOString(),
    });
  }

  // Adicionado: escolher a cotação vencedora não fecha mais a compra na
  // hora — vai para "aguardando aprovação". Só quando quem está logado é
  // Administrador a aprovação já acontece junto (ele é o próprio
  // aprovador), efetivando a entrada de estoque nesse mesmo passo.
  async function escolherCotacao(s, c) {
    const msg = ehAdministrador
      ? `Aprovar e fechar compra com ${c.fornecedorNomeSnap} por ${c.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/${unidadeMaterial(s.materialId)}? O estoque de ${nomeMaterial(s.materialId)} recebe entrada de ${s.quantidade} ${unidadeMaterial(s.materialId)}.`
      : `Enviar a cotação de ${c.fornecedorNomeSnap} para aprovação de um administrador? Nada muda no estoque até a aprovação.`;
    if (!window.confirm(msg)) return;
    if (ehAdministrador) {
      await efetivarEntradaCompra(s, c);
      await onSalvarSolicitacaoCompra({ ...s, status: "comprada", cotacaoEscolhidaId: c.id, concluidaEm: new Date().toISOString() });
    } else {
      await onSalvarSolicitacaoCompra({ ...s, status: "aguardando_aprovacao", cotacaoEscolhidaId: c.id });
    }
  }
  async function aprovarCompra(s) {
    const c = cotacoesCompra.find(x => x.id === s.cotacaoEscolhidaId);
    if (!c) return;
    if (!window.confirm(`Aprovar a compra com ${c.fornecedorNomeSnap} por ${c.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/${unidadeMaterial(s.materialId)}? O estoque de ${nomeMaterial(s.materialId)} recebe entrada de ${s.quantidade} ${unidadeMaterial(s.materialId)}.`)) return;
    await efetivarEntradaCompra(s, c);
    await onSalvarSolicitacaoCompra({ ...s, status: "comprada", concluidaEm: new Date().toISOString() });
  }
  async function reprovarCompra(s) {
    if (!window.confirm("Reprovar esta cotação e voltar para a fase de cotação?")) return;
    await onSalvarSolicitacaoCompra({ ...s, status: "cotando", cotacaoEscolhidaId: null });
  }

  const ordenadas = [...solicitacoesCompra].sort((a, b) => {
    const pesoStatus = { aguardando_aprovacao: 0, pendente: 1, cotando: 2, comprada: 3, cancelada: 4 };
    const diff = (pesoStatus[a.status] ?? 9) - (pesoStatus[b.status] ?? 9);
    return diff !== 0 ? diff : new Date(b.criadoEm) - new Date(a.criadoEm);
  });

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Nova solicitação de compra</div>
        {materiais.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#a3937a" }}>Cadastre materiais em Cadastros → Materiais para poder solicitar compra.</div>
        ) : (
          <>
            <Field label="Material">
              <Select value={materialId} onChange={e => setMaterialId(e.target.value)}>
                <option value="">Selecione…</option>
                {[...materiais].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>)}
              </Select>
            </Field>
            <Field label="Quantidade">
              <input type="number" min="0" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder={materialId ? `Em ${unidadeMaterial(materialId)}` : "Quantidade"} style={inputStyle} />
            </Field>
            <Field label="Observação (opcional)">
              <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: urgente, para o pedido do cliente X" style={inputStyle} />
            </Field>
            <PrimaryButton onClick={criarSolicitacao} disabled={!materialId || !(parseFloat(quantidade || "0") > 0)} style={{ width: "100%" }}><Plus size={16} /> Solicitar compra</PrimaryButton>
          </>
        )}
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ordenadas.map(s => {
          const cotacoesDaSolicitacao = cotacoesCompra.filter(c => c.solicitacaoId === s.id).sort((a, b) => a.precoUnitario - b.precoUnitario);
          const statusInfo = STATUS_SOLICITACAO[s.status] || STATUS_SOLICITACAO.pendente;
          const expandido = expandidoId === s.id;
          const emAberto = s.status === "pendente" || s.status === "cotando";
          return (
            <Card key={s.id} style={{ padding: 0, overflow: "hidden" }}>
              <div onClick={() => setExpandidoId(expandido ? null : s.id)} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{nomeMaterial(s.materialId)}</div>
                  <div style={{ fontSize: 12, color: "#a3937a" }}>{s.quantidade} {unidadeMaterial(s.materialId)} · {cotacoesDaSolicitacao.length} cotação{cotacoesDaSolicitacao.length !== 1 ? "ões" : ""}{s.observacao ? ` · ${s.observacao}` : ""}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, border: `1px dashed ${statusInfo.color}`, padding: "2px 9px 2px 8px", borderRadius: "3px 9px 9px 3px" }}>{statusInfo.label}</span>
              </div>
              {expandido && (
                <div style={{ borderTop: "1px solid #efe8d8", padding: 14, background: "#faf6ec" }}>
                  {cotacoesDaSolicitacao.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {cotacoesDaSolicitacao.map(c => (
                        <div key={c.id} style={{ background: "#fff", border: s.cotacaoEscolhidaId === c.id ? "1.5px solid #1a7a4c" : "1px solid #e6ddc8", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#2a2015" }}>{c.fornecedorNomeSnap || c.fornecedor}{s.cotacaoEscolhidaId === c.id ? " ✓" : ""}</div>
                              <div style={{ fontSize: 11.5, color: "#6b5d49" }}>
                                {c.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/{unidadeMaterial(s.materialId)}
                                {c.prazoEntrega ? ` · prazo: ${c.prazoEntrega}` : ""}{c.condicaoPagamento ? ` · ${c.condicaoPagamento}` : ""}
                              </div>
                              <div style={{ fontSize: 11, color: "#a3937a" }}>total estimado: {(c.precoUnitario * s.quantidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                            </div>
                            {emAberto && (
                              <div style={{ display: "flex", gap: 2 }}>
                                <IconButton onClick={() => escolherCotacao(s, c)} title="Escolher esta cotação"><Check size={15} /></IconButton>
                                <IconButton onClick={() => removerCotacao(c)} danger title="Remover"><X size={14} /></IconButton>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.status === "aguardando_aprovacao" && (() => {
                    const cotacaoEscolhida = cotacoesCompra.find(c => c.id === s.cotacaoEscolhidaId);
                    return (
                      <div style={{ background: "#f1e9f7", border: "1px dashed #8a5fb0", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#5c3d80", marginBottom: 4 }}>Aguardando aprovação</div>
                        {cotacaoEscolhida && (
                          <div style={{ fontSize: 12, color: "#6b5d49", marginBottom: 8 }}>
                            {cotacaoEscolhida.fornecedorNomeSnap} · {cotacaoEscolhida.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/{unidadeMaterial(s.materialId)} · total {(cotacaoEscolhida.precoUnitario * s.quantidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                        )}
                        {ehAdministrador ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <PrimaryButton onClick={() => aprovarCompra(s)} style={{ flex: 1 }}><Check size={16} /> Aprovar compra</PrimaryButton>
                            <button onClick={() => reprovarCompra(s)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 12px", color: "#b13232", fontWeight: 700, cursor: "pointer" }}>Reprovar</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#5c3d80" }}>Só um Administrador pode aprovar esta compra.</div>
                        )}
                      </div>
                    );
                  })()}
                  {emAberto && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1c2b39", marginBottom: 6 }}>Adicionar cotação</div>
                      {(fornecedores || []).length === 0 ? (
                        <div style={{ fontSize: 12, color: "#a3937a", marginBottom: 8 }}>Cadastre fornecedores em Cadastros → Fornecedores para poder cotar.</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                          <Select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                            <option value="">Fornecedor…</option>
                            {[...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                          </Select>
                          <input type="number" min="0" step="0.01" value={precoUnitario} onChange={e => setPrecoUnitario(e.target.value)} placeholder={`Preço/${unidadeMaterial(s.materialId)}`} style={inputStyle} />
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                        <input value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="Prazo (ex.: 5 dias)" style={inputStyle} />
                        <input value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} placeholder="Pagamento (ex.: 30 dias)" style={inputStyle} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <PrimaryButton onClick={() => adicionarCotacao(s)} disabled={!fornecedorId || !(parseFloat(precoUnitario || "0") > 0)} style={{ flex: 1 }}>Adicionar cotação</PrimaryButton>
                        <button onClick={() => cancelarSolicitacao(s)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 12px", color: "#b13232", fontWeight: 700, cursor: "pointer" }}>Cancelar pedido</button>
                      </div>
                    </>
                  )}
                  {(s.status === "comprada" || s.status === "cancelada") && (
                    <IconButton onClick={() => excluirSolicitacao(s)} danger title="Excluir solicitação"><Trash2 size={15} /></IconButton>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {ordenadas.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma solicitação de compra registrada.</div>}
      </div>
    </div>
  );
}

// ---------- Relatórios ----------
function Relatorios({ registros, produtos, etapas, colaboradores, setores, avaliacoes, onGerarRelatorio, onGerarRelatorioAbertos, movimentacoesMaterial, movimentacoesEstoque, materiais, solicitacoesCompra, cotacoesCompra, ehAdministrador, ordensProducao, consumosMaterial, onImprimirGrade }) {
  // Corrigido: o padrão era "Diário" (só o dia de hoje), o que fazia os
  // relatórios parecerem quebrados/vazios quando a produção tinha sido
  // lançada em outro dia. O padrão agora é mensal, que é o recorte mais
  // usado no dia a dia da fábrica.
  const [preset, setPreset] = useState("mes");
  const [customStart, setCustomStart] = useState(todayStr());
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [filtroColab, setFiltroColab] = useState("");
  const [aba, setAba] = useState("resumo");
  // Adicionado: relatório de itens em aberto por departamento — pode ser
  // agrupado por etapa, por colaborador ou por função do colaborador.
  const [agrupamentoAbertos, setAgrupamentoAbertos] = useState("etapa");
  const [filtroSetorAbertos, setFiltroSetorAbertos] = useState("");

  const { start, end } = getPeriodRange(preset, customStart, customEnd);
  const equipeDe = (r) => r.colaboradorIds || [];
  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";
  // Corrigido: usa o nome do produto/etapa salvo no registro (snapshot) quando
  // o item de cadastro já não existe mais, evitando "—" em relatórios antigos.
  const nomeProdutoL = (id, r) => produtos.find(p => p.id === id)?.nome || r?.produtoNomeSnap || "—";
  const nomeEtapaL = (id, r) => etapas.find(e => e.id === id)?.nome || r?.etapaNomeSnap || "—";

  // Considera para as métricas apenas registros concluídos que tenham
  // eficiência calculada (com meta cadastrada); registros "sem meta" ainda
  // contam nas peças/defeitos, mas não distorcem a média de eficiência.
  const concluidosPeriodo = useMemo(() => registros.filter(r => {
    if (r.status !== "concluido" || !r.fim) return false;
    const d = new Date(r.fim);
    if (d < start || d > end) return false;
    if (filtroColab && !equipeDe(r).includes(filtroColab)) return false;
    return true;
  }), [registros, start, end, filtroColab]);

  const comMeta = (regs) => regs.filter(r => r.eficiencia != null);

  const avaliacoesFiltradas = useMemo(() => (avaliacoes || []).filter(a => {
    const d = new Date(a.data + "T12:00:00");
    if (d < start || d > end) return false;
    if (filtroColab && a.colaboradorId !== filtroColab) return false;
    return true;
  }), [avaliacoes, start, end, filtroColab]);

  const porColaborador = useMemo(() => {
    const map = {};
    const garantir = (id) => { if (!map[id]) map[id] = { colaboradorId: id, nome: nomeColab(id), regs: [] }; return map[id]; };
    concluidosPeriodo.forEach(r => equipeDe(r).forEach(id => garantir(id).regs.push(r)));
    avaliacoesFiltradas.forEach(a => garantir(a.colaboradorId));
    return Object.values(map).map(g => {
      const regsComMeta = comMeta(g.regs);
      const mediaEf = mediaEficiencia(regsComMeta);
      const contagem = { A: 0, B: 0, C: 0 };
      regsComMeta.forEach(r => contagem[r.classificacao] && contagem[r.classificacao]++);
      const pecas = g.regs.reduce((s, r) => s + (r.quantidade || 1), 0);
      const defeitos = g.regs.reduce((s, r) => s + (r.quantidadeDefeito || 0), 0);
      const retrabalhoMin = g.regs.reduce((s, r) => s + (r.tempoRetrabalhoMin || 0), 0);
      const semMetaQtd = g.regs.length - regsComMeta.length;
      const avaliacoesColab = avaliacoesFiltradas.filter(a => a.colaboradorId === g.colaboradorId);
      const penalidade = Math.min(100, avaliacoesColab.reduce((s, a) => s + (a.pesoFalta || 0) + (a.pesoAtraso || 0), 0));
      const mediaAjustada = Math.max(0, Math.round((mediaEf - penalidade) * 10) / 10);
      return { colaboradorId: g.colaboradorId, nome: g.nome, qtd: g.regs.length, pecas, defeitos, retrabalhoMin, mediaEf, mediaAjustada, penalidade, contagem, semMetaQtd };
    }).sort((a, b) => b.mediaAjustada - a.mediaAjustada);
  }, [concluidosPeriodo, avaliacoesFiltradas]);

  const concluidosComMetaGeral = comMeta(concluidosPeriodo);
  const contagemGeral = { A: 0, B: 0, C: 0 };
  concluidosComMetaGeral.forEach(r => contagemGeral[r.classificacao] && contagemGeral[r.classificacao]++);
  const mediaGeral = mediaEficiencia(concluidosComMetaGeral);
  const qtdTotalProduzida = concluidosPeriodo.reduce((s, r) => s + (r.quantidade || 1), 0);
  const qtdTotalDefeito = concluidosPeriodo.reduce((s, r) => s + (r.quantidadeDefeito || 0), 0);
  const qtdTotalRetrabalhoMin = concluidosPeriodo.reduce((s, r) => s + (r.tempoRetrabalhoMin || 0), 0);

  // Por produto: colaboradores ranqueados dentro de cada produto
  const porProduto = useMemo(() => {
    const map = {};
    concluidosPeriodo.forEach(r => {
      const chave = r.produtoId || `snap:${r.produtoNomeSnap || "—"}`;
      if (!map[chave]) map[chave] = {};
      equipeDe(r).forEach(id => {
        if (!map[chave][id]) map[chave][id] = [];
        map[chave][id].push(r);
      });
    });
    return Object.entries(map).map(([chave, colabMap]) => {
      const primeiraLinha = Object.values(colabMap)[0]?.[0];
      const colaboradoresArr = Object.entries(colabMap).map(([colabId, regs]) => {
        const regsComMeta = comMeta(regs);
        const ef = mediaEficiencia(regsComMeta);
        return { colaboradorId: colabId, nome: nomeColab(colabId), eficiencia: ef, temMeta: regsComMeta.length > 0, pecas: regs.reduce((s, r) => s + (r.quantidade || 1), 0), classificacao: regsComMeta.length ? classify(ef) : null };
      }).sort((a, b) => b.eficiencia - a.eficiencia);
      const comMetaArr = colaboradoresArr.filter(c => c.temMeta);
      const mediaProduto = comMetaArr.length ? Math.round((comMetaArr.reduce((s, c) => s + c.eficiencia, 0) / comMetaArr.length) * 10) / 10 : 0;
      return { produtoId: primeiraLinha?.produtoId, produtoNome: primeiraLinha ? nomeProdutoL(primeiraLinha.produtoId, primeiraLinha) : "—", colaboradores: colaboradoresArr, mediaProduto };
    }).sort((a, b) => b.mediaProduto - a.mediaProduto);
  }, [concluidosPeriodo]);

  // Por colaborador: histórico cronológico de produtos + destaque melhor/pior
  const historicoColaborador = useMemo(() => {
    if (!filtroColab) return null;
    const regsColab = ordenarRegistrosRelatorio(
      concluidosPeriodo.filter(r => equipeDe(r).includes(filtroColab)),
      { hora: r => r.fim, etapa: r => nomeEtapaL(r.etapaId, r), operador: r => equipeDe(r).map(nomeColab).join(", ") }
    );
    const porProdutoMap = {};
    regsColab.forEach(r => {
      const chave = r.produtoId || `snap:${r.produtoNomeSnap || "—"}`;
      if (!porProdutoMap[chave]) porProdutoMap[chave] = [];
      porProdutoMap[chave].push(r);
    });
    const mediasPorProduto = Object.entries(porProdutoMap).map(([chave, regs]) => {
      const regsComMeta = comMeta(regs);
      const ef = mediaEficiencia(regsComMeta);
      return { chave, temMeta: regsComMeta.length > 0, eficiencia: ef };
    }).filter(m => m.temMeta);
    const melhor = mediasPorProduto.length ? mediasPorProduto.reduce((a, b) => b.eficiencia > a.eficiencia ? b : a) : null;
    const pior = mediasPorProduto.length ? mediasPorProduto.reduce((a, b) => b.eficiencia < a.eficiencia ? b : a) : null;
    return {
      itens: regsColab.map(r => ({
        data: new Date(r.fim), produtoNome: nomeProdutoL(r.produtoId, r), chave: r.produtoId || `snap:${r.produtoNomeSnap || "—"}`,
        etapaNome: nomeEtapaL(r.etapaId, r), tempoRealSeg: r.tempoRealSeg, eficiencia: r.eficiencia != null ? Math.min(100, r.eficiencia) : null, classificacao: r.classificacao,
      })),
      melhorChave: melhor?.chave, piorChave: pior && pior.chave !== melhor?.chave ? pior.chave : null,
    };
  }, [concluidosPeriodo, filtroColab]);

  // Adicionado: custo de mão de obra (a partir do salário mensal do
  // colaborador, convertido para valor-hora usando 220h/mês, padrão de
  // jornada CLT) e custo de materiais (a partir do preço unitário salvo
  // no momento de cada baixa de estoque), para dar uma visão de custo das
  // operações do período — visível só para o Administrador.
  const custoMaoDeObraPorColaborador = useMemo(() => {
    const map = {};
    concluidosPeriodo.forEach(r => {
      const equipe = equipeDe(r);
      if (equipe.length === 0) return;
      const horasTotais = (r.tempoRealConsideradoSeg ?? r.tempoRealSeg ?? 0) / 3600;
      const horasPorPessoa = horasTotais / equipe.length;
      equipe.forEach(id => {
        const colab = colaboradores.find(c => c.id === id);
        const valorHora = colab?.salarioMensal ? colab.salarioMensal / HORAS_MES_PADRAO : 0;
        if (!map[id]) map[id] = { colaboradorId: id, nome: nomeColab(id), horas: 0, custo: 0, temSalario: !!colab?.salarioMensal };
        map[id].horas += horasPorPessoa;
        map[id].custo += horasPorPessoa * valorHora;
      });
    });
    return Object.values(map).map(v => ({ ...v, horas: Math.round(v.horas * 100) / 100, custo: Math.round(v.custo * 100) / 100 })).sort((a, b) => b.custo - a.custo);
  }, [concluidosPeriodo, colaboradores]);
  const custoMaoDeObraTotal = Math.round(custoMaoDeObraPorColaborador.reduce((s, c) => s + c.custo, 0) * 100) / 100;

  const custoMateriaisPorMaterial = useMemo(() => {
    const map = {};
    (movimentacoesMaterial || []).forEach(mv => {
      const d = new Date(mv.criadoEm);
      if (d < start || d > end) return;
      const custo = (mv.quantidadeConsumida || 0) * (mv.precoUnitarioSnap || 0);
      if (!map[mv.materialId]) map[mv.materialId] = { materialId: mv.materialId, nome: mv.materialNomeSnap || "—", quantidade: 0, custo: 0, temPreco: mv.precoUnitarioSnap != null };
      map[mv.materialId].quantidade += mv.quantidadeConsumida || 0;
      map[mv.materialId].custo += custo;
    });
    return Object.values(map).map(v => ({ ...v, quantidade: Math.round(v.quantidade * 1000) / 1000, custo: Math.round(v.custo * 100) / 100 })).sort((a, b) => b.custo - a.custo);
  }, [movimentacoesMaterial, start, end]);
  const custoMateriaisTotal = Math.round(custoMateriaisPorMaterial.reduce((s, m) => s + m.custo, 0) * 100) / 100;
  const custoTotalGeral = Math.round((custoMaoDeObraTotal + custoMateriaisTotal) * 100) / 100;

  // Adicionado: gasto por pedido (Ordem de Produção) — cruza a mão de
  // obra de cada registro concluído com o consumo de material de cada
  // baixa de estoque, ambos já vinculados à OP de origem, para saber o
  // custo total (mão de obra + materiais) de cada pedido no período.
  const nomeOP = (id) => (ordensProducao || []).find(o => o.id === id);
  const custoPorOP = useMemo(() => {
    const map = {};
    const garantir = (opId, numero) => {
      if (!map[opId]) {
        const op = nomeOP(opId);
        map[opId] = { opId, numero: numero ?? op?.numero, cliente: op?.clienteNomeSnap || "—", maoDeObra: 0, materiais: 0 };
      }
      return map[opId];
    };
    concluidosPeriodo.forEach(r => {
      if (!r.ordemProducaoId) return;
      const equipe = equipeDe(r);
      if (equipe.length === 0) return;
      const horasTotais = (r.tempoRealConsideradoSeg ?? r.tempoRealSeg ?? 0) / 3600;
      const horasPorPessoa = horasTotais / equipe.length;
      const custoRegistro = equipe.reduce((s, id) => {
        const colab = colaboradores.find(c => c.id === id);
        const valorHora = colab?.salarioMensal ? colab.salarioMensal / HORAS_MES_PADRAO : 0;
        return s + horasPorPessoa * valorHora;
      }, 0);
      garantir(r.ordemProducaoId, r.ordemProducaoNumero).maoDeObra += custoRegistro;
    });
    (movimentacoesMaterial || []).forEach(mv => {
      if (!mv.ordemProducaoId) return;
      const d = new Date(mv.criadoEm);
      if (d < start || d > end) return;
      const custo = (mv.quantidadeConsumida || 0) * (mv.precoUnitarioSnap || 0);
      garantir(mv.ordemProducaoId, mv.ordemProducaoNumero).materiais += custo;
    });
    return Object.values(map).map(v => ({
      ...v,
      maoDeObra: Math.round(v.maoDeObra * 100) / 100,
      materiais: Math.round(v.materiais * 100) / 100,
      total: Math.round((v.maoDeObra + v.materiais) * 100) / 100,
    })).sort((a, b) => b.total - a.total);
  }, [concluidosPeriodo, movimentacoesMaterial, colaboradores, ordensProducao, start, end]);

  // Adicionado: consolida a necessidade de materiais de todas as OPs
  // ainda em aberto (ficha de consumo de cada produto × quantidade na
  // OP), comparando com o estoque atual — mostra o que falta comprar ou
  // separar antes das ordens serem concluídas.
  const materiaisPendentes = useMemo(() => {
    const soma = {};
    (ordensProducao || []).filter(op => op.status === "aberta").forEach(op => {
      (op.itens || []).forEach(item => {
        (consumosMaterial || []).filter(c => c.produtoId === item.produtoId).forEach(c => {
          const material = (materiais || []).find(m => m.id === c.materialId);
          if (!soma[c.materialId]) {
            soma[c.materialId] = { materialId: c.materialId, nome: material?.nome || "—", unidade: material?.unidade || "", necessario: 0, estoque: material?.quantidadeEstoque ?? 0, ops: new Set() };
          }
          soma[c.materialId].necessario += (c.quantidadePorPeca || 0) * item.quantidade;
          soma[c.materialId].ops.add(op.numero);
        });
      });
    });
    return Object.values(soma).map(m => ({
      ...m,
      necessario: Math.round(m.necessario * 1000) / 1000,
      deficit: Math.round((m.necessario - m.estoque) * 1000) / 1000,
      opsCount: m.ops.size,
    })).sort((a, b) => b.deficit - a.deficit);
  }, [ordensProducao, consumosMaterial, materiais]);
  const materiaisComFalta = materiaisPendentes.filter(m => m.deficit > 0);

  // Adicionado: relatório imprimível da lista de materiais pendentes —
  // mesma tabela usada na tela, formatada para impressão/PDF, pra levar
  // pro fornecedor ou pro setor de compras.
  function imprimirMateriaisPendentes() {
    onImprimirGrade({
      titulo: "Materiais pendentes de OPs em aberto",
      subtitulo: `${materiaisPendentes.length} material(is) · ${materiaisComFalta.length} com falta no estoque`,
      geradoEm: new Date().toLocaleString("pt-BR"),
      colunas: [
        { key: "nome", label: "Material" },
        { key: "necessario", label: "Necessário", align: "right" },
        { key: "estoque", label: "Em estoque", align: "right" },
        { key: "falta", label: "Falta", align: "right" },
        { key: "ops", label: "OPs", align: "right" },
      ],
      linhas: materiaisPendentes.map(m => ({
        nome: m.nome,
        necessario: `${m.necessario} ${m.unidade}`,
        estoque: `${m.estoque} ${m.unidade}`,
        falta: m.deficit > 0 ? `${m.deficit} ${m.unidade}` : "—",
        ops: m.opsCount,
      })),
    });
  }

  // Adicionado: relatório específico de compras — todas as solicitações
  // com status, fornecedor vencedor (quando houver), valor negociado e
  // data de aprovação, mais os totais do período.
  const nomeMaterialRel = (id) => (materiais || []).find(m => m.id === id)?.nome || "—";
  const comprasNoPeriodo = useMemo(() => {
    return (solicitacoesCompra || []).filter(s => {
      const dataRef = s.concluidaEm || s.criadoEm;
      const d = new Date(dataRef);
      return d >= start && d <= end;
    }).map(s => {
      const cotacaoEscolhida = s.cotacaoEscolhidaId ? (cotacoesCompra || []).find(c => c.id === s.cotacaoEscolhidaId) : null;
      const valorTotal = cotacaoEscolhida ? cotacaoEscolhida.precoUnitario * s.quantidade : null;
      return { solicitacao: s, cotacao: cotacaoEscolhida, valorTotal };
    }).sort((a, b) => new Date(b.solicitacao.concluidaEm || b.solicitacao.criadoEm) - new Date(a.solicitacao.concluidaEm || a.solicitacao.criadoEm));
  }, [solicitacoesCompra, cotacoesCompra, start, end]);
  const totalCompradoPeriodo = comprasNoPeriodo.filter(x => x.solicitacao.status === "comprada").reduce((s, x) => s + (x.valorTotal || 0), 0);
  const totalAguardandoAprovacao = comprasNoPeriodo.filter(x => x.solicitacao.status === "aguardando_aprovacao").reduce((s, x) => s + (x.valorTotal || 0), 0);

  // Adicionado: relatório de controle de materiais — visão de estoque
  // (quantidade e valor) e movimentação (entradas x saídas) de cada
  // material no período selecionado.
  const controleMateriais = useMemo(() => {
    return (materiais || []).map(m => {
      const saidasPeriodo = (movimentacoesMaterial || []).filter(mv => mv.materialId === m.id && new Date(mv.criadoEm) >= start && new Date(mv.criadoEm) <= end)
        .reduce((s, mv) => s + (mv.quantidadeConsumida || 0), 0);
      const entradasPeriodo = (movimentacoesEstoque || []).filter(mv => mv.materialId === m.id && mv.tipo === "entrada" && new Date(mv.criadoEm) >= start && new Date(mv.criadoEm) <= end)
        .reduce((s, mv) => s + (mv.quantidade || 0), 0);
      const saidasManuaisPeriodo = (movimentacoesEstoque || []).filter(mv => mv.materialId === m.id && mv.tipo === "saida" && new Date(mv.criadoEm) >= start && new Date(mv.criadoEm) <= end)
        .reduce((s, mv) => s + (mv.quantidade || 0), 0);
      return {
        material: m, entradas: Math.round(entradasPeriodo * 1000) / 1000, saidas: Math.round((saidasPeriodo + saidasManuaisPeriodo) * 1000) / 1000,
        valorEstoque: Math.round((m.quantidadeEstoque || 0) * (m.preco || 0) * 100) / 100,
        estoqueBaixo: m.estoqueMinimo != null && m.quantidadeEstoque <= m.estoqueMinimo,
      };
    }).sort((a, b) => b.valorEstoque - a.valorEstoque);
  }, [materiais, movimentacoesMaterial, movimentacoesEstoque, start, end]);
  const valorTotalEstoque = controleMateriais.reduce((s, c) => s + c.valorEstoque, 0);
  const materiaisAbaixoMinimo = controleMateriais.filter(c => c.estoqueBaixo);

  // Adicionado: itens em aberto (processos ainda não concluídos) por
  // departamento, agrupados por etapa, colaborador ou função — cada grupo
  // mostra os itens que caem nele, com peças planejadas e tempo em aberto.
  const nomeSetorL = (id, r) => (setores || []).find(s => s.id === id)?.nome || r?.setorNomeSnap || "—";
  const funcaoColab = (id) => colaboradores.find(c => c.id === id)?.funcao || "Sem função definida";
  const abertosFiltrados = useMemo(() => registros.filter(r => r.status === "aberto" && (!filtroSetorAbertos || r.setorId === filtroSetorAbertos)), [registros, filtroSetorAbertos]);
  const gruposAbertos = useMemo(() => {
    const map = {};
    const garantir = (chave, label) => { if (!map[chave]) map[chave] = { chave, label, itens: [] }; return map[chave]; };
    abertosFiltrados.forEach(r => {
      if (agrupamentoAbertos === "etapa") {
        garantir(r.etapaId || `snap:${r.etapaNomeSnap}`, nomeEtapaL(r.etapaId, r)).itens.push(r);
      } else if (agrupamentoAbertos === "colaborador") {
        equipeDe(r).forEach(id => garantir(id, nomeColab(id)).itens.push(r));
      } else {
        equipeDe(r).forEach(id => garantir(funcaoColab(id), funcaoColab(id)).itens.push(r));
      }
    });
    return Object.values(map)
      .map(g => ({
        ...g,
        itens: ordenarRegistrosRelatorio(g.itens, { hora: r => r.inicio, etapa: r => nomeEtapaL(r.etapaId, r), operador: r => equipeDe(r).map(nomeColab).join(", ") }),
      }))
      .sort((a, b) => b.itens.length - a.itens.length);
  }, [abertosFiltrados, agrupamentoAbertos, colaboradores]);

  function montarRelatorioAbertosImpressao() {
    const presetLabelAbertos = filtroSetorAbertos ? (setores || []).find(s => s.id === filtroSetorAbertos)?.nome : "Todos os departamentos";
    const agrupamentoLabel = { etapa: "Por etapa", colaborador: "Por colaborador", funcao: "Por função" }[agrupamentoAbertos];
    onGerarRelatorioAbertos({
      departamentoTexto: presetLabelAbertos || "Todos os departamentos",
      agrupamentoLabel,
      geradoEm: new Date().toLocaleString("pt-BR"),
      grupos: gruposAbertos.map(g => ({
        label: g.label,
        itens: g.itens.map(r => ({
          produtoNome: nomeProdutoL(r.produtoId, r), etapaNome: nomeEtapaL(r.etapaId, r), setorNome: nomeSetorL(r.setorId, r),
          colaboradores: equipeDe(r).map(nomeColab).join(", "), quantidade: r.quantidade,
          inicio: new Date(r.inicio), equipamentoNome: r.equipamentoNomeSnap || null,
          // Adicionado: meta de peças/hora — só faz sentido pra etapas
          // "por peça" (uma etapa "por lote", como risco/enfesto do
          // Corte, não tem uma meta por hora, é um bloco só).
          metaPecasHora: (r.tipoCalculoEtapa !== "lote" && r.tempoEstimadoBaseSeg) ? Math.max(1, Math.floor(3600 / r.tempoEstimadoBaseSeg)) : null,
        })),
      })),
      totalItens: abertosFiltrados.length,
    });
  }

  function montarRelatorioImpressao() {
    if (!filtroColab) return;
    const colaborador = colaboradores.find(c => c.id === filtroColab);
    const porProdutoMap = {};
    concluidosPeriodo.forEach(r => {
      const chaveProduto = r.produtoId || `snap:${r.produtoNomeSnap || "—"}`;
      const chaveEtapa = r.etapaId || `snap:${r.etapaNomeSnap || "—"}`;
      if (!porProdutoMap[chaveProduto]) porProdutoMap[chaveProduto] = {};
      if (!porProdutoMap[chaveProduto][chaveEtapa]) porProdutoMap[chaveProduto][chaveEtapa] = [];
      porProdutoMap[chaveProduto][chaveEtapa].push(r);
    });
    const porProdutoEtapa = Object.entries(porProdutoMap).map(([chaveProduto, etapasMap]) => {
      const etapasArr = Object.entries(etapasMap).map(([chaveEtapa, regs]) => {
        const regsComMeta = comMeta(regs);
        const se = regsComMeta.reduce((s, r) => s + r.tempoEstimadoSeg, 0);
        const sr = regsComMeta.reduce((s, r) => s + (r.tempoRealConsideradoSeg ?? r.tempoRealSeg), 0);
        const eficiencia = mediaEficiencia(regsComMeta);
        const colegasSet = new Set();
        regs.forEach(r => equipeDe(r).forEach(id => { if (id !== filtroColab) colegasSet.add(nomeColab(id)); }));
        return {
          etapaNome: nomeEtapaL(regs[0].etapaId, regs[0]), colegas: Array.from(colegasSet),
          qtd: regs.reduce((s, r) => s + (r.quantidade || 1), 0),
          qtdBoa: regs.reduce((s, r) => s + (r.quantidadeBoa ?? r.quantidade ?? 1), 0),
          qtdDefeito: regs.reduce((s, r) => s + (r.quantidadeDefeito || 0), 0),
          retrabalhoMin: regs.reduce((s, r) => s + (r.tempoRetrabalhoMin || 0), 0),
          tempoRealSeg: sr, tempoEstimadoSeg: se, eficiencia: regsComMeta.length ? eficiencia : null, classificacao: regsComMeta.length ? classify(eficiencia) : null, registros: regs.length,
        };
      });
      const regsProduto = Object.values(etapasMap).flat();
      const regsProdutoComMeta = comMeta(regsProduto);
      const efProduto = mediaEficiencia(regsProdutoComMeta);
      return { produtoNome: nomeProdutoL(regsProduto[0].produtoId, regsProduto[0]), etapas: etapasArr, subtotalEficiencia: regsProdutoComMeta.length ? efProduto : null, subtotalClassificacao: regsProdutoComMeta.length ? classify(efProduto) : null };
    });

    const colabResumo = porColaborador.find(c => c.colaboradorId === filtroColab) || { mediaEf: mediaGeral, mediaAjustada: mediaGeral, penalidade: 0 };
    const avaliacoesColab = avaliacoesFiltradas.filter(a => a.colaboradorId === filtroColab);
    const presetLabel = (presets.find(p => p.key === preset) || {}).label || "Personalizado";
    const periodoTexto = `${start.toLocaleDateString("pt-BR")} a ${end.toLocaleDateString("pt-BR")} (${presetLabel})`;

    onGerarRelatorio({
      colaboradorNome: colaborador ? colaborador.nome : "—",
      colaboradorFuncao: colaborador ? colaborador.funcao : "",
      periodoTexto, porProdutoEtapa, colabResumo, avaliacoesColab,
      geradoEm: new Date().toLocaleString("pt-BR"),
    });
  }

  const presets = [
    { key: "dia", label: "Diário" },
    { key: "semana", label: "Semanal" },
    { key: "quinzena", label: "Quinzenal" },
    { key: "mes", label: "Mensal" },
    { key: "bimestre", label: "Bimestral" },
    { key: "trimestre", label: "Trimestral" },
    { key: "ano", label: "Anual" },
    { key: "custom", label: "Personalizado" },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Período</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: preset === "custom" ? 12 : 4 }}>
          {presets.map(p => <ToggleChip key={p.key} ativo={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</ToggleChip>)}
        </div>
        {preset === "custom" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            <Field label="De"><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} /></Field>
            <Field label="Até"><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} /></Field>
          </div>
        )}
        {/* Adicionado: deixa explícito qual faixa de datas está sendo
            considerada e quantos registros ela pegou — antes, um relatório
            vazio parecia defeito quando na verdade era só o filtro de
            período não alcançando os lançamentos. */}
        <div style={{
          fontSize: 11.5, color: concluidosPeriodo.length ? "#6b5d49" : "#8a6510",
          background: concluidosPeriodo.length ? "#f4efe2" : "#fdf3e0",
          border: `1px dashed ${concluidosPeriodo.length ? "#d9cfb7" : "#b5820a"}`,
          borderRadius: 7, padding: "7px 10px", marginBottom: 12,
        }}>
          {start.toLocaleDateString("pt-BR")} a {end.toLocaleDateString("pt-BR")} · {concluidosPeriodo.length} produção{concluidosPeriodo.length !== 1 ? "ões" : ""} concluída{concluidosPeriodo.length !== 1 ? "s" : ""}
          {concluidosPeriodo.length === 0 && " — nada lançado nesse período. Experimente um período maior (Mensal, Anual) ou use Personalizado."}
        </div>
        <Field label="Colaborador (opcional)">
          <Select value={filtroColab} onChange={e => setFiltroColab(e.target.value)}>
            <option value="">Todos</option>
            {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Field>
      </Card>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "resumo", label: "Resumo" },
          { key: "produto", label: "Por produto" },
          { key: "colaborador", label: "Por colaborador" },
          { key: "abertos", label: "Em aberto" },
          ...(ehAdministrador ? [{ key: "custos", label: "Custos" }, { key: "compras", label: "Compras" }, { key: "materiais", label: "Materiais" }] : []),
        ].map(a => (
          <button key={a.key} onClick={() => setAba(a.key)} style={{
            flex: "1 1 30%", border: "1.5px solid " + (aba === a.key ? "#2f4a63" : "#d9cfb7"),
            background: aba === a.key ? "#2f4a63" : "#fff", color: aba === a.key ? "#fff" : "#6b5d49",
            borderRadius: 9, padding: "9px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>{a.label}</button>
        ))}
      </div>

      {aba === "resumo" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, color: "#1c2b39" }}>Resumo do período</div>
              <div style={{ fontSize: 13, color: "#6b5d49" }}>{concluidosPeriodo.length} concluído{concluidosPeriodo.length !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 20, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1c2b39", lineHeight: 1.1 }}>{concluidosComMetaGeral.length ? `${mediaGeral}%` : "—"}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>eficiência média</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1c2b39", lineHeight: 1.1 }}>{qtdTotalProduzida}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>peças produzidas</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: qtdTotalDefeito ? "#b13232" : "#1c2b39", lineHeight: 1.1 }}>{qtdTotalDefeito}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>com defeito</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: qtdTotalRetrabalhoMin ? "#b13232" : "#1c2b39", lineHeight: 1.1 }}>{qtdTotalRetrabalhoMin}min</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>retrabalho</div>
              </div>
            </div>
            {concluidosPeriodo.length > concluidosComMetaGeral.length && (
              <div style={{ fontSize: 12, color: "#8a6510", marginBottom: 10 }}>
                {concluidosPeriodo.length - concluidosComMetaGeral.length} registro(s) sem tempo estimado cadastrado — não entram na média de eficiência.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {["A", "B", "C"].map(k => (
                <div key={k} style={{ background: CLASS_INFO[k].bg, borderRadius: 9, padding: "9px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: CLASS_INFO[k].color }}>{contagemGeral[k]}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: CLASS_INFO[k].color, marginTop: 2 }}>{CLASS_INFO[k].label}</div>
                  <div style={{ fontSize: 9.5, color: CLASS_INFO[k].color, opacity: 0.75 }}>{CLASS_INFO[k].desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 6, color: "#1c2b39" }}>Relatório para entrega</div>
            <div style={{ fontSize: 12.5, color: "#6b5d49", marginBottom: 12 }}>Gera um PDF por produto/etapa com desempenho e avaliações do período para o colaborador selecionado acima.</div>
            <PrimaryButton onClick={montarRelatorioImpressao} disabled={!filtroColab} style={{ width: "100%" }}>Gerar relatório em PDF</PrimaryButton>
            {!filtroColab && <div style={{ fontSize: 12, color: "#b5820a", marginTop: 8 }}>Selecione um colaborador específico no filtro acima para gerar o relatório.</div>}
          </Card>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Desempenho por colaborador</div>
          {porColaborador.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Sem registros neste período.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {porColaborador.map(c => (
              <Card key={c.colaboradorId} style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{c.nome}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#2f4a63" }}>{c.mediaAjustada}%</div>
                </div>
                {c.penalidade > 0 && <div style={{ fontSize: 11.5, color: "#b13232", marginBottom: 6 }}>Bruto {c.mediaEf}% − {c.penalidade} p.p. por faltas/atrasos</div>}
                <div style={{ height: 7, borderRadius: 999, background: "#efe8d8", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ height: "100%", width: `${Math.min(c.mediaAjustada, 100)}%`, background: "#2f4a63" }} />
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#6b5d49", flexWrap: "wrap" }}>
                  {["A", "B", "C"].map(k => <span key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}><Badge cls={k} /> {c.contagem[k]}</span>)}
                  <span style={{ marginLeft: "auto", color: "#a3937a" }}>{c.pecas} peças{c.defeitos ? ` · ${c.defeitos} c/ defeito` : ""}{c.retrabalhoMin ? ` · ${c.retrabalhoMin}min retrab.` : ""}{c.semMetaQtd ? ` · ${c.semMetaQtd} sem meta` : ""}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {aba === "produto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {porProduto.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Sem produção concluída neste período.</div>}
          {porProduto.map(p => (
            <Card key={p.produtoId || p.produtoNome} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ background: "#1c2b39", color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{p.produtoNome}</span>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{p.mediaProduto ? `${p.mediaProduto}%` : "—"}</span>
              </div>
              <div style={{ padding: "8px 0" }}>
                {p.colaboradores.map((c, i) => (
                  <div key={c.colaboradorId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: i < p.colaboradores.length - 1 ? "1px solid #efe8d8" : "none" }}>
                    <span style={{ fontSize: 13, color: "#2a2015" }}>{i + 1}. {c.nome}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#a3937a" }}>{c.pecas} peças</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#2f4a63" }}>{c.temMeta ? `${c.eficiencia}%` : "—"}</span>
                      {c.classificacao && <Badge cls={c.classificacao} />}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {aba === "colaborador" && (
        !filtroColab ? (
          <div style={{ fontSize: 13.5, color: "#b5820a", background: "#fdf3e0", padding: 12, borderRadius: 8 }}>Selecione um colaborador no filtro de período para ver o histórico por produto.</div>
        ) : !historicoColaborador || historicoColaborador.itens.length === 0 ? (
          <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma produção concluída neste período.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {historicoColaborador.itens.map((item, i) => {
              const destaque = item.chave === historicoColaborador.melhorChave ? "verde" : item.chave === historicoColaborador.piorChave ? "vermelho" : null;
              return (
                <Card key={i} style={{ padding: 12, borderLeft: destaque ? `4px solid ${COR_INFO[destaque].dot}` : undefined }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{item.produtoNome}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>{item.etapaNome} · {item.data.toLocaleDateString("pt-BR")} · {fmtSec(item.tempoRealSeg)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#2f4a63" }}>{item.eficiencia != null ? `${item.eficiencia}%` : "—"}</span>
                      {item.classificacao && <Badge cls={item.classificacao} />}
                    </div>
                  </div>
                  {destaque && <div style={{ fontSize: 11, fontWeight: 700, color: COR_INFO[destaque].color, marginTop: 6 }}>{destaque === "verde" ? "Produto de melhor desempenho" : "Produto de menor desempenho"}</div>}
                </Card>
              );
            })}
          </div>
        )
      )}
      {aba === "abertos" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Itens em aberto por departamento</div>
            <Field label="Departamento">
              <Select value={filtroSetorAbertos} onChange={e => setFiltroSetorAbertos(e.target.value)}>
                <option value="">Todos os departamentos</option>
                {(setores || []).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Select>
            </Field>
            <Field label="Agrupar">
              <div style={{ display: "flex", gap: 8 }}>
                <ToggleChip ativo={agrupamentoAbertos === "etapa"} onClick={() => setAgrupamentoAbertos("etapa")}>Por etapa</ToggleChip>
                <ToggleChip ativo={agrupamentoAbertos === "colaborador"} onClick={() => setAgrupamentoAbertos("colaborador")}>Por colaborador</ToggleChip>
                <ToggleChip ativo={agrupamentoAbertos === "funcao"} onClick={() => setAgrupamentoAbertos("funcao")}>Por função</ToggleChip>
              </div>
            </Field>
            <PrimaryButton onClick={montarRelatorioAbertosImpressao} disabled={abertosFiltrados.length === 0} style={{ width: "100%" }}>Gerar para impressão</PrimaryButton>
            {abertosFiltrados.length === 0 && <div style={{ fontSize: 12, color: "#a3937a", marginTop: 8 }}>Nenhum item em aberto para esse filtro.</div>}
          </Card>

          {gruposAbertos.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum item em aberto no momento.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {gruposAbertos.map(g => (
                <Card key={g.chave} style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ background: "#1c2b39", color: "#fff", padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{g.label}</span>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{g.itens.length} item{g.itens.length !== 1 ? "ns" : ""}</span>
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {g.itens.map((r, i) => {
                      const metaHora = r.tipoCalculoEtapa !== "lote" && r.tempoEstimadoBaseSeg ? Math.max(1, Math.floor(3600 / r.tempoEstimadoBaseSeg)) : null;
                      return (
                      <div key={r.id + i} style={{ padding: "8px 14px", borderBottom: i < g.itens.length - 1 ? "1px solid #efe8d8" : "none" }}>
                        <div style={{ fontSize: 13, color: "#2a2015", fontWeight: 600 }}>{nomeProdutoL(r.produtoId, r)} · {nomeEtapaL(r.etapaId, r)}</div>
                        <div style={{ fontSize: 11.5, color: "#a3937a" }}>
                          {nomeSetorL(r.setorId, r)} · {equipeDe(r).map(nomeColab).join(", ")} · {r.quantidade} peças · desde {new Date(r.inicio).toLocaleDateString("pt-BR")}
                          {r.equipamentoNomeSnap ? ` · ${r.equipamentoNomeSnap}` : ""}{metaHora ? ` · meta: ${metaHora} peças/h` : ""}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {aba === "custos" && ehAdministrador && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Custo das operações no período</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(custoMaoDeObraTotal)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>mão de obra</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(custoMateriaisTotal)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>materiais</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#2f4a63" }}>{fmtMoeda(custoTotalGeral)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>total</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 10 }}>
              Mão de obra estimada a partir do salário mensal ÷ {HORAS_MES_PADRAO}h, aplicado às horas reais trabalhadas em cada etapa concluída no período. Materiais pelo preço unitário registrado no momento de cada baixa de estoque.
            </div>
          </Card>

          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Mão de obra por colaborador</div>
          {custoMaoDeObraPorColaborador.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px", marginBottom: 16 }}>Sem produção concluída neste período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {custoMaoDeObraPorColaborador.map(c => (
                <Card key={c.colaboradorId} style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>{c.horas}h trabalhadas{!c.temSalario ? " · sem salário cadastrado" : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(c.custo)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Materiais consumidos por item</div>
          {custoMateriaisPorMaterial.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma baixa de material neste período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {custoMateriaisPorMaterial.map(m => (
                <Card key={m.materialId} style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{m.nome}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>{m.quantidade} consumidos{!m.temPreco ? " · sem preço cadastrado" : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(m.custo)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Gasto por pedido (OP)</div>
          {custoPorOP.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum gasto vinculado a pedidos neste período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {custoPorOP.map(o => (
                <Card key={o.opId} style={{ padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>OP #{String(o.numero ?? 0).padStart(3, "0")} · {o.cliente}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>Mão de obra {fmtMoeda(o.maoDeObra)} · Materiais {fmtMoeda(o.materiais)}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(o.total)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {aba === "compras" && ehAdministrador && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Compras no período</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a7a4c" }}>{fmtMoeda(totalCompradoPeriodo)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>comprado (aprovado)</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#8a5fb0" }}>{fmtMoeda(totalAguardandoAprovacao)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>aguardando aprovação</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1c2b39" }}>{comprasNoPeriodo.length}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>solicitações no período</div>
              </div>
            </div>
          </Card>

          {comprasNoPeriodo.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma solicitação de compra neste período.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {comprasNoPeriodo.map(({ solicitacao: s, cotacao: c, valorTotal }) => {
                const statusInfo = STATUS_SOLICITACAO[s.status] || STATUS_SOLICITACAO.pendente;
                return (
                  <Card key={s.id} style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{nomeMaterialRel(s.materialId)}</div>
                        <div style={{ fontSize: 12, color: "#6b5d49" }}>{s.quantidade} un. {c ? `· ${c.fornecedorNomeSnap}` : ""}</div>
                        <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 2 }}>{new Date(s.concluidaEm || s.criadoEm).toLocaleDateString("pt-BR")}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {valorTotal != null && <div style={{ fontSize: 14, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(valorTotal)}</div>}
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: statusInfo.color, background: statusInfo.bg, border: `1px dashed ${statusInfo.color}`, padding: "2px 8px 2px 7px", borderRadius: "3px 8px 8px 3px" }}>{statusInfo.label}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
      {aba === "materiais" && ehAdministrador && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Controle de materiais</div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(valorTotalEstoque)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>valor total em estoque</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: materiaisAbaixoMinimo.length ? "#b13232" : "#1c2b39" }}>{materiaisAbaixoMinimo.length}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#a3937a" }}>abaixo do mínimo</div>
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 2px 8px", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49" }}>
              Materiais pendentes de OPs em aberto{materiaisComFalta.length > 0 && <span style={{ color: "#b13232" }}> · {materiaisComFalta.length} com falta no estoque</span>}
            </div>
            <button onClick={imprimirMateriaisPendentes} disabled={materiaisPendentes.length === 0} style={{
              background: "transparent", border: "1px dashed " + (materiaisPendentes.length === 0 ? "#d9cfb7" : "#2f4a63"),
              color: materiaisPendentes.length === 0 ? "#a3937a" : "#2f4a63", fontSize: 11.5, fontWeight: 700,
              cursor: materiaisPendentes.length === 0 ? "not-allowed" : "pointer", padding: "4px 9px", borderRadius: "3px 9px 9px 3px", flexShrink: 0,
            }}>Imprimir</button>
          </div>
          {materiaisPendentes.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px", marginBottom: 16 }}>Nenhuma OP em aberto com materiais vinculados no momento.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {materiaisPendentes.map(m => (
                <Card key={m.materialId} style={{ padding: 12, borderLeft: m.deficit > 0 ? "4px solid #b13232" : "4px solid #2f4a63" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{m.nome}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>necessário: {m.necessario} {m.unidade} · estoque: {m.estoque} {m.unidade} · {m.opsCount} OP{m.opsCount !== 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: m.deficit > 0 ? "#b13232" : "#1a7a4c" }}>
                      {m.deficit > 0 ? `falta ${m.deficit} ${m.unidade}` : "ok"}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Estoque e movimentação no período</div>
          {controleMateriais.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum material cadastrado.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {controleMateriais.map(c => (
                <Card key={c.material.id} style={{ padding: 12, borderLeft: c.estoqueBaixo ? "4px solid #b13232" : "4px solid #2f4a63" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{c.material.nome}</div>
                      <div style={{ fontSize: 12, color: "#a3937a" }}>
                        estoque: {c.material.quantidadeEstoque} {c.material.unidade}{c.estoqueBaixo ? " · abaixo do mínimo" : ""}
                      </div>
                      <div style={{ fontSize: 11.5, color: "#a3937a" }}>no período: +{c.entradas} / −{c.saidas} {c.material.unidade}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1c2b39" }}>{fmtMoeda(c.valorEstoque)}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Relatório de impressão (PDF) ----------
function RelatorioImpressao({ payload, onFechar }) {
  const folhaRef = useRef(null);
  const [baixado, setBaixado] = useState(false);
  useEffect(() => { document.title = `Relatorio - ${payload.colaboradorNome}`; }, [payload]);

  function montarHtmlStandalone() {
    const conteudo = folhaRef.current ? folhaRef.current.outerHTML : "";
    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Relatorio - ${payload.colaboradorNome}</title>
      <style>
        @page { size: portrait; margin: 14mm; }
        * { box-sizing: border-box; }
        html, body { width: 100%; }
        body { margin: 0; padding: 24px; background: #fff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #2a2015; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { word-break: break-word; overflow-wrap: break-word; }
        .folha { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        tr, .produto-bloco { break-inside: avoid; page-break-inside: avoid; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>${conteudo}</body></html>`;
  }
  function handleBaixar() {
    if (!folhaRef.current) return;
    const html = montarHtmlStandalone();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = payload.colaboradorNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    a.download = `relatorio-${slug || "colaborador"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setBaixado(true);
  }
  function handleImprimir() {
    // Corrigido/adicionado: além de baixar o HTML, agora é possível imprimir
    // (ou "Salvar como PDF") diretamente do navegador, sem precisar baixar
    // e reabrir o arquivo manualmente.
    window.print();
  }

  const totalPecas = payload.porProdutoEtapa.reduce((s, p) => s + p.etapas.reduce((s2, e) => s2 + e.qtd, 0), 0);
  const totalDefeito = payload.porProdutoEtapa.reduce((s, p) => s + p.etapas.reduce((s2, e) => s2 + e.qtdDefeito, 0), 0);
  const totalRetrabalhoMin = payload.porProdutoEtapa.reduce((s, p) => s + p.etapas.reduce((s2, e) => s2 + e.retrabalhoMin, 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#efe9db" }}>
      <style>{`
        @page { size: portrait; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          .folha { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          body { background: #fff !important; }
          table { table-layout: fixed; }
          th, td { word-break: break-word; overflow-wrap: break-word; }
          tr, .produto-bloco { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10, background: "#1c2b39", color: "#fff",
        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <button onClick={onFechar} style={{ background: "transparent", border: "1px solid #46586a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Voltar para lançamentos</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleImprimir} style={{ background: "transparent", border: "1px solid #46586a", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimir / Salvar PDF</button>
          <button onClick={handleBaixar} style={{ background: "#2f4a63", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Baixar relatório</button>
        </div>
      </div>
      <div className="no-print" style={{ maxWidth: 720, margin: "10px auto 0", padding: "0 16px", fontSize: 12, color: "#6b5d49", textAlign: "center" }}>
        Use "Imprimir / Salvar PDF" para gerar o PDF direto, ou baixe o arquivo HTML para abrir e imprimir depois.
      </div>

      {baixado && (
        <div className="no-print" style={{
          maxWidth: 720, margin: "12px auto 0", padding: "12px 16px", background: "#e6f4ec", border: "1px solid #bfe3cf",
          borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
        }}>
          <span style={{ fontSize: 13, color: "#1a7a4c", fontWeight: 700 }}>✓ Relatório baixado com sucesso.</span>
          <button onClick={onFechar} style={{ background: "#1a7a4c", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Voltar para lançamentos</button>
        </div>
      )}

      <div className="folha" ref={folhaRef} style={{
        maxWidth: 720, margin: "20px auto 60px", background: "#fff", borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "32px 28px", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#2a2015",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1c2b39", paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>Relatório de desempenho</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1c2b39", marginTop: 2, fontFamily: FONT_DISPLAY }}>{payload.colaboradorNome}</div>
            <div style={{ fontSize: 13, color: "#6b5d49" }}><b>Função:</b> {payload.colaboradorFuncao || "não informada"}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#6b5d49" }}>
            <div><b>Período:</b> {payload.periodoTexto}</div>
            <div>Emitido em {payload.geradoEm}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 140px", background: "#f4efe2", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1c2b39" }}>{payload.colabResumo.mediaAjustada}%</div>
            <div style={{ fontSize: 11, color: "#6b5d49", fontWeight: 600 }}>desempenho final</div>
          </div>
          <div style={{ flex: "1 1 140px", background: "#f4efe2", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1c2b39" }}>{totalPecas}</div>
            <div style={{ fontSize: 11, color: "#6b5d49", fontWeight: 600 }}>peças produzidas</div>
          </div>
          <div style={{ flex: "1 1 140px", background: "#f4efe2", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: totalDefeito ? "#b13232" : "#1c2b39" }}>{totalDefeito}</div>
            <div style={{ fontSize: 11, color: "#6b5d49", fontWeight: 600 }}>peças com defeito</div>
          </div>
          <div style={{ flex: "1 1 140px", background: "#f4efe2", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: totalRetrabalhoMin ? "#b13232" : "#1c2b39" }}>{totalRetrabalhoMin}min</div>
            <div style={{ fontSize: 11, color: "#6b5d49", fontWeight: 600 }}>retrabalho</div>
          </div>
        </div>
        {payload.colabResumo.penalidade > 0 && (
          <div style={{ fontSize: 12.5, color: "#b13232", marginTop: -12, marginBottom: 20 }}>
            Desempenho bruto {payload.colabResumo.mediaEf}% − {payload.colabResumo.penalidade} p.p. por faltas/atrasos no período = <b>{payload.colabResumo.mediaAjustada}%</b>
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, color: "#1c2b39", marginBottom: 10 }}>Desempenho por produto e etapa</div>
        {payload.porProdutoEtapa.length === 0 && <div style={{ fontSize: 13, color: "#a3937a", marginBottom: 16 }}>Nenhuma produção concluída neste período.</div>}
        {payload.porProdutoEtapa.map((p, i) => (
          <div key={i} className="produto-bloco" style={{ marginBottom: 18, breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1c2b39", color: "#fff", borderRadius: "8px 8px 0 0", padding: "8px 12px" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.produtoNome}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.subtotalEficiencia != null ? <>{p.subtotalEficiencia}% <Badge cls={p.subtotalClassificacao} /></> : "—"}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f4efe2" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Etapa</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Boas</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Defeito</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Tempo real</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Meta</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>%</th>
                  <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Qual.</th>
                </tr>
              </thead>
              <tbody>
                {p.etapas.map((e, j) => (
                  <tr key={j} style={{ borderBottom: "1px solid #efe8d8" }}>
                    <td style={{ padding: "6px 10px" }}>
                      {e.etapaNome}
                      {e.colegas && e.colegas.length > 0 && <div style={{ fontSize: 10.5, color: "#6b5d49", fontWeight: 400 }}>Equipe: {e.colegas.join(", ")}</div>}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.qtdBoa}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: e.qtdDefeito ? "#b13232" : "inherit" }}>{e.qtdDefeito}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmtSec(e.tempoRealSeg)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.tempoEstimadoSeg != null ? fmtSec(e.tempoEstimadoSeg) : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{e.eficiencia != null ? `${e.eficiencia}%` : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>{e.classificacao ? <Badge cls={e.classificacao} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, color: "#1c2b39", margin: "22px 0 10px" }}>Avaliações do período</div>
        {payload.avaliacoesColab.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {payload.avaliacoesColab.map((a, i) => (
              <div key={i} style={{ fontSize: 12.5, borderBottom: "1px solid #efe8d8", padding: "6px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR")}</b>
                  <div style={{ display: "flex", gap: 6 }}>
                    {a.temFalta && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b13232", background: "#f8e6e6", padding: "2px 7px", borderRadius: 999 }}>Falta: {faltaInfo(a.tipoFalta).label}</span>}
                    {a.temAtraso && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b5820a", background: "#faf1dc", padding: "2px 7px", borderRadius: 999 }}>Atraso {a.minutosAtraso}min</span>}
                    {a.comportamento && comportamentoInfo(a.comportamento) && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: comportamentoInfo(a.comportamento).color, background: comportamentoInfo(a.comportamento).bg, padding: "2px 7px", borderRadius: 999 }}>{comportamentoInfo(a.comportamento).label}</span>
                    )}
                  </div>
                </div>
                <div style={{ color: "#6b5d49", marginTop: 2 }}>{a.descricao}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: "#a3937a", marginBottom: 20 }}>Nenhuma avaliação registrada no período.</div>
        )}

        <div style={{ display: "flex", gap: 24, marginTop: 40 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #2a2015", paddingTop: 6, fontSize: 12, color: "#6b5d49" }}>Colaborador</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ borderTop: "1px solid #2a2015", paddingTop: 6, fontSize: 12, color: "#6b5d49" }}>Líder responsável</div>
          </div>
        </div>
      </div>

      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 40px", padding: "0 16px", textAlign: "center" }}>
        <button onClick={onFechar} style={{ background: "#1c2b39", border: "none", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>← Voltar para lançamentos</button>
      </div>
    </div>
  );
}

// ---------- Relatório de itens em aberto (impressão) ----------
// Adicionado: página de impressão dedicada para o relatório de itens em
// aberto dos departamentos, agrupado por etapa, colaborador ou função —
// mesmo padrão de "Imprimir / Salvar PDF" já usado no relatório de
// desempenho do colaborador.
function RelatorioAbertosImpressao({ payload, onFechar }) {
  useEffect(() => { document.title = "Itens em aberto"; }, [payload]);
  function handleImprimir() { window.print(); }

  return (
    <div style={{ minHeight: "100vh", background: "#efe9db" }}>
      <style>{`
        @page { size: portrait; margin: 14mm; }
        @media print {
          .no-print { display: none !important; }
          .folha { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          body { background: #fff !important; }
          .grupo-bloco { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10, background: "#1c2b39", color: "#fff",
        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <button onClick={onFechar} style={{ background: "transparent", border: "1px solid #46586a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Voltar para relatórios</button>
        <button onClick={handleImprimir} style={{ background: "#2f4a63", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimir / Salvar PDF</button>
      </div>

      <div className="folha" style={{
        maxWidth: 720, margin: "20px auto 60px", background: "#fff", borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "32px 28px", fontFamily: FONT_BODY, color: "#2a2015",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1c2b39", paddingBottom: 14, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>Itens em aberto</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1c2b39", marginTop: 2, fontFamily: FONT_DISPLAY }}>{payload.departamentoTexto}</div>
            <div style={{ fontSize: 13, color: "#6b5d49" }}><b>Agrupado:</b> {payload.agrupamentoLabel}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#6b5d49" }}>
            <div><b>Total:</b> {payload.totalItens} item{payload.totalItens !== 1 ? "ns" : ""}</div>
            <div>Emitido em {payload.geradoEm}</div>
          </div>
        </div>

        {payload.grupos.length === 0 && <div style={{ fontSize: 13, color: "#a3937a" }}>Nenhum item em aberto.</div>}
        {payload.grupos.map((g, i) => (
          <div key={i} className="grupo-bloco" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1c2b39", color: "#fff", borderRadius: "8px 8px 0 0", padding: "8px 12px" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{g.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{g.itens.length} item{g.itens.length !== 1 ? "ns" : ""}</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f4efe2" }}>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Produto / Etapa</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Departamento</th>
                  <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Colaborador(es)</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Qtd.</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Meta/h</th>
                  <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: 700, color: "#6b5d49" }}>Início</th>
                </tr>
              </thead>
              <tbody>
                {g.itens.map((item, j) => (
                  <tr key={j} style={{ borderBottom: "1px solid #efe8d8" }}>
                    <td style={{ padding: "6px 10px" }}>{item.produtoNome} — {item.etapaNome}{item.equipamentoNome ? ` (${item.equipamentoNome})` : ""}</td>
                    <td style={{ padding: "6px 10px" }}>{item.setorNome}</td>
                    <td style={{ padding: "6px 10px" }}>{item.colaboradores}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{item.quantidade}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{item.metaPecasHora != null ? `${item.metaPecasHora}/h` : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{item.inicio.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="no-print" style={{ maxWidth: 720, margin: "0 auto 40px", padding: "0 16px", textAlign: "center" }}>
        <button onClick={onFechar} style={{ background: "#1c2b39", border: "none", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>← Voltar para relatórios</button>
      </div>
    </div>
  );
}

// ---------- Impressão em grade (tabela) — OP, Em aberto e Histórico ----------
// Adicionado: componente genérico reaproveitado nas três telas de
// Produção (a própria Ordem de Produção com todas as etapas, a lista de
// operações em aberto e o histórico de produção) — recebe colunas e
// linhas já prontas e desenha uma grade simples pronta pra imprimir ou
// salvar como PDF pelo próprio diálogo de impressão do navegador.
function RelatorioGradeImpressao({ payload, onFechar }) {
  useEffect(() => { document.title = payload.titulo; }, [payload]);
  function handleImprimir() { window.print(); }
  // Adicionado: quando o payload tem materiais e/ou anexos além da
  // tabela principal (caso da Ordem de Produção), o impresso sai em
  // folhas separadas — uma folha por seção — em vez de tudo empilhado
  // na mesma página. "Folha X de Y" ajuda a identificar cada uma depois
  // de impressas e separadas.
  const temMateriais = payload.materiais && payload.materiais.length > 0;
  const temAnexos = payload.anexos && payload.anexos.length > 0;
  const totalFolhas = 1 + (temMateriais ? 1 : 0) + (temAnexos ? 1 : 0);

  // Corrigido: orientação da folha agora vem do payload — a maioria dos
  // relatórios (grade da OP, materiais) usa tabelas largas e sai melhor
  // em paisagem, mas alguns (ex.: impressão de arte) ficam melhores em
  // retrato. "landscape" continua sendo o padrão pra não mudar o
  // comportamento de quem já usava esse impresso.
  const orientacao = payload.orientacao === "retrato" ? "portrait" : "landscape";

  return (
    <div style={{ minHeight: "100vh", background: "#efe9db" }}>
      <style>{`
        @page { size: ${orientacao}; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          .no-print-video { display: none !important; }
          .folha { box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; padding: 0 !important; }
          body { background: #fff !important; }
          table { table-layout: fixed; }
          th, td { word-break: break-word; overflow-wrap: break-word; }
          tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 10, background: "#1c2b39", color: "#fff",
        padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <button onClick={onFechar} style={{ background: "transparent", border: "1px solid #46586a", color: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Voltar para produção</button>
        <button onClick={handleImprimir} style={{ background: "#2f4a63", border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Imprimir / Salvar PDF</button>
      </div>

      <div className="folha" style={{
        maxWidth: 980, margin: "20px auto 60px", background: "#fff", borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)", padding: "28px 26px", fontFamily: FONT_BODY, color: "#2a2015",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1c2b39", paddingBottom: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>Controle de Produção</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1c2b39", marginTop: 2, fontFamily: FONT_DISPLAY }}>{payload.titulo}</div>
            {payload.subtitulo && <div style={{ fontSize: 13, color: "#6b5d49" }}>{payload.subtitulo}</div>}
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#6b5d49" }}>
            {totalFolhas > 1 && <div style={{ fontWeight: 700, color: "#2f4a63" }}>Folha 1 de {totalFolhas} · Atividades</div>}
            <div><b>Total:</b> {payload.linhas.length} linha{payload.linhas.length !== 1 ? "s" : ""}</div>
            <div>Emitido em {payload.geradoEm}</div>
          </div>
        </div>

        {payload.linhas.length === 0 ? (
          <div style={{ fontSize: 13, color: "#a3937a" }}>Nenhum item para exibir.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f4efe2" }}>
                {payload.colunas.map(c => (
                  <th key={c.key} style={{ textAlign: c.align || "left", padding: "7px 10px", fontWeight: 700, color: "#6b5d49", borderBottom: "1.5px solid #e6ddc8" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.linhas.map((linha, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #efe8d8", background: i % 2 === 1 ? "#faf6ec" : "transparent" }}>
                  {payload.colunas.map(c => (
                    <td key={c.key} style={{ textAlign: c.align || "left", padding: "6px 10px" }}>{linha[c.key] ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {payload.materiais && payload.materiais.length > 0 && (
          // Adicionado: começa numa folha nova ao imprimir — a OP agora
          // sai impressa em folhas separadas (Atividades / Materiais /
          // Arquivos), cada uma podendo ir pra uma pessoa diferente
          // (produção, separação de materiais, referência visual).
          <div style={{ marginTop: 22, pageBreakBefore: "always", breakBefore: "page" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>{payload.titulo}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1c2b39", marginTop: 2, fontFamily: FONT_DISPLAY }}>Materiais necessários</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2f4a63" }}>Folha 2 de {totalFolhas}</div>
            </div>
            <div style={{ marginTop: 10 }} />
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f4efe2" }}>
                  <th style={{ textAlign: "left", padding: "7px 10px", fontWeight: 700, color: "#6b5d49", borderBottom: "1.5px solid #e6ddc8" }}>Material</th>
                  <th style={{ textAlign: "right", padding: "7px 10px", fontWeight: 700, color: "#6b5d49", borderBottom: "1.5px solid #e6ddc8" }}>Necessário</th>
                  <th style={{ textAlign: "right", padding: "7px 10px", fontWeight: 700, color: "#6b5d49", borderBottom: "1.5px solid #e6ddc8" }}>Em estoque</th>
                  <th style={{ textAlign: "center", padding: "7px 10px", fontWeight: 700, color: "#6b5d49", borderBottom: "1.5px solid #e6ddc8" }}>Separado</th>
                </tr>
              </thead>
              <tbody>
                {payload.materiais.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #efe8d8", background: i % 2 === 1 ? "#faf6ec" : "transparent" }}>
                    <td style={{ padding: "6px 10px" }}>{m.nome}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{m.quantidade} {m.unidade}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{m.estoque != null ? `${m.estoque} ${m.unidade}` : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", color: "#a3937a" }}>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {payload.anexos && payload.anexos.length > 0 && (
          <div style={{ marginTop: 22, pageBreakBefore: "always", breakBefore: "page" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#6b5d49", textTransform: "uppercase" }}>{payload.titulo}</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1c2b39", marginTop: 2, fontFamily: FONT_DISPLAY }}>Arquivos anexados</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#2f4a63" }}>Folha {totalFolhas} de {totalFolhas}</div>
            </div>
            {/* Adicionado: 2 colunas com imagem grande (cada uma ocupando
                metade da folha em paisagem) em vez de uma grade de
                miniaturas — referência visual de verdade pra quem corta/
                estampa a peça, não só um lembrete de que existe um anexo.
                A cada 2 arquivos força quebra de folha, pra manter
                sempre 2 por página. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {payload.anexos.map((a, i) => (
                <div key={a.id} style={{
                  border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden", breakInside: "avoid",
                  pageBreakAfter: i % 2 === 1 && i !== payload.anexos.length - 1 ? "always" : "auto",
                  breakAfter: i % 2 === 1 && i !== payload.anexos.length - 1 ? "page" : "auto",
                }}>
                  {a.tipo && a.tipo.startsWith("image/") ? (
                    <img src={a.dataUrl} alt={a.nome} style={{ width: "100%", height: "46vh", objectFit: "contain", display: "block", background: "#f4efe2" }} />
                  ) : a.tipo && a.tipo.startsWith("video/") ? (
                    <video src={a.dataUrl} controls style={{ width: "100%", height: "46vh", objectFit: "contain", display: "block", background: "#000" }} className="no-print-video" />
                  ) : (
                    <div style={{ width: "100%", height: "46vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#a3937a" }}>Arquivo</div>
                  )}
                  <div style={{ fontSize: 12, color: "#6b5d49", padding: "6px 9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                </div>
              ))}
            </div>
            <div className="no-print" style={{ fontSize: 11, color: "#a3937a", marginTop: 8 }}>Vídeos não aparecem no PDF impresso — só na tela. Nomes dos arquivos ficam listados no impresso.</div>
          </div>
        )}
      </div>

      <div className="no-print" style={{ maxWidth: 980, margin: "0 auto 40px", padding: "0 16px", textAlign: "center" }}>
        <button onClick={onFechar} style={{ background: "#1c2b39", border: "none", color: "#fff", borderRadius: 8, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>← Voltar para produção</button>
      </div>
    </div>
  );
}

// ---------- Cadastros ----------
function Cadastros({ produtos, setProdutos, etapas, setEtapas, vinculos, setVinculos, colaboradores, setColaboradores, setores, setSetores, equipes, setEquipes, anexos, onSalvarAnexos, onRemoverAnexo, acessos, clientes, setClientes, materiais, setMateriais, consumosMaterial, setConsumosMaterial, fornecedores, setFornecedores, equipamentos, setEquipamentos, solicitacoesCompra, cotacoesCompra, feriados, setFeriados, gruposProduto, setGruposProduto, gruposMaterial, setGruposMaterial, tamanhos, setTamanhos, ehAdministrador }) {
  const [sub, setSub] = useState("departamentos");

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "departamentos", label: "Departamentos" },
          { key: "produtos", label: "Produtos" },
          { key: "materiais", label: "Materiais" },
          { key: "fornecedores", label: "Fornecedores" },
          { key: "equipamentos", label: "Equipamentos" },
          { key: "colaboradores", label: "Colaboradores" },
          { key: "equipes", label: "Equipes" },
          { key: "clientes", label: "Clientes" },
          { key: "feriados", label: "Feriados" },
        ].map(s => (
          <button key={s.key} onClick={() => setSub(s.key)} style={{
            flex: "1 1 30%", border: "1.5px solid " + (sub === s.key ? "#2f4a63" : "#d9cfb7"),
            background: sub === s.key ? "#2f4a63" : "#fff", color: sub === s.key ? "#fff" : "#6b5d49",
            borderRadius: 9, padding: "9px 4px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>
      {sub === "departamentos" && <DepartamentosCadastro setores={setores} setSetores={setSetores} etapas={etapas} setEtapas={setEtapas} vinculos={vinculos} setVinculos={setVinculos} equipes={equipes} setEquipes={setEquipes} anexos={anexos} onSalvarAnexos={onSalvarAnexos} onRemoverAnexo={onRemoverAnexo} />}
      {sub === "colaboradores" && <ColaboradoresCadastro colaboradores={colaboradores} setColaboradores={setColaboradores} acessos={acessos} ehAdministrador={ehAdministrador} />}
      {sub === "equipes" && <EquipesCadastro equipes={equipes} setEquipes={setEquipes} setores={setores} colaboradores={colaboradores} />}
      {sub === "produtos" && (
        <ProdutosCadastro
          produtos={produtos} setProdutos={setProdutos} etapas={etapas} vinculos={vinculos} setVinculos={setVinculos} setores={setores}
          materiais={materiais} consumosMaterial={consumosMaterial} setConsumosMaterial={setConsumosMaterial} colaboradores={colaboradores}
          gruposProduto={gruposProduto} setGruposProduto={setGruposProduto}
          tamanhos={tamanhos} setTamanhos={setTamanhos}
          ehAdministrador={ehAdministrador}
        />
      )}
      {sub === "materiais" && <MateriaisCadastro materiais={materiais} setMateriais={setMateriais} consumosMaterial={consumosMaterial} setConsumosMaterial={setConsumosMaterial} fornecedores={fornecedores} setFornecedores={setFornecedores} gruposMaterial={gruposMaterial} setGruposMaterial={setGruposMaterial} />}
      {sub === "fornecedores" && <FornecedoresCadastro fornecedores={fornecedores} setFornecedores={setFornecedores} solicitacoesCompra={solicitacoesCompra} cotacoesCompra={cotacoesCompra} materiais={materiais} />}
      {sub === "equipamentos" && <EquipamentosCadastro equipamentos={equipamentos} setEquipamentos={setEquipamentos} setores={setores} />}
      {sub === "clientes" && <ClientesCadastro clientes={clientes} setClientes={setClientes} />}
      {sub === "feriados" && <FeriadosCadastro feriados={feriados} setFeriados={setFeriados} />}
    </div>
  );
}

// Adicionado: "Departamentos" reúne o que antes eram as abas separadas
// Setores e Etapas — o departamento (Corte, Silk, Preparação, Costura,
// Embalagem...) é o cadastro principal, e "Atividades" é a sub-aba que
// define as tarefas de cada departamento (mesmo cadastro de etapas de
// antes, só reorganizado para refletir a hierarquia real da confecção).
function DepartamentosCadastro({ setores, setSetores, etapas, setEtapas, vinculos, setVinculos, equipes, setEquipes, anexos, onSalvarAnexos, onRemoverAnexo }) {
  const [subsub, setSubsub] = useState("departamentos");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[
          { key: "departamentos", label: "Departamentos" },
          { key: "atividades", label: "Atividades" },
        ].map(s => (
          <button key={s.key} onClick={() => setSubsub(s.key)} style={{
            flex: 1, border: "1.5px dashed " + (subsub === s.key ? "#2f4a63" : "#d9cfb7"),
            background: subsub === s.key ? "#f4ecd8" : "#fff", color: subsub === s.key ? "#2f4a63" : "#6b5d49",
            borderRadius: 8, padding: "7px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{s.label}</button>
        ))}
      </div>
      {subsub === "departamentos" && <SetoresCadastro setores={setores} setSetores={setSetores} etapas={etapas} setEtapas={setEtapas} equipes={equipes} setEquipes={setEquipes} anexos={anexos} onSalvarAnexos={onSalvarAnexos} onRemoverAnexo={onRemoverAnexo} />}
      {subsub === "atividades" && <EtapasCadastro etapas={etapas} setEtapas={setEtapas} vinculos={vinculos} setVinculos={setVinculos} setores={setores} />}
    </div>
  );
}

const TIPOS_SETOR = [
  { key: "padrao", label: "Padrão" },
  { key: "corte", label: "Corte (campos extras)" },
  { key: "silk", label: "Silk (campos extras)" },
];

function SetoresCadastro({ setores, setSetores, etapas, setEtapas, equipes, setEquipes, anexos, onSalvarAnexos, onRemoverAnexo }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("padrao");
  const [expandido, setExpandido] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [tipoEdicao, setTipoEdicao] = useState("padrao");
  const fileInputRef = useRef(null);

  async function adicionar() {
    if (!nome.trim()) return;
    await setSetores([...setores, { id: uid(), nome: nome.trim(), tipo }]);
    setNome(""); setTipo("padrao");
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este setor? As etapas vinculadas a ele ficarão sem setor.")) return;
    await setSetores(setores.filter(s => s.id !== id));
    await setEtapas(etapas.map(e => e.setorId === id ? { ...e, setorId: null } : e));
    await setEquipes(equipes.filter(eq => eq.setorId !== id));
    const anexosDoSetorAExcluir = anexos.filter(a => a.setorId === id);
    await Promise.all(anexosDoSetorAExcluir.map(a => onRemoverAnexo(a.id)));
  }
  function iniciarEdicao(s) {
    setEditandoId(s.id); setNomeEdicao(s.nome); setTipoEdicao(s.tipo || "padrao"); setExpandido(s.id);
  }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    await setSetores(setores.map(s => s.id === id ? { ...s, nome: nomeEdicao.trim(), tipo: tipoEdicao } : s));
    setEditandoId(null);
  }
  const qtdEtapas = (id) => etapas.filter(e => e.setorId === id).length;
  const anexosDoSetor = (id) => anexos.filter(a => a.setorId === id);

  async function anexarArquivos(setorId, fileList) {
    const arquivos = Array.from(fileList || []);
    const novos = [];
    for (const file of arquivos) {
      if (file.size > 4.5 * 1024 * 1024) {
        alert(`"${file.name}" é maior que 4,5MB e não pode ser anexado.`);
        continue;
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      novos.push({ id: uid(), setorId, nome: file.name, tipo: file.type, dataUrl, criadoEm: new Date().toISOString() });
    }
    if (novos.length) await onSalvarAnexos(novos);
  }
  async function removerAnexoClick(id) {
    if (!window.confirm("Remover este anexo?")) return;
    await onRemoverAnexo(id);
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo setor</div>
        <Field label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Silk, Corte, Preparação" style={inputStyle} onKeyDown={e => e.key === "Enter" && adicionar()} />
        </Field>
        <Field label="Tipo de setor">
          <Select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_SETOR.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </Select>
          <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Define quais campos extras aparecem ao iniciar produção neste setor (independente do nome escolhido).</div>
        </Field>
        <PrimaryButton onClick={adicionar} disabled={!nome.trim()} style={{ width: "100%" }}><Plus size={16} /> Adicionar setor</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {setores.map(s => {
          const aberto = expandido === s.id;
          const editando = editandoId === s.id;
          const anexosSetor = anexosDoSetor(s.id);
          return (
            <Card key={s.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div onClick={() => !editando && setExpandido(aberto ? null : s.id)} style={{ cursor: "pointer", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{s.nome}</div>
                  <div style={{ fontSize: 12, color: "#a3937a" }}>
                    {(TIPOS_SETOR.find(t => t.key === (s.tipo || "padrao")) || TIPOS_SETOR[0]).label} · {qtdEtapas(s.id)} etapa{qtdEtapas(s.id) !== 1 ? "s" : ""} · {anexosSetor.length} anexo{anexosSetor.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <IconButton onClick={(e) => { e.stopPropagation(); iniciarEdicao(s); }} title="Editar"><ClipboardList size={15} /></IconButton>
                <IconButton onClick={(e) => { e.stopPropagation(); excluir(s.id); }} danger title="Excluir setor"><Trash2 size={15} /></IconButton>
              </div>
              {aberto && (
                <div style={{ borderTop: "1px solid #efe8d8", padding: 14, background: "#faf6ec" }}>
                  {editando && (
                    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #efe8d8" }}>
                      <Field label="Nome">
                        <input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Tipo de setor">
                        <Select value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)}>
                          {TIPOS_SETOR.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </Select>
                      </Field>
                      <div style={{ display: "flex", gap: 8 }}>
                        <PrimaryButton onClick={() => salvarEdicao(s.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                        <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6b5d49", marginBottom: 8 }}>Fotos e arquivos do setor</div>
                  {anexosSetor.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                      {anexosSetor.map(a => (
                        <div key={a.id} style={{ position: "relative", border: "1px solid #e6ddc8", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                          {a.tipo && a.tipo.startsWith("image/") ? (
                            <img src={a.dataUrl} alt={a.nome} style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />
                          ) : (
                            <div style={{ width: "100%", height: 70, display: "flex", alignItems: "center", justifyContent: "center", color: "#a3937a" }}>
                              <Paperclip size={22} />
                            </div>
                          )}
                          <div style={{ fontSize: 9.5, color: "#6b5d49", padding: "3px 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nome}</div>
                          <button onClick={() => removerAnexoClick(a.id)} style={{ position: "absolute", top: 3, right: 3, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", color: "#b13232", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }}
                    onChange={e => { anexarArquivos(s.id, e.target.files); e.target.value = ""; }} />
                  <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
                    fontSize: 12.5, border: "1px solid #d9cfb7", background: "#fff", borderRadius: 7, padding: "7px 11px",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#6b5d49",
                  }}><Paperclip size={14} /> Anexar foto/arquivo</button>
                </div>
              )}
            </Card>
          );
        })}
        {setores.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum setor cadastrado.</div>}
      </div>
    </div>
  );
}

function EquipesCadastro({ equipes, setEquipes, setores, colaboradores }) {
  const [nome, setNome] = useState("");
  const [setorId, setSetorId] = useState("");
  const [membros, setMembros] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [setorEdicao, setSetorEdicao] = useState("");
  const [membrosEdicao, setMembrosEdicao] = useState([]);

  function toggleMembro(id) { setMembros(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]); }
  function toggleMembroEdicao(id) { setMembrosEdicao(m => m.includes(id) ? m.filter(x => x !== id) : [...m, id]); }
  async function adicionar() {
    if (!nome.trim() || membros.length === 0) return;
    await setEquipes([...equipes, { id: uid(), nome: nome.trim(), setorId: setorId || null, membros }]);
    setNome(""); setMembros([]);
  }
  async function excluir(id) { if (window.confirm("Excluir esta equipe?")) await setEquipes(equipes.filter(e => e.id !== id)); }
  function iniciarEdicao(eq) {
    setEditandoId(eq.id); setNomeEdicao(eq.nome); setSetorEdicao(eq.setorId || ""); setMembrosEdicao(eq.membros || []);
  }
  async function salvarEdicao(id) {
    // Corrigido: agora é possível renomear uma equipe, trocar seu setor ou
    // ajustar os membros sem excluir e recriar (equipes salvas eram usadas
    // apenas para preencher rapidamente o início de produção — perder a
    // equipe também perdia esse atalho).
    if (!nomeEdicao.trim() || membrosEdicao.length === 0) return;
    await setEquipes(equipes.map(eq => eq.id === id ? { ...eq, nome: nomeEdicao.trim(), setorId: setorEdicao || null, membros: membrosEdicao } : eq));
    setEditandoId(null);
  }
  const nomeSetor = (id) => setores.find(s => s.id === id)?.nome || "Qualquer setor";
  const nomeColab = (id) => colaboradores.find(c => c.id === id)?.nome || "—";
  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Nova equipe</div>
        <Field label="Nome da equipe"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Equipe Corte 1" style={inputStyle} /></Field>
        <Field label="Setor (opcional)">
          <Select value={setorId} onChange={e => setSetorId(e.target.value)}>
            <option value="">Qualquer setor</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </Field>
        {colaboradores.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#a3937a", marginBottom: 12 }}>Cadastre colaboradores primeiro para formar uma equipe.</div>
        ) : (
          <Field label="Membros">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {colaboradores.map(c => <ToggleChip key={c.id} ativo={membros.includes(c.id)} onClick={() => toggleMembro(c.id)}>{c.nome}</ToggleChip>)}
            </div>
          </Field>
        )}
        <PrimaryButton onClick={adicionar} disabled={!nome.trim() || membros.length === 0} style={{ width: "100%" }}><Plus size={16} /> Adicionar equipe</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {equipes.map(eq => {
          const editando = editandoId === eq.id;
          return (
            <Card key={eq.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome da equipe"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Setor (opcional)">
                    <Select value={setorEdicao} onChange={e => setSetorEdicao(e.target.value)}>
                      <option value="">Qualquer setor</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </Select>
                  </Field>
                  <Field label="Membros">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {colaboradores.map(c => <ToggleChip key={c.id} ativo={membrosEdicao.includes(c.id)} onClick={() => toggleMembroEdicao(c.id)}>{c.nome}</ToggleChip>)}
                    </div>
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(eq.id)} disabled={!nomeEdicao.trim() || membrosEdicao.length === 0} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{eq.nome}</div>
                    <div style={{ fontSize: 12, color: "#a3937a" }}>{nomeSetor(eq.setorId)} · {eq.membros.map(nomeColab).join(", ")}</div>
                  </div>
                  <div style={{ display: "flex" }}>
                    <IconButton onClick={() => iniciarEdicao(eq)} title="Editar"><ClipboardList size={15} /></IconButton>
                    <IconButton onClick={() => excluir(eq.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {equipes.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma equipe cadastrada.</div>}
      </div>
    </div>
  );
}

const TIPOS_CALCULO_ETAPA = [
  { key: "peca", label: "Por peça", desc: "tempo estimado é multiplicado pela quantidade" },
  { key: "lote", label: "Por lote", desc: "tempo estimado fixo, não multiplica pela quantidade" },
];

function EtapasCadastro({ etapas, setEtapas, vinculos, setVinculos, setores }) {
  const [nome, setNome] = useState("");
  const [setorId, setSetorId] = useState("");
  const [tipoCalculo, setTipoCalculo] = useState("peca");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [setorEdicao, setSetorEdicao] = useState("");
  const [tipoCalculoEdicao, setTipoCalculoEdicao] = useState("peca");

  async function adicionar() {
    if (!nome.trim() || !setorId) return;
    await setEtapas([...etapas, { id: uid(), nome: nome.trim(), setorId, tipoCalculo }]);
    setNome(""); setTipoCalculo("peca");
  }
  async function excluir(id) {
    const vinculosDaEtapa = vinculos.filter(v => v.etapaId === id);
    const aviso = vinculosDaEtapa.length > 0
      ? `Excluir esta etapa? Ela está vinculada a ${vinculosDaEtapa.length} produto(s) — os vínculos (com os tempos estimados) serão removidos também. Produções já concluídas mantêm o nome da etapa no histórico.`
      : "Excluir esta etapa?";
    if (!window.confirm(aviso)) return;
    await setEtapas(etapas.filter(e => e.id !== id));
    await setVinculos(vinculos.filter(v => v.etapaId !== id));
  }
  function iniciarEdicao(e) {
    setEditandoId(e.id); setNomeEdicao(e.nome); setSetorEdicao(e.setorId || ""); setTipoCalculoEdicao(e.tipoCalculo || "peca");
  }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    // Corrigido: agora é possível renomear uma etapa (ou mudar seu setor /
    // tipo de cálculo) sem precisar excluir e recriar — o que antes
    // apagava os vínculos com os produtos e os tempos estimados já
    // cadastrados.
    await setEtapas(etapas.map(e => e.id === id ? { ...e, nome: nomeEdicao.trim(), setorId: setorEdicao || null, tipoCalculo: tipoCalculoEdicao } : e));
    setEditandoId(null);
  }
  const nomeSetor = (id) => setores.find(s => s.id === id)?.nome || "Sem setor";
  const infoCalculo = (key) => TIPOS_CALCULO_ETAPA.find(t => t.key === (key || "peca")) || TIPOS_CALCULO_ETAPA[0];
  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Nova etapa</div>
        {setores.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#a3937a", marginBottom: 8 }}>Cadastre um setor primeiro (aba Setores).</div>
        ) : (
          <>
            <Field label="Setor">
              <Select value={setorId} onChange={e => setSetorId(e.target.value)}>
                <option value="">Selecione…</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </Select>
            </Field>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Fechamento lateral" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && adicionar()} />
            </div>
            <Field label="Tipo de cálculo do tempo">
              <div style={{ display: "flex", gap: 8 }}>
                {TIPOS_CALCULO_ETAPA.map(t => (
                  <ToggleChip key={t.key} ativo={tipoCalculo === t.key} onClick={() => setTipoCalculo(t.key)}>{t.label}</ToggleChip>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>{infoCalculo(tipoCalculo).desc}. Ex.: costura é "por peça"; risco/enfesto no Corte costumam ser "por lote".</div>
            </Field>
            <PrimaryButton onClick={adicionar} disabled={!nome.trim() || !setorId} style={{ width: "100%" }}><Plus size={16} /> Adicionar etapa</PrimaryButton>
          </>
        )}
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {etapas.map(e => {
          const editando = editandoId === e.id;
          return (
            <Card key={e.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome"><input value={nomeEdicao} onChange={ev => setNomeEdicao(ev.target.value)} style={inputStyle} /></Field>
                  <Field label="Setor">
                    <Select value={setorEdicao} onChange={ev => setSetorEdicao(ev.target.value)}>
                      <option value="">Sem setor</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </Select>
                  </Field>
                  <Field label="Tipo de cálculo do tempo">
                    <div style={{ display: "flex", gap: 8 }}>
                      {TIPOS_CALCULO_ETAPA.map(t => (
                        <ToggleChip key={t.key} ativo={tipoCalculoEdicao === t.key} onClick={() => setTipoCalculoEdicao(t.key)}>{t.label}</ToggleChip>
                      ))}
                    </div>
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(e.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#2a2015" }}>{e.nome}</span>
                    <div style={{ fontSize: 11.5, color: "#a3937a" }}>{nomeSetor(e.setorId)} · {infoCalculo(e.tipoCalculo).label}</div>
                  </div>
                  <div style={{ display: "flex" }}>
                    <IconButton onClick={() => iniciarEdicao(e)} title="Editar"><ClipboardList size={15} /></IconButton>
                    <IconButton onClick={() => excluir(e.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {etapas.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhuma etapa cadastrada.</div>}
      </div>
    </div>
  );
}

const PERFIS_COLABORADOR = [
  { key: "colaborador", label: "Colaborador" },
  { key: "gestor", label: "Gestor" },
  { key: "administrador", label: "Administrador" },
];

function ColaboradoresCadastro({ colaboradores, setColaboradores, acessos, ehAdministrador }) {
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const [salarioMensal, setSalarioMensal] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState("colaborador");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [funcaoEdicao, setFuncaoEdicao] = useState("");
  const [salarioEdicao, setSalarioEdicao] = useState("");
  const [senhaEdicao, setSenhaEdicao] = useState("");
  const [perfilEdicao, setPerfilEdicao] = useState("colaborador");

  async function adicionar() {
    if (!nome.trim()) return;
    await setColaboradores([...colaboradores, {
      id: uid(), nome: nome.trim(), funcao: funcao.trim(),
      // Adicionado: salário mensal do colaborador, usado como base para
      // cálculo de custo das operações (custo de mão de obra por hora/peça).
      salarioMensal: salarioMensal ? Math.round(parseFloat(salarioMensal) * 100) / 100 : null,
      // Adicionado: senha (opcional) para acessar o sistema com este
      // cadastro, e perfil de acesso que define quais abas o colaborador
      // enxerga ao entrar. Sem senha, basta selecionar o nome para entrar.
      senha: ehAdministrador ? (senha || null) : null,
      perfil: ehAdministrador ? perfil : "colaborador",
    }]);
    setNome(""); setFuncao(""); setSalarioMensal(""); setSenha(""); setPerfil("colaborador");
  }
  async function excluir(id) { if (window.confirm("Excluir este colaborador? O histórico de produção dele será mantido, mas ele some da lista de seleção.")) await setColaboradores(colaboradores.filter(c => c.id !== id)); }
  function iniciarEdicao(c) {
    setEditandoId(c.id); setNomeEdicao(c.nome); setFuncaoEdicao(c.funcao || ""); setSalarioEdicao(c.salarioMensal != null ? String(c.salarioMensal) : "");
    setSenhaEdicao(c.senha || ""); setPerfilEdicao(c.perfil || "colaborador");
  }
  async function salvarEdicao(id) {
    // Corrigido: agora é possível corrigir o nome/função de um colaborador
    // (ex.: erro de digitação) sem excluir e recriar — o que faria o
    // colaborador sumir de registros já concluídos com o mesmo id, além de
    // perder o histórico de acessos vinculado a ele.
    if (!nomeEdicao.trim()) return;
    await setColaboradores(colaboradores.map(c => c.id === id ? {
      ...c, nome: nomeEdicao.trim(), funcao: funcaoEdicao.trim(),
      salarioMensal: salarioEdicao ? Math.round(parseFloat(salarioEdicao) * 100) / 100 : null,
      senha: ehAdministrador ? (senhaEdicao || null) : c.senha,
      perfil: ehAdministrador ? perfilEdicao : (c.perfil || "colaborador"),
    } : c));
    setEditandoId(null);
  }
  const ultimosAcessos = [...(acessos || [])].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora)).slice(0, 15);
  const fmtSalario = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  const labelPerfil = (key) => (PERFIS_COLABORADOR.find(p => p.key === key) || PERFIS_COLABORADOR[0]).label;
  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo colaborador</div>
        <Field label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" style={inputStyle} /></Field>
        <Field label="Função (opcional)"><input value={funcao} onChange={e => setFuncao(e.target.value)} placeholder="Ex.: Costureira, Cortador" style={inputStyle} /></Field>
        <Field label="Salário mensal (opcional)">
          <input type="number" min="0" step="0.01" value={salarioMensal} onChange={e => setSalarioMensal(e.target.value)} placeholder="Ex.: 1800.00" style={inputStyle} />
          <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Usado como base para cálculo de custo das operações. Não aparece em relatórios de desempenho.</div>
        </Field>
        {ehAdministrador ? (
          <>
            <Field label="Senha de acesso (opcional)">
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Deixe em branco para entrar sem senha" style={inputStyle} />
            </Field>
            <Field label="Perfil de acesso">
              <Select value={perfil} onChange={e => setPerfil(e.target.value)}>
                {PERFIS_COLABORADOR.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </Select>
              <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 5 }}>Colaborador só vê Produção. Gestor e Administrador veem tudo — só o Administrador edita senha/perfil e compras.</div>
            </Field>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#a3937a", background: "#f4efe2", border: "1px dashed #d9cfb7", borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
            Senha e perfil de acesso só podem ser definidos por um administrador.
          </div>
        )}
        <PrimaryButton onClick={adicionar} disabled={!nome.trim()} style={{ width: "100%" }}><Plus size={16} /> Adicionar</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {colaboradores.map(c => {
          const editando = editandoId === c.id;
          return (
            <Card key={c.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Função (opcional)"><input value={funcaoEdicao} onChange={e => setFuncaoEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Salário mensal (opcional)">
                    <input type="number" min="0" step="0.01" value={salarioEdicao} onChange={e => setSalarioEdicao(e.target.value)} style={inputStyle} />
                  </Field>
                  {ehAdministrador ? (
                    <>
                      <Field label="Senha de acesso (opcional)">
                        <input type="password" value={senhaEdicao} onChange={e => setSenhaEdicao(e.target.value)} placeholder="Deixe em branco para entrar sem senha" style={inputStyle} />
                      </Field>
                      <Field label="Perfil de acesso">
                        <Select value={perfilEdicao} onChange={e => setPerfilEdicao(e.target.value)}>
                          {PERFIS_COLABORADOR.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </Select>
                      </Field>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "#a3937a", marginBottom: 14 }}>Senha e perfil só podem ser alterados por um administrador.</div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(c.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{c.nome}</div>
                    {c.funcao && <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{c.funcao}</div>}
                    <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 2 }}>
                      {fmtSalario(c.salarioMensal) ? `${fmtSalario(c.salarioMensal)}/mês · ` : ""}{labelPerfil(c.perfil)}{c.senha ? " · com senha" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex" }}>
                    <IconButton onClick={() => iniciarEdicao(c)} title="Editar"><ClipboardList size={15} /></IconButton>
                    <IconButton onClick={() => excluir(c.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {colaboradores.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum colaborador cadastrado.</div>}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: "#6b5d49", margin: "4px 2px 8px" }}>Últimos acessos ao sistema</div>
      {ultimosAcessos.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum acesso registrado ainda.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ultimosAcessos.map(a => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#6b5d49", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
            <span>{a.nome}</span>
            <span style={{ color: "#a3937a" }}>{new Date(a.dataHora).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Materiais (estoque e unidade) ----------
// Adicionado: cadastro de materiais com quantidade em estoque. É a base
// da aba Consumo — cada produto pode ter uma ficha de consumo (em
// Cadastros → Produtos) que informa quanto de cada material uma peça
// consome; quando uma OP é concluída, o estoque aqui cadastrado recebe a
// baixa automática.
const UNIDADES_MATERIAL = ["m", "kg", "un", "rolo", "cone", "l", "pacote"];

function MateriaisCadastro({ materiais, setMateriais, consumosMaterial, setConsumosMaterial, fornecedores, setFornecedores, gruposMaterial, setGruposMaterial }) {
  const [nome, setNome] = useState("");
  const [unidade, setUnidade] = useState("m");
  const [quantidadeEstoque, setQuantidadeEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [estoqueMaximo, setEstoqueMaximo] = useState("");
  const [preco, setPreco] = useState("");
  // Corrigido: fornecedor agora é o primeiro campo do cadastro (e
  // obrigatório) — é o código de cadastro dele que compõe o código do
  // material (fornecedor.sequência).
  const [fornecedorId, setFornecedorId] = useState("");
  const [novoFornecedorAberto, setNovoFornecedorAberto] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState("");
  // Adicionado: além do fornecedor principal (usado no código), o
  // material pode ter outros fornecedores que também vendem esse
  // material — útil pra cotar preço com mais de um na hora de comprar.
  const [outroFornecedorId, setOutroFornecedorId] = useState("");
  const [fornecedoresExtrasIds, setFornecedoresExtrasIds] = useState([]);
  // Adicionado: grupo de materiais — mesmo cadastro compartilhado com
  // Produtos (grupo_material), com opção de criar um novo ali mesmo.
  const [grupoMaterialId, setGrupoMaterialId] = useState("");
  const [novoGrupoAberto, setNovoGrupoAberto] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [unidadeEdicao, setUnidadeEdicao] = useState("m");
  const [estoqueMinimoEdicao, setEstoqueMinimoEdicao] = useState("");
  const [estoqueMaximoEdicao, setEstoqueMaximoEdicao] = useState("");
  const [precoEdicao, setPrecoEdicao] = useState("");
  const [fornecedorIdEdicao, setFornecedorIdEdicao] = useState("");
  const [novoFornecedorAbertoEdicao, setNovoFornecedorAbertoEdicao] = useState(false);
  const [novoFornecedorNomeEdicao, setNovoFornecedorNomeEdicao] = useState("");
  const [outroFornecedorIdEdicao, setOutroFornecedorIdEdicao] = useState("");
  const [fornecedoresExtrasIdsEdicao, setFornecedoresExtrasIdsEdicao] = useState([]);
  const [grupoMaterialIdEdicao, setGrupoMaterialIdEdicao] = useState("");
  const [novoGrupoAbertoEdicao, setNovoGrupoAbertoEdicao] = useState(false);
  const [novoGrupoNomeEdicao, setNovoGrupoNomeEdicao] = useState("");
  const [ajusteId, setAjusteId] = useState(null);
  const [ajusteValor, setAjusteValor] = useState("");
  const [ajusteTipo, setAjusteTipo] = useState("entrada");
  const fornecedorPorId = (id) => (fornecedores || []).find(f => f.id === id) || null;
  async function criarFornecedorRapido(nomeBruto, aoCriar) {
    const nomeCriado = nomeBruto.trim();
    if (!nomeCriado) return;
    const codigo = (fornecedores || []).reduce((max, f) => Math.max(max, f.codigo || 0), 0) + 1;
    const novo = { id: uid(), codigo, nome: nomeCriado, contato: "", categoria: "", observacao: "" };
    await setFornecedores([...(fornecedores || []), novo]);
    aoCriar(novo.id);
  }
  function adicionarFornecedorExtra() {
    if (!outroFornecedorId || outroFornecedorId === fornecedorId || fornecedoresExtrasIds.includes(outroFornecedorId)) return;
    setFornecedoresExtrasIds(ids => [...ids, outroFornecedorId]);
    setOutroFornecedorId("");
  }
  function removerFornecedorExtra(id) { setFornecedoresExtrasIds(ids => ids.filter(x => x !== id)); }
  function adicionarFornecedorExtraEdicao() {
    if (!outroFornecedorIdEdicao || outroFornecedorIdEdicao === fornecedorIdEdicao || fornecedoresExtrasIdsEdicao.includes(outroFornecedorIdEdicao)) return;
    setFornecedoresExtrasIdsEdicao(ids => [...ids, outroFornecedorIdEdicao]);
    setOutroFornecedorIdEdicao("");
  }
  function removerFornecedorExtraEdicao(id) { setFornecedoresExtrasIdsEdicao(ids => ids.filter(x => x !== id)); }
  const grupoMaterialPorId = (id) => gruposMaterial.find(g => g.id === id) || null;
  async function criarGrupoMaterial(nomeBruto, aoCriar) {
    const nomeCriado = nomeBruto.trim().toUpperCase();
    if (!nomeCriado) return;
    const codigo = gruposMaterial.reduce((max, g) => Math.max(max, g.codigo || 0), 0) + 1;
    const novo = { id: uid(), codigo, nome: nomeCriado };
    await setGruposMaterial([...gruposMaterial, novo]);
    aoCriar(novo.id);
  }
  // Adicionado: pesquisa por nome do material, fornecedor ou grupo — útil
  // quando o cadastro cresce e fica difícil rolar a lista toda.
  const [busca, setBusca] = useState("");
  const materiaisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return [...materiais]
      .filter(m => !termo || m.nome.toLowerCase().includes(termo) || (m.fornecedorNomeSnap || "").toLowerCase().includes(termo) || (m.fornecedoresExtrasNomesSnap || []).some(n => n.toLowerCase().includes(termo)) || (m.grupoMaterialNomeSnap || "").toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [materiais, busca]);

  const podeAdicionarMaterial = nome.trim().length > 0 && !!fornecedorId;

  async function adicionar() {
    if (!podeAdicionarMaterial) return;
    // Corrigido: o código do material passa a ser fornecedor + sequência
    // do cadastro (ex.: 003.014 = fornecedor 003, 14º material
    // cadastrado). A sequência continua sendo guardada à parte
    // (sequencia) — é ela que o cadastro de Produtos usa como
    // referência do segmento "tipo" no código do produto.
    const sequencia = materiais.reduce((max, m) => Math.max(max, m.sequencia || 0), 0) + 1;
    const fornecedor = fornecedorPorId(fornecedorId);
    const seg = (n) => String(n || 0).padStart(3, "0");
    await setMateriais([...materiais, {
      id: uid(), sequencia, codigo: `${seg(fornecedor?.codigo)}.${seg(sequencia)}`,
      nome: nome.trim(), unidade,
      quantidadeEstoque: quantidadeEstoque ? Math.round(parseFloat(quantidadeEstoque) * 1000) / 1000 : 0,
      estoqueMinimo: estoqueMinimo ? Math.round(parseFloat(estoqueMinimo) * 1000) / 1000 : null,
      // Adicionado: estoque máximo (usado para sugerir a quantidade de
      // uma solicitação de compra) e preço unitário — base do custo de
      // material nos relatórios e nas cotações de compra.
      estoqueMaximo: estoqueMaximo ? Math.round(parseFloat(estoqueMaximo) * 1000) / 1000 : null,
      preco: preco ? Math.round(parseFloat(preco) * 100) / 100 : null,
      // Adicionado: fornecedor principal do material (do cadastro de
      // Fornecedores) — o nome fica salvo junto (snapshot) pra continuar
      // aparecendo mesmo se o fornecedor for renomeado ou excluído depois.
      fornecedorId, fornecedorNomeSnap: fornecedor?.nome || null,
      // Adicionado: outros fornecedores que também vendem esse material,
      // além do principal — não entram no código, só ficam registrados
      // pra cotar preço na hora de comprar.
      fornecedoresExtrasIds: fornecedoresExtrasIds,
      fornecedoresExtrasNomesSnap: fornecedoresExtrasIds.map(id => fornecedorPorId(id)?.nome).filter(Boolean),
      grupoMaterialId: grupoMaterialId || null, grupoMaterialNomeSnap: grupoMaterialId ? grupoMaterialPorId(grupoMaterialId)?.nome || null : null,
    }]);
    setNome(""); setQuantidadeEstoque(""); setEstoqueMinimo(""); setEstoqueMaximo(""); setPreco(""); setFornecedorId(""); setFornecedoresExtrasIds([]); setGrupoMaterialId("");
  }
  async function excluir(id) {
    const consumosDoMaterial = consumosMaterial.filter(c => c.materialId === id);
    const aviso = consumosDoMaterial.length > 0
      ? `Excluir este material? Ele está na ficha de consumo de ${consumosDoMaterial.length} produto(s) — esses vínculos serão removidos também.`
      : "Excluir este material?";
    if (!window.confirm(aviso)) return;
    await setMateriais(materiais.filter(m => m.id !== id));
    await setConsumosMaterial(consumosMaterial.filter(c => c.materialId !== id));
  }
  function iniciarEdicao(m) {
    setEditandoId(m.id); setNomeEdicao(m.nome); setUnidadeEdicao(m.unidade || "m");
    setEstoqueMinimoEdicao(m.estoqueMinimo != null ? String(m.estoqueMinimo) : "");
    setEstoqueMaximoEdicao(m.estoqueMaximo != null ? String(m.estoqueMaximo) : "");
    setPrecoEdicao(m.preco != null ? String(m.preco) : "");
    setFornecedorIdEdicao(m.fornecedorId || "");
    setFornecedoresExtrasIdsEdicao(m.fornecedoresExtrasIds || []);
    setGrupoMaterialIdEdicao(m.grupoMaterialId || "");
  }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim() || !fornecedorIdEdicao) return;
    const fornecedor = fornecedorPorId(fornecedorIdEdicao);
    const seg = (n) => String(n || 0).padStart(3, "0");
    await setMateriais(materiais.map(m => m.id === id ? {
      ...m, nome: nomeEdicao.trim(), unidade: unidadeEdicao,
      estoqueMinimo: estoqueMinimoEdicao ? Math.round(parseFloat(estoqueMinimoEdicao) * 1000) / 1000 : null,
      estoqueMaximo: estoqueMaximoEdicao ? Math.round(parseFloat(estoqueMaximoEdicao) * 1000) / 1000 : null,
      preco: precoEdicao ? Math.round(parseFloat(precoEdicao) * 100) / 100 : null,
      fornecedorId: fornecedorIdEdicao, fornecedorNomeSnap: fornecedor?.nome || null,
      fornecedoresExtrasIds: fornecedoresExtrasIdsEdicao,
      fornecedoresExtrasNomesSnap: fornecedoresExtrasIdsEdicao.map(fid => fornecedorPorId(fid)?.nome).filter(Boolean),
      // Corrigido: se o fornecedor mudar na edição, o código é
      // recalculado com o novo fornecedor, mantendo a mesma sequência.
      codigo: `${seg(fornecedor?.codigo)}.${seg(m.sequencia)}`,
      grupoMaterialId: grupoMaterialIdEdicao || null, grupoMaterialNomeSnap: grupoMaterialIdEdicao ? grupoMaterialPorId(grupoMaterialIdEdicao)?.nome || null : null,
    } : m));
    setEditandoId(null);
  }
  function abrirAjuste(id) { setAjusteId(ajusteId === id ? null : id); setAjusteValor(""); setAjusteTipo("entrada"); }
  async function confirmarAjuste(m) {
    const valor = parseFloat(ajusteValor || "0");
    if (!(valor > 0)) return;
    const delta = ajusteTipo === "entrada" ? valor : -valor;
    await setMateriais(materiais.map(mm => mm.id === m.id ? { ...mm, quantidadeEstoque: Math.round((mm.quantidadeEstoque + delta) * 1000) / 1000 } : mm));
    setAjusteId(null); setAjusteValor("");
  }
  const fmtPreco = (v) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 4, color: "#1c2b39" }}>Novo material</div>
        <div style={{ fontSize: 11.5, color: "#a3937a", marginBottom: 10 }}>
          Código: <b style={{ color: "#6b5d49", fontFamily: "monospace" }}>{String(fornecedorPorId(fornecedorId)?.codigo || 0).padStart(3, "0")}.{String(materiais.reduce((max, m) => Math.max(max, m.sequencia || 0), 0) + 1).padStart(3, "0")}</b>
        </div>
        <Field label="Fornecedor (obrigatório)">
          <Select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
            <option value="">Selecione…</option>
            {[...(fornecedores || [])].sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.codigo != null ? `${String(f.codigo).padStart(3, "0")} · ` : ""}{f.nome}</option>)}
          </Select>
          <button type="button" onClick={() => setNovoFornecedorAberto(v => !v)} style={linkButtonStyle}>{novoFornecedorAberto ? "Cancelar" : "+ Novo fornecedor"}</button>
          {novoFornecedorAberto && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input value={novoFornecedorNome} onChange={e => setNovoFornecedorNome(e.target.value)} placeholder="Nome do fornecedor" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarFornecedorRapido(novoFornecedorNome, id => { setFornecedorId(id); setNovoFornecedorNome(""); setNovoFornecedorAberto(false); })} />
              <PrimaryButton onClick={() => criarFornecedorRapido(novoFornecedorNome, id => { setFornecedorId(id); setNovoFornecedorNome(""); setNovoFornecedorAberto(false); })} disabled={!novoFornecedorNome.trim()}><Plus size={16} /></PrimaryButton>
            </div>
          )}
        </Field>
        <Field label="Outros fornecedores (opcional)">
          <div style={{ display: "flex", gap: 6 }}>
            <Select value={outroFornecedorId} onChange={e => setOutroFornecedorId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Selecione…</option>
              {[...(fornecedores || [])].filter(f => f.id !== fornecedorId && !fornecedoresExtrasIds.includes(f.id)).sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
            <PrimaryButton onClick={adicionarFornecedorExtra} disabled={!outroFornecedorId}><Plus size={16} /></PrimaryButton>
          </div>
          {fornecedoresExtrasIds.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {fornecedoresExtrasIds.map(id => (
                <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f4efe2", border: "1px solid #d9cfb7", borderRadius: 999, padding: "3px 4px 3px 10px", fontSize: 12, color: "#6b5d49" }}>
                  {fornecedorPorId(id)?.nome || "—"}
                  <IconButton onClick={() => removerFornecedorExtra(id)} danger title="Remover"><X size={13} /></IconButton>
                </span>
              ))}
            </div>
          )}
        </Field>
        <Field label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Malha 100% algodão" style={inputStyle} onKeyDown={e => e.key === "Enter" && adicionar()} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Unidade">
            <Select value={unidade} onChange={e => setUnidade(e.target.value)}>
              {UNIDADES_MATERIAL.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
          <Field label="Preço unitário (opcional)">
            <input type="number" min="0" step="0.01" value={preco} onChange={e => setPreco(e.target.value)} placeholder="Ex.: 18.90" style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Estoque atual">
            <input type="number" min="0" step="0.01" value={quantidadeEstoque} onChange={e => setQuantidadeEstoque(e.target.value)} placeholder="0" style={inputStyle} />
          </Field>
          <Field label="Mínimo (opcional)">
            <input type="number" min="0" step="0.01" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} placeholder="Alerta" style={inputStyle} />
          </Field>
          <Field label="Máximo (opcional)">
            <input type="number" min="0" step="0.01" value={estoqueMaximo} onChange={e => setEstoqueMaximo(e.target.value)} placeholder="Ideal" style={inputStyle} />
          </Field>
        </div>
        <Field label="Grupo de materiais (opcional)">
          <Select value={grupoMaterialId} onChange={e => setGrupoMaterialId(e.target.value)}>
            <option value="">Selecione…</option>
            {[...gruposMaterial].sort((a, b) => a.codigo - b.codigo).map(g => <option key={g.id} value={g.id}>{String(g.codigo).padStart(3, "0")} · {g.nome}</option>)}
          </Select>
          <button type="button" onClick={() => setNovoGrupoAberto(v => !v)} style={linkButtonStyle}>{novoGrupoAberto ? "Cancelar" : "+ Novo grupo"}</button>
          {novoGrupoAberto && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value.toUpperCase())} placeholder="NOME DO GRUPO" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarGrupoMaterial(novoGrupoNome, id => { setGrupoMaterialId(id); setNovoGrupoNome(""); setNovoGrupoAberto(false); })} />
              <PrimaryButton onClick={() => criarGrupoMaterial(novoGrupoNome, id => { setGrupoMaterialId(id); setNovoGrupoNome(""); setNovoGrupoAberto(false); })} disabled={!novoGrupoNome.trim()}><Plus size={16} /></PrimaryButton>
            </div>
          )}
        </Field>
        <PrimaryButton onClick={adicionar} disabled={!podeAdicionarMaterial} style={{ width: "100%" }}><Plus size={16} /> Adicionar material</PrimaryButton>
        {!fornecedorId && <div style={{ fontSize: 11, color: "#a3937a", marginTop: 6, textAlign: "center" }}>Selecione (ou cadastre) o fornecedor para poder adicionar.</div>}
      </Card>

      {materiais.length > 0 && (
        <Card style={{ marginBottom: 12, padding: 12 }}>
          <Field label="Pesquisar material">
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome do material ou fornecedor…" style={inputStyle} />
          </Field>
        </Card>
      )}
      {materiais.length > 0 && materiaisFiltrados.length === 0 && (
        <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px", marginBottom: 8 }}>Nenhum material encontrado para essa pesquisa.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {materiaisFiltrados.map(m => {
          const editando = editandoId === m.id;
          const estoqueBaixo = m.estoqueMinimo != null && m.quantidadeEstoque <= m.estoqueMinimo;
          return (
            <Card key={m.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Unidade">
                      <Select value={unidadeEdicao} onChange={e => setUnidadeEdicao(e.target.value)}>
                        {UNIDADES_MATERIAL.map(u => <option key={u} value={u}>{u}</option>)}
                      </Select>
                    </Field>
                    <Field label="Preço unitário (opcional)">
                      <input type="number" min="0" step="0.01" value={precoEdicao} onChange={e => setPrecoEdicao(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Mínimo (opcional)">
                      <input type="number" min="0" step="0.01" value={estoqueMinimoEdicao} onChange={e => setEstoqueMinimoEdicao(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Máximo (opcional)">
                      <input type="number" min="0" step="0.01" value={estoqueMaximoEdicao} onChange={e => setEstoqueMaximoEdicao(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>
                  <Field label="Fornecedor (obrigatório)">
                    <Select value={fornecedorIdEdicao} onChange={e => setFornecedorIdEdicao(e.target.value)}>
                      <option value="">Selecione…</option>
                      {[...(fornecedores || [])].sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.codigo != null ? `${String(f.codigo).padStart(3, "0")} · ` : ""}{f.nome}</option>)}
                    </Select>
                    <button type="button" onClick={() => setNovoFornecedorAbertoEdicao(v => !v)} style={linkButtonStyle}>{novoFornecedorAbertoEdicao ? "Cancelar" : "+ Novo fornecedor"}</button>
                    {novoFornecedorAbertoEdicao && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input value={novoFornecedorNomeEdicao} onChange={e => setNovoFornecedorNomeEdicao(e.target.value)} placeholder="Nome do fornecedor" style={{ ...inputStyle, flex: 1 }} />
                        <PrimaryButton onClick={() => criarFornecedorRapido(novoFornecedorNomeEdicao, id => { setFornecedorIdEdicao(id); setNovoFornecedorNomeEdicao(""); setNovoFornecedorAbertoEdicao(false); })} disabled={!novoFornecedorNomeEdicao.trim()}><Plus size={16} /></PrimaryButton>
                      </div>
                    )}
                  </Field>
                  <Field label="Outros fornecedores (opcional)">
                    <div style={{ display: "flex", gap: 6 }}>
                      <Select value={outroFornecedorIdEdicao} onChange={e => setOutroFornecedorIdEdicao(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Selecione…</option>
                        {[...(fornecedores || [])].filter(f => f.id !== fornecedorIdEdicao && !fornecedoresExtrasIdsEdicao.includes(f.id)).sort((a, b) => a.nome.localeCompare(b.nome)).map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </Select>
                      <PrimaryButton onClick={adicionarFornecedorExtraEdicao} disabled={!outroFornecedorIdEdicao}><Plus size={16} /></PrimaryButton>
                    </div>
                    {fornecedoresExtrasIdsEdicao.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {fornecedoresExtrasIdsEdicao.map(id => (
                          <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f4efe2", border: "1px solid #d9cfb7", borderRadius: 999, padding: "3px 4px 3px 10px", fontSize: 12, color: "#6b5d49" }}>
                            {fornecedorPorId(id)?.nome || "—"}
                            <IconButton onClick={() => removerFornecedorExtraEdicao(id)} danger title="Remover"><X size={13} /></IconButton>
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                  <Field label="Grupo de materiais (opcional)">
                    <Select value={grupoMaterialIdEdicao} onChange={e => setGrupoMaterialIdEdicao(e.target.value)}>
                      <option value="">Selecione…</option>
                      {[...gruposMaterial].sort((a, b) => a.codigo - b.codigo).map(g => <option key={g.id} value={g.id}>{String(g.codigo).padStart(3, "0")} · {g.nome}</option>)}
                    </Select>
                    <button type="button" onClick={() => setNovoGrupoAbertoEdicao(v => !v)} style={linkButtonStyle}>{novoGrupoAbertoEdicao ? "Cancelar" : "+ Novo grupo"}</button>
                    {novoGrupoAbertoEdicao && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input value={novoGrupoNomeEdicao} onChange={e => setNovoGrupoNomeEdicao(e.target.value.toUpperCase())} placeholder="NOME DO GRUPO" style={{ ...inputStyle, flex: 1 }} />
                        <PrimaryButton onClick={() => criarGrupoMaterial(novoGrupoNomeEdicao, id => { setGrupoMaterialIdEdicao(id); setNovoGrupoNomeEdicao(""); setNovoGrupoAbertoEdicao(false); })} disabled={!novoGrupoNomeEdicao.trim()}><Plus size={16} /></PrimaryButton>
                      </div>
                    )}
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(m.id)} disabled={!nomeEdicao.trim() || !fornecedorIdEdicao} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>
                        {m.codigo != null && <span style={{ color: "#a3937a", fontWeight: 600, fontFamily: "monospace" }}>{m.codigo} · </span>}
                        {m.nome}
                      </div>
                      <div style={{ fontSize: 12, color: estoqueBaixo ? "#b13232" : "#a3937a" }}>
                        {m.quantidadeEstoque} {m.unidade} em estoque{estoqueBaixo ? " · abaixo do mínimo" : ""}
                        {m.estoqueMinimo != null || m.estoqueMaximo != null ? ` (min ${m.estoqueMinimo ?? "—"} / máx ${m.estoqueMaximo ?? "—"})` : ""}
                      </div>
                      {fmtPreco(m.preco) && <div style={{ fontSize: 11.5, color: "#a3937a" }}>{fmtPreco(m.preco)}/{m.unidade}</div>}
                      {m.grupoMaterialNomeSnap && <div style={{ fontSize: 11.5, color: "#a3937a" }}>Grupo: {m.grupoMaterialNomeSnap}</div>}
                      {m.fornecedorNomeSnap && (
                        <div style={{ fontSize: 11.5, color: "#a3937a" }}>
                          Fornecedor: {m.fornecedorNomeSnap}
                          {(m.fornecedoresExtrasNomesSnap || []).length > 0 ? ` · também: ${m.fornecedoresExtrasNomesSnap.join(", ")}` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex" }}>
                      <IconButton onClick={() => abrirAjuste(m.id)} title="Ajustar estoque"><Plus size={15} /></IconButton>
                      <IconButton onClick={() => iniciarEdicao(m)} title="Editar"><ClipboardList size={15} /></IconButton>
                      <IconButton onClick={() => excluir(m.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                    </div>
                  </div>
                  {ajusteId === m.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #efe8d8" }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <ToggleChip ativo={ajusteTipo === "entrada"} onClick={() => setAjusteTipo("entrada")}>Entrada</ToggleChip>
                        <ToggleChip ativo={ajusteTipo === "saida"} colorAtivo="#b13232" onClick={() => setAjusteTipo("saida")}>Saída</ToggleChip>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="number" min="0" step="0.01" value={ajusteValor} onChange={e => setAjusteValor(e.target.value)} placeholder={`Quantidade em ${m.unidade}`} style={{ ...inputStyle, flex: 1 }} />
                        <PrimaryButton onClick={() => confirmarAjuste(m)} disabled={!(parseFloat(ajusteValor || "0") > 0)}>Confirmar</PrimaryButton>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          );
        })}
        {materiais.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum material cadastrado.</div>}
      </div>
    </div>
  );
}

// ---------- Fornecedores (cadastro + histórico das últimas compras) ----------
// Adicionado: cadastro de fornecedores usado nas cotações de compra
// (Consumo → Compras). Ao expandir um fornecedor, mostra o histórico das
// compras já fechadas com ele — a partir das cotações vencedoras
// (solicitações cujo cotacaoEscolhidaId aponta pra uma cotação deste
// fornecedor).
function FornecedoresCadastro({ fornecedores, setFornecedores, solicitacoesCompra, cotacoesCompra, materiais }) {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [categoria, setCategoria] = useState("");
  const [observacao, setObservacao] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [contatoEdicao, setContatoEdicao] = useState("");
  const [categoriaEdicao, setCategoriaEdicao] = useState("");
  const [observacaoEdicao, setObservacaoEdicao] = useState("");
  const [expandidoId, setExpandidoId] = useState(null);

  async function adicionar() {
    if (!nome.trim()) return;
    // Adicionado: código numérico sequencial de cadastro — é esse código
    // que compõe o código do material (fornecedor + sequência) em
    // Cadastros → Materiais.
    const codigo = (fornecedores || []).reduce((max, f) => Math.max(max, f.codigo || 0), 0) + 1;
    await setFornecedores([...(fornecedores || []), {
      id: uid(), codigo, nome: nome.trim(), contato: contato.trim(), categoria: categoria.trim(), observacao: observacao.trim(),
    }]);
    setNome(""); setContato(""); setCategoria(""); setObservacao("");
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este fornecedor? As cotações já registradas com ele mantêm o nome salvo.")) return;
    await setFornecedores((fornecedores || []).filter(f => f.id !== id));
  }
  function iniciarEdicao(f) {
    setEditandoId(f.id); setNomeEdicao(f.nome); setContatoEdicao(f.contato || ""); setCategoriaEdicao(f.categoria || ""); setObservacaoEdicao(f.observacao || "");
  }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    await setFornecedores((fornecedores || []).map(f => f.id === id ? {
      ...f, nome: nomeEdicao.trim(), contato: contatoEdicao.trim(), categoria: categoriaEdicao.trim(), observacao: observacaoEdicao.trim(),
    } : f));
    setEditandoId(null);
  }
  const nomeMaterial = (id) => (materiais || []).find(m => m.id === id)?.nome || "—";

  // Histórico: para cada fornecedor, todas as cotações dele que venceram
  // a negociação (viraram compra), mais recentes primeiro.
  function historicoDoFornecedor(fornecedorId) {
    return (cotacoesCompra || [])
      .filter(c => c.fornecedorId === fornecedorId)
      .map(c => ({ cotacao: c, solicitacao: (solicitacoesCompra || []).find(s => s.cotacaoEscolhidaId === c.id) }))
      .filter(x => x.solicitacao)
      .sort((a, b) => new Date(b.solicitacao.concluidaEm || 0) - new Date(a.solicitacao.concluidaEm || 0));
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo fornecedor</div>
        <Field label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome ou razão social" style={inputStyle} /></Field>
        <Field label="Contato (opcional)"><input value={contato} onChange={e => setContato(e.target.value)} placeholder="Telefone, WhatsApp ou e-mail" style={inputStyle} /></Field>
        <Field label="Categoria (opcional)"><input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex.: Tecidos, Aviamentos, Embalagens" style={inputStyle} /></Field>
        <Field label="Observação (opcional)"><input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: prazo médio de entrega, condição preferida" style={inputStyle} /></Field>
        <PrimaryButton onClick={adicionar} disabled={!nome.trim()} style={{ width: "100%" }}><Plus size={16} /> Adicionar fornecedor</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(fornecedores || []).map(f => {
          const editando = editandoId === f.id;
          const aberto = expandidoId === f.id;
          const historico = historicoDoFornecedor(f.id);
          return (
            <Card key={f.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div onClick={() => !editando && setExpandidoId(aberto ? null : f.id)} style={{ cursor: "pointer", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>
                    {f.codigo != null && <span style={{ color: "#a3937a", fontWeight: 600, fontFamily: "monospace" }}>{String(f.codigo).padStart(3, "0")} · </span>}
                    {f.nome}
                  </div>
                  <div style={{ fontSize: 12, color: "#a3937a" }}>
                    {f.categoria ? `${f.categoria} · ` : ""}{f.contato || "sem contato"} · {historico.length} compra{historico.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <IconButton onClick={(e) => { e.stopPropagation(); iniciarEdicao(f); setExpandidoId(f.id); }} title="Editar"><ClipboardList size={15} /></IconButton>
                <IconButton onClick={(e) => { e.stopPropagation(); excluir(f.id); }} danger title="Excluir"><Trash2 size={15} /></IconButton>
              </div>
              {aberto && (
                <div style={{ borderTop: "1px solid #efe8d8", padding: 14, background: "#faf6ec" }}>
                  {editando && (
                    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #efe8d8" }}>
                      <Field label="Nome"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Contato (opcional)"><input value={contatoEdicao} onChange={e => setContatoEdicao(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Categoria (opcional)"><input value={categoriaEdicao} onChange={e => setCategoriaEdicao(e.target.value)} style={inputStyle} /></Field>
                      <Field label="Observação (opcional)"><input value={observacaoEdicao} onChange={e => setObservacaoEdicao(e.target.value)} style={inputStyle} /></Field>
                      <div style={{ display: "flex", gap: 8 }}>
                        <PrimaryButton onClick={() => salvarEdicao(f.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                        <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1c2b39", marginBottom: 8 }}>Histórico das últimas compras</div>
                  {historico.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#a3937a" }}>Nenhuma compra fechada com este fornecedor ainda.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {historico.slice(0, 20).map(({ cotacao, solicitacao }) => (
                        <div key={cotacao.id} style={{ background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "#2a2015" }}>{nomeMaterial(solicitacao.materialId)}</div>
                              <div style={{ fontSize: 11.5, color: "#6b5d49" }}>{solicitacao.quantidade} un. · {cotacao.precoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/un.</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#1c2b39" }}>{(cotacao.precoUnitario * solicitacao.quantidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                              <div style={{ fontSize: 10.5, color: "#a3937a" }}>{solicitacao.concluidaEm ? new Date(solicitacao.concluidaEm).toLocaleDateString("pt-BR") : "—"}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {(!fornecedores || fornecedores.length === 0) && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum fornecedor cadastrado.</div>}
      </div>
    </div>
  );
}

const STATUS_EQUIPAMENTO = [
  { key: "ativo", label: "Ativo", color: "#1a7a4c", bg: "#e6f4ec" },
  { key: "manutencao", label: "Em manutenção", color: "#b5820a", bg: "#fdf3e0" },
  { key: "inativo", label: "Inativo", color: "#b13232", bg: "#f8e6e6" },
];

// ---------- Equipamentos (máquinas por departamento) ----------
// Adicionado: cadastro de equipamentos/máquinas (ex.: overlock, galoneira,
// reta, plotter de corte, máquina de silk), vinculados a um departamento.
// Usado ao iniciar uma etapa de produção, para registrar em qual
// equipamento o trabalho foi feito.
function EquipamentosCadastro({ equipamentos, setEquipamentos, setores }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [setorId, setSetorId] = useState("");
  const [status, setStatus] = useState("ativo");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [tipoEdicao, setTipoEdicao] = useState("");
  const [setorEdicao, setSetorEdicao] = useState("");
  const [statusEdicao, setStatusEdicao] = useState("ativo");

  async function adicionar() {
    if (!nome.trim()) return;
    await setEquipamentos([...(equipamentos || []), {
      id: uid(), nome: nome.trim(), tipo: tipo.trim(), setorId: setorId || null, status,
    }]);
    setNome(""); setTipo(""); setSetorId(""); setStatus("ativo");
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este equipamento?")) return;
    await setEquipamentos((equipamentos || []).filter(e => e.id !== id));
  }
  function iniciarEdicao(e) {
    setEditandoId(e.id); setNomeEdicao(e.nome); setTipoEdicao(e.tipo || ""); setSetorEdicao(e.setorId || ""); setStatusEdicao(e.status || "ativo");
  }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    await setEquipamentos((equipamentos || []).map(e => e.id === id ? {
      ...e, nome: nomeEdicao.trim(), tipo: tipoEdicao.trim(), setorId: setorEdicao || null, status: statusEdicao,
    } : e));
    setEditandoId(null);
  }
  const nomeSetor = (id) => setores.find(s => s.id === id)?.nome || "Sem departamento";
  const infoStatus = (key) => STATUS_EQUIPAMENTO.find(s => s.key === key) || STATUS_EQUIPAMENTO[0];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo equipamento</div>
        <Field label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Overlock 03, Plotter de corte" style={inputStyle} /></Field>
        <Field label="Tipo/modelo (opcional)"><input value={tipo} onChange={e => setTipo(e.target.value)} placeholder="Ex.: Overlock 5 fios" style={inputStyle} /></Field>
        <Field label="Departamento (opcional)">
          <Select value={setorId} onChange={e => setSetorId(e.target.value)}>
            <option value="">Sem departamento</option>
            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <div style={{ display: "flex", gap: 8 }}>
            {STATUS_EQUIPAMENTO.map(s => (
              <ToggleChip key={s.key} ativo={status === s.key} colorAtivo={s.color} onClick={() => setStatus(s.key)}>{s.label}</ToggleChip>
            ))}
          </div>
        </Field>
        <PrimaryButton onClick={adicionar} disabled={!nome.trim()} style={{ width: "100%" }}><Plus size={16} /> Adicionar equipamento</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(equipamentos || []).map(eq => {
          const editando = editandoId === eq.id;
          const info = infoStatus(eq.status);
          return (
            <Card key={eq.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Tipo/modelo (opcional)"><input value={tipoEdicao} onChange={e => setTipoEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Departamento (opcional)">
                    <Select value={setorEdicao} onChange={e => setSetorEdicao(e.target.value)}>
                      <option value="">Sem departamento</option>
                      {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </Select>
                  </Field>
                  <Field label="Status">
                    <div style={{ display: "flex", gap: 8 }}>
                      {STATUS_EQUIPAMENTO.map(s => (
                        <ToggleChip key={s.key} ativo={statusEdicao === s.key} colorAtivo={s.color} onClick={() => setStatusEdicao(s.key)}>{s.label}</ToggleChip>
                      ))}
                    </div>
                  </Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(eq.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{eq.nome}</div>
                    <div style={{ fontSize: 12, color: "#a3937a" }}>{eq.tipo ? `${eq.tipo} · ` : ""}{nomeSetor(eq.setorId)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: info.color, background: info.bg, border: `1px dashed ${info.color}`, padding: "2px 8px 2px 7px", borderRadius: "3px 8px 8px 3px" }}>{info.label}</span>
                    <IconButton onClick={() => iniciarEdicao(eq)} title="Editar"><ClipboardList size={15} /></IconButton>
                    <IconButton onClick={() => excluir(eq.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {(!equipamentos || equipamentos.length === 0) && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum equipamento cadastrado.</div>}
      </div>
    </div>
  );
}

// ---------- Clientes (cadastro simples, usado para amarrar a OP) ----------
function ClientesCadastro({ clientes, setClientes }) {
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [contatoEdicao, setContatoEdicao] = useState("");
  const [observacaoEdicao, setObservacaoEdicao] = useState("");

  async function adicionar() {
    if (!nome.trim()) return;
    await setClientes([...(clientes || []), { id: uid(), nome: nome.trim(), contato: contato.trim(), observacao: observacao.trim() }]);
    setNome(""); setContato(""); setObservacao("");
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este cliente? Ordens de produção já vinculadas a ele mantêm o nome salvo.")) return;
    await setClientes((clientes || []).filter(c => c.id !== id));
  }
  function iniciarEdicao(c) { setEditandoId(c.id); setNomeEdicao(c.nome); setContatoEdicao(c.contato || ""); setObservacaoEdicao(c.observacao || ""); }
  async function salvarEdicao(id) {
    if (!nomeEdicao.trim()) return;
    await setClientes((clientes || []).map(c => c.id === id ? { ...c, nome: nomeEdicao.trim(), contato: contatoEdicao.trim(), observacao: observacaoEdicao.trim() } : c));
    setEditandoId(null);
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo cliente</div>
        <Field label="Nome"><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome ou razão social" style={inputStyle} /></Field>
        <Field label="Contato (opcional)"><input value={contato} onChange={e => setContato(e.target.value)} placeholder="Telefone, WhatsApp ou e-mail" style={inputStyle} /></Field>
        <Field label="Observação (opcional)"><input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: sempre pede embalagem individual" style={inputStyle} /></Field>
        <PrimaryButton onClick={adicionar} disabled={!nome.trim()} style={{ width: "100%" }}><Plus size={16} /> Adicionar cliente</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(clientes || []).map(c => {
          const editando = editandoId === c.id;
          return (
            <Card key={c.id} style={{ padding: "11px 14px" }}>
              {editando ? (
                <div>
                  <Field label="Nome"><input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Contato (opcional)"><input value={contatoEdicao} onChange={e => setContatoEdicao(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Observação (opcional)"><input value={observacaoEdicao} onChange={e => setObservacaoEdicao(e.target.value)} style={inputStyle} /></Field>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PrimaryButton onClick={() => salvarEdicao(c.id)} disabled={!nomeEdicao.trim()} style={{ flex: 1 }}>Salvar</PrimaryButton>
                    <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{c.nome}</div>
                    {c.contato && <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{c.contato}</div>}
                    {c.observacao && <div style={{ fontSize: 11.5, color: "#a3937a", marginTop: 2 }}>{c.observacao}</div>}
                  </div>
                  <div style={{ display: "flex" }}>
                    <IconButton onClick={() => iniciarEdicao(c)} title="Editar"><ClipboardList size={15} /></IconButton>
                    <IconButton onClick={() => excluir(c.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {(!clientes || clientes.length === 0) && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum cliente cadastrado.</div>}
      </div>
    </div>
  );
}

// ---------- Feriados (usados na liberação de produção) ----------
// Adicionado: cadastro simples de feriados (data + descrição) — a
// liberação de produção usa essa lista para impedir programar nesses
// dias (junto com domingos, que já são bloqueados por padrão).
function FeriadosCadastro({ feriados, setFeriados }) {
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");

  async function adicionar() {
    if (!data) return;
    await setFeriados([...(feriados || []), { id: uid(), data, descricao: descricao.trim() }]);
    setData(""); setDescricao("");
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este feriado?")) return;
    await setFeriados((feriados || []).filter(f => f.id !== id));
  }
  const ordenados = [...(feriados || [])].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 12, color: "#1c2b39" }}>Novo feriado</div>
        <div style={{ fontSize: 12.5, color: "#6b5d49", marginBottom: 12 }}>
          Datas cadastradas aqui ficam bloqueadas para programar produção — junto com os domingos, que já são bloqueados por padrão. Sábados exigem autorização de um Gestor ou Administrador, mas não precisam ser cadastrados aqui.
        </div>
        <Field label="Data"><input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} /></Field>
        <Field label="Descrição (opcional)"><input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Independência, recesso da fábrica" style={inputStyle} /></Field>
        <PrimaryButton onClick={adicionar} disabled={!data} style={{ width: "100%" }}><Plus size={16} /> Adicionar feriado</PrimaryButton>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ordenados.map(f => (
          <Card key={f.id} style={{ padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>{new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" })}</div>
              {f.descricao && <div style={{ fontSize: 12.5, color: "#6b5d49" }}>{f.descricao}</div>}
            </div>
            <IconButton onClick={() => excluir(f.id)} danger title="Excluir"><Trash2 size={15} /></IconButton>
          </Card>
        ))}
        {ordenados.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum feriado cadastrado.</div>}
      </div>
    </div>
  );
}

// Adicionado: grupo de materiais, tipo de tecido e cor viraram cadastros
// próprios — cada um com um código numérico sequencial atribuído na
// ordem em que é criado (ex.: "AVENTAL" = grupo 001, "TACTEL" = tipo
// 001, "PRETO" = cor 001). O código do produto é a junção desses três
// códigos, separados por ponto (ex.: 001.001.001), com uma descrição por
// extenso ao lado pra facilitar a leitura (ex.: "AVENTAL TACTEL P").
// Adicionado: tamanho é cadastro próprio com código numérico sequencial
// (ex.: "P" = tamanho 001) e entra como 3º segmento do código do produto.
//
// Corrigido: "cor" foi removida do cadastro de produtos. "Tipo de
// tecido" deixou de ser um cadastro próprio escolhido direto no produto
// — agora o produto busca o tecido na base de Materiais, herdando o
// segmento "tipo" do próprio código de cadastro do material escolhido.
function montarCodigoProduto({ grupoCodigo, tipoCodigo, tamanhoCodigo }) {
  const seg = (n) => String(n || 0).padStart(3, "0");
  return `${seg(grupoCodigo)}.${seg(tipoCodigo)}.${seg(tamanhoCodigo)}`;
}
function descricaoCodigoProduto({ grupoNome, tipoNome, tamanhoNome }) {
  return [grupoNome, tipoNome, tamanhoNome].filter(Boolean).join(" ") || "—";
}

function ProdutosCadastro({ produtos, setProdutos, etapas, vinculos, setVinculos, setores, materiais, consumosMaterial, setConsumosMaterial, colaboradores, gruposProduto, setGruposProduto, tamanhos, setTamanhos, ehAdministrador }) {
  const [nome, setNome] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [novaEtapaId, setNovaEtapaId] = useState("");
  const [novoTempoMin, setNovoTempoMin] = useState("");
  const [novoTempoSeg, setNovoTempoSeg] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [novoMaterialId, setNovoMaterialId] = useState("");
  const [novaQtdMaterial, setNovaQtdMaterial] = useState("");
  // Adicionado: grupo de materiais e tamanho — seleções de cadastros
  // próprios (com opção de criar um novo ali mesmo). Tamanho é
  // obrigatório; grupo continua opcional.
  //
  // Corrigido: o tecido do produto agora é um material de verdade,
  // buscado na base de Materiais (materialTecidoId), em vez de um
  // cadastro de "tipo de tecido" à parte.
  const [grupoProdutoId, setGrupoProdutoId] = useState("");
  const [materialTecidoId, setMaterialTecidoId] = useState("");
  const [tamanhoId, setTamanhoId] = useState("");
  const [novoGrupoAberto, setNovoGrupoAberto] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [novoTamanhoAberto, setNovoTamanhoAberto] = useState(false);
  const [novoTamanhoNome, setNovoTamanhoNome] = useState("");
  const [grupoProdutoIdEdicao, setGrupoProdutoIdEdicao] = useState("");
  const [materialTecidoIdEdicao, setMaterialTecidoIdEdicao] = useState("");
  const [tamanhoIdEdicao, setTamanhoIdEdicao] = useState("");
  const [novoGrupoAbertoEdicao, setNovoGrupoAbertoEdicao] = useState(false);
  const [novoGrupoNomeEdicao, setNovoGrupoNomeEdicao] = useState("");
  const [novoTamanhoAbertoEdicao, setNovoTamanhoAbertoEdicao] = useState(false);
  const [novoTamanhoNomeEdicao, setNovoTamanhoNomeEdicao] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");

  async function criarGrupo(nomeBruto, aoCriar) {
    const nomeCriado = nomeBruto.trim().toUpperCase();
    if (!nomeCriado) return;
    const codigo = gruposProduto.reduce((max, g) => Math.max(max, g.codigo || 0), 0) + 1;
    const novo = { id: uid(), codigo, nome: nomeCriado };
    await setGruposProduto([...gruposProduto, novo]);
    aoCriar(novo.id);
  }
  async function criarTamanho(nomeBruto, aoCriar) {
    const nomeCriado = nomeBruto.trim().toUpperCase();
    if (!nomeCriado) return;
    const codigo = tamanhos.reduce((max, t) => Math.max(max, t.codigo || 0), 0) + 1;
    const novo = { id: uid(), codigo, nome: nomeCriado };
    await setTamanhos([...tamanhos, novo]);
    aoCriar(novo.id);
  }
  const nomeGrupo = (id) => gruposProduto.find(g => g.id === id)?.nome || null;
  const nomeTamanho = (id) => tamanhos.find(t => t.id === id)?.nome || null;
  const codigoGrupo = (id) => gruposProduto.find(g => g.id === id)?.codigo;
  const codigoTamanho = (id) => tamanhos.find(t => t.id === id)?.codigo;
  // O "tipo" do produto vem do material escolhido como tecido: cada
  // material tem sua própria sequência de cadastro (o código visível do
  // material em Materiais é fornecedor + essa sequência), usada direto
  // como o segmento "tipo" do código do produto.
  const materialTecido = (id) => materiais.find(m => m.id === id) || null;
  const nomeMaterialTecido = (id) => materialTecido(id)?.nome || null;
  const codigoTipoDoMaterial = (id) => materialTecido(id)?.sequencia;
  const materiaisOrdenados = useMemo(() => [...materiais].sort((a, b) => a.nome.localeCompare(b.nome)), [materiais]);

  const podeCriarProduto = nome.trim().length > 0 && !!tamanhoId;

  async function adicionarProduto() {
    if (!podeCriarProduto) return;
    // A sequência (ordem de entrada/lançamento) fica guardada no produto
    // pra referência, mas não entra mais no código — o código é
    // grupo.tipo.tamanho, como pedido.
    const sequencia = produtos.reduce((max, p) => Math.max(max, p.sequencia || 0), 0) + 1;
    const p = {
      id: uid(), sequencia,
      nome: nome.trim().toUpperCase(),
      grupoProdutoId: grupoProdutoId || null, grupoProdutoNomeSnap: nomeGrupo(grupoProdutoId),
      materialTecidoId: materialTecidoId || null, materialTecidoNomeSnap: nomeMaterialTecido(materialTecidoId),
      tamanhoId, tamanhoNomeSnap: nomeTamanho(tamanhoId),
      codigo: montarCodigoProduto({ grupoCodigo: codigoGrupo(grupoProdutoId), tipoCodigo: codigoTipoDoMaterial(materialTecidoId), tamanhoCodigo: codigoTamanho(tamanhoId) }),
    };
    await setProdutos([...produtos, p]);
    setNome(""); setGrupoProdutoId(""); setMaterialTecidoId(""); setTamanhoId("");
    setExpandido(p.id);
  }
  async function excluirProduto(id) {
    if (!window.confirm("Excluir este produto e todos os vínculos de etapas e materiais dele?")) return;
    await setProdutos(produtos.filter(p => p.id !== id));
    await setVinculos(vinculos.filter(v => v.produtoId !== id));
    await setConsumosMaterial(consumosMaterial.filter(c => c.produtoId !== id));
  }
  function iniciarEdicaoProduto(p) {
    setEditandoId(p.id); setNomeEdicao(p.nome);
    setGrupoProdutoIdEdicao(p.grupoProdutoId || ""); setMaterialTecidoIdEdicao(p.materialTecidoId || ""); setTamanhoIdEdicao(p.tamanhoId || "");
  }
  async function salvarEdicaoProduto(id) {
    // Corrigido: agora é possível renomear um produto sem excluir e
    // recriar — o que antes apagava todos os vínculos de etapas e tempos
    // estimados já cadastrados para ele.
    if (!nomeEdicao.trim() || !tamanhoIdEdicao) return;
    await setProdutos(produtos.map(p => p.id === id ? {
      ...p, nome: nomeEdicao.trim().toUpperCase(),
      grupoProdutoId: grupoProdutoIdEdicao || null, grupoProdutoNomeSnap: nomeGrupo(grupoProdutoIdEdicao),
      materialTecidoId: materialTecidoIdEdicao || null, materialTecidoNomeSnap: nomeMaterialTecido(materialTecidoIdEdicao),
      tamanhoId: tamanhoIdEdicao, tamanhoNomeSnap: nomeTamanho(tamanhoIdEdicao),
      codigo: montarCodigoProduto({ grupoCodigo: codigoGrupo(grupoProdutoIdEdicao), tipoCodigo: codigoTipoDoMaterial(materialTecidoIdEdicao), tamanhoCodigo: codigoTamanho(tamanhoIdEdicao) }),
    } : p));
    setEditandoId(null);
  }
  async function vincularEtapa(produtoId) {
    const min = parseInt(novoTempoMin || "0", 10);
    // Corrigido: segundos digitados acima de 59 (ex.: "90") eram somados
    // normalmente ao total, então não travava o cálculo — mas o campo não
    // avisava o usuário. Agora o valor é limitado a 0–59 na própria tela.
    const segBruto = parseInt(novoTempoSeg || "0", 10);
    const seg = Math.min(Math.max(segBruto, 0), 59);
    const total = min * 60 + seg;
    if (!novaEtapaId || total <= 0) return;
    const existente = vinculos.find(v => v.produtoId === produtoId && v.etapaId === novaEtapaId);
    if (existente) {
      await setVinculos(vinculos.map(v => v.id === existente.id ? { ...v, tempoEstimadoSeg: total } : v));
    } else {
      // Adicionado: cada vínculo guarda uma "ordem" — a posição da etapa
      // na sequência de produção do produto (usada pelas Ordens de
      // Produção para saber qual é a próxima etapa do lote). Uma etapa
      // nova entra no fim da fila por padrão.
      const vinculosDoProduto = vinculos.filter(v => v.produtoId === produtoId);
      const maiorOrdem = vinculosDoProduto.reduce((max, v) => Math.max(max, v.ordem ?? 0), -1);
      await setVinculos([...vinculos, { id: uid(), produtoId, etapaId: novaEtapaId, tempoEstimadoSeg: total, ordem: maiorOrdem + 1 }]);
    }
    setNovaEtapaId(""); setNovoTempoMin(""); setNovoTempoSeg("");
  }
  async function removerVinculo(vid) { await setVinculos(vinculos.filter(v => v.id !== vid)); }
  async function moverVinculo(produtoId, vinculoId, direcao) {
    // Adicionado: reordena a sequência de etapas do produto trocando a
    // "ordem" do vínculo selecionado com a do vizinho (sobe/desce na
    // lista). É essa ordem que define a sequência da Ordem de Produção.
    const ordenados = [...vinculos.filter(v => v.produtoId === produtoId)].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const idx = ordenados.findIndex(v => v.id === vinculoId);
    const alvoIdx = idx + direcao;
    if (idx === -1 || alvoIdx < 0 || alvoIdx >= ordenados.length) return;
    const atual = ordenados[idx];
    const vizinho = ordenados[alvoIdx];
    const ordemAtual = atual.ordem ?? idx;
    const ordemVizinho = vizinho.ordem ?? alvoIdx;
    await setVinculos(vinculos.map(v => {
      if (v.id === atual.id) return { ...v, ordem: ordemVizinho };
      if (v.id === vizinho.id) return { ...v, ordem: ordemAtual };
      return v;
    }));
  }
  const nomeEtapa = (id) => etapas.find(e => e.id === id)?.nome || "—";

  // Adicionado: ficha de consumo de materiais do produto — quanto de cada
  // material uma peça consome. Alimenta a baixa automática de estoque
  // quando a OP é concluída (ver Consumo → Movimentações).
  async function vincularMaterial(produtoId) {
    const qtd = parseFloat(novaQtdMaterial || "0");
    if (!novoMaterialId || !(qtd > 0)) return;
    const existente = consumosMaterial.find(c => c.produtoId === produtoId && c.materialId === novoMaterialId);
    if (existente) {
      await setConsumosMaterial(consumosMaterial.map(c => c.id === existente.id ? { ...c, quantidadePorPeca: qtd } : c));
    } else {
      await setConsumosMaterial([...consumosMaterial, { id: uid(), produtoId, materialId: novoMaterialId, quantidadePorPeca: qtd }]);
    }
    setNovoMaterialId(""); setNovaQtdMaterial("");
  }
  async function removerConsumoMaterial(cid) { await setConsumosMaterial(consumosMaterial.filter(c => c.id !== cid)); }
  const nomeMaterial = (id) => materiais.find(m => m.id === id)?.nome || "—";
  const unidadeMaterial = (id) => materiais.find(m => m.id === id)?.unidade || "";

  // Adicionado: custo estimado por peça, combinando mão de obra e
  // material — dá uma referência de custo unitário direto no cadastro,
  // sem precisar abrir uma OP ou orçamento pra ter uma ideia do custo.
  // Mão de obra usa o salário médio dos colaboradores (convertido para
  // valor-hora com a mesma base de 220h/mês do relatório de custos),
  // já que o produto ainda não tem colaborador definido nessa etapa.
  const colaboradoresComSalario = (colaboradores || []).filter(c => c.salarioMensal);
  const valorHoraMedio = colaboradoresComSalario.length > 0
    ? colaboradoresComSalario.reduce((s, c) => s + c.salarioMensal, 0) / colaboradoresComSalario.length / HORAS_MES_PADRAO
    : 0;
  function custoDoProduto(produtoId) {
    const vinculosProduto = vinculos.filter(v => v.produtoId === produtoId);
    const vinculosPeca = vinculosProduto.filter(v => (etapas.find(e => e.id === v.etapaId)?.tipoCalculo || "peca") !== "lote");
    const vinculosLote = vinculosProduto.filter(v => (etapas.find(e => e.id === v.etapaId)?.tipoCalculo || "peca") === "lote");
    const maoDeObra = vinculosPeca.reduce((s, v) => s + (v.tempoEstimadoSeg / 3600) * valorHoraMedio, 0);
    const material = consumosMaterial.filter(c => c.produtoId === produtoId)
      .reduce((s, c) => s + c.quantidadePorPeca * (materiais.find(m => m.id === c.materialId)?.preco || 0), 0);
    return { maoDeObra, material, total: maoDeObra + material, vinculosLote };
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: FONT_DISPLAY, marginBottom: 4, color: "#1c2b39" }}>Novo produto</div>
        <div style={{ fontSize: 11.5, color: "#a3937a", marginBottom: 10 }}>
          Código: <b style={{ color: "#6b5d49", fontFamily: "monospace" }}>{montarCodigoProduto({ grupoCodigo: codigoGrupo(grupoProdutoId), tipoCodigo: codigoTipoDoMaterial(materialTecidoId), tamanhoCodigo: codigoTamanho(tamanhoId) })}</b> — {descricaoCodigoProduto({ grupoNome: nomeGrupo(grupoProdutoId), tipoNome: nomeMaterialTecido(materialTecidoId), tamanhoNome: nomeTamanho(tamanhoId) })}
        </div>
        <Field label="Nome">
          <input value={nome} onChange={e => setNome(e.target.value.toUpperCase())} placeholder="EX.: CAMISETA BÁSICA" style={inputStyle} onKeyDown={e => e.key === "Enter" && adicionarProduto()} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Grupo de produto (opcional)">
            <Select value={grupoProdutoId} onChange={e => setGrupoProdutoId(e.target.value)}>
              <option value="">Selecione…</option>
              {[...gruposProduto].sort((a, b) => a.codigo - b.codigo).map(g => <option key={g.id} value={g.id}>{String(g.codigo).padStart(3, "0")} · {g.nome}</option>)}
            </Select>
            <button type="button" onClick={() => setNovoGrupoAberto(v => !v)} style={linkButtonStyle}>{novoGrupoAberto ? "Cancelar" : "+ Novo grupo"}</button>
            {novoGrupoAberto && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value.toUpperCase())} placeholder="NOME DO GRUPO" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarGrupo(novoGrupoNome, id => { setGrupoProdutoId(id); setNovoGrupoNome(""); setNovoGrupoAberto(false); })} />
                <PrimaryButton onClick={() => criarGrupo(novoGrupoNome, id => { setGrupoProdutoId(id); setNovoGrupoNome(""); setNovoGrupoAberto(false); })} disabled={!novoGrupoNome.trim()}><Plus size={16} /></PrimaryButton>
              </div>
            )}
          </Field>
          <Field label="Tecido (cadastro de Materiais, opcional)">
            <Select value={materialTecidoId} onChange={e => setMaterialTecidoId(e.target.value)}>
              <option value="">Selecione…</option>
              {materiaisOrdenados.map(m => <option key={m.id} value={m.id}>{m.codigo != null ? `${m.codigo} · ` : ""}{m.nome}</option>)}
            </Select>
          </Field>
          <Field label="Tamanho (obrigatório)">
            <Select value={tamanhoId} onChange={e => setTamanhoId(e.target.value)}>
              <option value="">Selecione…</option>
              {[...tamanhos].sort((a, b) => a.codigo - b.codigo).map(t => <option key={t.id} value={t.id}>{String(t.codigo).padStart(3, "0")} · {t.nome}</option>)}
            </Select>
            <button type="button" onClick={() => setNovoTamanhoAberto(v => !v)} style={linkButtonStyle}>{novoTamanhoAberto ? "Cancelar" : "+ Novo tamanho"}</button>
            {novoTamanhoAberto && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input value={novoTamanhoNome} onChange={e => setNovoTamanhoNome(e.target.value.toUpperCase())} placeholder="EX.: P" style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === "Enter" && criarTamanho(novoTamanhoNome, id => { setTamanhoId(id); setNovoTamanhoNome(""); setNovoTamanhoAberto(false); })} />
                <PrimaryButton onClick={() => criarTamanho(novoTamanhoNome, id => { setTamanhoId(id); setNovoTamanhoNome(""); setNovoTamanhoAberto(false); })} disabled={!novoTamanhoNome.trim()}><Plus size={16} /></PrimaryButton>
              </div>
            )}
          </Field>
        </div>
        <PrimaryButton onClick={adicionarProduto} disabled={!podeCriarProduto} style={{ width: "100%" }}><Plus size={16} /> Adicionar produto</PrimaryButton>
        {!tamanhoId && <div style={{ fontSize: 11, color: "#a3937a", marginTop: 6, textAlign: "center" }}>Selecione (ou cadastre) o tamanho para poder adicionar.</div>}
      </Card>

      <Card style={{ marginBottom: 16, padding: 12 }}>
        <Field label="Pesquisar produto">
          <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Código, nome, grupo, tecido ou tamanho…" style={inputStyle} />
        </Field>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {produtos.filter(p => {
          const termo = buscaProduto.trim().toUpperCase();
          if (!termo) return true;
          return [p.codigo, p.nome, p.grupoProdutoNomeSnap, p.materialTecidoNomeSnap, p.tamanhoNomeSnap].filter(Boolean).some(v => v.toUpperCase().includes(termo));
        }).map(p => {
          const vinculosProduto = vinculos.filter(v => v.produtoId === p.id);
          const consumosProduto = consumosMaterial.filter(c => c.produtoId === p.id);
          const aberto = expandido === p.id;
          const editando = editandoId === p.id;
          const custo = aberto ? custoDoProduto(p.id) : null;
          return (
            <Card key={p.id} style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div onClick={() => !editando && setExpandido(aberto ? null : p.id)} style={{ cursor: "pointer", flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#2a2015" }}>
                    {p.codigo != null && <span style={{ color: "#a3937a", fontWeight: 600, fontFamily: "monospace" }}>{p.codigo} · </span>}
                    {p.nome}
                  </div>
                  <div style={{ fontSize: 12, color: "#a3937a" }}>
                    {descricaoCodigoProduto({ grupoNome: p.grupoProdutoNomeSnap, tipoNome: p.materialTecidoNomeSnap, tamanhoNome: p.tamanhoNomeSnap })}
                    {" · "}{vinculosProduto.length} etapa{vinculosProduto.length !== 1 ? "s" : ""} vinculada{vinculosProduto.length !== 1 ? "s" : ""} · {consumosProduto.length} material{consumosProduto.length !== 1 ? "is" : ""}
                  </div>
                </div>
                <IconButton onClick={(e) => { e.stopPropagation(); iniciarEdicaoProduto(p); setExpandido(p.id); }} title="Editar"><ClipboardList size={15} /></IconButton>
                <IconButton onClick={(e) => { e.stopPropagation(); excluirProduto(p.id); }} danger title="Excluir produto"><Trash2 size={15} /></IconButton>
              </div>
              {aberto && (
                <div style={{ borderTop: "1px solid #efe8d8", padding: 14, background: "#faf6ec" }}>
                  {editando && (
                    <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #efe8d8" }}>
                      <Field label="Nome do produto">
                        <input value={nomeEdicao} onChange={e => setNomeEdicao(e.target.value.toUpperCase())} style={inputStyle} />
                      </Field>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <Field label="Grupo de produto (opcional)">
                          <Select value={grupoProdutoIdEdicao} onChange={e => setGrupoProdutoIdEdicao(e.target.value)}>
                            <option value="">Selecione…</option>
                            {[...gruposProduto].sort((a, b) => a.codigo - b.codigo).map(g => <option key={g.id} value={g.id}>{String(g.codigo).padStart(3, "0")} · {g.nome}</option>)}
                          </Select>
                          <button type="button" onClick={() => setNovoGrupoAbertoEdicao(v => !v)} style={linkButtonStyle}>{novoGrupoAbertoEdicao ? "Cancelar" : "+ Novo grupo"}</button>
                          {novoGrupoAbertoEdicao && (
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <input value={novoGrupoNomeEdicao} onChange={e => setNovoGrupoNomeEdicao(e.target.value.toUpperCase())} placeholder="NOME DO GRUPO" style={{ ...inputStyle, flex: 1 }} />
                              <PrimaryButton onClick={() => criarGrupo(novoGrupoNomeEdicao, id => { setGrupoProdutoIdEdicao(id); setNovoGrupoNomeEdicao(""); setNovoGrupoAbertoEdicao(false); })} disabled={!novoGrupoNomeEdicao.trim()}><Plus size={16} /></PrimaryButton>
                            </div>
                          )}
                        </Field>
                        <Field label="Tecido (cadastro de Materiais, opcional)">
                          <Select value={materialTecidoIdEdicao} onChange={e => setMaterialTecidoIdEdicao(e.target.value)}>
                            <option value="">Selecione…</option>
                            {materiaisOrdenados.map(m => <option key={m.id} value={m.id}>{m.codigo != null ? `${m.codigo} · ` : ""}{m.nome}</option>)}
                          </Select>
                        </Field>
                        <Field label="Tamanho (obrigatório)">
                          <Select value={tamanhoIdEdicao} onChange={e => setTamanhoIdEdicao(e.target.value)}>
                            <option value="">Selecione…</option>
                            {[...tamanhos].sort((a, b) => a.codigo - b.codigo).map(t => <option key={t.id} value={t.id}>{String(t.codigo).padStart(3, "0")} · {t.nome}</option>)}
                          </Select>
                          <button type="button" onClick={() => setNovoTamanhoAbertoEdicao(v => !v)} style={linkButtonStyle}>{novoTamanhoAbertoEdicao ? "Cancelar" : "+ Novo tamanho"}</button>
                          {novoTamanhoAbertoEdicao && (
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <input value={novoTamanhoNomeEdicao} onChange={e => setNovoTamanhoNomeEdicao(e.target.value.toUpperCase())} placeholder="EX.: P" style={{ ...inputStyle, flex: 1 }} />
                              <PrimaryButton onClick={() => criarTamanho(novoTamanhoNomeEdicao, id => { setTamanhoIdEdicao(id); setNovoTamanhoNomeEdicao(""); setNovoTamanhoAbertoEdicao(false); })} disabled={!novoTamanhoNomeEdicao.trim()}><Plus size={16} /></PrimaryButton>
                            </div>
                          )}
                        </Field>
                      </div>
                      <div style={{ fontSize: 11, color: "#a3937a", marginBottom: 10 }}>
                        Novo código: <b style={{ color: "#6b5d49", fontFamily: "monospace" }}>{montarCodigoProduto({ grupoCodigo: codigoGrupo(grupoProdutoIdEdicao), tipoCodigo: codigoTipoDoMaterial(materialTecidoIdEdicao), tamanhoCodigo: codigoTamanho(tamanhoIdEdicao) })}</b> — {descricaoCodigoProduto({ grupoNome: nomeGrupo(grupoProdutoIdEdicao), tipoNome: nomeMaterialTecido(materialTecidoIdEdicao), tamanhoNome: nomeTamanho(tamanhoIdEdicao) })}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <PrimaryButton onClick={() => salvarEdicaoProduto(p.id)} disabled={!nomeEdicao.trim() || !tamanhoIdEdicao} style={{ flex: 1 }}>Salvar</PrimaryButton>
                        <button onClick={() => setEditandoId(null)} style={{ border: "1.5px solid #d9cfb7", background: "#fff", borderRadius: 9, padding: "0 14px", color: "#6b5d49", fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1c2b39", marginBottom: 8 }}>Sequência de etapas</div>
                  {vinculosProduto.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {[...vinculosProduto].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((v, i, arr) => {
                        const etapaDoVinculo = etapas.find(e => e.id === v.etapaId);
                        const ehLote = (etapaDoVinculo?.tipoCalculo || "peca") === "lote";
                        return (
                          <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
                            <span style={{ fontSize: 13, color: "#2a2015", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#a3937a", minWidth: 14 }}>{i + 1}º</span>
                              {nomeEtapa(v.etapaId)}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#6b5d49", fontWeight: 600, marginRight: 2 }}>{fmtSec(v.tempoEstimadoSeg)}{ehLote ? "/lote" : "/peça"}</span>
                              <IconButton onClick={() => moverVinculo(p.id, v.id, -1)} title="Mover para cima">
                                <ChevronUp size={14} style={{ opacity: i === 0 ? 0.3 : 1 }} />
                              </IconButton>
                              <IconButton onClick={() => moverVinculo(p.id, v.id, 1)} title="Mover para baixo">
                                <ChevronDown size={14} style={{ opacity: i === arr.length - 1 ? 0.3 : 1 }} />
                              </IconButton>
                              <IconButton onClick={() => removerVinculo(v.id)} danger title="Remover"><X size={14} /></IconButton>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {etapas.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#a3937a", marginBottom: 16 }}>Cadastre etapas na aba "Etapas" para poder vinculá-las.</div>
                  ) : (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b5d49", marginBottom: 6 }}>Vincular etapa</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <Select value={novaEtapaId} onChange={e => setNovaEtapaId(e.target.value)} style={{ flex: 1 }}>
                          <option value="">Etapa…</option>
                          {etapas.map(e => (
                            <option key={e.id} value={e.id}>
                              {e.nome}{setores.find(s => s.id === e.setorId) ? ` — ${setores.find(s => s.id === e.setorId).nome}` : ""} ({(e.tipoCalculo || "peca") === "lote" ? "por lote" : "por peça"})
                            </option>
                          ))}
                        </Select>
                      </div>
                      {novaEtapaId && (
                        <div style={{ fontSize: 11.5, color: "#a3937a", marginBottom: 6 }}>
                          Tempo {(etapas.find(e => e.id === novaEtapaId)?.tipoCalculo || "peca") === "lote" ? "fixo para o lote inteiro" : "de uma peça"}:
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="number" min="0" placeholder="min" value={novoTempoMin} onChange={e => setNovoTempoMin(e.target.value)} style={{ ...inputStyle, width: 70 }} />
                        <input type="number" min="0" max="59" placeholder="seg" value={novoTempoSeg} onChange={e => setNovoTempoSeg(e.target.value)} style={{ ...inputStyle, width: 70 }} />
                        <PrimaryButton onClick={() => vincularEtapa(p.id)} disabled={!novaEtapaId} style={{ flex: 1 }}>Vincular</PrimaryButton>
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1c2b39", marginBottom: 8, paddingTop: 4, borderTop: "1px solid #efe8d8" }}>Consumo de materiais (por peça)</div>
                  {consumosProduto.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      {consumosProduto.map(c => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "7px 10px" }}>
                          <span style={{ fontSize: 13, color: "#2a2015" }}>{nomeMaterial(c.materialId)}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "#6b5d49", fontWeight: 600 }}>{c.quantidadePorPeca} {unidadeMaterial(c.materialId)}/peça</span>
                            <IconButton onClick={() => removerConsumoMaterial(c.id)} danger title="Remover"><X size={14} /></IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {materiais.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: "#a3937a" }}>Cadastre materiais em Cadastros → Materiais para poder vinculá-los.</div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Select value={novoMaterialId} onChange={e => setNovoMaterialId(e.target.value)} style={{ flex: 1 }}>
                        <option value="">Material…</option>
                        {[...materiais].sort((a, b) => a.nome.localeCompare(b.nome)).map(m => <option key={m.id} value={m.id}>{m.nome} ({m.unidade})</option>)}
                      </Select>
                      <input type="number" min="0" step="0.001" placeholder="qtd/peça" value={novaQtdMaterial} onChange={e => setNovaQtdMaterial(e.target.value)} style={{ ...inputStyle, width: 90 }} />
                      <PrimaryButton onClick={() => vincularMaterial(p.id)} disabled={!novoMaterialId || !(parseFloat(novaQtdMaterial || "0") > 0)}>Vincular</PrimaryButton>
                    </div>
                  )}

                  {custo && (custo.maoDeObra > 0 || custo.material > 0) && (
                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #efe8d8" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1c2b39", marginBottom: 8 }}>Custo estimado por peça</div>
                      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", background: "#fff", border: "1px solid #e6ddc8", borderRadius: 8, padding: "10px 14px" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#2f4a63" }}>{fmtMoeda(custo.total)}</div>
                          <div style={{ fontSize: 10.5, color: "#a3937a" }}>custo total</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#6b5d49" }}>{fmtMoeda(custo.maoDeObra)}</div>
                          <div style={{ fontSize: 10.5, color: "#a3937a" }}>mão de obra</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#6b5d49" }}>{fmtMoeda(custo.material)}</div>
                          <div style={{ fontSize: 10.5, color: "#a3937a" }}>material</div>
                        </div>
                      </div>
                      {!valorHoraMedio && (
                        <div style={{ fontSize: 11, color: "#a3937a", marginTop: 6 }}>Cadastre o salário mensal dos colaboradores em Cadastros → Colaboradores para estimar a mão de obra.</div>
                      )}
                      {custo.vinculosLote.length > 0 && (
                        <div style={{ fontSize: 11, color: "#a3937a", marginTop: 6 }}>
                          Não inclui {custo.vinculosLote.length} etapa{custo.vinculosLote.length !== 1 ? "s" : ""} por lote ({custo.vinculosLote.map(v => nomeEtapa(v.etapaId)).join(", ")}) — o tempo delas é fixo por lote, então o custo por peça depende do tamanho do lote de produção.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {produtos.length === 0 && <div style={{ fontSize: 13.5, color: "#a3937a", padding: "8px 2px" }}>Nenhum produto cadastrado.</div>}
      </div>
    </div>
  );
}
