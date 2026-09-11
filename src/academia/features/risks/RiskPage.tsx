import { useState } from "react";
import type { RiskPriority, RiskReport } from "../../core/types";
import { riskEngine } from "../../engines/risk/RiskEngine";
import { peopleRepo, riskRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../state/ToastContext";
import { formatDateTime } from "../../core/dates";
import { compressImage } from "../../core/images";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Field, Select, TextArea, TextInput, Toggle } from "../../ui/primitives/Field";
import { CharacterSpeech } from "../../ui/characters/Character";
import { EmptyState } from "../../ui/primitives/Feedback";
import { cn } from "../../core/cn";

const CATEGORIES = [
  "Máquina / proteção",
  "Queda / obstrução",
  "Elétrico",
  "Produto químico",
  "Ergonomia",
  "Movimentação de carga",
  "Incêndio / emergência",
  "Organização / 5S",
  "Comportamento / conduta",
  "Outro",
];

const PRIORITIES: Array<{ value: RiskPriority; label: string; hint: string }> = [
  { value: "baixa", label: "Baixa", hint: "Incomoda, mas não machuca agora" },
  { value: "media", label: "Média", hint: "Pode causar lesão leve" },
  { value: "alta", label: "Alta", hint: "Pode causar lesão grave" },
  { value: "critica", label: "Crítica", hint: "Risco iminente — avise a liderança agora" },
];

export function RiskReportPage() {
  const { employee, role } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    sector: "",
    place: "",
    category: CATEGORIES[0],
    description: "",
    priority: "media" as RiskPriority,
    anonymous: false,
  });
  const [photo, setPhoto] = useState<string>();
  const [sent, setSent] = useState<RiskReport | null>(null);

  const mine = useQuery(() => (employee ? riskRepo.ofEmployee(employee.id) : []), [employee?.id, sent?.id]);
  const sectors = useQuery(() => peopleRepo.departments().map((d) => d.name));

  const defaultSector = employee ? peopleRepo.departmentName(employee.departmentId) : "";

  const submit = () => {
    if (!employee) return;
    const input = {
      sector: form.sector || defaultSector,
      place: form.place,
      category: form.category,
      description: form.description,
      priority: form.priority,
      anonymous: form.anonymous,
      photoRef: photo,
    };
    const erro = riskEngine.validate(input);
    if (erro) {
      toast.error(erro);
      return;
    }
    const { report, xpEarned, newBadges } = riskEngine.report(input, employee);
    toast.xp(xpEarned, "Obrigado por avisar!");
    toast.badges(newBadges);
    setSent(report);
    setForm({ sector: "", place: "", category: CATEGORIES[0], description: "", priority: "media", anonymous: false });
    setPhoto(undefined);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Eu vi um risco"
        subtitle="Avisar é dever de todos — e direito seu. Quase acidente também conta."
        icon="siren"
      />

      <div className="mb-5">
        <CharacterSpeech character="seguranca">
          Se você viu algo que pode machucar alguém, registre. Não precisa ter certeza, não precisa saber a solução e
          não precisa se identificar. Aqui não se procura culpado: se procura causa.
        </CharacterSpeech>
      </div>

      {sent && (
        <Card className="p-4 mb-5 border-jade/40 bg-jade/5 animate-fade-up">
          <div className="flex items-start gap-3">
            <Icon name="check-circle" size={22} className="text-jade-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-[15px]">Registro enviado: {sent.code}</h3>
              <p className="text-[13.5px] text-ink-600 mt-0.5">
                A supervisão foi notificada. Você pode acompanhar o andamento abaixo.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Setor" required>
            <Select value={form.sector || defaultSector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
              <option value="Outro">Outro</option>
            </Select>
          </Field>
          <Field label="Local exato" hint="Ex.: corredor entre as linhas 2 e 3">
            <TextInput value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Onde exatamente?" />
          </Field>
          <Field label="Categoria" required>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </Field>
          <Field label="Prioridade" hint={PRIORITIES.find((p) => p.value === form.priority)?.hint}>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as RiskPriority })}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="O que você viu?" required className="mt-4" hint="Descreva a situação em uma ou duas frases.">
          <TextArea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex.: caixas no corredor perto da saída de emergência no fim do turno da tarde."
          />
        </Field>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Foto (opcional)</span>
            <label className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-sand bg-linen-100/60 cursor-pointer hover:border-navy/40">
              <Icon name="image" size={20} className="text-ink-600" />
              <span className="text-[13.5px] text-ink-600">{photo ? "Foto anexada — tocar para trocar" : "Anexar foto do local"}</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setPhoto(await compressImage(file, 900, 0.66));
                }}
              />
            </label>
            {photo && <img src={photo} alt="Foto do risco" className="mt-2 rounded-xl border border-sand max-h-40 object-cover w-full" />}
          </div>
          <div className="flex items-center">
            <Toggle
              checked={form.anonymous}
              onChange={(value) => setForm({ ...form, anonymous: value })}
              label="Registrar sem me identificar"
              hint="O registro segue para a supervisão sem o seu nome."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 items-center">
          <Button size="lg" variant="danger" icon="siren" onClick={submit}>Enviar registro</Button>
          <p className="text-[12.5px] text-ink-600">+60 XP por contribuir com a segurança da equipe.</p>
        </div>
      </Card>

      {mine.length > 0 && (
        <div className="mt-7">
          <SectionTitle hint="Acompanhe o que foi feito com o que você avisou.">Meus registros</SectionTitle>
          <div className="space-y-3">
            {mine.map((report) => (
              <Card key={report.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Chip tone="neutral">{report.code}</Chip>
                  <StatusChip status={report.status} />
                  <Chip tone={report.priority === "critica" ? "alert" : report.priority === "alta" ? "copper" : "neutral"}>
                    {report.priority}
                  </Chip>
                  <span className="text-[12px] text-ink-400 ml-auto">{formatDateTime(report.createdAt)}</span>
                </div>
                <p className="text-[14px]"><strong>{report.sector}</strong> · {report.place} · {report.category}</p>
                <p className="text-[14px] text-ink-600 mt-1 leading-relaxed">{report.description}</p>
                {report.actionPlan && (
                  <div className="mt-2.5 rounded-xl bg-navy/5 border border-navy/15 p-3 text-[13px]">
                    <strong>Plano de ação:</strong> {report.actionPlan.what} · responsável {report.actionPlan.who}
                  </div>
                )}
                <ol className="mt-3 space-y-2">
                  {report.timeline.map((entry, i) => (
                    <li key={i} className="flex gap-2.5 text-[12.5px]">
                      <span className={cn("shrink-0 mt-1 w-2 h-2 rounded-full", i === report.timeline.length - 1 ? "bg-copper" : "bg-sand")} />
                      <span>
                        <strong>{entry.status.replace(/_/g, " ")}</strong> · {entry.note}
                        <span className="text-ink-400"> — {formatDateTime(entry.at)}{entry.byName ? ` · ${entry.byName}` : ""}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mine.length === 0 && !sent && role === "COLABORADOR" && (
        <div className="mt-6">
          <EmptyState icon="shield" title="Você ainda não registrou riscos" description="Quando registrar, o andamento aparece aqui com o que a empresa fez a respeito." />
        </div>
      )}
    </div>
  );
}
