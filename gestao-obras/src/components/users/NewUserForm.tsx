"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";
import { PasswordHint } from "../PasswordHint";
import { generateTemporaryPassword } from "./password-generator";

export function NewUserForm({ units }: { units: { id: string; name: string; depth: number }[] }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", homeUnitId: units.length === 1 ? units[0]!.id : "", temporaryPassword: "" });
  const { pending, error, fieldErrors, run } = useSubmit();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => api<{ user: { id: string } }>("/api/users", { body: v }));
    if (res) router.push(`/usuarios/${res.user.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <TextField label="Nome" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} error={fieldErrors.name} maxLength={200} />
      <TextField label="E-mail" type="email" required value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} error={fieldErrors.email} maxLength={254} />
      <SelectField label="Unidade de lotação" required value={v.homeUnitId} onChange={(e) => setV({ ...v, homeUnitId: e.target.value })} error={fieldErrors.homeUnitId} hint="Define quem pode administrar este usuário. Os acessos são concedidos depois, na tela do usuário.">
        <option value="">Selecione…</option>
        {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
      </SelectField>
      <div className="flex items-end gap-2">
        <TextField className="flex-1" label="Senha provisória" required value={v.temporaryPassword} onChange={(e) => setV({ ...v, temporaryPassword: e.target.value })} error={fieldErrors.temporaryPassword} autoComplete="off" hint={<><PasswordHint /> O usuário deverá trocá-la no primeiro acesso. Entregue-a por canal seguro.</>} />
        <Button variant="secondary" className="mb-[1.35rem]" onClick={() => setV({ ...v, temporaryPassword: generateTemporaryPassword() })}>Gerar</Button>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>Criar usuário</Button>
        <Button variant="secondary" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}
