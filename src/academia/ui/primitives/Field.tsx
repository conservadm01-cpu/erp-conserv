import React, { useId } from "react";
import { cn } from "../../core/cn";

export function Field({ label, hint, error, required, children, className }: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">
        {label}
        {required && <span className="text-copper ml-1">*</span>}
      </span>
      {children}
      {hint && !error && <span className="block mt-1 text-[12px] text-ink-400">{hint}</span>}
      {error && <span className="block mt-1 text-[12px] font-semibold text-alert">{error}</span>}
    </label>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} {...rest} />;
}

export function TextArea({ className, rows = 4, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn("field resize-y", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("field appearance-none bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b5d49' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>\")", backgroundPosition: "right 12px center" }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 w-11 h-6 rounded-full transition-colors border",
          checked ? "bg-jade border-jade-600" : "bg-sand/50 border-sand",
        )}
      >
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-linen-50 shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[14px] font-semibold text-navy-900">{label}</span>
        {hint && <span className="block text-[12.5px] text-ink-600">{hint}</span>}
      </label>
    </div>
  );
}

export function CheckboxRow({ checked, onChange, title, description, right }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer",
        checked ? "bg-navy/5 border-navy/30" : "bg-linen-50 border-sand/60 hover:border-sand",
      )}
      onClick={() => onChange(!checked)}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 w-4 h-4 accent-[#2f4a63]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-navy-900 leading-snug">{title}</div>
        {description && <div className="text-[13px] text-ink-600 mt-1 leading-snug">{description}</div>}
      </div>
      {right}
    </div>
  );
}
