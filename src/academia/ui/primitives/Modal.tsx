import React, { useEffect, useRef } from "react";
import { cn } from "../../core/cn";
import { Icon } from "./Icon";

export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const origemDoFoco = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Acessibilidade: o foco entra no diálogo e volta para o botão que o
    // abriu, para quem navega por teclado não ficar perdido na página.
    origemDoFoco.current = document.activeElement as HTMLElement | null;
    const primeiro = dialogRef.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea, button, [href], [tabindex]:not([tabindex='-1'])",
    );
    (primeiro ?? dialogRef.current)?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      origemDoFoco.current?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 no-print">
      <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-linen-50 shadow-lift animate-pop-in",
          "rounded-t-2xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col",
          width,
        )}
      >
        <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-sand/60">
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold leading-snug">{title}</h2>
            {subtitle && <p className="text-[13px] text-ink-600 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="shrink-0 p-1.5 rounded-lg hover:bg-ink/5 text-ink-600">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5 flex-1">{children}</div>
        {footer && <div className="p-4 sm:p-5 border-t border-sand/60 flex flex-wrap gap-2 justify-end bg-linen-100/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
