"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Common = { label: string; error?: string[] | string; hint?: ReactNode };

function Errors({ id, error }: { id: string; error?: string[] | string }) {
  const list = Array.isArray(error) ? error : error ? [error] : [];
  if (!list.length) return null;
  return (
    <ul id={id} className="mt-1 space-y-0.5 text-xs text-red-700">
      {list.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

function useIds(error: Common["error"], hint: ReactNode) {
  const id = useId();
  const has = Array.isArray(error) ? error.length > 0 : Boolean(error);
  const describedBy = [has ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return { id, has, describedBy };
}

export function TextField({ label, error, hint, className = "", ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const { id, has, describedBy } = useIds(error, hint);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {rest.required && <span className="text-red-600"> *</span>}
      </label>
      <input id={id} className="input" aria-invalid={has || undefined} aria-describedby={describedBy} {...rest} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      <Errors id={`${id}-err`} error={error} />
    </div>
  );
}

export function SelectField({ label, error, hint, className = "", children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const { id, has, describedBy } = useIds(error, hint);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {rest.required && <span className="text-red-600"> *</span>}
      </label>
      <select id={id} className="input" aria-invalid={has || undefined} aria-describedby={describedBy} {...rest}>
        {children}
      </select>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      <Errors id={`${id}-err`} error={error} />
    </div>
  );
}

export function TextAreaField({ label, error, hint, className = "", ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, has, describedBy } = useIds(error, hint);
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {rest.required && <span className="text-red-600"> *</span>}
      </label>
      <textarea id={id} className="input" aria-invalid={has || undefined} aria-describedby={describedBy} {...rest} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      <Errors id={`${id}-err`} error={error} />
    </div>
  );
}

export function CheckboxField({ label, className = "", ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-700" {...rest} />
      <label htmlFor={id} className="text-sm text-slate-700">{label}</label>
    </div>
  );
}
