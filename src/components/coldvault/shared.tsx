import { useEffect, useRef, useState } from "react";
import { FIXED_STABLECOINS, SYMBOL_COINGECKO } from "@/lib/assets";
import { fmtAmt, fmtDate, fmtUSD, shortAddr } from "@/lib/format";
export { FIXED_STABLECOINS, SYMBOL_COINGECKO, fmtAmt, fmtDate, fmtUSD, shortAddr };

export type Chain = "BTC" | "ETH" | "TRON";

export interface Wallet { id: string; chain: Chain; address: string; label: string; }
export interface ManualHolding { id: string; coinId: string; symbol: string; qty: number; }
export interface AliadoAddress { chain: Chain; address: string; }
export interface Aliado { id: string; name: string; addresses: AliadoAddress[]; }
export interface Classification { aliadoId: string | null; concepto: string; isFee?: boolean; }
export interface Movement {
  key: string; chain: Chain; txid: string; date: number | null;
  direction: "in" | "out"; asset: string; amount: number;
  counterparty: string | null; otherCount: number; explorer: string;
  verified: boolean;
  walletLabel?: string;
}
export interface Holding { symbol: string; amount: number; price: number | null; value: number | null; }

export const CHAIN_LABEL: Record<Chain, string> = { BTC: "Bitcoin", ETH: "Ethereum", TRON: "Tron" };
export const CHAIN_COLORS = ["#F77B1C", "#008747", "#2E6B8C", "#82C35A", "#F8B345", "#B23A3A", "#E6E150"];

export const CHAIN_BADGE: Record<Chain, { bg: string; fg: string; label: string }> = {
  BTC: { bg: "#F8B345", fg: "#333333", label: "₿" },
  ETH: { bg: "#2E6B8C", fg: "#FFFFFF", label: "Ξ" },
  TRON: { bg: "#008747", fg: "#FFFFFF", label: "T" },
};

export function ChainBadge({ chain, size = 20 }: { chain: Chain; size?: number }) {
  const c = CHAIN_BADGE[chain];
  return (
    <span className="cv-chain-badge" style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: size * 0.52 }}>
      {c.label}
    </span>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    // El script inline en layout.tsx ya aplicó el atributo antes del primer paint —
    // esto solo sincroniza el estado de React con lo que quedó en el DOM.
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);
  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("cv-theme", next); } catch {}
      return next;
    });
  };
  return { theme, toggleTheme };
}

export function ValueCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = display;
    const delta = value - start;
    if (Math.abs(delta) < 0.005) { setDisplay(value); return; }
    const t0 = performance.now();
    const dur = 600;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setDisplay(start + delta * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <span>{fmtUSD(display)}</span>;
}
