import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { modoTeste } from "./db.js";

// Mapa OpenStreetMap com marcadores em emoji (sem depender de imagens
// de ícone do Leaflet, que quebram no build do Vite).
// pontos: [{ id, lat, lng, emoji, rotulo }]
const ICONES = {};
function icone(emoji) {
  if (!ICONES[emoji]) {
    ICONES[emoji] = L.divIcon({
      className: "pz-marcador",
      html: `<span>${emoji}</span>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
  return ICONES[emoji];
}

export default function Mapa({ pontos = [], altura = 280, aoClicar, seguir = true }) {
  const div = useRef(null);
  const mapa = useRef(null);
  const marcadores = useRef({});
  const linha = useRef(null);
  const ajustado = useRef(false);

  useEffect(() => {
    const m = L.map(div.current, { zoomControl: true, attributionControl: true });
    // Na versão de teste (artefato) imagens externas são bloqueadas: o mapa
    // fica sem fundo, só com os marcadores sobre uma grade.
    if (!modoTeste) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);
    }
    m.setView([-23.55, -46.63], 13);
    mapa.current = m;
    return () => { m.remove(); mapa.current = null; marcadores.current = {}; ajustado.current = false; };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const handler = aoClicar ? (e) => aoClicar({ lat: e.latlng.lat, lng: e.latlng.lng }) : null;
    if (handler) m.on("click", handler);
    return () => { if (handler) m.off("click", handler); };
  }, [aoClicar]);

  // Só reposiciona quando algum ponto muda de fato, não a cada render.
  const assinatura = JSON.stringify(pontos.map((p) => p && [p.id, p.lat, p.lng, p.emoji, p.rotulo]));

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const validos = pontos.filter((p) => p && p.lat != null && p.lng != null);
    const ids = new Set(validos.map((p) => p.id));
    for (const id of Object.keys(marcadores.current)) {
      if (!ids.has(id)) { marcadores.current[id].remove(); delete marcadores.current[id]; }
    }
    for (const p of validos) {
      const mk = marcadores.current[p.id];
      if (mk) {
        mk.setLatLng([p.lat, p.lng]);
        mk.setIcon(icone(p.emoji || "📍"));
      } else {
        marcadores.current[p.id] = L.marker([p.lat, p.lng], { icon: icone(p.emoji || "📍") })
          .addTo(m)
          .bindTooltip(p.rotulo || "");
      }
    }
    if (linha.current) { linha.current.remove(); linha.current = null; }
    if (validos.length >= 2) {
      linha.current = L.polyline(validos.map((p) => [p.lat, p.lng]), { color: "#b3261e", weight: 3, dashArray: "6 8", opacity: 0.7 }).addTo(m);
    }
    // Enquadra todos os pontos na primeira vez e, se `seguir`, sempre que
    // eles se moverem (ex.: motoboy andando).
    if (validos.length && (seguir || !ajustado.current)) {
      if (validos.length === 1) m.setView([validos[0].lat, validos[0].lng], Math.max(m.getZoom(), 15));
      else m.fitBounds(L.latLngBounds(validos.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16 });
      ajustado.current = true;
    }
  }, [assinatura, seguir]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={div} className={"pz-mapa" + (modoTeste ? " sem-fundo" : "")} style={{ height: altura }} />;
}
