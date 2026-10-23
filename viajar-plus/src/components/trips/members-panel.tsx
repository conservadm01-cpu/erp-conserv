"use client";
import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { getRepo, dataMode } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { ROLE_LABEL, ROLE_PERMISSIONS } from "@/lib/trips/service";
import type { MemberPermissions, MemberRole, Trip, TripMember } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const PERM_LABEL: Record<keyof MemberPermissions, string> = {
  edit_trip: "Editar viagem",
  budget: "Orçamento",
  reservations: "Reservas",
  diary: "Diário",
  media: "Fotos e vídeos",
};

function randomToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convite de familiares com papéis e permissões configuráveis. */
export function MembersPanel({ trip }: { trip: Trip }) {
  const { data: members } = useRows("trip_members", { trip_id: trip.id });
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("colaborador");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Informe um e-mail válido", "error");
    setBusy(true);
    try {
      if (dataMode() === "supabase") {
        const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ trip_id: trip.id, email, name, role, permissions: ROLE_PERMISSIONS[role] }) });
        const json = (await res.json()) as { link?: string; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Falha ao convidar");
        setLastLink(json.link ?? null);
      } else {
        const token = randomToken();
        await getRepo().insert("trip_members", { trip_id: trip.id, user_id: null, name: name || email, email, role, permissions: ROLE_PERMISSIONS[role], invite_status: "convidado", invite_token: token });
        setLastLink(`${location.origin}/convite/${token}`);
      }
      setEmail("");
      setName("");
      toast("Convite criado");
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const update = (m: TripMember, patch: Partial<TripMember>) => getRepo().update("trip_members", m.id, patch).catch((e) => toast(String(e), "error"));

  return (
    <div className="space-y-4">
      {dataMode() === "local" && (
        <Notice tone="warn" title="Convites no modo demonstração">
          Sem Supabase configurado, não há contas nem envio de e-mail: o convite gera um link apenas para ilustrar o fluxo. Com Supabase, o convidado entra com a própria conta e as permissões são aplicadas pelo banco (RLS).
        </Notice>
      )}
      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{m.name || m.email}</strong>
              {m.email && <span className="text-sm text-muted">{m.email}</span>}
              <Badge tone={m.invite_status === "aceito" ? "green" : m.invite_status === "recusado" ? "red" : "amber"}>{m.invite_status}</Badge>
              <div className="ml-auto flex items-center gap-2">
                {m.role === "proprietario" ? (
                  <Badge tone="violet">Proprietário</Badge>
                ) : (
                  <>
                    <Select aria-label="Papel" className="h-8 w-auto" value={m.role} onChange={(e) => { const r = e.target.value as MemberRole; update(m, { role: r, permissions: ROLE_PERMISSIONS[r] }); }}>
                      {(Object.keys(ROLE_LABEL) as MemberRole[]).filter((r) => r !== "proprietario").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </Select>
                    <Button variant="ghost" size="icon" aria-label="Remover participante" onClick={() => confirm("Remover acesso deste participante?") && getRepo().remove("trip_members", m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {m.role !== "proprietario" && (
              <div className="mt-2 flex flex-wrap gap-4">
                {(Object.keys(PERM_LABEL) as (keyof MemberPermissions)[]).map((k) => (
                  <Checkbox key={k} label={PERM_LABEL[k]} checked={Boolean(m.permissions?.[k])} onChange={(e) => update(m, { permissions: { ...m.permissions, [k]: e.target.checked } })} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={invite} className="grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-[1fr_1fr_200px_auto]">
        <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do convidado" />
        <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail do convidado" required />
        <Select value={role} onChange={(e) => setRole(e.target.value as MemberRole)} aria-label="Papel do convidado">
          {(Object.keys(ROLE_LABEL) as MemberRole[]).filter((r) => r !== "proprietario").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </Select>
        <Button type="submit" loading={busy}>Convidar</Button>
      </form>
      {lastLink && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 p-2 text-sm">
          <code className="min-w-0 flex-1 truncate">{lastLink}</code>
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(lastLink).then(() => toast("Link copiado"))}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
        </div>
      )}
    </div>
  );
}
