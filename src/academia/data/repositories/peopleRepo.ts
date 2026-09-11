import { db } from "../db";
import type { Department, Employee, ID, JobRole, User } from "../../core/types";
import { normalize } from "../../core/text";

export const peopleRepo = {
  employees(): readonly Employee[] {
    return db.list("employees");
  },
  activeEmployees(): Employee[] {
    return db.filter("employees", (e) => e.status === "ativo");
  },
  employee(id?: ID): Employee | undefined {
    return db.byId("employees", id);
  },
  employeeByCode(code: string): Employee | undefined {
    return db.find("employees", (e) => normalize(e.code) === normalize(code));
  },
  searchEmployees(term: string): Employee[] {
    const q = normalize(term.trim());
    if (!q) return [...this.employees()];
    return db.filter("employees", (e) => normalize(e.name).includes(q) || normalize(e.code).includes(q) || normalize(e.cargo).includes(q));
  },
  saveEmployee(employee: Employee): Employee {
    return db.put("employees", employee);
  },
  patchEmployee(id: ID, changes: Partial<Employee>): Employee | undefined {
    return db.patch("employees", id, changes);
  },
  departments(): readonly Department[] {
    return db.list("departments");
  },
  department(id?: ID): Department | undefined {
    return db.byId("departments", id);
  },
  departmentName(id?: ID): string {
    return this.department(id)?.name ?? "—";
  },
  jobRoles(): readonly JobRole[] {
    return db.list("job_roles");
  },
  jobRole(id?: ID): JobRole | undefined {
    return db.byId("job_roles", id);
  },
  jobRoleName(id?: ID): string {
    return this.jobRole(id)?.name ?? "—";
  },
  jobRolesOfDepartment(departmentId: ID): JobRole[] {
    return db.filter("job_roles", (r) => r.departmentId === departmentId);
  },
  users(): readonly User[] {
    return db.list("users");
  },
  userByLogin(login: string): User | undefined {
    const q = normalize(login.trim());
    return db.find("users", (u) => normalize(u.login) === q);
  },
  userOfEmployee(employeeId: ID): User | undefined {
    return db.find("users", (u) => u.employeeId === employeeId);
  },
  saveUser(user: User): User {
    return db.put("users", user);
  },
  teamOf(supervisorId: ID): Employee[] {
    return db.filter("employees", (e) => e.supervisorId === supervisorId);
  },
};
