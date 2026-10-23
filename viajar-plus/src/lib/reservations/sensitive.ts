// Detecção simples de dados sensíveis que não devem ser guardados
// (números completos de cartão e senhas). Não substitui uma DLP, mas evita
// o erro mais comum: colar o cartão inteiro nas observações.

function luhn(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Retorna true se o texto contém sequência de 13–19 dígitos (com espaços/hífens) que passa no algoritmo de Luhn. */
export function containsCardNumber(text: string | null | undefined): boolean {
  if (!text) return false;
  const candidates = text.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return candidates.some((c) => {
    const digits = c.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && !/^(\d)\1+$/.test(digits) && luhn(digits);
  });
}

/** Detecta menções explícitas a senha/PIN/CVV seguidas de valor. */
export function containsPassword(text: string | null | undefined): boolean {
  if (!text) return false;
  return /\b(senha|password|pin|cvv|cvc|c[oó]digo de seguran[cç]a)\b\s*[:=]?\s*\S{3,}/i.test(text);
}

export function sensitiveDataError(...texts: (string | null | undefined)[]): string | null {
  if (texts.some(containsCardNumber)) return "Parece um número completo de cartão. Por segurança, não guarde dados de cartão — use apenas os 4 últimos dígitos, se precisar.";
  if (texts.some(containsPassword)) return "Não guarde senhas, PIN ou CVV no VIAJAR+. Use um gerenciador de senhas.";
  return null;
}
