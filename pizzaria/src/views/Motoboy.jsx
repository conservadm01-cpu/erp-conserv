import { useEffect, useRef, useState } from "react";
import { Navigation, Phone, LogOut, MapPin, Zap } from "lucide-react";
import { gravar, salvarItem } from "../db.js";
import {
  brl, hora, useColecao, useConfig, mudarStatus, repasseMotoboy, ehHoje, soDigitos, PAGAMENTOS, distanciaKm,
} from "../logic.js";
import { Campo, SeloStatus, toast } from "../ui.jsx";
import Mapa from "../Mapa.jsx";

const CHAVE = "pz-motoboy-id";

// Envia a posição no máximo a cada 5 s (ou antes, se andou mais de 30 m).
const INTERVALO_MS = 5000;
const DISTANCIA_MIN_KM = 0.03;

function useRastreamento(motoboyId, ligado) {
  const [estado, setEstado] = useState({ ativo: false, erro: "", ultima: null });
  const ultimoEnvio = useRef({ em: 0, pos: null });

  useEffect(() => {
    if (!ligado || !motoboyId) { setEstado((e) => ({ ...e, ativo: false })); return; }
    if (!navigator.geolocation) { setEstado({ ativo: false, erro: "Aparelho sem GPS disponível no navegador.", ultima: null }); return; }

    // Mantém a tela acesa enquanto rastreia: com a tela apagada o
    // navegador para de entregar a localização.
    let wakeLock = null;
    navigator.wakeLock?.request("screen").then((w) => (wakeLock = w)).catch(() => {});

    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { motoboyId, lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy), velocidade: p.coords.speed, em: new Date().toISOString() };
        setEstado({ ativo: true, erro: "", ultima: pos });
        const u = ultimoEnvio.current;
        const andou = u.pos ? distanciaKm(u.pos, pos) : Infinity;
        if (Date.now() - u.em >= INTERVALO_MS || andou >= DISTANCIA_MIN_KM) {
          ultimoEnvio.current = { em: Date.now(), pos };
          gravar(`loc:${motoboyId}`, pos).catch(() => {});
        }
      },
      (e) => setEstado((s) => ({ ...s, ativo: false, erro: e.code === 1 ? "Permita o acesso à localização para o cliente acompanhar a entrega." : e.message })),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 }
    );
    return () => { navigator.geolocation.clearWatch(id); wakeLock?.release?.(); };
  }, [motoboyId, ligado]);

  return estado;
}

export default function Motoboy() {
  const [cfg] = useConfig();
  const [motoboys, carregado] = useColecao("motoboy");
  const [pedidos] = useColecao("pedido", 8000);
  const [meuId, setMeuId] = useState(() => localStorage.getItem(CHAVE));
  const [gpsLigado, setGpsLigado] = useState(true);
  const eu = motoboys.find((m) => m.id === meuId);

  const meus = pedidos.filter((p) => p.motoboyId === meuId && (p.status === "pronto" || p.status === "em_rota"));
  const disponiveis = pedidos.filter((p) => p.status === "pronto" && !p.motoboyId);
  const emRota = meus.some((p) => p.status === "em_rota");
  const gps = useRastreamento(meuId, !!eu && gpsLigado && (emRota || meus.length > 0));
  const entreguesHoje = pedidos.filter((p) => p.motoboyId === meuId && p.status === "entregue" && ehHoje(p.criadoEm));

  if (!carregado) return <div className="vazio">Carregando…</div>;
  if (!eu) return <EntrarMotoboy motoboys={motoboys.filter((m) => m.ativo !== false)} aoEntrar={(id) => { localStorage.setItem(CHAVE, id); setMeuId(id); }} />;

  async function pegar(p) {
    await salvarItem("pedido", { ...p, motoboyId: eu.id });
    toast(`Pedido #${p.numero} é seu`);
  }

  const navegar = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.endereco.lat},${p.endereco.lng}&travelmode=driving`;

  return (
    <div className="coluna" style={{ maxWidth: 680, margin: "0 auto", gap: 16 }}>
      <div className="linha entre">
        <h1>Olá, {eu.nome}</h1>
        <button className="btn pequeno" onClick={() => { localStorage.removeItem(CHAVE); setMeuId(null); }}><LogOut size={14} /> Sair</button>
      </div>

      <div className="cartao linha">
        {gps.ativo ? <span className="pulso" /> : <MapPin size={16} color="#7a6656" />}
        <div style={{ flex: 1 }} className="pequeno">
          {gps.ativo
            ? <>Localização sendo compartilhada{gps.ultima ? ` · precisão ${gps.ultima.precisao} m · ${hora(gps.ultima.em)}` : ""}</>
            : meus.length ? (gps.erro || "Ligando GPS…") : "O GPS liga sozinho quando você tiver uma entrega."}
          {gps.ativo && <div className="suave">Mantenha esta tela aberta durante a entrega.</div>}
        </div>
        <label className="check pequeno"><input type="checkbox" checked={gpsLigado} onChange={(e) => setGpsLigado(e.target.checked)} /> GPS</label>
      </div>

      {gps.ultima && meus.length > 0 && (
        <Mapa
          altura={240}
          pontos={[
            { id: "eu", lat: gps.ultima.lat, lng: gps.ultima.lng, emoji: "🛵", rotulo: "Você" },
            ...meus.map((p) => ({ id: p.id, lat: p.endereco.lat, lng: p.endereco.lng, emoji: "🏠", rotulo: `#${p.numero}` })),
          ]}
        />
      )}

      <h2>Minhas entregas</h2>
      {meus.length === 0 && <div className="vazio">Nenhuma entrega com você agora.</div>}
      {meus.map((p) => (
        <CartaoEntrega key={p.id} p={p} cfg={cfg}>
          <a className="btn" href={navegar(p)} target="_blank" rel="noreferrer"><Navigation size={16} /> Rota</a>
          {p.cliente.telefone && <a className="btn" href={`tel:${soDigitos(p.cliente.telefone)}`}><Phone size={16} /></a>}
          {p.status === "pronto" ? (
            <button className="btn primario direita" onClick={() => mudarStatus(p, "em_rota", {}, cfg)}>Saí para entrega</button>
          ) : (
            <button className="btn verde direita" onClick={async () => { await mudarStatus(p, "entregue", {}, cfg); toast("Entrega concluída ✅"); }}>Entregue</button>
          )}
        </CartaoEntrega>
      ))}

      {disponiveis.length > 0 && (
        <>
          <h2>Prontos sem motoboy</h2>
          {disponiveis.map((p) => (
            <CartaoEntrega key={p.id} p={p} cfg={cfg}>
              <button className="btn primario direita" onClick={() => pegar(p)}>Pegar entrega</button>
            </CartaoEntrega>
          ))}
        </>
      )}

      <div className="cartao">
        <h3>Hoje</h3>
        <div className="linha entre" style={{ marginTop: 8 }}>
          <span>{entreguesHoje.length} entrega(s)</span>
          <span className="preco">{brl(entreguesHoje.reduce((s, p) => s + repasseMotoboy(p, cfg), 0))} de repasse</span>
        </div>
      </div>
    </div>
  );
}

function CartaoEntrega({ p, cfg, children }) {
  return (
    <div className="cartao coluna" style={p.entrega?.dedicada ? { borderColor: "#d97706", boxShadow: "inset 0 0 0 1px #d97706" } : null}>
      <div className="linha entre">
        <span className="forte">#{p.numero} · {p.cliente.nome}</span>
        <div className="linha" style={{ gap: 6 }}>
          {p.entrega?.dedicada && <span className="selo" style={{ background: "#d97706" }}><Zap size={12} /> Dedicada</span>}
          <SeloStatus status={p.status} />
        </div>
      </div>
      <div className="pequeno">📍 {p.endereco.complemento ? <b>{p.endereco.complemento} — </b> : ""}{p.endereco.texto}</div>
      <div className="suave pequeno">
        {p.entrega?.km?.toFixed(1)} km · Cobrar {brl(p.aPagar)} ({PAGAMENTOS[p.pagamento.metodo]?.nome}
        {p.pagamento.trocoPara ? `, troco para ${brl(p.pagamento.trocoPara)}` : ""}) · repasse {brl(repasseMotoboy(p, cfg))}
      </div>
      <div className="linha">{children}</div>
    </div>
  );
}

function EntrarMotoboy({ motoboys, aoEntrar }) {
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  return (
    <form
      className="cartao coluna"
      style={{ maxWidth: 380, margin: "40px auto" }}
      onSubmit={(e) => {
        e.preventDefault();
        const m = motoboys.find((x) => x.id === id);
        if (!m) return setErro("Escolha seu nome.");
        if ((m.pin || "") !== pin) return setErro("PIN incorreto.");
        aoEntrar(m.id);
      }}
    >
      <h2>🛵 Entrar como motoboy</h2>
      {motoboys.length === 0 && <div className="suave pequeno">Nenhum motoboy cadastrado. Peça para a loja cadastrar você.</div>}
      <Campo rotulo="Seu nome">
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Selecione…</option>
          {motoboys.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="PIN" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} />
      {erro && <div className="pequeno" style={{ color: "#b91c1c" }}>{erro}</div>}
      <button className="btn primario">Entrar</button>
    </form>
  );
}
