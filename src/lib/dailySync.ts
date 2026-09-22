import { buildBriefing } from "./briefing";
import { historyFetchers } from "./chains";
import type { HistoryPage, Movement } from "./chains/types";
import { readDb } from "./db";
import { sendMonthlyReports } from "./monthlyReport";
import { computePortfolioBreakdown } from "./portfolioValue";
import { sendToAll } from "./push";
import { supabase } from "./supabase";

export interface DailySyncResult {
  totalUsd: number;
  walletSnapshots: number;
  monthlyReportsSent: boolean;
  briefingSent: boolean;
}

/**
 * Todo lo que corre una vez al día (ver src/app/api/cron/daily-sync/route.ts): snapshot del
 * portafolio + por wallet, el resumen del día por push, y el reporte mensual por correo el
 * día 1. El aviso de movimientos nuevos casi en tiempo real ya NO vive acá — corre aparte
 * cada pocos minutos (ver movementWatch.ts) porque Vercel Hobby solo permite un cron diario.
 */
export async function runDailySync(): Promise<DailySyncResult> {
  const db = await readDb();

  const breakdown = await computePortfolioBreakdown();
  // Total del snapshot anterior (antes de insertar el de hoy) para poder decir cuánto varió el portafolio.
  const { data: prevSnap } = await supabase.from("portfolio_snapshots").select("total_usd").order("taken_at", { ascending: false }).limit(1);
  const prevTotal = prevSnap?.[0]?.total_usd != null ? Number(prevSnap[0].total_usd) : null;
  await supabase.from("portfolio_snapshots").insert({ total_usd: breakdown.total });
  if (breakdown.perWallet.length > 0) {
    await supabase.from("wallet_snapshots").insert(breakdown.perWallet.map((p) => ({ wallet_id: p.walletId, balance_usd: p.usd })));
  }

  // Solo recolecta lo de las últimas 24h para el resumen del día (buildBriefing) — el aviso
  // push de cada movimiento nuevo y su deduplicación ya corren aparte (movementWatch.ts).
  const dayAgo = Date.now() - 24 * 3600_000;
  const recent: (Movement & { walletLabel: string })[] = [];
  for (const w of db.wallets) {
    try {
      const hist = (await historyFetchers[w.chain](w.address)) as HistoryPage;
      hist.movements.slice(0, 25).forEach((m) => { if (m.date && m.date >= dayAgo) recent.push({ ...m, walletLabel: w.label }); });
    } catch (e) {
      console.error(`dailySync: error leyendo historial de ${w.label}:`, e);
    }
  }

  // Resumen del día (Gemini solo redacta cifras calculadas aquí). Solo se manda si hubo movimientos.
  let briefingSent = false;
  try {
    const briefing = await buildBriefing({
      db, recent, priceLookup: breakdown.priceLookup, total: breakdown.total, prevTotal,
      failedWallets: db.wallets.filter((w) => breakdown.failedWalletIds.includes(w.id)).map((w) => w.label),
    });
    if (briefing) { await sendToAll({ ...briefing, data: { kind: "briefing" } }); briefingSent = true; }
  } catch (e) {
    console.error("dailySync: error enviando el resumen del día:", e);
  }

  let monthlyReportsSent = false;
  // Día del mes en hora de Venezuela (el cron corre a las 12:00 UTC = 08:00 en Caracas).
  if (new Date(Date.now() - 4 * 3600_000).getUTCDate() === 1) {
    try {
      await sendMonthlyReports();
      monthlyReportsSent = true;
    } catch (e) {
      console.error("dailySync: error enviando reportes mensuales:", e);
    }
  }

  return { totalUsd: breakdown.total, walletSnapshots: breakdown.perWallet.length, monthlyReportsSent, briefingSent };
}
