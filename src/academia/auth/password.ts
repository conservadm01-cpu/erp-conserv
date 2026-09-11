// =====================================================================
// AUTHENTICATION — ponto de troca
// ---------------------------------------------------------------------
// Este hash é apenas um marcador de senha para o protótipo: ele NÃO é
// criptografia forte e não protege dados sensíveis. Em produção,
// substitua por Supabase Auth (e-mail/senha ou SSO) ou por uma API
// própria com bcrypt/argon2 no servidor. O resto do sistema fala apenas
// com auth/AuthContext, então a troca fica contida aqui.
// =====================================================================

export function hashPassword(plain: string): string {
  const normalized = plain.normalize("NFKC");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    h1 = (h1 ^ code) >>> 0;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 + code * (i + 7)) >>> 0;
    h2 = (h2 ^ (h2 << 5)) >>> 0;
  }
  return `pv1$${h1.toString(16)}${h2.toString(16)}`;
}

export function verifyPassword(plain: string, hash: string | null): boolean {
  if (!hash) return true; // colaborador sem senha definida (acesso por matrícula)
  return hashPassword(plain) === hash;
}
