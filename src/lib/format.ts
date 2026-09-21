// Formatters puros, sin React — viven acá (no en components/coldvault/shared.tsx, que es
// "use client") para poder importarlos también desde libs server-only (cron, reportes)
// sin arrastrar todo un módulo de cliente al bundle del servidor.
export const fmtUSD = (n: number | null | undefined) =>
  n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 6 : 2 });
export const fmtAmt = (n: number | null | undefined, d = 6) => (n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d }));
export const shortAddr = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
// Toda fecha/hora que se muestra usa la hora de Venezuela (UTC-4, sin horario de verano), no la del
// servidor: en Vercel el servidor corre en UTC, así que los reportes salían con 4 horas de diferencia
// (y un movimiento de las 9 p. m. caía en el día siguiente).
export const APP_TZ = "America/Caracas";
export const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric", timeZone: APP_TZ }) : "pendiente");
// "21/09/2026 3:45 p. m." — sin segundos.
export const fmtDateTime = (ms: number) =>
  new Date(ms).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TZ });

// Fecha calendario de Venezuela como Date en UTC a medianoche, para celdas de Excel (que no guardan zona horaria).
export const caracasCalendarDate = (ms: number) => {
  const [d, m, y] = new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TZ }).split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
