export async function fetchPrices(ids: string[]): Promise<Record<string, { usd: number }>> {
  if (ids.length === 0) return {};
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`, { cache: "no-store" });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  return res.json();
}
