import { describe, expect, it } from "vitest";
import { findApprovalTransition, findManualTransition, manualTransitionsFrom, TRANSITIONS } from "@/server/domain/work-state";
import { sanitizeFileName, sniffFileType } from "@/server/storage/file-type";
import { signDownloadToken, verifyDownloadToken } from "@/server/storage/download-token";
import { ruleApplies } from "@/server/services/requirement.service";

describe("máquina de estados das obras", () => {
  it("toda transição tem rótulo e não há ações duplicadas no mesmo estado", () => {
    const keys = TRANSITIONS.map((t) => `${t.from}:${t.action}:${t.mode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("aprovar só existe como decisão de aprovação", () => {
    expect(findManualTransition("EM_APROVACAO", "aprovar")).toBeUndefined();
    expect(findApprovalTransition("EM_APROVACAO", "APROVAR")?.to).toBe("APROVADA");
    expect(findApprovalTransition("EM_VISTORIA", "APROVAR")?.to).toBe("CONCLUIDA");
    expect(findApprovalTransition("EM_VISTORIA", "REJEITAR")?.to).toBe("EM_EXECUCAO");
  });
  it("estados finais não aceitam alterações manuais além de arquivar/reabrir", () => {
    expect(manualTransitionsFrom("ARQUIVADA")).toEqual([]);
    expect(manualTransitionsFrom("CONCLUIDA").map((t) => t.action).sort()).toEqual(["arquivar", "reabrir"]);
  });
  it("suspensão e retomada exigem justificativa", () => {
    expect(findManualTransition("EM_EXECUCAO", "suspender")?.requiresReason).toBe(true);
    expect(findManualTransition("SUSPENSA", "retomar")?.requiresReason).toBe(true);
  });
});

describe("arquivos", () => {
  it("identifica o tipo pelo conteúdo", () => {
    expect(sniffFileType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffFileType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("MZ"))).toBeNull();
  });
  it("normaliza nomes e força a extensão real", () => {
    expect(sanitizeFileName("../../segredo.exe", "application/pdf")).toBe(".._.._segredo.pdf");
    expect(sanitizeFileName("relatório final.PDF", "application/pdf")).toBe("relatório final.pdf");
    expect(sanitizeFileName("", "image/png")).toBe("arquivo.png");
  });
  it("token de download expira e não aceita adulteração", () => {
    const p = { k: "obras/x/y", n: "a.pdf", m: "application/pdf", u: "user-1" };
    const tok = signDownloadToken(p, 60, 1_000_000);
    expect(verifyDownloadToken(tok, 1_000_000 + 30_000)).toMatchObject(p);
    expect(verifyDownloadToken(tok, 1_000_000 + 61_000)).toBeNull();
    const [body, sig] = tok.split(".");
    const forged = Buffer.from(JSON.stringify({ ...p, u: "outro", exp: 9e9 })).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyDownloadToken(`${body}.x`)).toBeNull();
  });
});

describe("aplicabilidade de regras", () => {
  const work = { typeCode: "REFORMA", activities: ["TRABALHO_ALTURA"], executionMode: "VOLUNTARIOS" as const };
  const rule = (r: Partial<Parameters<typeof ruleApplies>[0]>) => ({ workTypes: [], activities: [], executionModes: [], status: "VALIDADA" as const, ...r });
  it("listas vazias significam qualquer valor", () => expect(ruleApplies(rule({}), work)).toBe(true));
  it("filtra por tipo, atividade e forma de execução", () => {
    expect(ruleApplies(rule({ activities: ["ELETRICIDADE"] }), work)).toBe(false);
    expect(ruleApplies(rule({ activities: ["ELETRICIDADE", "TRABALHO_ALTURA"] }), work)).toBe(true);
    expect(ruleApplies(rule({ workTypes: ["CONSTRUCAO"] }), work)).toBe(false);
    expect(ruleApplies(rule({ executionModes: ["EMPRESA_CONTRATADA"] }), work)).toBe(false);
    expect(ruleApplies(rule({ status: "INATIVA" }), work)).toBe(false);
  });
});
