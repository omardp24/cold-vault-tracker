import type { Movement, BalanceResult } from "./types";

const KEY = () => process.env.ETHPLORER_KEY || "freekey";

// Contratos oficiales en mainnet — cualquier token que se declare con estos símbolos
// pero cuyo contrato NO coincida es, con altísima probabilidad, un token falso/spam
// usado para inflar montos falsos en el historial (scam de "address poisoning").
const OFFICIAL_ERC20: Record<string, string> = {
  USDT: "0xdac17f958d2ee523a2206206994597c13d831ec",
  USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  DAI: "0x6b175474e89094c44da98b954eedeac495271d0",
};

function isVerifiedToken(symbol: string, contractAddress?: string): boolean {
  const official = OFFICIAL_ERC20[symbol.toUpperCase()];
  if (!official) return true; // símbolo no está en nuestra lista de "sensibles" — no lo marcamos
  if (!contractAddress) return true; // el endpoint de historial no siempre trae el contrato — sin esa dato no acusamos nada
  return contractAddress.toLowerCase() === official;
}

export async function getEthBalance(address: string): Promise<BalanceResult> {
  const res = await fetch(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=${KEY()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Ethplorer HTTP ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || "Ethplorer: respuesta inválida");
  const tokens: { symbol: string; amount: number; priceUsd?: number }[] = [];
  for (const t of d.tokens || []) {
    const info = t.tokenInfo;
    if (!info?.symbol) continue;
    const decimals = parseInt(info.decimals || "18", 10);
    const amount = t.balance / Math.pow(10, decimals);
    if (amount <= 0) continue;
    tokens.push({ symbol: info.symbol.toUpperCase(), amount, priceUsd: info.price?.rate || undefined });
  }
  return { native: { symbol: "ETH", amount: d.ETH?.balance || 0 }, tokens };
}

export async function getEthHistory(address: string, cursor?: string | null): Promise<import("./types").HistoryPage> {
  const res = await fetch(`https://api.ethplorer.io/getAddressHistory/${address}?apiKey=${KEY()}&limit=100`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Ethplorer HTTP ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || "Ethplorer: respuesta inválida");
  const out: Movement[] = [];
  (d.operations || []).forEach((op: any, idx: number) => {
    const decimals = op.tokenInfo ? parseInt(op.tokenInfo.decimals || "18", 10) : 18;
    let amount = parseFloat(op.value || 0);
    if (op.tokenInfo) amount = amount / Math.pow(10, decimals);
    const direction = op.from?.toLowerCase() === address.toLowerCase() ? "out" : "in";
    const counterparty = direction === "out" ? op.to : op.from;
    const symbol = op.tokenInfo ? op.tokenInfo.symbol.toUpperCase() : "ETH";
    out.push({
      key: `ETH-${op.transactionHash}-${idx}`,
      chain: "ETH",
      txid: op.transactionHash,
      date: op.timestamp ? op.timestamp * 1000 : null,
      direction,
      asset: symbol,
      amount,
      counterparty,
      otherCount: 0,
      explorer: `https://etherscan.io/tx/${op.transactionHash}`,
      verified: op.tokenInfo ? isVerifiedToken(symbol, op.tokenInfo.address) : true,
    });
  });
  // Ethplorer no ofrece paginación por cursor en este endpoint gratuito.
  return { movements: out, nextCursor: null };
}
