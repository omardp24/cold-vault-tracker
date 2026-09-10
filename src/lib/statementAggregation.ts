import { FIXED_STABLECOINS } from "./assets";
import { fmtAmt } from "./format";
import type { Aliado, Chain, Classification, Holding, Movement, Wallet } from "@/components/coldvault/shared";
import type { StatementInput } from "./statementPdf";

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

export function buildStatementData(input: StatementAggregationInput): StatementInput {
  const { wallets, aliados, classifications, movements, priceLookup, holdings, total, incompleteWallets, generatedBy, dateFrom, dateTo } = input;

  const flowSummary = { inUsd: 0, outUsd: 0, feeUsd: 0 };
  const aliadoSummary: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};
  const aliadoSummaryIn: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};

  movements.forEach((m) => {
    if (isInternalTransfer(m, wallets)) return;
    const px = safePrice(m, priceLookup);
    const usd = px ? px * m.amount : 0;
    if (effectiveIsFee(m, classifications)) { flowSummary.feeUsd += usd; return; }
    if (m.direction === "out") flowSummary.outUsd += usd; else flowSummary.inUsd += usd;

    const bucket = m.direction === "out" ? aliadoSummary : aliadoSummaryIn;
    const id = effectiveAliadoId(m, classifications, aliados) || "sin_clasificar";
    bucket[id] = bucket[id] || { id, assets: {}, count: 0, usdApprox: 0 };
    bucket[id].assets[m.asset] = (bucket[id].assets[m.asset] || 0) + m.amount;
    bucket[id].count += 1;
    if (px) bucket[id].usdApprox += px * m.amount;
  });

  const summaryRows = Object.values(aliadoSummary).sort((a, b) => b.usdApprox - a.usdApprox);
  const summaryRowsIn = Object.values(aliadoSummaryIn).sort((a, b) => b.usdApprox - a.usdApprox);

  return {
    generatedBy,
    generatedAt: Date.now(),
    dateFrom,
    dateTo,
    incompleteWallets,
    flowSummary,
    totalPortfolioValue: total,
    holdings: holdings.map((h) => ({ symbol: h.symbol, amount: h.amount, price: h.price, value: h.value })),
    movements: movements.map((m) => ({
      date: m.date, walletLabel: m.walletLabel || "", chain: m.chain, direction: m.direction,
      asset: m.asset, amount: m.amount, counterparty: m.counterparty,
      aliado: isInternalTransfer(m, wallets) ? "Transferencia interna" : effectiveIsFee(m, classifications) ? "Comisión de red" : nameFor(effectiveAliadoId(m, classifications, aliados) || "sin_clasificar", aliados),
      concepto: effectiveConcepto(m, classifications),
    })),
    aliadoOut: summaryRows.map((r) => ({ name: nameFor(r.id, aliados), assets: Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · "), usdApprox: r.usdApprox })),
    aliadoIn: summaryRowsIn.map((r) => ({ name: nameFor(r.id, aliados), assets: Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · "), usdApprox: r.usdApprox })),
  };
}
