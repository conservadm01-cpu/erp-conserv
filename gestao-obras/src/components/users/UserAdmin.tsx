"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Badge, StatusBadge } from "../ui/Badge";
import { useSubmit } from "../ui/useForm";
import { generateTemporaryPassword } from "./password-generator";

type Scope = {
  id: string;
  includeDescendants: boolean;
  createdAt: string;
  canRemove: boolean;
  role: { name: string; requiresMfa: boolean };
  unit: { name: string; status: string };
  work: { id: string; code: string; title: string } | null;
  grantedBy: { name: string } | null;
};
type UnitOpt = { id: string; name: string; depth: number; held: string[] };
type RoleOpt = { id: string; name: string; requiresMfa: boolean; permissions: string[] };

export type UserAdminProps = {
  user: { id: string; name: string; email: string; status: "ATIVO" | "BLOQUEADO" | "INATIVO"; homeUnitId: string; mfaEnabled: boolean; canManage: boolean };
  scopes: Scope[];
  units: UnitOpt[];
  roles: RoleOpt[];
  works: { id: string; code: string; title: string; unitId: string }[];
};

type Dialog = null | { kind: "status"; status: "ATIVO" | "BLOQUEADO" | "INATIVO" } | { kind: "mfa" } | { kind: "scope"; scope: Scope };

export function UserAdmin({ user, scopes, units, roles, works }: UserAdminProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [profile, setProfile] = useState({ name: user.name, homeUnitId: user.homeUnitId });
  const [scopeForm, setScopeForm] = useState({ roleId: "", unitId: "", workId: "", includeDescendants: true });
  const [tempPassword, setTempPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const profileSubmit = useSubmit();
  const scopeSubmit = useSubmit();
  const pwdSubmit = useSubmit();

  const selectedUnit = units.find((u) => u.id === scopeForm.unitId);
  const grantableRoles = useMemo(
    () => (selectedUnit ? roles.filter((r) => r.permissions.every((p) => selectedUnit.held.includes(p))) : []),
    [roles, selectedUnit],
  );

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const res = await profileSubmit.run(() => api(`/api/users/${user.id}`, { method: "PATCH", body: profile }));
    if (res) { setNotice("Dados salvos."); router.refresh(); }
  }
  async function addScope(e: React.FormEvent) {
    e.preventDefault();
    const body = scopeForm.workId
      ? { roleId: scopeForm.roleId, workId: scopeForm.workId, includeDescendants: false }
      : { roleId: scopeForm.roleId, unitId: scopeForm.unitId, includeDescendants: scopeForm.includeDescendants };
    const res = await scopeSubmit.run(() => api(`/api/users/${user.id}/scopes`, { body }));
    if (res) { setScopeForm({ roleId: "", unitId: "", workId: "", includeDescendants: true }); setNotice("Acesso concedido."); router.refresh(); }
  }
  async function setPassword(e: React.FormEvent) {
    e.preventDefault();
    const res = await pwdSubmit.run(() => api(`/api/users/${user.id}/temporary-password`, { body: { temporaryPassword: tempPassword } }));
    if (res) { setNotice("Senha provisória definida. As sessões do usuário foram encerradas. Entregue a senha por canal seguro."); }
  }

  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}

      <section className="card p-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Acessos (papéis por unidade)</h2>
        {scopes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum acesso atribuído. O usuário consegue entrar, mas não visualiza dados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Papel</th><th>Unidade</th><th>Abrangência</th><th>Concedido por</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {scopes.map((s) => (
                  <tr key={s.id}>
                    <td>{s.role.name} {s.role.requiresMfa && <Badge tone="blue">exige MFA</Badge>}</td>
                    <td>{s.unit.name} {s.unit.status !== "ATIVA" && <StatusBadge status={s.unit.status} />}</td>
                    <td>{s.work ? `Somente a obra ${s.work.code}` : s.includeDescendants ? "Unidade e subordinadas" : "Somente a unidade"}</td>
                    <td>{s.grantedBy?.name ?? "—"} <span className="text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString("pt-BR")}</span></td>
                    <td className="text-right">{s.canRemove && <Button variant="ghost" onClick={() => setDialog({ kind: "scope", scope: s })}>Revogar</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {user.canManage && (
          <form onSubmit={addScope} className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-7" noValidate>
            <SelectField className="sm:col-span-3" label="Unidade" value={scopeForm.unitId} onChange={(e) => setScopeForm({ ...scopeForm, unitId: e.target.value, roleId: "", workId: "" })} error={scopeSubmit.fieldErrors.unitId}>
              <option value="">Selecione…</option>
              {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
            </SelectField>
            <SelectField className="sm:col-span-2" label="Papel" value={scopeForm.roleId} onChange={(e) => setScopeForm({ ...scopeForm, roleId: e.target.value })} disabled={!selectedUnit} error={scopeSubmit.fieldErrors.roleId} hint={selectedUnit ? "Somente papéis cujas permissões você possui nesta unidade." : undefined}>
              <option value="">Selecione…</option>
              {grantableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
            <div className="flex flex-col justify-end gap-2 sm:col-span-2">
              <SelectField label="Restringir a uma obra (opcional)" value={scopeForm.workId} onChange={(e) => setScopeForm({ ...scopeForm, workId: e.target.value })} disabled={!selectedUnit}>
                <option value="">Toda a unidade</option>
                {works.filter((w) => w.unitId === scopeForm.unitId).map((w) => <option key={w.id} value={w.id}>{w.code} — {w.title}</option>)}
              </SelectField>
              {!scopeForm.workId && <CheckboxField label="Incluir subordinadas" checked={scopeForm.includeDescendants} onChange={(e) => setScopeForm({ ...scopeForm, includeDescendants: e.target.checked })} />}
              <Button type="submit" loading={scopeSubmit.pending} disabled={!scopeForm.roleId || !scopeForm.unitId}>Conceder acesso</Button>
            </div>
            {scopeSubmit.error && <div className="sm:col-span-7"><Alert tone="error">{scopeSubmit.error}</Alert></div>}
          </form>
        )}
      </section>

      {user.canManage && (
        <>
          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Dados cadastrais</h2>
            <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
              {profileSubmit.error && <div className="sm:col-span-2"><Alert tone="error">{profileSubmit.error}</Alert></div>}
              <TextField label="Nome" required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} error={profileSubmit.fieldErrors.name} maxLength={200} />
              <SelectField label="Unidade de lotação" value={profile.homeUnitId} onChange={(e) => setProfile({ ...profile, homeUnitId: e.target.value })} error={profileSubmit.fieldErrors.homeUnitId}>
                {!units.some((u) => u.id === user.homeUnitId) && <option value={user.homeUnitId}>(lotação atual)</option>}
                {units.map((u) => <option key={u.id} value={u.id}>{"— ".repeat(u.depth)}{u.name}</option>)}
              </SelectField>
              <div className="sm:col-span-2"><Button type="submit" loading={profileSubmit.pending}>Salvar</Button></div>
            </form>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Segurança da conta</h2>
            <div className="space-y-6">
              <form onSubmit={setPassword} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
                <TextField className="flex-1" label="Nova senha provisória" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} error={pwdSubmit.fieldErrors.temporaryPassword} autoComplete="off" />
                <Button variant="secondary" onClick={() => setTempPassword(generateTemporaryPassword())}>Gerar</Button>
                <Button type="submit" loading={pwdSubmit.pending} disabled={!tempPassword}>Definir senha provisória</Button>
              </form>
              {pwdSubmit.error && <Alert tone="error">{pwdSubmit.error}</Alert>}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setDialog({ kind: "mfa" })} disabled={!user.mfaEnabled}>Redefinir MFA</Button>
                {user.status !== "ATIVO" && <Button variant="secondary" onClick={() => setDialog({ kind: "status", status: "ATIVO" })}>Reativar usuário</Button>}
                {user.status === "ATIVO" && <Button variant="danger" onClick={() => setDialog({ kind: "status", status: "BLOQUEADO" })}>Bloquear</Button>}
                {user.status !== "INATIVO" && <Button variant="danger" onClick={() => setDialog({ kind: "status", status: "INATIVO" })}>Inativar</Button>}
              </div>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        open={dialog?.kind === "status"}
        title={dialog?.kind === "status" ? { ATIVO: "Reativar usuário", BLOQUEADO: "Bloquear usuário", INATIVO: "Inativar usuário" }[dialog.status] : ""}
        description={dialog?.kind === "status" && dialog.status !== "ATIVO" ? "As sessões abertas do usuário serão encerradas imediatamente. O histórico é preservado." : "O usuário poderá voltar a entrar no sistema."}
        confirmLabel="Confirmar"
        tone={dialog?.kind === "status" && dialog.status === "ATIVO" ? "primary" : "danger"}
        reasonLabel="Justificativa"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (dialog?.kind !== "status") return;
          await api(`/api/users/${user.id}/status`, { body: { status: dialog.status, reason } });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "mfa"}
        title="Redefinir MFA"
        description="O autenticador e os códigos de recuperação do usuário serão removidos e as sessões encerradas. Confirme a identidade do solicitante por canal seguro antes de prosseguir."
        confirmLabel="Redefinir MFA"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await api(`/api/users/${user.id}/mfa-reset`, { method: "POST" });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={dialog?.kind === "scope"}
        title="Revogar acesso"
        description={dialog?.kind === "scope" ? `Revogar o papel "${dialog.scope.role.name}" em "${dialog.scope.unit.name}"? O efeito é imediato.` : ""}
        confirmLabel="Revogar"
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "scope") return;
          await api(`/api/users/${user.id}/scopes/${dialog.scope.id}`, { method: "DELETE" });
          router.refresh();
        }}
      />
    </div>
  );
}
