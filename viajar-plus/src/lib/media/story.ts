"use client";
import { getRepo } from "@/lib/data";
import type { DiaryEntry, MediaAsset, StoryAnswer, Trip } from "@/lib/types";
import { diaryBodyFrom } from "./questions";

/** Cria ou complementa a entrada do diário do dia com as respostas das fotos, e liga as fotos a ela. */
export async function saveStoriesToDiary(
  trip: Trip,
  date: string,
  items: { asset: MediaAsset; caption?: string; answers: StoryAnswer[]; place?: string; rating?: number }[],
): Promise<DiaryEntry> {
  const repo = getRepo();
  const sameDay = (await repo.list("diary_entries", { trip_id: trip.id })).filter((e) => e.date === date && !e.is_draft);
  const body = diaryBodyFrom(items.map((i) => ({ caption: i.caption, answers: i.answers })));
  const answers = items.flatMap((i) => i.answers);
  const people = [...new Set(items.flatMap((i) => i.asset.people))];
  const place = items.find((i) => i.place)?.place ?? "";
  const rating = items.find((i) => i.rating)?.rating ?? null;
  const insta = items.some((i) => i.asset.instagrammable);
  let entry: DiaryEntry;
  if (sameDay[0]) {
    const e = sameDay[0];
    entry = await repo.update("diary_entries", e.id, {
      body: e.body ? `${e.body}\n\n${body}` : body,
      story_answers: [...e.story_answers, ...answers],
      people: [...new Set([...e.people, ...people])],
      location_name: e.location_name || place,
      rating: e.rating ?? rating,
      instagrammable: e.instagrammable || insta,
    });
  } else {
    entry = await repo.insert("diary_entries", {
      trip_id: trip.id,
      date,
      title: place ? `Momentos em ${place}` : "Momentos do dia",
      body,
      location_name: place,
      lat: null,
      lng: null,
      author_traveler_id: null,
      rating,
      mood: "",
      tags: [],
      people,
      instagrammable: insta,
      story_answers: answers,
      is_draft: false,
      base_updated_at: null,
    });
  }
  for (const i of items) await repo.update("media_assets", i.asset.id, { diary_entry_id: entry.id });
  return entry;
}
