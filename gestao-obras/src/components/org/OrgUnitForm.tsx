"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Contact = { name: string; role: string; email: string; phone: string };
export type UnitOption = { id: string; name: string; code: string; typeCode: string; depth: number };
export type TypeOption = { code: string; name: string; isRoot: boolean; allowedParentCodes: string[] };

export type OrgUnitFormValues = {
  code: string; name: string; typeCode: string; parentId: string;
  street: string; number: string; complement: string; district: string; city: string; state: string; postalCode: string;
  contacts: Contact[];
};

const UF = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const emptyContact: Contact = { name: "", role: "", email: "", phone: "" };

export function OrgUnitForm({
  mode, unitId, initial, parents, types,
}: {
  mode: "create" | "edit";
  unitId?: string;
  initial: OrgUnitFormValues;
  parents: UnitOption[];
  types: TypeOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  const set = (k: keyof OrgUnitFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const isRoot = mode === "edit" && !initial.parentId;
  const parent = parents.find((p) => p.id === v.parentId);
  const allowedTypes = useMemo(() => types.filter((t) => !t.isRoot && (!parent || t.allowedParentCodes.includes(parent.typeCode))), [types, parent]);

  function setContact(i: number, k: keyof Contact, value: string) {
    setV({ ...v, contacts: v.contacts.map((c, j) => (j === i ? { ...c, [k]: value } : c)) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    const { code, typeCode, ...rest } = v;
    const { parentId, ...fields } = rest;
    const payload = { ...fields, ...(parentId ? { parentId } : {}), contacts: v.contacts.filter((c) => c.name.trim()) };
    const res = await run(() =>
      mode === "create"
        ? api<{ unit: { id: string } }>("/api/org-units", { body: { code, typeCode, ...payload } })
        : api<{ unit: { id: string } }>(`/api/org-units/${unitId}`, { method: "PATCH", body: payload }),
    );
    if (!res) return;
    if (mode === "create") router.push(`/organizacao/${res.unit.id}`);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Alterações salvas.</Alert>}
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Identificação</legend>
        <TextField label="Nome" required value={v.name} onChange={set("name")} error={fieldErrors.name} maxLength={200} />
        <TextField label="Código" required value={v.code} onChange={set("code")} error={fieldErrors.code} disabled={mode === "edit"} maxLength={40} hint={mode === "create" ? "Letras, números e hífen. Não pode ser alterado depois." : undefined} />
        {!isRoot && <SelectField label="Unidade superior" required value={v.parentId} onChange={(e) => setV({ ...v, parentId: e.target.value, typeCode: mode === "create" ? "" : v.typeCode })} error={fieldErrors.parentId}>
          <option value="">Selecione…</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{"— ".repeat(p.depth)}{p.name} ({p.code})</option>
          ))}
        </SelectField>}
        <SelectField label="Tipo" required value={v.typeCode} onChange={set("typeCode")} error={fieldErrors.typeCode} disabled={mode === "edit" || !v.parentId}>
          <option value="">Selecione…</option>
          {(mode === "edit" ? types : allowedTypes).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
        </SelectField>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Endereço</legend>
        <TextField className="sm:col-span-4" label="Logradouro" value={v.street} onChange={set("street")} error={fieldErrors.street} maxLength={200} />
        <TextField className="sm:col-span-2" label="Número" value={v.number} onChange={set("number")} error={fieldErrors.number} maxLength={20} />
        <TextField className="sm:col-span-2" label="Complemento" value={v.complement} onChange={set("complement")} maxLength={100} />
        <TextField className="sm:col-span-2" label="Bairro" value={v.district} onChange={set("district")} maxLength={120} />
        <TextField className="sm:col-span-2" label="CEP" value={v.postalCode} onChange={set("postalCode")} error={fieldErrors.postalCode} inputMode="numeric" maxLength={9} placeholder="00000-000" />
        <TextField className="sm:col-span-4" label="Cidade" value={v.city} onChange={set("city")} maxLength={120} />
        <SelectField className="sm:col-span-2" label="UF" value={v.state} onChange={set("state")} error={fieldErrors.state}>
          <option value="">—</option>
          {UF.map((u) => <option key={u} value={u}>{u}</option>)}
        </SelectField>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Contatos autorizados</legend>
        <p className="text-xs text-slate-500">Registre apenas os dados de contato estritamente necessários e autorizados pelos titulares.</p>
        {v.contacts.map((c, i) => (
          <div key={i} className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-9">
            <TextField className="sm:col-span-3" label="Nome" value={c.name} onChange={(e) => setContact(i, "name", e.target.value)} maxLength={200} />
            <TextField className="sm:col-span-2" label="Função" value={c.role} onChange={(e) => setContact(i, "role", e.target.value)} maxLength={120} />
            <TextField className="sm:col-span-2" label="E-mail" type="email" value={c.email} onChange={(e) => setContact(i, "email", e.target.value)} maxLength={254} />
            <TextField className="sm:col-span-1" label="Telefone" value={c.phone} onChange={(e) => setContact(i, "phone", e.target.value)} maxLength={30} />
            <div className="flex items-end sm:col-span-1">
              <Button variant="ghost" onClick={() => setV({ ...v, contacts: v.contacts.filter((_, j) => j !== i) })} aria-label={`Remover contato ${i + 1}`}>Remover</Button>
            </div>
          </div>
        ))}
        {v.contacts.length < 20 && (
          <Button variant="secondary" onClick={() => setV({ ...v, contacts: [...v.contacts, emptyContact] })}>Adicionar contato</Button>
        )}
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>{mode === "create" ? "Criar unidade" : "Salvar alterações"}</Button>
        <Button variant="secondary" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
      </div>
    </form>
  );
}
