import React from "react";
import { cn } from "../../core/cn";
import { Icon } from "./Icon";

export function Card({ className, children, as: Tag = "div", onClick, interactive }: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article" | "li";
  onClick?: () => void;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "card",
        (interactive || onClick) && "transition-shadow hover:shadow-lift cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon, accent = "navy", right, className }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: string;
  accent?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 p-4 sm:p-5", className)}>
      {icon && (
        <span className={cn("shrink-0 grid place-items-center w-10 h-10 rounded-xl border", accentClasses(accent))}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] sm:text-base font-bold leading-snug">{title}</h3>
        {subtitle && <p className="text-[13px] text-ink-600 mt-0.5 leading-snug">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function accentClasses(accent: string): string {
  switch (accent) {
    case "copper":
      return "bg-copper/10 text-copper-600 border-copper/25";
    case "jade":
      return "bg-jade/10 text-jade-600 border-jade/25";
    case "sand":
      return "bg-sand/25 text-ink-600 border-sand";
    case "alert":
      return "bg-alert/10 text-alert border-alert/25";
    case "ink":
      return "bg-ink/10 text-ink border-ink/20";
    default:
      return "bg-navy/10 text-navy border-navy/20";
  }
}

export function SectionTitle({ children, action, hint }: { children: React.ReactNode; action?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[17px] sm:text-lg font-bold">{children}</h2>
        {hint && <p className="text-[13px] text-ink-600 mt-0.5">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
