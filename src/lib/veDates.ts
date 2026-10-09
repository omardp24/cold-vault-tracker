// Fechas en hora de Venezuela (UTC-4, sin horario de verano). El servidor corre en UTC (Vercel), así que
// "hoy" y los rangos de días se calculan a mano con este desfase en vez de confiar en la zona del servidor.
export const VE_OFFSET_HOURS = 4;

/** Rango [desde 00:00, hasta 23:59:59] en hora de Venezuela para dos fechas YYYY-MM-DD. */
export function veDayRange(fromDay: string, toDay: string): { from: Date; to: Date } {
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);
  return { from: new Date(Date.UTC(fy, fm - 1, fd, VE_OFFSET_HOURS)), to: new Date(Date.UTC(ty, tm - 1, td + 1, VE_OFFSET_HOURS) - 1) };
}

/** Fecha de hoy en Caracas como YYYY-MM-DD. */
export function veToday(now = Date.now()): string {
  return new Date(now - VE_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
