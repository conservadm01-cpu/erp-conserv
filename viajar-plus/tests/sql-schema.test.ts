import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Teste estático: o SQL das migrations precisa espelhar os tipos TypeScript
// (src/lib/types.ts) e toda tabela precisa ter RLS habilitado.

const root = path.resolve(__dirname, "..");
const types = readFileSync(path.join(root, "src/lib/types.ts"), "utf8");
const schema = readFileSync(path.join(root, "supabase/migrations/0001_schema.sql"), "utf8");
const rls = readFileSync(path.join(root, "supabase/migrations/0002_rls.sql"), "utf8");
const storage = readFileSync(path.join(root, "supabase/migrations/0003_storage.sql"), "utf8");

function interfaceFields(name: string): string[] {
  const m = types.match(new RegExp(`export interface ${name}(?: extends (\\w+))? \\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`interface ${name} não encontrada`);
  const own = [...m[2].matchAll(/^ {2}(\w+)\??:/gm)].map((x) => x[1]);
  return m[1] ? [...interfaceFields(m[1]), ...own] : own;
}

function tableMap(): Record<string, string> {
  const block = types.match(/export interface TableMap \{([\s\S]*?)\n\}/)![1];
  return Object.fromEntries([...block.matchAll(/^ {2}(\w+): (\w+);/gm)].map((x) => [x[1], x[2]]));
}

function sqlColumns(table: string): string[] {
  const m = schema.match(new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`));
  if (!m) throw new Error(`tabela ${table} não encontrada no SQL`);
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--") && !/^(constraint|unique|primary key|check)\b/i.test(l))
    .map((l) => l.split(/\s+/)[0]);
}

const map = tableMap();
const rlsTables = (rls.match(/foreach t in array array\[([\s\S]*?)\]/) ?? [])[1] ?? "";

describe("migrations SQL x tipos", () => {
  it("TableMap tem todas as tabelas esperadas", () => {
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(24);
  });

  for (const [table, iface] of Object.entries(map)) {
    it(`${table}: todas as colunas de ${iface} existem`, () => {
      const cols = sqlColumns(table);
      const missing = interfaceFields(iface).filter((f) => !cols.includes(f));
      expect(missing).toEqual([]);
    });

    it(`${table}: RLS habilitado`, () => {
      expect(rlsTables).toContain(`'${table}'`);
    });
  }

  it("tabelas de opções normalizadas existem e têm RLS", () => {
    for (const t of ["flight_options", "lodging_options", "rental_options"]) {
      expect(sqlColumns(t)).toContain("trip_id");
      expect(rlsTables).toContain(`'${t}'`);
    }
  });

  it("toda tabela criada no schema está na lista de RLS", () => {
    const created = [...schema.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
    expect(created.filter((t) => !rlsTables.includes(`'${t}'`))).toEqual([]);
  });

  it("buckets de mídia e documentos são privados", () => {
    expect(storage).toMatch(/\('media', 'media', false/);
    expect(storage).toMatch(/\('documents', 'documents', false/);
    expect(storage).not.toMatch(/image\/svg/);
  });

  it("pagamentos não guardam dados de cartão", () => {
    expect(sqlColumns("payments").some((c) => /card_number|cvv|cvc|password|senha/.test(c))).toBe(false);
  });
});
