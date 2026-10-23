"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookHeart, Plus, Trash2 } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { EmptyState, Loading, PageHeader } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useRows } from "@/lib/data/hooks";
import { getRepo } from "@/lib/data";
import { COVER_TEMPLATES } from "@/lib/album/pdf";
import { suggestPages } from "@/lib/album/auto";
import { fmtDateTime } from "@/lib/format";
import type { AlbumFormat, Trip } from "@/lib/types";

export default function BookListPage() {
  return <RequireTrip>{(trip) => <BookList trip={trip} />}</RequireTrip>;
}

const FORMATS: { id: AlbumFormat; label: string }[] = [
  { id: "A4", label: "A4 retrato" },
  { id: "quadrado", label: "Quadrado (21×21 cm)" },
  { id: "vertical", label: "Vertical (20×25 cm)" },
  { id: "horizontal", label: "Horizontal (A4 paisagem)" },
];

function BookList({ trip }: { trip: Trip }) {
  const toast = useToast();
  const router = useRouter();
  const { data: albums, loading } = useRows("albums", { trip_id: trip.id });
  const { data: pages } = useRows("album_pages", { trip_id: trip.id });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: trip.name.replace(/\s*\(DEMONSTRAÇÃO\)\s*/i, ""), subtitle: "", format: "A4" as AlbumFormat, cover: "revista", auto: true });
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const repo = getRepo();
      const album = await repo.insert("albums", {
        trip_id: trip.id,
        title: form.title.trim() || "Book da viagem",
        subtitle: form.subtitle.trim(),
        format: form.format,
        margin_mm: 12,
        gap_mm: 4,
        background: "#ffffff",
        frame: form.cover,
        include_cover: true,
        include_toc: true,
        include_itinerary: true,
        include_budget: false,
        include_diary: true,
        footer_text: `${trip.destination} · VIAJAR+`,
        page_numbers: true,
      });
      if (form.auto) {
        const [diary, media] = await Promise.all([repo.list("diary_entries", { trip_id: trip.id }), repo.list("media_assets", { trip_id: trip.id })]);
        const suggested = suggestPages(album, diary, media);
        if (suggested.length) await repo.insertMany("album_pages", suggested);
      }
      router.push(`/book/${album.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao criar", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este book? As fotos não são apagadas.")) return;
    const repo = getRepo();
    for (const p of pages.filter((x) => x.album_id === id)) await repo.remove("album_pages", p.id);
    await repo.remove("albums", id);
    toast("Book excluído.");
  }

  return (
    <div>
      <PageHeader
        eyebrow={trip.destination}
        title="Book da viagem"
        description="Monte um álbum com capa, sumário, roteiro, histórias e fotos, e exporte em PDF para imprimir ou compartilhar."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo book
          </Button>
        }
      />
      {loading && !albums.length ? (
        <Loading />
      ) : !albums.length ? (
        <EmptyState icon={<BookHeart />} title="Nenhum book criado" action={<Button onClick={() => setOpen(true)}>Criar o book desta viagem</Button>}>
          Podemos montar as páginas automaticamente a partir do diário e das fotos favoritas e instagramáveis — depois é só ajustar.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((a) => {
            const n = pages.filter((p) => p.album_id === a.id).length;
            return (
              <li key={a.id}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <Link href={`/book/${a.id}`} className="block bg-gradient-to-br from-glacier-700 to-glacier-900 p-6 text-white">
                    <div className="text-xs uppercase tracking-[0.2em] opacity-80">{trip.destination}</div>
                    <div className="mt-2 font-display text-2xl font-bold">{a.title}</div>
                    {a.subtitle && <div className="mt-1 text-sm opacity-90">{a.subtitle}</div>}
                  </Link>
                  <div className="flex flex-1 items-center gap-2 p-4 text-sm">
                    <Badge>{FORMATS.find((f) => f.id === a.format)?.label}</Badge>
                    <span className="text-muted">{n} página(s)</span>
                    <span className="ml-auto text-xs text-muted">{fmtDateTime(a.updated_at)}</span>
                    <Button size="icon" variant="ghost" className="text-red-600" aria-label={`Excluir ${a.title}`} onClick={() => void remove(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Modal open={open} onOpenChange={setOpen} title="Novo book" description="Você poderá mudar tudo depois.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Field label="Título">{(p) => <Input {...p} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
          <Field label="Subtítulo">{(p) => <Input {...p} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Formato">
              {(p) => (
                <Select {...p} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as AlbumFormat })}>
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Modelo de capa">
              {(p) => (
                <Select {...p} value={form.cover} onChange={(e) => setForm({ ...form, cover: e.target.value })}>
                  {COVER_TEMPLATES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Checkbox label="Gerar páginas automaticamente a partir do diário e das fotos favoritas/instagramáveis" checked={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.checked })} />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>
              Criar book
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
