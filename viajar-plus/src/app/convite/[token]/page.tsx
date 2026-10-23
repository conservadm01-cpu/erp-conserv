"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Loading, Notice } from "@/components/ui/states";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/trips/service";
import type { MemberRole } from "@/lib/types";

interface Preview {
  trip_name: string;
  destination: string;
  role: MemberRole;
  invite_status: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "login" | "ready" | "invalid" | "local">("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return setState("local");
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setState("login");
      const { data: rows, error } = await sb.rpc("trip_invite_preview", { p_token: token });
      const row = (rows as Preview[] | null)?.[0];
      if (error || !row || row.invite_status !== "convidado") return setState("invalid");
      setPreview(row);
      setState("ready");
    });
  }, [token]);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept", token }) });
    const json = (await res.json().catch(() => ({}))) as { trip_id?: string; error?: string };
    setBusy(false);
    if (!res.ok || !json.trip_id) return setError(json.error ?? "Não foi possível aceitar o convite.");
    try {
      localStorage.setItem("viajar:trip", json.trip_id);
    } catch {
      /* ignore */
    }
    router.push("/");
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-xl">
        <Users className="mx-auto mb-3 h-10 w-10 text-accent" aria-hidden />
        <h1 className="mb-2 font-display text-2xl font-bold">Convite para viagem</h1>
        {state === "loading" && <Loading rows={1} />}
        {state === "local" && <Notice>Convites por link funcionam somente com o Supabase configurado.</Notice>}
        {state === "invalid" && <Notice tone="error">Este convite é inválido, expirou ou já foi utilizado.</Notice>}
        {state === "login" && (
          <div className="space-y-3">
            <p className="text-muted">Entre ou crie sua conta para aceitar o convite.</p>
            <LinkButton href={`/login?next=${encodeURIComponent(`/convite/${token}`)}`}>Entrar para aceitar</LinkButton>
          </div>
        )}
        {state === "ready" && preview && (
          <div className="space-y-4">
            <p>
              Você foi convidado para <strong>{preview.trip_name}</strong>
              {preview.destination && <> ({preview.destination})</>} como <strong>{ROLE_LABEL[preview.role] ?? preview.role}</strong>.
            </p>
            {error && <Notice tone="error">{error}</Notice>}
            <Button onClick={accept} loading={busy}>Aceitar convite</Button>
          </div>
        )}
      </div>
    </div>
  );
}
