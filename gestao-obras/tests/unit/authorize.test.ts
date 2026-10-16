import { describe, expect, it } from "vitest";
import { can, canAnywhere, grantsFor, pathWhere, permissionsAt, scopeCovers, type Actor, type ActorScope } from "@/server/authz/authorize";

const scope = (unitPath: string, permissions: string[], includeDescendants = true): ActorScope => ({
  scopeId: unitPath, roleId: "r", roleCode: "R", roleName: "R", unitId: "u", unitName: "U", unitPath, includeDescendants, workId: null, permissions,
});
const actor = (...scopes: ActorScope[]): Actor => ({ userId: "x", email: "x@exemplo.test", name: "X", sessionId: "s", homeUnitId: "h", homeUnitPath: "/root/", scopes });

describe("autorização por escopo", () => {
  it("permissão vale para a unidade e descendentes", () => {
    const a = actor(scope("/root/regA/", ["org.read"]));
    expect(can(a, "org.read", "/root/regA/")).toBe(true);
    expect(can(a, "org.read", "/root/regA/c1/")).toBe(true);
    expect(can(a, "org.read", "/root/regB/")).toBe(false);
    expect(can(a, "org.read", "/root/")).toBe(false);
    expect(can(a, "org.manage", "/root/regA/")).toBe(false);
  });

  it("não confunde prefixos de nomes parecidos", () => {
    expect(scopeCovers({ unitPath: "/root/reg1/", includeDescendants: true }, "/root/reg10/")).toBe(false);
  });

  it("escopo sem descendentes vale só para a própria unidade", () => {
    const a = actor(scope("/root/regA/", ["org.read"], false));
    expect(can(a, "org.read", "/root/regA/")).toBe(true);
    expect(can(a, "org.read", "/root/regA/c1/")).toBe(false);
  });

  it("combina permissões de escopos que cobrem a unidade", () => {
    const a = actor(scope("/root/", ["org.read"]), scope("/root/regA/", ["user.manage"]));
    expect([...permissionsAt(a, "/root/regA/c1/")].sort()).toEqual(["org.read", "user.manage"]);
    expect([...permissionsAt(a, "/root/regB/")]).toEqual(["org.read"]);
    expect(canAnywhere(a, "user.manage")).toBe(true);
    expect(canAnywhere(a, "audit.read")).toBe(false);
  });

  it("remove escopos redundantes ao montar filtros", () => {
    const a = actor(scope("/root/regA/", ["org.read"]), scope("/root/regA/c1/", ["org.read"]), scope("/root/regA/", ["org.read"], false), scope("/root/regB/c2/", ["org.read"], false));
    expect(grantsFor(a, "org.read")).toEqual([
      { path: "/root/regA/", includeDescendants: true },
      { path: "/root/regB/c2/", includeDescendants: false },
    ]);
    expect(pathWhere(a, "org.read")).toEqual({ OR: [{ path: { startsWith: "/root/regA/" } }, { path: { equals: "/root/regB/c2/" } }] });
    expect(pathWhere(a, "audit.read")).toBeNull();
  });
});
