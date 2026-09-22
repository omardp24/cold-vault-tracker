import { useEffect, useRef, useState } from "react";
import { FIXED_STABLECOINS, SYMBOL_COINGECKO, SYMBOL_LOGO } from "@/lib/assets";
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

const CHAIN_TO_SYMBOL: Record<Chain, string> = { BTC: "BTC", ETH: "ETH", TRON: "TRX" };

/**
 * Logo real del activo (CDN de CoinGecko) cuando lo conocemos; si no hay logo mapeado para ese
 * símbolo, o si la imagen falla al cargar (sin red, CDN caído), cae al círculo de color con letra
 * que usaba toda la app antes — nunca se queda en un ícono roto.
 */
export function AssetIcon({
  symbol, size = 20, fallbackBg, fallbackFg, fallbackLabel,
}: { symbol: string; size?: number; fallbackBg?: string; fallbackFg?: string; fallbackLabel?: string }) {
  const [failed, setFailed] = useState(false);
  const src = SYMBOL_LOGO[symbol.toUpperCase()];
  if (src && !failed) {
    return (
      <img
        src={src} alt={symbol} width={size} height={size}
        className="rounded-full flex-shrink-0"
        style={{ width: size, height: size, objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="cv-chain-badge flex-shrink-0"
      style={{ width: size, height: size, background: fallbackBg || "var(--panel2)", color: fallbackFg || "var(--dim)", fontSize: size * (fallbackLabel ? 0.52 : 0.42) }}
    >
      {fallbackLabel || symbol.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ChainBadge({ chain, size = 20 }: { chain: Chain; size?: number }) {
  const c = CHAIN_BADGE[chain];
  return <AssetIcon symbol={CHAIN_TO_SYMBOL[chain]} size={size} fallbackBg={c.bg} fallbackFg={c.fg} fallbackLabel={c.label} />;
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

/**
 * Reemplazo de window.prompt() con el estilo de la app (window.prompt muestra un diálogo del
 * navegador con la URL del sitio — se ve roto/inseguro). Controlado por el padre: open/value van
 * por props, el padre decide qué hacer con el valor final vía onConfirm/onCancel.
 */
export function PromptModal({
  open, title, description, placeholder, confirmLabel = "Crear", onCancel, onConfirm,
}: {
  open: boolean; title: string; description?: string; placeholder?: string; confirmLabel?: string;
  onCancel: () => void; onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setValue("");
    const t = setTimeout(() => ref.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const submit = () => { const v = value.trim(); if (v) onConfirm(v); };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cv-pop absolute inset-0" style={{ background: "rgba(3,15,19,.6)", animationDuration: "0.15s" }} onClick={onCancel} />
      <div className="cv-pop relative w-full max-w-[360px] rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div className="font-display text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{title}</div>
        {description && <div className="text-[12.5px] mt-1" style={{ color: "var(--dim)" }}>{description}</div>}
        <input
          ref={ref} className="cv-input w-full mt-3" value={value} placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button className="cv-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="cv-btn" disabled={!value.trim()} onClick={submit}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Reemplazo de window.confirm() con el mismo criterio que PromptModal — ver su comentario. */
export function ConfirmModal({
  open, title, description, confirmLabel = "Confirmar", danger, onCancel, onConfirm,
}: {
  open: boolean; title: string; description?: string; confirmLabel?: string; danger?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); if (e.key === "Enter") onConfirm(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cv-pop absolute inset-0" style={{ background: "rgba(3,15,19,.6)", animationDuration: "0.15s" }} onClick={onCancel} />
      <div className="cv-pop relative w-full max-w-[360px] rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div className="font-display text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{title}</div>
        {description && <div className="text-[12.5px] mt-1.5" style={{ color: "var(--dim)" }}>{description}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button className="cv-btn-ghost" onClick={onCancel}>Cancelar</button>
          <button
            className="cv-btn" onClick={onConfirm}
            style={danger ? { background: "var(--neg)" } : undefined}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
