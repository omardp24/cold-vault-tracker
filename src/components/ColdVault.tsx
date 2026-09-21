"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, LogOut, Moon, ShieldCheck, Send, Sun, Users, Wallet as WalletIcon } from "lucide-react";
import {
  Aliado, Chain, Classification, Holding, ManualHolding, Movement, Wallet,
  CHAIN_COLORS, CHAIN_LABEL, FIXED_STABLECOINS, SYMBOL_COINGECKO,
  fmtAmt, fmtDate, fmtUSD, useTheme,
} from "./coldvault/shared";
import AuditTab from "./coldvault/AuditTab";
import UsersTab from "./coldvault/UsersTab";
import GlobalSearch from "./coldvault/GlobalSearch";
import PushBell from "./coldvault/PushBell";
import AssistantPanel from "./coldvault/AssistantPanel";
import PortfolioView from "./coldvault/PortfolioView";
import { HistoryRange, PortfolioHistoryPoint } from "./coldvault/EvolutionChart";
import MovementsView from "./coldvault/MovementsView";
import TransferView, { XferLeg } from "./coldvault/TransferView";
import { buildStatementData } from "@/lib/statementAggregation";
import { assessSuspicion, buildKnownIndex } from "@/lib/suspicious";

export default function ColdVault() {
  const [tab, setTab] = useState<"portfolio" | "movements" | "audit" | "transfer" | "users">("portfolio");
  const [loaded, setLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: "owner" | "member" } | null>(null);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [manual, setManual] = useState<ManualHolding[]>([]);
  const [aliados, setAliados] = useState<Aliado[]>([]);
  const [classifications, setClassifications] = useState<Record<string, Classification>>({});

  const [chain, setChain] = useState<Chain>("BTC");
  const [addrInput, setAddrInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [manualCoinId, setManualCoinId] = useState("");
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualQty, setManualQty] = useState("");

  const [balances, setBalances] = useState<Record<string, { loading: boolean; error: string | null; detail: string | null }>>({});
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [total, setTotal] = useState(0);
  const [priceLookup, setPriceLookup] = useState<Record<string, number | null>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [incompleteWallets, setIncompleteWallets] = useState<string[]>([]);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [movLoading, setMovLoading] = useState(false);
  const [movErr, setMovErr] = useState("");
  const [cursors, setCursors] = useState<Record<string, string | null>>({}); // walletId -> nextCursor
  const [loadingMoreId, setLoadingMoreId] = useState<string | null>(null);
  const [newAliadoName, setNewAliadoName] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "in" | "out">("all");
  const [searchText, setSearchText] = useState("");
  const [minUsd, setMinUsd] = useState("1");
  const [hideUnpriced, setHideUnpriced] = useState(true);
  const [selectedAliadoId, setSelectedAliadoId] = useState<string | null>(null);
  const [detailChain, setDetailChain] = useState<Chain>("BTC");
  const [detailAddr, setDetailAddr] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [walletFilter, setWalletFilter] = useState<string>("all");

  const [diag, setDiag] = useState<{ name: string; ok: boolean; detail: string }[] | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  const [quickAudit, setQuickAudit] = useState<Record<string, { sanctioned: boolean; sanctionLists: string[]; blacklisted: boolean }>>({});
  const [showSuspicious, setShowSuspicious] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState<"all" | "pending" | "classified" | "internal" | "fee" | "suspicious">("all");

  // --- planificador de transferencias (multi-tramo, con monto objetivo y transferencia de prueba) ---
  const [xferTargetAmount, setXferTargetAmount] = useState("");
  const [xferTargetAsset, setXferTargetAsset] = useState("USDT");
  const [xferDest, setXferDest] = useState("");
  const [xferLegs, setXferLegs] = useState<XferLeg[]>([]);
  const [includeTest, setIncludeTest] = useState(true);
  const [testAmount, setTestAmount] = useState("1");

  const [balanceCache, setBalanceCache] = useState<Record<string, { symbol: string; amount: number }[]>>({});
  const [feeCache, setFeeCache] = useState<Record<string, any>>({});
  const [destAudit, setDestAudit] = useState<any>(null);
  const [destAuditRunning, setDestAuditRunning] = useState(false);
  const [planRunning, setPlanRunning] = useState(false);
  const [planError, setPlanError] = useState("");

  const ensureBalance = async (walletId: string) => {
    if (balanceCache[walletId]) return balanceCache[walletId];
    const w = wallets.find((x) => x.id === walletId);
    if (!w) return [];
    try {
      const res = await fetch(`/api/balance?chain=${w.chain}&address=${encodeURIComponent(w.address)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const list = [{ symbol: d.native.symbol, amount: d.native.amount }, ...d.tokens.map((t: any) => ({ symbol: t.symbol, amount: t.amount }))];
      setBalanceCache((c) => ({ ...c, [walletId]: list }));
      return list;
    } catch {
      return [];
    }
  };

  const ensureFee = async (chain: Chain, isToken: boolean) => {
    const key = `${chain}-${isToken}`;
    if (feeCache[key]) return feeCache[key];
    try {
      const res = await fetch(`/api/fees?chain=${chain}&isToken=${isToken}`);
      const d = await res.json();
      setFeeCache((c) => ({ ...c, [key]: res.ok ? d : { error: d.error } }));
      return d;
    } catch (e: any) {
      const err = { error: e.message };
      setFeeCache((c) => ({ ...c, [key]: err }));
      return err;
    }
  };

  const addLeg = () => setXferLegs((legs) => [...legs, { id: crypto.randomUUID(), walletId: "", asset: xferTargetAsset, amount: "", isTest: false }]);
  const removeLeg = (id: string) => setXferLegs((legs) => legs.filter((l) => l.id !== id));
  const updateLeg = (id: string, patch: Partial<XferLeg>) => setXferLegs((legs) => legs.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const onLegWalletChange = async (id: string, walletId: string) => {
    updateLeg(id, { walletId, asset: xferTargetAsset });
    await ensureBalance(walletId);
    const w = wallets.find((x) => x.id === walletId);
    if (w) ensureFee(w.chain, xferTargetAsset !== (w.chain === "BTC" ? "BTC" : w.chain === "ETH" ? "ETH" : "TRX"));
  };

  const buildPlan = async () => {
    setPlanRunning(true); setPlanError("");
    try {
      await Promise.all(xferLegs.filter((l) => l.walletId).map((l) => ensureBalance(l.walletId)));
      await Promise.all(
        xferLegs.filter((l) => l.walletId).map((l) => {
          const w = wallets.find((x) => x.id === l.walletId)!;
          const isNative = l.asset === (w.chain === "BTC" ? "BTC" : w.chain === "ETH" ? "ETH" : "TRX");
          return ensureFee(w.chain, !isNative);
        })
      );
      if (xferDest.trim()) {
        setDestAuditRunning(true);
        const firstWallet = wallets.find((x) => x.id === xferLegs[0]?.walletId);
        const chainForAudit = firstWallet?.chain || "TRON";
        const res = await fetch(`/api/audit?chain=${chainForAudit}&address=${encodeURIComponent(xferDest.trim())}`);
        const d = await res.json();
        setDestAudit(res.ok ? d : { error: d.error });
        setDestAuditRunning(false);
      }
    } catch (e: any) {
      setPlanError(e.message || "No se pudo completar el plan.");
    }
    setPlanRunning(false);
  };

  const testLeg: XferLeg | null =
    includeTest && xferLegs.length > 0 && xferLegs[0].walletId
      ? { id: "__test__", walletId: xferLegs[0].walletId, asset: xferLegs[0].asset, amount: testAmount, isTest: true }
      : null;
  const allLegs = testLeg ? [testLeg, ...xferLegs] : xferLegs;
  const totalPlanned = allLegs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0); // incluye la prueba: es dinero real que también llega al destino
  const targetNum = parseFloat(xferTargetAmount) || 0;
  const diff = totalPlanned - targetNum;

  // --- historial de planes guardados ---
  const [plans, setPlans] = useState<any[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);

  const savePlan = async () => {
    const legsPayload = allLegs.filter((l) => l.walletId).map((l) => {
      const w = wallets.find((x) => x.id === l.walletId)!;
      return { walletId: l.walletId, walletLabel: w.label, chain: w.chain, asset: l.asset, amount: parseFloat(l.amount) || 0, isTest: l.isTest };
    });
    if (legsPayload.length === 0 || !xferDest.trim()) return;
    setSavingPlan(true);
    try {
      const destLabel = findAliadoByAddress(xferDest.trim())?.name || "";
      const res = await fetch("/api/plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAmount: targetNum, targetAsset: xferTargetAsset, destination: xferDest.trim(), destLabel, legs: legsPayload }),
      });
      const plan = await res.json();
      if (res.ok) {
        setPlans((p) => [plan, ...p]);
        setXferLegs([]); setXferTargetAmount(""); setXferDest(""); setDestAudit(null);
      }
    } catch (e) { /* silencioso */ }
    setSavingPlan(false);
  };

  const updatePlanLeg = async (planId: string, legId: string, patch: { done?: boolean; txHash?: string; notes?: string }) => {
    setPlans((ps) => ps.map((p) => (p.id === planId ? { ...p, legs: p.legs.map((l: any) => (l.id === legId ? { ...l, ...patch, doneAt: patch.done !== undefined ? (patch.done ? Date.now() : null) : l.doneAt } : l)) } : p)));
    await fetch(`/api/plans/${planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legId, ...patch }) });
  };

  const uploadAttachment = async (planId: string, legId: string, file: File) => {
    const fd = new FormData(); fd.append("legId", legId); fd.append("file", file);
    try {
      const res = await fetch(`/api/plans/${planId}/upload`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) { alert(`No se pudo adjuntar el archivo: ${d.error || res.status}`); return; }
      setPlans((ps) => ps.map((p) => (p.id === planId ? d.plan : p)));
    } catch (e: any) {
      alert(`No se pudo adjuntar el archivo: ${e.message || "error de red"}`);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!window.confirm("¿Eliminar este plan del historial? Los comprobantes adjuntos también se perderán.")) return;
    await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    setPlans((ps) => ps.filter((p) => p.id !== planId));
  };

  const quickAuditFor = (m: Movement) => (m.counterparty ? quickAudit[`${m.chain}:${m.counterparty.toLowerCase()}`] : undefined);

  /* ---------- initial load ---------- */
  useEffect(() => {
    (async () => {
      const [w, m, a, c, p, meRes] = await Promise.all([
        fetch("/api/wallets").then((r) => r.json()),
        fetch("/api/manual").then((r) => r.json()),
        fetch("/api/aliados").then((r) => r.json()),
        fetch("/api/classifications").then((r) => r.json()),
        fetch("/api/plans").then((r) => r.json()),
        fetch("/api/auth/me").then((r) => r.json()),
      ]);
      setWallets(w); setManual(m); setAliados(a); setClassifications(c); setPlans(p);
      setCurrentUser(meRes.user);
      setLoaded(true);
    })();
  }, []);

  /* ---------- wallet/manual CRUD ---------- */
  const [addWalletError, setAddWalletError] = useState("");
  const addWallet = async () => {
    if (!addrInput.trim()) return;
    setAddWalletError("");
    const res = await fetch("/api/wallets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain, address: addrInput.trim(), label: labelInput.trim() || CHAIN_LABEL[chain] }),
    });
    const wallet = await res.json();
    if (!res.ok) { setAddWalletError(wallet.error || "No se pudo añadir la wallet."); return; }
    setWallets((w) => [...w, wallet]);
    setAddrInput(""); setLabelInput("");
  };
  const removeWallet = async (id: string) => {
    await fetch(`/api/wallets/${id}`, { method: "DELETE" });
    setWallets((w) => w.filter((x) => x.id !== id));
    setBalances((b) => { const c = { ...b }; delete c[id]; return c; });
    setMovements((m) => m.filter((x) => (x as any).walletId !== id));
  };
  const renameWallet = async (id: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const res = await fetch(`/api/wallets/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: clean }),
    });
    const updated = await res.json();
    if (!res.ok) { alert(updated.error || "No se pudo renombrar la wallet."); return; }
    setWallets((w) => w.map((x) => (x.id === id ? updated : x)));
  };
  const addManual = async () => {
    if (!manualCoinId.trim() || !manualQty || isNaN(parseFloat(manualQty))) return;
    const res = await fetch("/api/manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coinId: manualCoinId.trim(), symbol: manualSymbol.trim() || manualCoinId.trim(), qty: parseFloat(manualQty) }),
    });
    const holding = await res.json();
    setManual((m) => [...m, holding]);
    setManualCoinId(""); setManualSymbol(""); setManualQty("");
  };
  const removeManual = async (id: string) => {
    await fetch(`/api/manual/${id}`, { method: "DELETE" });
    setManual((m) => m.filter((x) => x.id !== id));
  };

  /* ---------- portfolio fetch (via our own API routes) ---------- */
  const fetchAll = useCallback(async () => {
    if (wallets.length === 0 && manual.length === 0) { setHoldings([]); setTotal(0); setLastUpdated(new Date()); return; }
    setRefreshing(true); setErrMsg("");
    const newBalances: typeof balances = {};
    const agg: Record<string, { symbol: string; amount: number; priceOverride?: number; coinId?: string }> = {};

    const fetchWalletBalance = async (w: Wallet) => {
      try {
        const res = await fetch(`/api/balance?chain=${w.chain}&address=${encodeURIComponent(w.address)}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
        let detail = `${fmtAmt(d.native.amount, 8)} ${d.native.symbol}`;
        agg[d.native.symbol] = agg[d.native.symbol] || { symbol: d.native.symbol, amount: 0 };
        agg[d.native.symbol].amount += d.native.amount;
        for (const t of d.tokens || []) {
          agg[t.symbol] = agg[t.symbol] || { symbol: t.symbol, amount: 0 };
          agg[t.symbol].amount += t.amount;
          if (t.priceUsd) agg[t.symbol].priceOverride = t.priceUsd;
          detail += ` · ${fmtAmt(t.amount, 2)} ${t.symbol}`;
        }
        newBalances[w.id] = { loading: false, error: null, detail };
      } catch (e: any) {
        newBalances[w.id] = { loading: false, error: `Error: ${e.message || "fallo desconocido"}`, detail: null };
      }
    };
    // Tron en serie, no en Promise.all: TronGrid sin API key se satura (429) si varias wallets
    // de la misma cuenta llegan juntas. BTC/ETH usan otras APIs, sin este límite, y siguen en paralelo.
    const tronWallets = wallets.filter((w) => w.chain === "TRON");
    const otherWallets = wallets.filter((w) => w.chain !== "TRON");
    await Promise.all(otherWallets.map(fetchWalletBalance));
    for (const w of tronWallets) await fetchWalletBalance(w);

    manual.forEach((m) => {
      agg[m.symbol] = agg[m.symbol] || { symbol: m.symbol, amount: 0, coinId: m.coinId };
      agg[m.symbol].amount += m.qty; agg[m.symbol].coinId = m.coinId;
    });

    const ids = new Set<string>();
    Object.keys(agg).forEach((sym) => { if (SYMBOL_COINGECKO[sym]) ids.add(SYMBOL_COINGECKO[sym]); });
    manual.forEach((m) => ids.add(m.coinId));

    let priceMap: Record<string, { usd: number }> = {};
    if (ids.size > 0) {
      try {
        const res = await fetch(`/api/prices?ids=${Array.from(ids).join(",")}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        priceMap = d;
      } catch (e) { setErrMsg("No se pudieron obtener precios de CoinGecko en este momento."); }
    }

    const priceFor = (a: typeof agg[string]) => {
      if (SYMBOL_COINGECKO[a.symbol] && priceMap[SYMBOL_COINGECKO[a.symbol]]) return priceMap[SYMBOL_COINGECKO[a.symbol]].usd;
      if (a.coinId && priceMap[a.coinId]) return priceMap[a.coinId].usd;
      if (FIXED_STABLECOINS.has(a.symbol.toUpperCase())) return 1;
      if (a.priceOverride) return a.priceOverride;
      return null;
    };

    const list: Holding[] = Object.values(agg).map((a) => {
      const price = priceFor(a);
      return { symbol: a.symbol, amount: a.amount, price, value: price !== null ? price * a.amount : null };
    });
    const sumTotal = list.reduce((s, a) => s + (a.value || 0), 0);
    list.sort((a, b) => (b.value || 0) - (a.value || 0));

    const newPriceLookup: Record<string, number | null> = {};
    list.forEach((a) => { newPriceLookup[a.symbol] = a.price; });

    // Si alguna wallet no se pudo leer, el total mostrado está INCOMPLETO. Hay que decirlo
    // explícitamente: un número parcial presentado como definitivo es peor que no mostrar nada.
    const failedWallets = wallets.filter((w) => newBalances[w.id]?.error).map((w) => w.label);
    setIncompleteWallets(failedWallets);

    setBalances(newBalances); setHoldings(list); setTotal(sumTotal); setLastUpdated(new Date()); setRefreshing(false);
    setPriceLookup(newPriceLookup);
  }, [wallets, manual]);

  useEffect(() => {
    if (!loaded) return;
    setBalances((b) => { const nb = { ...b }; wallets.forEach((w) => { if (!nb[w.id]) nb[w.id] = { loading: true, error: null, detail: null }; }); return nb; });
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, wallets.length, manual.length]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchAll]);

  /* ---------- movements (via our own API routes) ---------- */
  const loadMovements = useCallback(async () => {
    if (wallets.length === 0) { setMovements([]); return; }
    setMovLoading(true); setMovErr("");
    const newCursors: Record<string, string | null> = {};
    const failed: string[] = [];

    // Se usa allSettled a propósito: si una sola wallet falla (API caída, rate limit),
    // con Promise.all se perdían TODOS los movimientos, incluidos los de las wallets
    // que sí respondieron bien. Ahora carga lo que pueda y solo reporta las que fallaron.
    const results = await Promise.allSettled(wallets.map(async (w) => {
      const res = await fetch(`/api/history?chain=${w.chain}&address=${encodeURIComponent(w.address)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(`${w.label}: ${d.error || res.status}`);
      newCursors[w.id] = d.nextCursor;
      return (d.movements as Movement[]).map((m) => ({ ...m, walletLabel: w.label, walletId: w.id } as any));
    }));

    const ok: Movement[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") ok.push(...r.value);
      else failed.push(wallets[i].label);
    });

    const all = ok.sort((a, b) => (b.date || 0) - (a.date || 0));
    setMovements(all);
    setCursors(newCursors);
    runQuickAudit(all);
    if (failed.length > 0) {
      setMovErr(`No se pudo cargar el historial de: ${failed.join(", ")}. El resto se cargó correctamente — vuelve a intentar en unos segundos.`);
    }
    setMovLoading(false);
  }, [wallets]);

  const runQuickAudit = async (movs: Movement[]) => {
    const addresses = Array.from(
      new Map(movs.filter((m) => m.counterparty).map((m) => [`${m.chain}:${m.counterparty!.toLowerCase()}`, { chain: m.chain, address: m.counterparty! }])).values()
    );
    if (addresses.length === 0) return;
    try {
      const res = await fetch("/api/audit/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addresses }) });
      const d = await res.json();
      if (res.ok) setQuickAudit(d);
    } catch (e) { /* silencioso: la auditoría rápida es un plus, no debe romper la carga de movimientos */ }
  };

  const loadMoreForWallet = async (w: Wallet) => {
    const cursor = cursors[w.id];
    if (!cursor) return;
    setLoadingMoreId(w.id);
    try {
      const res = await fetch(`/api/history?chain=${w.chain}&address=${encodeURIComponent(w.address)}&cursor=${encodeURIComponent(cursor)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      const older = (d.movements as Movement[]).map((m) => ({ ...m, walletLabel: w.label, walletId: w.id } as any));
      const idOf = (m: any) => `${m.walletId}|${m.key}`;
      const existingIds = new Set(movements.map(idOf));
      const nuevos = older.filter((m: any) => !existingIds.has(idOf(m)));
      setMovements((prev) => {
        const ids = new Set(prev.map(idOf));
        return [...prev, ...nuevos.filter((m: any) => !ids.has(idOf(m)))].sort((a, b) => (b.date || 0) - (a.date || 0));
      });
      // Protección contra bucle: si la página no trajo nada nuevo o el cursor no avanzó,
      // damos el historial por terminado en vez de dejar el botón activo indefinidamente.
      const stalled = nuevos.length === 0 || d.nextCursor === cursor;
      setCursors((c) => ({ ...c, [w.id]: stalled ? null : d.nextCursor }));
      runQuickAudit(older);
    } catch (e: any) {
      setMovErr(`No se pudo cargar más historial de ${w.label}: ${e.message}`);
    }
    setLoadingMoreId(null);
  };

  useEffect(() => { if (tab === "movements" && loaded && wallets.length > 0 && movements.length === 0) loadMovements(); }, [tab, loaded]); // eslint-disable-line

  const findAliadoByAddress = (addr: string | null) => {
    if (!addr) return undefined;
    const a = addr.toLowerCase();
    return aliados.find((al) => al.addresses.some((x) => x.address.toLowerCase() === a));
  };
  const findOwnWallet = (chain: Chain, addr: string | null) => {
    if (!addr) return undefined;
    const a = addr.toLowerCase();
    return wallets.find((w) => w.chain === chain && w.address.toLowerCase() === a);
  };
  const effectiveAliadoId = (m: Movement) => classifications[m.key]?.aliadoId ?? findAliadoByAddress(m.counterparty)?.id ?? null;
  const effectiveConcepto = (m: Movement) => classifications[m.key]?.concepto ?? "";
  const effectiveIsFee = (m: Movement) => !!classifications[m.key]?.isFee;
  const isInternalTransfer = (m: Movement) => !!findOwnWallet(m.chain, m.counterparty);
  // El polvo y el posible fraude no cuentan como "pendientes por clasificar": no hay nada que clasificar, hay que ignorarlos o verificarlos.
  const isPending = (m: Movement) => !isInternalTransfer(m) && !effectiveIsFee(m) && !suspicionFor(m) && (!effectiveAliadoId(m) || !effectiveConcepto(m).trim());

  // Los guardados de una misma clave se encolan (así uno viejo nunca pisa a uno nuevo), se reintentan
  // si el servidor falla, y si al final no se logra guardar se avisa — antes el resultado se ignoraba
  // y el concepto parecía guardado en pantalla pero se perdía al recargar.
  const saveQueue = useRef<Record<string, Promise<boolean>>>({});
  const pendingSaves = useRef(0);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (pendingSaves.current > 0) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const saveClassification = async (key: string, patch: Partial<Classification>): Promise<boolean> => {
    setClassifications((c) => ({ ...c, [key]: { aliadoId: c[key]?.aliadoId ?? null, concepto: c[key]?.concepto ?? "", ...patch } }));
    const attemptSave = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch("/api/classifications", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, ...patch }),
          });
          if (res.ok) return true;
          if (res.status === 401) { setSaveError("Tu sesión expiró — vuelve a iniciar sesión para guardar."); return false; }
          if (res.status < 500 && res.status !== 429) break; // error del pedido: reintentar no ayuda
        } catch { /* sin red: se reintenta */ }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
      return false;
    };
    pendingSaves.current++;
    const prev = saveQueue.current[key] ?? Promise.resolve(true);
    const run = prev.then(attemptSave, attemptSave);
    saveQueue.current[key] = run;
    const ok = await run;
    pendingSaves.current--;
    if (ok) setSaveError((e) => (e.startsWith("Tu sesión") ? e : ""));
    else setSaveError((e) => e || "No se pudo guardar un cambio. Revisa tu conexión y reintenta (el campo queda marcado en rojo).");
    return ok;
  };

  const assignAliado = async (m: Movement, aliadoId: string | null, remember: boolean) => {
    await saveClassification(m.key, { aliadoId });
    if (remember && aliadoId && m.counterparty) {
      await fetch(`/api/aliados/${aliadoId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: m.chain, address: m.counterparty }),
      });
      setAliados((list) => list.map((a) => {
        if (a.id !== aliadoId) return a;
        if (a.addresses.some((x) => x.address.toLowerCase() === m.counterparty!.toLowerCase())) return a;
        return { ...a, addresses: [...a.addresses, { chain: m.chain, address: m.counterparty! }] };
      }));
    }
  };

  const handleAliadoSelect = async (m: Movement, value: string) => {
    if (value === "__new__") {
      const name = window.prompt("Nombre del nuevo aliado (¿a quién le pagaste?):");
      if (!name || !name.trim()) return;
      const res = await fetch("/api/aliados", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const aliado: Aliado = await res.json();
      setAliados((a) => (a.some((x) => x.id === aliado.id) ? a : [...a, aliado]));
      await assignAliado(m, aliado.id, true);
      return;
    }
    await assignAliado(m, value || null, true);
  };

  const addAliado = async () => {
    if (!newAliadoName.trim()) return;
    const res = await fetch("/api/aliados", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newAliadoName.trim() }),
    });
    const aliado = await res.json();
    setAliados((a) => (a.some((x) => x.id === aliado.id) ? a : [...a, aliado]));
    setNewAliadoName("");
  };

  const addAddressToAliado = async (aliadoId: string, chain: Chain, address: string) => {
    if (!address.trim()) return;
    const res = await fetch(`/api/aliados/${aliadoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain, address: address.trim(), action: "add" }),
    });
    const updated = await res.json();
    setAliados((list) => list.map((a) => (a.id === aliadoId ? updated : a)));
  };

  const removeAddressFromAliado = async (aliadoId: string, address: string) => {
    const res = await fetch(`/api/aliados/${aliadoId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, action: "remove" }),
    });
    const updated = await res.json();
    setAliados((list) => list.map((a) => (a.id === aliadoId ? updated : a)));
  };

  const deleteAliado = async (aliadoId: string) => {
    if (!window.confirm("¿Eliminar este aliado? Los movimientos ya clasificados con él volverán a quedar pendientes.")) return;
    await fetch(`/api/aliados/${aliadoId}`, { method: "DELETE" });
    setAliados((list) => list.filter((a) => a.id !== aliadoId));
    // refleja localmente la limpieza que el servidor hace de las clasificaciones huérfanas
    setClassifications((c) => {
      const next = { ...c };
      Object.keys(next).forEach((k) => { if (next[k].aliadoId === aliadoId) next[k] = { ...next[k], aliadoId: null }; });
      return next;
    });
    if (selectedAliadoId === aliadoId) setSelectedAliadoId(null);
  };

  const runDiagnostics = async () => {
    setDiagRunning(true);
    const res = await fetch("/api/diagnostics");
    setDiag(await res.json());
    setDiagRunning(false);
  };

  // Se prioriza el precio en vivo (priceLookup, que ya viene valorado a precio de mercado real —
  // ver FIXED_STABLECOINS en assets.ts). El $1 fijo es solo respaldo para stablecoins que ya no
  // están en balance actual y por eso no tienen entrada en priceLookup.
  const safePrice = (m: Movement) => {
    if (!m.verified) return null;
    if (priceLookup[m.asset] != null) return priceLookup[m.asset];
    if (FIXED_STABLECOINS.has(m.asset.toUpperCase())) return 1;
    return null;
  };

  // Detección de "address poisoning": direcciones distintas que comparten los mismos
  // primeros y últimos caracteres (patrón clásico para hacer que copies la dirección equivocada).
  const poisoningGroups = (() => {
    const byFingerprint: Record<string, Set<string>> = {};
    const allAddrs = new Set<string>();
    movements.forEach((m) => { if (m.counterparty) allAddrs.add(m.counterparty); });
    wallets.forEach((w) => allAddrs.add(w.address));
    aliados.forEach((a) => a.addresses.forEach((ad) => allAddrs.add(ad.address)));
    allAddrs.forEach((addr) => {
      if (addr.length < 12) return;
      const fp = `${addr.slice(0, 6).toLowerCase()}…${addr.slice(-4).toLowerCase()}`;
      byFingerprint[fp] = byFingerprint[fp] || new Set();
      byFingerprint[fp].add(addr);
    });
    const suspects = new Set<string>();
    Object.values(byFingerprint).forEach((set) => { if (set.size > 1) set.forEach((a) => suspects.add(a.toLowerCase())); });
    return suspects;
  })();
  const isPoisoningSuspect = (addr: string | null) => !!addr && poisoningGroups.has(addr.toLowerCase());

  // Polvo (dust) y posible fraude por envenenamiento de direcciones — reglas en lib/suspicious.ts.
  const suspicionIndexes = (() => {
    const contacts = [
      ...wallets.map((w) => ({ chain: w.chain as string, address: w.address })),
      ...aliados.flatMap((a) => a.addresses.map((x) => ({ chain: x.chain as string, address: x.address }))),
    ];
    const paid = movements.filter((m) => m.direction === "out" && m.counterparty).map((m) => ({ chain: m.chain as string, address: m.counterparty! }));
    return { contacts: buildKnownIndex(contacts), seen: buildKnownIndex([...contacts, ...paid]) };
  })();
  const suspicionFor = (m: Movement) => {
    // Lo que ya clasificaste con un aliado es decisión tuya: no se vuelve a marcar como sospechoso.
    if (classifications[m.key]?.aliadoId && m.direction === "in") return null;
    const px = safePrice(m);
    return assessSuspicion(
      { chain: m.chain, direction: m.direction, counterparty: m.counterparty, usd: px != null ? px * m.amount : null, verified: m.verified },
      suspicionIndexes.contacts, suspicionIndexes.seen,
    );
  };

  const passesDustFilter = (m: Movement) => {
    const px = safePrice(m);
    if (px === undefined || px === null) return !hideUnpriced;
    const usd = px * m.amount;
    const threshold = parseFloat(minUsd) || 0;
    return usd >= threshold;
  };
  const passesDateFilter = (m: Movement) => {
    if (!m.date) return true;
    if (dateFrom && m.date < new Date(dateFrom).getTime()) return false;
    if (dateTo && m.date > new Date(dateTo).getTime() + 86400000 - 1) return false;
    return true;
  };
  const passesWalletFilter = (m: any) => walletFilter === "all" || m.walletId === walletFilter;
  const passesEstadoFilter = (m: Movement) => {
    if (estadoFilter === "all") return true;
    if (estadoFilter === "suspicious") return !isInternalTransfer(m) && !!suspicionFor(m);
    if (isInternalTransfer(m)) return estadoFilter === "internal";
    if (effectiveIsFee(m)) return estadoFilter === "fee";
    return estadoFilter === "pending" ? isPending(m) : estadoFilter === "classified" ? !isPending(m) : false;
  };
  const baseVisibleMovements = movements.filter((m) => passesDustFilter(m) && passesDateFilter(m) && passesWalletFilter(m));
  // El polvo y el posible fraude ENTRANTES no se mezclan con tus movimientos (embasuran la lista y los totales)
  // salvo que los pidas: "verlas por separado" (filtro Polvo / fraude) o "incluirlas". Los envíos TUYOS hacia
  // una dirección parecida a un contacto nunca se ocultan: son lo más grave y hay que verlos siempre.
  const isHiddenSuspect = (m: Movement) => m.direction === "in" && !isInternalTransfer(m) && !!suspicionFor(m);
  const suspiciousCount = baseVisibleMovements.filter(isHiddenSuspect).length;
  const visibleMovements = baseVisibleMovements.filter((m) => showSuspicious || estadoFilter === "suspicious" || !isHiddenSuspect(m));
  const dustHiddenCount = movements.filter((m) => passesDateFilter(m) && passesWalletFilter(m)).length - baseVisibleMovements.length;

  // El flujo real excluye transferencias internas (mover dinero entre tus propias wallets
  // no es entrada ni salida de la tesorería) y separa las comisiones de red.
  const flowSummary = visibleMovements.reduce(
    (acc, m) => {
      if (isInternalTransfer(m)) return acc;
      const px = safePrice(m);
      const usd = px ? px * m.amount : 0;
      if (effectiveIsFee(m)) { acc.feeUsd += usd; return acc; }
      if (m.direction === "out") acc.outUsd += usd; else acc.inUsd += usd;
      return acc;
    },
    { inUsd: 0, outUsd: 0, feeUsd: 0 }
  );

  const csvEscape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  const movementsToCsv = (rows: Movement[]) => {
    const header = ["Fecha", "Wallet", "Red", "Tipo", "Activo", "Monto", "Contraparte", "Aliado", "Concepto", "Link"];
    const lines = rows.map((m) => [
      m.date ? new Date(m.date).toISOString().slice(0, 10) : "pendiente",
      (m as any).walletLabel || "",
      m.chain,
      m.direction === "out" ? "Salida" : "Entrada",
      m.asset,
      m.amount.toString(),
      m.counterparty || "",
      isInternalTransfer(m) ? "Transferencia interna" : effectiveIsFee(m) ? "Comisión de red" : nameFor(effectiveAliadoId(m) || "sin_clasificar"),
      effectiveConcepto(m),
      m.explorer,
    ].map((v) => csvEscape(String(v))).join(";"));
    return "\uFEFF" + [header.map(csvEscape).join(";"), ...lines].join("\r\n");
  };
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const exportFiltered = () => downloadCsv(`movimientos_${new Date().toISOString().slice(0, 10)}.csv`, movementsToCsv(filteredMovements));
  const exportAliado = (name: string, rows: Movement[]) =>
    downloadCsv(`movimientos_${name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`, movementsToCsv(rows));

  const [statementGenerating, setStatementGenerating] = useState<"pdf" | "excel" | null>(null);
  // buildStatementData (statementAggregation.ts) es la misma función que usa el reporte mensual
  // automático server-side — se reusa acá para que el export manual y el correo mensual nunca
  // diverjan en cómo arman el estado de cuenta (antes esto era lógica duplicada e independiente).
  const buildStatementInput = () => buildStatementData({
    wallets, aliados, classifications, movements: filteredMovements, priceLookup,
    holdings, total, incompleteWallets,
    generatedBy: currentUser?.name || "—",
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const generateStatement = async (format: "pdf" | "excel") => {
    setStatementGenerating(format);
    try {
      const res = await fetch(`/api/statement/${format}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStatementInput()),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Error ${res.status}`); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `estado_cuenta_${new Date().toISOString().slice(0, 10)}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`No se pudo generar el ${format === "pdf" ? "PDF" : "Excel"}: ${e.message}`);
    }
    setStatementGenerating(null);
  };


  const filteredMovements = visibleMovements.filter((m) => {
    if (dirFilter !== "all" && m.direction !== dirFilter) return false;
    if (!passesEstadoFilter(m)) return false;
    if (!searchText.trim()) return true;
    const s = searchText.toLowerCase();
    const al = aliados.find((a) => a.id === effectiveAliadoId(m));
    return (
      (m.counterparty || "").toLowerCase().includes(s) ||
      effectiveConcepto(m).toLowerCase().includes(s) ||
      (al?.name || "").toLowerCase().includes(s) ||
      m.asset.toLowerCase().includes(s)
    );
  });
  const pendingCount = visibleMovements.filter(isPending).length;

  // --- clasificación en lote por contraparte ---
  const [showGroupClassifier, setShowGroupClassifier] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const activeFilterCount =
    (dirFilter !== "all" ? 1 : 0) + (estadoFilter !== "all" ? 1 : 0) + (walletFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  // Bloquea el scroll del fondo mientras una hoja móvil está abierta
  useEffect(() => {
    const open = showFilterSheet || showExportSheet;
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showFilterSheet, showExportSheet]);
  const [feeThreshold, setFeeThreshold] = useState("2");
  const [markingFees, setMarkingFees] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupExpand = (key: string) =>
    setExpandedGroups((s) => { const next = new Set(s); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const [groupBatchState, setGroupBatchState] = useState<Record<string, { aliadoId: string; concepto: string; applying: boolean }>>({});

  const [groupViewMode, setGroupViewMode] = useState<"pending" | "all">("pending");

  const pendingGroups = (() => {
    const map = new Map<string, { key: string; chain: Chain; address: string; movements: Movement[]; totals: Record<string, number>; totalsIn: Record<string, number> }>();
    const source = groupViewMode === "pending"
      ? visibleMovements.filter((m) => isPending(m) && m.counterparty)
      : visibleMovements.filter((m) => !isInternalTransfer(m) && m.counterparty);
    source.forEach((m) => {
      const groupKey = `${m.chain}:${m.counterparty!.toLowerCase()}`;
      if (!map.has(groupKey)) map.set(groupKey, { key: groupKey, chain: m.chain, address: m.counterparty!, movements: [], totals: {}, totalsIn: {} });
      const g = map.get(groupKey)!;
      g.movements.push(m);
      const bucket = m.direction === "out" ? g.totals : g.totalsIn;
      bucket[m.asset] = (bucket[m.asset] || 0) + m.amount;
    });
    return Array.from(map.values()).sort((a, b) => b.movements.length - a.movements.length);
  })();
  const groupWalletCount = (g: (typeof pendingGroups)[number]) => new Set(g.movements.map((m) => m.walletLabel)).size;
  const groupWalletLabels = (g: (typeof pendingGroups)[number]) => Array.from(new Set(g.movements.map((m) => m.walletLabel)));
  // en modo "todas", indica si el grupo ya tiene un aliado asignado (y si es consistente en todas sus transacciones)
  const groupExistingAliado = (g: (typeof pendingGroups)[number]) => {
    const ids = new Set(g.movements.filter((m) => !effectiveIsFee(m)).map((m) => effectiveAliadoId(m) || "none"));
    if (ids.size === 0) return { status: "none" as const };
    if (ids.size > 1) return { status: "mixed" as const };
    const id = Array.from(ids)[0];
    if (id === "none") return { status: "none" as const };
    return { status: "single" as const, name: nameFor(id) };
  };

  const DEFAULT_GROUP_STATE = { aliadoId: "", concepto: "", applying: false };
  const setGroupField = (key: string, patch: Partial<{ aliadoId: string; concepto: string; applying: boolean }>) =>
    setGroupBatchState((s) => ({ ...s, [key]: { ...DEFAULT_GROUP_STATE, ...s[key], ...patch } }));

  const applyGroupClassification = async (group: (typeof pendingGroups)[number]) => {
    const state = groupBatchState[group.key] || { aliadoId: "", concepto: "" };
    let aliadoId = state.aliadoId;
    if (aliadoId === "__new__") {
      const name = window.prompt("Nombre del nuevo aliado (¿a quién le pagaste?):");
      if (!name || !name.trim()) return;
      const res = await fetch("/api/aliados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
      const aliado: Aliado = await res.json();
      setAliados((a) => (a.some((x) => x.id === aliado.id) ? a : [...a, aliado]));
      aliadoId = aliado.id;
    }
    if (!aliadoId && !state.concepto?.trim()) return;
    setGroupField(group.key, { applying: true });
    const keys = group.movements.map((m) => m.key);
    await fetch("/api/classifications/batch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, aliadoId: aliadoId || null, concepto: state.concepto || "" }),
    });
    if (aliadoId) {
      await fetch(`/api/aliados/${aliadoId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain: group.chain, address: group.address, action: "add" }),
      });
      setAliados((list) => list.map((a) => {
        if (a.id !== aliadoId) return a;
        if (a.addresses.some((x) => x.address.toLowerCase() === group.address.toLowerCase())) return a;
        return { ...a, addresses: [...a.addresses, { chain: group.chain, address: group.address }] };
      }));
    }
    setClassifications((c) => {
      const next = { ...c };
      keys.forEach((k) => { next[k] = { aliadoId: aliadoId || null, concepto: state.concepto || "" }; });
      return next;
    });
    setGroupField(group.key, { applying: false });
  };

  const assetUsdPrice = (asset: string): number | null => {
    if (priceLookup[asset] != null) return priceLookup[asset];
    if (FIXED_STABLECOINS.has(asset.toUpperCase())) return 1;
    return null;
  };
  const groupUsdApprox = (g: (typeof pendingGroups)[number]) =>
    Object.entries(g.totals).reduce((s, [asset, amt]) => { const p = assetUsdPrice(asset); return s + (p ? p * amt : 0); }, 0);

  const markSmallGroupsAsFee = async () => {
    const threshold = parseFloat(feeThreshold) || 0;
    if (threshold <= 0) return;
    const targets = pendingGroups.filter((g) => { const usd = groupUsdApprox(g); return usd > 0 && usd < threshold; });
    if (targets.length === 0) return;
    setMarkingFees(true);
    const keys = targets.flatMap((g) => g.movements.map((m) => m.key));
    await fetch("/api/classifications/batch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys, isFee: true }),
    });
    setClassifications((c) => {
      const next = { ...c };
      keys.forEach((k) => { next[k] = { aliadoId: next[k]?.aliadoId ?? null, concepto: next[k]?.concepto ?? "", isFee: true }; });
      return next;
    });
    setMarkingFees(false);
  };


  const walletSummary = wallets.map((w) => {
    const movs = visibleMovements.filter((m: any) => m.walletId === w.id);
    const outUsd = movs.filter((m) => m.direction === "out").reduce((s, m) => s + (safePrice(m) ? safePrice(m)! * m.amount : 0), 0);
    const inUsd = movs.filter((m) => m.direction === "in").reduce((s, m) => s + (safePrice(m) ? safePrice(m)! * m.amount : 0), 0);
    const pending = movs.filter(isPending).length;
    const lastDate = movs.reduce((max: number | null, m) => (m.date && (!max || m.date > max) ? m.date : max), null as number | null);
    return { wallet: w, count: movs.length, outUsd, inUsd, pending, lastDate };
  });

  const aliadoSummary: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};
  const aliadoSummaryIn: Record<string, { id: string; assets: Record<string, number>; count: number; usdApprox: number }> = {};
  let internalTotal = { count: 0, assets: {} as Record<string, number> };
  let feeTotal = { count: 0, assets: {} as Record<string, number>, usdApprox: 0 };
  visibleMovements.forEach((m) => {
    if (isInternalTransfer(m)) {
      if (m.direction === "out") {
        internalTotal.count += 1;
        internalTotal.assets[m.asset] = (internalTotal.assets[m.asset] || 0) + m.amount;
      }
      return;
    }
    if (effectiveIsFee(m)) {
      feeTotal.count += 1;
      feeTotal.assets[m.asset] = (feeTotal.assets[m.asset] || 0) + m.amount;
      const px = safePrice(m);
      if (px) feeTotal.usdApprox += px * m.amount;
      return;
    }
    const bucket = m.direction === "out" ? aliadoSummary : aliadoSummaryIn;
    const id = effectiveAliadoId(m) || "sin_clasificar";
    bucket[id] = bucket[id] || { id, assets: {}, count: 0, usdApprox: 0 };
    bucket[id].assets[m.asset] = (bucket[id].assets[m.asset] || 0) + m.amount;
    bucket[id].count += 1;
    const px = safePrice(m);
    if (px) bucket[id].usdApprox += px * m.amount;
  });
  const summaryRows = Object.values(aliadoSummary).sort((a, b) => b.usdApprox - a.usdApprox);
  const summaryRowsIn = Object.values(aliadoSummaryIn).sort((a, b) => b.usdApprox - a.usdApprox);
  const nameFor = (id: string) => (id === "sin_clasificar" ? "Sin clasificar" : aliados.find((a) => a.id === id)?.name || "—");

  const selectedAliado = aliados.find((a) => a.id === selectedAliadoId) || null;
  const selectedAliadoMovements = selectedAliado
    ? visibleMovements.filter((m) => !isInternalTransfer(m) && effectiveAliadoId(m) === selectedAliado.id)
    : [];
  const selectedAliadoTotals = { outAssets: {} as Record<string, number>, outUsd: 0, inAssets: {} as Record<string, number>, inUsd: 0 };
  selectedAliadoMovements.forEach((m) => {
    const px = safePrice(m);
    if (m.direction === "out") {
      selectedAliadoTotals.outAssets[m.asset] = (selectedAliadoTotals.outAssets[m.asset] || 0) + m.amount;
      if (px) selectedAliadoTotals.outUsd += px * m.amount;
    } else {
      selectedAliadoTotals.inAssets[m.asset] = (selectedAliadoTotals.inAssets[m.asset] || 0) + m.amount;
      if (px) selectedAliadoTotals.inUsd += px * m.amount;
    }
  });

  const pricedHoldings = holdings.filter((h) => h.value !== null && h.value > 0);
  const pieData = pricedHoldings.map((h) => ({ name: h.symbol, value: h.value as number }));

  // --- ticker de mercado (top 20) + comisiones de red en vivo ---
  const [gasLoading, setGasLoading] = useState(false);
  const [gasNow, setGasNow] = useState<{ btc: any; eth: any; tron: any }>({ btc: null, eth: null, tron: null });

  const loadGasFees = useCallback(async () => {
    setGasLoading(true);
    try {
      const [btcRes, ethRes, tronRes] = await Promise.all([
        fetch("/api/fees?chain=BTC"),
        fetch("/api/fees?chain=ETH&isToken=false"),
        fetch("/api/fees?chain=TRON&isToken=false"),
      ]);
      const [btc, eth, tron] = await Promise.all([btcRes.json(), ethRes.json(), tronRes.json()]);
      setGasNow({ btc: btcRes.ok ? btc : null, eth: ethRes.ok ? eth : null, tron: tronRes.ok ? tron : null });
    } catch { /* la tarjeta de comisiones simplemente muestra "—" */ }
    setGasLoading(false);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    loadGasFees();
    const id = setInterval(loadGasFees, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const [history, setHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("90d");

  const loadHistory = useCallback(async (range: HistoryRange) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/portfolio/history?range=${range}`);
      const d = await res.json();
      if (res.ok) setHistory(d);
    } catch { /* silencioso: el gráfico solo se queda vacío */ }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    loadHistory(historyRange);
  }, [loaded, historyRange, loadHistory]);

  const [vesRates, setVesRates] = useState<{ bcv: number | null; paralelo: number | null }>({ bcv: null, paralelo: null });
  useEffect(() => {
    if (!loaded) return;
    fetch("/api/ves-rate").then((r) => r.json()).then(setVesRates).catch(() => {});
  }, [loaded]);

  // Ancho real disponible para los paneles laterales — más confiable que un breakpoint fijo,
  // que puede fallar si la ventana no es tan ancha como parece en una captura de pantalla retina.
  const colorForSymbol: Record<string, string> = {};
  pricedHoldings.forEach((h, i) => { colorForSymbol[h.symbol] = CHAIN_COLORS[i % CHAIN_COLORS.length]; });

  const { theme, toggleTheme } = useTheme();

  type TabId = "portfolio" | "movements" | "audit" | "transfer" | "users";
  const NAV_ITEMS: { id: TabId; label: string; Icon: any; badge?: number }[] = [
    { id: "portfolio", label: "Portafolio", Icon: WalletIcon },
    { id: "movements", label: "Movimientos", Icon: ArrowLeftRight, badge: pendingCount || undefined },
    { id: "audit", label: "Auditoría", Icon: ShieldCheck },
    { id: "transfer", label: "Transferir", Icon: Send },
    ...(currentUser?.role === "owner" ? [{ id: "users" as const, label: "Usuarios", Icon: Users }] : []),
  ];
  const SidebarNavBtn = ({ id, label, Icon, badge }: { id: TabId; label: string; Icon: any; badge?: number }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        className="cv-nav-item flex items-center gap-2.5 w-full text-left rounded-2xl px-3.5 py-2.5 text-[13.5px]"
        style={{ background: active ? "var(--tint)" : "transparent", color: active ? "var(--accent)" : "var(--dim)", fontWeight: active ? 600 : 500, border: "none", cursor: "pointer" }}
      >
        <Icon size={18} strokeWidth={2} />
        <span className="flex-1">{label}</span>
        {!!badge && (
          <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: "var(--accent)", color: "#fff" }}>{badge}</span>
        )}
      </button>
    );
  };
  const ThemeToggleBtn = ({ size = 34 }: { size?: number }) => (
    <button
      onClick={toggleTheme}
      className="cv-icon-btn justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)" }}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );

  return (
    <>
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Sidebar — solo escritorio */}
      <aside
        className="cv-sidebar hidden md:flex flex-col gap-1.5 flex-shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ width: 232, padding: "22px 16px" }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))", boxShadow: "var(--glow)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
              <circle cx="12" cy="11" r="2.2" />
              <path d="M12 13.2V15.6" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-[15.5px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>Cold Vault</div>
            <div className="text-[11px]" style={{ color: "var(--faint)" }}>Portafolio en vivo</div>
          </div>
        </div>

        {NAV_ITEMS.map((item) => <SidebarNavBtn key={item.id} {...item} />)}

        <div className="mt-auto rounded-2xl p-3.5 text-[11px]" style={{ background: "var(--panel2)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: (gasNow.btc?.stale || gasNow.eth?.stale || gasNow.tron?.stale) ? "var(--amber)" : "var(--pos)" }} />
            <span className="uppercase tracking-wide font-semibold text-[10px]" style={{ color: "var(--dim)" }}>Red ahora</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>BTC{gasNow.btc?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.btc?.levels ? `${gasNow.btc.levels[1]?.detail?.split(" ")[0] || "—"} sat/vB` : "—"}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>ETH{gasNow.eth?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.eth?.levels ? `${gasNow.eth.levels[0]?.detail?.split(" ")[0] || "—"} gwei` : "—"}</span>
            </div>
            <div className="flex items-center justify-between" style={{ color: "var(--dim)" }}>
              <span>TRON{gasNow.tron?.stale && <span title="Desactualizado — la API está caída" style={{ color: "var(--amber)" }}> ⚠</span>}</span>
              <span className="font-mono" style={{ color: "var(--ink)" }}>{gasNow.tron?.levels ? `${fmtAmt(gasNow.tron.levels[1]?.fee, 2)} TRX` : "—"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex-1 min-w-0">
        {/* Top bar — escritorio */}
        <div
          className="hidden md:flex items-center gap-3 px-6 py-3.5 border-b cv-safe-top sticky top-0 z-10"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <GlobalSearch
            wallets={wallets} aliados={aliados} movements={movements}
            onSelectWallet={() => setTab("portfolio")}
            onSelectAliado={(a) => { setTab("movements"); setSelectedAliadoId(a.id); }}
            onSelectMovement={(m) => { setTab("movements"); setSearchText(m.counterparty || m.txid); }}
          />
          <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            <PushBell />
            <ThemeToggleBtn />
            <button className="cv-btn" onClick={fetchAll} disabled={refreshing}>
              {refreshing ? "Actualizando…" : "Actualizar"}
            </button>
            {currentUser && (
              <div className="flex items-center gap-2.5 pl-2.5 pr-3.5 py-1.5 rounded-full" style={{ background: "var(--panel2)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}>
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>{currentUser.name}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>{currentUser.role === "owner" ? "propietario" : "miembro"}</div>
                </div>
              </div>
            )}
            <button className="cv-x" onClick={logout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {/* Top bar — móvil */}
        <div
          className="md:hidden flex items-center gap-2.5 px-4 py-3 border-b cv-safe-top"
          style={{ borderColor: "var(--line)", background: "var(--panel)" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
            </svg>
          </div>
          <div className="font-bold text-[14.5px]" style={{ color: "var(--ink)" }}>Cold Vault</div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <PushBell size={30} />
            <ThemeToggleBtn size={30} />
            <button className="cv-x" onClick={logout} title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <div className="px-3 py-4 sm:px-6 sm:py-6" style={{ color: "var(--ink)" }}>
        {saveError && (
          <div className="mb-3 rounded-lg px-3.5 py-2.5 text-[12.5px] flex items-start justify-between gap-3" style={{ background: "rgba(178,58,58,.14)", color: "var(--neg)", border: "1px solid var(--neg)" }}>
            <span>{saveError}</span>
            <button className="cv-x flex-shrink-0" onClick={() => setSaveError("")}>✕</button>
          </div>
        )}
        {tab === "portfolio" && (
          <PortfolioView
            total={total} wallets={wallets} fetchAll={fetchAll} refreshing={refreshing}
            autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} lastUpdated={lastUpdated}
            incompleteWallets={incompleteWallets} errMsg={errMsg}
            chain={chain} setChain={setChain} labelInput={labelInput} setLabelInput={setLabelInput}
            addrInput={addrInput} setAddrInput={setAddrInput} addWallet={addWallet} addWalletError={addWalletError}
            balances={balances} removeWallet={removeWallet} renameWallet={renameWallet}
            manual={manual} manualCoinId={manualCoinId} setManualCoinId={setManualCoinId}
            manualSymbol={manualSymbol} setManualSymbol={setManualSymbol} manualQty={manualQty} setManualQty={setManualQty}
            addManual={addManual} removeManual={removeManual}
            pieData={pieData} holdings={holdings} colorForSymbol={colorForSymbol}
            loadGasFees={loadGasFees} gasLoading={gasLoading} gasNow={gasNow}
            history={history} historyLoading={historyLoading} historyRange={historyRange} setHistoryRange={setHistoryRange}
            vesRates={vesRates}
          />
        )}


        {tab === "movements" && (
          <MovementsView
            wallets={wallets} movements={movements} aliados={aliados}
            movLoading={movLoading} movErr={movErr} loadMovements={loadMovements}
            cursors={cursors} loadingMoreId={loadingMoreId} loadMoreForWallet={loadMoreForWallet}
            isPoisoningSuspect={isPoisoningSuspect} suspicionFor={suspicionFor} quickAuditFor={quickAuditFor}
            runDiagnostics={runDiagnostics} diagRunning={diagRunning} diag={diag}
            walletSummary={walletSummary} walletFilter={walletFilter} setWalletFilter={setWalletFilter}
            newAliadoName={newAliadoName} setNewAliadoName={setNewAliadoName} addAliado={addAliado}
            selectedAliadoId={selectedAliadoId} setSelectedAliadoId={setSelectedAliadoId} selectedAliado={selectedAliado}
            deleteAliado={deleteAliado} selectedAliadoTotals={selectedAliadoTotals}
            detailChain={detailChain} setDetailChain={setDetailChain} detailAddr={detailAddr} setDetailAddr={setDetailAddr}
            addAddressToAliado={addAddressToAliado} removeAddressFromAliado={removeAddressFromAliado}
            selectedAliadoMovements={selectedAliadoMovements} exportAliado={exportAliado} effectiveConcepto={effectiveConcepto}
            summaryRows={summaryRows} summaryRowsIn={summaryRowsIn} nameFor={nameFor}
            internalTotal={internalTotal} feeTotal={feeTotal}
            searchText={searchText} setSearchText={setSearchText} activeFilterCount={activeFilterCount}
            showFilterSheet={showFilterSheet} setShowFilterSheet={setShowFilterSheet}
            showExportSheet={showExportSheet} setShowExportSheet={setShowExportSheet}
            dirFilter={dirFilter} setDirFilter={setDirFilter} estadoFilter={estadoFilter} setEstadoFilter={setEstadoFilter}
            dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
            minUsd={minUsd} setMinUsd={setMinUsd} hideUnpriced={hideUnpriced} setHideUnpriced={setHideUnpriced}
            dustHiddenCount={dustHiddenCount} suspiciousCount={suspiciousCount} showSuspicious={showSuspicious} setShowSuspicious={setShowSuspicious}
            exportFiltered={exportFiltered} generateStatement={generateStatement} statementGenerating={statementGenerating}
            flowSummary={flowSummary} visibleMovements={visibleMovements} filteredMovements={filteredMovements} pendingCount={pendingCount}
            showGroupClassifier={showGroupClassifier} setShowGroupClassifier={setShowGroupClassifier}
            groupViewMode={groupViewMode} setGroupViewMode={setGroupViewMode}
            feeThreshold={feeThreshold} setFeeThreshold={setFeeThreshold}
            markSmallGroupsAsFee={markSmallGroupsAsFee} markingFees={markingFees}
            pendingGroups={pendingGroups} groupExistingAliado={groupExistingAliado} groupBatchState={groupBatchState}
            toggleGroupExpand={toggleGroupExpand} expandedGroups={expandedGroups}
            groupWalletCount={groupWalletCount} groupWalletLabels={groupWalletLabels}
            setGroupField={setGroupField} applyGroupClassification={applyGroupClassification}
            effectiveAliadoId={effectiveAliadoId} effectiveIsFee={effectiveIsFee} isInternalTransfer={isInternalTransfer}
            isPending={isPending} findOwnWallet={findOwnWallet} saveClassification={saveClassification}
            handleAliadoSelect={handleAliadoSelect}
          />
        )}


        {tab === "audit" && <AuditTab />}

        {tab === "transfer" && (
          <TransferView
            wallets={wallets}
            xferTargetAmount={xferTargetAmount} setXferTargetAmount={setXferTargetAmount}
            xferTargetAsset={xferTargetAsset} setXferTargetAsset={setXferTargetAsset}
            xferDest={xferDest} setXferDest={setXferDest} xferLegs={xferLegs}
            includeTest={includeTest} setIncludeTest={setIncludeTest} testAmount={testAmount} setTestAmount={setTestAmount}
            balanceCache={balanceCache} feeCache={feeCache} onLegWalletChange={onLegWalletChange}
            updateLeg={updateLeg} removeLeg={removeLeg} addLeg={addLeg}
            totalPlanned={totalPlanned} targetNum={targetNum} diff={diff}
            buildPlan={buildPlan} planRunning={planRunning} planError={planError}
            destAudit={destAudit} destAuditRunning={destAuditRunning}
            allLegs={allLegs} savePlan={savePlan} savingPlan={savingPlan}
            plans={plans} updatePlanLeg={updatePlanLeg} uploadAttachment={uploadAttachment} deletePlan={deletePlan}
          />
        )}

        {tab === "users" && currentUser?.role === "owner" && <UsersTab currentUser={currentUser} />}

        <div className="text-[11px] mt-4 text-center cv-safe-bottom md:pb-6" style={{ color: "var(--faint)" }}>
          Solo direcciones públicas — esta app nunca pide ni almacena claves privadas o tu frase semilla.
        </div>
        </div>
      </div>
    </div>

    <AssistantPanel />

    {/* Barra de navegación inferior — solo móvil */}
    <nav className="cv-tabbar md:hidden">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className="cv-tabbar-item"
          data-active={tab === id}
          onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        >
          <Icon size={19} strokeWidth={tab === id ? 2.4 : 1.9} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
    </>
  );
}
