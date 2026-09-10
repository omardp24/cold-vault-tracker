export const SYMBOL_COINGECKO: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", TRX: "tron",
  USDT: "tether", USDC: "usd-coin", DAI: "dai", USDS: "usds", BUSD: "binance-usd", TUSD: "true-usd", FDUSD: "first-digital-usd",
};
// Se usa el precio de mercado en vivo (como Ledger Live y el resto de wallets/exchanges) incluso
// para stablecoins, que en la práctica no cotizan a exactamente $1.00. FIXED_STABLECOINS solo entra
// como respaldo cuando no hay precio en vivo disponible (fallo de red, o un activo que ya no está
// en balance y por eso no tiene entrada en priceLookup) — nunca reemplaza al precio real cuando lo hay.
export const FIXED_STABLECOINS = new Set(["USDT", "USDC", "DAI", "USDS", "BUSD", "TUSD", "FDUSD"]);
