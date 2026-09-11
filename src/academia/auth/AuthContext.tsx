import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Employee, ID, Role, User } from "../core/types";
import { auditRepo, peopleRepo } from "../data/repositories";
import { verifyPassword } from "./password";
import { can, type Permission } from "./permissions";
import { nowIso } from "../core/dates";
import { useDbVersion } from "../state/useCollection";

const SESSION_KEY = "academia:session:v1";

interface SessionData {
  userId: ID;
  at: string;
}

interface AuthValue {
  user: User | null;
  employee: Employee | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (login: string, password: string) => { ok: boolean; error?: string };
  loginAs: (userId: ID) => boolean;
  logout: () => void;
  can: (permission: Permission) => boolean;
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): SessionData | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

function writeSession(session: SessionData | null) {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sessão em memória apenas (navegação privada, storage bloqueado).
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(() => readSession());
  useDbVersion();

  const user = session ? peopleRepo.users().find((u) => u.id === session.userId && u.active) ?? null : null;
  const employee = user ? peopleRepo.employee(user.employeeId) ?? null : null;

  const login = useCallback((loginName: string, password: string) => {
    const found = peopleRepo.userByLogin(loginName.trim());
    if (!found || !found.active) return { ok: false, error: "Usuário não encontrado." };
    if (!verifyPassword(password, found.passwordHash)) return { ok: false, error: "Senha incorreta." };
    peopleRepo.saveUser({ ...found, lastLoginAt: nowIso() });
    const next = { userId: found.id, at: nowIso() };
    writeSession(next);
    setSession(next);
    auditRepo.log({ actorId: found.employeeId, actorName: peopleRepo.employee(found.employeeId)?.name ?? found.login, action: "auth.login", entity: "user", entityId: found.id });
    return { ok: true };
  }, []);

  const loginAs = useCallback((userId: ID) => {
    const found = peopleRepo.users().find((u) => u.id === userId);
    if (!found) return false;
    const next = { userId, at: nowIso() };
    writeSession(next);
    setSession(next);
    auditRepo.log({ actorId: found.employeeId, actorName: peopleRepo.employee(found.employeeId)?.name ?? found.login, action: "auth.login_demo", entity: "user", entityId: userId });
    return true;
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  const completeOnboarding = useCallback(() => {
    if (!employee) return;
    peopleRepo.patchEmployee(employee.id, { onboardedAt: nowIso() });
  }, [employee]);

  const value = useMemo<AuthValue>(() => ({
    user,
    employee,
    role: user?.role ?? null,
    isAuthenticated: !!user && !!employee,
    login,
    loginAs,
    logout,
    can: (permission: Permission) => can(user?.role, permission),
    completeOnboarding,
  }), [user, employee, login, loginAs, logout, completeOnboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return value;
}

/** Atalho: colaborador logado (lança erro se a tela exigir login). */
export function useCurrentEmployee(): Employee {
  const { employee } = useAuth();
  if (!employee) throw new Error("Tela exige colaborador autenticado");
  return employee;
}
