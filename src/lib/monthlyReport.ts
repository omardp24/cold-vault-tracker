import { historyFetchers } from "./chains";
import type { HistoryPage } from "./chains/types";
import type { Movement } from "@/components/coldvault/shared";
import { readDb } from "./db";
import { computePortfolioBreakdown } from "./portfolioValue";
import { buildStatementData } from "./statementAggregation";
import { generateStatementExcel } from "./statementExcel";
import { generateStatementPdf } from "./statementPdf";
import { sendMail } from "./mailer";
import { narrate, textToHtml, usd } from "./narrative";
import type { StatementInput } from "./statementPdf";

// El mes se calcula en hora de Venezuela (UTC-4, sin horario de verano), no en la del servidor (UTC en Vercel):
// si no, un movimiento de las 9 p. m. del último día del mes caía en el mes siguiente.
const VE_OFFSET_HOURS = 4;
/** Rango [desde 00:00, hasta 23:59:59] en hora de Venezuela para dos fechas YYYY-MM-DD. */
export function veDayRange(fromDay: string, toDay: string): { from: Date; to: Date } {
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);
  return { from: new Date(Date.UTC(fy, fm - 1, fd, VE_OFFSET_HOURS)), to: new Date(Date.UTC(ty, tm - 1, td + 1, VE_OFFSET_HOURS) - 1) };
}

function previousMonthRange(): { from: Date; to: Date; fromDay: string; toDay: string; earlierFrom: Date; earlierFromDay: string; earlierToDay: string } {
  const veNow = new Date(Date.now() - VE_OFFSET_HOURS * 3600_000); // "reloj de pared" de Caracas leído con getUTC*
  const y = veNow.getUTCFullYear(), m = veNow.getUTCMonth();
  const from = new Date(Date.UTC(y, m - 1, 1, VE_OFFSET_HOURS));
  const to = new Date(Date.UTC(y, m, 1, VE_OFFSET_HOURS) - 1);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const fromDay = day(new Date(Date.UTC(y, m - 1, 1)));
  const toDay = day(new Date(Date.UTC(y, m, 0))); // día 0 del mes actual = último día del mes anterior
  const earlierFrom = new Date(Date.UTC(y, m - 2, 1, VE_OFFSET_HOURS)); // mes anterior al reportado, para comparar
  const earlierFromDay = day(new Date(Date.UTC(y, m - 2, 1)));
  const earlierToDay = day(new Date(Date.UTC(y, m - 1, 0)));
  return { from, to, fromDay, toDay, earlierFrom, earlierFromDay, earlierToDay };
}

/**
 * Trae los movimientos del mes calendario anterior para una wallet, paginando con
 * historyFetchers hasta salir del rango de fecha (o quedarse sin más páginas). Tope de
 * 10 páginas por wallet — suficiente para el volumen de esta herramienta, evita un loop
 * sin fin si algo en la paginación de una red se porta raro.
 */
export async function fetchRangeMovements(chain: "BTC" | "ETH" | "TRON", address: string, fromMs: number, toMs: number): Promise<Movement[]> {
  const out: Movement[] = [];
  let cursor: string | null | undefined = undefined;
  for (let page = 0; page < 10; page++) {
    const hist = (await historyFetchers[chain](address, cursor)) as HistoryPage;
    for (const m of hist.movements) {
      if (m.date && m.date >= fromMs && m.date <= toMs) out.push(m);
    }
    const oldestInPage = hist.movements.reduce((min: number | null, m) => (m.date && (!min || m.date < min) ? m.date : min), null as number | null);
    if (!hist.nextCursor || (oldestInPage !== null && oldestInPage < fromMs)) break;
    cursor = hist.nextCursor;
  }
  return out;
}

/** Genera y envía el estado de cuenta del mes calendario anterior a cada usuario registrado. */
export async function sendMonthlyReports(): Promise<void> {
  const db = await readDb();
  if (db.users.length === 0) return;

  const { from, to, fromDay, toDay, earlierFrom, earlierFromDay, earlierToDay } = previousMonthRange();
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const [breakdown, movementsByWallet] = await Promise.all([
    computePortfolioBreakdown(),
    Promise.all(db.wallets.map(async (w) => {
      try {
        const movs = await fetchRangeMovements(w.chain, w.address, earlierFrom.getTime(), toMs);
        return movs.map((m) => ({ ...m, walletLabel: w.label }));
      } catch {
        return [];
      }
    })),
  ]);

  const everyMovement = movementsByWallet.flat();
  const allMovements = everyMovement.filter((m) => m.date !== null && m.date >= fromMs && m.date <= toMs);
  const earlierMovements = everyMovement.filter((m) => m.date !== null && m.date >= earlierFrom.getTime() && m.date < fromMs);
  const incompleteWallets = db.wallets
    .filter((w) => breakdown.failedWalletIds.includes(w.id))
    .map((w) => w.label);

  const statementData = buildStatementData({
    wallets: db.wallets,
    aliados: db.aliados,
    classifications: db.classifications,
    movements: allMovements,
    priceLookup: breakdown.priceLookup,
    holdings: breakdown.holdings,
    total: breakdown.total,
    incompleteWallets,
    generatedBy: "Reporte mensual automático",
    dateFrom: fromDay,
    dateTo: toDay,
  });

  const earlierData = buildStatementData({
    wallets: db.wallets, aliados: db.aliados, classifications: db.classifications, movements: earlierMovements,
    priceLookup: breakdown.priceLookup, holdings: breakdown.holdings, total: breakdown.total,
    incompleteWallets, generatedBy: "comparativo", dateFrom: earlierFromDay, dateTo: earlierToDay,
  });
  const monthLabelOf = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
  const analysis = await buildAnalysis(statementData, earlierData, monthLabelOf(fromDay), monthLabelOf(earlierFromDay));

  const [pdf, excel] = await Promise.all([generateStatementPdf(statementData), generateStatementExcel(statementData)]);
  const monthLabel = new Date(`${fromDay}T12:00:00Z`).toLocaleDateString("es-VE", { month: "long", year: "numeric", timeZone: "UTC" });
  const fileTag = fromDay.slice(0, 7);

  for (const user of db.users) {
    await sendMail({
      to: user.email,
      subject: `Cold Vault — estado de cuenta de ${monthLabel}`,
      html: `<p>Hola ${user.name},</p><p>Adjunto el estado de cuenta de Cold Vault de <strong>${monthLabel}</strong> — resumen, tenencias, movimientos y desglose por aliado.</p>${analysis}`,
      attachments: [
        { filename: `estado_cuenta_${fileTag}.pdf`, content: pdf },
        { filename: `estado_cuenta_${fileTag}.xlsx`, content: excel },
      ],
    });
  }
}

type MonthFacts = ReturnType<typeof monthFacts>;
function monthFacts(d: StatementInput) {
  const top = (rows: StatementInput["aliadoIn"]) => rows.slice(0, 5).map((r) => ({ aliado: r.name, usd: Math.round(r.usdApprox) }));
  return {
    entradas_usd: Math.round(d.flowSummary?.inUsd ?? 0), salidas_usd: Math.round(d.flowSummary?.outUsd ?? 0), comisiones_usd: Math.round(d.flowSummary?.feeUsd ?? 0),
    movimientos: d.movements.length, sin_clasificar: d.unclassified.length,
    sin_clasificar_usd: Math.round(d.unclassified.reduce((s, r) => s + (r.usd || 0), 0)),
    principales_entradas: top(d.aliadoIn), principales_salidas: top(d.aliadoOut),
  };
}

const pct = (a: number, b: number) => (b ? `${a >= b ? "+" : "−"}${Math.abs(Math.round(((a - b) / b) * 100))}%` : "n/d");

/** Análisis en lenguaje natural del mes (con comparación contra el anterior) para el cuerpo del correo. */
async function buildAnalysis(cur: StatementInput, prev: StatementInput, curLabel: string, prevLabel: string): Promise<string> {
  const c: MonthFacts = monthFacts(cur), p: MonthFacts = monthFacts(prev);
  const facts = {
    mes: curLabel, mes_anterior: prevLabel, este_mes: c, mes_anterior_cifras: p,
    portafolio_total_usd_hoy: Math.round(cur.totalPortfolioValue),
    wallets_incompletas: cur.incompleteWallets || [],
    nota: "Los montos en USD usan el precio actual del activo, no el del día de cada operación.",
  };
  const fallback = [
    `- Entradas: ${usd(c.entradas_usd)} (${pct(c.entradas_usd, p.entradas_usd)} vs ${prevLabel}).`,
    `- Salidas: ${usd(c.salidas_usd)} (${pct(c.salidas_usd, p.salidas_usd)} vs ${prevLabel}).`,
    `- Comisiones de red: ${usd(c.comisiones_usd)}.`,
    c.principales_salidas[0] ? `- Mayor salida: ${c.principales_salidas[0].aliado} (${usd(c.principales_salidas[0].usd)}).` : "",
    c.principales_entradas[0] ? `- Mayor entrada: ${c.principales_entradas[0].aliado} (${usd(c.principales_entradas[0].usd)}).` : "",
    c.sin_clasificar ? `- ${c.sin_clasificar} movimientos (${usd(c.sin_clasificar_usd)}) siguen sin clasificar.` : "- Todos los movimientos están clasificados.",
  ].filter(Boolean).join("\n");
  const { text } = await narrate({
    deep: true, facts, fallback,
    instruction: "Escribe el análisis mensual de Cold Vault para el dueño del negocio: 1 párrafo corto de panorama general y luego 3 a 5 viñetas (con '-') sobre: comparación de entradas y salidas contra el mes anterior, aliados con más movimiento, movimientos sin clasificar que conviene revisar, y cualquier cambio notable. Máximo 170 palabras. Sé concreto y honesto: si el mes anterior no tiene datos, dilo en vez de comparar.",
  });
  return `<h3 style="margin:16px 0 4px;font-family:sans-serif">Análisis del mes</h3><div style="font-family:sans-serif;font-size:14px;line-height:1.5">${textToHtml(text)}</div><p style="font-size:11px;color:#888">Análisis generado automáticamente a partir de las cifras del reporte; los montos usan el precio actual de cada activo.</p>`;
}
