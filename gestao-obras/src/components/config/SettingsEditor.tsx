"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Setting = { key: string; label: string; hint: string; min: number; max: number; value: number; updatedAt: string | null };

function SettingRow({ s, canManage }: { s: Setting; canManage: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(s.value));
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    if (await run(() => api(`/api/settings/${encodeURIComponent(s.key)}`, { method: "PUT", body: { value: Number(value) } }))) { setSaved(true); router.refresh(); }
  }
  return (
    <form onSubmit={save} className="card space-y-3 p-5" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Parâmetro atualizado.</Alert>}
      <TextField label={s.label} type="number" min={s.min} max={s.max} value={value} onChange={(e) => setValue(e.target.value)} disabled={!canManage} hint={`${s.hint} (entre ${s.min} e ${s.max})`} error={fieldErrors.value} />
      {canManage && <Button type="submit" loading={pending}>Salvar</Button>}
    </form>
  );
}

export function SettingsEditor({ settings, canManage }: { settings: Setting[]; canManage: boolean }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{settings.map((s) => <SettingRow key={s.key} s={s} canManage={canManage} />)}</div>;
}
