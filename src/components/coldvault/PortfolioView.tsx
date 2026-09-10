"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from "recharts";
import { Check, ChevronRight, Download, Pencil, Plus, RefreshCw, Sparkles, Wallet as WalletIcon, X } from "lucide-react";
import {
  CHAIN_COLORS, CHAIN_LABEL, ChainBadge, Chain, Holding, ManualHolding, ValueCounter, Wallet,
  fmtAmt, fmtUSD,
} from "./shared";
import EvolutionChart, { PortfolioHistoryPoint, HistoryRange } from "./EvolutionChart";

interface MarketCoin { id: string; symbol: string; name: string; image: string; price: number; change24h: number; }
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
  loadMarket: () => void;
  marketLoading: boolean;
  marketError: string;
  marketTop: MarketCoin[];
  gasNow: GasNow;
  history: PortfolioHistoryPoint[];
  historyLoading: boolean;
  historyRange: HistoryRange;
  setHistoryRange: (r: HistoryRange) => void;
  vesRates: { bcv: number | null; paralelo: number | null };
}

function WalletRow({ wallet, balance, onRemove, onRename }: { wallet: Wallet; balance: BalanceEntry; onRemove: () => void; onRename: (label: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(wallet.label);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const res = await fetch(`/api/wallets/${wallet.id}/history?range=90d`);
        const d = await res.json();
        if (res.ok) setHistory(d);
      } catch { /* el mini-gráfico simplemente queda vacío */ }
      setLoading(false);
      setLoaded(true);
    }
  };

  const startEdit = () => { setEditValue(wallet.label); setEditing(true); };
  const confirmEdit = () => {
    const clean = editValue.trim();
    if (clean && clean !== wallet.label) onRename(clean);
    setEditing(false);
  };
  const cancelEdit = () => { setEditValue(wallet.label); setEditing(false); };

  return (
    <div className="border-t" style={{ borderColor: "var(--line)" }}>
      <div className="cv-row flex items-start justify-between gap-2 py-2.5 px-1.5 rounded-md transition-colors">
        {editing ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <ChainBadge chain={wallet.chain} size={22} />
            <input
              autoFocus
              className="cv-input flex-1 min-w-0 text-[13px] py-1"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") cancelEdit(); }}
            />
            <button className="cv-x" onClick={confirmEdit} title="Guardar"><Check size={13} /></button>
            <button className="cv-x" onClick={cancelEdit} title="Cancelar"><X size={13} /></button>
          </div>
        ) : (
          <button className="flex items-start gap-2.5 min-w-0 flex-1 text-left" onClick={toggle}>
            <ChevronRight size={13} style={{ color: "var(--faint)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0, marginTop: 3 }} />
            <ChainBadge chain={wallet.chain} size={22} />
            <div className="min-w-0 flex-1">
              {/* Nombre, dirección y saldo apilados en su propia línea completa cada uno — nunca
                  comparten una fila con los botones de lápiz/borrar (columna aparte, ancho fijo).
                  Antes el saldo compartía línea con el nombre y, al ser un texto largo, se
                  desbordaba por fuera de su columna y quedaba debajo de esos botones. Apilado así,
                  el saldo tiene todo el ancho de la tarjeta para él solo y puede partirse en varias
                  líneas si hace falta, sin invadir el espacio de nada más. */}
              <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{wallet.label}</div>
              <div className="font-mono text-[11px] truncate" style={{ color: "var(--faint)" }}>{wallet.address}</div>
              <div className="font-mono text-[12px] mt-0.5" style={{ color: balance.error ? "var(--neg)" : "var(--dim)" }}>
                {balance.loading ? "…" : balance.error || balance.detail}
              </div>
            </div>
          </button>
        )}
        {!editing && (
          <div className="flex items-center gap-2.5 flex-shrink-0" style={{ marginTop: 2 }}>
            <button className="cv-x" onClick={startEdit} title="Renombrar"><Pencil size={12} /></button>
            <button className="cv-x" onClick={onRemove}>✕</button>
          </div>
        )}
      </div>
      {expanded && !editing && (
        <div className="pb-3 px-1.5">
          <EvolutionChart history={history} loading={loading} />
        </div>
      )}
    </div>
  );
}

export default function PortfolioView({
  total, wallets, fetchAll, refreshing, autoRefresh, setAutoRefresh, lastUpdated, incompleteWallets, errMsg,
  chain, setChain, labelInput, setLabelInput, addrInput, setAddrInput, addWallet, addWalletError, balances, removeWallet, renameWallet,
  manual, manualCoinId, setManualCoinId, manualSymbol, setManualSymbol, manualQty, setManualQty, addManual, removeManual,
  pieData, holdings, colorForSymbol, loadMarket, marketLoading, marketError, marketTop, gasNow,
  history, historyLoading, historyRange, setHistoryRange, vesRates,
}: PortfolioViewProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-4 mb-4 items-stretch">
        <div className="cv-card cv-card-hover p-5 sm:p-6 cv-fade-in flex flex-col justify-between">
          <div>
            <div className="cv-eyebrow flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pos)" }} />
              Portafolio total
            </div>
            <div className="font-mono text-[32px] sm:text-[40px] font-bold break-all mt-1.5 leading-none" style={{ color: "var(--ink)" }}>
              <ValueCounter value={total} />
            </div>
            {(vesRates.bcv || vesRates.paralelo) && (
              <div className="text-[11.5px] font-mono mt-1" style={{ color: "var(--faint)" }}>
                {vesRates.bcv && <>≈ Bs {(total * vesRates.bcv).toLocaleString("es-VE", { maximumFractionDigits: 0 })} (BCV)</>}
                {vesRates.bcv && vesRates.paralelo && " · "}
                {vesRates.paralelo && <>Bs {(total * vesRates.paralelo).toLocaleString("es-VE", { maximumFractionDigits: 0 })} (paralelo)</>}
              </div>
            )}
            {wallets.length > 0 && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {(["BTC", "ETH", "TRON"] as Chain[]).map((c) => {
                  const count = wallets.filter((w) => w.chain === c).length;
                  if (count === 0) return null;
                  return (
                    <div key={c} className="flex items-center gap-1.5">
                      <ChainBadge chain={c} size={18} />
                      <span className="text-[12px]" style={{ color: "var(--dim)" }}>{count} wallet{count > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3.5 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-2.5">
              <button className="cv-btn" onClick={fetchAll} disabled={refreshing}>
                <RefreshCw size={13} className={`inline -mt-0.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Actualizando…" : "Actualizar ahora"}
              </button>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--faint)" }}>
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto cada 60s
              </label>
            </div>
            {lastUpdated && <span className="text-[10.5px]" style={{ color: "var(--faint)" }}>Última lectura: {lastUpdated.toLocaleTimeString("es-VE")}</span>}
          </div>
          {incompleteWallets.length > 0 && (
            <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: "rgba(255,107,90,.12)", border: "1px solid var(--neg)", color: "var(--neg)" }}>
              ⚠ <strong>Total incompleto</strong> — no se pudo leer el saldo de: {incompleteWallets.join(", ")}.
            </div>
          )}
          {errMsg && <div className="mt-3 text-xs" style={{ color: "var(--neg)" }}>{errMsg}</div>}
        </div>

        <div className="cv-card cv-card-hover p-5 sm:p-6 cv-fade-in flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="font-display text-sm font-semibold" style={{ color: "var(--ink)" }}>Evolución</div>
            <div className="flex rounded-full p-1" style={{ background: "var(--panel2)" }}>
              {(["7d", "90d", "1y"] as HistoryRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setHistoryRange(r)}
                  className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                  style={{ background: historyRange === r ? "var(--accent)" : "transparent", color: historyRange === r ? "#fff" : "var(--dim)" }}
                >
                  {r === "7d" ? "7D" : r === "90d" ? "90D" : "Año"}
                </button>
              ))}
            </div>
          </div>
          <EvolutionChart history={history} loading={historyLoading} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-4 mb-5 items-stretch">
        <div className="cv-card cv-card-hover p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <WalletIcon size={16} strokeWidth={2.25} style={{ color: "var(--dim)" }} />
            <div className="font-display text-sm font-semibold">Direcciones rastreadas</div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2 mb-3 sm:flex-wrap">
            <select className="cv-select w-full sm:w-auto" value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
              {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_LABEL[c]}</option>)}
            </select>
            <input className="cv-input w-full sm:w-[100px]" placeholder="Etiqueta" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
            <input className="cv-input col-span-2 sm:flex-1 sm:min-w-[160px]" placeholder="Dirección pública" value={addrInput} onChange={(e) => setAddrInput(e.target.value)} />
            <button className="cv-btn col-span-2 sm:w-auto" onClick={addWallet}>Añadir wallet</button>
          </div>
          {addWalletError && <div className="text-[12px] mb-2" style={{ color: "var(--neg)" }}>{addWalletError}</div>}
          {wallets.length === 0 && <div className="text-[12.5px] py-2" style={{ color: "var(--dim)" }}>Copia la dirección pública desde Ledger Live (nunca la clave privada).</div>}
          {wallets.map((w) => {
            const b = balances[w.id] || { loading: true, error: null, detail: null };
            return <WalletRow key={w.id} wallet={w} balance={b} onRemove={() => removeWallet(w.id)} onRename={(label) => renameWallet(w.id, label)} />;
          })}
          <div className="mt-4 pt-3.5 border-t border-dashed" style={{ borderColor: "var(--line)" }}>
            <div className="font-display text-[13px] font-semibold mb-2.5">Otro activo (manual)</div>
            <div className="grid grid-cols-3 sm:flex gap-2 sm:flex-wrap">
              <input className="cv-input w-full sm:w-[110px]" placeholder="id CoinGecko" value={manualCoinId} onChange={(e) => setManualCoinId(e.target.value)} />
              <input className="cv-input w-full sm:w-20" placeholder="símbolo" value={manualSymbol} onChange={(e) => setManualSymbol(e.target.value)} />
              <input className="cv-input w-full sm:w-[90px]" placeholder="cantidad" value={manualQty} onChange={(e) => setManualQty(e.target.value)} />
              <button className="cv-btn-ghost cv-icon-btn justify-center col-span-3 sm:col-auto" onClick={addManual}><Plus size={13} /> Añadir</button>
            </div>
            {manual.map((m) => (
              <div key={m.id} className="flex justify-between py-1.5 px-0.5 text-[12.5px]" style={{ color: "var(--ink)" }}>
                <span className="font-mono">{fmtAmt(m.qty)} {m.symbol}</span>
                <button className="cv-x" onClick={() => removeManual(m.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="cv-card cv-card-hover p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={16} strokeWidth={2.25} style={{ color: "var(--dim)" }} />
            <div className="font-display text-sm font-semibold">Asignación</div>
          </div>
          {pieData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8" style={{ color: "var(--faint)" }}>
              <Sparkles size={22} strokeWidth={1.5} className="mb-2 opacity-50" />
              <div className="text-[12.5px]">Sin datos suficientes todavía.</div>
            </div>
          ) : (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} minAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHAIN_COLORS[i % CHAIN_COLORS.length]} stroke="var(--panel)" strokeWidth={2} />)}
                    </Pie>
                    <ReTooltip formatter={(v: any, n: any) => [fmtUSD(v), n]} contentStyle={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 space-y-1.5">
                {holdings.map((h) => {
                  const pct = total > 0 && h.value ? (h.value / total) * 100 : null;
                  const color = colorForSymbol[h.symbol];
                  return (
                    <div key={h.symbol} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: color || "var(--line)", border: color ? "none" : "1px solid var(--faint)" }}
                        />
                        <span className="font-medium" style={{ color: "var(--ink)" }}>{h.symbol}</span>
                        <span className="font-mono" style={{ color: "var(--dim)" }}>{fmtAmt(h.amount, 4)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono" style={{ color: "var(--dim)" }}>{fmtUSD(h.value)}</span>
                        <span className="font-mono w-12 text-right" style={{ color: pct !== null ? "var(--ink)" : "var(--faint)", fontWeight: 500 }}>
                          {pct !== null ? `${pct < 0.1 ? "<0.1" : pct.toFixed(1)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cv-card cv-card-hover p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><WalletIcon size={16} strokeWidth={2.25} style={{ color: "var(--dim)" }} /><div className="font-display text-sm font-semibold">Tenencias</div></div>
          {holdings.length > 0 && (
            <button
              className="cv-btn-ghost"
              onClick={() => {
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
              }}
            >
              <Download size={13} className="inline -mt-0.5 mr-1" />Exportar CSV
            </button>
          )}
        </div>
        {holdings.length === 0 ? <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>Añade una dirección o un activo manual para ver tu portafolio.</div> : (
          <>
          <div className="md:hidden space-y-2">
            {holdings.map((h) => {
              const pct = total > 0 && h.value ? (h.value / total) * 100 : null;
              return (
                <div key={h.symbol} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorForSymbol[h.symbol] || "var(--line)" }} />
                      <span className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{h.symbol}</span>
                    </div>
                    <span className="font-mono text-[14px] font-bold" style={{ color: "var(--accent)" }}>{fmtUSD(h.value)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--dim)" }}>
                    <span className="font-mono">{fmtAmt(h.amount, 4)} · {fmtUSD(h.price)}</span>
                    <span className="font-mono font-medium">{pct !== null ? `${pct < 0.1 ? "<0.1" : pct.toFixed(1)}%` : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <table className="w-full border-collapse hidden md:table">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
              <th className="p-2">Activo</th><th className="p-2">Cantidad</th><th className="p-2">Precio</th><th className="p-2">Valor</th><th className="p-2">Asignación</th>
            </tr></thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.symbol} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="p-2 font-medium" style={{ color: "var(--ink)" }}>{h.symbol}</td>
                  <td className="p-2 font-mono" style={{ color: "var(--dim)" }}>{fmtAmt(h.amount)}</td>
                  <td className="p-2 font-mono" style={{ color: "var(--dim)" }}>{fmtUSD(h.price)}</td>
                  <td className="p-2 font-mono font-semibold" style={{ color: "var(--ink)" }}>{fmtUSD(h.value)}</td>
                  <td className="p-2 text-xs" style={{ color: "var(--dim)" }}>{total > 0 && h.value ? `${((h.value / total) * 100).toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* Mercado y comisiones — solo móvil (en escritorio van en el sidebar) */}
      <div className="md:hidden mt-4 space-y-4">
        <div className="cv-card p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="font-display text-sm font-semibold">Comisiones de red ahora</div>
            <button onClick={loadMarket} disabled={marketLoading} style={{ background: "none", border: "none", color: "var(--accent)" }}>
              <RefreshCw size={14} className={marketLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl py-2.5 text-center" style={{ background: "var(--panel2)" }}>
              <div className="text-[10px] font-semibold" style={{ color: "var(--faint)" }}>BTC{gasNow.btc?.stale && " ⚠"}</div>
              <div className="font-mono text-[12px] font-bold mt-0.5" style={{ color: "var(--ink)" }}>{gasNow.btc?.levels ? `${gasNow.btc.levels[1]?.detail?.split(" ")[0] || "—"} sat/vB` : "—"}</div>
            </div>
            <div className="rounded-xl py-2.5 text-center" style={{ background: "var(--panel2)" }}>
              <div className="text-[10px] font-semibold" style={{ color: "var(--faint)" }}>ETH{gasNow.eth?.stale && " ⚠"}</div>
              <div className="font-mono text-[12px] font-bold mt-0.5" style={{ color: "var(--ink)" }}>{gasNow.eth?.levels ? `${gasNow.eth.levels[0]?.detail?.split(" ")[0] || "—"} gwei` : "—"}</div>
            </div>
            <div className="rounded-xl py-2.5 text-center" style={{ background: "var(--panel2)" }}>
              <div className="text-[10px] font-semibold" style={{ color: "var(--faint)" }}>TRON{gasNow.tron?.stale && " ⚠"}</div>
              <div className="font-mono text-[12px] font-bold mt-0.5" style={{ color: "var(--ink)" }}>{gasNow.tron?.levels ? `${fmtAmt(gasNow.tron.levels[1]?.fee, 2)} TRX` : "—"}</div>
            </div>
          </div>
        </div>

        <div className="cv-card p-4">
          <div className="font-display text-sm font-semibold mb-2.5">Top 20 cripto</div>
          {marketError ? (
            <div className="text-[12px]" style={{ color: "var(--dim)" }}>{marketError}</div>
          ) : marketTop.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--dim)" }}>{marketLoading ? "Cargando…" : "Sin datos."}</div>
          ) : (
            <div className="space-y-2">
              {marketTop.map((mc) => (
                <div key={mc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={mc.image} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{mc.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px]" style={{ color: "var(--ink)" }}>{fmtUSD(mc.price)}</span>
                    <span className="font-mono text-[12px] w-14 text-right font-semibold" style={{ color: mc.change24h >= 0 ? "var(--pos)" : "var(--neg)" }}>
                      {mc.change24h >= 0 ? "▲" : "▼"}{Math.abs(mc.change24h).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
