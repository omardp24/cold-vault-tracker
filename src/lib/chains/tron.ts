import type { Movement, BalanceResult } from "./types";

const KNOWN_TRC20: Record<string, { symbol: string; decimals: number }> = {
  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: { symbol: "USDT", decimals: 6 },
  TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8: { symbol: "USDC", decimals: 6 },
};

function headers(): Record<string, string> {
  const key = process.env.TRONGRID_KEY;
  return key ? { "TRON-PRO-API-KEY": key } : {};
}

// Sin TRONGRID_KEY, el límite anónimo de TronGrid es bajo y se agota rápido si varias wallets
// se consultan casi al mismo tiempo (429 Too Many Requests). Reintenta con backoff exponencial +
// jitter (para que wallets que fallaron juntas no vuelvan a chocar en el mismo instante) antes de
// rendirse — normalmente el límite se libera en 1-2 segundos.
async function tronFetch(url: string): Promise<Response> {
  const maxAttempts = 4;
  let res: Response;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    res = await fetch(url, { headers: headers(), cache: "no-store" });
    if (res.status !== 429) return res;
    if (attempt === maxAttempts - 1) return res;
    const delay = 500 * Math.pow(2, attempt) + Math.random() * 250;
    await new Promise((r) => setTimeout(r, delay));
  }
  return res!;
}

export async function getTronBalance(address: string): Promise<BalanceResult> {
  const res = await tronFetch(`https://api.trongrid.io/v1/accounts/${address}`);
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const d = await res.json();
  if (d.success === false) throw new Error(d.error || "TronGrid: respuesta inválida");
  const acc = d.data && d.data[0];
  if (!acc) return { native: { symbol: "TRX", amount: 0 }, tokens: [] };
  const tokens: { symbol: string; amount: number }[] = [];
  for (const obj of acc.trc20 || []) {
    const [contract, raw] = Object.entries(obj)[0] as [string, string];
    const known = KNOWN_TRC20[contract];
    if (!known) continue;
    const amount = parseFloat(raw) / Math.pow(10, known.decimals);
    if (amount > 0) tokens.push({ symbol: known.symbol, amount });
  }
  return { native: { symbol: "TRX", amount: (acc.balance || 0) / 1e6 }, tokens };
}

export async function getTronHistory(address: string, cursor?: string | null): Promise<import("./types").HistoryPage> {
  const url = new URL(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("only_confirmed", "true");
  if (cursor) url.searchParams.set("fingerprint", cursor);
  const res = await tronFetch(url.toString());
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const d = await res.json();
  if (d.success === false) throw new Error(d.error || "TronGrid: respuesta inválida");
  const out: Movement[] = [];
  (d.data || []).forEach((t: any, idx: number) => {
    const decimals = parseInt(t.token_info?.decimals ?? 6, 10);
    const amount = parseFloat(t.value || 0) / Math.pow(10, decimals);
    const direction = t.from?.toLowerCase() === address.toLowerCase() ? "out" : "in";
    const counterparty = direction === "out" ? t.to : t.from;
    const symbol = t.token_info?.symbol || "TRC20";
    const contract = t.token_info?.address as string | undefined;
    const known = contract ? KNOWN_TRC20[contract] : undefined;
    // Si el símbolo dice ser USDT/USDC pero el contrato no es uno de los oficiales que reconocemos, es sospechoso.
    const claimsKnownSymbol = ["USDT", "USDC"].includes(symbol.toUpperCase());
    const verified = !claimsKnownSymbol || !contract ? true : !!known && known.symbol === symbol.toUpperCase();
    out.push({
      key: `TRON-${t.transaction_id}-${idx}`,
      chain: "TRON",
      txid: t.transaction_id,
      date: t.block_timestamp || null,
      direction,
      asset: symbol,
      amount,
      counterparty,
      otherCount: 0,
      explorer: `https://tronscan.org/#/transaction/${t.transaction_id}`,
      verified,
    });
  });
  // TronGrid devuelve un "fingerprint" en meta incluso cuando ya no quedan más páginas.
  // Si la página vino con menos resultados que el límite pedido, o si el fingerprint es
  // el mismo con el que pedimos, ya no hay más historial — si no, el botón de "cargar más"
  // quedaría activo para siempre trayendo cero resultados.
  const returned = (d.data || []).length;
  const nextFingerprint = d.meta?.fingerprint || null;
  const hasMore = returned >= 100 && nextFingerprint && nextFingerprint !== cursor;
  return { movements: out, nextCursor: hasMore ? nextFingerprint : null };
}
