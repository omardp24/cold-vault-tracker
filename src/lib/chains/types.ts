export interface Movement {
  key: string;
  chain: "BTC" | "ETH" | "TRON";
  txid: string;
  date: number | null; // epoch ms
  direction: "in" | "out";
  asset: string;
  amount: number;
  counterparty: string | null;
  otherCount: number;
  explorer: string;
  verified: boolean; // false = el token dice ser USDT/DAI/etc pero el contrato no coincide con el oficial (posible token falso)
}

export interface BalanceResult {
  native: { symbol: string; amount: number };
  tokens: { symbol: string; amount: number; priceUsd?: number }[];
}

export interface HistoryPage {
  movements: Movement[];
  nextCursor: string | null;
}
