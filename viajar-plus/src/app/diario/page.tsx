"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { BookOpen, CloudOff, ImagePlus, LocateFixed, Pencil, Plus, Receipt, RefreshCw, Star, Trash2 } from "lucide-react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader, EmptyState, Loading, Notice } from "@/components/ui/states";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useRows } from "@/lib/data/hooks";
import { getRepo, newId } from "@/lib/data";
import { diarySchema, type DiaryInput } from "@/lib/schemas";
import { draftsForTrip, resolveConflict, saveDraft, removeDraft, syncDrafts, type Conflict, type DiaryDraft } from "@/lib/diary/offline";
import { useMediaUrl } from "@/lib/media/use-media-url";
import { paymentBase } from "@/lib/budget/calc";
import { fetchFxRate } from "@/lib/fx-client";
import { CURRENCIES, dateRange, fmtDate, money, toISODate } from "@/lib/format";
import type { DiaryEntry, MediaAsset, Trip } from "@/lib/types";

type FormIn = z.input<typeof diarySchema>;

export default function DiarioPage() {
  return <RequireTrip>{(trip) => <Diary trip={trip} />}</RequireTrip>;
}

function Diary({ trip }: { trip: Trip }) {
  const where = { trip_id: trip.id };
  const entries = useRows("diary_entries", where);
  const travelers = useRows("travelers", where);
  const media = useRows("media_assets", where);
  const expenses = useRows("expenses", where);
  const payments = useRows("payments", where);
  const toast = useToast();
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [dayFilter, setDayFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [q, setQ] = useState("");
  const [drafts, setDrafts] = useState<DiaryDraft[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [online, setOnline] = useState(true);
  const [spending, setSpending] = useState<DiaryEntry | null>(null);
  const [attaching, setAttaching] = useState<DiaryEntry | null>(null);

  const refreshDrafts = () => setDrafts(draftsForTrip(trip.id));
  useEffect(() => {
    refreshDrafts();
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, open]);

  async function sync() {
    const r = await syncDrafts(getRepo(), trip.id);
    setConflicts(r.conflicts);
    refreshDrafts();
    if (r.synced) toast(`${r.synced} rascunho(s) sincronizado(s)`);
    if (r.conflicts.length) toast(`${r.conflicts.length} conflito(s) precisam da sua decisão`, "info");
    if (r.errors.length) toast(`Falha ao sincronizar: ${r.errors[0]}`, "error");
  }

  const tags = useMemo(() => [...new Set(entries.data.flatMap((e) => e.tags))], [entries.data]);
  const visible = useMemo(
    () =>
      entries.data
        .filter((e) => (!dayFilter || e.date === dayFilter) && (!authorFilter || e.author_traveler_id === authorFilter))
        .filter((e) => !q || `${e.title} ${e.body} ${e.location_name} ${e.tags.join(" ")} ${e.people.join(" ")}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [entries.data, dayFilter, authorFilter, q],
  );

  return (
    <>
      <PageHeader
        eyebrow="Diário da viagem"
        title="O que vocês viveram"
        description="Registre cada dia: texto, local, quem estava, avaliação, gastos e fotos. Funciona offline como rascunho e sincroniza depois."
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Novo registro</Button>}
      />

      {!online && <Notice tone="warn" className="mb-4" title="Você está offline">Os registros serão guardados como rascunho neste aparelho (somente texto; fotos e vídeos precisam de conexão) e sincronizados quando a internet voltar.</Notice>}
      {drafts.length > 0 && (
        <Notice tone="info" className="mb-4" title={`${drafts.length} rascunho(s) offline aguardando envio`}>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={sync} disabled={!online}><RefreshCw className="h-4 w-4" /> Sincronizar agora</Button>
            {drafts.map((d) => (
              <Badge key={d.local_id}>{d.data.title || "(sem título)"} · {fmtDate(d.saved_at)}</Badge>
            ))}
          </div>
        </Notice>
      )}
      {conflicts.map((c) => (
        <Notice key={c.draft.local_id} tone="warn" className="mb-4" title={`Conflito em “${c.server.title}”`}>
          <p>Este registro foi alterado por outra pessoa (ou em outro aparelho) depois que você começou a editá-lo offline. Nada foi sobrescrito. Escolha:</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div className="rounded-lg bg-surface p-2 text-xs"><strong>No servidor:</strong> {c.server.body.slice(0, 200)}</div>
            <div className="rounded-lg bg-surface p-2 text-xs"><strong>Sua versão:</strong> {c.draft.data.body.slice(0, 200)}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["local", "servidor", "juntar"] as const).map((choice) => (
              <Button
                key={choice}
                size="sm"
                variant="outline"
                onClick={async () => {
                  await resolveConflict(getRepo(), c, choice);
                  setConflicts((l) => l.filter((x) => x !== c));
                  refreshDrafts();
                }}
              >
                {choice === "local" ? "Manter a minha" : choice === "servidor" ? "Manter a do servidor" : "Juntar os textos"}
              </Button>
            ))}
          </div>
        </Notice>
      ))}

      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Buscar no diário…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar no diário" />
        <Select className="w-auto" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} aria-label="Filtrar por dia">
          <option value="">Todos os dias</option>
          {dateRange(trip.start_date, trip.end_date).map((d, i) => <option key={d} value={d}>Dia {i + 1} · {fmtDate(d, { day: "2-digit", month: "short" })}</option>)}
        </Select>
        <Select className="w-auto" value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)} aria-label="Filtrar por participante">
          <option value="">Todos os participantes</option>
          {travelers.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        {tags.slice(0, 8).map((t) => (
          <button key={t} className="rounded-full border border-line px-3 text-sm hover:bg-surface-2" onClick={() => setQ(t)}>#{t}</button>
        ))}
      </div>

      {entries.loading && !entries.data.length ? (
        <Loading />
      ) : !visible.length ? (
        <EmptyState icon={<BookOpen />} title={entries.data.length ? "Nada encontrado com esses filtros" : "Diário em branco"} action={<Button onClick={() => { setEditing(null); setOpen(true); }}>Escrever o primeiro registro</Button>}>
          Dica: ao subir fotos em “Fotos e vídeos”, o VIAJAR+ faz perguntas sobre o momento e pode criar o registro do dia para você.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {visible.map((e) => (
            <EntryCard
              key={e.id}
              trip={trip}
              entry={e}
              author={travelers.data.find((t) => t.id === e.author_traveler_id)?.name}
              photos={media.data.filter((m) => m.diary_entry_id === e.id)}
              spent={expenses.data
                .filter((x) => x.diary_entry_id === e.id)
                .map((x) => ({ id: x.id, description: x.description, value: payments.data.filter((p) => p.expense_id === x.id).reduce((s, p) => s + paymentBase(p), 0) }))}
              onEdit={() => { setEditing(e); setOpen(true); }}
              onSpend={() => setSpending(e)}
              onAttach={() => setAttaching(e)}
            />
          ))}
        </div>
      )}

      <DiaryForm trip={trip} entry={editing} open={open} onOpenChange={setOpen} travelers={travelers.data} />
      {spending && <SpendDialog trip={trip} entry={spending} onClose={() => setSpending(null)} />}
      {attaching && <AttachDialog entry={attaching} media={media.data} onClose={() => setAttaching(null)} />}
    </>
  );
}

function EntryCard({
  trip, entry, author, photos, spent, onEdit, onSpend, onAttach,
}: {
  trip: Trip; entry: DiaryEntry; author?: string; photos: MediaAsset[]; spent: { id: string; description: string; value: number }[];
  onEdit: () => void; onSpend: () => void; onAttach: () => void;
}) {
  const dayIndex = dateRange(trip.start_date, entry.date).length;
  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sunset-600 dark:text-sunset-400">
              {entry.date >= trip.start_date && entry.date <= trip.end_date ? `Dia ${dayIndex} · ` : ""}{fmtDate(entry.date, { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <h2 className="font-display text-2xl font-bold">{entry.title}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted">
              {entry.location_name && <span>📍 {entry.location_name}</span>}
              {author && <span>✍️ {author}</span>}
              {entry.mood && <span>· {entry.mood}</span>}
              {entry.rating != null && (
                <span className="flex items-center" aria-label={`Avaliação ${entry.rating} de 5`}>
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < (entry.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-line"}`} aria-hidden />)}
                </span>
              )}
              {entry.instagrammable && <Badge tone="orange">instagramável</Badge>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onAttach}><ImagePlus className="h-4 w-4" /> Fotos</Button>
            <Button size="sm" variant="outline" onClick={onSpend}><Receipt className="h-4 w-4" /> Gasto</Button>
            <Button size="icon" variant="ghost" aria-label="Editar registro" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={async () => {
              if (!confirm("Excluir este registro? As fotos continuam na galeria.")) return;
              for (const m of photos) await getRepo().update("media_assets", m.id, { diary_entry_id: null });
              await getRepo().remove("diary_entries", entry.id);
            }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        {entry.body && <p className="mt-3 whitespace-pre-line leading-relaxed">{entry.body}</p>}
        {entry.story_answers?.length > 0 && (
          <dl className="mt-3 space-y-1 border-l-2 border-sunset-400 pl-3 text-sm">
            {entry.story_answers.map((a, i) => (
              <div key={i}><dt className="text-muted">{a.question}</dt><dd>{a.answer}</dd></div>
            ))}
          </dl>
        )}
        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((m) => <PhotoThumb key={m.id} m={m} />)}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {entry.tags.map((t) => <Badge key={t} tone="blue">#{t}</Badge>)}
          {entry.people.map((p) => <Badge key={p}>👤 {p}</Badge>)}
          {spent.map((s) => <Badge key={s.id} tone="green">💸 {s.description}: {money(s.value, trip.currency)}</Badge>)}
        </div>
      </CardBody>
    </Card>
  );
}

function PhotoThumb({ m }: { m: MediaAsset }) {
  const url = useMediaUrl(m.thumb_path ?? (m.kind === "image" ? m.storage_path : null));
  return (
    <a href={`/midia/foto/${m.id}`} className="block aspect-square overflow-hidden rounded-lg bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt={m.caption || m.original_name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs text-muted">{m.kind}</span>}
    </a>
  );
}

function DiaryForm({ trip, entry, open, onOpenChange, travelers }: { trip: Trip; entry: DiaryEntry | null; open: boolean; onOpenChange: (v: boolean) => void; travelers: { id: string; name: string }[] }) {
  const toast = useToast();
  const localId = useRef(newId());
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const today = toISODate(new Date());
  const initial: DiaryInput = entry
    ? { date: entry.date, title: entry.title, body: entry.body, location_name: entry.location_name, rating: entry.rating, mood: entry.mood, tags: entry.tags, people: entry.people, author_traveler_id: entry.author_traveler_id, instagrammable: entry.instagrammable }
    : { date: today >= trip.start_date && today <= trip.end_date ? today : trip.start_date, title: "", body: "", location_name: "", rating: null, mood: "", tags: [], people: [], author_traveler_id: null, instagrammable: false };
  const { register, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<FormIn, unknown, DiaryInput>({ resolver: zodResolver(diarySchema), values: open ? initial : undefined, defaultValues: initial });

  useEffect(() => {
    if (open) {
      localId.current = newId();
      setCoords({ lat: entry?.lat ?? null, lng: entry?.lng ?? null });
    }
  }, [open, entry]);

  async function onSubmit(v: DiaryInput) {
    const data = { ...v, ...coords };
    try {
      if (!navigator.onLine && getRepo().mode === "supabase") throw new Error("offline");
      if (entry) await getRepo().update("diary_entries", entry.id, data);
      else await getRepo().insert("diary_entries", { ...data, trip_id: trip.id, story_answers: [], is_draft: false, base_updated_at: null });
      removeDraft(localId.current);
      toast("Registro salvo");
      onOpenChange(false);
    } catch {
      saveDraft({ local_id: localId.current, trip_id: trip.id, entry_id: entry?.id ?? null, base_updated_at: entry?.updated_at ?? null, data });
      toast("Sem conexão: guardado como rascunho offline neste aparelho", "info");
      onOpenChange(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={entry ? "Editar registro" : "Novo registro no diário"} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data" error={errors.date?.message as string}>{(p) => <Input type="date" {...p} {...register("date")} />}</Field>
          <Field label="Título" error={errors.title?.message as string} className="sm:col-span-2">{(p) => <Input {...p} {...register("title")} placeholder="Ex.: O dia em que o glaciar rugiu" />}</Field>
        </div>
        <Field label="Conte a história">{(p) => <Textarea rows={7} {...p} {...register("body")} placeholder="O que vocês viram, provaram, sentiram? Qual foi o melhor momento?" />}</Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Local" hint={coords.lat != null ? `GPS: ${coords.lat.toFixed(4)}, ${coords.lng?.toFixed(4)}` : "Opcional"}>
            {(p) => (
              <div className="flex gap-1">
                <Input {...p} {...register("location_name")} />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Usar minha localização atual"
                  title="Usar localização atual (só é salva se você confirmar)"
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition(
                      (pos) => {
                        if (confirm("Salvar sua localização atual neste registro? Ela só será visível para participantes da viagem.")) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      },
                      () => toast("Localização indisponível ou não autorizada", "info"),
                    )
                  }
                >
                  <LocateFixed className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Field>
          <Field label="Quem escreve">
            {(p) => (
              <Select {...p} {...register("author_traveler_id")}>
                <option value="">—</option>
                {travelers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Avaliação da experiência">
            {(p) => (
              <Select {...p} {...register("rating", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}>
                <option value="">Sem avaliação</option>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Humor">{(p) => <Input {...p} {...register("mood")} placeholder="ex.: encantados" />}</Field>
          <Field label="Etiquetas" hint="Separe por vírgula">
            {(p) => <Input {...p} defaultValue={getValues("tags")?.join(", ")} onChange={(e) => setValue("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />}
          </Field>
          <Field label="Pessoas" hint="Separe por vírgula">
            {(p) => <Input {...p} defaultValue={getValues("people")?.join(", ")} onChange={(e) => setValue("people", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />}
          </Field>
        </div>
        <Checkbox label="Lugar instagramável (destacar na linha do tempo e no book)" {...register("instagrammable")} />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-muted"><CloudOff className="h-3.5 w-3.5" /> Sem internet, o texto fica como rascunho neste aparelho.</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Salvar</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Gasto feito no dia: cria o item do orçamento já quitado e o pagamento correspondente (sem dupla contagem). */
function SpendDialog({ trip, entry, onClose }: { trip: Trip; entry: DiaryEntry; onClose: () => void }) {
  const toast = useToast();
  const cats = useRows("budget_categories", { trip_id: trip.id });
  const travelers = useRows("travelers", { trip_id: trip.id });
  const [form, setForm] = useState({ description: "", category_key: "alimentacao", amount: "", currency: trip.currency, fx_rate: "1", payer: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    const fx = Number(form.fx_rate);
    if (form.description.trim().length < 2 || !(amount > 0) || !(fx > 0)) return toast("Preencha descrição, valor e câmbio válidos", "error");
    setBusy(true);
    try {
      const repo = getRepo();
      const exp = await repo.insert("expenses", {
        trip_id: trip.id, category_key: form.category_key, description: form.description.trim(), supplier: entry.location_name, quantity: 1, unit_price: amount,
        original_currency: form.currency, fx_rate: fx, fees: 0, planned_amount: 0, quoted_amount: 0, reserved_amount: 0, due_date: null,
        responsible_traveler_id: form.payer || null, status: "pago", receipt_document_id: null, notes: `Registrado no diário: ${entry.title}`,
        split_mode: "todos", split: {}, quote_id: null, reservation_id: null, diary_entry_id: entry.id, incurred_on: entry.date,
      });
      await repo.insert("payments", { trip_id: trip.id, expense_id: exp.id, kind: "pagamento", amount, currency: form.currency, fx_rate: fx, paid_at: entry.date, payer_traveler_id: form.payer || null, method: "outro", notes: "", receipt_document_id: null });
      toast("Gasto registrado no orçamento");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Registrar gasto do dia" description="Entra no orçamento como item quitado, com o pagamento correspondente.">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Descrição" className="sm:col-span-2">{(p) => <Input {...p} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Jantar — cordeiro patagônico" />}</Field>
        <Field label="Categoria">{(p) => <Select {...p} value={form.category_key} onChange={(e) => set("category_key", e.target.value)}>{cats.data.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</Select>}</Field>
        <Field label="Quem pagou">{(p) => <Select {...p} value={form.payer} onChange={(e) => set("payer", e.target.value)}><option value="">—</option>{travelers.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
        <Field label="Valor">{(p) => <Input type="number" step="0.01" {...p} value={form.amount} onChange={(e) => set("amount", e.target.value)} />}</Field>
        <Field label="Moeda">
          {(p) => (
            <Select {...p} value={form.currency} onChange={async (e) => {
              const c = e.target.value;
              set("currency", c);
              if (c === trip.currency) return set("fx_rate", "1");
              try { set("fx_rate", String((await fetchFxRate(c, trip.currency)).rate.toFixed(6))); } catch { toast("Câmbio indisponível — informe manualmente", "info"); }
            }}>
              {[...new Set([trip.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
            </Select>
          )}
        </Field>
        <Field label={`Câmbio → ${trip.currency}`}>{(p) => <Input type="number" step="any" {...p} value={form.fx_rate} onChange={(e) => set("fx_rate", e.target.value)} />}</Field>
        <div className="flex items-end justify-end sm:col-span-2"><Button type="submit" loading={busy}>Registrar</Button></div>
      </form>
    </Modal>
  );
}

function AttachDialog({ entry, media, onClose }: { entry: DiaryEntry; media: MediaAsset[]; onClose: () => void }) {
  const candidates = media.filter((m) => m.diary_entry_id === entry.id || !m.diary_entry_id);
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Fotos e vídeos deste registro" description="Toque para vincular ou desvincular. Para subir novas, use “Fotos e vídeos”." size="lg">
      {!candidates.length ? (
        <p className="text-sm text-muted">Nenhuma mídia disponível. Envie fotos em “Fotos e vídeos”.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {candidates.map((m) => {
            const on = m.diary_entry_id === entry.id;
            return (
              <button
                key={m.id}
                aria-pressed={on}
                className={`relative overflow-hidden rounded-lg ring-offset-2 ring-offset-surface ${on ? "ring-2 ring-accent" : ""}`}
                onClick={() => getRepo().update("media_assets", m.id, { diary_entry_id: on ? null : entry.id })}
              >
                <PhotoInner m={m} />
                {on && <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 text-xs text-accent-fg">✓</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex justify-end"><Button onClick={onClose}>Concluir</Button></div>
    </Modal>
  );
}

function PhotoInner({ m }: { m: MediaAsset }) {
  const url = useMediaUrl(m.thumb_path ?? (m.kind === "image" ? m.storage_path : null));
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="aspect-square bg-surface-2">{url ? <img src={url} alt={m.caption || m.original_name} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs text-muted">{m.kind}</span>}</div>;
}
