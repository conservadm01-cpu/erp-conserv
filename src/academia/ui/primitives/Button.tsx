import React from "react";
import { cn } from "../../core/cn";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "copper" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-navy text-linen-50 hover:bg-navy-700 active:bg-navy-800 border border-navy-800/20 shadow-card",
  copper: "bg-copper text-linen-50 hover:bg-copper-600 active:bg-copper-600 border border-copper-600/30 shadow-card",
  secondary: "bg-linen-50 text-navy-900 border border-sand hover:bg-linen-100 active:bg-linen-200",
  outline: "bg-transparent text-navy-900 border border-navy/30 hover:bg-navy/5",
  ghost: "bg-transparent text-ink-600 hover:bg-ink/5",
  danger: "bg-alert text-white hover:brightness-110 border border-alert/40",
};

const SIZES: Record<Size, string> = {
  sm: "text-[13px] px-3 py-1.5 gap-1.5 rounded-lg",
  md: "text-[14px] px-4 py-2.5 gap-2 rounded-xl",
  lg: "text-[16px] px-5 py-3.5 gap-2.5 rounded-xl font-semibold",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  block?: boolean;
}

export function Button({
  variant = "primary", size = "md", icon, iconRight, loading, block, className, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-colors select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Icon name="refresh" size={16} className="animate-spin" /> : icon ? <Icon name={icon} size={size === "lg" ? 20 : 16} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === "lg" ? 20 : 16} /> : null}
    </button>
  );
}
