import React from "react";
import { cn } from "../../core/cn";
import { Icon } from "./Icon";
import { accentClasses } from "./Card";

export function EmptyState({ icon = "compass", title, description, action }: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card p-8 text-center">
      <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-sand/25 text-ink-600 border border-sand mb-3">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="font-bold text-[15px]">{title}</h3>
      {description && <p className="text-[13.5px] text-ink-600 mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatTile({ label, value, hint, icon, accent = "navy", onClick }: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn("card p-4 flex items-start gap-3", onClick && "cursor-pointer hover:shadow-lift transition-shadow")}
      onClick={onClick}
    >
      {icon && (
        <span className={cn("shrink-0 grid place-items-center w-9 h-9 rounded-xl border", accentClasses(accent))}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-600">{label}</div>
        <div className="text-[22px] font-bold text-navy-900 leading-tight tabular-nums">{value}</div>
        {hint && <div className="text-[12px] text-ink-400 mt-0.5 leading-snug">{hint}</div>}
      </div>
    </div>
  );
}

export function Callout({ tone = "info", title, children, icon }: {
  tone?: "info" | "alerta" | "dica" | "atencao";
  title?: string;
  children: React.ReactNode;
  icon?: string;
}) {
  const config = {
    info: { cls: "bg-navy/5 border-navy/20 text-navy-900", icon: icon ?? "info" },
    dica: { cls: "bg-jade/8 border-jade/25 text-jade-600", icon: icon ?? "lightbulb" },
    alerta: { cls: "bg-copper/8 border-copper/25 text-copper-600", icon: icon ?? "alert" },
    atencao: { cls: "bg-alert/8 border-alert/25 text-alert", icon: icon ?? "alert" },
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3.5 flex gap-3", config.cls)}>
      <Icon name={config.icon} size={18} className="shrink-0 mt-0.5" />
      <div className="min-w-0 text-[14px] leading-relaxed">
        {title && <div className="font-bold mb-0.5">{title}</div>}
        <div className="text-ink">{children}</div>
      </div>
    </div>
  );
}

/** Aviso legal obrigatório nos conteúdos normativos (seção 6). */
export function LegalNotice({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("text-[12px] text-ink-600 bg-sand/20 border border-sand/60 rounded-lg px-3 py-2 flex gap-2 items-start", className)}>
      <Icon name="info" size={14} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
