"use client";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { getRepo } from "@/lib/data";
import { useRows } from "@/lib/data/hooks";
import { answersToPatch, buildQuestions, itineraryTitlesForDate, photoDate, visibleQuestions, type AnswerPatch } from "@/lib/media/questions";
import { saveStoriesToDiary } from "@/lib/media/story";
import type { MediaAsset, Trip } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { MediaThumb } from "./media-thumb";
import { cn } from "@/lib/cn";

/** Assistente "Registre o melhor do momento": perguntas contextuais para cada foto nova. */
export function StoryWizard({ trip, assets, open, onClose }: { trip: Trip; assets: MediaAsset[]; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: days } = useRows("itinerary_days", { trip_id: trip.id });
  const { data: items } = useRows("itinerary_items", { trip_id: trip.id });
  const photos = useMemo(() => assets.filter((a) => a.kind === "image"), [assets]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ asset: MediaAsset; patch: AnswerPatch }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setIdx(0);
      setAnswers({});
      setSaved([]);
    }
  }, [open]);

  const asset = photos[idx];
  const set = useMemo(() => {
    if (!asset) return null;
    const date = photoDate(asset);
    const day = days.find((d) => d.date === date);
    return buildQuestions({
      taken_at: asset.taken_at,
      trip_start: trip.start_date,
      trip_end: trip.end_date,
      destination: trip.destination,
      itinerary_titles: itineraryTitlesForDate(items, day?.id ?? null),
    });
  }, [asset, days, items, trip]);

  if (!asset || !set) return null;
  const qs = visibleQuestions(set.questions, answers);
  const isLast = idx >= photos.length - 1;

  async function persist(): Promise<{ asset: MediaAsset; patch: AnswerPatch } | null> {
    const patch = answersToPatch(set!.questions, answers, asset);
    if (!patch.story_answers.length) return null;
    const { story_answers, caption, people, tags, instagrammable } = patch;
    const updated = await getRepo().update("media_assets", asset.id, {
      story_answers: [...asset.story_answers, ...story_answers],
      ...(caption ? { caption } : {}),
      ...(people ? { people } : {}),
      ...(tags ? { tags } : {}),
      ...(instagrammable !== undefined ? { instagrammable } : {}),
      ...(patch.place ? { album: asset.album || patch.place } : {}),
    });
    return { asset: updated, patch };
  }

  async function next(toDiary = false) {
    setBusy(true);
    try {
      const r = await persist();
      const all = r ? [...saved, r] : saved;
      setSaved(all);
      if (toDiary && all.length) {
        const byDate = new Map<string, typeof all>();
        all.forEach((s) => byDate.set(photoDate(s.asset), [...(byDate.get(photoDate(s.asset)) ?? []), s]));
        for (const [date, list] of byDate) {
          await saveStoriesToDiary(
            trip,
            date,
            list.map((s) => ({ asset: s.asset, caption: s.patch.caption, answers: s.patch.story_answers, place: s.patch.place, rating: s.patch.rating })),
          );
        }
        toast(`Momentos salvos no diário (${byDate.size} dia${byDate.size > 1 ? "s" : ""}).`);
        onClose();
        return;
      }
      if (isLast) {
        if (all.length) toast("Momentos registrados nas fotos.");
        onClose();
      } else {
        setIdx((i) => i + 1);
        setAnswers({});
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao salvar", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-sunset-500" aria-hidden /> Registre o melhor do momento
        </span>
      }
      description={`Foto ${idx + 1} de ${photos.length} · ${set.heading}${asset.taken_at ? ` · ${fmtDate(asset.taken_at)}` : ""}`}
    >
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <MediaThumb asset={asset} className="aspect-square w-full rounded-xl md:w-[220px]" />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void next(false);
          }}
        >
          {qs.map((q) => (
            <fieldset key={q.id} className="space-y-1.5">
              <legend className="text-sm font-medium">{q.text}</legend>
              {q.kind === "text" && (
                <Textarea rows={2} className="min-h-0" placeholder={q.placeholder} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
              {q.kind === "people" && <Input placeholder={q.placeholder} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />}
              {(q.kind === "choice" || q.kind === "yesno") && (
                <div className="flex flex-wrap gap-2">
                  {(q.kind === "yesno" ? ["Sim", "Não"] : q.options ?? []).map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={answers[q.id] === o}
                      onClick={() => setAnswers({ ...answers, [q.id]: answers[q.id] === o ? "" : o })}
                      className={cn("rounded-full border px-3 py-1 text-sm", answers[q.id] === o ? "border-accent bg-accent text-accent-fg" : "border-line hover:bg-surface-2")}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {q.kind === "rating" && (
                <div className="flex gap-1" role="radiogroup" aria-label={q.text}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === String(n)}
                      aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                      onClick={() => setAnswers({ ...answers, [q.id]: String(n) })}
                    >
                      <Star className={cn("h-6 w-6", Number(answers[q.id]) >= n ? "fill-amber-400 text-amber-400" : "text-muted")} />
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          ))}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => (isLast ? onClose() : (setIdx(idx + 1), setAnswers({})))} disabled={busy}>
              Pular
            </Button>
            <Button variant="outline" onClick={() => void next(true)} loading={busy}>
              Salvar no diário do dia
            </Button>
            <Button type="submit" loading={busy}>
              {isLast ? "Concluir" : "Próxima foto"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
