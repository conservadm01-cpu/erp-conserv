"use client";
import { BellRing } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ID } from "@/lib/types";
import { useTripAlerts } from "./use-alerts";
import { AlertRow } from "./alert-row";

/** Bloco "Próximos alertas" para o Painel e outras telas. */
export function UpcomingAlerts({ tripId, limit = 6, leadDays = 30 }: { tripId: ID; limit?: number; leadDays?: number }) {
  const h = leadDays * 24;
  const { alerts, isRead, markRead, loading } = useTripAlerts(tripId, {
    leadHours: { checkin: h, checkout: h, inicio: h, cancelamento: h, vencimento: h, horario: 48 },
  });
  return (
    <Card>
      <CardHeader title="Próximos alertas" subtitle={`Próximos ${leadDays} dias e itens atrasados`} />
      <CardBody className="p-2">
        {loading && !alerts.length ? (
          <p className="p-3 text-sm text-muted" role="status">Carregando…</p>
        ) : !alerts.length ? (
          <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-muted">
            <BellRing className="h-6 w-6 text-accent" aria-hidden />
            Sem check-ins, prazos de cancelamento, vencimentos ou horários próximos.
          </div>
        ) : (
          <ul>
            {alerts.slice(0, limit).map((a) => (
              <li key={a.key}>
                <AlertRow a={a} unread={!isRead(a.key)} onClick={() => markRead([a.key])} />
              </li>
            ))}
            {alerts.length > limit && <li className="px-2 py-1 text-xs text-muted">+ {alerts.length - limit} alerta(s)</li>}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
