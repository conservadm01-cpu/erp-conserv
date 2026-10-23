"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRows } from "@/lib/data/hooks";
import { generateAlerts, markAlertsRead, readAlertKeys, type AlertOptions, type UpcomingAlert } from "@/lib/notifications/generate";
import type { ID } from "@/lib/types";

/** Alertas da viagem calculados a partir dos dados atuais (atualiza a cada minuto). */
export function useTripAlerts(tripId: ID | null, opts: Omit<AlertOptions, "now"> = {}) {
  const where = tripId ? { trip_id: tripId } : null;
  const reservations = useRows("reservations", where);
  const expenses = useRows("expenses", where);
  const payments = useRows("payments", where);
  const days = useRows("itinerary_days", where);
  const items = useRows("itinerary_items", where);
  const [now, setNow] = useState(() => new Date());
  const [read, setRead] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setRead(readAlertKeys());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const optsKey = JSON.stringify(opts);
  const alerts: UpcomingAlert[] = useMemo(
    () =>
      generateAlerts(
        { reservations: reservations.data, expenses: expenses.data, payments: payments.data, days: days.data, items: items.data },
        { ...(JSON.parse(optsKey) as AlertOptions), now },
      ),
    [reservations.data, expenses.data, payments.data, days.data, items.data, now, optsKey],
  );

  const markRead = useCallback((keys: string[]) => {
    markAlertsRead(keys);
    setRead(readAlertKeys());
  }, []);

  return {
    alerts,
    unread: alerts.filter((a) => !read.has(a.key)),
    isRead: (k: string) => read.has(k),
    markRead,
    loading: reservations.loading || expenses.loading || items.loading,
  };
}
