"use client";

import Link from "next/link";
import { useState } from "react";
import { api, safeNext, STATE_ROUTES } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { useSubmit } from "@/components/ui/useForm";

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { pending, error, fieldErrors, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api<{ state: string }>("/api/auth/login", { body: { email, password } }));
    if (!res) return;
    const target = res.state === "OK" ? safeNext(next) : STATE_ROUTES[res.state] ?? "/";
    window.location.assign(target);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-lg font-semibold">Entrar</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
      <TextField label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={fieldErrors.password} />
      <Button type="submit" className="w-full" loading={pending}>Entrar</Button>
      <p className="text-center text-sm">
        <Link href="/recuperar-acesso" className="text-brand-700 hover:underline">Esqueci minha senha</Link>
      </p>
    </form>
  );
}
