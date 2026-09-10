// Fuente: https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses
// Extrae direcciones de la lista SDN (Specially Designated Nationals) de la OFAC
// (Departamento del Tesoro de EE.UU.), actualizada cada noche por ese repositorio.
const BASE = "https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_";

const TICKERS_BY_CHAIN: Record<string, string[]> = {
  BTC: ["XBT"],
  ETH: ["ETH", "USDT", "USDC"],
  TRON: ["TRX", "USDT"],
};

interface Cache {
  timestamp: number;
  raw: Record<string, Set<string>>; // exacto, para BTC/TRON (base58, sensible a mayúsculas)
  lower: Record<string, Set<string>>; // en minúsculas, para ETH (hex)
}

let cache: Cache | null = null;
const TTL_MS = 60 * 60 * 1000; // 1 hora

async function fetchTicker(ticker: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}${ticker}.txt`, { cache: "no-store" });
    if (!res.ok) return [];
    const text = await res.text();
    return text.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function ensureCache(): Promise<Cache> {
  const now = Date.now();
  if (cache && now - cache.timestamp < TTL_MS) return cache;
  const allTickers = Array.from(new Set(Object.values(TICKERS_BY_CHAIN).flat()));
  const raw: Record<string, Set<string>> = {};
  const lower: Record<string, Set<string>> = {};
  await Promise.all(
    allTickers.map(async (t) => {
      const list = await fetchTicker(t);
      raw[t] = new Set(list);
      lower[t] = new Set(list.map((a) => a.toLowerCase()));
    })
  );
  cache = { timestamp: now, raw, lower };
  return cache;
}

export async function checkSanctioned(
  chain: "BTC" | "ETH" | "TRON",
  address: string
): Promise<{ sanctioned: boolean; lists: string[]; lastChecked: number }> {
  const c = await ensureCache();
  const tickers = TICKERS_BY_CHAIN[chain] || [];
  const matches: string[] = [];
  for (const t of tickers) {
    const hit = chain === "ETH" ? c.lower[t]?.has(address.toLowerCase()) : c.raw[t]?.has(address);
    if (hit) matches.push(t);
  }
  return { sanctioned: matches.length > 0, lists: matches, lastChecked: c.timestamp };
}
