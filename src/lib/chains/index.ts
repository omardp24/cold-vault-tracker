import { getBtcBalance, getBtcHistory } from "./btc";
import { getEthBalance, getEthHistory } from "./eth";
import { getTronBalance, getTronHistory } from "./tron";
import type { Chain } from "../db";

// Registro central de redes. Para añadir una red nueva: crea su adaptador
// (getXBalance / getXHistory) y agrega una entrada aquí — nada más cambia.
export const CHAINS: Record<Chain, { label: string; coingeckoId: string }> = {
  BTC: { label: "Bitcoin", coingeckoId: "bitcoin" },
  ETH: { label: "Ethereum", coingeckoId: "ethereum" },
  TRON: { label: "Tron", coingeckoId: "tron" },
};

export const balanceFetchers = {
  BTC: getBtcBalance,
  ETH: getEthBalance,
  TRON: getTronBalance,
};

export const historyFetchers = {
  BTC: getBtcHistory,
  ETH: getEthHistory,
  TRON: getTronHistory,
};
