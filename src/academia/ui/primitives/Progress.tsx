import { cn } from "../../core/cn";

export function ProgressBar({ value, tone = "navy", size = "md", label, showValue }: {
  value: number;
  tone?: "navy" | "copper" | "jade";
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const height = size === "sm" ? "h-1.5" : size === "lg" ? "h-3.5" : "h-2.5";
  const fill = tone === "copper" ? "bg-copper" : tone === "jade" ? "bg-jade" : "bg-navy";
  return (
    <div>
      {(label || showValue) && (
        <div className="flex justify-between items-baseline mb-1.5">
          {label && <span className="text-[12px] font-semibold text-ink-600">{label}</span>}
          {showValue && <span className="text-[12px] font-bold text-navy-900 tabular-nums">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div
        className={cn("w-full rounded-full bg-sand/40 overflow-hidden", height)}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** Medidor de nível 1–6 da matriz de competências. */
export function LevelMeter({ level, target, size = "md" }: { level: number; target?: number; size?: "sm" | "md" }) {
  const box = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  return (
    <div className="flex items-center gap-1" aria-label={`Nível ${level} de 6${target ? `, alvo ${target}` : ""}`}>
      {[1, 2, 3, 4, 5, 6].map((step) => {
        const filled = step <= level;
        const isTarget = target === step;
        return (
          <span
            key={step}
            className={cn(
              box,
              "rounded-[3px] border",
              filled ? "bg-navy border-navy" : "bg-linen-200 border-sand",
              isTarget && !filled && "border-copper border-2",
              isTarget && filled && "ring-2 ring-copper/40",
            )}
          />
        );
      })}
    </div>
  );
}
