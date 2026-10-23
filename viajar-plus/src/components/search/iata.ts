/** Extrai um código IATA entre parênteses, ex.: "São Paulo — Guarulhos (GRU)" → "GRU". */
export function iataFrom(text: string): string {
  const m = /\(([A-Z]{3})\)/.exec(text ?? "") ?? /\b([A-Z]{3})\b/.exec(text ?? "");
  return m ? m[1] : "";
}

// Sugestões comuns (não exaustivo) para destinos sem IATA no nome.
const KNOWN: Record<string, string> = {
  "el calafate": "FTE",
  ushuaia: "USH",
  bariloche: "BRC",
  "buenos aires": "EZE",
  mendoza: "MDZ",
  santiago: "SCL",
  "punta arenas": "PUQ",
  "sao paulo": "GRU",
  "rio de janeiro": "GIG",
  lisboa: "LIS",
  paris: "CDG",
  madrid: "MAD",
  orlando: "MCO",
  miami: "MIA",
  "nova york": "JFK",
};

export function guessIata(text: string): string {
  const direct = iataFrom(text);
  if (direct) return direct;
  const n = (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hit = Object.keys(KNOWN).find((k) => n.includes(k));
  return hit ? KNOWN[hit] : "";
}
