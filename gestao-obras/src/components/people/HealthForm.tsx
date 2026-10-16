"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUpload } from "@/lib/api";
import { Button } from "../ui/Button";
import { CheckboxField, SelectField, TextField } from "../ui/Field";
import { Alert } from "../ui/Alert";
import { useSubmit } from "../ui/useForm";
import { HEALTH_EXAM } from "../phase3/labels";

/**
 * Registro de ASO: somente tipo do exame, conclusão (apto/inapto), atividades liberadas e
 * validade. Não há campo para diagnóstico, exames ou observações clínicas, por desenho.
 */
export function HealthForm({ action, activities, allowChecked, fileRequired }: { action: string; activities: { code: string; name: string }[]; allowChecked: boolean; fileRequired: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ examType: "PERIODICO", result: "APTO", examDate: "", expiryDate: "", checked: false });
  const [fitFor, setFitFor] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);
  const { pending, error, fieldErrors, run } = useSubmit();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    const form = new FormData();
    form.set("examType", v.examType);
    form.set("result", v.result);
    form.set("examDate", v.examDate);
    form.set("expiryDate", v.expiryDate);
    form.set("fitFor", v.result === "APTO" ? fitFor.join(",") : "");
    if (allowChecked) form.set("checked", String(v.checked));
    if (file) form.set("file", file);
    if (await run(() => apiUpload(action, form))) {
      setDone(true);
      setFitFor([]);
      setFile(null);
      router.refresh();
    }
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate>
      {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
      {done && <div className="sm:col-span-2"><Alert tone="success">ASO registrado{allowChecked && v.checked ? "." : ". Ele aguarda conferência."}</Alert></div>}
      <SelectField label="Tipo de exame" value={v.examType} onChange={(e) => setV({ ...v, examType: e.target.value })} error={fieldErrors.examType}>
        {Object.entries(HEALTH_EXAM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </SelectField>
      <SelectField label="Conclusão" value={v.result} onChange={(e) => setV({ ...v, result: e.target.value })} error={fieldErrors.result}>
        <option value="APTO">Apto</option>
        <option value="INAPTO">Inapto</option>
      </SelectField>
      <TextField label="Data do exame" type="date" required value={v.examDate} onChange={(e) => setV({ ...v, examDate: e.target.value })} error={fieldErrors.examDate} />
      <TextField label="Válido até" type="date" value={v.expiryDate} onChange={(e) => setV({ ...v, expiryDate: e.target.value })} error={fieldErrors.expiryDate} hint="Conforme indicado no documento." />
      {v.result === "APTO" && (
        <fieldset className="sm:col-span-2">
          <legend className="label">Atividades para as quais foi declarado apto</legend>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {activities.map((a) => (
              <CheckboxField key={a.code} label={a.name} checked={fitFor.includes(a.code)} onChange={(e) => setFitFor(e.target.checked ? [...fitFor, a.code] : fitFor.filter((x) => x !== a.code))} />
            ))}
          </div>
          {fieldErrors.fitFor && <p className="mt-1 text-xs text-red-700">{fieldErrors.fitFor.join(" ")}</p>}
        </fieldset>
      )}
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`aso-file-${action}`}>Arquivo do ASO (PDF ou imagem){fileRequired ? "" : " — opcional"}</label>
        <input id={`aso-file-${action}`} type="file" accept="application/pdf,image/png,image/jpeg" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {fieldErrors.file && <p className="mt-1 text-xs text-red-700">{fieldErrors.file.join(" ")}</p>}
      </div>
      {allowChecked && <div className="sm:col-span-2"><CheckboxField label="Conferi o documento original" checked={v.checked} onChange={(e) => setV({ ...v, checked: e.target.checked })} /></div>}
      <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={fileRequired && !file}>Registrar ASO</Button></div>
    </form>
  );
}
