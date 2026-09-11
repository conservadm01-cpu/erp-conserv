import { db } from "../db";
import type { Competency, EmployeeCompetency, ID } from "../../core/types";

export const competencyRepo = {
  all(): readonly Competency[] {
    return db.list("competencies");
  },
  get(id?: ID): Competency | undefined {
    return db.byId("competencies", id);
  },
  name(id?: ID): string {
    return this.get(id)?.name ?? id ?? "—";
  },
  byArea(): Map<string, Competency[]> {
    const map = new Map<string, Competency[]>();
    for (const c of this.all()) {
      const list = map.get(c.area) ?? [];
      list.push(c);
      map.set(c.area, list);
    }
    return map;
  },
  save(competency: Competency): Competency {
    return db.put("competencies", competency);
  },
  ofEmployee(employeeId: ID): EmployeeCompetency[] {
    return db.filter("employee_competencies", (c) => c.employeeId === employeeId);
  },
  entry(employeeId: ID, competencyId: ID): EmployeeCompetency | undefined {
    return db.find("employee_competencies", (c) => c.employeeId === employeeId && c.competencyId === competencyId);
  },
  saveEntry(entry: EmployeeCompetency): EmployeeCompetency {
    return db.put("employee_competencies", entry);
  },
  all_entries(): readonly EmployeeCompetency[] {
    return db.list("employee_competencies");
  },
};
