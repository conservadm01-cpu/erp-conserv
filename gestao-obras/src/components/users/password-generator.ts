/** Gera uma senha provisória forte no navegador (Web Crypto). */
export function generateTemporaryPassword(length = 16): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?-_"];
  const all = sets.join("");
  const rand = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! % n;
  };
  const chars = sets.map((s) => s[rand(s.length)]!);
  while (chars.length < length) chars.push(all[rand(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
