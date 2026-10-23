"use client";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useTrip } from "@/lib/trips/context";
import { cn } from "@/lib/cn";
import { useTripAlerts } from "./use-alerts";
import { AlertRow } from "./alert-row";

/** Sino de alertas da viagem ativa (check-in/out, prazos, vencimentos e horários). */
export function NotificationBell() {
  const { tripId } = useTrip();
  const { alerts, unread, isRead, markRead } = useTripAlerts(tripId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-lg p-2 hover:bg-surface-2"
        aria-label={unread.length ? `Alertas: ${unread.length} não lidos` : "Alertas"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-sunset-500 px-1 text-[10px] font-bold text-white" aria-hidden>
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Próximos alertas" className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-display font-semibold">Próximos alertas</span>
            {unread.length > 0 && (
              <button className="text-xs text-accent hover:underline" onClick={() => markRead(alerts.map((a) => a.key))}>
                Marcar todos como lidos
              </button>
            )}
          </div>
          <div className={cn("max-h-[60vh] overflow-y-auto", !alerts.length && "p-4 text-center text-sm text-muted")}>
            {!alerts.length
              ? "Nada nos próximos dias. Alertas surgem de reservas, vencimentos do orçamento e horários do roteiro."
              : alerts.map((a) => (
                  <AlertRow
                    key={a.key}
                    a={a}
                    unread={!isRead(a.key)}
                    onClick={() => {
                      markRead([a.key]);
                      setOpen(false);
                    }}
                  />
                ))}
          </div>
        </div>
      )}
    </div>
  );
}
