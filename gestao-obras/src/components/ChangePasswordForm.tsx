"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/Button";
import { TextField } from "./ui/Field";
import { Alert } from "./ui/Alert";
import { useSubmit } from "./ui/useForm";
import { PasswordHint } from "./PasswordHint";

export function ChangePasswordForm({ redirectTo }: { redirectTo?: string }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const { pending, error, fieldErrors, run, setError } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) return setError("As senhas não coincidem.");
    const res = await run(() => api("/api/auth/password/change", { body: { currentPassword, newPassword } }));
    if (!res) return;
    if (redirectTo) window.location.assign(redirectTo);
    else {
      setDone(true);
      setCurrent("");
      setNew("");
      setConfirm("");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {done && <Alert tone="success">Senha alterada. As demais sessões abertas foram encerradas.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Senha atual" type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrent(e.target.value)} error={fieldErrors.currentPassword} />
      <TextField label="Nova senha" type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNew(e.target.value)} error={fieldErrors.newPassword} hint={<PasswordHint />} />
      <TextField label="Confirme a nova senha" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <Button type="submit" loading={pending}>Alterar senha</Button>
    </form>
  );
}
