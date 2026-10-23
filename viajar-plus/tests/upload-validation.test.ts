import { describe, expect, it } from "vitest";
import { readHeader, safeDisplayName, sniff, UPLOAD_LIMITS, validateUpload } from "@/lib/media/validate";

const pad = (b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)].slice(0, 32));
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const SAMPLES = {
  jpeg: pad([0xff, 0xd8, 0xff, 0xe0]),
  png: pad([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a]),
  webp: pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")]),
  heic: pad([0, 0, 0, 0x18, ...ascii("ftypheic")]),
  mp4: pad([0, 0, 0, 0x18, ...ascii("ftypisom")]),
  mov: pad([0, 0, 0, 0x14, ...ascii("ftypqt  ")]),
  webm: pad([0x1a, 0x45, 0xdf, 0xa3]),
  pdf: pad(ascii("%PDF-1.7")),
  mp3: pad(ascii("ID3")),
  svg: pad(ascii('<svg xmlns="http://www.w3.org/2000/svg">')),
  html: pad(ascii("<!DOCTYPE html><script>")),
  exe: pad([0x4d, 0x5a, 0x90, 0]),
};

describe("detecção por assinatura binária", () => {
  it.each([
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
    ["heic", "image/heic"],
    ["mp4", "video/mp4"],
    ["mov", "video/quicktime"],
    ["webm", "video/webm"],
    ["pdf", "application/pdf"],
    ["mp3", "audio/mpeg"],
  ] as const)("reconhece %s", (k, mime) => {
    expect(sniff(SAMPLES[k])?.mime).toBe(mime);
  });

  it("não reconhece SVG, HTML nem executável", () => {
    expect(sniff(SAMPLES.svg)).toBeNull();
    expect(sniff(SAMPLES.html)).toBeNull();
    expect(sniff(SAMPLES.exe)).toBeNull();
  });
});

describe("validateUpload", () => {
  const media = ["image", "video", "audio"] as const;

  it("aceita foto e vídeo válidos", () => {
    expect(validateUpload("glaciar.jpg", 5_000_000, SAMPLES.jpeg, [...media]).ok).toBe(true);
    expect(validateUpload("barco.mp4", 50_000_000, SAMPLES.mp4, [...media]).detected?.kind).toBe("video");
  });

  it("recusa SVG mesmo com conteúdo de imagem", () => {
    expect(validateUpload("logo.svg", 1000, SAMPLES.png, [...media]).ok).toBe(false);
  });

  it("recusa HTML renomeado para .jpg", () => {
    const r = validateUpload("foto.jpg", 1000, SAMPLES.html, [...media]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Formato não reconhecido/);
  });

  it("recusa executáveis e extensões perigosas", () => {
    expect(validateUpload("setup.exe", 1000, SAMPLES.exe, [...media]).ok).toBe(false);
    expect(validateUpload("foto.jpg", 1000, SAMPLES.exe, [...media]).ok).toBe(false);
    expect(validateUpload("x.html", 1000, SAMPLES.jpeg, [...media]).ok).toBe(false);
  });

  it("recusa arquivo vazio", () => {
    expect(validateUpload("vazio.jpg", 0, SAMPLES.jpeg, [...media]).error).toMatch(/vazio/);
  });

  it("recusa acima do limite", () => {
    const r = validateUpload("enorme.jpg", UPLOAD_LIMITS.image + 1, SAMPLES.jpeg, [...media]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/limite/);
  });

  it("restringe categorias: PDF não entra na galeria, mas entra em documentos", () => {
    expect(validateUpload("voucher.pdf", 1000, SAMPLES.pdf, [...media]).ok).toBe(false);
    expect(validateUpload("voucher.pdf", 1000, SAMPLES.pdf, ["document", "image"]).ok).toBe(true);
  });

  it("readHeader lê os primeiros bytes de um Blob", async () => {
    const h = await readHeader(new Blob([SAMPLES.png]));
    expect(sniff(h)?.ext).toBe("png");
  });

  it("safeDisplayName remove caminhos e caracteres perigosos", () => {
    expect(safeDisplayName('../../etc/<script>"a.jpg')).toBe(".._.._etc_scripta.jpg");
  });
});
