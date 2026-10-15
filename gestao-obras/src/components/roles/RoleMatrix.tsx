"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useSubmit } from "../ui/useForm";

type Role = { id: string; code: string; name: string; description: string | null; requiresMfa: boolean; isSystem: boolean; permissions: string[]; _count: { scopes: number } };
type Perm = { code: string; module: string; description: string };

export function RoleMatrix({ roles, catalog, canManage, held }: { roles: Role[]; catalog: Perm[]; canManage: boolean; held: string[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const selected = roles.find((r) => r.id === selectedId);
  const [draft, setDraft] = useState<{ perms: Set<string>; requiresMfa: boolean } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({ code: "", name: "", description: "", requiresMfa: true });
  const create = useSubmit();

  const modules = [...new Set(catalog.map((p) => p.module))];
  const current = draft ?? (selected ? { perms: new Set(selected.permissions), requiresMfa: selected.requiresMfa } : null);
  const dirty = Boolean(draft);

  function select(id: string) {
    setSelectedId(id);
    setDraft(null);
    setNotice(null);
  }
  function toggle(code: string) {
    if (!current) return;
    const perms = new Set(current.perms);
    if (perms.has(code)) perms.delete(code);
    else perms.add(code);
    setDraft({ perms, requiresMfa: current.requiresMfa });
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    const res = await create.run(() => api<{ role: { id: string } }>("/api/roles", { body: { ...newRole, permissions: [] } }));
    if (res) {
      setNewRole({ code: "", name: "", description: "", requiresMfa: true });
      setNotice("Papel criado. Selecione-o para definir as permissões.");
      router.refresh();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <aside className="card p-3 lg:col-span-1">
        <h2 className="px-2 pb-2 text-sm font-semibold text-slate-700">Papéis</h2>
        <ul className="space-y-1">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => select(r.id)}
                aria-current={r.id === selectedId ? "true" : undefined}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${r.id === selectedId ? "bg-brand-50 font-medium text-brand-900" : "hover:bg-slate-50"}`}
              >
                {r.name}
                <span className="block text-xs text-slate-500">{r._count.scopes} atribuição(ões){r.isSystem ? " · sistema" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
        {canManage && (
          <form onSubmit={createRole} className="mt-4 space-y-3 border-t border-slate-100 p-2 pt-4" noValidate>
            <h3 className="text-sm font-semibold text-slate-700">Novo papel</h3>
            {create.error && <Alert tone="error">{create.error}</Alert>}
            <TextField label="Código" value={newRole.code} onChange={(e) => setNewRole({ ...newRole, code: e.target.value })} error={create.fieldErrors.code} maxLength={60} placeholder="EX: TECNICO_SEGURANCA" />
            <TextField label="Nome" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} error={create.fieldErrors.name} maxLength={120} />
            <TextField label="Descrição" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} maxLength={500} />
            <CheckboxField label="Exigir MFA" checked={newRole.requiresMfa} onChange={(e) => setNewRole({ ...newRole, requiresMfa: e.target.checked })} />
            <Button type="submit" loading={create.pending} disabled={!newRole.code || !newRole.name}>Criar papel</Button>
          </form>
        )}
      </aside>

      <section className="card p-6 lg:col-span-2">
        {!selected || !current ? (
          <p className="text-sm text-slate-500">Selecione um papel.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{selected.name} {selected.isSystem && <Badge tone="blue">papel de sistema</Badge>}</h2>
              <p className="font-mono text-xs text-slate-500">{selected.code}</p>
              {selected.description && <p className="mt-1 text-sm text-slate-600">{selected.description}</p>}
            </div>
            {notice && <Alert tone="success">{notice}</Alert>}
            <CheckboxField
              label="Exigir verificação em duas etapas (MFA) para quem tiver este papel"
              checked={current.requiresMfa}
              disabled={!canManage || selected.isSystem}
              onChange={(e) => setDraft({ perms: new Set(current.perms), requiresMfa: e.target.checked })}
            />
            {modules.map((m) => (
              <fieldset key={m}>
                <legend className="mb-2 text-sm font-semibold text-slate-700">{m}</legend>
                <div className="space-y-2">
                  {catalog.filter((p) => p.module === m).map((p) => (
                    <CheckboxField
                      key={p.code}
                      label={`${p.description} (${p.code})`}
                      checked={current.perms.has(p.code)}
                      disabled={!canManage || selected.isSystem || !held.includes(p.code)}
                      onChange={() => toggle(p.code)}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
            {selected.isSystem && <p className="text-xs text-slate-500">Papéis de sistema mantêm todas as permissões e exigem MFA.</p>}
            {canManage && !selected.isSystem && (
              <div className="flex gap-2">
                <Button onClick={() => setConfirm(true)} disabled={!dirty}>Salvar permissões</Button>
                <Button variant="secondary" onClick={() => setDraft(null)} disabled={!dirty}>Descartar</Button>
              </div>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirm}
        title="Alterar permissões do papel"
        description={selected ? `A alteração vale imediatamente para as ${selected._count.scopes} atribuição(ões) deste papel em todo o sistema.` : ""}
        confirmLabel="Salvar"
        tone="primary"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          if (!selected || !draft) return;
          await api(`/api/roles/${selected.id}`, { method: "PATCH", body: { permissions: [...draft.perms], requiresMfa: draft.requiresMfa } });
          setDraft(null);
          setNotice("Permissões atualizadas.");
          router.refresh();
        }}
      />
    </div>
  );
}
