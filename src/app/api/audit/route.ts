import { NextRequest, NextResponse } from "next/server";
import { assessAddressRisk } from "@/lib/addressRisk";
import { balanceFetchers, historyFetchers } from "@/lib/chains";
import { readDb, Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const chain = req.nextUrl.searchParams.get("chain") as Chain | null;
  const address = req.nextUrl.searchParams.get("address");
  if (!chain || !address) return NextResponse.json({ error: "chain y address son requeridos" }, { status: 400 });

  const db = await readDb();
  const risk = await assessAddressRisk(chain, address, db);

  let txSeen = 0;
  let hasMoreHistory = false;
  let oldestSeen: number | null = null;
  let newestSeen: number | null = null;
  let historyError: string | null = null;
  try {
    const hist = await historyFetchers[chain](address);
    txSeen = hist.movements.length;
    hasMoreHistory = !!hist.nextCursor;
    const dates = hist.movements.map((m) => m.date).filter((d): d is number => d !== null);
    if (dates.length > 0) { oldestSeen = Math.min(...dates); newestSeen = Math.max(...dates); }
  } catch (e: any) {
    historyError = e.message || "no se pudo leer el historial";
  }

  let balanceSummary: { symbol: string; amount: number }[] = [];
  let balanceError: string | null = null;
  try {
    const bal = await balanceFetchers[chain](address);
    balanceSummary = [bal.native, ...bal.tokens].filter((t) => t.amount > 0).map((t) => ({ symbol: t.symbol, amount: t.amount }));
  } catch (e: any) {
    balanceError = e.message || "no se pudo leer el saldo";
  }

  // El verdict de assessAddressRisk ya cubre sanciones/tronscan/poisoning ("high_risk"); acá solo
  // se agrega el caso "caution" que depende de historial y saldo, datos que el núcleo compartido
  // no consulta (lo hace más liviano para el cron diario, que lo llama por cada movimiento nuevo).
  const verdict = risk.verdict === "high_risk" ? "high_risk" : txSeen === 0 && balanceSummary.length === 0 ? "caution" : "clean";

  return NextResponse.json({
    chain, address,
    sanctions: risk.sanctions,
    tronscanBlacklist: risk.tronscanBlacklist,
    tronscanSecurity: risk.tronscanSecurity,
    activity: { txSeen, hasMoreHistory, oldestSeen, newestSeen, historyError },
    balance: { summary: balanceSummary, error: balanceError },
    poisoningMatches: risk.poisoningMatches,
    verdict,
  });
}
