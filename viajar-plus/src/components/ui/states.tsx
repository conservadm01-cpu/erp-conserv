import type { ReactNode } from "react";
import { AlertTriangle, Info, CircleAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icon && <div className="text-accent [&>svg]:h-10 [&>svg]:w-10">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-2", className)} aria-hidden />;
}

export function Loading({ label = "Carregando…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

type NoticeTone = "info" | "warn" | "error" | "success";

export function Notice({ tone = "info", title, children, className }: { tone?: NoticeTone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const map = {
    info: { cls: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-100", Icon: Info },
    warn: { cls: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100", Icon: AlertTriangle },
    error: { cls: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100", Icon: CircleAlert },
    success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100", Icon: CheckCircle2 },
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border p-3 text-sm", map.cls, className)}>
      <map.Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sunset-600 dark:text-sunset-400">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
