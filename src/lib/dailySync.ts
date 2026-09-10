import { assessAddressRisk } from "./addressRisk";
import { historyFetchers } from "./chains";
import type { HistoryPage } from "./chains/types";
import { readDb } from "./db";
import { sendMonthlyReports } from "./monthlyReport";
import { computePortfolioBreakdown } from "./portfolioValue";
import { sendToAll } from "./push";
import { supabase } from "./supabase";

export interface DailySyncResult {
  totalUsd: number;
  walletSnapshots: number;
  notified: number;
  monthlyReportsSent: boolean;
}

/**
 * Todo lo que corre una vez al día (ver src/app/api/cron/daily-sync/route.ts): snapshot del
 * portafolio + por wallet, barrido de movimientos nuevos (notifica push si están sin
 * clasificar o van hacia una dirección sancionada), y el reporte mensual por correo el
 * día 1. Todo en un solo cron para no depender de más de un cron job del plan de Vercel.
 */
export async function runDailySync(): Promise<DailySyncResult> {
  const db = await readDb();

  const breakdown = await computePortfolioBreakdown();
  await supabase.from("portfolio_snapshots").insert({ total_usd: breakdown.total });
  if (breakdown.perWallet.length > 0) {
    await supabase.from("wallet_snapshots").insert(breakdown.perWallet.map((p) => ({ wallet_id: p.walletId, balance_usd: p.usd })));
  }

  let notified = 0;
  for (const w of db.wallets) {
    try {
      const hist = (await historyFetchers[w.chain](w.address)) as HistoryPage;
      const page = hist.movements.slice(0, 25); // un vistazo a lo más reciente, no todo el historial
      if (page.length === 0) continue;

      const keys = page.map((m) => m.key);
      const { data: knownRows } = await supabase.from("notified_movements").select("movement_key").in("movement_key", keys);
      const known = new Set((knownRows || []).map((r) => r.movement_key));
      const toMark: string[] = [];

      for (const m of page) {
        if (known.has(m.key)) continue;
        toMark.push(m.key);

        const isInternal = !!m.counterparty && db.wallets.some((ow) => ow.chain === m.chain && ow.address.toLowerCase() === m.counterparty!.toLowerCase());
        if (isInternal) continue;

        const classification = db.classifications[m.key];
        if (classification?.isFee) continue;

        // Auditoría completa (sanciones OFAC + blacklist/fraude de Tronscan + "address poisoning"),
        // no solo sanciones — el mismo núcleo que usa la auditoría manual. Así una wallet que te
        // transfiere desde una dirección marcada como fraude/estafa en Tronscan (mucho más común
        // en el día a día que una sanción OFAC) también dispara el aviso, no solo el caso extremo.
        const risk = m.counterparty
          ? await assessAddressRisk(m.chain, m.counterparty, db).catch(() => null)
          : null;
        const isRisky = risk?.verdict === "high_risk";
        const unclassified = !classification?.aliadoId || !classification?.concepto?.trim();

        if (unclassified || isRisky) {
          const riskReason = risk?.sanctions.sanctioned
            ? "está en lista OFAC"
            : risk?.tronscanRisky
            ? "está marcada como fraude/estafa en Tronscan"
            : risk?.poisoningMatches.length
            ? `se parece a ${risk.poisoningMatches[0].label}`
            : null;
          await sendToAll({
            title: isRisky ? "🚫 Movimiento con contraparte riesgosa" : "Nuevo movimiento sin clasificar",
            body: isRisky
              ? `${m.direction === "out" ? "Salida hacia" : "Entrada desde"} una dirección que ${riskReason} — ${m.amount} ${m.asset} en ${w.label}`
              : `${m.direction === "out" ? "Salida" : "Entrada"} de ${m.amount} ${m.asset} en ${w.label}`,
            data: { movementKey: m.key, chain: m.chain },
          });
          notified++;
        }
      }

      if (toMark.length > 0) {
        await supabase.from("notified_movements").upsert(toMark.map((k) => ({ movement_key: k })), { onConflict: "movement_key", ignoreDuplicates: true });
      }
    } catch (e) {
      console.error(`dailySync: error procesando wallet ${w.label}:`, e);
    }
  }

  let monthlyReportsSent = false;
  if (new Date().getDate() === 1) {
    try {
      await sendMonthlyReports();
      monthlyReportsSent = true;
    } catch (e) {
      console.error("dailySync: error enviando reportes mensuales:", e);
    }
  }

  return { totalUsd: breakdown.total, walletSnapshots: breakdown.perWallet.length, notified, monthlyReportsSent };
}
