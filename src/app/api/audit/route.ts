import { NextRequest, NextResponse } from "next/server";
import { checkSanctioned } from "@/lib/sanctions";
import { checkStablecoinBlacklist, checkAccountSecurity } from "@/lib/tronscan";
import { balanceFetchers, historyFetchers } from "@/lib/chains";
import { readDb, Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function fingerprint(addr: string): string {
  return addr.length >= 12 ? `${addr.slice(0, 6).toLowerCase()}…${addr.slice(-4).toLowerCase()}` : addr.toLowerCase();
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const chain = req.nextUrl.searchParams.get("chain") as Chain | null;
  const address = req.nextUrl.searchParams.get("address");
  if (!chain || !address) return NextResponse.json({ error: "chain y address son requeridos" }, { status: 400 });

  const sanctions = await checkSanctioned(chain, address);

  let tronscanBlacklist: { blacklisted: boolean; tokens: string[] } | null = null;
  let tronscanSecurity: { checked: boolean; hasFraudTransaction?: boolean; fraudTokenCreator?: boolean; sendAdByMemo?: boolean; isBlackList?: boolean } | null = null;
  if (chain === "TRON") {
    [tronscanBlacklist, tronscanSecurity] = await Promise.all([checkStablecoinBlacklist(address), checkAccountSecurity(address)]);
  }

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

  const db = await readDb();
  const known = [
    ...db.wallets.map((w) => ({ address: w.address, label: `tu wallet "${w.label}"` })),
    ...db.aliados.flatMap((a) => a.addresses.map((ad) => ({ address: ad.address, label: `tu aliado "${a.name}"` }))),
  ];
  const targetFp = fingerprint(address);
  const poisoningMatches = known
    .filter((k) => k.address.toLowerCase() !== address.toLowerCase() && fingerprint(k.address) === targetFp)
    .map((k) => ({ address: k.address, label: k.label }));

  let verdict: "clean" | "caution" | "high_risk" = "clean";
  const tronscanRisky =
    !!tronscanBlacklist?.blacklisted ||
    !!(tronscanSecurity?.checked && (tronscanSecurity.hasFraudTransaction || tronscanSecurity.fraudTokenCreator || tronscanSecurity.isBlackList));
  if (sanctions.sanctioned || poisoningMatches.length > 0 || tronscanRisky) verdict = "high_risk";
  else if (txSeen === 0 && balanceSummary.length === 0) verdict = "caution";

  return NextResponse.json({
    chain, address,
    sanctions,
    tronscanBlacklist,
    tronscanSecurity,
    activity: { txSeen, hasMoreHistory, oldestSeen, newestSeen, historyError },
    balance: { summary: balanceSummary, error: balanceError },
    poisoningMatches,
    verdict,
  });
}
