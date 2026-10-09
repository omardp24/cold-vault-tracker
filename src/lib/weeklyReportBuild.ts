import type { DB } from "./db";
import { readDb } from "./db";
import { fmtDate, shortAddr } from "./format";
import { assessAll, loadMovements } from "./movementsLoader";
import { narrate, textToHtml } from "./narrative";
import { computePortfolioBreakdown } from "./portfolioValue";
import { buildStatementData } from "./statementAggregation";
import type { StatementInput } from "./statementPdf";
import { addDays, veDayRange, veToday } from "./veDates";

// Reporte semanal (viernes): flujo de la semana + lo que falta por clasificar. Este archivo NO importa el
// generador de PDF (@react-pdf) a propósito: arma datos y HTML, y es lo que se puede probar/previsualizar
// sin enviar nada. El envío real está en weeklyReport.ts.

const APP_URL = process.env.APP_URL || "https://cold-vault-tracker.vercel.app";
const LOOKBACK_DAYS = 60; // para "pendientes de semanas anteriores"
const MAX_ROWS_WEEK = 25;
const MAX_ROWS_OLDER = 10;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const amt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const symbol = (s: string) => (/^[A-Za-z0-9._-]{1,12}$/.test(s) ? s : "TOKEN?");

export interface WeeklyReport {
  subject: string;
  html: string;
  fromDay: string;
  toDay: string;
  statementInput: StatementInput;
  counts: { movimientos: number; pendientesSemana: number; pendientesAnteriores: number; sospechosas: number };
}

interface PendingItem { fecha: string; wallet: string; direccion: "entrada" | "salida"; monto: number; activo: string; usd: number | null; contraparte: string | null; explorer: string }

export async function buildWeeklyReport(existingDb?: DB): Promise<WeeklyReport> {
  const db = existingDb || (await readDb());
  const toDay = veToday();
  const fromDay = addDays(toDay, -6); // sábado → viernes: semanas contiguas, sin huecos entre un viernes y el siguiente
  const weekFromMs = veDayRange(fromDay, toDay).from.getTime();

  const breakdown = await computePortfolioBreakdown();
  const loaded = await loadMovements(db, breakdown.priceLookup, LOOKBACK_DAYS);
  const susp = assessAll(db, loaded.raw, loaded.rows);

  const weekRaw = loaded.raw.filter((m) => m.date !== null && m.date >= weekFromMs);
  const statementInput = buildStatementData({
    wallets: db.wallets, aliados: db.aliados, classifications: db.classifications,
    movements: weekRaw, priceLookup: breakdown.priceLookup, holdings: breakdown.holdings, total: breakdown.total,
    incompleteWallets: db.wallets.filter((w) => breakdown.failedWalletIds.includes(w.id)).map((w) => w.label),
    generatedBy: "Reporte semanal automático", dateFrom: fromDay, dateTo: toDay,
    walletBalances: Object.fromEntries(breakdown.perWallet.map((p) => [p.walletId, p.usd])),
  });
  const flow = statementInput.flowSummary ?? { inUsd: 0, outUsd: 0, feeUsd: 0 };

  // "Pendiente" = misma regla de la app (sin aliado o sin concepto, sin contar internas, comisiones ni polvo/fraude).
  const weekPending: PendingItem[] = [];
  const olderPending: PendingItem[] = [];
  let suspiciousWeek = 0;
  loaded.rows.forEach((r, i) => {
    const m = loaded.raw[i];
    const inWeek = m.date !== null && m.date >= weekFromMs;
    if (susp.has(i)) { if (inWeek) suspiciousWeek++; return; }
    if (r.estado !== "pendiente") return;
    // Igual que la app, que por defecto oculta tokens sin precio conocido: un token no verificado o sin
    // precio (spam, montos en 0) no es una operación real que haya que clasificar.
    if (!r.verificado || r.usd === null) return;
    const item: PendingItem = { fecha: r.fecha, wallet: r.wallet, direccion: r.direccion, monto: r.monto, activo: r.activo, usd: r.usd, contraparte: r.contraparte, explorer: m.explorer };
    (inWeek ? weekPending : olderPending).push(item);
  });
  const byUsd = (a: PendingItem, b: PendingItem) => (b.usd || 0) - (a.usd || 0);
  weekPending.sort(byUsd);
  olderPending.sort(byUsd);
  const sumUsd = (l: PendingItem[]) => l.reduce((s, x) => s + (x.usd || 0), 0);

  const rowsTable = (list: PendingItem[], max: number) => {
    const shown = list.slice(0, max);
    const body = shown.map((p) => `<tr>
      <td style="padding:6px 8px;border-top:1px solid #e5e7e8;white-space:nowrap;color:#666">${esc(p.fecha)}</td>
      <td style="padding:6px 8px;border-top:1px solid #e5e7e8">${esc(p.wallet)}</td>
      <td style="padding:6px 8px;border-top:1px solid #e5e7e8;text-align:right;white-space:nowrap;color:${p.direccion === "salida" ? "#b23a3a" : "#008747"};font-weight:600">${p.direccion === "salida" ? "−" : "+"}${amt(p.monto)} ${esc(symbol(p.activo))}</td>
      <td style="padding:6px 8px;border-top:1px solid #e5e7e8;text-align:right;white-space:nowrap">${p.usd !== null ? money(p.usd) : "—"}</td>
      <td style="padding:6px 8px;border-top:1px solid #e5e7e8;font-family:monospace;font-size:11px"><a href="${esc(p.explorer)}" style="color:#f77b1c;text-decoration:none">${esc(shortAddr(p.contraparte))}</a></td>
    </tr>`).join("");
    const more = list.length > shown.length ? `<tr><td colspan="5" style="padding:8px;color:#666;font-size:12px">… y ${list.length - shown.length} más. Ábrelos en la app.</td></tr>` : "";
    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <tr style="background:#f4f4f4;color:#666;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px">
        <th style="padding:6px 8px;text-align:left">Fecha</th><th style="padding:6px 8px;text-align:left">Wallet</th><th style="padding:6px 8px;text-align:right">Monto</th><th style="padding:6px 8px;text-align:right">USD</th><th style="padding:6px 8px;text-align:left">Contraparte</th>
      </tr>${body}${more}</table>`;
  };

  const aliadoTable = (title: string, rows: StatementInput["aliadoIn"], color: string) => {
    if (rows.length === 0) return "";
    const body = rows.slice(0, 5).map((r) => `<tr><td style="padding:5px 8px;border-top:1px solid #e5e7e8">${esc(r.name)}</td><td style="padding:5px 8px;border-top:1px solid #e5e7e8;text-align:right;color:${color};font-weight:600;white-space:nowrap">${money(r.usdApprox)}</td></tr>`).join("");
    return `<div style="flex:1;min-width:240px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:${color};font-weight:700;margin:14px 0 4px">${title}</div><table style="width:100%;border-collapse:collapse;font-size:12.5px">${body}</table></div>`;
  };

  const pendingTotal = weekPending.length + olderPending.length;
  const rangeLabel = `${fmtDate(weekFromMs)} – ${fmtDate(Date.now())}`;

  const facts = {
    semana: rangeLabel,
    entradas_usd: Math.round(flow.inUsd), salidas_usd: Math.round(flow.outUsd), comisiones_usd: Math.round(flow.feeUsd),
    movimientos: statementInput.movements.length,
    principales_entradas: statementInput.aliadoIn.slice(0, 4).map((r) => ({ aliado: r.name, usd: Math.round(r.usdApprox) })),
    principales_salidas: statementInput.aliadoOut.slice(0, 4).map((r) => ({ aliado: r.name, usd: Math.round(r.usdApprox) })),
    pendientes_semana: { cantidad: weekPending.length, usd: Math.round(sumUsd(weekPending)) },
    pendientes_anteriores: { cantidad: olderPending.length, usd: Math.round(sumUsd(olderPending)) },
    polvo_o_posible_fraude_semana: suspiciousWeek,
    nota: "Montos en USD al precio actual, no al del día de cada operación.",
  };
  const fallback = [
    `- Entradas: ${money(flow.inUsd)} · Salidas: ${money(flow.outUsd)} · Neto: ${money(flow.inUsd - flow.outUsd)}.`,
    statementInput.aliadoOut[0] ? `- Mayor salida: ${statementInput.aliadoOut[0].name} (${money(statementInput.aliadoOut[0].usdApprox)}).` : "",
    statementInput.aliadoIn[0] ? `- Mayor entrada: ${statementInput.aliadoIn[0].name} (${money(statementInput.aliadoIn[0].usdApprox)}).` : "",
    pendingTotal ? `- Faltan por clasificar ${pendingTotal} movimientos (${money(sumUsd(weekPending) + sumUsd(olderPending))}).` : "- Todo está clasificado.",
  ].filter(Boolean).join("\n");
  const { text: narrative } = await narrate({
    deep: true, facts, fallback,
    instruction: "Escribe el resumen de la semana de Cold Vault para el dueño del negocio: 3 a 5 viñetas (con '-') con lo más importante: entradas vs salidas, aliados con más movimiento, cuánto y cuántos movimientos faltan por clasificar (destácalo) y algo inusual si lo hay. Máximo 120 palabras, concreto, sin saludo y sin etiquetas tipo «ACCIONABLE:».",
  });

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#333">
    <div style="background:#012d37;color:#fff;padding:16px 20px;border-bottom:3px solid #f77b1c">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#f8b345">Cold Vault · Relación semanal</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(rangeLabel)}</div>
    </div>
    <div style="padding:16px 20px">
      <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px"><tr>
        <td style="border-left:3px solid #008747;background:#f4f4f4;padding:8px 10px"><div style="font-size:10px;text-transform:uppercase;color:#666">Entradas</div><div style="font-size:16px;font-weight:700;color:#008747">${money(flow.inUsd)}</div></td>
        <td style="border-left:3px solid #b23a3a;background:#f4f4f4;padding:8px 10px"><div style="font-size:10px;text-transform:uppercase;color:#666">Salidas</div><div style="font-size:16px;font-weight:700;color:#b23a3a">${money(flow.outUsd)}</div></td>
        <td style="border-left:3px solid #012d37;background:#f4f4f4;padding:8px 10px"><div style="font-size:10px;text-transform:uppercase;color:#666">Neto</div><div style="font-size:16px;font-weight:700;color:#012d37">${money(flow.inUsd - flow.outUsd)}</div></td>
      </tr></table>
      <div style="font-size:12px;color:#666;margin-top:8px">${statementInput.movements.length} movimientos · Comisiones de red: ${money(flow.feeUsd)} (excluidas) · Las transferencias entre tus wallets no se cuentan.</div>

      <div style="font-size:14px;line-height:1.5;margin-top:14px">${textToHtml(narrative)}</div>

      <div style="display:flex;gap:16px;flex-wrap:wrap">${aliadoTable("Recibido por aliado", statementInput.aliadoIn, "#008747")}${aliadoTable("Pagado por aliado", statementInput.aliadoOut, "#b23a3a")}</div>

      <div style="margin-top:22px;border-top:2px solid #f77b1c;padding-top:10px">
        <div style="font-size:15px;font-weight:700;color:${pendingTotal ? "#b23a3a" : "#008747"}">${pendingTotal ? `⏳ Faltan por clasificar: ${pendingTotal}` : "✅ Todo está clasificado"}</div>
        ${pendingTotal ? `<div style="font-size:12px;color:#666;margin:2px 0 8px">Sin aliado o sin concepto. Totales aproximados al precio actual.</div>` : ""}
        ${weekPending.length ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#012d37;font-weight:700;margin:10px 0 4px">De esta semana · ${weekPending.length} · ${money(sumUsd(weekPending))}</div>${rowsTable(weekPending, MAX_ROWS_WEEK)}` : ""}
        ${olderPending.length ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#012d37;font-weight:700;margin:14px 0 4px">De semanas anteriores (últimos ${LOOKBACK_DAYS} días) · ${olderPending.length} · ${money(sumUsd(olderPending))}</div>${rowsTable(olderPending, MAX_ROWS_OLDER)}` : ""}
        ${suspiciousWeek ? `<div style="font-size:12px;color:#666;margin-top:10px">🚩 ${suspiciousWeek} transferencia(s) de polvo o posible fraude esta semana no se cuentan como pendientes — revísalas en Movimientos → «Polvo / posible fraude».</div>` : ""}
        ${pendingTotal ? `<div style="margin-top:14px"><a href="${esc(APP_URL)}" style="display:inline-block;background:#f77b1c;color:#fff;text-decoration:none;font-weight:700;padding:9px 18px;border-radius:20px;font-size:13px">Clasificar en Cold Vault</a></div>` : ""}
      </div>

      <div style="margin-top:22px;font-size:11px;color:#999;line-height:1.5">Adjunto el estado de cuenta de la semana en PDF. Los valores en USD usan el precio actual de cada activo, no el del día de la operación. Se revisan los ~100 movimientos más recientes de cada wallet.</div>
    </div></div>`;

  return {
    subject: `Cold Vault — Relación semanal (${rangeLabel})${pendingTotal ? ` · ${pendingTotal} por clasificar` : " · todo clasificado"}`,
    html, fromDay, toDay, statementInput,
    counts: { movimientos: statementInput.movements.length, pendientesSemana: weekPending.length, pendientesAnteriores: olderPending.length, sospechosas: suspiciousWeek },
  };
}
