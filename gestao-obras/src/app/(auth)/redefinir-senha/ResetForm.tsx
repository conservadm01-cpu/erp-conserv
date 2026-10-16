"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useSubmit } from "@/components/ui/useForm";
import { PasswordHint } from "@/components/PasswordHint";

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, fieldErrors, run, setError } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("As senhas não coincidem.");
    const res = await run(() => api("/api/auth/password/reset", { body: { token, password } }));
    if (res) setDone(true);
  }

  if (!token) return <Alert tone="error">Link inválido. Solicite uma nova redefinição de senha.</Alert>;
  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">Senha redefinida. Todas as sessões anteriores foram encerradas.</Alert>
        <Link href="/login" className="block text-center text-sm text-brand-700 hover:underline">Ir para o login</Link>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Definir nova senha</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Nova senha" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} hint={<PasswordHint />} />
      <TextField label="Confirme a nova senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" className="w-full" loading={pending}>Redefinir senha</Button>
    </form>
  );
}
