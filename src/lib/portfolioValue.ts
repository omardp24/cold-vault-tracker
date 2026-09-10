import { FIXED_STABLECOINS, SYMBOL_COINGECKO } from "./assets";
import { balanceFetchers } from "./chains";
import type { BalanceResult } from "./chains/types";
import { readDb } from "./db";
import { fetchPrices } from "./prices";

export interface PortfolioBreakdown {
  total: number;
  perWallet: { walletId: string; usd: number }[];
  holdings: { symbol: string; amount: number; price: number | null; value: number | null }[];
  priceLookup: Record<string, number | null>;
  failedWalletIds: string[];
}

/**
 * Reimplementa server-side el mismo cálculo que fetchAll() hace en el cliente
 * (src/components/ColdVault.tsx) — saldo de cada wallet + tenencias manuales, valorado
 * en USD. Además de el total agregado (lo único que devolvía antes), ahora también
 * devuelve el valor POR wallet, para el historial individual (wallet_snapshots).
 * La usa el cron diario (src/lib/dailySync.ts), que no tiene sesión de navegador para
 * pasar por /api/balance y /api/prices.
 */
export async function computePortfolioBreakdown(): Promise<PortfolioBreakdown> {
  const db = await readDb();

  const walletItems: { walletId: string; items: { symbol: string; amount: number; priceOverride?: number }[] }[] = [];
  const globalAgg: Record<string, { symbol: string; amount: number; priceOverride?: number; coinId?: string }> = {};
  const failedWalletIds: string[] = [];

  const processWallet = async (w: (typeof db.wallets)[number]) => {
    try {
      const bal = (await balanceFetchers[w.chain](w.address)) as BalanceResult;
      const items = [bal.native, ...bal.tokens];
      walletItems.push({ walletId: w.id, items });
      for (const it of items) {
        globalAgg[it.symbol] = globalAgg[it.symbol] || { symbol: it.symbol, amount: 0 };
        globalAgg[it.symbol].amount += it.amount;
        if ((it as any).priceUsd) globalAgg[it.symbol].priceOverride = (it as any).priceUsd;
      }
    } catch {
      // una wallet caída no debe tumbar el snapshot entero — su historial queda sin punto ese día,
      // igual que fetchAll() en el cliente marca esa wallet como "incompleta" en vez de fallar todo.
      walletItems.push({ walletId: w.id, items: [] });
      failedWalletIds.push(w.id);
    }
  };

  // Las wallets de TRON se consultan en serie (no en paralelo con Promise.all como el resto):
  // TronGrid sin API key tiene un límite anónimo bajo, y varias wallets de la misma cuenta
  // llegando juntas lo agotan (429) aunque cada una individualmente reintente (ver tronFetch en
  // chains/tron.ts). BTC/ETH usan otras APIs sin este problema, así que siguen en paralelo.
  const tronWallets = db.wallets.filter((w) => w.chain === "TRON");
  const otherWallets = db.wallets.filter((w) => w.chain !== "TRON");
  await Promise.all(otherWallets.map(processWallet));
  for (const w of tronWallets) await processWallet(w);

  db.manual.forEach((m) => {
    globalAgg[m.symbol] = globalAgg[m.symbol] || { symbol: m.symbol, amount: 0, coinId: m.coinId };
    globalAgg[m.symbol].amount += m.qty;
    globalAgg[m.symbol].coinId = m.coinId;
  });

  const ids = new Set<string>();
  Object.keys(globalAgg).forEach((sym) => { if (SYMBOL_COINGECKO[sym]) ids.add(SYMBOL_COINGECKO[sym]); });
  db.manual.forEach((m) => ids.add(m.coinId));

  let priceMap: Record<string, { usd: number }> = {};
  if (ids.size > 0) {
    try {
      priceMap = await fetchPrices(Array.from(ids));
    } catch {
      // sin precios frescos, el total solo cuenta lo que ya tiene priceOverride/stablecoins
    }
  }

  const priceFor = (symbol: string, priceOverride?: number, coinId?: string) => {
    if (SYMBOL_COINGECKO[symbol] && priceMap[SYMBOL_COINGECKO[symbol]]) return priceMap[SYMBOL_COINGECKO[symbol]].usd;
    if (coinId && priceMap[coinId]) return priceMap[coinId].usd;
    if (FIXED_STABLECOINS.has(symbol.toUpperCase())) return 1;
    if (priceOverride) return priceOverride;
    return null;
  };

  const holdings = Object.values(globalAgg).map((a) => {
    const price = priceFor(a.symbol, a.priceOverride, a.coinId);
    return { symbol: a.symbol, amount: a.amount, price, value: price !== null ? price * a.amount : null };
  });
  const total = holdings.reduce((sum, h) => sum + (h.value || 0), 0);
  const priceLookup: Record<string, number | null> = {};
  holdings.forEach((h) => { priceLookup[h.symbol] = h.price; });

  const perWallet = walletItems.map((wb) => ({
    walletId: wb.walletId,
    usd: wb.items.reduce((sum, it) => {
      const price = priceFor(it.symbol, it.priceOverride);
      return sum + (price !== null ? price * it.amount : 0);
    }, 0),
  }));

  return { total, perWallet, holdings, priceLookup, failedWalletIds };
}

export async function computeTotalPortfolioValue(): Promise<number> {
  return (await computePortfolioBreakdown()).total;
}
