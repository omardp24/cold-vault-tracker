import type { Movement, BalanceResult } from "./types";

const KEY = () => process.env.ETHPLORER_KEY || "freekey";

// Contratos oficiales en mainnet — cualquier token que se declare con estos símbolos
// pero cuyo contrato NO coincida es, con altísima probabilidad, un token falso/spam
// usado para inflar montos falsos en el historial (scam de "address poisoning").
const OFFICIAL_ERC20: Record<string, string> = {
  // Ojo: 42 caracteres exactos. USDT y DAI estuvieron truncados (les faltaba el último
  // carácter) y TODO el USDT real se marcaba como "token falso", fuera de totales y estado de cuenta.
  USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
};

// Ethplorer limita las peticiones por segundo por clave. La app pide todas las wallets a la vez
// (saldo + historial), así que la segunda wallet ETH solía recibir 429 "Request limit is reached"
// y su historial no aparecía en Movimientos ni en el estado de cuenta. Mismo criterio que
// tronFetch(): reintentar con backoff exponencial + jitter. Ethplorer a veces responde el 429
// con HTTP 200 y el error en el cuerpo, por eso se mira también el JSON.
async function ethplorerJson(url: string): Promise<any> {
  const maxAttempts = 5;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    const d = res.ok || res.status === 429 ? await res.json().catch(() => null) : null;
    const limited = res.status === 429 || d?.error?.code === 429;
    if (limited && attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt) + Math.random() * 400));
      continue;
    }
    if (!res.ok && !limited) throw new Error(`Ethplorer HTTP ${res.status}`);
    if (!d) throw new Error(`Ethplorer HTTP ${res.status}`);
    if (d.error) throw new Error(d.error.message || "Ethplorer: respuesta inválida");
    return d;
  }
}

function isVerifiedToken(symbol: string, contractAddress?: string): boolean {
  const official = OFFICIAL_ERC20[symbol.toUpperCase()];
  if (!official) return true; // símbolo no está en nuestra lista de "sensibles" — no lo marcamos
  if (!contractAddress) return true; // el endpoint de historial no siempre trae el contrato — sin esa dato no acusamos nada
  return contractAddress.toLowerCase() === official;
}

export async function getEthBalance(address: string): Promise<BalanceResult> {
  const d = await ethplorerJson(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=${KEY()}`);
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
  const d = await ethplorerJson(`https://api.ethplorer.io/getAddressHistory/${address}?apiKey=${KEY()}&limit=100`);
  const out: Movement[] = [];
  // Ver el comentario equivalente en tron.ts: la clave no depende de la posición en la lista.
  const seenInTx: Record<string, number> = {};
  (d.operations || []).forEach((op: any) => {
    const occ = (seenInTx[op.transactionHash] = (seenInTx[op.transactionHash] ?? -1) + 1);
    const decimals = op.tokenInfo ? parseInt(op.tokenInfo.decimals || "18", 10) : 18;
    let amount = parseFloat(op.value || 0);
    if (op.tokenInfo) amount = amount / Math.pow(10, decimals);
    const direction = op.from?.toLowerCase() === address.toLowerCase() ? "out" : "in";
    const counterparty = direction === "out" ? op.to : op.from;
    const symbol = op.tokenInfo ? op.tokenInfo.symbol.toUpperCase() : "ETH";
    out.push({
      key: `ETH-${op.transactionHash}-${occ}`,
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
