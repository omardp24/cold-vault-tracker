// Formatters puros, sin React — viven acá (no en components/coldvault/shared.tsx, que es
// "use client") para poder importarlos también desde libs server-only (cron, reportes)
// sin arrastrar todo un módulo de cliente al bundle del servidor.
export const fmtUSD = (n: number | null | undefined) =>
  n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 6 : 2 });
export const fmtAmt = (n: number | null | undefined, d = 6) => (n === null || n === undefined || isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: d }));
export const shortAddr = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
export const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" }) : "pendiente");
