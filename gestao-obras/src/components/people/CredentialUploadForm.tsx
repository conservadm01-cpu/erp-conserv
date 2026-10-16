"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

const KINDS: Record<string, string> = {
  TREINAMENTO: "Treinamento (ex.: NR-35, NR-10)", EXPERIENCIA: "Comprovação de experiência", REGISTRO_CONSELHO: "Registro profissional / conselho",
  CERTIFICADO: "Certificado", QUALIFICACAO: "Qualificação", HABILITACAO: "Habilitação",
};

/** Envio de comprovante pelo próprio titular: fica aguardando conferência. */
export function CredentialUploadForm() {
  const router = useRouter();
  const [v, setV] = useState({ kind: "TREINAMENTO", name: "", issuer: "", issueDate: "", expiryDate: "" });
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    const form = new FormData();
    for (const [k, val] of Object.entries(v)) form.set(k, val);
    if (file) form.set("file", file);
    if (await run(() => apiUpload("/api/me/credentials", form))) {
      setDone(true);
      setV({ ...v, name: "", issuer: "", issueDate: "", expiryDate: "" });
      setFile(null);
      router.refresh();
    }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
      {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
      {done && <div className="sm:col-span-2"><Alert tone="success">Comprovante enviado. Ele aguarda conferência.</Alert></div>}
      <SelectField label="Tipo" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
        {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <TextField label="Nome do comprovante" required maxLength={200} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={fieldErrors.name} placeholder="Ex.: NR-35 — Trabalho em altura" />
      <TextField label="Emitido por" maxLength={200} value={v.issuer} onChange={(e) => setV({ ...v, issuer: e.target.value })} />
      <TextField label="Data de emissão" type="date" value={v.issueDate} onChange={(e) => setV({ ...v, issueDate: e.target.value })} />
      <TextField label="Válido até" type="date" value={v.expiryDate} onChange={(e) => setV({ ...v, expiryDate: e.target.value })} error={fieldErrors.expiryDate} hint={v.kind === "TREINAMENTO" ? "Obrigatório para certificados de treinamento." : undefined} />
      <div>
        <label className="label" htmlFor="cred-file">Arquivo (PDF ou imagem)</label>
        <input id="cred-file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {fieldErrors.file && <p className="mt-1 text-xs text-red-700">{fieldErrors.file.join(" ")}</p>}
      </div>
      <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={!file}>Enviar comprovante</Button></div>
    </form>
  );
}
