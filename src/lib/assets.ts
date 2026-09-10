export const SYMBOL_COINGECKO: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", TRX: "tron", USDT: "tether", USDC: "usd-coin" };
// Stablecoins fiat-referenciados: para efectos contables se valoran a $1.00 fijo, no al precio
// de mercado fluctuante (que en la práctica oscila en centésimas sin significado real y no
// coincide exactamente con lo que muestran otros wallets/exchanges en un momento dado).
export const FIXED_STABLECOINS = new Set(["USDT", "USDC", "DAI", "USDS", "BUSD", "TUSD", "FDUSD"]);
