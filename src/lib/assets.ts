export const SYMBOL_COINGECKO: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", TRX: "tron",
  USDT: "tether", USDC: "usd-coin", DAI: "dai", USDS: "usds", BUSD: "binance-usd", TUSD: "true-usd", FDUSD: "first-digital-usd",
};
// Se usa el precio de mercado en vivo (como Ledger Live y el resto de wallets/exchanges) incluso
// para stablecoins, que en la práctica no cotizan a exactamente $1.00. FIXED_STABLECOINS solo entra
// como respaldo cuando no hay precio en vivo disponible (fallo de red, o un activo que ya no está
// en balance y por eso no tiene entrada en priceLookup) — nunca reemplaza al precio real cuando lo hay.
export const FIXED_STABLECOINS = new Set(["USDT", "USDC", "DAI", "USDS", "BUSD", "TUSD", "FDUSD"]);

// Logos oficiales (CDN de CoinGecko, el mismo proveedor que ya usamos para precios) para los
// activos que la app conoce de antemano (ver SYMBOL_COINGECKO). AssetIcon en shared.tsx cae al
// círculo de color con letra si un símbolo no está acá o si la imagen no carga.
export const SYMBOL_LOGO: Record<string, string> = {
  BTC: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
  TRX: "https://coin-images.coingecko.com/coins/images/1094/large/photo_2026-04-13_09-59-16.png",
  USDT: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
  USDC: "https://coin-images.coingecko.com/coins/images/6319/large/USDC.png",
  DAI: "https://coin-images.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  USDS: "https://coin-images.coingecko.com/coins/images/39926/large/usds.webp",
  BUSD: "https://coin-images.coingecko.com/coins/images/9576/large/busd.png",
  TUSD: "https://coin-images.coingecko.com/coins/images/3449/large/tusd.png",
  FDUSD: "https://coin-images.coingecko.com/coins/images/31079/large/FDUSD_icon_black.png",
};
