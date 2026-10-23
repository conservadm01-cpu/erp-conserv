"use client";
import dynamic from "next/dynamic";
import type { MapViewProps } from "./types";

export type { MapMarker, MapViewProps } from "./types";

/** Mapa Leaflet com tiles do OpenStreetMap; carregado só no navegador (sem SSR). */
export const MapView = dynamic<MapViewProps>(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-xl bg-surface-2" aria-label="Carregando mapa" />,
});

export default MapView;
