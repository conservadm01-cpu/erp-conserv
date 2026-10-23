"use client";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("A senha precisa de pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError("Não foi possível alterar a senha. O link pode ter expirado; solicite outro.");
    setDone(true);
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl">
        <h1 className="mb-4 font-display text-2xl font-bold">Criar nova senha</h1>
        {!isSupabaseConfigured() ? (
          <Notice>Recuperação de senha disponível apenas com o Supabase configurado.</Notice>
        ) : done ? (
          <div className="space-y-4">
            <Notice tone="success">Senha alterada com sucesso.</Notice>
            <LinkButton href="/">Ir para o painel</LinkButton>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Nova senha">{(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            <Field label="Repita a nova senha">{(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" loading={busy}>Salvar senha</Button>
          </form>
        )}
      </div>
    </div>
  );
}
