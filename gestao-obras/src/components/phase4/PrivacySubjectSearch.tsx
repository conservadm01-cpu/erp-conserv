"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { EntityForm } from "../ui/EntityForm";
import { useSubmit } from "../ui/useForm";
import { PRIVACY_KIND } from "../works/labels";
import { opts } from "../phase3/labels";

type Subject = { type: "USUARIO" | "PESSOA"; id: string; name: string; email: string | null };

/** Localiza o titular (usuário ou pessoa cadastrada) e registra a solicitação. */
export function PrivacySubjectSearch() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Subject[] | null>(null);
  const [chosen, setChosen] = useState<Subject | null>(null);
  const { pending, error, run } = useSubmit();
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setChosen(null);
    const res = await run(() => api<{ subjects: Subject[] }>(`/api/privacy/subjects?q=${encodeURIComponent(q)}`));
    if (res) setFound(res.subjects);
  }
  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-wrap items-end gap-2" role="search">
        <TextField label="Nome ou e-mail do titular" value={q} onChange={(e) => setQ(e.target.value)} hint="Mínimo de 3 caracteres" className="min-w-64 flex-1" />
        <Button type="submit" loading={pending} disabled={q.trim().length < 3}>Buscar titular</Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {found && found.length === 0 && <p className="text-sm text-slate-500">Nenhum titular encontrado.</p>}
      {found && found.length > 0 && !chosen && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
          {found.map((s) => (
            <li key={`${s.type}-${s.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span>{s.name} <span className="text-slate-500">· {s.email ?? "sem e-mail"} · {s.type === "USUARIO" ? "usuário" : "pessoa cadastrada"}</span></span>
              <Button variant="secondary" onClick={() => setChosen(s)}>Selecionar {s.name}</Button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <div className="rounded-md border border-slate-200 p-4">
          <p className="mb-3 text-sm">Titular: <strong>{chosen.name}</strong> ({chosen.type === "USUARIO" ? "usuário" : "pessoa cadastrada"}) <button type="button" className="text-brand-700 hover:underline" onClick={() => setChosen(null)}>trocar</button></p>
          <EntityForm
            action="/api/privacy/requests"
            submitLabel="Registrar solicitação"
            successMessage="Solicitação registrada."
            fixed={{ subjectType: chosen.type, subjectId: chosen.id }}
            fields={[
              { name: "kind", label: "Tipo de pedido", type: "select", required: true, options: opts(PRIVACY_KIND) },
              { name: "channel", label: "Canal de recebimento", required: true, maxLength: 120, placeholder: "e-mail, presencial…" },
              { name: "details", label: "Descrição do pedido", type: "textarea", required: true, maxLength: 2000, span: 2 },
            ]}
          />
        </div>
      )}
    </div>
  );
}
