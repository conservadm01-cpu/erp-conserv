"use client";
import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { MapViewProps } from "./types";

function FitBounds({ markers, center }: Pick<MapViewProps, "markers" | "center">) {
  const map = useMap();
  const key = markers.map((m) => `${m.id}:${m.lat}:${m.lng}`).join("|");
  useEffect(() => {
    if (markers.length > 1) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [30, 30], maxZoom: 15 });
    } else if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], Math.max(map.getZoom(), 13));
    } else if (center) {
      map.setView(center, map.getZoom());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, center?.[0], center?.[1]]);
  return null;
}

export default function LeafletMap({ markers, center, zoom = 12, height = 360, onSelect, className }: MapViewProps) {
  const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  const c: [number, number] = center ?? (valid[0] ? [valid[0].lat, valid[0].lng] : [-14.235, -51.925]);
  return (
    <div className={className} style={{ height }} role="region" aria-label="Mapa">
      <MapContainer center={c} zoom={valid.length || center ? zoom : 3} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores do OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitBounds markers={valid} center={center} />
        {valid.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={8}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: m.color ?? "#1f7596", fillOpacity: 0.95 }}
            eventHandlers={{ click: () => onSelect?.(m.id) }}
          >
            <Popup>
              <strong>{m.title}</strong>
              {m.subtitle && <div style={{ fontSize: 12 }}>{m.subtitle}</div>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
