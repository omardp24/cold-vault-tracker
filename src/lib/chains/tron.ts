import { createHash } from "crypto";
import type { Movement, BalanceResult } from "./types";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/** Dirección Tron en hex ("41…", como la devuelve /transactions) → base58 ("T…", como el resto de la app). */
function tronHexToBase58(hex: string): string {
  if (!hex || !/^41[0-9a-fA-F]{40}$/.test(hex)) return hex;
  const body = Buffer.from(hex, "hex");
  const sha = (b: Buffer) => createHash("sha256").update(b).digest();
  const full = Buffer.concat([body, sha(sha(body)).subarray(0, 4)]);
  let n = BigInt("0x" + full.toString("hex"));
  let out = "";
  const ZERO = BigInt(0), BASE = BigInt(58);
  while (n > ZERO) { out = B58[Number(n % BASE)] + out; n /= BASE; }
  return out;
}

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

// Transferencias de TRX nativo por debajo de esto son polvo de "address poisoning" (llegan a
// montones con 0,000001–0,00001 TRX); no son movimientos reales y solo embasuran la lista.
const TRX_MIN = 1;

interface StreamPage { movements: Movement[]; next: string | null; oldest: number | null }

/** TRX nativo (TransferContract). Sin esto no se veía el TRX recibido en un cambio USDT→TRX para
 * pagar gas, ni el TRX enviado entre tus propias wallets. */
async function getTrxPage(address: string, fingerprint: string | null): Promise<StreamPage> {
  const url = new URL(`https://api.trongrid.io/v1/accounts/${address}/transactions`);
  url.searchParams.set("limit", "200");
  url.searchParams.set("only_confirmed", "true");
  if (fingerprint) url.searchParams.set("fingerprint", fingerprint);
  const res = await tronFetch(url.toString());
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const d = await res.json();
  if (d.success === false) throw new Error(d.error || "TronGrid: respuesta inválida");
  const data: any[] = d.data || [];
  const movements: Movement[] = [];
  let oldest: number | null = null;
  for (const t of data) {
    if (t.block_timestamp && (oldest === null || t.block_timestamp < oldest)) oldest = t.block_timestamp;
    const c = t.raw_data?.contract?.[0];
    if (c?.type !== "TransferContract") continue;
    if (t.ret?.[0]?.contractRet && t.ret[0].contractRet !== "SUCCESS") continue;
    const v = c.parameter?.value || {};
    const amount = (v.amount || 0) / 1e6;
    if (amount < TRX_MIN) continue;
    const from = tronHexToBase58(v.owner_address), to = tronHexToBase58(v.to_address);
    const direction = from === address ? "out" : "in";
    movements.push({
      key: `TRON-${t.txID}-trx`,
      chain: "TRON",
      txid: t.txID,
      date: t.block_timestamp || null,
      direction,
      asset: "TRX",
      amount,
      counterparty: direction === "out" ? to : from,
      otherCount: 0,
      explorer: `https://tronscan.org/#/transaction/${t.txID}`,
      verified: true,
    });
  }
  const fp = d.meta?.fingerprint || null;
  return { movements, next: data.length >= 200 && fp && fp !== fingerprint ? fp : null, oldest };
}

// El cursor de una página combina los dos flujos (TRC20 y TRX nativo), cada uno con su propio
// fingerprint de TronGrid; null = ese flujo ya no tiene más. Un cursor viejo (texto plano) es
// solo de TRC20.
interface TronCursor { t: string | null; x: string | null }
function parseCursor(cursor?: string | null): { t: string | null | undefined; x: string | null | undefined } {
  if (!cursor) return { t: undefined, x: undefined }; // primera página de ambos
  if (cursor.startsWith("{")) { try { const c = JSON.parse(cursor) as TronCursor; return { t: c.t, x: c.x }; } catch { /* sigue abajo */ } }
  return { t: cursor, x: null };
}

export async function getTronHistory(address: string, cursor?: string | null): Promise<import("./types").HistoryPage> {
  const cur = parseCursor(cursor);
  const trc: StreamPage = cur.t === null ? { movements: [], next: null, oldest: null } : await getTrc20Page(address, cur.t ?? null);
  // TRX: se traen páginas hasta cubrir la misma ventana de tiempo que la página TRC20 (si TRC20 ya se
  // acabó, hasta el final), con tope para no alargar demasiado una sola carga.
  const trxMovs: Movement[] = [];
  let x: string | null = cur.x === undefined ? null : cur.x;
  let xDone = cur.x === null;
  for (let i = 0; i < 4 && !xDone; i++) {
    const p = await getTrxPage(address, x);
    trxMovs.push(...p.movements);
    x = p.next; xDone = !p.next;
    if (trc.next && trc.oldest !== null && p.oldest !== null && p.oldest < trc.oldest) break;
  }
  const next: TronCursor = { t: trc.next, x: xDone ? null : x };
  return {
    movements: [...trc.movements, ...trxMovs].sort((a, b) => (b.date || 0) - (a.date || 0)),
    nextCursor: next.t || next.x ? JSON.stringify(next) : null,
  };
}

async function getTrc20Page(address: string, cursor: string | null): Promise<StreamPage> {
  const url = new URL(`https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("only_confirmed", "true");
  if (cursor) url.searchParams.set("fingerprint", cursor);
  const res = await tronFetch(url.toString());
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const d = await res.json();
  if (d.success === false) throw new Error(d.error || "TronGrid: respuesta inválida");
  const out: Movement[] = [];
  // La clave NO puede usar la posición en la lista (idx): llega un movimiento nuevo y todas las
  // posiciones se corren, dejando huérfanos los conceptos ya guardados. Se numeran solo las
  // transferencias repetidas de una misma tx, que sí tienen un orden estable.
  const seenInTx: Record<string, number> = {};
  (d.data || []).forEach((t: any) => {
    const occ = (seenInTx[t.transaction_id] = (seenInTx[t.transaction_id] ?? -1) + 1);
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
      key: `TRON-${t.transaction_id}-${occ}`,
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
  const oldest = out.reduce((min: number | null, m) => (m.date && (min === null || m.date < min) ? m.date : min), null);
  return { movements: out, next: hasMore ? nextFingerprint : null, oldest };
}
