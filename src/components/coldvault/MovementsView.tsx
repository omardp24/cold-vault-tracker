"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Ban, ChevronRight, CircleCheck, Clock, CreditCard, Download, ExternalLink, Flag,
  MoreHorizontal, Pencil, Plus, RefreshCw, Repeat, Search, SlidersHorizontal, Sparkles, Trash2, TriangleAlert, Users as UsersIcon,
} from "lucide-react";
import {
  Aliado, CHAIN_LABEL, ChainBadge, Chain, Movement, Sheet, Wallet,
  fmtAmt, fmtDate, fmtUSD, shortAddr,
} from "./shared";
import { APP_TZ } from "@/lib/format";
import ConceptoInput from "./ConceptoInput";
import TransactionDetailModal, { type TxDetailContext } from "./TransactionDetailModal";
import type { SwapPair } from "@/lib/swaps";

type InnerView = "actividad" | "clasificar" | "aliados" | "resumen";
// «lun, 10 nov 2026» en hora de Caracas — encabezado de cada día en la lista.
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: APP_TZ });
type DirFilter = "all" | "in" | "out";
type EstadoFilter = "all" | "pending" | "classified" | "internal" | "swap" | "fee" | "suspicious";
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
  suspicionFor: (m: Movement) => { kind: "fraude" | "polvo"; label: string; reason: string; similarTo?: string } | null;
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
  usdFor: (m: Movement) => number | null;

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
  suspiciousCount: number;
  showSuspicious: boolean;
  setShowSuspicious: Dispatch<SetStateAction<boolean>>;

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
  /** El swap del que este movimiento es una de las dos patas (USDT → TRX, etc.), o null. */
  swapFor: (m: Movement) => SwapPair | null;
  isPending: (m: Movement) => boolean;
  findOwnWallet: (chain: Chain, addr: string | null) => Wallet | undefined;
  saveClassification: (key: string, patch: { aliadoId?: string | null; concepto?: string; isFee?: boolean }) => Promise<boolean>;
  handleAliadoSelect: (m: Movement, value: string) => void;
}

export default function MovementsView(props: MovementsViewProps) {
  const {
    wallets, movements, aliados,
    movLoading, movErr, loadMovements, cursors, loadingMoreId, loadMoreForWallet, isPoisoningSuspect, suspicionFor, quickAuditFor,
    runDiagnostics, diagRunning, diag,
    walletSummary, walletFilter, setWalletFilter,
    newAliadoName, setNewAliadoName, addAliado, selectedAliadoId, setSelectedAliadoId, selectedAliado, deleteAliado,
    selectedAliadoTotals, detailChain, setDetailChain, detailAddr, setDetailAddr, addAddressToAliado, removeAddressFromAliado,
    selectedAliadoMovements, exportAliado, effectiveConcepto, usdFor,
    summaryRows, summaryRowsIn, nameFor, internalTotal, feeTotal,
    searchText, setSearchText, activeFilterCount, showFilterSheet, setShowFilterSheet, showExportSheet, setShowExportSheet,
    dirFilter, setDirFilter, estadoFilter, setEstadoFilter, dateFrom, setDateFrom, dateTo, setDateTo,
    minUsd, setMinUsd, hideUnpriced, setHideUnpriced, dustHiddenCount, suspiciousCount, showSuspicious, setShowSuspicious,
    exportFiltered, generateStatement, statementGenerating,
    flowSummary, visibleMovements, filteredMovements, pendingCount,
    showGroupClassifier, setShowGroupClassifier, groupViewMode, setGroupViewMode, feeThreshold, setFeeThreshold,
    markSmallGroupsAsFee, markingFees, pendingGroups, groupExistingAliado, groupBatchState, toggleGroupExpand,
    expandedGroups, groupWalletCount, groupWalletLabels, setGroupField, applyGroupClassification,
    effectiveAliadoId, effectiveIsFee, isInternalTransfer, swapFor, isPending, findOwnWallet, saveClassification, handleAliadoSelect,
  } = props;

  // Sugerencia de clasificación con IA — mira movimientos parecidos ya clasificados (mismo
  // activo/red/dirección) y sugiere un concepto consistente con ese patrón. Nunca guarda sola:
  // solo precarga el campo de texto, el usuario confirma con el flujo normal (blur → saveClassification).
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { concepto: string; aliadoSugerido?: string }>>({});
  const [suggesting, setSuggesting] = useState<string | null>(null);
  // Móvil: los movimientos ya clasificados se muestran en una línea; se abren con «Editar».
  const [openCards, setOpenCards] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setOpenCards((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Resumen de la operación al tocarla (al estilo del detalle que muestra Ledger Live).
  const [detailMovement, setDetailMovement] = useState<Movement | null>(null);
  const buildDetailCtx = (m: Movement): TxDetailContext => {
    const w = wallets.find((x) => x.id === (m as any).walletId) || wallets.find((x) => x.label === m.walletLabel);
    const internal = isInternalTransfer(m);
    const sus = suspicionFor(m);
    const qa = quickAuditFor(m);
    return {
      wallet: { id: w?.id || "", label: m.walletLabel || w?.label || "—", address: w?.address || "" },
      aliadoName: aliados.find((a) => a.id === effectiveAliadoId(m))?.name || null,
      concepto: effectiveConcepto(m),
      isFee: effectiveIsFee(m),
      isInternal: internal,
      internalWithLabel: internal ? findOwnWallet(m.chain, m.counterparty)?.label || null : null,
      usd: usdFor(m) !== null ? usdFor(m)! * m.amount : null,
      suspicion: sus ? { kind: sus.kind, label: sus.label, reason: sus.reason } : null,
      sanctioned: !!qa?.sanctioned,
      blacklisted: !!qa?.blacklisted,
      poisoning: isPoisoningSuspect(m.counterparty),
    };
  };
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

  // Vista interna de la pantalla. «Actividad» es la lista; el resto son espacios propios para
  // clasificar en bloque, gestionar aliados y ver los totales.
  const [view, setView] = useState<InnerView>("actividad");
  const [showTools, setShowTools] = useState(false);

  const assetsLine = (assets: Record<string, number>) => Object.entries(assets).map(([a, v]) => `${fmtAmt(v)} ${a}`).join(" · ");
  const rowId = (m: Movement) => `${m.key}:${(m as any).walletId}`;
  const hasUnverified = movements.some((m) => !m.verified) || movements.some((m) => isPoisoningSuspect(m.counterparty));
  const hasSanctioned = movements.some((m) => quickAuditFor(m)?.sanctioned || quickAuditFor(m)?.blacklisted);
  const olderWallets = wallets.filter((w) => cursors[w.id]);

  // Agrupa la lista por día (hora de Caracas); filteredMovements ya viene ordenado por fecha.
  const dayGroups: { label: string; items: Movement[] }[] = [];
  filteredMovements.forEach((m) => {
    const label = m.date ? dayLabel(m.date) : "Sin confirmar";
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.label === label) last.items.push(m); else dayGroups.push({ label, items: [m] });
  });

  const statusTag = (m: Movement) => {
    if (isInternalTransfer(m)) return <span className="cv-tag" style={{ background: "var(--panel2)", color: "var(--accent)" }}><ArrowLeftRight size={10} /> interna</span>;
    if (swapFor(m)) return <span className="cv-tag" style={{ background: "var(--panel2)", color: "var(--accent)" }}><Repeat size={10} /> swap</span>;
    if (effectiveIsFee(m)) return <span className="cv-tag" style={{ background: "var(--panel2)", color: "var(--dim)" }}><CreditCard size={10} /> comisión</span>;
    if (isPending(m)) return <span className="cv-tag" style={{ background: "var(--tint)", color: "var(--amber)" }}><Clock size={10} /> pendiente</span>;
    return <span className="cv-tag" style={{ background: "rgba(62,213,152,.14)", color: "var(--pos)" }}><CircleCheck size={10} /> clasificado</span>;
  };

  const flagTags = (m: Movement) => {
    const sus = suspicionFor(m);
    const qa = quickAuditFor(m);
    if (!sus && m.verified && !isPoisoningSuspect(m.counterparty) && !qa?.sanctioned && !qa?.blacklisted) return null;
    const bad = { background: "var(--neg)", color: "#fff" };
    const warn = { background: "var(--amber)", color: "#0e2830" };
    return (
      <span className="flex flex-wrap gap-1 mt-1.5">
        {sus && <span title={sus.reason} className="cv-tag" style={sus.kind === "fraude" ? bad : warn}><Flag size={10} /> {sus.label}</span>}
        {!m.verified && <span title="El token dice ser esta moneda pero el contrato no coincide con el oficial — probable token falso/spam." className="cv-tag" style={bad}><TriangleAlert size={10} /> no verificado</span>}
        {isPoisoningSuspect(m.counterparty) && <span title="Esta dirección se parece mucho a otra que has usado, pero es distinta — posible address poisoning. No la copies de aquí, verifica siempre en el explorador." className="cv-tag" style={warn}><TriangleAlert size={10} /> similar a otra</span>}
        {qa?.sanctioned && <span title={`Dirección en la lista de sanciones OFAC (${qa.sanctionLists.join(", ")}).`} className="cv-tag" style={bad}><Ban size={10} /> sancionada</span>}
        {qa?.blacklisted && <span title="Esta dirección está en la lista negra de stablecoins (USDT/USDC congelado)." className="cv-tag" style={bad}><Ban size={10} /> lista negra</span>}
      </span>
    );
  };

  const aliadoOptions = (
    <>
      <option value="">Sin clasificar</option>
      {aliados.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      <option value="__new__">+ Nuevo aliado…</option>
    </>
  );

  /** Fila de un movimiento: en teléfono es una tarjeta que se pliega al clasificar; en escritorio, una fila con la clasificación en línea. */
  const movementRow = (m: Movement) => {
    const id = rowId(m);
    const pending = isPending(m);
    const internal = isInternalTransfer(m);
    const swap = swapFor(m);
    const fee = effectiveIsFee(m);
    const editing = pending || openCards.has(id);
    const curAliado = effectiveAliadoId(m);
    const usd = usdFor(m);
    const out = m.direction === "out";
    return (
      <div key={id} className="cv-row border-t px-1.5 py-3 md:py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-5 md:items-center rounded-md" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-start gap-1 min-w-0">
          <button type="button" className="flex items-start gap-3 min-w-0 flex-1 text-left" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 }} onClick={() => setDetailMovement(m)} title="Ver detalle de la operación">
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: internal || swap ? "var(--panel2)" : out ? "rgba(255,107,90,.14)" : "rgba(62,213,152,.14)", color: internal || swap ? "var(--accent)" : out ? "var(--neg)" : "var(--pos)" }}>
              {swap ? <Repeat size={16} /> : internal ? <ArrowLeftRight size={16} /> : out ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
            </span>
            <span className="min-w-0 flex-1 block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[14.5px] font-semibold whitespace-nowrap" style={{ color: out ? "var(--neg)" : "var(--pos)" }}>
                  {out ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                </span>
                {usd !== null && <span className="font-mono text-[11px] flex-shrink-0" style={{ color: "var(--faint)" }}>{fmtUSD(usd * m.amount)}</span>}
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] mt-0.5 min-w-0" style={{ color: "var(--dim)" }}>
                <ChainBadge chain={m.chain} size={14} />
                <span className="truncate">{m.walletLabel} · <span className="font-addr">{shortAddr(m.counterparty)}</span>{m.otherCount > 0 && ` +${m.otherCount} más`}</span>
              </span>
              {flagTags(m)}
            </span>
          </button>
          <a className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 32, height: 32, color: "var(--faint)" }} href={m.explorer} target="_blank" rel="noreferrer" title="Abrir en el explorador" aria-label="Abrir en el explorador"><ExternalLink size={14} /></a>
        </div>

        <div className="mt-2.5 md:mt-0 min-w-0">
          {swap ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--dim)" }}>
              {statusTag(m)}
              <span className="truncate">
                Cambio: {fmtAmt(swap.out.amount)} {swap.out.asset} ({(swap.out as Movement).walletLabel}) → {fmtAmt(swap.in.amount)} {swap.in.asset} ({(swap.in as Movement).walletLabel})
              </span>
            </div>
          ) : internal ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--dim)" }}>
              {statusTag(m)} <span className="truncate">{out ? "a" : "desde"} tu wallet «{findOwnWallet(m.chain, m.counterparty)?.label}»</span>
            </div>
          ) : fee ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--dim)" }}>
              {statusTag(m)} <span className="truncate">Comisión de red</span>
              <button className="cv-x ml-auto" title="Quitar la marca de comisión" aria-label="Quitar la marca de comisión" onClick={() => saveClassification(m.key, { isFee: false })}>✕</button>
            </div>
          ) : (
            <>
              {/* Teléfono, ya clasificado: una línea con «Editar» */}
              {!editing && (
                <div className="md:hidden flex items-center justify-between gap-2 rounded-lg px-2.5 py-2" style={{ background: "var(--panel2)" }}>
                  <div className="min-w-0 text-[12.5px] truncate">
                    <span className="font-semibold">{aliados.find((a) => a.id === curAliado)?.name || "—"}</span>
                    {effectiveConcepto(m).trim() && <span style={{ color: "var(--dim)" }}> · {effectiveConcepto(m)}</span>}
                  </div>
                  <button className="cv-x flex-shrink-0" onClick={() => toggleCard(id)} title="Editar clasificación" aria-label="Editar clasificación"><Pencil size={14} /></button>
                </div>
              )}
              <div className={`${editing ? "flex" : "hidden md:flex"} flex-col md:flex-row md:items-center gap-1.5`}>
                <span className="hidden md:block flex-shrink-0">{statusTag(m)}</span>
                <div className="flex gap-1 md:flex-1 min-w-0">
                  <ConceptoInput
                    key={aiSuggestions[m.key] ? `${m.key}-ai` : m.key}
                    className="cv-input w-full min-w-0 md:py-1.5 md:px-2.5"
                    placeholder="Concepto — ej. compra insumos"
                    value={aiSuggestions[m.key]?.concepto ?? effectiveConcepto(m)}
                    onSave={(concepto) => saveClassification(m.key, { concepto })}
                  />
                  <button className="cv-x flex-shrink-0" title="Sugerir con IA" aria-label="Sugerir con IA" disabled={suggesting === m.key} onClick={() => suggestForMovement(m)}>
                    <Sparkles size={14} className={suggesting === m.key ? "animate-pulse" : ""} />
                  </button>
                </div>
                <select className="cv-select w-full md:w-[168px] md:flex-shrink-0" value={curAliado || ""} onChange={(e) => handleAliadoSelect(m, e.target.value)} aria-label="Aliado">
                  {aliadoOptions}
                </select>
                <div className="flex items-center justify-between gap-2 md:flex-shrink-0">
                  <button className="cv-x inline-flex items-center gap-1.5 text-[11.5px]" style={{ fontSize: 11.5 }} title="Marcar como comisión de red" onClick={() => saveClassification(m.key, { isFee: true })}>
                    <CreditCard size={14} /> <span className="md:hidden">Marcar como comisión</span>
                  </button>
                  {!pending && <span className="md:hidden"><button className="cv-btn-ghost" onClick={() => toggleCard(id)}>Listo</button></span>}
                </div>
              </div>
              {aiSuggestions[m.key]?.aliadoSugerido && editing && (
                <div className="text-[11px] mt-1" style={{ color: "var(--accent)" }}>Podría ser: {aiSuggestions[m.key].aliadoSugerido}</div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const filterControls = (
    <div className="space-y-4">
      <div>
        <div className="cv-eyebrow mb-1.5">Dirección</div>
        <div className="grid grid-cols-3 gap-2">
          {([["all", "Todas"], ["out", "Salidas"], ["in", "Entradas"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setDirFilter(v)} className="rounded-xl py-2.5 text-[13px] font-medium"
              style={{ background: dirFilter === v ? "var(--accent)" : "var(--panel2)", color: dirFilter === v ? "#fff" : "var(--ink)", border: "none", cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="cv-eyebrow mb-1.5">Estado</div>
        <div className="grid grid-cols-2 gap-2">
          {([["all", "Cualquiera"], ["pending", "Pendientes"], ["classified", "Clasificados"], ["internal", "Internas"], ["swap", "Swaps"], ["fee", "Comisiones"], ["suspicious", "Polvo / fraude"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setEstadoFilter(v)} className="rounded-xl py-2.5 text-[13px] font-medium"
              style={{ background: estadoFilter === v ? "var(--accent)" : "var(--panel2)", color: estadoFilter === v ? "#fff" : "var(--ink)", border: "none", cursor: "pointer" }}>{l}</button>
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
          <input type="date" className="cv-input flex-1 min-w-0" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Desde" />
          <input type="date" className="cv-input flex-1 min-w-0" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Hasta" />
        </div>
      </div>
      <div>
        <div className="cv-eyebrow mb-1.5">Ocultar polvo</div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px]" style={{ color: "var(--dim)" }}>Mínimo $</span>
          <input className="cv-input w-24" value={minUsd} onChange={(e) => setMinUsd(e.target.value)} />
          {dustHiddenCount > 0 && <span className="text-[12px]" style={{ color: "var(--faint)" }}>{dustHiddenCount} ocultos</span>}
        </div>
        <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: "var(--ink)" }}>
          <input type="checkbox" checked={hideUnpriced} onChange={(e) => setHideUnpriced(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
          Ocultar tokens sin precio (spam)
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button className="cv-btn-ghost flex-1" onClick={() => { setDirFilter("all"); setEstadoFilter("all"); setWalletFilter("all"); setDateFrom(""); setDateTo(""); setSearchText(""); }}>Limpiar todo</button>
        <button className="cv-btn flex-1" onClick={() => setShowFilterSheet(false)}>Ver {filteredMovements.length} movimientos</button>
      </div>
    </div>
  );

  const net = flowSummary.inUsd - flowSummary.outUsd;
  const maxOut = Math.max(1, ...summaryRows.map((r) => r.usdApprox));
  const maxIn = Math.max(1, ...summaryRowsIn.map((r) => r.usdApprox));

  const summaryCard = (title: string, rows: typeof summaryRows, max: number, color: string) => (
    <div className="cv-card p-4 sm:p-5">
      <div className="font-display text-sm font-semibold">{title}</div>
      <div className="text-[11px] mb-3" style={{ color: "var(--faint)" }}>Valor USD aproximado al precio actual.</div>
      {rows.map((r) => (
        <div key={r.id} className="py-2.5 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium truncate" style={{ color: r.id === "sin_clasificar" ? "var(--dim)" : "var(--ink)" }}>{nameFor(r.id)}</span>
            <span className="font-mono text-[13.5px] font-bold flex-shrink-0" style={{ color }}>{fmtUSD(r.usdApprox)}</span>
          </div>
          <div className="h-[4px] rounded-full overflow-hidden my-1.5" style={{ background: "var(--panel2)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max((r.usdApprox / max) * 100, 1)}%`, background: color, opacity: r.id === "sin_clasificar" ? 0.45 : 1 }} />
          </div>
          <div className="text-[11px] font-mono truncate" style={{ color: "var(--dim)" }}>{r.count} mov · {assetsLine(r.assets)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Cabecera: título, actualizar y herramientas */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowLeftRight size={17} strokeWidth={2.25} style={{ color: "var(--dim)" }} />
          <div className="font-display text-[15px] font-semibold truncate">Movimientos</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button className="cv-btn inline-flex items-center gap-1.5" onClick={loadMovements} disabled={movLoading || wallets.length === 0}>
            <RefreshCw size={13} className={movLoading ? "animate-spin" : ""} /> {movLoading ? "Cargando…" : "Actualizar"}
          </button>
          <button
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 40, height: 40, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)", cursor: "pointer" }}
            onClick={() => setShowTools(true)} title="Herramientas" aria-label="Herramientas"
          ><MoreHorizontal size={17} /></button>
        </div>
      </div>

      {movErr && <div className="text-xs mb-3" style={{ color: "var(--neg)" }}>{movErr}</div>}
      {wallets.length === 0 && <div className="text-[12.5px] mb-3" style={{ color: "var(--dim)" }}>Añade al menos una dirección en la pestaña Portafolio primero.</div>}

      {hasSanctioned && (
        <details className="mb-2.5 rounded-xl px-3.5 py-2.5 text-[12px]" style={{ background: "rgba(255,107,90,.12)", border: "1px solid var(--neg)", color: "var(--ink)" }}>
          <summary className="cursor-pointer font-semibold flex items-center gap-1.5" style={{ listStyle: "none" }}><Ban size={13} style={{ color: "var(--neg)" }} /> Contraparte sancionada o en lista negra <span className="font-normal" style={{ color: "var(--faint)" }}>· ver más</span></summary>
          <div className="mt-2">Al menos una contraparte en tu historial está en la <strong>lista de sanciones OFAC</strong> o en una <strong>lista negra de stablecoins</strong>. Búscala en la lista (marcada en rojo) y revisa esa transacción con cuidado — considera consultar asesoría legal si corresponde a montos relevantes.</div>
        </details>
      )}
      {hasUnverified && (
        <details className="mb-2.5 rounded-xl px-3.5 py-2.5 text-[12px]" style={{ background: "var(--tint)", border: "1px solid var(--amber)", color: "var(--ink)" }}>
          <summary className="cursor-pointer font-semibold flex items-center gap-1.5" style={{ listStyle: "none" }}><TriangleAlert size={13} style={{ color: "var(--amber)" }} /> Tokens no verificados o direcciones parecidas <span className="font-normal" style={{ color: "var(--faint)" }}>· ver más</span></summary>
          <div className="mt-2">Se detectaron movimientos con <strong>tokens no verificados</strong> y/o <strong>direcciones muy similares a otras que has usado</strong> — señales típicas de intentos de estafa (address poisoning / tokens falsos). No cuentan en tus totales en USD, pero revísalos en la lista y verifica cualquier transacción sospechosa directamente en el explorador antes de confiar en ella. Nunca copies una dirección de destino desde aquí sin comparar el texto completo.</div>
        </details>
      )}

      {/* Vistas internas */}
      <div className="mb-4">
        <div className="cv-subtabs" role="tablist" style={{ width: "fit-content" }}>
          {([
            ["actividad", "Actividad", null],
            ["clasificar", "Por clasificar", pendingCount || null],
            ["aliados", "Aliados", aliados.length || null],
            ["resumen", "Resumen", null],
          ] as [InnerView, string, number | null][]).map(([id, label, count]) => (
            <button key={id} role="tab" aria-selected={view === id} className="cv-subtab" data-active={view === id} onClick={(e) => { setView(id); e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" }); }}>
              {label}{count !== null && <span className="cv-subtab-count">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ============ ACTIVIDAD ============ */}
      {view === "actividad" && (
        <div className="cv-tab-in">
          <div className="flex gap-2 mb-2.5 items-center">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--faint)" }} />
              <input className="cv-input w-full" style={{ paddingLeft: 34 }} placeholder="Buscar dirección, concepto o aliado…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            </div>
            <span className="hidden lg:block flex-shrink-0">
              <select className="cv-select" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as EstadoFilter)} aria-label="Estado">
                <option value="all">Cualquier estado</option>
                <option value="pending">Pendientes</option>
                <option value="classified">Clasificados</option>
                <option value="internal">Internas</option>
                <option value="swap">Swaps</option>
                <option value="fee">Comisiones de red</option>
                <option value="suspicious">Polvo / posible fraude</option>
              </select>
            </span>
            <button
              className="cv-btn-ghost cv-icon-btn flex-shrink-0"
              style={activeFilterCount > 0 ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
              onClick={() => setShowFilterSheet(true)}
            >
              <SlidersHorizontal size={14} /> <span className="hidden sm:inline">Filtros</span>{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
            <button className="cv-btn-ghost cv-icon-btn flex-shrink-0" onClick={() => setShowExportSheet(true)} title="Exportar" aria-label="Exportar">
              <Download size={14} /> <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>

          {/* Wallets como filtro rápido */}
          {wallets.length > 0 && (
            <div className="cv-scroll-x flex gap-2 mb-3 pb-1" style={{ scrollbarWidth: "none" }}>
              <button className="cv-tag flex-shrink-0" style={{ padding: "7px 13px", fontSize: 12, cursor: "pointer", border: `1px solid ${walletFilter === "all" ? "var(--accent)" : "var(--line)"}`, background: walletFilter === "all" ? "var(--tint)" : "var(--panel)", color: walletFilter === "all" ? "var(--accent)" : "var(--dim)" }} onClick={() => setWalletFilter("all")}>Todas</button>
              {walletSummary.map((ws) => {
                const on = walletFilter === ws.wallet.id;
                return (
                  <button key={ws.wallet.id} className="cv-tag flex-shrink-0" title={`${ws.count} movimiento${ws.count !== 1 ? "s" : ""}${ws.lastDate ? ` · último ${fmtDate(ws.lastDate)}` : ""}`}
                    style={{ padding: "5px 12px 5px 6px", fontSize: 12, gap: 6, cursor: "pointer", border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--tint)" : "var(--panel)", color: on ? "var(--accent)" : "var(--ink)" }}
                    onClick={() => setWalletFilter(on ? "all" : ws.wallet.id)}>
                    <ChainBadge chain={ws.wallet.chain} size={18} /> {ws.wallet.label}
                    {ws.pending > 0 && <span className="font-mono text-[10.5px] rounded-full px-1.5" style={{ background: "var(--accent)", color: "#fff" }}>{ws.pending}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Flujo del período / filtro actual */}
          <div className="cv-card grid grid-cols-3 mb-3 overflow-hidden">
            {([["Entradas", flowSummary.inUsd, "var(--pos)", "+"], ["Salidas", flowSummary.outUsd, "var(--neg)", "−"], ["Neto", Math.abs(net), "var(--ink)", net < 0 ? "−" : ""]] as const).map(([label, val, color, sign], i) => (
              <div key={label} className="px-3 py-3 sm:px-5 min-w-0" style={{ borderLeft: i > 0 ? "1px solid var(--line)" : "none" }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{label}</div>
                <div className="font-mono font-bold mt-0.5 truncate" style={{ color, fontSize: "clamp(12.5px, 3.6vw, 19px)" }}>{sign}{fmtUSD(val)}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-x-3 gap-y-1.5 mb-2 flex-wrap items-center text-[11.5px] px-0.5" style={{ color: "var(--dim)" }}>
            <span>{filteredMovements.length} movimiento{filteredMovements.length !== 1 ? "s" : ""}{dustHiddenCount > 0 ? ` · ${dustHiddenCount} ocultos` : ""}</span>
            {flowSummary.feeUsd > 0 && <span>· {fmtUSD(flowSummary.feeUsd)} en comisiones</span>}
            {pendingCount > 0 && (
              <button className="cv-tag" style={{ background: "var(--tint)", color: "var(--accent)", border: "1px solid var(--accent)", cursor: "pointer", padding: "4px 10px" }} onClick={() => setView("clasificar")}>
                <Clock size={11} /> {pendingCount} por clasificar <ChevronRight size={11} />
              </button>
            )}
          </div>

          {estadoFilter === "suspicious" ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 rounded-xl px-3.5 py-2 text-[12px]" style={{ background: "var(--tint)", color: "var(--ink)" }}>
              <span className="inline-flex items-center gap-1.5"><Flag size={12} style={{ color: "var(--accent)" }} /> Viendo solo <strong>polvo y posible fraude</strong>.</span>
              <button className="cv-btn-ghost" onClick={() => setEstadoFilter("all")}>Volver a mis movimientos</button>
            </div>
          ) : suspiciousCount > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3 rounded-xl px-3.5 py-2 text-[12px]" style={{ background: "var(--tint)", color: "var(--ink)" }}>
              <span className="inline-flex items-center gap-1.5"><Flag size={12} style={{ color: "var(--accent)" }} /> {showSuspicious ? `Mostrando ${suspiciousCount}` : `${suspiciousCount} ocultas:`} entradas de polvo / posible fraude{showSuspicious ? " mezcladas en la lista" : ""}.</span>
              <button className="cv-btn-ghost" onClick={() => setEstadoFilter("suspicious")}>Verlas por separado</button>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11.5px]">
                <input type="checkbox" checked={showSuspicious} onChange={(e) => setShowSuspicious(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Incluirlas
              </label>
            </div>
          ) : null}

          {filteredMovements.length === 0 ? (
            <div className="cv-card p-8 text-center text-[12.5px]" style={{ color: "var(--dim)" }}>
              {movements.length === 0 ? "Aún no hay movimientos cargados. Toca «Actualizar» para leerlos de la red." : "Sin movimientos para estos filtros."}
            </div>
          ) : (
            dayGroups.map((g) => (
              <div key={g.label} className="mb-3">
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{g.label}</span>
                  <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
                  <span className="font-mono text-[10.5px]" style={{ color: "var(--faint)" }}>{g.items.length}</span>
                </div>
                <div className="cv-card px-2 sm:px-3 cv-daylist">{g.items.map(movementRow)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============ POR CLASIFICAR ============ */}
      {view === "clasificar" && (
        <div className="cv-tab-in">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div className="text-[12px] min-w-0" style={{ color: "var(--dim)" }}>
              Agrupado por dirección — {groupViewMode === "pending" ? "clasifica una vez y aplica a todas las pendientes de esa contraparte." : "todo tu historial con cada dirección, para identificar de quién es."}
            </div>
            <div className="cv-subtabs flex-shrink-0">
              <button className="cv-subtab" style={{ padding: "6px 12px", fontSize: 11.5 }} data-active={groupViewMode === "pending"} onClick={() => setGroupViewMode("pending")}>Pendientes</button>
              <button className="cv-subtab" style={{ padding: "6px 12px", fontSize: 11.5 }} data-active={groupViewMode === "all"} onClick={() => setGroupViewMode("all")}>Todas</button>
            </div>
          </div>

          {groupViewMode === "pending" && pendingGroups.length > 0 && (
            <div className="cv-card px-3.5 py-3 mb-3 flex items-center gap-2.5 flex-wrap text-[12px]" style={{ color: "var(--dim)" }}>
              <CreditCard size={14} className="flex-shrink-0" />
              <span className="min-w-0">Marcar como comisión de red los grupos menores a</span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-mono" style={{ color: "var(--ink)" }}>$</span>
                <input className="cv-input w-20 py-1 px-2" value={feeThreshold} onChange={(e) => setFeeThreshold(e.target.value)} aria-label="Umbral en dólares" />
                <button className="cv-btn-ghost" onClick={markSmallGroupsAsFee} disabled={markingFees}>{markingFees ? "Marcando…" : "Aplicar"}</button>
              </span>
            </div>
          )}

          {pendingGroups.length === 0 ? (
            <div className="cv-card p-8 text-center" style={{ color: "var(--dim)" }}>
              <CircleCheck size={26} className="mx-auto mb-2" style={{ color: "var(--pos)" }} />
              <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{groupViewMode === "pending" ? "Todo clasificado" : "Sin contrapartes todavía"}</div>
              <div className="text-[12px] mt-1">{groupViewMode === "pending" ? "No hay transacciones pendientes por clasificar." : "No hay movimientos con contraparte para mostrar."}</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              {pendingGroups.map((g) => {
                const existing = groupExistingAliado(g);
                const state = groupBatchState[g.key] || {
                  aliadoId: existing.status === "single" ? (aliados.find((a) => a.name === existing.name)?.id || "") : "",
                  concepto: "", applying: false,
                };
                const open = expandedGroups.has(g.key);
                return (
                  <div key={g.key} className="cv-card p-3.5 sm:p-4">
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ChainBadge chain={g.chain} size={28} />
                        <div className="min-w-0">
                          <div className="font-addr text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{shortAddr(g.address)}</div>
                          <button onClick={() => toggleGroupExpand(g.key)} className="inline-flex items-center gap-1 text-[11.5px]" style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer" }}>
                            {g.movements.length} transacci{g.movements.length === 1 ? "ón" : "ones"}{groupWalletCount(g) > 1 ? ` · ${groupWalletCount(g)} wallets` : ""}
                            <ChevronRight size={12} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-[12.5px] font-semibold text-right flex-shrink-0">
                        {Object.keys(g.totals).length > 0 && <div style={{ color: "var(--neg)" }}>{Object.entries(g.totals).map(([a, v]) => `−${fmtAmt(v)} ${a}`).join(" · ")}</div>}
                        {Object.keys(g.totalsIn).length > 0 && <div style={{ color: "var(--pos)" }}>{Object.entries(g.totalsIn).map(([a, v]) => `+${fmtAmt(v)} ${a}`).join(" · ")}</div>}
                      </div>
                    </div>
                    {groupViewMode === "all" && existing.status !== "none" && (
                      <div className="mb-2.5">
                        {existing.status === "single"
                          ? <span className="cv-tag" style={{ background: "rgba(62,213,152,.14)", color: "var(--pos)" }}><CircleCheck size={10} /> {existing.name}</span>
                          : <span className="cv-tag" style={{ background: "rgba(255,107,90,.14)", color: "var(--neg)" }}><TriangleAlert size={10} /> clasificación mixta</span>}
                      </div>
                    )}
                    {open && (
                      <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)" }}>
                        <div className="text-[10.5px] px-2.5 pt-2" style={{ color: "var(--faint)" }}>{groupWalletLabels(g).join(" · ")}</div>
                        {g.movements.map((m) => (
                          <div key={rowId(m)} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-[11.5px] border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
                            <span className="truncate" style={{ color: "var(--dim)" }}>{fmtDate(m.date)} · <span style={{ color: "var(--ink)" }}>{m.walletLabel}</span></span>
                            <span className="font-mono flex-shrink-0" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>{m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input className="cv-input w-full sm:flex-1 min-w-0" placeholder="Concepto — ej. compra insumos" value={state.concepto} onChange={(e) => setGroupField(g.key, { concepto: e.target.value })} />
                      <select className="cv-select w-full sm:w-[160px]" value={state.aliadoId} onChange={(e) => setGroupField(g.key, { aliadoId: e.target.value })} aria-label="Aliado">{aliadoOptions}</select>
                      <button className="cv-btn w-full sm:w-auto flex-shrink-0" onClick={() => applyGroupClassification(g)} disabled={state.applying}>{state.applying ? "Aplicando…" : `Aplicar a ${g.movements.length}`}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ ALIADOS ============ */}
      {view === "aliados" && (
        <div className="cv-tab-in">
          <div className="flex gap-2 mb-3">
            <input className="cv-input flex-1 min-w-0 sm:max-w-[320px]" placeholder="Nombre del aliado (ej. Proveedor Insumos)" value={newAliadoName} onChange={(e) => setNewAliadoName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addAliado(); }} />
            <button className="cv-btn inline-flex items-center gap-1.5 flex-shrink-0" onClick={addAliado}><Plus size={14} /> Crear</button>
          </div>
          {aliados.length === 0 ? (
            <div className="cv-card p-8 text-center text-[12.5px]" style={{ color: "var(--dim)" }}>
              <UsersIcon size={24} className="mx-auto mb-2 opacity-60" />
              Crea aliados y asígnalos a cada movimiento desde Actividad o Por clasificar.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {aliados.map((a) => {
                const paid = summaryRows.find((r) => r.id === a.id);
                const got = summaryRowsIn.find((r) => r.id === a.id);
                return (
                  <button key={a.id} className="cv-card cv-card-hover p-4 text-left" style={{ color: "var(--ink)", cursor: "pointer" }} onClick={() => setSelectedAliadoId(a.id)}>
                    <div className="flex items-center gap-2.5 mb-3">
                      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}>{a.name.charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold truncate">{a.name}</div>
                        <div className="text-[11px]" style={{ color: "var(--faint)" }}>{a.addresses.length} direcci{a.addresses.length === 1 ? "ón" : "ones"} · {(paid?.count || 0) + (got?.count || 0)} mov</div>
                      </div>
                      <ChevronRight size={15} className="flex-shrink-0" style={{ color: "var(--faint)" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl px-3 py-2" style={{ background: "var(--panel2)" }}>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Pagado</div>
                        <div className="font-mono text-[13px] font-bold truncate" style={{ color: paid ? "var(--neg)" : "var(--faint)" }}>{paid ? fmtUSD(paid.usdApprox) : "—"}</div>
                      </div>
                      <div className="rounded-xl px-3 py-2" style={{ background: "var(--panel2)" }}>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>Recibido</div>
                        <div className="font-mono text-[13px] font-bold truncate" style={{ color: got ? "var(--pos)" : "var(--faint)" }}>{got ? fmtUSD(got.usdApprox) : "—"}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ RESUMEN ============ */}
      {view === "resumen" && (
        <div className="cv-tab-in">
          {summaryRows.length === 0 && summaryRowsIn.length === 0 ? (
            <div className="cv-card p-8 text-center text-[12.5px] mb-3" style={{ color: "var(--dim)" }}>Aún no hay movimientos para resumir.</div>
          ) : (
            <div className={`grid grid-cols-1 gap-3 sm:gap-4 mb-3 sm:mb-4 items-start ${summaryRows.length > 0 && summaryRowsIn.length > 0 ? "lg:grid-cols-2" : ""}`}>
              {summaryRows.length > 0 && summaryCard("Gasto por aliado", summaryRows, maxOut, "var(--neg)")}
              {summaryRowsIn.length > 0 && summaryCard("Recibido de aliado", summaryRowsIn, maxIn, "var(--pos)")}
            </div>
          )}
          {(internalTotal.count > 0 || feeTotal.count > 0) && (
            <div className="cv-card p-4 sm:p-5 mb-3 sm:mb-4 text-[12px] space-y-2" style={{ color: "var(--dim)" }}>
              <div className="font-display text-sm font-semibold" style={{ color: "var(--ink)" }}>No cuentan como pagos a terceros</div>
              {internalTotal.count > 0 && (
                <div className="flex items-start gap-2"><ArrowLeftRight size={13} className="flex-shrink-0 mt-0.5" /><span>{internalTotal.count} transferencia{internalTotal.count > 1 ? "s" : ""} entre tus propias wallets <span className="font-mono">({assetsLine(internalTotal.assets)})</span></span></div>
              )}
              {feeTotal.count > 0 && (
                <div className="flex items-start gap-2"><CreditCard size={13} className="flex-shrink-0 mt-0.5" /><span>{feeTotal.count} comisi{feeTotal.count > 1 ? "ones" : "ón"} de red <span className="font-mono">({assetsLine(feeTotal.assets)})</span> ≈ <span className="font-mono" style={{ color: "var(--ink)" }}>{fmtUSD(feeTotal.usdApprox)}</span></span></div>
              )}
            </div>
          )}
          {wallets.length > 0 && (
            <div className="cv-card p-4 sm:p-5">
              <div className="font-display text-sm font-semibold mb-1">Por wallet</div>
              <div className="text-[11px] mb-2" style={{ color: "var(--faint)" }}>Toca una wallet para ver solo sus movimientos.</div>
              {walletSummary.map((ws) => (
                <button key={ws.wallet.id} className="cv-row w-full text-left flex items-center gap-3 py-2.5 px-1.5 border-t rounded-md" style={{ borderColor: "var(--line)", background: "none", borderLeft: "none", borderRight: "none", borderBottom: "none", color: "var(--ink)", cursor: "pointer" }}
                  onClick={() => { setWalletFilter(ws.wallet.id); setView("actividad"); }}>
                  <ChainBadge chain={ws.wallet.chain} size={26} />
                  <span className="min-w-0 flex-1 block">
                    <span className="flex items-center gap-2"><span className="text-[13px] font-medium truncate">{ws.wallet.label}</span>{ws.pending > 0 && <span className="cv-tag" style={{ background: "var(--tint)", color: "var(--amber)" }}><Clock size={10} /> {ws.pending}</span>}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--dim)" }}>{ws.count} movimiento{ws.count !== 1 ? "s" : ""}{ws.lastDate ? ` · último ${fmtDate(ws.lastDate)}` : ""}</span>
                  </span>
                  <span className="text-right font-mono text-[12px] flex-shrink-0">
                    <span className="block" style={{ color: "var(--pos)" }}>+{fmtUSD(ws.inUsd)}</span>
                    <span className="block" style={{ color: "var(--neg)" }}>−{fmtUSD(ws.outUsd)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Hojas ---- */}
      {showFilterSheet && <Sheet title="Filtros" onClose={() => setShowFilterSheet(false)}>{filterControls}</Sheet>}

      {showExportSheet && (
        <Sheet title="Exportar" onClose={() => setShowExportSheet(false)}>
          <div className="text-[12px] mb-4" style={{ color: "var(--dim)" }}>Incluye los {filteredMovements.length} movimientos que estás viendo ahora, con los filtros aplicados.</div>
          <div className="space-y-2">
            <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { generateStatement("pdf"); setShowExportSheet(false); }} disabled={statementGenerating !== null}><Download size={15} /> {statementGenerating === "pdf" ? "Generando…" : "Estado de cuenta (PDF)"}</button>
            <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { generateStatement("excel"); setShowExportSheet(false); }} disabled={statementGenerating !== null}><Download size={15} /> {statementGenerating === "excel" ? "Generando…" : "Estado de cuenta (Excel)"}</button>
            <button className="cv-btn-ghost w-full justify-center cv-icon-btn" onClick={() => { exportFiltered(); setShowExportSheet(false); }}><Download size={15} /> Movimientos (CSV)</button>
          </div>
        </Sheet>
      )}

      {showTools && (
        <Sheet title="Herramientas" onClose={() => setShowTools(false)}>
          <div className="space-y-4">
            {olderWallets.length > 0 && (
              <div>
                <div className="cv-eyebrow mb-1.5">Historial anterior</div>
                <div className="space-y-2">
                  {olderWallets.map((w) => (
                    <button key={w.id} className="cv-btn-ghost w-full cv-icon-btn justify-center" onClick={() => loadMoreForWallet(w)} disabled={loadingMoreId === w.id}>
                      {loadingMoreId === w.id ? "Cargando…" : `Cargar más de ${w.label}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="cv-eyebrow mb-1.5">Conexión</div>
              <button className="cv-btn-ghost w-full cv-icon-btn justify-center" onClick={runDiagnostics} disabled={diagRunning}>{diagRunning ? "Probando…" : "Diagnosticar conexión a las APIs"}</button>
              {diag && (
                <div className="mt-2.5">
                  {diag.map((d) => (
                    <div key={d.name} className="flex gap-2.5 text-xs py-1.5 items-start border-t" style={{ borderColor: "var(--line)" }}>
                      <span className="flex-shrink-0" style={{ color: d.ok ? "var(--pos)" : "var(--neg)", width: 14 }}>{d.ok ? "✓" : "✕"}</span>
                      <span className="min-w-0"><span className="block" style={{ color: "var(--ink)" }}>{d.name}</span><span className="block font-mono break-words" style={{ color: "var(--dim)" }}>{d.detail}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="cv-eyebrow mb-1.5">Cómo se leen los movimientos</div>
              <div className="text-[12px]" style={{ color: "var(--dim)" }}>BTC: se toma la dirección de destino de mayor valor como contraparte (puede haber más de una salida por transacción). ETH: origen/destino directo, incluye tokens ERC-20. TRON: por ahora solo movimientos TRC-20 (USDT/USDC).</div>
            </div>
          </div>
        </Sheet>
      )}

      {selectedAliado && (
        <Sheet title={selectedAliado.name} onClose={() => setSelectedAliadoId(null)} wide>
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="rounded-xl p-3.5" style={{ background: "var(--panel2)" }}>
              <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Le has pagado</div>
              <div className="font-mono text-[17px] font-bold truncate" style={{ color: "var(--neg)" }}>{fmtUSD(selectedAliadoTotals.outUsd)}</div>
              <div className="text-[11px] font-mono mt-1" style={{ color: "var(--dim)" }}>{assetsLine(selectedAliadoTotals.outAssets) || "—"}</div>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: "var(--panel2)" }}>
              <div className="text-[10.5px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>Te ha transferido</div>
              <div className="font-mono text-[17px] font-bold truncate" style={{ color: "var(--pos)" }}>{fmtUSD(selectedAliadoTotals.inUsd)}</div>
              <div className="text-[11px] font-mono mt-1" style={{ color: "var(--dim)" }}>{assetsLine(selectedAliadoTotals.inAssets) || "—"}</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="cv-eyebrow mb-1">Direcciones conocidas</div>
            <div className="text-[11.5px] mb-2" style={{ color: "var(--dim)" }}>Si este aliado opera desde varias wallets, añádelas todas: cualquier movimiento con ellas se etiqueta solo.</div>
            {selectedAliado.addresses.length === 0 ? (
              <div className="text-[12px] mb-2" style={{ color: "var(--faint)" }}>Aún no hay direcciones registradas.</div>
            ) : (
              selectedAliado.addresses.map((ad) => (
                <div key={ad.address} className="flex items-center justify-between gap-2 py-1 text-[12px] border-t" style={{ borderColor: "var(--line)" }}>
                  <span className="flex items-center gap-2 min-w-0"><ChainBadge chain={ad.chain} size={18} /><span className="font-addr truncate">{shortAddr(ad.address)}</span></span>
                  <button className="cv-x" onClick={() => removeAddressFromAliado(selectedAliado.id, ad.address)} title="Quitar dirección" aria-label="Quitar dirección">✕</button>
                </div>
              ))
            )}
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <select className="cv-select w-full sm:w-auto" value={detailChain} onChange={(e) => setDetailChain(e.target.value as Chain)} aria-label="Red">
                {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_LABEL[c]}</option>)}
              </select>
              <input className="cv-input w-full sm:flex-1 min-w-0" placeholder="Dirección" value={detailAddr} onChange={(e) => setDetailAddr(e.target.value)} />
              <button className="cv-btn-ghost cv-icon-btn justify-center flex-shrink-0" onClick={() => { addAddressToAliado(selectedAliado.id, detailChain, detailAddr); setDetailAddr(""); }}><Plus size={13} /> Añadir</button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="cv-eyebrow">Movimientos · {selectedAliadoMovements.length}</div>
            {selectedAliadoMovements.length > 0 && <button className="cv-btn-ghost cv-icon-btn" onClick={() => exportAliado(selectedAliado.name, selectedAliadoMovements)}><Download size={13} /> CSV</button>}
          </div>
          {selectedAliadoMovements.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--faint)" }}>Sin movimientos todavía.</div>
          ) : (
            selectedAliadoMovements.map((m) => (
              <div key={rowId(m)} className="py-2.5 border-t" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <span className="text-[11.5px] truncate" style={{ color: "var(--dim)" }}>{fmtDate(m.date)} · {m.walletLabel} · <a className="font-addr" style={{ color: "var(--accent)" }} href={m.explorer} target="_blank" rel="noreferrer">{shortAddr(m.counterparty)}</a></span>
                  <span className="font-mono text-[13px] font-semibold flex-shrink-0" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>{m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}{!m.verified && " ⚠"}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1.5">
                  <ConceptoInput className="cv-input w-full sm:flex-1 min-w-0 sm:py-1.5" placeholder="ej. compra insumos" value={effectiveConcepto(m)} onSave={(concepto) => saveClassification(m.key, { concepto })} />
                  <select className="cv-select w-full sm:w-[170px]" value={effectiveAliadoId(m) || ""} onChange={(e) => handleAliadoSelect(m, e.target.value)} aria-label="Aliado">{aliadoOptions}</select>
                </div>
              </div>
            ))
          )}

          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
            <button className="cv-btn-ghost cv-icon-btn" style={{ color: "var(--neg)" }} onClick={() => deleteAliado(selectedAliado.id)}><Trash2 size={13} /> Eliminar aliado</button>
          </div>
        </Sheet>
      )}

      {detailMovement && (
        <TransactionDetailModal movement={detailMovement} ctx={buildDetailCtx(detailMovement)} onClose={() => setDetailMovement(null)} />
      )}
    </>
  );
}
