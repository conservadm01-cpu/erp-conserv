"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Film, Heart, Images, LayoutGrid, Aperture, Search, Sparkles, Trash2 } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, EmptyState, Loading, Notice } from "@/components/ui/states";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useRows } from "@/lib/data/hooks";
import { getRepo } from "@/lib/data";
import { deleteMedia } from "@/lib/media/upload";
import { photoDate } from "@/lib/media/questions";
import { fmtDate } from "@/lib/format";
import type { MediaAsset, Trip } from "@/lib/types";
import { UploadZone } from "@/components/media/upload-zone";
import { MediaThumb } from "@/components/media/media-thumb";
import { MediaDetail } from "@/components/media/media-detail";
import { StoryWizard } from "@/components/media/story-wizard";
import { CollageDialog } from "@/components/media/collage-dialog";
import { cn } from "@/lib/cn";

export default function MediaPage() {
  return <RequireTrip>{(trip) => <Gallery trip={trip} />}</RequireTrip>;
}

interface Filters {
  q: string;
  kind: "" | "image" | "video" | "audio";
  album: string;
  person: string;
  date: string;
  favorites: boolean;
  insta: boolean;
}

function Gallery({ trip }: { trip: Trip }) {
  const toast = useToast();
  const { data: media, loading, error } = useRows("media_assets", { trip_id: trip.id });
  const [f, setF] = useState<Filters>({ q: "", kind: "", album: "", person: "", date: "", favorites: false, insta: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<MediaAsset | null>(null);
  const [story, setStory] = useState<MediaAsset[] | null>(null);
  const [collage, setCollage] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const albums = useMemo(() => [...new Set(media.map((m) => m.album).filter(Boolean))].sort(), [media]);
  const people = useMemo(() => [...new Set(media.flatMap((m) => m.people))].sort(), [media]);
  const dates = useMemo(() => [...new Set(media.map((m) => photoDate(m)))].sort(), [media]);

  const list = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return media
      .filter((m) => !f.kind || m.kind === f.kind)
      .filter((m) => !f.album || m.album === f.album)
      .filter((m) => !f.person || m.people.includes(f.person))
      .filter((m) => !f.date || photoDate(m) === f.date)
      .filter((m) => !f.favorites || m.favorite)
      .filter((m) => !f.insta || m.instagrammable)
      .filter((m) => !q || [m.caption, m.original_name, m.album, ...m.tags, ...m.people].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (a.taken_at ?? a.created_at).localeCompare(b.taken_at ?? b.created_at));
  }, [media, f]);

  const selAssets = media.filter((m) => selected.has(m.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function bulk(patch: Partial<MediaAsset>, msg: string) {
    for (const a of selAssets) await getRepo().update("media_assets", a.id, patch);
    toast(msg);
  }

  async function bulkDelete() {
    for (const a of selAssets) await deleteMedia(a);
    setSelected(new Set());
    setConfirmDel(false);
    toast("Mídias excluídas.");
  }

  const live = detail ? media.find((m) => m.id === detail.id) ?? null : null;

  return (
    <div>
      <PageHeader
        eyebrow={trip.destination}
        title="Fotos e vídeos"
        description="Guarde tudo, conte a história de cada clique e transforme os melhores momentos no book da viagem."
        actions={
          <>
            <LinkButton variant="outline" href="/midia/video">
              <Film className="h-4 w-4" /> Editor de vídeo
            </LinkButton>
            <LinkButton variant="accent" href="/book">
              <Images className="h-4 w-4" /> Book da viagem
            </LinkButton>
          </>
        }
      />
      <UploadZone
        tripId={trip.id}
        onUploaded={(assets) => {
          toast(`${assets.length} arquivo(s) enviado(s).`);
          const photos = assets.filter((a) => a.kind === "image");
          if (photos.length) setStory(photos);
        }}
      />

      <div className="mt-6 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Pesquisar mídia" placeholder="Pesquisar legenda, etiqueta, pessoa…" className="pl-9" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <Select aria-label="Tipo" className="w-auto" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Filters["kind"] })}>
          <option value="">Todos os tipos</option>
          <option value="image">Fotos</option>
          <option value="video">Vídeos</option>
          <option value="audio">Áudios</option>
        </Select>
        <Select aria-label="Álbum ou evento" className="w-auto" value={f.album} onChange={(e) => setF({ ...f, album: e.target.value })}>
          <option value="">Todos os álbuns</option>
          {albums.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select aria-label="Pessoa" className="w-auto" value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })}>
          <option value="">Todas as pessoas</option>
          {people.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Select aria-label="Data" className="w-auto" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })}>
          <option value="">Todas as datas</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {fmtDate(d)}
            </option>
          ))}
        </Select>
        <Button variant={f.favorites ? "primary" : "outline"} aria-pressed={f.favorites} onClick={() => setF({ ...f, favorites: !f.favorites })}>
          <Heart className="h-4 w-4" /> Favoritas
        </Button>
        <Button variant={f.insta ? "primary" : "outline"} aria-pressed={f.insta} onClick={() => setF({ ...f, insta: !f.insta })}>
          <Aperture className="h-4 w-4" /> Apertureáveis
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-14 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow">
          <span className="px-2 text-sm font-medium">{selected.size} selecionada(s)</span>
          <Button size="sm" variant="outline" onClick={() => void bulk({ favorite: true }, "Marcadas como favoritas.")}>
            <Heart className="h-4 w-4" /> Favoritar
          </Button>
          <Button size="sm" variant="outline" onClick={() => void bulk({ instagrammable: true }, "Marcadas como instagramáveis.")}>
            <Aperture className="h-4 w-4" /> Apertureável
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const name = prompt("Nome do álbum ou evento:");
              if (name?.trim()) void bulk({ album: name.trim().slice(0, 80) }, `Movidas para “${name.trim()}”.`);
            }}
          >
            Definir álbum
          </Button>
          <Button size="sm" variant="outline" disabled={selAssets.filter((a) => a.kind === "image").length < 2} onClick={() => setCollage(true)}>
            <LayoutGrid className="h-4 w-4" /> Colagem
          </Button>
          <Button size="sm" variant="outline" disabled={!selAssets.some((a) => a.kind === "image")} onClick={() => setStory(selAssets.filter((a) => a.kind === "image"))}>
            <Sparkles className="h-4 w-4" /> Registrar momentos
          </Button>
          {confirmDel ? (
            <>
              <Button size="sm" variant="danger" onClick={() => void bulkDelete()}>
                Confirmar exclusão
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="mt-5">
        {error && <Notice tone="error">{error}</Notice>}
        {loading && !media.length ? (
          <Loading rows={2} />
        ) : !media.length ? (
          <EmptyState icon={<Images />} title="Nenhuma foto ainda">
            Envie as primeiras fotos ou vídeos. A cada foto, vamos perguntar o que tornou aquele momento especial — e isso vira legenda, diário e book.
          </EmptyState>
        ) : !list.length ? (
          <EmptyState title="Nada encontrado com esses filtros" />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {list.map((m) => (
              <li key={m.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface">
                <button type="button" className="block w-full" onClick={() => setDetail(m)} aria-label={`Abrir ${m.caption || m.original_name}`}>
                  <MediaThumb asset={m} className="aspect-square w-full" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={selected.has(m.id)}
                  aria-label={selected.has(m.id) ? "Desmarcar" : "Selecionar"}
                  className={cn(
                    "absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-md border-2 border-white shadow transition",
                    selected.has(m.id) ? "bg-accent text-accent-fg" : "bg-black/30 text-transparent opacity-80 group-hover:opacity-100",
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void getRepo().update("media_assets", m.id, { favorite: !m.favorite })}
                  aria-pressed={m.favorite}
                  aria-label={m.favorite ? "Remover dos favoritos" : "Favoritar"}
                  className="absolute right-2 top-2 rounded-full bg-black/30 p-1 text-white"
                >
                  <Heart className={cn("h-4 w-4", m.favorite && "fill-red-500 text-red-500")} />
                </button>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs">{m.caption || <span className="text-muted">{fmtDate(m.taken_at ?? m.created_at)}</span>}</span>
                  {m.instagrammable && (
                    <Badge tone="violet" className="px-1.5">
                      <Aperture className="h-3 w-3" />
                      <span className="sr-only">Apertureável</span>
                    </Badge>
                  )}
                  {m.kind === "image" && (
                    <Link href={`/midia/foto/${m.id}`} className="text-xs text-accent hover:underline">
                      Editar
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MediaDetail
        asset={live}
        onClose={() => setDetail(null)}
        onAskStory={(a) => {
          setDetail(null);
          setStory([a]);
        }}
      />
      {story && <StoryWizard trip={trip} assets={story} open={!!story} onClose={() => setStory(null)} />}
      <CollageDialog open={collage} onClose={() => setCollage(false)} assets={selAssets} tripId={trip.id} />
    </div>
  );
}
