"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Eye, EyeOff, FileText, ImagePlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRow, useRows } from "@/lib/data/hooks";
import { getRepo } from "@/lib/data";
import { suggestPages } from "@/lib/album/auto";
import { COVER_TEMPLATES } from "@/lib/album/pdf";
import { exportAlbumPdf } from "@/lib/album/export";
import { downloadBlob } from "@/lib/photo/save";
import { slugify } from "@/lib/budget/categories";
import { FRAME_TEMPLATES } from "@/lib/photo/frames";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Loading, Notice, PageHeader } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { MediaThumb } from "@/components/media/media-thumb";
import type { Album, AlbumFormat, AlbumPage, Trip } from "@/lib/types";
import { PageEditor, LAYOUTS } from "./page-editor";
import { PagePreview } from "./page-preview";
import { MediaPicker } from "./media-picker";

export function BookEditor({ trip, albumId }: { trip: Trip; albumId: string }) {
  const toast = useToast();
  const { data: album, loading } = useRow("albums", albumId);
  const { data: allPages } = useRows("album_pages", { trip_id: trip.id, album_id: albumId });
  const { data: media } = useRows("media_assets", { trip_id: trip.id });
  const { data: edits } = useRows("photo_edits", { trip_id: trip.id });
  const [settings, setSettings] = useState<Album | null>(null);
  const [editing, setEditing] = useState<AlbumPage | null>(null);
  const [coverPicker, setCoverPicker] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (album && (!settings || settings.id !== album.id)) setSettings(album);
  }, [album, settings]);

  const pages = useMemo(() => [...allPages].sort((a, b) => a.position - b.position), [allPages]);
  const mediaMap = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const coverAsset = trip.cover_media_id ? mediaMap.get(trip.cover_media_id) : undefined;

  if (loading && !album) return <Loading />;
  if (!album || !settings) return <EmptyState title="Book não encontrado" action={<Link href="/book" className="text-accent">Voltar</Link>} />;

  const repo = getRepo();
  const s = settings;

  async function saveSettings() {
    await repo.update("albums", s.id, {
      title: s.title.slice(0, 160),
      subtitle: s.subtitle.slice(0, 200),
      format: s.format,
      margin_mm: Math.max(5, Math.min(40, Number(s.margin_mm) || 12)),
      gap_mm: Math.max(0, Math.min(30, Number(s.gap_mm) || 0)),
      background: s.background,
      frame: s.frame,
      include_cover: s.include_cover,
      include_toc: s.include_toc,
      include_itinerary: s.include_itinerary,
      include_budget: s.include_budget,
      include_diary: s.include_diary,
      footer_text: s.footer_text.slice(0, 200),
      page_numbers: s.page_numbers,
    });
    toast("Configurações do book salvas.");
  }

  async function addPage(layout: AlbumPage["layout"] = "1") {
    const p = await repo.insert("album_pages", {
      album_id: album!.id,
      trip_id: trip.id,
      position: (pages.at(-1)?.position ?? -1) + 1,
      layout,
      title: "",
      text: "",
      date_label: "",
      background: "",
      frame: "branca",
      items: [],
      included: true,
    });
    setEditing(p);
  }

  async function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const a = pages[i];
    const b = pages[j];
    // normaliza posições e troca as duas
    const order = pages.map((p) => p.id);
    [order[i], order[j]] = [order[j], order[i]];
    for (let k = 0; k < order.length; k++) {
      const pg = pages.find((p) => p.id === order[k])!;
      if (pg.position !== k || pg.id === a.id || pg.id === b.id) await repo.update("album_pages", pg.id, { position: k });
    }
  }

  async function duplicate(p: AlbumPage) {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = p;
    void _id;
    void _c;
    void _u;
    await repo.insert("album_pages", { ...rest, position: (pages.at(-1)?.position ?? 0) + 1, title: p.title ? `${p.title} (cópia)` : "" });
  }

  async function autoGenerate() {
    const [diary, all] = await Promise.all([repo.list("diary_entries", { trip_id: trip.id }), repo.list("media_assets", { trip_id: trip.id })]);
    const already = new Set(pages.flatMap((p) => p.items.map((i) => i.media_id)));
    const fresh = suggestPages(album!, diary, all.filter((m) => !already.has(m.id)), (pages.at(-1)?.position ?? -1) + 1);
    if (!fresh.length) {
      toast("Nada novo para sugerir: escreva no diário ou marque fotos como favoritas/instagramáveis.", "info");
      return;
    }
    await repo.insertMany("album_pages", fresh);
    toast(`${fresh.length} página(s) sugerida(s) adicionada(s).`);
  }

  async function exportPdf() {
    setExportError(null);
    setProgress({ done: 0, total: 1 });
    try {
      await saveSettings();
      const blob = await exportAlbumPdf(trip, s, pages, (done, total) => setProgress({ done, total }));
      downloadBlob(blob, `book-${slugify(s.title) || "viagem"}.pdf`);
      toast("PDF gerado.");
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  const includedCount = pages.filter((p) => p.included).length;

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/book" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Meus books
          </Link>
        }
        title={s.title}
        description={`${pages.length} página(s) de fotos · ${includedCount} incluída(s) no PDF. Alterações são salvas no projeto e podem ser reabertas a qualquer momento.`}
        actions={
          <>
            <Button variant="outline" onClick={() => void autoGenerate()}>
              <Sparkles className="h-4 w-4" /> Sugerir páginas
            </Button>
            <Button variant="accent" onClick={() => void exportPdf()} loading={!!progress}>
              <Download className="h-4 w-4" /> Exportar PDF
            </Button>
          </>
        }
      />
      {progress && (
        <div className="mb-4" role="status" aria-live="polite">
          <div className="mb-1 text-sm text-muted">Gerando PDF em alta resolução… etapa {progress.done} de {progress.total}</div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
        </div>
      )}
      {exportError && <Notice tone="error" className="mb-4" title="Não foi possível gerar o PDF">{exportError}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="self-start">
          <CardHeader title="Configurações" />
          <CardBody className="space-y-3">
            <Field label="Título">{(p) => <Input {...p} value={s.title} onChange={(e) => setSettings({ ...s, title: e.target.value })} />}</Field>
            <Field label="Subtítulo">{(p) => <Input {...p} value={s.subtitle} onChange={(e) => setSettings({ ...s, subtitle: e.target.value })} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato">
                {(p) => (
                  <Select {...p} value={s.format} onChange={(e) => setSettings({ ...s, format: e.target.value as AlbumFormat })}>
                    <option value="A4">A4</option>
                    <option value="quadrado">Quadrado</option>
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </Select>
                )}
              </Field>
              <Field label="Capa">
                {(p) => (
                  <Select {...p} value={s.frame} onChange={(e) => setSettings({ ...s, frame: e.target.value })}>
                    {COVER_TEMPLATES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.split(" (")[0]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Margem (mm)">{(p) => <Input {...p} type="number" min={5} max={40} value={s.margin_mm} onChange={(e) => setSettings({ ...s, margin_mm: Number(e.target.value) })} />}</Field>
              <Field label="Espaçamento (mm)">{(p) => <Input {...p} type="number" min={0} max={30} value={s.gap_mm} onChange={(e) => setSettings({ ...s, gap_mm: Number(e.target.value) })} />}</Field>
              <Field label="Fundo padrão">{(p) => <Input {...p} type="color" value={s.background || "#ffffff"} onChange={(e) => setSettings({ ...s, background: e.target.value })} />}</Field>
            </div>
            <div>
              <div className="mb-1 text-sm font-medium">Foto da capa</div>
              <div className="flex items-center gap-3">
                {coverAsset ? <MediaThumb asset={coverAsset} className="h-16 w-16 rounded-lg" /> : <div className="grid h-16 w-16 place-items-center rounded-lg bg-surface-2 text-xs text-muted">auto</div>}
                <Button size="sm" variant="outline" onClick={() => setCoverPicker(true)}>
                  <ImagePlus className="h-4 w-4" /> Escolher
                </Button>
              </div>
            </div>
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-sm font-medium">Seções do PDF</legend>
              <Checkbox label="Capa" checked={s.include_cover} onChange={(e) => setSettings({ ...s, include_cover: e.target.checked })} />
              <Checkbox label="Sumário" checked={s.include_toc} onChange={(e) => setSettings({ ...s, include_toc: e.target.checked })} />
              <Checkbox label="Roteiro dia a dia" checked={s.include_itinerary} onChange={(e) => setSettings({ ...s, include_itinerary: e.target.checked })} />
              <Checkbox label="Histórias do diário" checked={s.include_diary} onChange={(e) => setSettings({ ...s, include_diary: e.target.checked })} />
              <Checkbox label="Resumo financeiro" checked={s.include_budget} onChange={(e) => setSettings({ ...s, include_budget: e.target.checked })} />
              <Checkbox label="Numeração de páginas" checked={s.page_numbers} onChange={(e) => setSettings({ ...s, page_numbers: e.target.checked })} />
            </fieldset>
            <Field label="Rodapé">{(p) => <Input {...p} value={s.footer_text} onChange={(e) => setSettings({ ...s, footer_text: e.target.value })} />}</Field>
            <Button className="w-full justify-center" onClick={() => void saveSettings()}>
              Salvar configurações
            </Button>
          </CardBody>
        </Card>

        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            {LAYOUTS.map((l) => (
              <Button key={l.id} size="sm" variant="outline" onClick={() => void addPage(l.id)}>
                <Plus className="h-4 w-4" /> {l.label}
              </Button>
            ))}
          </div>
          {!pages.length ? (
            <EmptyState icon={<FileText />} title="Nenhuma página de fotos" action={<Button onClick={() => void autoGenerate()}>Sugerir páginas automaticamente</Button>}>
              Capa, sumário, roteiro, histórias e resumo financeiro são gerados automaticamente conforme as seções marcadas.
            </EmptyState>
          ) : (
            <ol className="space-y-2">
              {pages.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl border border-line bg-surface p-2 ${p.included ? "" : "opacity-55"}`}>
                  <span className="w-6 text-center text-sm tabular-nums text-muted">{i + 1}</span>
                  <PagePreview page={p} format={s.format} media={mediaMap} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.title || <span className="text-muted">Sem título</span>}</div>
                    <div className="text-xs text-muted">
                      {LAYOUTS.find((l) => l.id === p.layout)?.label} · {p.items.length} foto(s) · moldura {FRAME_TEMPLATES.find((f) => f.template === p.frame)?.name ?? "padrão"}
                      {p.date_label && ` · ${p.date_label}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-0.5">
                    <Button size="icon" variant="ghost" aria-label="Subir página" onClick={() => void move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Descer página" onClick={() => void move(i, 1)} disabled={i === pages.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={p.included ? "Excluir do PDF" : "Incluir no PDF"} title={p.included ? "Incluída no PDF" : "Fora do PDF"} onClick={() => void repo.update("album_pages", p.id, { included: !p.included })}>
                      {p.included ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Editar página" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Duplicar página" onClick={() => void duplicate(p)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600"
                      aria-label="Apagar página"
                      onClick={() => {
                        if (confirm("Apagar esta página do book? As fotos continuam na galeria.")) void repo.remove("album_pages", p.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <PageEditor page={editing} media={media} edits={edits} onClose={() => setEditing(null)} />
      <MediaPicker
        open={coverPicker}
        onClose={() => setCoverPicker(false)}
        media={media}
        multiple={false}
        title="Foto da capa"
        onPick={(ids) => void repo.update("trips", trip.id, { cover_media_id: ids[0] ?? null }).then(() => toast("Foto da capa definida."))}
      />
    </div>
  );
}
