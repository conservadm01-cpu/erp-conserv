"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FlipHorizontal, FlipVertical, Redo2, RotateCcw, RotateCw, Save, Trash2, Type, Undo2, CalendarDays, MapPin } from "lucide-react";
import { useRow, useRows } from "@/lib/data/hooks";
import { useMediaUrl } from "@/lib/media/use-media-url";
import { loadOriginal, renderToBlob, saveEditVersion, deleteEditVersion, downloadBlob } from "@/lib/photo/save";
import { EXPORT_FORMATS, loadSource, paintTo, renderEdit, type Source } from "@/lib/photo/render";
import { ASPECTS, defaultEditState, historyInit, historyPush, historyRedo, historyUndo, normalizeState, type EditState, type History, type TextLayer } from "@/lib/photo/state";
import { FRAME_TEMPLATES, frameTemplate, type FramePattern } from "@/lib/photo/frames";
import { NO_ADJUST } from "@/lib/photo/ops";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState, Loading, Notice, PageHeader } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { PhotoEdit, Trip } from "@/lib/types";
import { cn } from "@/lib/cn";

const PREVIEW_MAX = 1400;

function Slider({ label, value, min, max, step = 1, onChange, onCommit, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onCommit: () => void; suffix?: string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        className="w-full accent-[var(--accent)]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

export function PhotoEditor({ trip, mediaId, editId }: { trip: Trip; mediaId: string; editId: string | null }) {
  const toast = useToast();
  const { data: asset, loading } = useRow("media_assets", mediaId);
  const { data: versions } = useRows("photo_edits", { trip_id: trip.id, media_id: mediaId });
  const [src, setSrc] = useState<Source | null>(null);
  const [srcError, setSrcError] = useState<string | null>(null);
  const [hist, setHist] = useState<History<EditState>>(() => historyInit(defaultEditState()));
  const [draft, setDraft] = useState<EditState>(hist.present);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [format, setFormat] = useState<string>("image/jpeg");
  const [quality, setQuality] = useState(0.92);
  const [compare, setCompare] = useState(false);
  const loadedEdit = useRef<string | null>(null);

  // carrega o original
  useEffect(() => {
    if (!asset || asset.kind !== "image") return;
    let alive = true;
    loadOriginal(asset)
      .then(loadSource)
      .then((s) => alive && setSrc(s))
      .catch((e: unknown) => alive && setSrcError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [asset]);

  // reabre uma versão salva (?versao=<id>)
  useEffect(() => {
    if (!editId || loadedEdit.current === editId) return;
    const v = versions.find((x) => x.id === editId);
    if (v) {
      loadedEdit.current = editId;
      const st = normalizeState(v.operations);
      setHist(historyInit(st));
      setDraft(st);
      setVersionName(`${v.name} (cópia)`);
    }
  }, [editId, versions]);

  // pré-visualização reduzida, com pequeno atraso para não travar ao arrastar
  useEffect(() => {
    if (!src || !canvasRef.current) return;
    let alive = true;
    const t = setTimeout(() => {
      setRendering(true);
      renderEdit(src, compare ? defaultEditState() : draft, { previewMaxSide: PREVIEW_MAX })
        .then((c) => alive && canvasRef.current && paintTo(canvasRef.current, c))
        .catch((e: unknown) => alive && setSrcError(e instanceof Error ? e.message : String(e)))
        .finally(() => alive && setRendering(false));
    }, 90);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [src, draft, compare]);

  const live = useCallback((next: EditState) => setDraft(next), []);
  const commit = useCallback(() => {
    setHist((h) => (h.present === draftRef.current ? h : historyPush(h, draftRef.current)));
  }, []);
  const apply = useCallback((next: EditState) => {
    setDraft(next);
    setHist((h) => historyPush(h, next));
  }, []);
  const undo = () => {
    const h = historyUndo(hist);
    setHist(h);
    setDraft(h.present);
  };
  const redo = () => {
    const h = historyRedo(hist);
    setHist(h);
    setDraft(h.present);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (loading) return <Loading />;
  if (!asset) return <EmptyState title="Foto não encontrada" action={<Link href="/midia" className="text-accent">Voltar à galeria</Link>} />;
  if (asset.kind !== "image") return <EmptyState title="Apenas fotos podem ser editadas aqui" action={<Link href="/midia/video" className="text-accent">Abrir o editor de vídeo</Link>} />;

  const st = draft;
  const ext = EXPORT_FORMATS.find((f) => f.mime === format)?.ext ?? "jpg";

  async function save() {
    setBusy(true);
    try {
      const v = await saveEditVersion(asset!, draftRef.current, versionName || `Versão ${versions.length + 1}`, format, quality);
      toast(`Versão “${v.name}” salva (${v.width}×${v.height}px). O original continua intacto.`);
      setVersionName("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar versão", "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportNow() {
    setBusy(true);
    try {
      const out = await renderToBlob(asset!, draftRef.current, format, quality);
      downloadBlob(out.blob, `${asset!.original_name.replace(/\.[^.]+$/, "")}-editada.${ext}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao exportar", "error");
    } finally {
      setBusy(false);
    }
  }

  const setText = (id: string, patch: Partial<TextLayer>, commitNow = false) => {
    const next = { ...st, texts: st.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    if (commitNow) {
      apply(next);
    } else {
      live(next);
    }
  };
  const addText = (text: string, extra: Partial<TextLayer> = {}) =>
    apply({
      ...st,
      texts: [...st.texts, { id: crypto.randomUUID(), text, x: 0.5, y: 0.88, size: 5, color: "#ffffff", font: "serif", align: "center", shadow: true, inFrame: st.frame.bottomExtra > 0, ...extra }],
    });

  const tabs: { value: string; label: ReactNode; content: ReactNode }[] = [
    {
      value: "recorte",
      label: "Recorte",
      content: (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-sm font-medium">Proporção</div>
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={st.crop.aspect === a.id}
                  className={cn("rounded-full border px-3 py-1 text-sm", st.crop.aspect === a.id ? "border-accent bg-accent text-accent-fg" : "border-line hover:bg-surface-2")}
                  onClick={() => apply({ ...st, crop: { ...st.crop, aspect: a.id } })}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          {st.crop.aspect === "livre" && (
            <>
              <Slider label="Largura" min={0.1} max={1} step={0.01} value={st.crop.freeW} onChange={(v) => live({ ...st, crop: { ...st.crop, freeW: v } })} onCommit={commit} />
              <Slider label="Altura" min={0.1} max={1} step={0.01} value={st.crop.freeH} onChange={(v) => live({ ...st, crop: { ...st.crop, freeH: v } })} onCommit={commit} />
            </>
          )}
          <Slider label="Aproximar (zoom)" min={1} max={4} step={0.05} value={st.crop.zoom} onChange={(v) => live({ ...st, crop: { ...st.crop, zoom: v } })} onCommit={commit} suffix="×" />
          <Slider label="Enquadramento horizontal" min={0} max={1} step={0.01} value={st.crop.panX} onChange={(v) => live({ ...st, crop: { ...st.crop, panX: v } })} onCommit={commit} />
          <Slider label="Enquadramento vertical" min={0} max={1} step={0.01} value={st.crop.panY} onChange={(v) => live({ ...st, crop: { ...st.crop, panY: v } })} onCommit={commit} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => apply({ ...st, rotate: ((st.rotate + 270) % 360) as EditState["rotate"] })}>
              <RotateCcw className="h-4 w-4" /> Girar à esquerda
            </Button>
            <Button variant="outline" size="sm" onClick={() => apply({ ...st, rotate: ((st.rotate + 90) % 360) as EditState["rotate"] })}>
              <RotateCw className="h-4 w-4" /> Girar à direita
            </Button>
            <Button variant="outline" size="sm" aria-pressed={st.flipH} onClick={() => apply({ ...st, flipH: !st.flipH })}>
              <FlipHorizontal className="h-4 w-4" /> Espelhar
            </Button>
            <Button variant="outline" size="sm" aria-pressed={st.flipV} onClick={() => apply({ ...st, flipV: !st.flipV })}>
              <FlipVertical className="h-4 w-4" /> Inverter
            </Button>
          </div>
          <Field label="Redimensionar (lado maior)" hint={asset.width ? `Original: ${asset.width}×${asset.height}px` : undefined}>
            {(p) => (
              <Select {...p} value={st.maxSide ?? ""} onChange={(e) => apply({ ...st, maxSide: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Tamanho original</option>
                {[4096, 3000, 2048, 1600, 1080, 800].map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      ),
    },
    {
      value: "ajustes",
      label: "Ajustes",
      content: (
        <div className="space-y-4">
          {(
            [
              ["brightness", "Brilho", -100, 100],
              ["contrast", "Contraste", -100, 100],
              ["saturation", "Saturação", -100, 100],
              ["temperature", "Temperatura (frio ↔ quente)", -100, 100],
              ["sharpness", "Nitidez", 0, 100],
            ] as const
          ).map(([k, label, min, max]) => (
            <Slider key={k} label={label} min={min} max={max} value={st.adjust[k]} onChange={(v) => live({ ...st, adjust: { ...st.adjust, [k]: v } })} onCommit={commit} />
          ))}
          <Button variant="ghost" size="sm" onClick={() => apply({ ...st, adjust: { ...NO_ADJUST } })}>
            Zerar ajustes
          </Button>
        </div>
      ),
    },
    {
      value: "moldura",
      label: "Moldura",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {FRAME_TEMPLATES.map((f) => (
              <button
                key={f.template}
                type="button"
                aria-pressed={st.frame.template === f.template}
                onClick={() => apply({ ...st, frame: { ...frameTemplate(f.template) }, texts: st.texts.map((t) => ({ ...t, inFrame: t.inFrame && f.bottomExtra > 0 })) })}
                className={cn("flex items-center gap-2 rounded-lg border p-2 text-left text-sm", st.frame.template === f.template ? "border-accent ring-2 ring-accent/30" : "border-line hover:bg-surface-2")}
              >
                <span className="h-6 w-6 rounded border-4" style={{ borderColor: f.color, background: f.accent }} aria-hidden />
                {f.name}
              </button>
            ))}
          </div>
          {st.frame.template !== "nenhuma" && (
            <>
              <Slider label="Espessura" min={1} max={20} value={st.frame.thickness} onChange={(v) => live({ ...st, frame: { ...st.frame, thickness: v } })} onCommit={commit} suffix="%" />
              <Slider label="Faixa inferior extra" min={0} max={30} value={st.frame.bottomExtra} onChange={(v) => live({ ...st, frame: { ...st.frame, bottomExtra: v } })} onCommit={commit} suffix="%" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor">{(p) => <Input {...p} type="color" value={st.frame.color} onChange={(e) => apply({ ...st, frame: { ...st.frame, color: e.target.value } })} />}</Field>
                <Field label="Detalhe">{(p) => <Input {...p} type="color" value={st.frame.accent} onChange={(e) => apply({ ...st, frame: { ...st.frame, accent: e.target.value } })} />}</Field>
              </div>
              <Field label="Padrão">
                {(p) => (
                  <Select {...p} value={st.frame.pattern} onChange={(e) => apply({ ...st, frame: { ...st.frame, pattern: e.target.value as FramePattern } })}>
                    <option value="nenhum">Liso</option>
                    <option value="filete">Filete</option>
                    <option value="sombra">Sombra interna</option>
                    <option value="flocos">Flocos de neve</option>
                    <option value="montanhas">Montanhas</option>
                  </Select>
                )}
              </Field>
            </>
          )}
        </div>
      ),
    },
    {
      value: "texto",
      label: "Texto",
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => addText(asset.caption || "Sua legenda")}>
              <Type className="h-4 w-4" /> Legenda
            </Button>
            <Button size="sm" variant="outline" onClick={() => addText(fmtDate(asset.taken_at ?? trip.start_date, { day: "2-digit", month: "long", year: "numeric" }), { y: 0.08, size: 3.5, font: "sans" })}>
              <CalendarDays className="h-4 w-4" /> Data
            </Button>
            <Button size="sm" variant="outline" onClick={() => addText([trip.destination, trip.destination_country].filter(Boolean).join(", "), { y: 0.14, size: 3.5, font: "sans" })}>
              <MapPin className="h-4 w-4" /> Local
            </Button>
          </div>
          {!st.texts.length && <p className="text-sm text-muted">Adicione legenda, data ou local sobre a foto ou na faixa da moldura.</p>}
          {st.texts.map((t, i) => (
            <fieldset key={t.id} className="space-y-2 rounded-xl border border-line p-3">
              <legend className="px-1 text-xs font-semibold text-muted">Texto {i + 1}</legend>
              <Input aria-label={`Texto ${i + 1}`} value={t.text} onChange={(e) => setText(t.id, { text: e.target.value })} onBlur={commit} />
              <div className="grid grid-cols-3 gap-2">
                <Select aria-label="Fonte" value={t.font} onChange={(e) => setText(t.id, { font: e.target.value as TextLayer["font"] }, true)}>
                  <option value="serif">Serifada</option>
                  <option value="sans">Moderna</option>
                  <option value="script">Manuscrita</option>
                  <option value="mono">Máquina</option>
                </Select>
                <Select aria-label="Alinhamento" value={t.align} onChange={(e) => setText(t.id, { align: e.target.value as TextLayer["align"] }, true)}>
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </Select>
                <Input aria-label="Cor do texto" type="color" value={t.color} onChange={(e) => setText(t.id, { color: e.target.value }, true)} />
              </div>
              <Slider label="Tamanho" min={1} max={15} step={0.5} value={t.size} onChange={(v) => setText(t.id, { size: v })} onCommit={commit} suffix="%" />
              <Slider label="Posição horizontal" min={0} max={1} step={0.01} value={t.x} onChange={(v) => setText(t.id, { x: v })} onCommit={commit} />
              {!t.inFrame && <Slider label="Posição vertical" min={0} max={1} step={0.01} value={t.y} onChange={(v) => setText(t.id, { y: v })} onCommit={commit} />}
              <div className="flex flex-wrap items-center gap-3">
                <Checkbox label="Sombra" checked={t.shadow} onChange={(e) => setText(t.id, { shadow: e.target.checked }, true)} />
                {st.frame.bottomExtra > 0 && <Checkbox label="Na faixa da moldura" checked={t.inFrame} onChange={(e) => setText(t.id, { inFrame: e.target.checked }, true)} />}
                <Button size="sm" variant="ghost" className="ml-auto text-red-600" onClick={() => apply({ ...st, texts: st.texts.filter((x) => x.id !== t.id) })}>
                  Remover
                </Button>
              </div>
            </fieldset>
          ))}
        </div>
      ),
    },
    {
      value: "salvar",
      label: "Salvar",
      content: (
        <div className="space-y-4">
          <Field label="Formato">
            {(p) => (
              <Select {...p} value={format} onChange={(e) => setFormat(e.target.value)}>
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.mime} value={f.mime}>
                    {f.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {format !== "image/png" && <Slider label="Qualidade" min={0.5} max={1} step={0.01} value={quality} onChange={setQuality} onCommit={() => {}} />}
          <Field label="Nome da versão">{(p) => <Input {...p} placeholder={`Versão ${versions.length + 1}`} value={versionName} onChange={(e) => setVersionName(e.target.value)} />}</Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void save()} loading={busy}>
              <Save className="h-4 w-4" /> Salvar versão
            </Button>
            <Button variant="outline" onClick={() => void exportNow()} loading={busy}>
              <Download className="h-4 w-4" /> Baixar {ext.toUpperCase()}
            </Button>
          </div>
          <p className="text-xs text-muted">A versão é gerada em resolução total a partir do original, que nunca é sobrescrito.</p>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/midia" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Galeria
          </Link>
        }
        title="Editor de fotos"
        description={asset.caption || asset.original_name}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={undo} disabled={!hist.past.length} aria-label="Desfazer (Ctrl+Z)" title="Desfazer">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={redo} disabled={!hist.future.length} aria-label="Refazer (Ctrl+Y)" title="Refazer">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => apply(defaultEditState())}>
              Restaurar original
            </Button>
            <Button variant="secondary" aria-pressed={compare} onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)} onKeyDown={(e) => e.key === " " && setCompare(true)} onKeyUp={() => setCompare(false)}>
              Segure para comparar
            </Button>
          </>
        }
      />
      {srcError && <Notice tone="error" className="mb-4">{srcError}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="relative grid min-h-[300px] place-items-center rounded-2xl border border-line bg-[repeating-conic-gradient(var(--surface-2)_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] p-3">
            {!src && !srcError && <Loading rows={1} label="Abrindo foto…" />}
            <canvas ref={canvasRef} className={cn("max-h-[70dvh] max-w-full rounded shadow-lg", !src && "hidden")} role="img" aria-label="Pré-visualização da foto editada" />
            {rendering && <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">processando…</span>}
          </div>
          <VersionsList versions={versions} mediaId={asset.id} />
        </div>
        <Card className="p-4">
          <Tabs tabs={tabs} />
        </Card>
      </div>
    </div>
  );
}

function VersionThumb({ v }: { v: PhotoEdit }) {
  const url = useMediaUrl(v.output_path);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={v.name} className="aspect-square w-full rounded-lg object-cover" /> : <div className="aspect-square w-full rounded-lg bg-surface-2" />;
}

function VersionsList({ versions, mediaId }: { versions: PhotoEdit[]; mediaId: string }) {
  const toast = useToast();
  if (!versions.length) return <p className="mt-4 text-sm text-muted">Nenhuma versão salva ainda.</p>;
  return (
    <section className="mt-5" aria-label="Versões salvas">
      <h2 className="mb-2 font-display text-lg font-semibold">Versões salvas</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...versions].reverse().map((v) => (
          <li key={v.id} className="rounded-xl border border-line bg-surface p-2 text-sm">
            <VersionThumb v={v} />
            <div className="mt-1 truncate font-medium">{v.name}</div>
            <div className="text-xs text-muted">
              {v.width}×{v.height} · {fmtDateTime(v.created_at)}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <Link className="text-accent hover:underline" href={`/midia/foto/${mediaId}?versao=${v.id}`}>
                Reabrir edição
              </Link>
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={async () => {
                  const { getFiles } = await import("@/lib/data");
                  const blob = await getFiles().get("media", v.output_path);
                  if (blob) downloadBlob(blob, `${v.name}.${v.output_mime.split("/")[1] === "jpeg" ? "jpg" : v.output_mime.split("/")[1]}`);
                }}
              >
                Baixar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-red-600 hover:underline"
                onClick={async () => {
                  if (!confirm(`Excluir a versão “${v.name}”? O original não é afetado.`)) return;
                  await deleteEditVersion(v);
                  toast("Versão excluída.");
                }}
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

