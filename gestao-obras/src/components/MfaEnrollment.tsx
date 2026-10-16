"use client";

import { useState } from "react";
import { api, STATE_ROUTES } from "@/lib/api";
import { Button } from "./ui/Button";
import { TextField } from "./ui/Field";
import { Alert } from "./ui/Alert";
import { useSubmit } from "./ui/useForm";

type Enrollment = { secret: string; otpauthUrl: string; qrDataUrl: string };

export function MfaEnrollment({ afterDone }: { afterDone?: string }) {
  const [data, setData] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const start = useSubmit();
  const confirm = useSubmit();

  async function begin() {
    const res = await start.run(() => api<Enrollment>("/api/auth/mfa/enrollment", { method: "POST" }));
    if (res) setData(res);
  }

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    const res = await confirm.run(() => api<{ recoveryCodes: string[] }>("/api/auth/mfa/enrollment/confirm", { body: { code } }));
    if (res) setCodes(res.recoveryCodes);
  }

  async function finish() {
    const s = await api<{ state: string }>("/api/auth/session");
    window.location.assign(afterDone ?? STATE_ROUTES[s.state] ?? "/");
  }

  if (codes) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="MFA ativado">Guarde os códigos de recuperação abaixo em local seguro. Eles não serão exibidos novamente.</Alert>
        <ul className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-4 font-mono text-sm" data-testid="recovery-codes">
          {codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Button className="w-full" onClick={finish}>Guardei os códigos, continuar</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {start.error && <Alert tone="error">{start.error}</Alert>}
        <Button onClick={begin} loading={start.pending}>Gerar QR Code</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onConfirm} className="space-y-4" noValidate>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>Escaneie o QR Code com o aplicativo autenticador.</li>
        <li>Digite o código de 6 dígitos gerado para confirmar.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.qrDataUrl} alt="QR Code para cadastro do autenticador" className="mx-auto h-44 w-44" />
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer">Não consegue ler o QR Code? Digite a chave manualmente</summary>
        <code className="mt-2 block break-all rounded bg-slate-100 p-2" data-testid="mfa-secret">{data.secret}</code>
      </details>
      {confirm.error && <Alert tone="error">{confirm.error}</Alert>}
      <TextField label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} />
      <Button type="submit" className="w-full" loading={confirm.pending}>Confirmar e ativar</Button>
    </form>
  );
}
