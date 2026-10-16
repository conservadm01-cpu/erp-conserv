"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "./Button";
import { CheckboxField, SelectField, TextAreaField, TextField } from "./Field";
import { Alert } from "./Alert";
import { useSubmit } from "./useForm";

export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "date" | "time" | "datetime-local" | "url" | "textarea" | "select" | "checkbox" | "multi";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  span?: 1 | 2;
  maxLength?: number;
  placeholder?: string;
};

type Value = string | boolean | string[];

/** Permite que um formulário dentro de <Reveal> feche o painel (sem passar funções do servidor). */
const RevealContext = createContext<(() => void) | null>(null);

/**
 * Formulário declarativo: envia JSON para a API e mostra os erros de validação
 * devolvidos pelo servidor em cada campo.
 */
export function EntityForm({
  fields, initial = {}, action, method = "POST", submitLabel = "Salvar", onDone = "refresh", fixed = {}, cancel, successMessage,
}: {
  fields: FieldDef[];
  initial?: Record<string, Value>;
  action: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  submitLabel?: string;
  /** "refresh" recarrega os dados; um texto com ":id" navega para o registro criado. */
  onDone?: "refresh" | string;
  fixed?: Record<string, unknown>;
  cancel?: () => void;
  successMessage?: string;
}) {
  const router = useRouter();
  const close = useContext(RevealContext);
  const onCancel = cancel ?? close ?? undefined;
  const blank = Object.fromEntries(fields.map((f) => [f.name, f.type === "checkbox" ? false : f.type === "multi" ? [] : ""]));
  const [v, setV] = useState<Record<string, Value>>({ ...blank, ...initial });
  const [ok, setOk] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(false);
    const body: Record<string, unknown> = { ...fixed };
    for (const f of fields) {
      const val = v[f.name];
      body[f.name] = f.type === "number" ? (val === "" ? null : Number(val)) : val;
    }
    const res = await run(() => api<Record<string, { id?: string } | undefined>>(action, { method, body }));
    if (!res) return;
    if (onDone === "refresh") {
      setOk(true);
      if (method === "POST") setV({ ...blank, ...initial });
      router.refresh();
      close?.();
    } else {
      const created = Object.values(res).find((x) => x && typeof x === "object" && "id" in x) as { id: string } | undefined;
      router.push(onDone.replace(":id", created?.id ?? ""));
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
      {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
      {ok && successMessage && <div className="sm:col-span-2"><Alert tone="success">{successMessage}</Alert></div>}
      {fields.map((f) => {
        const common = { label: f.label, required: f.required, hint: f.hint, error: fieldErrors[f.name], className: f.span === 2 || f.type === "textarea" || f.type === "multi" ? "sm:col-span-2" : "" };
        if (f.type === "textarea") return <TextAreaField key={f.name} {...common} rows={3} maxLength={f.maxLength} value={v[f.name] as string} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />;
        if (f.type === "select")
          return (
            <SelectField key={f.name} {...common} value={v[f.name] as string} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
              <option value="">{f.required ? "Selecione…" : "—"}</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectField>
          );
        if (f.type === "checkbox") return <CheckboxField key={f.name} className={common.className} label={f.label} checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />;
        if (f.type === "multi") {
          const sel = v[f.name] as string[];
          return (
            <fieldset key={f.name} className="sm:col-span-2">
              <legend className="label">{f.label}</legend>
              {f.hint && <p className="mb-1 text-xs text-slate-500">{f.hint}</p>}
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {f.options?.map((o) => <CheckboxField key={o.value} label={o.label} checked={sel.includes(o.value)} onChange={() => setV({ ...v, [f.name]: sel.includes(o.value) ? sel.filter((x) => x !== o.value) : [...sel, o.value] })} />)}
              </div>
            </fieldset>
          );
        }
        return <TextField key={f.name} {...common} type={f.type ?? "text"} maxLength={f.maxLength} placeholder={f.placeholder} value={v[f.name] as string} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />;
      })}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={pending}>{submitLabel}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancelar</Button>}
      </div>
    </form>
  );
}

/** Mostra um formulário só depois de clicar no botão (evita poluir a tela). */
export function Reveal({ label, children, variant = "primary" }: { label: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <RevealContext.Provider value={() => setOpen(false)}>
      <div className="card p-4">{children}</div>
    </RevealContext.Provider>
  ) : (
    <Button variant={variant} onClick={() => setOpen(true)}>{label}</Button>
  );
}

/** Botão que executa uma chamada simples à API (com confirmação opcional por justificativa). */
export function ActionButton({ label, action, method = "POST", body = {}, variant = "secondary", confirmText }: { label: string; action: string; method?: "POST" | "PATCH" | "PUT" | "DELETE"; body?: Record<string, unknown>; variant?: "primary" | "secondary" | "danger" | "ghost"; confirmText?: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const { pending, error, run } = useSubmit();
  async function go() {
    const res = await run(() => api(action, method === "DELETE" ? { method } : { method, body }));
    setAsking(false);
    if (res) router.refresh();
  }
  return (
    <span className="inline-flex flex-col gap-1">
      {asking ? (
        <span className="inline-flex items-center gap-2 text-sm">
          {confirmText}
          <Button variant="danger" loading={pending} onClick={go}>Confirmar</Button>
          <Button variant="ghost" onClick={() => setAsking(false)}>Voltar</Button>
        </span>
      ) : (
        <Button variant={variant} loading={pending} onClick={() => (confirmText ? setAsking(true) : go())}>{label}</Button>
      )}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
