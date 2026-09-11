import { useState } from "react";
import type { ContentItem } from "../../core/types";
import { catalogRepo, competencyRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { contentEngine } from "../../engines/content/ContentEngine";
import { extractFromFile, extractFromText, extractFromUrl, type ExtractionResult } from "../../engines/content/extractors";
import { compressImage, formatBytes } from "../../core/images";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Field, Select, TextArea, TextInput, CheckboxRow } from "../../ui/primitives/Field";
import { Callout } from "../../ui/primitives/Feedback";
import { cn } from "../../core/cn";

const CONTENT_TYPES: Array<{ value: ContentItem["contentType"]; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "norma", label: "Norma / legislação" },
  { value: "procedimento", label: "Procedimento (POP)" },
  { value: "ficha_tecnica", label: "Ficha técnica" },
  { value: "apostila", label: "Apostila" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "artigo", label: "Artigo" },
  { value: "video_aula", label: "Vídeo-aula" },
  { value: "catalogo", label: "Catálogo" },
];

const CATEGORIES = [
  "costura", "corte", "modelagem", "estamparia", "qualidade", "seguranca", "ergonomia",
  "produtividade", "organizacao", "manutencao", "embalagem", "sustentabilidade", "cultura", "geral",
];

/**
 * TELA "NOVO CONTEÚDO" (seção 35) — simples de propósito:
 * título, tipo, categoria, arquivo ou URL ou texto, descrição, palavras-chave
 * e o botão [ANALISAR CONTEÚDO].
 */
export function ContentUploaderPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const settings = useQuery(() => settingsRepo.get());
  const competencies = useQuery(() => competencyRepo.all());
  const sources = useQuery(() => catalogRepo.sources());
  const departments = useQuery(() => peopleRepo.departments());
  const jobRoles = useQuery(() => peopleRepo.jobRoles());

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "costura",
    subcategory: "",
    level: "basico" as ContentItem["level"],
    sector: "Costura",
    jobFunction: "",
    contentType: "manual" as ContentItem["contentType"],
    author: "",
    keywords: "",
    url: "",
    text: "",
    validUntil: "",
  });
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [fileRef, setFileRef] = useState<string | undefined>();
  const [busy, setBusy] = useState<"extraindo" | "analisando" | null>(null);

  const handleFile = async (picked: File) => {
    setFile(picked);
    setBusy("extraindo");
    try {
      const result = await extractFromFile(picked);
      setExtraction(result);
      if (result.detectedType === "imagem") setFileRef(await compressImage(picked));
      if (!form.title) setForm((f) => ({ ...f, title: picked.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") }));
      if (result.needsManualText) {
        toast.push({ title: "Arquivo sem texto extraível", body: "Cole o conteúdo no campo de texto para a análise funcionar.", tone: "info", icon: "info" });
      } else {
        toast.success("Texto extraído", `${result.sections.length} trecho(s) identificados.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ler o arquivo.");
    } finally {
      setBusy(null);
    }
  };

  const handleUrl = async () => {
    if (!form.url.trim()) return;
    setBusy("extraindo");
    const result = await extractFromUrl(form.url.trim());
    setExtraction(result);
    setBusy(null);
    if (result.needsManualText) toast.push({ title: "Não foi possível ler a página", body: result.notes[0], tone: "info", icon: "info" });
    else toast.success("Conteúdo da página capturado");
  };

  const analyze = async () => {
    if (!employee) return;
    if (form.title.trim().length < 3) {
      toast.error("Dê um título ao conteúdo.");
      return;
    }
    const manualText = form.text.trim();
    const baseExtraction = extraction ?? (manualText ? extractFromText(manualText) : null);
    if (!baseExtraction || (baseExtraction.needsManualText && !manualText)) {
      toast.error("Envie um arquivo com texto, informe uma URL legível ou cole o conteúdo.");
      return;
    }
    setBusy("analisando");
    try {
      const content = contentEngine.createFromUpload({
        title: form.title,
        description: form.description,
        category: form.category,
        subcategory: form.subcategory || undefined,
        level: form.level,
        sector: form.sector,
        jobFunction: form.jobFunction || undefined,
        contentType: form.contentType,
        author: form.author || employee.name,
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        competencies: selectedCompetencies,
        librarySourceIds: selectedSources,
        validUntil: form.validUntil || undefined,
        extraction: baseExtraction,
        manualText: manualText || undefined,
        url: form.url || undefined,
        fileRef,
        createdBy: employee.id,
      });
      await contentEngine.analyze(content.id, employee.id);
      toast.success("Conteúdo analisado", "Revise as sugestões antes de publicar.");
      navigate(`/admin/conteudos/${content.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na análise.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Novo conteúdo"
        subtitle="Envie o material. A plataforma extrai o texto, analisa e sugere aulas, quiz, jogos e desafios — você revisa e aprova."
        icon="upload"
        back={{ to: "/admin/conteudos", label: "Conteúdos" }}
      />

      <Card className="p-4 sm:p-5 space-y-4">
        <Field label="Título" required>
          <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Regulagem da Overloque" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tipo">
            <Select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value as ContentItem["contentType"] })}>
              {CONTENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Categoria">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Nível">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as ContentItem["level"] })}>
              <option value="basico">Básico</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Setor">
            <Select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
              <option value="Todos">Todos</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Função (opcional)">
            <Select value={form.jobFunction} onChange={(e) => setForm({ ...form, jobFunction: e.target.value })}>
              <option value="">Todas</option>
              {jobRoles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Subcategoria (opcional)">
            <TextInput value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} placeholder="Ex.: regulagem" />
          </Field>
        </div>

        {/* Arquivo / URL / texto */}
        <div className="rounded-xl border border-sand bg-linen-100/50 p-4 space-y-3">
          <div className="label mb-0">Material de origem</div>
          <label className={cn(
            "flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
            file ? "border-jade/40 bg-jade/5" : "border-sand hover:border-navy/40",
          )}>
            <Icon name="upload" size={22} className="text-ink-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">
                {file ? file.name : "Enviar arquivo (PDF, DOCX, PPTX, TXT, imagem, vídeo)"}
              </div>
              <div className="text-[12.5px] text-ink-600">
                {file ? `${formatBytes(file.size)} · ${extraction?.sections.length ?? 0} trecho(s) extraídos` : "O texto é extraído no seu navegador — o arquivo não sai do dispositivo nesta etapa."}
              </div>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.pptx,.txt,.md,.csv,image/*,video/*"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) void handleFile(picked);
              }}
            />
          </label>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <Field label="Ou endereço (URL)" className="flex-1">
              <TextInput value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </Field>
            <Button variant="secondary" icon="download" onClick={handleUrl} loading={busy === "extraindo"} disabled={!form.url.trim()}>
              Buscar texto
            </Button>
          </div>

          <Field
            label="Ou cole o conteúdo"
            hint="Obrigatório quando o arquivo é imagem, vídeo ou PDF digitalizado (sem texto selecionável)."
          >
            <TextArea rows={6} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Cole aqui o texto do material…" />
          </Field>

          {extraction && extraction.notes.length > 0 && (
            <Callout tone={extraction.needsManualText ? "alerta" : "info"} title="Sobre a extração">
              <ul className="list-disc pl-4 space-y-1">
                {extraction.notes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            </Callout>
          )}
          {extraction && !extraction.needsManualText && (
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="jade" icon="check">{extraction.sections.length} trechos</Chip>
              <Chip tone="neutral">{extraction.detectedType}</Chip>
              <Chip tone="sand">{extraction.text.split(/\s+/).length} palavras</Chip>
            </div>
          )}
        </div>

        <Field label="Descrição" hint="Uma ou duas frases: para que serve este material.">
          <TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Palavras-chave" hint="Separadas por vírgula.">
            <TextInput value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="overloque, tensão, diferencial" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Autor / responsável">
              <TextInput value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder={employee?.name} />
            </Field>
            <Field label="Validade (opcional)">
              <TextInput type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* Fontes e competências */}
        <details className="rounded-xl border border-sand bg-linen-50 p-4">
          <summary className="font-semibold text-[14px] cursor-pointer">
            Fontes e competências ({selectedSources.length} fonte(s), {selectedCompetencies.length} competência(s))
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="label">Fontes de referência (rastreabilidade)</div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sources.map((source) => (
                  <CheckboxRow
                    key={source.id}
                    checked={selectedSources.includes(source.id)}
                    onChange={(checked) => setSelectedSources(checked ? [...selectedSources, source.id] : selectedSources.filter((id) => id !== source.id))}
                    title={source.name}
                    description={`${source.institution} · ${source.type} · ${source.reliability}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="label">Competências relacionadas</div>
              <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                {competencies.map((competency) => {
                  const active = selectedCompetencies.includes(competency.id);
                  return (
                    <button
                      key={competency.id}
                      type="button"
                      onClick={() => setSelectedCompetencies(active
                        ? selectedCompetencies.filter((id) => id !== competency.id)
                        : [...selectedCompetencies, competency.id])}
                      className={cn(
                        "chip transition-colors",
                        active ? "bg-navy text-linen-50 border-navy" : "bg-linen-50 text-ink-600 border-sand hover:border-navy/40",
                      )}
                    >
                      {competency.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[12px] text-ink-400 mt-2">
                Deixe vazio para a análise sugerir as competências automaticamente.
              </p>
            </div>
          </div>
        </details>

        <Callout tone="info" title="Como a análise funciona">
          {settings.ai.remoteProvider.enabled && settings.ai.remoteProvider.endpoint
            ? `A análise usará a IA externa configurada (${settings.ai.remoteProvider.model || "modelo não informado"}), com o analisador local como garantia de rastreabilidade.`
            : "A análise usa o analisador local da ConServ (funciona sem internet). Para ligar uma IA externa, vá em Configurações → IA."}
          {" "}Nada é publicado sem sua aprovação.
        </Callout>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="lg" icon="sparkles" onClick={analyze} loading={busy === "analisando"}>
            Analisar conteúdo
          </Button>
          <Button size="lg" variant="ghost" onClick={() => navigate("/admin/conteudos")}>Cancelar</Button>
        </div>
      </Card>
    </div>
  );
}
