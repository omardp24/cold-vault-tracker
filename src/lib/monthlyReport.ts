import { historyFetchers } from "./chains";
import type { HistoryPage } from "./chains/types";
import type { Movement } from "@/components/coldvault/shared";
import { readDb } from "./db";
import { computePortfolioBreakdown } from "./portfolioValue";
import { buildStatementData } from "./statementAggregation";
import { generateStatementExcel } from "./statementExcel";
import { generateStatementPdf } from "./statementPdf";
import { sendMail } from "./mailer";

function previousMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { from, to };
}

/**
 * Trae los movimientos del mes calendario anterior para una wallet, paginando con
 * historyFetchers hasta salir del rango de fecha (o quedarse sin más páginas). Tope de
 * 10 páginas por wallet — suficiente para el volumen de esta herramienta, evita un loop
 * sin fin si algo en la paginación de una red se porta raro.
 */
async function fetchMonthMovements(chain: "BTC" | "ETH" | "TRON", address: string, fromMs: number, toMs: number): Promise<Movement[]> {
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

  const { from, to } = previousMonthRange();
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const [breakdown, movementsByWallet] = await Promise.all([
    computePortfolioBreakdown(),
    Promise.all(db.wallets.map(async (w) => {
      try {
        const movs = await fetchMonthMovements(w.chain, w.address, fromMs, toMs);
        return movs.map((m) => ({ ...m, walletLabel: w.label }));
      } catch {
        return [];
      }
    })),
  ]);

  const allMovements = movementsByWallet.flat();
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
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  });

  const [pdf, excel] = await Promise.all([generateStatementPdf(statementData), generateStatementExcel(statementData)]);
  const monthLabel = from.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  const fileTag = from.toISOString().slice(0, 7);

  for (const user of db.users) {
    await sendMail({
      to: user.email,
      subject: `Cold Vault — estado de cuenta de ${monthLabel}`,
      html: `<p>Hola ${user.name},</p><p>Adjunto el estado de cuenta de Cold Vault de <strong>${monthLabel}</strong> — resumen, tenencias, movimientos y desglose por aliado.</p>`,
      attachments: [
        { filename: `estado_cuenta_${fileTag}.pdf`, content: pdf },
        { filename: `estado_cuenta_${fileTag}.xlsx`, content: excel },
      ],
    });
  }
}
