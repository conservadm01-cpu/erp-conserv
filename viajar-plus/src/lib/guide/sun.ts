// Nascer/pôr do sol e "horário dourado" calculados localmente (algoritmo da NOAA,
// precisão de ~1–2 minutos). Não depende de API externa.

const rad = Math.PI / 180;

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Instantes em UTC do nascer e pôr do sol para a data (YYYY-MM-DD) e coordenadas. null = sol da meia-noite / noite polar. */
export function sunTimes(isoDate: string, lat: number, lng: number): { sunrise: Date; sunset: Date } | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12) - (lng / 15) * 3_600_000);
  const n = julianDay(noonUtc) - 2451545.0;
  const M = (357.5291 + 0.98560028 * n) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + n + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const decl = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) / rad / 360;
  const toDate = (jd: number) => new Date((jd - 2440587.5) * 86_400_000);
  return { sunrise: toDate(transit - H), sunset: toDate(transit + H) };
}

export interface GoldenHours {
  sunrise: Date;
  sunset: Date;
  morningEnd: Date; // fim do horário dourado da manhã (~1h após o nascer)
  eveningStart: Date; // início do horário dourado da tarde (~1h antes do pôr)
}

export function goldenHours(isoDate: string, lat: number, lng: number): GoldenHours | null {
  const t = sunTimes(isoDate, lat, lng);
  if (!t) return null;
  return { ...t, morningEnd: new Date(t.sunrise.getTime() + 3_600_000), eveningStart: new Date(t.sunset.getTime() - 3_600_000) };
}

/** Formata no fuso do destino quando conhecido; caso contrário, no fuso do aparelho. */
export function hhmm(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
}
