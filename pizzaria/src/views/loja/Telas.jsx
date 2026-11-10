import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Tv, Cpu, Send, Copy } from "lucide-react";
import { salvarItem, removerItem, modoDemo } from "../../db.js";
import { CATEGORIAS, useColecao, useConfig, montarPainel, publicarTelas, semAcento } from "../../logic.js";
import { Modal, Campo, toast, BotaoConfirmar, numero } from "../../ui.jsx";
import { linkApp } from "./Salao.jsx";

const VAZIO = { nome: "", tipo: "lcd", categorias: [], itensPorPagina: 5, segundosPorPagina: 10, mostrarProntos: false, mostrarDescricao: false };

// Cada tela tem um id curto e legível, que vai no código do ESP32.
const novoId = (nome) => (semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "tela") + "-" + Math.random().toString(36).slice(2, 5);

export default function Telas() {
  const [cfg] = useConfig();
  const [telas] = useColecao("tela");
  const [produtos] = useColecao("produto");
  const [promocoes] = useColecao("promocao");
  const [editando, setEditando] = useState(null);
  const [codigo, setCodigo] = useState(null);

  async function publicar() {
    const n = await publicarTelas(cfg);
    toast(n ? `Cardápio enviado para ${n} tela(s)` : "Cadastre uma tela primeiro");
  }

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <div className="linha">
        <h2>Telas do cardápio</h2>
        <div className="linha direita">
          <button className="btn" onClick={publicar}><Send size={16} /> Atualizar todas as telas</button>
          <button className="btn primario" onClick={() => setEditando({ ...VAZIO })}><Plus size={16} /> Nova tela</button>
        </div>
      </div>
      <div className="suave" style={{ maxWidth: 760 }}>
        Cadastre cada tela do salão: <b>LCD com ESP32</b> (telinha de balcão, 2,8" a 7") ou <b>TV / monitor</b>.
        As telas se atualizam sozinhas quando você muda produtos, preços ou promoções aqui na loja.
      </div>
      {modoDemo && (
        <div className="cartao pequeno" style={{ background: "var(--aviso)", borderColor: "#f0d78c" }}>
          O app está em modo demonstração (sem Supabase). A TV funciona neste navegador, mas o ESP32 só lê o cardápio depois que o Supabase estiver configurado.
        </div>
      )}

      {telas.length === 0 && <div className="cartao vazio">Nenhuma tela cadastrada.</div>}
      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {telas.map((t) => (
          <div key={t.id} className="cartao coluna">
            <div className="linha entre">
              <h3>{t.tipo === "tv" ? <Tv size={17} style={{ verticalAlign: -3 }} /> : <Cpu size={17} style={{ verticalAlign: -3 }} />} {t.nome}</h3>
              <span className="selo claro">{t.tipo === "tv" ? "TV" : "ESP32"}</span>
            </div>
            <PreviaTela tela={t} produtos={produtos} promocoes={promocoes} cfg={cfg} />
            <div className="suave pequeno">
              {(t.categorias?.length ? t.categorias.map((c) => CATEGORIAS[c]).join(", ") : "Todas as categorias")} · {t.itensPorPagina} itens por página · troca a cada {t.segundosPorPagina}s
            </div>
            <div className="pequeno">ID: <code>{t.id}</code></div>
            <div className="linha">
              {t.tipo === "tv" ? (
                <a className="btn pequeno escuro" href={linkApp(`painel/${t.id}`)} target="_blank" rel="noreferrer"><Tv size={14} /> Abrir na TV</a>
              ) : (
                <button className="btn pequeno escuro" onClick={() => setCodigo(t)}><Cpu size={14} /> Configurar ESP32</button>
              )}
              <button className="btn pequeno" onClick={() => setEditando({ ...VAZIO, ...t })}><Pencil size={14} /> Editar</button>
              <BotaoConfirmar className="btn pequeno perigo direita" texto="Excluir?" aoConfirmar={async () => { await removerItem("tela", t.id); await removerItem("painel", t.id); }}>
                <Trash2 size={14} />
              </BotaoConfirmar>
            </div>
          </div>
        ))}
      </div>

      {editando && <FormTela inicial={editando} cfg={cfg} aoFechar={() => setEditando(null)} />}
      {codigo && <CodigoEsp32 tela={codigo} aoFechar={() => setCodigo(null)} />}
    </div>
  );
}

// Simula o que o ESP32 vai desenhar (mesmo resumo, mesma paginação).
function PreviaTela({ tela, produtos, promocoes, cfg }) {
  const dados = useMemo(() => montarPainel(tela, produtos, promocoes, cfg), [tela, produtos, promocoes, cfg]);
  const [pag, setPag] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPag((p) => p + 1), 3000);
    return () => clearInterval(t);
  }, []);
  if (tela.tipo === "tv") {
    return <div className="suave pequeno">Abra o link na TV (navegador em tela cheia). Dê dois cliques para tela cheia.</div>;
  }
  const p = dados.pag.length ? dados.pag[pag % dados.pag.length] : null;
  return (
    <div className="lcd" aria-label="Prévia da tela LCD">
      <div className="lcd-topo"><span>{dados.loja}</span><span>{p ? `${(pag % dados.pag.length) + 1}/${dados.pag.length}` : ""}</span></div>
      {p ? (
        <>
          <div className="lcd-cat">{p.t}</div>
          {p.i.map((it) => (
            <div key={it.n} className="lcd-item"><span>{it.n}</span><span>{it.p}</span></div>
          ))}
        </>
      ) : (
        <div className="lcd-item">Sem produtos</div>
      )}
      {dados.promo.length > 0 && <div className="lcd-promo">* {dados.promo.join("  * ")}</div>}
    </div>
  );
}

function FormTela({ inicial, cfg, aoFechar }) {
  const [t, setT] = useState(inicial);
  const set = (c, v) => setT({ ...t, [c]: v });
  async function salvar(e) {
    e.preventDefault();
    if (!t.nome.trim()) return toast("Dê um nome para a tela.");
    await salvarItem("tela", {
      ...t,
      id: t.id || novoId(t.nome),
      nome: t.nome.trim(),
      itensPorPagina: Math.max(1, numero(t.itensPorPagina) || 5),
      segundosPorPagina: Math.max(4, numero(t.segundosPorPagina) || 10),
    });
    await publicarTelas(cfg);
    toast("Tela salva e atualizada");
    aoFechar();
  }
  return (
    <Modal titulo={t.id ? "Editar tela" : "Nova tela"} aoFechar={aoFechar}>
      <form className="coluna" onSubmit={salvar}>
        <Campo rotulo="Nome" placeholder="Ex.: Balcão pizzas, TV do salão" value={t.nome} onChange={(e) => set("nome", e.target.value)} autoFocus />
        <Campo rotulo="Tipo de tela">
          <select value={t.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="lcd">LCD com ESP32</option>
            <option value="tv">TV / monitor (navegador)</option>
          </select>
        </Campo>
        <div className="rotulo">Categorias (nenhuma marcada = todas)</div>
        <div className="linha">
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <label key={k} className="check pequeno">
              <input type="checkbox" checked={t.categorias.includes(k)} onChange={(e) => set("categorias", e.target.checked ? [...t.categorias, k] : t.categorias.filter((x) => x !== k))} />
              {v}
            </label>
          ))}
        </div>
        <div className="campos">
          <Campo rotulo="Itens por página" inputMode="numeric" value={t.itensPorPagina} onChange={(e) => set("itensPorPagina", e.target.value)} />
          <Campo rotulo="Segundos por página" inputMode="numeric" value={t.segundosPorPagina} onChange={(e) => set("segundosPorPagina", e.target.value)} />
        </div>
        <div className="suave pequeno">Tela de 2,8" (320×240): até 5 itens. Tela de 3,5" (480×320): até 7. TV: 8 a 12.</div>
        <label className="check"><input type="checkbox" checked={t.mostrarDescricao} onChange={(e) => set("mostrarDescricao", e.target.checked)} /> Mostrar descrição dos produtos</label>
        <label className="check"><input type="checkbox" checked={t.mostrarProntos} onChange={(e) => set("mostrarProntos", e.target.checked)} /> Mostrar senhas de pedidos prontos</label>
        <button className="btn primario">Salvar e enviar para a tela</button>
      </form>
    </Modal>
  );
}

function CodigoEsp32({ tela, aoFechar }) {
  const url = import.meta.env.VITE_SUPABASE_URL || "https://SEU-PROJETO.supabase.co";
  const texto = `// config.h — cole no projeto PainelCardapio (pasta pizzaria/esp32)
#define WIFI_SSID       "nome-da-rede"
#define WIFI_SENHA      "senha-da-rede"
#define SUPABASE_URL    "${url}"
#define SUPABASE_CHAVE  "cole-aqui-a-anon-public-key"
#define TELA_ID         "${tela.id}"`;
  return (
    <Modal titulo={`ESP32 — ${tela.nome}`} aoFechar={aoFechar}>
      <div className="coluna" style={{ gap: 12 }}>
        <ol className="pequeno" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Abra a pasta <code>pizzaria/esp32/PainelCardapio</code> no Arduino IDE ou no PlatformIO.</li>
          <li>Copie <code>config.exemplo.h</code> para <code>config.h</code> e preencha com os dados abaixo.</li>
          <li>Envie para a placa. Ela conecta no Wi-Fi e mostra o cardápio desta tela, atualizando a cada minuto.</li>
        </ol>
        <pre className="cartao pequeno" style={{ margin: 0, overflowX: "auto", background: "var(--forno)", color: "#e8f3ea" }}>{texto}</pre>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(texto).then(() => toast("Copiado"), () => toast("Selecione e copie o texto"))}>
          <Copy size={16} /> Copiar configuração
        </button>
        <div className="suave pequeno">A chave anon fica em Supabase → Project Settings → API (a mesma usada no site).</div>
      </div>
    </Modal>
  );
}
