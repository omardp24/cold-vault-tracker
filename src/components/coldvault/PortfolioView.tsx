"use client";

import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Copy, Download, ExternalLink, Layers, Minus, Pencil, Plus, RefreshCw, Trash2, Wallet as WalletIcon } from "lucide-react";
import {
  AssetIcon, CHAIN_LABEL, ChainBadge, Chain, FIXED_STABLECOINS, Holding, ManualHolding, Sheet, ValueCounter, Wallet,
  fmtAmt, fmtUSD, shortAddr,
} from "./shared";
import EvolutionChart, { PortfolioHistoryPoint, HistoryRange } from "./EvolutionChart";

interface GasNow { btc: any; eth: any; tron: any; }
type BalanceEntry = { loading: boolean; error: string | null; detail: string | null };

export interface PortfolioViewProps {
  total: number;
  wallets: Wallet[];
  fetchAll: () => void;
  refreshing: boolean;
  autoRefresh: boolean;
  setAutoRefresh: Dispatch<SetStateAction<boolean>>;
  lastUpdated: Date | null;
  incompleteWallets: string[];
  errMsg: string;
  chain: Chain;
  setChain: Dispatch<SetStateAction<Chain>>;
  labelInput: string;
  setLabelInput: Dispatch<SetStateAction<string>>;
  addrInput: string;
  setAddrInput: Dispatch<SetStateAction<string>>;
  addWallet: () => void;
  addWalletError: string;
  balances: Record<string, BalanceEntry>;
  removeWallet: (id: string) => void;
  renameWallet: (id: string, label: string) => void;
  manual: ManualHolding[];
  manualCoinId: string;
  setManualCoinId: Dispatch<SetStateAction<string>>;
  manualSymbol: string;
  setManualSymbol: Dispatch<SetStateAction<string>>;
  manualQty: string;
  setManualQty: Dispatch<SetStateAction<string>>;
  addManual: () => void;
  removeManual: (id: string) => void;
  pieData: { name: string; value: number }[];
  holdings: Holding[];
  colorForSymbol: Record<string, string>;
  loadGasFees: () => void;
  gasLoading: boolean;
  gasNow: GasNow;
  history: PortfolioHistoryPoint[];
  historyLoading: boolean;
  historyRange: HistoryRange;
  setHistoryRange: (r: HistoryRange) => void;
  vesRates: { bcv: number | null; paralelo: number | null };
  walletUsd: Record<string, number>;
}

const EXPLORER_ADDR: Record<Chain, (a: string) => string> = {
  BTC: (a) => `https://mempool.space/address/${a}`,
  ETH: (a) => `https://etherscan.io/address/${a}`,
  TRON: (a) => `https://tronscan.org/#/address/${a}`,
};

/** Indicador de la portada: etiqueta arriba, dato grande, nota opcional debajo. */
function StatTile({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <div className="cv-card p-3.5 sm:p-4 flex flex-col justify-between gap-2 min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0 font-mono text-[19px] sm:text-[21px] font-bold leading-tight" style={{ color: "var(--ink)" }}>{children}</div>
        {note && <div className="text-[11px] mt-1 truncate" style={{ color: "var(--faint)" }}>{note}</div>}
      </div>
    </div>
  );
}

function WalletCard({ wallet, balance, usd, share, onOpen }: { wallet: Wallet; balance: BalanceEntry; usd?: number; share: number; onOpen: () => void }) {
  const chips = (balance.detail || "").split(" · ").filter(Boolean);
  return (
    <button
      onClick={onOpen}
      className="cv-card cv-card-hover cv-wallet-card text-left p-4 flex flex-col gap-3 min-w-0"
      style={{ color: "var(--ink)", cursor: "pointer" }}
    >
      <div className="flex items-center gap-2.5 min-w-0 w-full">
        <ChainBadge chain={wallet.chain} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold truncate">{wallet.label}</div>
          <div className="font-addr text-[11px]" style={{ color: "var(--faint)" }}>{shortAddr(wallet.address)}</div>
        </div>
        <ChevronRight size={15} className="flex-shrink-0" style={{ color: "var(--faint)" }} />
      </div>
      {balance.loading ? (
        <>
          <span className="cv-skeleton" style={{ width: 130, height: 24 }} />
          <div className="flex gap-1.5"><span className="cv-skeleton" style={{ width: 92, height: 20, borderRadius: 9999 }} /><span className="cv-skeleton" style={{ width: 70, height: 20, borderRadius: 9999 }} /></div>
        </>
      ) : balance.error ? (
        <div className="text-[12px]" style={{ color: "var(--neg)" }}>{balance.error}</div>
      ) : (
        <>
          <div className="font-mono text-[20px] font-bold leading-none whitespace-nowrap">{usd !== undefined ? fmtUSD(usd) : "—"}</div>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((part) => (
              <span key={part} className="whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px]" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>{part}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-auto w-full" title={`${(share * 100).toFixed(1)}% del portafolio`}>
            <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: "var(--panel2)" }}>
              <div className="h-full rounded-full" style={{ width: `${share > 0 ? Math.max(share * 100, 1.5) : 0}%`, background: "linear-gradient(90deg, var(--accent), var(--amber))", transition: "width .6s cubic-bezier(.2,.8,.3,1)" }} />
            </div>
            <span className="font-mono text-[10.5px] flex-shrink-0" style={{ color: "var(--dim)" }}>{(share * 100).toFixed(share > 0 && share < 0.1 ? 1 : 0)}%</span>
          </div>
        </>
      )}
    </button>
  );
}

/** Detalle de una wallet: dirección completa, copiar, explorador, evolución 90 días, renombrar y quitar. */
function WalletDetail({ wallet, balance, usd, share, onClose, onRemove, onRename }: { wallet: Wallet; balance: BalanceEntry; usd?: number; share: number; onClose: () => void; onRemove: () => void; onRename: (label: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(wallet.label);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/wallets/${wallet.id}/history?range=90d`);
        const d = await res.json();
        if (alive && res.ok) setHistory(d);
      } catch { /* el mini-gráfico simplemente queda vacío */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [wallet.id]);

  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin permiso del portapapeles */ }
  };
  const confirmEdit = () => {
    const clean = editValue.trim();
    if (clean && clean !== wallet.label) onRename(clean);
    setEditing(false);
  };
  const chips = (balance.detail || "").split(" · ").filter(Boolean);

  return (
    <Sheet title={wallet.label} onClose={onClose}>
      <div className="flex items-center gap-3 mb-3">
        <ChainBadge chain={wallet.chain} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px]" style={{ color: "var(--faint)" }}>{CHAIN_LABEL[wallet.chain]}{share > 0 && ` · ${(share * 100).toFixed(1)}% del portafolio`}</div>
          <div className="font-mono text-[24px] font-bold leading-tight whitespace-nowrap" style={{ color: "var(--ink)" }}>
            {balance.loading ? <span className="cv-skeleton inline-block" style={{ width: 140, height: 24 }} /> : balance.error || usd === undefined ? "—" : fmtUSD(usd)}
          </div>
        </div>
      </div>
      {balance.error && <div className="text-[12px] mb-3" style={{ color: "var(--neg)" }}>{balance.error}</div>}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((part) => (
            <span key={part} className="whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-[12px]" style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--ink)" }}>{part}</span>
          ))}
        </div>
      )}

      <div className="rounded-xl p-3 mb-3" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
        <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Dirección completa</div>
        <div className="font-addr text-[11.5px] break-all" style={{ color: "var(--dim)" }}>{wallet.address}</div>
        <div className="flex gap-2 mt-2.5">
          <button className="cv-btn-ghost cv-icon-btn" onClick={copyAddress}>{copied ? <><Check size={12} /> ¡Copiada!</> : <><Copy size={12} /> Copiar</>}</button>
          <a className="cv-btn-ghost cv-icon-btn" href={EXPLORER_ADDR[wallet.chain](wallet.address)} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Explorador</a>
        </div>
      </div>

      <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Evolución · 90 días</div>
      <EvolutionChart history={history} loading={loading} />

      <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus className="cv-input flex-1 min-w-0" value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") { e.stopPropagation(); setEditing(false); } }}
            />
            <button className="cv-btn" onClick={confirmEdit}>Guardar</button>
            <button className="cv-btn-ghost" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="cv-btn-ghost cv-icon-btn justify-center flex-1" onClick={() => { setEditValue(wallet.label); setEditing(true); }}><Pencil size={13} /> Renombrar</button>
            <button className="cv-btn-ghost cv-icon-btn justify-center flex-1" style={{ color: "var(--neg)" }} onClick={onRemove}><Trash2 size={13} /> Quitar</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

const pctLabel = (pct: number | null) => (pct === null ? "—" : `${pct < 0.1 ? "<0.1" : pct.toFixed(1)}%`);

export default function PortfolioView({
  total, wallets, fetchAll, refreshing, autoRefresh, setAutoRefresh, lastUpdated, incompleteWallets, errMsg,
  chain, setChain, labelInput, setLabelInput, addrInput, setAddrInput, addWallet, addWalletError, balances, removeWallet, renameWallet,
  manual, manualCoinId, setManualCoinId, manualSymbol, setManualSymbol, manualQty, setManualQty, addManual, removeManual,
  holdings, colorForSymbol, loadGasFees, gasLoading, gasNow,
  history, historyLoading, historyRange, setHistoryRange, vesRates, walletUsd,
}: PortfolioViewProps) {
  const [sheet, setSheet] = useState<null | "wallet" | "manual">(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailWallet = detailId ? wallets.find((w) => w.id === detailId) || null : null;

  // La hoja de alta se cierra sola cuando el alta salió bien (la lista creció); si hubo error se queda
  // abierta mostrando el motivo.
  const walletCount = useRef(wallets.length);
  const manualCount = useRef(manual.length);
  useEffect(() => {
    if (wallets.length > walletCount.current) setSheet((s) => (s === "wallet" ? null : s));
    walletCount.current = wallets.length;
  }, [wallets.length]);
  useEffect(() => {
    if (manual.length > manualCount.current) setSheet((s) => (s === "manual" ? null : s));
    manualCount.current = manual.length;
  }, [manual.length]);

  // Variación frente al último snapshot diario guardado (solo si el total está completo: con una wallet sin
  // leer, la diferencia sería un salto falso).
  const lastSnap = history.length > 0 ? history[history.length - 1] : null;
  const delta = lastSnap && incompleteWallets.length === 0 && total > 0 ? total - lastSnap.value : null;
  const deltaPct = delta !== null && lastSnap && lastSnap.value > 0 ? (delta / lastSnap.value) * 100 : null;
  const deltaDir = delta === null ? null : Math.abs(delta) < 0.5 ? "flat" : delta > 0 ? "up" : "down";

  // Indicadores de la portada.
  const priced = holdings.filter((h) => (h.value || 0) > 0);
  const stableValue = priced.filter((h) => FIXED_STABLECOINS.has(h.symbol.toUpperCase())).reduce((s, h) => s + (h.value || 0), 0);
  const stablePct = total > 0 ? (stableValue / total) * 100 : null;
  const top = priced[0] || null; // holdings ya viene ordenado por valor
  const topPct = top && total > 0 ? ((top.value || 0) / total) * 100 : null;
  const chainsUsed = (["BTC", "ETH", "TRON"] as Chain[]).filter((c) => wallets.some((w) => w.chain === c));
  const reading = refreshing || wallets.some((w) => (balances[w.id] || { loading: true }).loading);
  const status = incompleteWallets.length > 0
    ? { color: "var(--neg)", text: `${incompleteWallets.length} sin leer`, live: false }
    : reading ? { color: "var(--amber)", text: "Leyendo…", live: false }
    : { color: "var(--pos)", text: "Todo leído", live: true };

  const exportCsv = () => {
    const header = ["Activo", "Cantidad", "Precio", "Valor", "Asignación %"];
    const lines = holdings.map((h) => [
      h.symbol, h.amount.toString(), h.price?.toString() || "", h.value?.toString() || "",
      total > 0 && h.value ? ((h.value / total) * 100).toFixed(1) : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `tenencias_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const gasTiles: { label: string; stale: boolean; value: string }[] = [
    { label: "BTC", stale: !!gasNow.btc?.stale, value: gasNow.btc?.levels ? `${gasNow.btc.levels[1]?.detail?.split(" ")[0] || "—"} sat/vB` : "—" },
    { label: "ETH", stale: !!gasNow.eth?.stale, value: gasNow.eth?.levels ? `${gasNow.eth.levels[0]?.detail?.split(" ")[0] || "—"} gwei` : "—" },
    { label: "TRON", stale: !!gasNow.tron?.stale, value: gasNow.tron?.levels ? `${fmtAmt(gasNow.tron.levels[1]?.fee, 2)} TRX` : "—" },
  ];

  return (
    <>
      {/* Portada: total + evolución en un solo bloque, con los cuatro indicadores al lado (debajo en teléfono) */}
      <div className="cv-stagger grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 sm:gap-4 mb-5 items-stretch">
        <div className="cv-card overflow-hidden flex flex-col">
          <div className="p-4 sm:p-6 pb-0 sm:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="cv-eyebrow flex items-center gap-1.5 pt-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${status.live ? "cv-live" : ""}`} style={{ background: status.color }} />
                Portafolio total
              </div>
              <button
                className="cv-icon-btn justify-center rounded-full flex-shrink-0"
                style={{ width: 40, height: 40, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--accent)", cursor: refreshing ? "default" : "pointer" }}
                onClick={fetchAll} disabled={refreshing} title={refreshing ? "Actualizando…" : "Actualizar ahora"} aria-label="Actualizar ahora"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="font-mono font-bold whitespace-nowrap leading-none mt-1" style={{ color: "var(--ink)", fontSize: "clamp(26px, 8.4vw, 46px)", letterSpacing: "-0.02em" }}>
              <ValueCounter value={total} />
            </div>
            <div className="mt-3 flex items-center gap-x-2.5 gap-y-1.5 flex-wrap">
              {deltaDir && delta !== null && (
                <>
                  <span className="cv-delta cv-tab-in" data-dir={deltaDir}>
                    {deltaDir === "up" ? <ArrowUpRight size={13} /> : deltaDir === "down" ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                    {delta >= 0 ? "+" : "−"}{fmtUSD(Math.abs(delta))}{deltaPct !== null && ` (${deltaPct >= 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(1)}%)`}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--faint)" }}>vs. el cierre diario del {lastSnap!.date}</span>
                </>
              )}
            </div>
            {(vesRates.bcv || vesRates.paralelo) && (
              <div className="text-[11.5px] font-mono mt-2" style={{ color: "var(--dim)" }}>
                {vesRates.bcv && <>≈ Bs {(total * vesRates.bcv).toLocaleString("es-VE", { maximumFractionDigits: 0 })} <span style={{ color: "var(--faint)" }}>BCV</span></>}
                {vesRates.bcv && vesRates.paralelo && <span style={{ color: "var(--faint)" }}> · </span>}
                {vesRates.paralelo && <>Bs {(total * vesRates.paralelo).toLocaleString("es-VE", { maximumFractionDigits: 0 })} <span style={{ color: "var(--faint)" }}>paralelo</span></>}
              </div>
            )}
            {incompleteWallets.length > 0 && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: "rgba(255,107,90,.12)", border: "1px solid var(--neg)", color: "var(--neg)" }}>
                ⚠ <strong>Total incompleto</strong> — no se pudo leer el saldo de: {incompleteWallets.join(", ")}.
              </div>
            )}
            {errMsg && <div className="mt-3 text-xs" style={{ color: "var(--neg)" }}>{errMsg}</div>}

            <div className="flex items-center justify-between mt-4 mb-1">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>Evolución</div>
              <div className="flex rounded-full p-1" style={{ background: "var(--panel2)" }}>
                {(["7d", "90d", "1y"] as HistoryRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setHistoryRange(r)}
                    className="rounded-full px-3 py-1.5 text-[10.5px] font-semibold"
                    style={{ background: historyRange === r ? "var(--accent)" : "transparent", color: historyRange === r ? "#fff" : "var(--dim)", border: "none", cursor: "pointer" }}
                  >
                    {r === "7d" ? "7D" : r === "90d" ? "90D" : "Año"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* La gráfica va de borde a borde de la tarjeta */}
          <div className="flex-1 flex flex-col justify-end">
            <EvolutionChart history={history} loading={historyLoading} />
          </div>
          <div className="px-4 sm:px-6 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: "var(--line)" }}>
            <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer" style={{ color: "var(--dim)" }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Auto cada 60s
            </label>
            {lastUpdated && <span className="text-[11px] font-mono" style={{ color: "var(--faint)" }}>Última lectura {lastUpdated.toLocaleTimeString("es-VE")}</span>}
          </div>
        </div>

        <div className="cv-stagger grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile label="Wallets" note={chainsUsed.length > 0 ? chainsUsed.map((c) => CHAIN_LABEL[c]).join(" · ") : "Aún sin direcciones"}>
            <span>{wallets.length}</span>
            <span className="flex items-center -space-x-1.5">
              {chainsUsed.map((c) => <ChainBadge key={c} chain={c} size={20} />)}
            </span>
          </StatTile>
          <StatTile label="Stablecoins" note={stablePct !== null ? `${fmtUSD(stableValue)} en dólares estables` : "Sin datos todavía"}>
            <span>{stablePct !== null ? `${stablePct.toFixed(1)}%` : "—"}</span>
          </StatTile>
          <StatTile label="Concentración" note={top ? fmtUSD(top.value) : "Sin datos todavía"}>
            {top ? <><AssetIcon symbol={top.symbol} size={22} /><span className="truncate">{top.symbol}</span><span style={{ color: "var(--accent)" }}>{topPct !== null ? `${topPct.toFixed(0)}%` : ""}</span></> : <span>—</span>}
          </StatTile>
          <StatTile label="Estado de lectura" note={lastUpdated ? `a las ${lastUpdated.toLocaleTimeString("es-VE")}` : "Esperando primera lectura"}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.live ? "cv-live" : ""}`} style={{ background: status.color }} />
            <span className="font-display text-[15px] sm:text-[16px] truncate" style={{ fontFamily: "var(--font-display)" }}>{status.text}</span>
          </StatTile>
        </div>
      </div>

      {/* Wallets: carrusel en teléfono, cuadrícula en escritorio */}
      <div className="flex items-center justify-between gap-3 mb-2.5 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <WalletIcon size={16} strokeWidth={2.25} style={{ color: "var(--dim)" }} />
          <div className="font-display text-sm font-semibold truncate">Direcciones rastreadas</div>
          {wallets.length > 0 && <span className="font-mono text-[11px] rounded-full px-2 py-0.5" style={{ background: "var(--panel2)", color: "var(--dim)" }}>{wallets.length}</span>}
        </div>
        <button className="cv-btn-ghost cv-icon-btn flex-shrink-0" onClick={() => setSheet("wallet")}><Plus size={13} /> Añadir</button>
      </div>
      {wallets.length === 0 && (
        <div className="text-[12.5px] mb-2.5 px-0.5" style={{ color: "var(--dim)" }}>Copia la dirección pública desde Ledger Live (nunca la clave privada).</div>
      )}
      <div className="cv-wallet-rail mb-5">
        {wallets.map((w) => {
          const b = balances[w.id] || { loading: true, error: null, detail: null };
          return <WalletCard key={w.id} wallet={w} balance={b} usd={walletUsd[w.id]} share={total > 0 && walletUsd[w.id] ? walletUsd[w.id] / total : 0} onOpen={() => setDetailId(w.id)} />;
        })}
        <button
          onClick={() => setSheet("wallet")}
          className="cv-wallet-card rounded-[14px] p-4 flex flex-col items-center justify-center gap-2 text-[12.5px] font-medium"
          style={{ border: "1.5px dashed var(--line2)", background: "transparent", color: "var(--dim)", cursor: "pointer", minHeight: 132 }}
        >
          <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--tint)", color: "var(--accent)" }}><Plus size={18} /></span>
          Añadir wallet
        </button>
      </div>

      {/* Asignación y tenencias: la barra apilada sustituye a la dona y la lista hace de leyenda */}
      <div className="cv-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-2 min-w-0"><Layers size={16} strokeWidth={2.25} style={{ color: "var(--dim)" }} /><div className="font-display text-sm font-semibold truncate">Asignación y tenencias</div></div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:block"><button className="cv-btn-ghost cv-icon-btn" onClick={() => setSheet("manual")}><Plus size={13} /> Activo manual</button></span>
            {holdings.length > 0 && <button className="cv-btn-ghost cv-icon-btn" onClick={exportCsv}><Download size={13} /> <span className="hidden sm:inline">Exportar </span>CSV</button>}
          </div>
        </div>
        {holdings.length === 0 ? (
          <div className="text-[12.5px] py-4" style={{ color: "var(--dim)" }}>Añade una dirección o un activo manual para ver tu portafolio.</div>
        ) : (
          <>
            {priced.length > 0 && (
              <div className="flex h-3 rounded-full overflow-hidden gap-[2px] mb-4" style={{ background: "var(--panel2)" }} role="img" aria-label="Distribución del portafolio por activo">
                {priced.map((h) => (
                  <div
                    key={h.symbol}
                    title={`${h.symbol} · ${pctLabel(total > 0 ? ((h.value || 0) / total) * 100 : null)}`}
                    style={{ width: `${total > 0 ? ((h.value || 0) / total) * 100 : 0}%`, minWidth: 3, background: colorForSymbol[h.symbol] || "var(--line2)", transition: "width .6s cubic-bezier(.2,.8,.3,1)" }}
                  />
                ))}
              </div>
            )}

            {/* Teléfono: filas compactas */}
            <div className="md:hidden">
              {holdings.map((h) => {
                const pct = total > 0 && h.value ? (h.value / total) * 100 : null;
                return (
                  <div key={h.symbol} className="flex items-center gap-3 py-2.5 border-t" style={{ borderColor: "var(--line)" }}>
                    <span className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: colorForSymbol[h.symbol] || "var(--line2)" }} />
                    <AssetIcon symbol={h.symbol} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{h.symbol}</span>
                        <span className="font-mono text-[10.5px] rounded-full px-1.5 py-0.5" style={{ background: "var(--panel2)", color: "var(--dim)" }}>{pctLabel(pct)}</span>
                      </div>
                      <div className="font-mono text-[11.5px] truncate" style={{ color: "var(--dim)" }}>{fmtAmt(h.amount, 4)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-[14px] font-bold" style={{ color: "var(--ink)" }}>{fmtUSD(h.value)}</div>
                      <div className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>{fmtUSD(h.price)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escritorio: tabla con mini barra de asignación */}
            <table className="w-full border-collapse hidden md:table">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                <th className="p-2 font-semibold">Activo</th><th className="p-2 font-semibold text-right">Cantidad</th><th className="p-2 font-semibold text-right">Precio</th><th className="p-2 font-semibold text-right">Valor</th><th className="p-2 pl-6 font-semibold" style={{ width: "26%" }}>Asignación</th>
              </tr></thead>
              <tbody>
                {holdings.map((h) => {
                  const pct = total > 0 && h.value ? (h.value / total) * 100 : null;
                  return (
                    <tr key={h.symbol} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="p-2 font-medium" style={{ color: "var(--ink)" }}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorForSymbol[h.symbol] || "var(--line2)" }} />
                          <AssetIcon symbol={h.symbol} size={20} />{h.symbol}
                        </div>
                      </td>
                      <td className="p-2 font-mono text-right text-[13px]" style={{ color: "var(--dim)" }}>{fmtAmt(h.amount)}</td>
                      <td className="p-2 font-mono text-right text-[13px]" style={{ color: "var(--dim)" }}>{fmtUSD(h.price)}</td>
                      <td className="p-2 font-mono text-right font-semibold" style={{ color: "var(--ink)" }}>{fmtUSD(h.value)}</td>
                      <td className="p-2 pl-6">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "var(--panel2)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: colorForSymbol[h.symbol] || "var(--line2)" }} />
                          </div>
                          <span className="font-mono text-xs w-12 text-right" style={{ color: pct !== null ? "var(--ink)" : "var(--faint)" }}>{pctLabel(pct)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {manual.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-dashed" style={{ borderColor: "var(--line)" }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--faint)" }}>Activos manuales</div>
            <div className="flex flex-wrap gap-2">
              {manual.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-full pl-3 pr-1 font-mono text-[12px]" style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                  {fmtAmt(m.qty)} {m.symbol}
                  <button className="cv-x" onClick={() => removeManual(m.id)} title="Quitar" aria-label={`Quitar ${m.symbol}`}>✕</button>
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          className="sm:hidden w-full mt-3.5 rounded-xl py-3 text-[12.5px] font-medium inline-flex items-center justify-center gap-1.5"
          style={{ border: "1.5px dashed var(--line2)", background: "transparent", color: "var(--dim)", cursor: "pointer" }}
          onClick={() => setSheet("manual")}
        >
          <Plus size={14} /> Añadir activo manual
        </button>
      </div>

      {/* Comisiones de red — solo móvil (en escritorio va en la barra lateral) */}
      <div className="md:hidden mt-4 cv-card px-3.5 py-2.5 flex items-center gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider flex-shrink-0" style={{ color: "var(--faint)" }}>Red ahora</div>
        <div className="flex-1 min-w-0 flex items-center justify-end gap-x-3 gap-y-1 flex-wrap font-mono text-[11.5px]" style={{ color: "var(--ink)" }}>
          {gasTiles.map((g) => (
            <span key={g.label} className="whitespace-nowrap"><span style={{ color: "var(--faint)" }}>{g.label}{g.stale && " ⚠"}</span> {g.value}</span>
          ))}
        </div>
        <button onClick={loadGasFees} disabled={gasLoading} className="flex-shrink-0 flex items-center justify-center" style={{ background: "none", border: "none", color: "var(--accent)", width: 32, height: 32, cursor: "pointer" }} title="Actualizar comisiones" aria-label="Actualizar comisiones">
          <RefreshCw size={14} className={gasLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {sheet === "wallet" && (
        <Sheet title="Añadir wallet" onClose={() => setSheet(null)}>
          <div className="text-[12.5px] mb-3" style={{ color: "var(--dim)" }}>Solo la dirección pública, copiada desde Ledger Live. Nunca la clave privada ni la frase semilla.</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="cv-select w-full" value={chain} onChange={(e) => setChain(e.target.value as Chain)} aria-label="Red">
              {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_LABEL[c]}</option>)}
            </select>
            <input className="cv-input w-full" placeholder="Etiqueta" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
            <input className="cv-input col-span-2" placeholder="Dirección pública" value={addrInput} onChange={(e) => setAddrInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addWallet(); }} />
          </div>
          {addWalletError && <div className="text-[12px] mt-2" style={{ color: "var(--neg)" }}>{addWalletError}</div>}
          <button className="cv-btn w-full mt-3.5" onClick={addWallet}>Añadir wallet</button>
        </Sheet>
      )}

      {sheet === "manual" && (
        <Sheet title="Otro activo (manual)" onClose={() => setSheet(null)}>
          <div className="text-[12.5px] mb-3" style={{ color: "var(--dim)" }}>Para activos que no están en una dirección rastreada. El precio se toma de CoinGecko.</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="cv-input col-span-2" placeholder="id CoinGecko (ej. solana)" value={manualCoinId} onChange={(e) => setManualCoinId(e.target.value)} />
            <input className="cv-input w-full" placeholder="símbolo" value={manualSymbol} onChange={(e) => setManualSymbol(e.target.value)} />
            <input className="cv-input w-full" placeholder="cantidad" inputMode="decimal" value={manualQty} onChange={(e) => setManualQty(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addManual(); }} />
          </div>
          <button className="cv-btn w-full mt-3.5" onClick={addManual}>Añadir activo</button>
        </Sheet>
      )}

      {detailWallet && (
        <WalletDetail
          wallet={detailWallet}
          balance={balances[detailWallet.id] || { loading: true, error: null, detail: null }}
          usd={walletUsd[detailWallet.id]}
          share={total > 0 && walletUsd[detailWallet.id] ? walletUsd[detailWallet.id] / total : 0}
          onClose={() => setDetailId(null)}
          onRemove={() => removeWallet(detailWallet.id)}
          onRename={(label) => renameWallet(detailWallet.id, label)}
        />
      )}
    </>
  );
}
