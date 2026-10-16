"use client";

import { useState } from "react";
import { api, STATE_ROUTES } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useSubmit } from "@/components/ui/useForm";
import { LogoutButton } from "@/components/LogoutButton";

export function MfaVerifyForm() {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const { pending, error, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api<{ state: string }>("/api/auth/mfa/verify", { body: { code } }));
    if (res) window.location.assign(STATE_ROUTES[res.state] ?? "/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Verificação em duas etapas</h1>
      <p className="text-sm text-slate-600">
        {recovery ? "Digite um dos seus códigos de recuperação (cada código só pode ser usado uma vez)." : "Digite o código de 6 dígitos exibido no seu aplicativo autenticador."}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label={recovery ? "Código de recuperação" : "Código"}
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        required
        autoFocus
        value={code}
        maxLength={recovery ? 20 : 6}
        onChange={(e) => setCode(e.target.value)}
      />
      <Button type="submit" className="w-full" loading={pending}>Verificar</Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" className="text-brand-700 hover:underline" onClick={() => { setRecovery(!recovery); setCode(""); }}>
          {recovery ? "Usar o aplicativo autenticador" : "Usar código de recuperação"}
        </button>
        <LogoutButton />
      </div>
    </form>
  );
}
