import bcrypt from "bcryptjs";

const COST = 12;

// Hash de uma senha aleatória, usado para equalizar o tempo de resposta
// quando o e-mail informado não existe.
const DUMMY_HASH = "$2b$12$IFHhkHGc8OxdXaed2FaLtuJa10/n1NmuVtUhRtPgv038oW8IkpaUa";

export const PASSWORD_MIN_LENGTH = 12;

const COMMON = new Set([
  "123456789012", "senha1234567", "password1234", "qwertyuiop12", "abcdefghijkl",
  "000000000000", "111111111111", "senhasenha12", "administrador", "congregacao1",
]);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && ok;
}

/** Retorna a lista de problemas encontrados (vazia = senha aceita). */
export function passwordPolicyIssues(password: string, ctx: { email?: string; name?: string } = {}): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (password.length > 128) issues.push("A senha deve ter no máximo 128 caracteres.");
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3) issues.push("Use ao menos três tipos: minúsculas, maiúsculas, números e símbolos.");
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) issues.push("Esta senha é muito comum.");
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) issues.push("A senha não pode conter o seu e-mail.");
  const firstName = ctx.name?.split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 4 && lower.includes(firstName)) issues.push("A senha não pode conter o seu nome.");
  if (/^(.)\1+$/.test(password)) issues.push("A senha não pode repetir um único caractere.");
  return issues;
}
