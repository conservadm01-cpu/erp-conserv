// @vitest-environment node
// Ambiente Node: Blob/File nativos são clonáveis pelo IndexedDB (o Blob do jsdom não é).
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getFiles, getRepo } from "@/lib/data";
import { resetLocalDb } from "@/lib/data/local";
import { uploadMediaFiles, deleteMedia } from "@/lib/media/upload";
import { validateUpload, sniff } from "@/lib/media/validate";
import { saveEditVersion, deleteEditVersion } from "@/lib/photo/save";
import { defaultEditState, normalizeState } from "@/lib/photo/state";
import { saveStoriesToDiary } from "@/lib/media/story";
import type { Trip } from "@/lib/types";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') as Uint8Array<ArrayBuffer>;
const HTML = new TextEncoder().encode("<!doctype html><html><script>alert(1)</script></html>") as Uint8Array<ArrayBuffer>;

const file = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => new File([bytes], name, { type, lastModified: Date.UTC(2026, 11, 11, 19) });
const TRIP = "11111111-1111-4111-8111-111111111111";

async function blobBytes(b: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await new Response(b).arrayBuffer()));
}

describe("fluxo de mídia: upload → edição → exclusão", () => {
  beforeEach(async () => {
    await resetLocalDb();
  });

  it("detecta o tipo real pelo conteúdo", () => {
    expect(sniff(JPEG)?.mime).toBe("image/jpeg");
    expect(sniff(MP4)?.kind).toBe("video");
    expect(sniff(SVG)).toBeNull();
    expect(validateUpload("foto.svg", 100, SVG, ["image"]).ok).toBe(false);
  });

  it("aceita várias fotos/vídeos e recusa SVG, HTML disfarçado e arquivo vazio", async () => {
    const res = await uploadMediaFiles(TRIP, [
      file(JPEG, "glaciar.jpg", "image/jpeg"),
      file(JPEG, "lago.jpg", "image/jpeg"),
      file(MP4, "barco.mp4", "video/mp4"),
      file(SVG, "logo.svg", "image/svg+xml"),
      file(HTML, "foto.jpg", "image/jpeg"), // HTML disfarçado de JPG
      file(new Uint8Array(), "vazio.jpg", "image/jpeg"),
    ]);
    expect(res.ok.map((a) => a.original_name)).toEqual(["glaciar.jpg", "lago.jpg", "barco.mp4"]);
    expect(res.errors.map((e) => e.name)).toEqual(["logo.svg", "foto.jpg", "vazio.jpg"]);
    expect(res.ok[2].kind).toBe("video");
    expect(res.ok[0].lat).toBeNull(); // localização só com consentimento
    const stored = await getRepo().list("media_assets", { trip_id: TRIP });
    expect(stored).toHaveLength(3);
    expect(await blobBytes((await getFiles().get("media", res.ok[0].storage_path))!)).toEqual(Array.from(JPEG));
  });

  it("salva versão editada sem sobrescrever o original e exclui tudo junto", async () => {
    const [asset] = (await uploadMediaFiles(TRIP, [file(JPEG, "glaciar.jpg", "image/jpeg")])).ok;
    const st = { ...defaultEditState(), rotate: 90 as const, adjust: { ...defaultEditState().adjust, brightness: 15 } };
    const editedBytes = new Uint8Array([...JPEG.slice(0, 10), 9, 9, 9]);
    const edit = await saveEditVersion(asset, st, "Mais clara", "image/jpeg", 0.9, { blob: new Blob([editedBytes], { type: "image/jpeg" }), width: 30, height: 40 });

    expect(edit.output_path).not.toBe(asset.storage_path);
    expect(edit.output_path.startsWith(`${TRIP}/${asset.id}.edit-`)).toBe(true);
    expect(normalizeState(edit.operations)).toEqual(st); // edição reaplicável
    expect(await blobBytes((await getFiles().get("media", asset.storage_path))!)).toEqual(Array.from(JPEG)); // original intacto
    expect(await blobBytes((await getFiles().get("media", edit.output_path))!)).toEqual(Array.from(editedBytes));

    const second = await saveEditVersion(asset, defaultEditState(), "Outra", "image/png", 1, { blob: new Blob([JPEG]), width: 1, height: 1 });
    await deleteEditVersion(second);
    expect(await getFiles().get("media", second.output_path)).toBeNull();
    expect(await getRepo().list("photo_edits", { trip_id: TRIP })).toHaveLength(1);

    await deleteMedia(asset);
    expect(await getRepo().get("media_assets", asset.id)).toBeNull();
    expect(await getRepo().list("photo_edits", { trip_id: TRIP })).toHaveLength(0);
    expect(await getFiles().get("media", asset.storage_path)).toBeNull();
    expect(await getFiles().get("media", edit.output_path)).toBeNull();
  });

  it("respostas da foto vão para o diário do dia e ligam a foto à entrada", async () => {
    const [asset] = (await uploadMediaFiles(TRIP, [file(JPEG, "jantar.jpg", "image/jpeg")])).ok;
    const trip = { id: TRIP } as Trip;
    const answers = [{ question: "Qual sabor?", answer: "Cordeiro patagônico" }];
    const e1 = await saveStoriesToDiary(trip, "2026-12-11", [{ asset, caption: "Jantar", answers, place: "Mi Rancho", rating: 5 }]);
    expect(e1.title).toContain("Mi Rancho");
    expect(e1.body).toContain("Cordeiro patagônico");
    expect(e1.rating).toBe(5);
    expect((await getRepo().get("media_assets", asset.id))?.diary_entry_id).toBe(e1.id);
    const e2 = await saveStoriesToDiary(trip, "2026-12-11", [{ asset, caption: "Sobremesa", answers: [{ question: "E a sobremesa?", answer: "Calafate" }] }]);
    expect(e2.id).toBe(e1.id); // complementa a mesma entrada do dia
    expect(e2.body).toContain("Calafate");
    expect(e2.story_answers).toHaveLength(2);
  });
});
