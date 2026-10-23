"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRows } from "@/lib/data/hooks";
import { ensureDemoTrip } from "@/lib/demo/seed";
import type { CurrencyCode, ID, Trip } from "@/lib/types";

interface TripCtx {
  trips: Trip[];
  trip: Trip | null;
  tripId: ID | null;
  loading: boolean;
  error: string | null;
  select: (id: ID | null) => void;
  displayCurrency: CurrencyCode | null; // null = moeda base da viagem
  setDisplayCurrency: (c: CurrencyCode | null) => void;
}

const Ctx = createContext<TripCtx | null>(null);
const KEY = "viajar:trip";
const CUR_KEY = "viajar:display-currency";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  const { data: trips, loading, error, reload } = useRows("trips");
  const [tripId, setTripId] = useState<ID | null>(null);
  const [displayCurrency, setCur] = useState<CurrencyCode | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    setTripId(read(KEY));
    setCur(read(CUR_KEY));
    ensureDemoTrip()
      .then((t) => {
        if (t) {
          write(KEY, t.id);
          setTripId(t.id);
          reload();
        }
      })
      .catch(() => {})
      .finally(() => setSeeded(true));
  }, [reload]);

  const sorted = useMemo(() => [...trips].sort((a, b) => a.start_date.localeCompare(b.start_date)), [trips]);
  const trip = useMemo(() => sorted.find((t) => t.id === tripId) ?? sorted.find((t) => t.status !== "concluida") ?? sorted[0] ?? null, [sorted, tripId]);

  const select = useCallback((id: ID | null) => {
    write(KEY, id);
    setTripId(id);
  }, []);
  const setDisplayCurrency = useCallback((c: CurrencyCode | null) => {
    write(CUR_KEY, c);
    setCur(c);
  }, []);

  const value = useMemo<TripCtx>(
    () => ({ trips: sorted, trip, tripId: trip?.id ?? null, loading: loading || !seeded, error, select, displayCurrency, setDisplayCurrency }),
    [sorted, trip, loading, seeded, error, select, displayCurrency, setDisplayCurrency],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrip(): TripCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTrip fora de TripProvider");
  return c;
}
