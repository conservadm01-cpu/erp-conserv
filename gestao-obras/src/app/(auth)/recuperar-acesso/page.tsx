"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useSubmit } from "@/components/ui/useForm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const { pending, error, fieldErrors, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api<{ message: string }>("/api/auth/password/forgot", { body: { email } }));
    if (res) setDone(res.message);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Recuperar acesso</h1>
      {done ? (
        <Alert tone="success">{done}</Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <p className="text-sm text-slate-600">Informe o e-mail cadastrado. Enviaremos um link válido por 30 minutos.</p>
          {error && <Alert tone="error">{error}</Alert>}
          <TextField label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
          <Button type="submit" className="w-full" loading={pending}>Enviar instruções</Button>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand-700 hover:underline">Voltar para o login</Link>
      </p>
      <p className="text-xs text-slate-500">
        Perdeu o acesso ao aplicativo autenticador? Use um código de recuperação na etapa de verificação ou peça a um administrador da sua unidade a redefinição do MFA.
      </p>
    </div>
  );
}
