"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, ArrowRight, Download, Film, FolderOpen, GripVertical, ImagePlus, Music, Play, Plus, Save, Scissors, Sparkles, Square, Trash2, Upload, VolumeX, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Notice } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { getFiles, getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { uploadMediaFiles } from "@/lib/media/upload";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MediaAsset, Trip, VideoProject } from "@/lib/types";
import {
  autoMontage, canvasSize, clipDuration, fmtTime, moveClip, newClip, removeClip, removeRange, splitClip, totalDuration, trimClip, type EditorClip,
} from "@/lib/video/timeline";
import { isAbort, recorderSupport, renderMontage } from "@/lib/video/render";
import { TechPanel } from "./tech-panel";

type Keyed = EditorClip & { _key: string };

let keySeq = 0;
const nextKey = () => `c${++keySeq}`;

/** Garante chave única por clipe (dividir um clipe copia a chave). */
function rekey(list: Keyed[]): Keyed[] {
  const seen = new Set<string>();
  return list.map((c) => {
    if (!c._key || seen.has(c._key)) c = { ...c, _key: nextKey() };
    seen.add(c._key);
    return c;
  });
}
const withKeys = (clips: EditorClip[]): Keyed[] => clips.map((c) => ({ ...c, _key: nextKey() }));
const stripKeys = (clips: Keyed[]): EditorClip[] => clips.map(({ _key, ...c }) => { void _key; return c; });

interface Draft {
  id: string | null;
  title: string;
  aspect: VideoProject["aspect"];
  transition: VideoProject["transition"];
  resolution: VideoProject["resolution"];
  audio_media_id: string | null;
  audio_volume: number;
}

const EMPTY: Draft = { id: null, title: "Minha montagem", aspect: "9:16", transition: "fade", resolution: 720, audio_media_id: null, audio_volume: 0.6 };

export function VideoEditor({ trip }: { trip: Trip }) {
  const toast = useToast();
  const { data: media } = useRows("media_assets", { trip_id: trip.id });
  const { data: projects } = useRows("video_projects", { trip_id: trip.id });
  const videos = useMemo(() => media.filter((m) => m.kind === "video").sort((a, b) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at)), [media]);
  const audios = useMemo(() => media.filter((m) => m.kind === "audio"), [media]);
  const byId = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [clips, setClips] = useState<Keyed[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "export" | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; url: string; mime: string } | null>(null);
  const [montageOpen, setMontageOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const support = useMemo(() => (typeof window === "undefined" ? null : recorderSupport()), []);

  useEffect(() => {
    let alive = true;
    const need = media.filter((m) => (m.kind === "video" || m.kind === "audio") && !urls[m.id]);
    if (!need.length) return;
    Promise.all(need.map(async (m) => [m.id, await getFiles().url("media", m.storage_path)] as const)).then((pairs) => {
      if (!alive) return;
      setUrls((u) => {
        const next = { ...u };
        pairs.forEach(([id, url]) => url && (next[id] = url));
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [media, urls]);

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const update = (next: Keyed[]) => {
    setClips(rekey(next));
    setDirty(true);
  };
  const total = totalDuration(clips);
  const size = canvasSize(draft.aspect, draft.resolution);

  function addVideo(m: MediaAsset) {
    update([...clips, { ...newClip(m.id, m.duration_sec ?? 5, { date_label: m.taken_at ? fmtDate(m.taken_at) : "", caption: m.caption }), _key: nextKey() }]);
    setSelected(clips.length);
  }

  async function importFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploading(`Enviando ${list.length} arquivo(s)…`);
    const res = await uploadMediaFiles(trip.id, [...list], {
      allowed: ["video", "audio"],
      onProgress: (d, t) => setUploading(`Enviando ${d}/${t}…`),
    });
    setUploading(null);
    if (res.ok.length) toast(`${res.ok.length} arquivo(s) importado(s).`);
    res.errors.forEach((e) => toast(`${e.name}: ${e.error}`, "error"));
    if (fileRef.current) fileRef.current.value = "";
  }

  function openProject(p: VideoProject) {
    setDraft({ id: p.id, title: p.title, aspect: p.aspect, transition: p.transition, resolution: p.resolution, audio_media_id: p.audio_media_id, audio_volume: Number(p.audio_volume) });
    setClips(withKeys((p.clips as EditorClip[]) ?? []));
    setSelected(null);
    setDirty(false);
  }

  function newProject() {
    setDraft(EMPTY);
    setClips([]);
    setSelected(null);
    setDirty(false);
  }

  async function saveProject() {
    const payload = {
      trip_id: trip.id,
      title: draft.title.trim() || "Montagem",
      aspect: draft.aspect,
      clips: stripKeys(clips),
      transition: draft.transition,
      audio_media_id: draft.audio_media_id,
      audio_volume: draft.audio_volume,
      resolution: draft.resolution,
    };
    try {
      const repo = getRepo();
      if (draft.id) await repo.update("video_projects", draft.id, payload);
      else {
        const row = await repo.insert("video_projects", payload);
        setDraft((d) => ({ ...d, id: row.id }));
      }
      setDirty(false);
      toast("Projeto salvo.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    }
  }

  async function deleteProject(p: VideoProject) {
    if (!confirm(`Excluir o projeto "${p.title}"? Os vídeos originais continuam na galeria.`)) return;
    await getRepo().remove("video_projects", p.id);
    if (draft.id === p.id) newProject();
    toast("Projeto excluído.");
  }

  async function run(record: boolean) {
    if (!canvasRef.current) return;
    const missing = clips.find((c) => !urls[c.media_id]);
    if (missing) return toast("Aguarde: alguns vídeos ainda estão carregando.", "info");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(record ? "export" : "preview");
    setProgress(0);
    try {
      const out = await renderMontage({
        clips: stripKeys(clips),
        urls,
        aspect: draft.aspect,
        resolution: draft.resolution,
        transition: draft.transition,
        audioUrl: draft.audio_media_id ? urls[draft.audio_media_id] : null,
        audioVolume: draft.audio_volume,
        canvas: canvasRef.current,
        record,
        signal: ctrl.signal,
        onProgress: (s, t) => setProgress(t ? s / t : 0),
      });
      if (record && out.blob) {
        setResult({ blob: out.blob, url: URL.createObjectURL(out.blob), mime: out.mimeType ?? out.blob.type });
        toast("Vídeo exportado.");
      }
    } catch (e) {
      if (!isAbort(e)) toast(e instanceof Error ? e.message : "Falha ao processar o vídeo", "error");
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  }

  async function saveResultToGallery() {
    if (!result) return;
    const ext = result.mime.includes("mp4") ? "mp4" : "webm";
    const file = new File([result.blob], `${draft.title || "montagem"}.${ext}`, { type: result.blob.type });
    const res = await uploadMediaFiles(trip.id, [file], { allowed: ["video"], extra: { caption: draft.title, album: "Montagens", favorite: true } });
    if (res.ok.length) toast("Montagem salva na galeria de Fotos e vídeos.");
    res.errors.forEach((e) => toast(e.error, "error"));
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = clips.findIndex((c) => c._key === e.active.id);
    const to = clips.findIndex((c) => c._key === e.over!.id);
    update(moveClip(clips, from, to));
    setSelected(to);
  }

  const sel = selected != null ? clips[selected] : null;
  const selAsset = sel ? byId.get(sel.media_id) : undefined;

  return (
    <div className="space-y-6">
      {support && !support.supported && (
        <Notice tone="warn" title="Exportação indisponível neste navegador">
          {support.reason} Você ainda pode montar, salvar o projeto e pré-visualizar. Para exportar, use Chrome, Edge ou Firefox atualizados no computador.
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
        {/* Projetos e biblioteca */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Projetos" action={<Button size="sm" variant="outline" onClick={newProject}><Plus className="h-4 w-4" /> Novo</Button>} />
            <CardBody className="space-y-2">
              {!projects.length && <p className="text-sm text-muted">Nenhum projeto salvo ainda.</p>}
              {projects.map((p) => (
                <div key={p.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", draft.id === p.id ? "border-accent bg-accent/5" : "border-line")}>
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => openProject(p)} title="Abrir projeto">
                    <FolderOpen className="mr-1 inline h-4 w-4 text-muted" aria-hidden />
                    {p.title}
                    <span className="ml-1 text-xs text-muted">({(p.clips as EditorClip[]).length} clipes)</span>
                  </button>
                  <button onClick={() => deleteProject(p)} className="rounded p-1 text-muted hover:text-red-600" aria-label={`Excluir projeto ${p.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Vídeos da viagem"
              subtitle="Clique para adicionar à linha do tempo"
              action={
                <>
                  <input ref={fileRef} type="file" accept="video/*,audio/*" multiple className="sr-only" id="video-import" onChange={(e) => importFiles(e.target.files)} />
                  <Button size="sm" onClick={() => fileRef.current?.click()} loading={Boolean(uploading)}>
                    <Upload className="h-4 w-4" /> Importar
                  </Button>
                </>
              }
            />
            <CardBody className="space-y-2">
              {uploading && <p role="status" className="text-sm text-muted">{uploading}</p>}
              {!videos.length && <p className="text-sm text-muted">Importe vídeos do celular ou da câmera. Arquivos aceitos: MP4, MOV e WebM.</p>}
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {videos.map((v) => (
                  <li key={v.id}>
                    <button onClick={() => addVideo(v)} className="flex w-full items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-surface-2">
                      <Film className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{v.caption || v.original_name}</span>
                      <span className="text-xs tabular-nums text-muted">{fmtTime(v.duration_sec ?? 0)}</span>
                      {v.favorite && <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-label="Favorito" />}
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" size="sm" className="w-full justify-center" disabled={!videos.length} onClick={() => setMontageOpen(true)}>
                <Wand2 className="h-4 w-4" /> Montagem curta automática
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Trilha sonora" />
            <CardBody className="space-y-3">
              <Notice tone="warn">Use apenas áudio próprio ou trilhas com licença de uso. Músicas protegidas por direitos autorais não devem ser incorporadas sem autorização.</Notice>
              <Field label="Áudio de fundo">
                {(p) => (
                  <Select {...p} value={draft.audio_media_id ?? ""} onChange={(e) => { setDraft({ ...draft, audio_media_id: e.target.value || null }); setDirty(true); }}>
                    <option value="">Sem trilha (apenas o som dos clipes)</option>
                    {audios.map((a) => (
                      <option key={a.id} value={a.id}>{a.caption || a.original_name}</option>
                    ))}
                  </Select>
                )}
              </Field>
              {!audios.length && <p className="text-xs text-muted"><Music className="mr-1 inline h-3.5 w-3.5" />Importe um MP3, M4A, WAV ou OGG pelo botão “Importar”.</p>}
              <Field label={`Volume da trilha: ${Math.round(draft.audio_volume * 100)}%`}>
                {(p) => <input {...p} type="range" min={0} max={1} step={0.05} value={draft.audio_volume} onChange={(e) => { setDraft({ ...draft, audio_volume: Number(e.target.value) }); setDirty(true); }} className="w-full accent-[var(--accent)]" />}
              </Field>
            </CardBody>
          </Card>
        </div>

        {/* Prévia, configurações e linha do tempo */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title={
                <input
                  aria-label="Título do projeto"
                  value={draft.title}
                  onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDirty(true); }}
                  className="w-full bg-transparent font-display text-lg font-semibold outline-none focus:underline"
                />
              }
              subtitle={`${clips.length} clipe(s) · ${fmtTime(total)} · ${size.width}×${size.height}${dirty ? " · alterações não salvas" : ""}`}
              action={<Button size="sm" variant="outline" onClick={saveProject}><Save className="h-4 w-4" /> Salvar projeto</Button>}
            />
            <CardBody className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="flex flex-col items-center gap-3">
                <div className="grid w-full place-items-center rounded-xl bg-black p-2" style={{ minHeight: 260 }}>
                  <canvas
                    ref={canvasRef}
                    width={size.width}
                    height={size.height}
                    className="max-h-[60vh] max-w-full rounded"
                    style={{ aspectRatio: `${size.width} / ${size.height}` }}
                    aria-label="Prévia da montagem"
                  />
                </div>
                {busy && (
                  <div className="w-full" role="status" aria-live="polite">
                    <div className="mb-1 flex justify-between text-xs text-muted">
                      <span>{busy === "export" ? "Exportando em tempo real — mantenha esta aba visível" : "Pré-visualizando"}</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  {busy ? (
                    <Button variant="danger" onClick={() => abortRef.current?.abort()}><Square className="h-4 w-4" /> Cancelar</Button>
                  ) : (
                    <>
                      <Button variant="outline" disabled={!clips.length} onClick={() => run(false)}><Play className="h-4 w-4" /> Pré-visualizar</Button>
                      <Button variant="accent" disabled={!clips.length || !support?.supported} onClick={() => run(true)}><Download className="h-4 w-4" /> Exportar vídeo</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <Field label="Proporção">
                  {(p) => (
                    <Select {...p} value={draft.aspect} onChange={(e) => { setDraft({ ...draft, aspect: e.target.value as Draft["aspect"] }); setDirty(true); }}>
                      <option value="9:16">Vertical 9:16 (stories/reels)</option>
                      <option value="1:1">Quadrado 1:1</option>
                      <option value="16:9">Horizontal 16:9</option>
                    </Select>
                  )}
                </Field>
                <Field label="Resolução" hint="1080p exige mais do aparelho.">
                  {(p) => (
                    <Select {...p} value={draft.resolution} onChange={(e) => { setDraft({ ...draft, resolution: Number(e.target.value) as Draft["resolution"] }); setDirty(true); }}>
                      <option value={480}>480p</option>
                      <option value={720}>720p</option>
                      <option value={1080}>1080p</option>
                    </Select>
                  )}
                </Field>
                <Field label="Transição entre clipes">
                  {(p) => (
                    <Select {...p} value={draft.transition} onChange={(e) => { setDraft({ ...draft, transition: e.target.value as Draft["transition"] }); setDirty(true); }}>
                      <option value="fade">Esmaecer (fade)</option>
                      <option value="corte">Corte seco</option>
                    </Select>
                  )}
                </Field>
                <p className="text-xs text-muted">Formato de saída: {support?.mimeType?.split(";")[0] ?? "indisponível"}</p>
                {result && (
                  <div className="space-y-2 rounded-xl border border-line p-3">
                    <p className="text-sm font-medium">Vídeo pronto ({(result.blob.size / 1024 / 1024).toFixed(1)} MB)</p>
                    <video src={result.url} controls className="w-full rounded" />
                    <a href={result.url} download={`${draft.title || "montagem"}.${result.mime.includes("mp4") ? "mp4" : "webm"}`} className="flex items-center gap-1 text-sm text-accent hover:underline">
                      <Download className="h-4 w-4" /> Baixar
                    </a>
                    <Button size="sm" variant="secondary" onClick={saveResultToGallery}><ImagePlus className="h-4 w-4" /> Salvar na galeria</Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Linha do tempo" subtitle="Arraste (ou use as setas) para reordenar. Selecione um clipe para editar." />
            <CardBody>
              {!clips.length ? (
                <EmptyState icon={<Film />} title="Linha do tempo vazia">Adicione vídeos da lista ao lado ou crie uma montagem curta automática.</EmptyState>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={clips.map((c) => c._key)} strategy={horizontalListSortingStrategy}>
                    <ol className="flex gap-2 overflow-x-auto pb-2" aria-label="Clipes da montagem">
                      {clips.map((c, i) => (
                        <ClipChip
                          key={c._key}
                          clip={c}
                          index={i}
                          count={clips.length}
                          total={total}
                          name={byId.get(c.media_id)?.caption || byId.get(c.media_id)?.original_name || "vídeo removido"}
                          selected={selected === i}
                          onSelect={() => setSelected(i)}
                          onMove={(d) => { update(moveClip(clips, i, i + d)); setSelected(i + d); }}
                          onRemove={() => { update(removeClip(clips, i)); setSelected(null); }}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}
            </CardBody>
          </Card>

          {sel && selected != null && (
            <ClipInspector
              key={sel._key}
              clip={sel}
              asset={selAsset}
              url={urls[sel.media_id]}
              onChange={(patch) => update(clips.map((c, k) => (k === selected ? { ...c, ...patch } : c)))}
              onTrim={(s, e) => update(trimClip(clips, selected, s, e, selAsset?.duration_sec))}
              onSplit={(at) => update(splitClip(clips, selected, at))}
              onRemoveRange={(f, t) => update(removeRange(clips, selected, f, t))}
            />
          )}

          <TechPanel />
        </div>
      </div>

      <MontageDialog
        open={montageOpen}
        onOpenChange={setMontageOpen}
        hasFavorites={videos.some((v) => v.favorite)}
        onCreate={(opts) => {
          const auto = autoMontage(
            videos.map((v) => ({ id: v.id, duration: v.duration_sec, favorite: v.favorite, taken_at: v.taken_at, created_at: v.created_at })),
            opts,
          ).map((c) => {
            const m = byId.get(c.media_id);
            return { ...c, caption: m?.caption ?? "", date_label: m?.taken_at ? fmtDate(m.taken_at) : "" };
          });
          if (auto.length) auto[0].title = draft.title;
          update(withKeys(auto));
          setSelected(null);
          setMontageOpen(false);
          toast(`Montagem com ${auto.length} clipe(s) criada. Ajuste e exporte.`);
        }}
      />
    </div>
  );
}

function ClipChip(props: {
  clip: Keyed;
  index: number;
  count: number;
  total: number;
  name: string;
  selected: boolean;
  onSelect: () => void;
  onMove: (d: number) => void;
  onRemove: () => void;
}) {
  const { clip, index, count, total, name, selected } = props;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: clip._key });
  const d = clipDuration(clip);
  const width = Math.max(140, Math.min(320, (d / Math.max(total, 1)) * 900));
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, width }}
      className={cn("shrink-0 rounded-xl border bg-surface p-2 text-sm", selected ? "border-accent ring-2 ring-accent/30" : "border-line")}
    >
      <div className="flex items-center gap-1">
        <button {...attributes} {...listeners} className="cursor-grab rounded p-0.5 text-muted" aria-label={`Arrastar clipe ${index + 1}`}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={props.onSelect} className="min-w-0 flex-1 truncate text-left font-medium" aria-pressed={selected}>
          {index + 1}. {clip.title || name}
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-1 text-xs text-muted">
        <span className="tabular-nums">{fmtTime(d)}</span>
        {clip.muted && <VolumeX className="h-3.5 w-3.5" aria-label="Sem som" />}
        <span className="flex gap-0.5">
          <button className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" disabled={index === 0} onClick={() => props.onMove(-1)} aria-label="Mover para a esquerda"><ArrowLeft className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 hover:bg-surface-2 disabled:opacity-30" disabled={index === count - 1} onClick={() => props.onMove(1)} aria-label="Mover para a direita"><ArrowRight className="h-3.5 w-3.5" /></button>
          <button className="rounded p-1 hover:bg-surface-2 hover:text-red-600" onClick={props.onRemove} aria-label="Remover clipe"><Trash2 className="h-3.5 w-3.5" /></button>
        </span>
      </div>
    </li>
  );
}

function ClipInspector(props: {
  clip: Keyed;
  asset: MediaAsset | undefined;
  url: string | undefined;
  onChange: (p: Partial<EditorClip>) => void;
  onTrim: (start: number, end: number) => void;
  onSplit: (at: number) => void;
  onRemoveRange: (from: number, to: number) => void;
}) {
  const { clip, asset, url } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(clip.start);
  const [cutFrom, setCutFrom] = useState(clip.start);
  const [cutTo, setCutTo] = useState(Math.min(clip.end, clip.start + 1));
  const srcDur = asset?.duration_sec ?? clip.end;

  useEffect(() => {
    const v = videoRef.current;
    if (v && Math.abs(v.currentTime - clip.start) > 0.05) v.currentTime = clip.start;
  }, [clip.start, url]);

  return (
    <Card>
      <CardHeader title="Editar clipe" subtitle={`${asset?.original_name ?? ""} · trecho ${fmtTime(clip.start)} → ${fmtTime(clip.end)} de ${fmtTime(srcDur)}`} />
      <CardBody className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {url ? (
            <video
              ref={videoRef}
              src={url}
              controls
              playsInline
              className="max-h-72 w-full rounded-lg bg-black"
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                setPos(t);
                if (t > clip.end) e.currentTarget.pause();
              }}
            />
          ) : (
            <p className="text-sm text-muted">Carregando vídeo…</p>
          )}
          <p className="text-xs text-muted">Posição atual: <span className="tabular-nums">{fmtTime(pos)}</span></p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => props.onTrim(pos, clip.end)}>Início aqui</Button>
            <Button size="sm" variant="outline" onClick={() => props.onTrim(clip.start, pos)}>Fim aqui</Button>
            <Button size="sm" variant="outline" onClick={() => props.onSplit(pos)}><Scissors className="h-4 w-4" /> Dividir aqui</Button>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início (s)">
              {(p) => <Input {...p} type="number" step={0.1} min={0} max={srcDur} value={clip.start} onChange={(e) => props.onTrim(Number(e.target.value), clip.end)} />}
            </Field>
            <Field label="Fim (s)">
              {(p) => <Input {...p} type="number" step={0.1} min={0} max={srcDur} value={clip.end} onChange={(e) => props.onTrim(clip.start, Number(e.target.value))} />}
            </Field>
          </div>
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-medium">Remover trecho do meio</legend>
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <Field label="De (s)">{(p) => <Input {...p} type="number" step={0.1} value={cutFrom} onChange={(e) => setCutFrom(Number(e.target.value))} />}</Field>
              <Field label="Até (s)">{(p) => <Input {...p} type="number" step={0.1} value={cutTo} onChange={(e) => setCutTo(Number(e.target.value))} />}</Field>
              <Button size="sm" variant="outline" onClick={() => props.onRemoveRange(cutFrom, cutTo)}>Remover</Button>
            </div>
          </fieldset>
          <Field label="Título (aparece nos primeiros segundos)">{(p) => <Input {...p} value={clip.title} maxLength={80} onChange={(e) => props.onChange({ title: e.target.value })} />}</Field>
          <Field label="Legenda">{(p) => <Input {...p} value={clip.caption} maxLength={140} onChange={(e) => props.onChange({ caption: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">{(p) => <Input {...p} value={clip.date_label ?? ""} maxLength={40} onChange={(e) => props.onChange({ date_label: e.target.value })} />}</Field>
            <Field label="Local">{(p) => <Input {...p} value={clip.location_label ?? ""} maxLength={60} onChange={(e) => props.onChange({ location_label: e.target.value })} />}</Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Field label={`Volume: ${Math.round(clip.volume * 100)}%`} className="flex-1">
              {(p) => <input {...p} type="range" min={0} max={1} step={0.05} value={clip.volume} disabled={clip.muted} onChange={(e) => props.onChange({ volume: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />}
            </Field>
            <Checkbox checked={clip.muted} onChange={(e) => props.onChange({ muted: e.target.checked })} label="Silenciar" />
          </div>
          <Badge tone="blue">Duração do clipe: {fmtTime(clipDuration(clip))}</Badge>
        </div>
      </CardBody>
    </Card>
  );
}

function MontageDialog({ open, onOpenChange, onCreate, hasFavorites }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasFavorites: boolean;
  onCreate: (o: { secondsPerClip: number; maxClips: number; onlyFavorites: boolean }) => void;
}) {
  const [secondsPerClip, setSec] = useState(3);
  const [maxClips, setMax] = useState(12);
  const [onlyFavorites, setFav] = useState(true);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Montagem curta automática" description="Pega um trecho do meio de cada vídeo, em ordem cronológica. Substitui a linha do tempo atual.">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Segundos por clipe">{(p) => <Input {...p} type="number" min={1} max={15} value={secondsPerClip} onChange={(e) => setSec(Number(e.target.value))} />}</Field>
          <Field label="Máximo de clipes">{(p) => <Input {...p} type="number" min={1} max={60} value={maxClips} onChange={(e) => setMax(Number(e.target.value))} />}</Field>
        </div>
        <Checkbox checked={onlyFavorites} onChange={(e) => setFav(e.target.checked)} label={`Usar só os favoritos${hasFavorites ? "" : " (nenhum marcado — usará todos)"}`} />
        <p className="text-sm text-muted">Duração estimada: até {fmtTime(secondsPerClip * maxClips)}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate({ secondsPerClip, maxClips, onlyFavorites })}><Wand2 className="h-4 w-4" /> Criar montagem</Button>
        </div>
      </div>
    </Modal>
  );
}
