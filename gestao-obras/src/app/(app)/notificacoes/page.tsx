import type { Metadata } from "next";
import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-context";
import { listMyNotifications } from "@/server/services/notification.service";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ActionButton } from "@/components/ui/EntityForm";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const actor = await requirePageActor();
  const list = await listMyNotifications(actor);
  const unread = list.filter((n) => !n.readAt).length;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Notificações" description={`${unread} não lida(s). Alertas e itens críticos também são enviados por e-mail.`} actions={unread > 0 && <ActionButton label="Marcar todas como lidas" action="/api/notifications" method="PATCH" body={{ ids: "all" }} />} />
      {list.length === 0 ? <EmptyState title="Nenhuma notificação" /> : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className={`card flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between ${n.readAt ? "opacity-70" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium">
                  {n.severity === "CRITICO" && <Badge tone="red">crítico</Badge>} {n.severity === "ALERTA" && <Badge tone="amber">alerta</Badge>} {n.title}
                </p>
                <p className="text-sm text-slate-700">{n.body}</p>
                <p className="text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {n.link && <Link href={n.link} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Abrir</Link>}
                {!n.readAt && <ActionButton label="Marcar como lida" variant="ghost" action="/api/notifications" method="PATCH" body={{ ids: [n.id] }} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
