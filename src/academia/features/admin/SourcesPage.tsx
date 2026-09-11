import { useState } from "react";
import type { LibrarySource } from "../../core/types";
import { catalogRepo, auditRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../state/ToastContext";
import { uid } from "../../core/ids";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Modal } from "../../ui/primitives/Modal";
import { Field, Select, TextArea, TextInput } from "../../ui/primitives/Field";
import { Callout } from "../../ui/primitives/Feedback";
import { formatDate } from "../../core/dates";

const TYPES: Array<LibrarySource["type"]> = ["legislacao", "norma", "manual", "instituicao", "fabricante", "interno", "artigo"];
const RELIABILITY: Array<LibrarySource["reliability"]> = ["oficial", "tecnica", "fabricante", "interna", "referencia"];

export function SourcesPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const sources = useQuery(() => catalogRepo.sources());
  const [editing, setEditing] = useState<LibrarySource | null>(null);

  const empty: LibrarySource = {
    id: "",
    name: "",
    institution: "",
    type: "manual",
    reliability: "tecnica",
    subjects: [],
  };

  const save = (source: LibrarySource) => {
    if (!employee) return;
    const record = { ...source, id: source.id || uid("SRCLIB") };
    catalogRepo.saveSource(record);
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: source.id ? "source.update" : "source.create", entity: "content_sources", entityId: record.id, detail: record.name });
    setEditing(null);
    toast.success("Fonte salva", record.name);
  };

  return (
    <div>
      <PageHeader
        title="Biblioteca de fontes"
        subtitle="Rastreabilidade do conteúdo técnico. Prioridade para fontes oficiais do Ministério do Trabalho e Emprego, SENAI, ABIT, fabricantes e normas."
        icon="scroll"
        action={<Button icon="plus" onClick={() => setEditing(empty)}>Nova fonte</Button>}
      />

      <Callout tone="info" title="Por que isso existe">
        Toda informação técnica da Academia carrega um SOURCE_ID apontando para o material de origem, e o material
        aponta para a fonte externa. É isso que permite responder “de onde veio essa informação?”.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-2 mt-4">
        {sources.map((source) => (
          <Card key={source.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-[14.5px] leading-snug">{source.name}</h3>
              <Chip tone={source.reliability === "oficial" ? "jade" : source.reliability === "interna" ? "sand" : "navy"}>
                {source.reliability}
              </Chip>
            </div>
            <p className="text-[13px] text-ink-600 mt-1">{source.institution} · {source.type}</p>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-block py-1 text-[12px] text-navy underline break-all mt-1">{source.url}</a>
            )}
            {source.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {source.subjects.slice(0, 5).map((subject) => <Chip key={subject} tone="neutral">{subject}</Chip>)}
              </div>
            )}
            {source.notes && <p className="text-[12.5px] text-ink-600 mt-2 leading-snug">{source.notes}</p>}
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" variant="secondary" icon="pen-tool" onClick={() => setEditing(source)}>Editar</Button>
              {source.accessedAt && <span className="text-[11.5px] text-ink-400">acesso em {formatDate(source.accessedAt)}</span>}
            </div>
          </Card>
        ))}
      </div>

      {editing && <SourceModal source={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function SourceModal({ source, onClose, onSave }: { source: LibrarySource; onClose: () => void; onSave: (s: LibrarySource) => void }) {
  const [form, setForm] = useState({ ...source, subjectsText: source.subjects.join(", ") });
  return (
    <Modal
      open
      onClose={onClose}
      title={source.id ? "Editar fonte" : "Nova fonte"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            icon="save"
            disabled={form.name.trim().length < 3 || form.institution.trim().length < 2}
            onClick={() => onSave({ ...form, subjects: form.subjectsText.split(",").map((s) => s.trim()).filter(Boolean) })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instituição" required><TextInput value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} /></Field>
          <Field label="URL"><TextInput value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LibrarySource["type"] })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Confiabilidade">
            <Select value={form.reliability} onChange={(e) => setForm({ ...form, reliability: e.target.value as LibrarySource["reliability"] })}>
              {RELIABILITY.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Data de acesso">
            <TextInput type="date" value={form.accessedAt?.slice(0, 10) ?? ""} onChange={(e) => setForm({ ...form, accessedAt: e.target.value })} />
          </Field>
          <Field label="Assuntos" hint="Separados por vírgula">
            <TextInput value={form.subjectsText} onChange={(e) => setForm({ ...form, subjectsText: e.target.value })} />
          </Field>
        </div>
        <Field label="Observações"><TextArea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
