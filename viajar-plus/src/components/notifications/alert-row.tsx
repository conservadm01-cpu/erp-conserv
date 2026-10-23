import Link from "next/link";
import { BedDouble, CalendarClock, Clock, LogOut, Receipt, TimerOff } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AlertKind, UpcomingAlert } from "@/lib/notifications/generate";

const ICON: Record<AlertKind, typeof Clock> = {
  checkin: BedDouble,
  checkout: LogOut,
  inicio: CalendarClock,
  cancelamento: TimerOff,
  vencimento: Receipt,
  horario: Clock,
};

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.round(abs / 3_600_000);
  const label = h < 1 ? `${Math.max(1, Math.round(abs / 60_000))} min` : h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`;
  return diff < 0 ? `há ${label}` : `em ${label}`;
}

export function AlertRow({ a, unread, onClick }: { a: UpcomingAlert; unread?: boolean; onClick?: () => void }) {
  const Icon = ICON[a.kind];
  return (
    <Link href={a.href} onClick={onClick} className={cn("flex gap-3 rounded-lg p-2 text-sm hover:bg-surface-2", unread && "bg-accent/5")}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.overdue ? "text-red-600" : "text-accent")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", unread && "font-semibold")}>{a.title}</span>
        <span className="block truncate text-xs text-muted">{a.body}</span>
      </span>
      <span className={cn("shrink-0 text-right text-xs", a.overdue ? "text-red-600" : "text-muted")} title={fmtDateTime(a.due_at)}>
        {a.overdue ? "atrasado · " : ""}
        {relative(a.due_at)}
      </span>
    </Link>
  );
}
