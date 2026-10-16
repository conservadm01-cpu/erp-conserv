"use client";

import { useState } from "react";
import { ApiError, downloadFile } from "@/lib/api";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";

type Report = { type: string; title: string; scope: "obra" | "geral" };

function ReportCard({ r, works, units }: { r: Report; works: { id: string; label: string }[]; units: { id: string; name: string }[] }) {
  const [v, setV] = useState({ workId: "", unitId: "", from: "", to: "", action: "" });
  const [done, setDone] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val) p.set(k, val);
    const path = r.type === "dossie" ? `/api/works/${v.workId}/reports/dossie` : `/api/reports/${r.type}?${p}`;
    if (r.scope === "obra" && !v.workId) return void run(() => Promise.reject(new ApiError(422, "VALIDACAO", "Selecione a obra.", { workId: ["Obra obrigatória."] })));
    if (await run(() => downloadFile(path, `${r.type}.pdf`).then(() => true))) setDone(true);
  }
  const id = `rel-${r.type}`;
  return (
    <form onSubmit={generate} className="card space-y-3 p-5" aria-labelledby={id} noValidate>
      <h3 id={id} className="font-semibold">{r.title}</h3>
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">Relatório gerado.</Alert>}
      {r.scope === "obra" ? (
        <SelectField label="Obra" value={v.workId} onChange={(e) => setV({ ...v, workId: e.target.value })} error={fieldErrors.workId} required>
          <option value="">Selecione…</option>
          {works.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
        </SelectField>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {units.length > 0 && r.type !== "auditoria" && (
            <SelectField label="Unidade (opcional)" value={v.unitId} onChange={(e) => setV({ ...v, unitId: e.target.value })} className="sm:col-span-2">
              <option value="">Todo o meu escopo</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </SelectField>
          )}
          {r.type === "auditoria" && (
            <>
              <TextField label="De" type="date" value={v.from} onChange={(e) => setV({ ...v, from: e.target.value })} />
              <TextField label="Até" type="date" value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} />
              <TextField label="Ação (opcional)" value={v.action} onChange={(e) => setV({ ...v, action: e.target.value })} placeholder="ex.: obra.criada" className="sm:col-span-2" />
            </>
          )}
        </div>
      )}
      <Button type="submit" loading={pending}>Gerar PDF</Button>
    </form>
  );
}

export function ReportCatalog({ reports, works, units }: { reports: Report[]; works: { id: string; label: string }[]; units: { id: string; name: string }[] }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{reports.map((r) => <ReportCard key={r.type} r={r} works={works} units={units} />)}</div>;
}
