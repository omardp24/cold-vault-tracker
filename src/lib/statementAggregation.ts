import { FIXED_STABLECOINS } from "./assets";
import { fmtAmt } from "./format";
import type { Aliado, Chain, Classification, Holding, Movement, Wallet } from "@/components/coldvault/shared";
import type {
  StatementInput, StatementWalletRow, StatementWalletBlock, StatementAliadoGroup,
  StatementDetailMovement, StatementFeeRow, StatementInternalRow, StatementUnclassifiedRow,
} from "./statementPdf";

// Reimplementación pura (sin hooks/estado de React) de la lógica de clasificación que
// ColdVault.tsx ya usa en el cliente (effectiveAliadoId, isInternalTransfer, etc.) — para
// poder armar un StatementInput también server-side (reporte mensual por correo) sin
// duplicar ni divergir de esas reglas. El export bajo demanda del cliente sigue con su
// propia lógica tal cual estaba (usa sus filtros de UI activos, que este cálculo no conoce);
// esto se usa solo para el reporte automático, que arma su propio conjunto de movimientos
// por rango de fecha en vez de por filtros de pantalla.

export function findAliadoByAddress(aliados: Aliado[], addr: string | null): Aliado | undefined {
  if (!addr) return undefined;
  const a = addr.toLowerCase();
  return aliados.find((al) => al.addresses.some((x) => x.address.toLowerCase() === a));
}

export function findOwnWallet(wallets: Wallet[], chain: Chain, addr: string | null): Wallet | undefined {
  if (!addr) return undefined;
  const a = addr.toLowerCase();
  return wallets.find((w) => w.chain === chain && w.address.toLowerCase() === a);
}

export function effectiveAliadoId(m: Movement, classifications: Record<string, Classification>, aliados: Aliado[]): string | null {
  return classifications[m.key]?.aliadoId ?? findAliadoByAddress(aliados, m.counterparty)?.id ?? null;
}
export function effectiveConcepto(m: Movement, classifications: Record<string, Classification>): string {
  return classifications[m.key]?.concepto ?? "";
}
export function effectiveIsFee(m: Movement, classifications: Record<string, Classification>): boolean {
  return !!classifications[m.key]?.isFee;
}
export function isInternalTransfer(m: Movement, wallets: Wallet[]): boolean {
  return !!findOwnWallet(wallets, m.chain, m.counterparty);
}
export function nameFor(id: string, aliados: Aliado[]): string {
  return id === "sin_clasificar" ? "Sin clasificar" : aliados.find((a) => a.id === id)?.name || "—";
}
// Se prioriza el precio en vivo del lookup (ya valorado a precio de mercado real); el $1 fijo
// es solo respaldo cuando no hay lookup para ese activo (mismo criterio que safePrice() en ColdVault.tsx).
export function safePrice(m: Movement, priceLookup: Record<string, number | null>): number | null {
  if (!m.verified) return null;
  if (priceLookup[m.asset] != null) return priceLookup[m.asset];
  if (FIXED_STABLECOINS.has(m.asset.toUpperCase())) return 1;
  return null;
}

export interface StatementAggregationInput {
  wallets: Wallet[];
  aliados: Aliado[];
  classifications: Record<string, Classification>;
  movements: Movement[]; // ya acotados por quien llama (rango de fecha del reporte)
  priceLookup: Record<string, number | null>;
  holdings: Holding[];
  total: number;
  incompleteWallets: string[];
  generatedBy: string;
  dateFrom?: string;
  dateTo?: string;
}

const CHAIN_LABEL: Record<Chain, string> = { BTC: "Bitcoin", ETH: "Ethereum", TRON: "Tron" };

function detailRow(m: Movement, classifications: Record<string, Classification>, priceLookup: Record<string, number | null>): StatementDetailMovement {
  const px = safePrice(m, priceLookup);
  return {
    date: m.date, direction: m.direction, amount: m.amount, asset: m.asset,
    counterparty: m.counterparty, txid: m.txid, concepto: effectiveConcepto(m, classifications),
    usd: px !== null ? px * m.amount : null,
  };
}

export function buildStatementData(input: StatementAggregationInput): StatementInput {
  const { wallets, aliados, classifications, movements, priceLookup, holdings, total, incompleteWallets, generatedBy, dateFrom, dateTo } = input;

  const flowSummary = { inUsd: 0, outUsd: 0, feeUsd: 0 };
  const aliadoSummary: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};
  const aliadoSummaryIn: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};

  // Por wallet: movimientos de flujo (no internos, no comisión) agrupados por aliado — es la
  // "Detalle por wallet y aliado" del diseño. Los sin clasificar quedan aparte (ver abajo), no
  // se mezclan en este agrupamiento porque no tienen nombre bajo el cual agruparse.
  const perWallet: Record<string, { movs: Movement[]; groups: Record<string, Movement[]> }> = {};
  const ensureWallet = (id: string) => (perWallet[id] ||= { movs: [], groups: {} });

  const feeMovs: Movement[] = [];
  const internalMovs: Movement[] = [];
  const unclassifiedMovs: Movement[] = [];

  movements.forEach((m) => {
    if (isInternalTransfer(m, wallets)) { internalMovs.push(m); return; }
    const px = safePrice(m, priceLookup);
    const usd = px ? px * m.amount : 0;
    if (effectiveIsFee(m, classifications)) { flowSummary.feeUsd += usd; feeMovs.push(m); return; }
    if (m.direction === "out") flowSummary.outUsd += usd; else flowSummary.inUsd += usd;

    const walletId = wallets.find((w) => w.label === m.walletLabel)?.id || m.walletLabel || "—";
    const bucket = ensureWallet(walletId);
    bucket.movs.push(m);

    const aliadoId = effectiveAliadoId(m, classifications, aliados);
    if (!aliadoId) { unclassifiedMovs.push(m); }
    else {
      const name = nameFor(aliadoId, aliados);
      (bucket.groups[name] ||= []).push(m);
    }

    const sumBucket = m.direction === "out" ? aliadoSummary : aliadoSummaryIn;
    const id = aliadoId || "sin_clasificar";
    sumBucket[id] = sumBucket[id] || { id, assets: {}, count: 0, usdApprox: 0 };
    sumBucket[id].assets[m.asset] = (sumBucket[id].assets[m.asset] || 0) + m.amount;
    sumBucket[id].count += 1;
    if (px) sumBucket[id].usdApprox += px * m.amount;
  });

  const summaryRows = Object.values(aliadoSummary).sort((a, b) => b.usdApprox - a.usdApprox);
  const summaryRowsIn = Object.values(aliadoSummaryIn).sort((a, b) => b.usdApprox - a.usdApprox);

  const walletRows: StatementWalletRow[] = [];
  const walletBlocks: StatementWalletBlock[] = [];
  wallets.forEach((w) => {
    const entry = perWallet[w.id];
    if (!entry || entry.movs.length === 0) return;
    let inUsd = 0, outUsd = 0;
    entry.movs.forEach((m) => { const px = safePrice(m, priceLookup); const usd = px ? px * m.amount : 0; if (m.direction === "out") outUsd += usd; else inUsd += usd; });

    const groups: StatementAliadoGroup[] = Object.entries(entry.groups).map(([name, movs]) => {
      let gIn = 0, gOut = 0;
      const assetsNet: Record<string, number> = {};
      movs.forEach((m) => {
        const px = safePrice(m, priceLookup);
        const usd = px ? px * m.amount : 0;
        if (m.direction === "out") gOut += usd; else gIn += usd;
        assetsNet[m.asset] = (assetsNet[m.asset] || 0) + (m.direction === "out" ? -m.amount : m.amount);
      });
      return {
        name,
        movs: movs.map((m) => detailRow(m, classifications, priceLookup)),
        inUsd: gIn, outUsd: gOut, netUsd: gIn - gOut,
        assetsNetLabel: Object.entries(assetsNet).map(([a, v]) => `${v >= 0 ? "+" : "−"}${fmtAmt(Math.abs(v))} ${a}`).join("  ·  "),
      };
    }).sort((a, b) => b.movs.length - a.movs.length);

    walletRows.push({
      label: w.label, chainLabel: CHAIN_LABEL[w.chain], aliadoCount: groups.length, movCount: entry.movs.length,
      inUsd, outUsd, netUsd: inUsd - outUsd,
    });
    walletBlocks.push({ label: w.label, chainLabel: CHAIN_LABEL[w.chain], address: w.address, inUsd, outUsd, netUsd: inUsd - outUsd, groups });
  });

  // Transferencias internas: la misma tx aparece dos veces (una vez por wallet involucrada,
  // "out" en el origen e "in" en el destino) porque cada wallet trae su historial por separado.
  // Se agrupan por txid para mostrar una sola fila origen→destino, no las dos por separado.
  const internalByTx: Record<string, Movement[]> = {};
  internalMovs.forEach((m) => { (internalByTx[m.txid] ||= []).push(m); });
  const internals: StatementInternalRow[] = Object.values(internalByTx).map((pair) => {
    const out = pair.find((m) => m.direction === "out") || pair[0];
    const inn = pair.find((m) => m.direction === "in");
    const toWallet = inn?.walletLabel || findOwnWallet(wallets, out.chain, out.counterparty)?.label || "—";
    return { date: out.date, fromWallet: out.walletLabel || "—", toWallet, amount: out.amount, asset: out.asset, txid: out.txid };
  });

  const fees: StatementFeeRow[] = feeMovs.map((m) => {
    const px = safePrice(m, priceLookup);
    return { date: m.date, walletLabel: m.walletLabel || "—", amount: m.amount, asset: m.asset, usd: px !== null ? px * m.amount : null, txid: m.txid };
  });

  const unclassified: StatementUnclassifiedRow[] = unclassifiedMovs.map((m) => {
    const px = safePrice(m, priceLookup);
    return {
      date: m.date, walletLabel: m.walletLabel || "—", direction: m.direction, amount: m.amount, asset: m.asset,
      counterparty: m.counterparty, txid: m.txid, usd: px !== null ? px * m.amount : null,
    };
  });

  return {
    generatedBy,
    generatedAt: Date.now(),
    dateFrom,
    dateTo,
    incompleteWallets,
    flowSummary,
    totalPortfolioValue: total,
    walletCount: wallets.length,
    holdings: holdings.map((h) => ({ symbol: h.symbol, amount: h.amount, price: h.price, value: h.value })),
    movements: movements.map((m) => ({
      date: m.date, walletLabel: m.walletLabel || "", chain: m.chain, direction: m.direction,
      asset: m.asset, amount: m.amount, counterparty: m.counterparty,
      aliado: isInternalTransfer(m, wallets) ? "Transferencia interna" : effectiveIsFee(m, classifications) ? "Comisión de red" : nameFor(effectiveAliadoId(m, classifications, aliados) || "sin_clasificar", aliados),
      concepto: effectiveConcepto(m, classifications),
    })),
    aliadoOut: summaryRows.map((r) => ({ name: nameFor(r.id, aliados), assets: Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · "), usdApprox: r.usdApprox })),
    aliadoIn: summaryRowsIn.map((r) => ({ name: nameFor(r.id, aliados), assets: Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · "), usdApprox: r.usdApprox })),
    walletRows,
    walletBlocks,
    fees,
    internals,
    unclassified,
  };
}
