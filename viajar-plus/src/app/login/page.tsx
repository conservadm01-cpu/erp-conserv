"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Plane } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/client";

const emailSchema = z.email("E-mail inválido");
const passwordSchema = z.string().min(8, "A senha precisa de pelo menos 8 caracteres");

function nextPath(): string {
  if (typeof window === "undefined") return "/";
  const n = new URLSearchParams(window.location.search).get("next") ?? "/";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

export default function LoginPage() {
  const configured = isSupabaseConfigured();
  const [linkError, setLinkError] = useState(false);
  useEffect(() => setLinkError(new URLSearchParams(window.location.search).get("erro") === "link"), []);

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-glacier-50 via-bg to-orange-50 px-4 py-10 dark:from-glacier-900/40 dark:via-bg dark:to-bg">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-glacier-500 to-glacier-900 text-white">
            <Plane className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">
              VIAJAR<span className="text-sunset-500">+</span>
            </h1>
            <p className="text-sm text-muted">Seu guia, orçamento e diário de viagem</p>
          </div>
        </div>
        {linkError && (
          <Notice tone="error" className="mb-4">
            O link usado é inválido ou expirou. Solicite um novo.
          </Notice>
        )}
        {!configured ? (
          <div className="space-y-4">
            <Notice tone="info" title="Modo demonstração local">
              O login fica disponível quando o Supabase é configurado (veja docs/SUPABASE.md). Enquanto isso, seus dados ficam apenas neste navegador.
            </Notice>
            <LinkButton href="/" className="w-full justify-center">
              Entrar no modo demonstração
            </LinkButton>
          </div>
        ) : (
          <Tabs
            tabs={[
              { value: "entrar", label: "Entrar", content: <SignIn /> },
              { value: "criar", label: "Criar conta", content: <SignUp /> },
              { value: "recuperar", label: "Esqueci a senha", content: <Recover /> },
            ]}
          />
        )}
        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/privacidade" className="underline">Aviso de privacidade</Link> · <Link href="/termos" className="underline">Termos de uso</Link>
        </p>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailSchema.safeParse(email).success) return setError("Informe um e-mail válido.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    // mensagem genérica: não revela se o e-mail existe
    if (error) return setError("E-mail ou senha incorretos, ou e-mail ainda não confirmado.");
    window.location.assign(nextPath());
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="E-mail">{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
      <Field label="Senha">{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="submit" loading={busy} className="w-full justify-center">Entrar</Button>
    </form>
  );
}

function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = "Informe seu nome";
    if (!emailSchema.safeParse(email).success) errs.email = "E-mail inválido";
    const pw = passwordSchema.safeParse(password);
    if (!pw.success) errs.password = pw.error.issues[0].message;
    if (!accept) errs.accept = "É preciso aceitar os termos e o aviso de privacidade";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        data: { display_name: name.trim(), accepted_terms: "true" },
      },
    });
    setBusy(false);
    if (error) return setErrors({ form: "Não foi possível criar a conta. Verifique os dados ou tente outro e-mail." });
    setDone(true);
  }
  if (done) return <Notice tone="success" title="Confira seu e-mail">Enviamos um link de confirmação. Depois de confirmar, entre com seu e-mail e senha.</Notice>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Nome" error={errors.name}>{(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
      <Field label="E-mail" error={errors.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres.">
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
      </Field>
      <div>
        <Checkbox
          checked={accept}
          onChange={(e) => setAccept(e.target.checked)}
          label={
            <>
              Li e aceito os <Link href="/termos" className="underline">termos de uso</Link> e o <Link href="/privacidade" className="underline">aviso de privacidade</Link>.
            </>
          }
        />
        {errors.accept && <p role="alert" className="mt-1 text-xs text-red-600">{errors.accept}</p>}
      </div>
      {errors.form && <Notice tone="error">{errors.form}</Notice>}
      <Button type="submit" loading={busy} className="w-full justify-center">Criar conta</Button>
    </form>
  );
}

function Recover() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailSchema.safeParse(email).success) return setError("Informe um e-mail válido.");
    setBusy(true);
    await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/redefinir` });
    setBusy(false);
    setSent(true); // mesma resposta exista ou não a conta
  }
  if (sent) return <Notice tone="success">Se houver uma conta com esse e-mail, você receberá um link para criar uma nova senha.</Notice>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="E-mail da conta" error={error ?? undefined}>{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Button type="submit" loading={busy} className="w-full justify-center">Enviar link de recuperação</Button>
    </form>
  );
}
