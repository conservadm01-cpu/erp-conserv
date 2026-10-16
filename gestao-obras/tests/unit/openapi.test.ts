import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { openApiDocument } from "@/server/openapi";

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? routeFiles(full) : f === "route.ts" ? [full] : [];
  });
}

describe("documentação OpenAPI", () => {
  const apiDir = path.resolve(__dirname, "../../src/app/api");
  it("descreve todas as rotas e métodos implementados", () => {
    const missing: string[] = [];
    for (const file of routeFiles(apiDir)) {
      const rel = path.relative(path.resolve(apiDir, ".."), path.dirname(file)).split(path.sep).join("/");
      const apiPath = `/${rel}`.replace(/\[(\w+)\]/g, "{$1}");
      const src = readFileSync(file, "utf8");
      const methods = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]!.toLowerCase());
      const doc = (openApiDocument.paths as Record<string, Record<string, unknown>>)[apiPath];
      for (const m of methods) if (!doc?.[m]) missing.push(`${m.toUpperCase()} ${apiPath}`);
    }
    expect(missing).toEqual([]);
  });
});
