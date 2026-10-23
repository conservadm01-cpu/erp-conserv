"use client";
import { useCallback, useEffect, useState } from "react";
import { getRepo } from "@/lib/data";
import type { GeoResult } from "@/lib/providers/types";
import { getProvider } from "@/lib/search/client";
import type { Trip } from "@/lib/types";

/** Coordenadas do destino: usa as salvas na viagem ou geocodifica (Nominatim) e salva. */
export function useTripCoords(trip: Trip) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    trip.destination_lat != null && trip.destination_lng != null ? { lat: trip.destination_lat, lng: trip.destination_lng } : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCoords(trip.destination_lat != null && trip.destination_lng != null ? { lat: trip.destination_lat, lng: trip.destination_lng } : null);
  }, [trip.id, trip.destination_lat, trip.destination_lng]);

  const locate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = [trip.destination, trip.destination_country].filter(Boolean).join(", ");
      const r = await getProvider<GeoResult>("/api/geocode", { q, limit: 1 });
      const hit = r.results[0];
      if (!hit) throw new Error(`Não encontramos "${q}" no mapa. Ajuste o destino da viagem.`);
      await getRepo().update("trips", trip.id, { destination_lat: hit.lat, destination_lng: hit.lng });
      setCoords({ lat: hit.lat, lng: hit.lng });
      return { lat: hit.lat, lng: hit.lng };
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoading(false);
    }
  }, [trip.id, trip.destination, trip.destination_country]);

  return { coords, loading, error, locate };
}
