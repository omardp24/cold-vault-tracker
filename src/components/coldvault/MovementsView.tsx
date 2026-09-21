"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeftRight, ChevronRight, CircleCheck, Clock, Download, Plus, Search, Sparkles, Users as UsersIcon, X,
} from "lucide-react";
import {
  Aliado, CHAIN_LABEL, ChainBadge, Chain, Movement, Wallet,
  fmtAmt, fmtDate, fmtUSD, shortAddr,
} from "./shared";
import ConceptoInput from "./ConceptoInput";

type DirFilter = "all" | "in" | "out";
type EstadoFilter = "all" | "pending" | "classified" | "internal" | "fee";
type GroupViewMode = "pending" | "all";
type GroupBatchEntry = { aliadoId: string; concepto: string; applying: boolean };

export interface MovementsViewProps {
  wallets: Wallet[];
  movements: Movement[];
  aliados: Aliado[];

  movLoading: boolean;
  movErr: string;
  loadMovements: () => void;
  cursors: Record<string, string | null>;
  loadingMoreId: string | null;
  loadMoreForWallet: (w: Wallet) => void;
  isPoisoningSuspect: (addr: string | null) => boolean;
  quickAuditFor: (m: Movement) => { sanctioned: boolean; sanctionLists: string[]; blacklisted: boolean } | undefined;
  runDiagnostics: () => void;
  diagRunning: boolean;
  diag: { name: string; ok: boolean; detail: string }[] | null;

  walletSummary: { wallet: Wallet; count: number; outUsd: number; inUsd: number; pending: number; lastDate: number | null }[];
  walletFilter: string;
  setWalletFilter: Dispatch<SetStateAction<string>>;

  newAliadoName: string;
  setNewAliadoName: Dispatch<SetStateAction<string>>;
  addAliado: () => void;
  selectedAliadoId: string | null;
  setSelectedAliadoId: Dispatch<SetStateAction<string | null>>;
  selectedAliado: Aliado | null;
  deleteAliado: (id: string) => void;
  selectedAliadoTotals: { outAssets: Record<string, number>; outUsd: number; inAssets: Record<string, number>; inUsd: number };
  detailChain: Chain;
  setDetailChain: Dispatch<SetStateAction<Chain>>;
  detailAddr: string;
  setDetailAddr: Dispatch<SetStateAction<string>>;
  addAddressToAliado: (aliadoId: string, chain: Chain, address: string) => void;
  removeAddressFromAliado: (aliadoId: string, address: string) => void;
  selectedAliadoMovements: Movement[];
  exportAliado: (name: string, rows: Movement[]) => void;
  effectiveConcepto: (m: Movement) => string;

  summaryRows: { id: string; assets: Record<string, number>; count: number; usdApprox: number }[];
  summaryRowsIn: { id: string; assets: Record<string, number>; count: number; usdApprox: number }[];
  nameFor: (id: string) => string;
  internalTotal: { count: number; assets: Record<string, number> };
  feeTotal: { count: number; assets: Record<string, number>; usdApprox: number };

  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  activeFilterCount: number;
  showFilterSheet: boolean;
  setShowFilterSheet: Dispatch<SetStateAction<boolean>>;
  showExportSheet: boolean;
  setShowExportSheet: Dispatch<SetStateAction<boolean>>;
  dirFilter: DirFilter;
  setDirFilter: Dispatch<SetStateAction<DirFilter>>;
  estadoFilter: EstadoFilter;
  setEstadoFilter: Dispatch<SetStateAction<EstadoFilter>>;
  dateFrom: string;
  setDateFrom: Dispatch<SetStateAction<string>>;
  dateTo: string;
  setDateTo: Dispatch<SetStateAction<string>>;
  minUsd: string;
  setMinUsd: Dispatch<SetStateAction<string>>;
  hideUnpriced: boolean;
  setHideUnpriced: Dispatch<SetStateAction<boolean>>;
  dustHiddenCount: number;

  exportFiltered: () => void;
  generateStatement: (format: "pdf" | "excel") => void;
  statementGenerating: "pdf" | "excel" | null;

  flowSummary: { inUsd: number; outUsd: number; feeUsd: number };
  visibleMovements: Movement[];
  filteredMovements: Movement[];
  pendingCount: number;

  showGroupClassifier: boolean;
  setShowGroupClassifier: Dispatch<SetStateAction<boolean>>;
  groupViewMode: GroupViewMode;
  setGroupViewMode: Dispatch<SetStateAction<GroupViewMode>>;
  feeThreshold: string;
  setFeeThreshold: Dispatch<SetStateAction<string>>;
  markSmallGroupsAsFee: () => void;
  markingFees: boolean;
  pendingGroups: { key: string; chain: Chain; address: string; movements: Movement[]; totals: Record<string, number>; totalsIn: Record<string, number> }[];
  groupExistingAliado: (g: MovementsViewProps["pendingGroups"][number]) => { status: "none" } | { status: "mixed" } | { status: "single"; name: string };
  groupBatchState: Record<string, GroupBatchEntry>;
  toggleGroupExpand: (key: string) => void;
  expandedGroups: Set<string>;
  groupWalletCount: (g: MovementsViewProps["pendingGroups"][number]) => number;
  groupWalletLabels: (g: MovementsViewProps["pendingGroups"][number]) => (string | undefined)[];
  setGroupField: (key: string, patch: Partial<GroupBatchEntry>) => void;
  applyGroupClassification: (g: MovementsViewProps["pendingGroups"][number]) => void;

  effectiveAliadoId: (m: Movement) => string | null;
  effectiveIsFee: (m: Movement) => boolean;
  isInternalTransfer: (m: Movement) => boolean;
  isPending: (m: Movement) => boolean;
  findOwnWallet: (chain: Chain, addr: string | null) => Wallet | undefined;
  saveClassification: (key: string, patch: { aliadoId?: string | null; concepto?: string; isFee?: boolean }) => Promise<boolean>;
  handleAliadoSelect: (m: Movement, value: string) => void;
}

export default function MovementsView(props: MovementsViewProps) {
  const {
    wallets, movements, aliados,
    movLoading, movErr, loadMovements, cursors, loadingMoreId, loadMoreForWallet, isPoisoningSuspect, quickAuditFor,
    runDiagnostics, diagRunning, diag,
    walletSummary, walletFilter, setWalletFilter,
    newAliadoName, setNewAliadoName, addAliado, selectedAliadoId, setSelectedAliadoId, selectedAliado, deleteAliado,
    selectedAliadoTotals, detailChain, setDetailChain, detailAddr, setDetailAddr, addAddressToAliado, removeAddressFromAliado,
    selectedAliadoMovements, exportAliado, effectiveConcepto,
    summaryRows, summaryRowsIn, nameFor, internalTotal, feeTotal,
    searchText, setSearchText, activeFilterCount, showFilterSheet, setShowFilterSheet, showExportSheet, setShowExportSheet,
    dirFilter, setDirFilter, estadoFilter, setEstadoFilter, dateFrom, setDateFrom, dateTo, setDateTo,
    minUsd, setMinUsd, hideUnpriced, setHideUnpriced, dustHiddenCount,
    exportFiltered, generateStatement, statementGenerating,
    flowSummary, visibleMovements, filteredMovements, pendingCount,
    showGroupClassifier, setShowGroupClassifier, groupViewMode, setGroupViewMode, feeThreshold, setFeeThreshold,
    markSmallGroupsAsFee, markingFees, pendingGroups, groupExistingAliado, groupBatchState, toggleGroupExpand,
    expandedGroups, groupWalletCount, groupWalletLabels, setGroupField, applyGroupClassification,
    effectiveAliadoId, effectiveIsFee, isInternalTransfer, isPending, findOwnWallet, saveClassification, handleAliadoSelect,
  } = props;

  // Sugerencia de clasificación con IA — mira movimientos parecidos ya clasificados (mismo
  // activo/red/dirección) y sugiere un concepto consistente con ese patrón. Nunca guarda sola:
  // solo precarga el campo de texto, el usuario confirma con el flujo normal (blur → saveClassification).
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { concepto: string; aliadoSugerido?: string }>>({});
  const [suggesting, setSuggesting] = useState<string | null>(null);
  const suggestForMovement = async (m: Movement) => {
    setSuggesting(m.key);
    try {
      const ejemplos = movements
        .filter((x) => x.key !== m.key && x.chain === m.chain && x.asset === m.asset && !isInternalTransfer(x) && !effectiveIsFee(x) && effectiveConcepto(x).trim())
        .map((x) => ({
          chain: x.chain, direction: x.direction, asset: x.asset, amount: x.amount,
          concepto: effectiveConcepto(x), aliado: aliados.find((a) => a.id === effectiveAliadoId(x))?.name,
        }));
      const res = await fetch("/api/asistente/clasificar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movimiento: { chain: m.chain, direction: m.direction, asset: m.asset, amount: m.amount },
          ejemplos, aliadosConocidos: aliados.map((a) => a.name),
        }),
      });
      if (res.ok) {
        const suggestion = await res.json();
        setAiSuggestions((s) => ({ ...s, [m.key]: suggestion }));
      }
    } catch { /* sin sugerencia, el usuario clasifica a mano como siempre */ }
    setSuggesting(null);
  };

  return (
    <>
      <div className="cv-card cv-card-hover p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-1.5">
          <div className="flex items-center gap-2"><ArrowLeftRight size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Movimientos</div></div>
          <button className="cv-btn w-full sm:w-auto" onClick={loadMovements} disabled={movLoading || wallets.length === 0}>
            {movLoading ? "Cargando…" : "Cargar / actualizar movimientos"}
          </button>
        </div>
        <div className="text-[11.5px] mb-1" style={{ color: "var(--dim)" }}>
          BTC: se toma la dirección de destino de mayor valor como contraparte (puede haber más de una salida por transacción). ETH: origen/destino directo, incluye tokens ERC-20. TRON: por ahora solo movimientos TRC-20 (USDT/USDC).
        </div>
        {movErr && <div className="text-xs" style={{ color: "var(--neg)" }}>{movErr}</div>}
        {wallets.length === 0 && <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>Añade al menos una dirección en la pestaña Portafolio primero.</div>}

        {(movements.some((m) => !m.verified) || movements.some((m) => isPoisoningSuspect(m.counterparty))) && (
          <div className="mt-3 p-3 rounded-lg text-[12px]" style={{ background: "var(--tint)", border: "1px solid var(--amber)", color: "var(--ink)" }}>
            ⚠ Se detectaron movimientos con <strong>tokens no verificados</strong> y/o <strong>direcciones muy similares a otras que has usado</strong> — señales típicas de intentos de estafa (address poisoning / tokens falsos). No cuentan en tus totales en USD, pero revísalos en la tabla de abajo y verifica cualquier transacción sospechosa directamente en el explorador antes de confiar en ella. Nunca copies una dirección de destino desde aquí sin comparar el texto completo.
          </div>
        )}

        {movements.some((m) => quickAuditFor(m)?.sanctioned || quickAuditFor(m)?.blacklisted) && (
          <div className="mt-3 p-3 rounded-lg text-[12px]" style={{ background: "rgba(255,107,90,.14)", border: "1px solid var(--neg)", color: "var(--ink)" }}>
            🚫 Al menos una contraparte en tu historial está en la <strong>lista de sanciones OFAC</strong> o en una <strong>lista negra de stablecoins</strong>. Búscala en la tabla (marcada en rojo) y revisa esa transacción con cuidado — considera consultar asesoría legal si corresponde a montos relevantes.
          </div>
        )}

        {wallets.some((w) => cursors[w.id]) && (
          <div className="mt-3 pt-3 border-t border-dashed flex flex-wrap gap-2" style={{ borderColor: "var(--line)" }}>
            {wallets.filter((w) => cursors[w.id]).map((w) => (
              <button key={w.id} className="cv-btn-ghost" onClick={() => loadMoreForWallet(w)} disabled={loadingMoreId === w.id}>
                {loadingMoreId === w.id ? "Cargando…" : `Cargar historial anterior de ${w.label}`}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3.5 pt-3.5 border-t border-dashed" style={{ borderColor: "var(--line)" }}>
          <button className="cv-btn-ghost" onClick={runDiagnostics} disabled={diagRunning}>
            {diagRunning ? "Probando…" : "Diagnosticar conexión a las APIs"}
          </button>
          {diag && (
            <div className="mt-2.5">
              {diag.map((d) => (
                <div key={d.name} className="flex gap-2.5 text-xs py-1 items-center">
                  <span style={{ color: d.ok ? "var(--pos)" : "var(--neg)", width: 14 }}>{d.ok ? "✓" : "✕"}</span>
                  <span className="w-40 flex-shrink-0">{d.name}</span>
                  <span className="font-mono" style={{ color: "var(--dim)" }}>{d.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {wallets.length > 0 && (
        <div className="cv-card cv-card-hover p-5 mb-4">
          <div className="font-display text-sm font-semibold mb-2.5">Movimientos por wallet</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {walletSummary.map((ws) => (
              <button
                key={ws.wallet.id}
                onClick={() => setWalletFilter(walletFilter === ws.wallet.id ? "all" : ws.wallet.id)}
                className="text-left rounded-lg p-3 transition-colors"
                style={{
                  background: walletFilter === ws.wallet.id ? "rgba(62,213,152,.14)" : "var(--panel2)",
                  border: `1px solid ${walletFilter === ws.wallet.id ? "var(--pos)" : "var(--line)"}`,
                  cursor: "pointer",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{ws.wallet.label} <span className="text-[10.5px]" style={{ color: "var(--dim)" }}>· {ws.wallet.chain}</span></span>
                  {ws.pending > 0 && (
                    <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: "var(--tint)", color: "var(--amber)" }}>⏳ {ws.pending}</span>
                  )}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>{ws.count} movimiento{ws.count !== 1 ? "s" : ""}{ws.lastDate ? ` · último ${fmtDate(ws.lastDate)}` : ""}</div>
                <div className="flex gap-3 text-[11.5px] font-mono mt-1">
                  <span style={{ color: "var(--pos)" }}>+{fmtUSD(ws.inUsd)}</span>
                  <span style={{ color: "var(--neg)" }}>−{fmtUSD(ws.outUsd)}</span>
                </div>
              </button>
            ))}
          </div>
          {walletFilter !== "all" && (
            <button className="cv-btn-ghost mt-3" onClick={() => setWalletFilter("all")}>✕ Quitar filtro de wallet</button>
          )}
        </div>
      )}

      <div className="cv-card cv-card-hover p-5 mb-4">
        <div className="flex items-center gap-2 mb-2.5"><UsersIcon size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Aliados</div></div>
        <div className="flex flex-col sm:flex-row gap-2 mb-2.5">
          <input className="cv-input w-full sm:flex-1 sm:max-w-[260px]" placeholder="Nombre del aliado (ej. Proveedor Insumos)" value={newAliadoName} onChange={(e) => setNewAliadoName(e.target.value)} />
          <button className="cv-btn-ghost cv-icon-btn justify-center" onClick={addAliado}><Plus size={13} /> Crear aliado</button>
        </div>
        {aliados.length === 0 ? (
          <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>Crea aliados y asígnalos a cada movimiento saliente en la tabla de abajo.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {aliados.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAliadoId(selectedAliadoId === a.id ? null : a.id)}
                className="text-xs rounded-full border px-3 py-1 cursor-pointer"
                style={{
                  background: selectedAliadoId === a.id ? "var(--accent)" : "var(--panel2)",
                  color: selectedAliadoId === a.id ? "var(--panel)" : "var(--ink)",
                  borderColor: selectedAliadoId === a.id ? "var(--accent)" : "var(--line)",
                  fontWeight: selectedAliadoId === a.id ? 600 : 400,
                }}
              >
                {a.name} <span style={{ opacity: 0.7 }}>· {a.addresses.length} dir.</span>
              </button>
            ))}
          </div>
        )}

        {selectedAliado && (
          <div className="mt-4 pt-4 border-t border-dashed" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="font-display text-[15px] font-semibold">{selectedAliado.name}</div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="cv-btn-ghost text-[11.5px]" onClick={() => deleteAliado(selectedAliado.id)}>Eliminar</button>
                <button className="cv-x" onClick={() => setSelectedAliadoId(null)}><X size={18} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Le has pagado</div>
                <div className="font-mono text-xl font-semibold" style={{ color: "var(--neg)" }}>{fmtUSD(selectedAliadoTotals.outUsd)}</div>
                <div className="text-xs font-mono mt-1" style={{ color: "var(--dim)" }}>
                  {Object.entries(selectedAliadoTotals.outAssets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ") || "—"}
                </div>
              </div>
              <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Te ha transferido</div>
                <div className="font-mono text-xl font-semibold" style={{ color: "var(--pos)" }}>{fmtUSD(selectedAliadoTotals.inUsd)}</div>
                <div className="text-xs font-mono mt-1" style={{ color: "var(--dim)" }}>
                  {Object.entries(selectedAliadoTotals.inAssets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ") || "—"}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[13px] font-medium mb-2">Direcciones conocidas de este aliado</div>
              <div className="text-[11px] mb-2" style={{ color: "var(--dim)" }}>
                Si este aliado te cobra desde varias wallets, añádelas todas aquí — así cualquier movimiento hacia cualquiera de ellas se etiqueta automáticamente.
              </div>
              {selectedAliado.addresses.length === 0 ? (
                <div className="text-[12px] mb-2" style={{ color: "var(--dim)" }}>Aún no hay direcciones registradas.</div>
              ) : (
                selectedAliado.addresses.map((ad) => (
                  <div key={ad.address} className="flex items-center justify-between py-1.5 text-[12px]">
                    <span className="font-mono">{ad.chain} · {shortAddr(ad.address)}</span>
                    <button className="cv-x" onClick={() => removeAddressFromAliado(selectedAliado.id, ad.address)}>✕</button>
                  </div>
                ))
              )}
              <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:flex-wrap">
                <select className="cv-select w-full sm:w-auto" value={detailChain} onChange={(e) => setDetailChain(e.target.value as Chain)}>
                  {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_LABEL[c]}</option>)}
                </select>
                <input className="cv-input w-full sm:flex-1 sm:min-w-[160px]" placeholder="Dirección" value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
                <button className="cv-btn-ghost cv-icon-btn" onClick={() => { addAddressToAliado(selectedAliado.id, detailChain, detailAddr); setDetailAddr(""); }}><Plus size={13} /> Añadir dirección</button>
              </div>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div className="text-[13px] font-medium">Movimientos a este aliado</div>
                {selectedAliadoMovements.length > 0 && (
                  <button className="cv-btn-ghost" onClick={() => exportAliado(selectedAliado.name, selectedAliadoMovements)}><Download size={13} className="inline -mt-0.5 mr-1" />Exportar CSV</button>
                )}
              </div>
              {selectedAliadoMovements.length === 0 ? (
                <div className="text-[12px]" style={{ color: "var(--dim)" }}>Sin movimientos todavía.</div>
              ) : (
                <div className="cv-scroll-x">
                <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                  <thead><tr className="text-left text-[11px] uppercase" style={{ color: "var(--dim)" }}>
                    <th className="p-1.5">Fecha</th><th className="p-1.5">Wallet</th><th className="p-1.5">Monto</th><th className="p-1.5">Contraparte</th><th className="p-1.5">Concepto</th><th className="p-1.5">Aliado</th>
                  </tr></thead>
                  <tbody>
                    {selectedAliadoMovements.map((m) => (
                      <tr key={`${m.key}:${(m as any).walletId}`} className="border-t align-top" style={{ borderColor: "var(--line)" }}>
                        <td className="p-1.5 text-xs whitespace-nowrap" style={{ color: "var(--dim)" }}>{fmtDate(m.date)}</td>
                        <td className="p-1.5 text-xs">{m.walletLabel}</td>
                        <td className="p-1.5 font-mono text-xs whitespace-nowrap" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>
                          {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}{!m.verified && " ⚠"}
                        </td>
                        <td className="p-1.5">
                          <a className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }} href={m.explorer} target="_blank" rel="noreferrer">{shortAddr(m.counterparty)}</a>
                        </td>
                        <td className="p-1.5">
                          <ConceptoInput
                            className="cv-input w-full min-w-[140px] py-1 px-2"
                            placeholder="ej. compra insumos"
                            value={effectiveConcepto(m)}
                            onSave={(concepto) => saveClassification(m.key, { concepto })}
                          />
                        </td>
                        <td className="p-1.5">
                          <select className="cv-select" value={effectiveAliadoId(m) || ""} onChange={(e) => handleAliadoSelect(m, e.target.value)}>
                            <option value="">Sin clasificar</option>
                            {aliados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            <option value="__new__">+ Nuevo aliado…</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(movements.some((m) => m.direction === "out") || movements.some((m) => m.direction === "in")) && (
        <div className={`grid grid-cols-1 gap-4 mb-4 ${summaryRows.length > 0 && summaryRowsIn.length > 0 ? "sm:grid-cols-2" : ""}`}>
          {summaryRows.length > 0 && (
            <div className="cv-card cv-card-hover p-5">
              <div className="font-display text-sm font-semibold mb-1">Gasto por aliado</div>
              <div className="text-[11px] mb-2.5" style={{ color: "var(--dim)" }}>Valor USD aproximado al precio actual.</div>
              <div className="md:hidden space-y-2">
                {summaryRows.map((r) => (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: r.id === "sin_clasificar" ? "var(--dim)" : "var(--ink)" }}>{nameFor(r.id)}</span>
                      <span className="font-mono text-[13px] font-bold flex-shrink-0" style={{ color: "var(--neg)" }}>{fmtUSD(r.usdApprox)}</span>
                    </div>
                    <div className="text-[11px] font-mono mt-1" style={{ color: "var(--dim)" }}>
                      {r.count} mov · {Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
              <table className="w-full border-collapse hidden md:table">
                <thead><tr className="text-left text-[11px] uppercase" style={{ color: "var(--dim)" }}>
                  <th className="p-2">Aliado</th><th className="p-2">Mov.</th><th className="p-2">Montos</th><th className="p-2">Aprox. USD</th>
                </tr></thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={r.id} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="p-2 font-medium" style={{ color: r.id === "sin_clasificar" ? "var(--dim)" : "var(--ink)" }}>{nameFor(r.id)}</td>
                      <td className="p-2" style={{ color: "var(--dim)" }}>{r.count}</td>
                      <td className="p-2 font-mono">{Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}</td>
                      <td className="p-2 font-mono font-semibold" style={{ color: "var(--neg)" }}>{fmtUSD(r.usdApprox)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {internalTotal.count > 0 && (
                <div className="text-[11.5px] mt-2.5 pt-2.5 border-t border-dashed" style={{ borderColor: "var(--line)", color: "var(--dim)" }}>
                  + {internalTotal.count} transferencia{internalTotal.count > 1 ? "s" : ""} entre tus propias wallets (
                  {Object.entries(internalTotal.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}) — no cuentan como pagos a terceros.
                </div>
              )}
              {feeTotal.count > 0 && (
                <div className="text-[11.5px] mt-2 pt-2 border-t border-dashed" style={{ borderColor: "var(--line)", color: "#6B4FBB" }}>
                  💳 {feeTotal.count} comisión{feeTotal.count > 1 ? "es" : ""} de red por (
                  {Object.entries(feeTotal.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}) ≈ {fmtUSD(feeTotal.usdApprox)} — tampoco cuentan como pagos a terceros.
                </div>
              )}
            </div>
          )}
          {summaryRowsIn.length > 0 && (
            <div className="cv-card cv-card-hover p-5">
              <div className="font-display text-sm font-semibold mb-1">Recibido de aliado</div>
              <div className="text-[11px] mb-2.5" style={{ color: "var(--dim)" }}>Valor USD aproximado al precio actual.</div>
              <div className="md:hidden space-y-2">
                {summaryRowsIn.map((r) => (
                  <div key={r.id} className="rounded-xl p-3" style={{ background: "var(--panel2)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium truncate" style={{ color: r.id === "sin_clasificar" ? "var(--dim)" : "var(--ink)" }}>{nameFor(r.id)}</span>
                      <span className="font-mono text-[13px] font-bold flex-shrink-0" style={{ color: "var(--pos)" }}>{fmtUSD(r.usdApprox)}</span>
                    </div>
                    <div className="text-[11px] font-mono mt-1" style={{ color: "var(--dim)" }}>
                      {r.count} mov · {Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
              <table className="w-full border-collapse hidden md:table">
                <thead><tr className="text-left text-[11px] uppercase" style={{ color: "var(--dim)" }}>
                  <th className="p-2">Aliado</th><th className="p-2">Mov.</th><th className="p-2">Montos</th><th className="p-2">Aprox. USD</th>
                </tr></thead>
                <tbody>
                  {summaryRowsIn.map((r) => (
                    <tr key={r.id} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="p-2 font-medium" style={{ color: r.id === "sin_clasificar" ? "var(--dim)" : "var(--ink)" }}>{nameFor(r.id)}</td>
                      <td className="p-2" style={{ color: "var(--dim)" }}>{r.count}</td>
                      <td className="p-2 font-mono">{Object.entries(r.assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ")}</td>
                      <td className="p-2 font-mono font-semibold" style={{ color: "var(--pos)" }}>{fmtUSD(r.usdApprox)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="cv-card cv-card-hover p-4 sm:p-5">
        {/* ---- Barra de acciones MÓVIL ---- */}
        <div className="md:hidden mb-3">
          <div className="flex gap-2 mb-2.5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }} />
              <input className="cv-input w-full" style={{ paddingLeft: 34 }} placeholder="Buscar…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <button
              className="cv-btn-ghost cv-icon-btn flex-shrink-0"
              style={activeFilterCount > 0 ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
              onClick={() => setShowFilterSheet(true)}
            >
              <Search size={14} /> Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <button className="cv-btn-ghost cv-icon-btn flex-shrink-0" onClick={() => setShowExportSheet(true)}>
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* ---- Filtros ESCRITORIO ---- */}
        <div className="hidden md:flex gap-2 mb-3 flex-wrap items-center">
          <select className="cv-select" value={dirFilter} onChange={(e) => setDirFilter(e.target.value as any)}>
            <option value="all">Todas</option><option value="out">Salidas</option><option value="in">Entradas</option>
          </select>
          <select className="cv-select" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as any)}>
            <option value="all">Cualquier estado</option>
            <option value="pending">⏳ Pendientes</option>
            <option value="classified">✓ Clasificados</option>
            <option value="internal">↔ Internas</option>
            <option value="fee">💳 Comisiones de red</option>
          </select>
          <select className="cv-select" value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)}>
            <option value="all">Todas las wallets</option>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
          </select>
          <span className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--dim)" }}>
            <input type="date" className="cv-input py-1 px-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" className="cv-input py-1 px-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </span>
          <input className="cv-input flex-1 min-w-[160px]" placeholder="Buscar dirección, concepto o aliado…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          <button className="cv-btn-ghost" onClick={exportFiltered}><Download size={13} className="inline -mt-0.5 mr-1" />Exportar CSV</button>
          <button className="cv-btn-ghost" onClick={() => generateStatement("pdf")} disabled={statementGenerating !== null}>
            {statementGenerating === "pdf" ? "Generando…" : (<><Download size={13} className="inline -mt-0.5 mr-1" />Estado de cuenta (PDF)</>)}
          </button>
          <button className="cv-btn-ghost" onClick={() => generateStatement("excel")} disabled={statementGenerating !== null}>
            {statementGenerating === "excel" ? "Generando…" : (<><Download size={13} className="inline -mt-0.5 mr-1" />Estado de cuenta (Excel)</>)}
          </button>
        </div>
        {/* Resumen de flujo — tarjetas en móvil */}
        <div className="md:hidden grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(62,213,152,.14)" }}>
            <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--pos)" }}>Entradas</div>
            <div className="font-mono text-[12.5px] font-bold mt-0.5" style={{ color: "var(--pos)" }}>{fmtUSD(flowSummary.inUsd)}</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,107,90,.14)" }}>
            <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--neg)" }}>Salidas</div>
            <div className="font-mono text-[12.5px] font-bold mt-0.5" style={{ color: "var(--neg)" }}>{fmtUSD(flowSummary.outUsd)}</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--panel2)" }}>
            <div className="text-[9.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--dim)" }}>Neto</div>
            <div className="font-mono text-[12.5px] font-bold mt-0.5" style={{ color: "var(--ink)" }}>{fmtUSD(flowSummary.inUsd - flowSummary.outUsd)}</div>
          </div>
        </div>
        <div className="md:hidden text-[11.5px] mb-3" style={{ color: "var(--dim)" }}>
          {filteredMovements.length} movimiento{filteredMovements.length !== 1 ? "s" : ""}{dustHiddenCount > 0 ? ` · ${dustHiddenCount} ocultos` : ""}
          {flowSummary.feeUsd > 0 && <> · <span style={{ color: "#6B4FBB" }}>{fmtUSD(flowSummary.feeUsd)} en comisiones</span></>}
        </div>

        <div className="flex gap-x-4 gap-y-1.5 mb-3 flex-wrap items-center text-[12px]">
          <span className="hidden md:inline" style={{ color: "var(--dim)" }}>{filteredMovements.length} movimientos</span>
          <span className="hidden md:inline" style={{ color: "var(--pos)" }}>Entradas: {fmtUSD(flowSummary.inUsd)}</span>
          <span className="hidden md:inline" style={{ color: "var(--neg)" }}>Salidas: {fmtUSD(flowSummary.outUsd)}</span>
          <span className="hidden md:inline" style={{ color: "var(--dim)" }}>Neto: {fmtUSD(flowSummary.inUsd - flowSummary.outUsd)}</span>
          {flowSummary.feeUsd > 0 && <span className="hidden md:inline" style={{ color: "#6B4FBB" }}>Comisiones: {fmtUSD(flowSummary.feeUsd)}</span>}
          {pendingCount > 0 && estadoFilter !== "pending" && (
            <button
              onClick={() => setEstadoFilter("pending")}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--tint)", color: "var(--ink)", border: "1px solid var(--amber)", cursor: "pointer" }}
            >
              ⏳ {pendingCount} pendiente{pendingCount > 1 ? "s" : ""} por categorizar
            </button>
          )}
          {visibleMovements.some((m) => !isInternalTransfer(m) && m.counterparty) && (
            <button
              onClick={() => setShowGroupClassifier((v: boolean) => !v)}
              className="cv-icon-btn rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: showGroupClassifier ? "var(--ink)" : "rgba(62,213,152,.14)", color: showGroupClassifier ? "var(--panel)" : "var(--pos)", border: "1px solid var(--pos)", cursor: "pointer" }}
            >
              <UsersIcon size={11} /> Ver por contraparte
            </button>
          )}
        </div>

        {showGroupClassifier && (
          <div className="rounded-lg p-3.5 mb-4" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>
                Agrupado por dirección — {groupViewMode === "pending" ? "clasifica una vez y aplica a todas las pendientes hacia esa dirección." : "todo tu historial con cada dirección, para identificar fácil de quién es."}
              </div>
              <div className="flex rounded-full p-1 flex-shrink-0" style={{ background: "var(--panel2)" }}>
                <button
                  onClick={() => setGroupViewMode("pending")}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: groupViewMode === "pending" ? "var(--ink)" : "transparent", color: groupViewMode === "pending" ? "var(--panel)" : "var(--dim)" }}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setGroupViewMode("all")}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold"
                  style={{ background: groupViewMode === "all" ? "var(--ink)" : "transparent", color: groupViewMode === "all" ? "var(--panel)" : "var(--dim)" }}
                >
                  Todas
                </button>
              </div>
            </div>
            {groupViewMode === "pending" && (
            <div className="mb-3.5 rounded-lg p-3" style={{ background: "#F1EEFB" }}>
              <div className="text-[11.5px] mb-2" style={{ color: "#6B4FBB" }}>
                💳 Marcar automáticamente como comisión de red los grupos menores a:
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium" style={{ color: "#6B4FBB" }}>$</span>
                <input className="cv-input w-20 py-1 px-2" value={feeThreshold} onChange={(e) => setFeeThreshold(e.target.value)} />
                <button className="cv-btn-ghost flex-1 sm:flex-none" style={{ borderColor: "#6B4FBB", color: "#6B4FBB" }} onClick={markSmallGroupsAsFee} disabled={markingFees}>
                  {markingFees ? "Marcando…" : "Aplicar"}
                </button>
              </div>
            </div>
            )}
            {pendingGroups.length === 0 ? (
              <div className="text-[12.5px] text-center py-4" style={{ color: "var(--dim)" }}>
                {groupViewMode === "pending" ? "No hay transacciones pendientes por clasificar." : "No hay movimientos con contraparte para mostrar."}
              </div>
            ) : (
            <div className="space-y-2.5">
              {pendingGroups.map((g) => {
                const existing = groupExistingAliado(g);
                const state = groupBatchState[g.key] || {
                  aliadoId: existing.status === "single" ? (aliados.find((a) => a.name === existing.name)?.id || "") : "",
                  concepto: "", applying: false,
                };
                return (
                  <div key={g.key} className="rounded-lg p-3" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ChainBadge chain={g.chain} size={20} />
                        <span className="font-mono text-[12px]">{shortAddr(g.address)}</span>
                        <button
                          onClick={() => toggleGroupExpand(g.key)}
                          className="cv-icon-btn text-[11px] rounded-full px-2 py-0.5"
                          style={{ background: "var(--tint)", color: "var(--amber)", border: "none", cursor: "pointer" }}
                        >
                          {g.movements.length} transacciones{groupWalletCount(g) > 1 ? ` · ${groupWalletCount(g)} wallets` : ""} <ChevronRight size={11} style={{ transform: expandedGroups.has(g.key) ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                        </button>
                        {groupViewMode === "all" && existing.status === "single" && (
                          <span className="text-[11px] rounded-full px-2 py-0.5" style={{ background: "rgba(62,213,152,.14)", color: "var(--pos)" }}>✓ {existing.name}</span>
                        )}
                        {groupViewMode === "all" && existing.status === "mixed" && (
                          <span className="text-[11px] rounded-full px-2 py-0.5" style={{ background: "rgba(255,107,90,.14)", color: "var(--neg)" }}>⚠ clasificación mixta</span>
                        )}
                      </div>
                      <span className="font-mono text-[12px] font-semibold text-right">
                        {Object.keys(g.totals).length > 0 && (
                          <span style={{ color: "var(--neg)" }}>{Object.entries(g.totals).map(([a, v]) => `−${fmtAmt(v)} ${a}`).join(" · ")}</span>
                        )}
                        {Object.keys(g.totals).length > 0 && Object.keys(g.totalsIn).length > 0 && "  ·  "}
                        {Object.keys(g.totalsIn).length > 0 && (
                          <span style={{ color: "var(--pos)" }}>{Object.entries(g.totalsIn).map(([a, v]) => `+${fmtAmt(v)} ${a}`).join(" · ")}</span>
                        )}
                      </span>
                    </div>

                    {expandedGroups.has(g.key) && (
                      <div className="mb-3 rounded-md overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                        <div className="text-[10px] px-2 pt-1.5" style={{ color: "var(--faint)" }}>{groupWalletLabels(g).join(" · ")}</div>
                        <table className="w-full border-collapse">
                          <thead>
                            <tr style={{ background: "var(--panel2)" }}>
                              <th className="text-left text-[10px] uppercase p-1.5" style={{ color: "var(--dim)" }}>Fecha</th>
                              <th className="text-left text-[10px] uppercase p-1.5" style={{ color: "var(--dim)" }}>Wallet</th>
                              <th className="text-right text-[10px] uppercase p-1.5" style={{ color: "var(--dim)" }}>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.movements.map((m) => (
                              <tr key={`${m.key}:${(m as any).walletId}`} style={{ borderTop: "1px solid var(--line)" }}>
                                <td className="text-[11px] p-1.5" style={{ color: "var(--dim)" }}>{fmtDate(m.date)}</td>
                                <td className="text-[11px] p-1.5 font-medium">{m.walletLabel}</td>
                                <td className="text-[11px] p-1.5 text-right font-mono" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>
                                  {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
                      <input
                        className="cv-input w-full sm:flex-1 sm:min-w-[160px]"
                        placeholder="Concepto — ej. compra insumos"
                        value={state.concepto}
                        onChange={(e) => setGroupField(g.key, { concepto: e.target.value })}
                      />
                      <select className="cv-select w-full sm:w-auto" value={state.aliadoId} onChange={(e) => setGroupField(g.key, { aliadoId: e.target.value })}>
                        <option value="">Sin clasificar</option>
                        {aliados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        <option value="__new__">+ Nuevo aliado…</option>
                      </select>
                      <button className="cv-btn w-full sm:w-auto" onClick={() => applyGroupClassification(g)} disabled={state.applying}>
                        {state.applying ? "Aplicando…" : `Aplicar a ${g.movements.length}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        <div className="hidden md:flex gap-3 mb-3.5 flex-wrap items-center text-[11.5px]" style={{ color: "var(--dim)" }}>
          <span>Ocultar polvo:</span>
          <span className="flex items-center gap-1.5">
            mínimo $ <input className="cv-input w-16 py-1 px-2" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} />
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={hideUnpriced} onChange={(e) => setHideUnpriced(e.target.checked)} /> ocultar tokens sin precio conocido (spam)
          </label>
          {dustHiddenCount > 0 && <span>· {dustHiddenCount} ocultos</span>}
        </div>

        {filteredMovements.length === 0 ? (
          <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>Sin movimientos para mostrar.</div>
        ) : (
          <>
            {/* Vista móvil: tarjetas */}
            <div className="md:hidden space-y-2.5">
              {filteredMovements.map((m) => {
                const curAliado = effectiveAliadoId(m);
                const qa = quickAuditFor(m);
                const pending = isPending(m);
                return (
                  <div key={`${m.key}:${(m as any).walletId}`} className="rounded-xl p-3.5" style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 1px 3px rgba(1,45,55,0.05)" }}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: "var(--dim)" }}>
                        <ChainBadge chain={m.chain} size={16} />
                        <span className="truncate">{fmtDate(m.date)} · {m.walletLabel}</span>
                      </span>
                      {isInternalTransfer(m) ? (
                        <span className="text-[10.5px] rounded-full px-2 py-0.5" style={{ background: "var(--panel)", color: "var(--accent)" }}>interna</span>
                      ) : effectiveIsFee(m) ? (
                        <span className="text-[10.5px] rounded-full px-2 py-0.5" style={{ background: "#F1EEFB", color: "#6B4FBB" }}>💳 comisión de red</span>
                      ) : pending ? (
                        <span className="cv-icon-btn text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--tint)", color: "var(--amber)" }}><Clock size={10} /> pendiente</span>
                      ) : (
                        <span className="cv-icon-btn text-[10.5px] font-medium rounded-full px-2 py-0.5" style={{ background: "rgba(62,213,152,.14)", color: "var(--pos)" }}><CircleCheck size={10} /> clasificado</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-mono text-base font-semibold" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>
                        {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                      </div>
                      <a className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }} href={m.explorer} target="_blank" rel="noreferrer">{shortAddr(m.counterparty)} ↗</a>
                    </div>

                    {(!m.verified || isPoisoningSuspect(m.counterparty) || qa?.sanctioned || qa?.blacklisted || m.otherCount > 0) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {!m.verified && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>⚠ NO VERIFICADO</span>}
                        {isPoisoningSuspect(m.counterparty) && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--amber)", color: "var(--ink)" }}>⚠ similar a otra</span>}
                        {qa?.sanctioned && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>🚫 SANCIONADA</span>}
                        {qa?.blacklisted && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>🚫 LISTA NEGRA</span>}
                        {m.otherCount > 0 && <span className="text-[10px]" style={{ color: "var(--dim)" }}>+{m.otherCount} más</span>}
                      </div>
                    )}

                    {isInternalTransfer(m) ? (
                      <div className="text-[11.5px] rounded-md px-2.5 py-2 text-center" style={{ background: "var(--panel)", color: "var(--accent)", border: "1px solid var(--line)" }}>
                        ↔ transferencia a tu wallet "{findOwnWallet(m.chain, m.counterparty)?.label}"
                      </div>
                    ) : effectiveIsFee(m) ? (
                      <div className="flex items-center justify-between text-[11.5px] rounded-md px-2.5 py-2" style={{ background: "#F1EEFB", color: "#6B4FBB", border: "1px solid #E0D6F5" }}>
                        💳 Comisión de red
                        <button className="cv-x" onClick={() => saveClassification(m.key, { isFee: false })}>✕</button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <ConceptoInput
                            key={aiSuggestions[m.key] ? `${m.key}-ai` : m.key}
                            className="cv-input w-full py-2 px-2.5 text-sm"
                            placeholder="Concepto — ej. compra insumos"
                            value={aiSuggestions[m.key]?.concepto ?? effectiveConcepto(m)}
                            onSave={(concepto) => saveClassification(m.key, { concepto })}
                          />
                          <button
                            className="cv-x flex-shrink-0" title="Sugerir con IA" disabled={suggesting === m.key}
                            onClick={() => suggestForMovement(m)}
                          >
                            <Sparkles size={15} className={suggesting === m.key ? "animate-pulse" : ""} />
                          </button>
                        </div>
                        {aiSuggestions[m.key]?.aliadoSugerido && (
                          <div className="text-[10.5px]" style={{ color: "var(--accent)" }}>💡 Podría ser: {aiSuggestions[m.key].aliadoSugerido}</div>
                        )}
                        <select className="cv-select w-full py-2" value={curAliado || ""} onChange={(e) => handleAliadoSelect(m, e.target.value)}>
                          <option value="">Sin clasificar</option>
                          {aliados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          <option value="__new__">+ Nuevo aliado…</option>
                        </select>
                        <button className="cv-btn-ghost text-[10.5px] self-start" onClick={() => saveClassification(m.key, { isFee: true })}>💳 Marcar como comisión de red</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Vista escritorio: tabla */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr className="text-left text-[11px] uppercase" style={{ color: "var(--dim)" }}>
                <th className="p-2">Estado</th><th className="p-2">Fecha</th><th className="p-2">Wallet</th><th className="p-2">Monto</th><th className="p-2">Contraparte</th><th className="p-2">Concepto</th><th className="p-2">Aliado</th>
              </tr></thead>
              <tbody>
                {filteredMovements.map((m) => {
                  const curAliado = effectiveAliadoId(m);
                  const qa = quickAuditFor(m);
                  const pending = isPending(m);
                  return (
                    <tr key={`${m.key}:${(m as any).walletId}`} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="p-2">
                        {isInternalTransfer(m) ? (
                          <span className="text-[10.5px] rounded-full px-2 py-0.5" style={{ background: "var(--panel2)", color: "var(--accent)" }}>interna</span>
                        ) : effectiveIsFee(m) ? (
                          <span className="text-[10.5px] rounded-full px-2 py-0.5" style={{ background: "#F1EEFB", color: "#6B4FBB" }}>💳 comisión</span>
                        ) : pending ? (
                          <span className="cv-icon-btn text-[10.5px] font-semibold rounded-full px-2 py-0.5" style={{ background: "var(--tint)", color: "var(--amber)" }}><Clock size={10} /> pendiente</span>
                        ) : (
                          <span className="cv-icon-btn text-[10.5px] font-medium rounded-full px-2 py-0.5" style={{ background: "rgba(62,213,152,.14)", color: "var(--pos)" }}><CircleCheck size={10} /> clasificado</span>
                        )}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap" style={{ color: "var(--dim)" }}>{fmtDate(m.date)}</td>
                      <td className="p-2 text-xs">{m.walletLabel}</td>
                      <td className="p-2 font-mono whitespace-nowrap" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>
                        {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                        {!m.verified && (
                          <span title="El token dice ser esta moneda pero el contrato no coincide con el oficial — probable token falso/spam." className="ml-1.5 text-[10px] font-sans font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>
                            ⚠ NO VERIFICADO
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <a className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }} href={m.explorer} target="_blank" rel="noreferrer">{shortAddr(m.counterparty)}</a>
                        {m.otherCount > 0 && <span className="text-[10.5px]" style={{ color: "var(--dim)" }}> +{m.otherCount} más</span>}
                        {isPoisoningSuspect(m.counterparty) && (
                          <span title="Esta dirección se parece mucho a otra que has usado, pero es distinta — posible address poisoning. No la copies de aquí, verifica siempre en el explorador." className="ml-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--amber)", color: "var(--ink)" }}>
                            ⚠ similar a otra
                          </span>
                        )}
                        {qa?.sanctioned && (
                          <span title={`Dirección en la lista de sanciones OFAC (${qa.sanctionLists.join(", ")}).`} className="ml-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>
                            🚫 SANCIONADA
                          </span>
                        )}
                        {qa?.blacklisted && (
                          <span title="Esta dirección está en la lista negra de stablecoins (USDT/USDC congelado)." className="ml-1.5 text-[10px] font-semibold rounded px-1.5 py-0.5" style={{ background: "var(--neg)", color: "var(--panel)" }}>
                            🚫 LISTA NEGRA
                          </span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <ConceptoInput
                            key={aiSuggestions[m.key] ? `${m.key}-ai` : m.key}
                            className="cv-input w-[140px] py-1 px-2"
                            placeholder="ej. compra insumos"
                            value={aiSuggestions[m.key]?.concepto ?? effectiveConcepto(m)}
                            onSave={(concepto) => saveClassification(m.key, { concepto })}
                          />
                          {!isInternalTransfer(m) && !effectiveIsFee(m) && (
                            <button className="cv-x flex-shrink-0" title="Sugerir con IA" disabled={suggesting === m.key} onClick={() => suggestForMovement(m)}>
                              <Sparkles size={13} className={suggesting === m.key ? "animate-pulse" : ""} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {isInternalTransfer(m) ? (
                          <span className="text-[11px] rounded-full px-2.5 py-1" style={{ background: "var(--panel2)", color: "var(--accent)", border: "1px solid var(--line)" }}>
                            <ArrowLeftRight size={10} className="inline -mt-0.5 mr-1" />transferencia interna ({findOwnWallet(m.chain, m.counterparty)?.label})
                          </span>
                        ) : effectiveIsFee(m) ? (
                          <span className="cv-icon-btn text-[11px] rounded-full px-2.5 py-1" style={{ background: "#F1EEFB", color: "#6B4FBB", border: "1px solid #E0D6F5" }}>
                            💳 Comisión de red
                            <button className="cv-x" style={{ fontSize: 11 }} onClick={() => saveClassification(m.key, { isFee: false })}>✕</button>
                          </span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <select className="cv-select" value={curAliado || ""} onChange={(e) => handleAliadoSelect(m, e.target.value)}>
                              <option value="">Sin clasificar</option>
                              {aliados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                              <option value="__new__">+ Nuevo aliado…</option>
                            </select>
                            <button className="cv-x" title="Marcar como comisión de red" onClick={() => saveClassification(m.key, { isFee: true })}>💳</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {/* Hoja de filtros — solo móvil */}
      {showFilterSheet && (
        <>
          <div className="cv-sheet-backdrop md:hidden" onClick={() => setShowFilterSheet(false)} />
          <div className="cv-sheet md:hidden">
            <div className="cv-sheet-handle" />
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>Filtros</div>
              <button className="cv-x" onClick={() => setShowFilterSheet(false)}><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="cv-eyebrow mb-1.5">Dirección</div>
                <div className="grid grid-cols-3 gap-2">
                  {([["all", "Todas"], ["out", "Salidas"], ["in", "Entradas"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setDirFilter(v as any)}
                      className="rounded-xl py-2.5 text-[13px] font-medium"
                      style={{ background: dirFilter === v ? "var(--ink)" : "var(--panel2)", color: dirFilter === v ? "var(--panel)" : "var(--ink)", border: "none" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="cv-eyebrow mb-1.5">Estado</div>
                <div className="grid grid-cols-2 gap-2">
                  {([["all", "Cualquiera"], ["pending", "⏳ Pendientes"], ["classified", "✓ Clasificados"], ["internal", "↔ Internas"], ["fee", "💳 Comisiones"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setEstadoFilter(v as any)}
                      className="rounded-xl py-2.5 text-[13px] font-medium"
                      style={{ background: estadoFilter === v ? "var(--ink)" : "var(--panel2)", color: estadoFilter === v ? "var(--panel)" : "var(--ink)", border: "none" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="cv-eyebrow mb-1.5">Wallet</div>
                <select className="cv-select w-full" value={walletFilter} onChange={(e) => setWalletFilter(e.target.value)}>
                  <option value="all">Todas las wallets</option>
                  {wallets.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </div>

              <div>
                <div className="cv-eyebrow mb-1.5">Período</div>
                <div className="flex gap-2">
                  <input type="date" className="cv-input flex-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <input type="date" className="cv-input flex-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="cv-eyebrow mb-1.5">Ocultar polvo</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px]" style={{ color: "var(--dim)" }}>Mínimo $</span>
                  <input className="cv-input w-24" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--ink)" }}>
                  <input type="checkbox" checked={hideUnpriced} onChange={(e) => setHideUnpriced(e.target.checked)} style={{ width: 18, height: 18 }} />
                  Ocultar tokens sin precio (spam)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button className="cv-btn-ghost flex-1" onClick={() => {
                  setDirFilter("all"); setEstadoFilter("all"); setWalletFilter("all");
                  setDateFrom(""); setDateTo(""); setSearchText("");
                }}>Limpiar todo</button>
                <button className="cv-btn flex-1" onClick={() => setShowFilterSheet(false)}>
                  Ver {filteredMovements.length} movimientos
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Hoja de exportación — solo móvil */}
      {showExportSheet && (
        <>
          <div className="cv-sheet-backdrop md:hidden" onClick={() => setShowExportSheet(false)} />
          <div className="cv-sheet md:hidden">
            <div className="cv-sheet-handle" />
            <div className="flex items-center justify-between mb-1">
              <div className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>Exportar</div>
              <button className="cv-x" onClick={() => setShowExportSheet(false)}><X size={20} /></button>
            </div>
            <div className="text-[12px] mb-4" style={{ color: "var(--dim)" }}>
              Incluye los {filteredMovements.length} movimientos que estás viendo ahora, con los filtros aplicados.
            </div>
            <div className="space-y-2">
              <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { generateStatement("pdf"); setShowExportSheet(false); }} disabled={statementGenerating !== null}>
                <Download size={15} /> Estado de cuenta (PDF)
              </button>
              <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { generateStatement("excel"); setShowExportSheet(false); }} disabled={statementGenerating !== null}>
                <Download size={15} /> Estado de cuenta (Excel)
              </button>
              <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { exportFiltered(); setShowExportSheet(false); }}>
                <Download size={15} /> Movimientos (CSV)
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
