# Components — Cold Vault Tracker
Framework: Next.js 14.2 (App Router) + React 18 + TypeScript. No component library: custom components, styled with Tailwind utility classes + inline `style={{ var(--token) }}` + global `.cv-*` classes (see theme.md). Icons: lucide-react. Charts: recharts.

Shared primitives live in `src/components/coldvault/shared.tsx` (AssetIcon, ChainBadge, ValueCounter, PromptModal, ConfirmModal, useTheme, types, formatters) and as CSS classes (`.cv-btn`, `.cv-btn-ghost`, `.cv-input`, `.cv-select`, `.cv-card`, `.cv-eyebrow`, `.cv-delta`, `.cv-skeleton`, `.cv-x`, `.cv-icon-btn`, `.cv-sheet`).

### `src/components/coldvault/shared.tsx`

```tsx
import { useEffect, useRef, useState } from "react";
import { FIXED_STABLECOINS, SYMBOL_COINGECKO, SYMBOL_LOGO } from "@/lib/assets";
import { fmtAmt, fmtDate, fmtDateTime, fmtUSD, shortAddr } from "@/lib/format";
export { FIXED_STABLECOINS, SYMBOL_COINGECKO, fmtAmt, fmtDate, fmtDateTime, fmtUSD, shortAddr };

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

```

### `src/components/coldvault/EvolutionChart.tsx`

```tsx
"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fmtUSD } from "./shared";

export type HistoryRange = "7d" | "90d" | "1y";
export interface PortfolioHistoryPoint { date: string; value: number; }

export default function EvolutionChart({ history, loading }: { history: PortfolioHistoryPoint[]; loading: boolean }) {
  if (loading) {
    return <div className="h-[220px] flex items-end gap-1.5 pb-6 px-2">{[40,55,48,62,58,70,66,78,72,85].map((h, i) => <span key={i} className="cv-skeleton flex-1" style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }} />)}</div>;
  }
  // Con un solo punto (o ninguno) no hay línea que trazar todavía — el cron recién
  // empieza a guardar snapshots desde que se despliega, no hay forma de reconstruir
  // el valor histórico de antes de eso.
  if (history.length < 2) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-center px-4" style={{ color: "var(--faint)" }}>
        <div className="text-[12.5px]">Todavía no hay suficiente historial.</div>
        <div className="text-[11px] mt-1">Se guarda un snapshot del portafolio una vez al día — vuelve en unos días.</div>
      </div>
    );
  }
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--faint)" }} axisLine={false} tickLine={false} minTickGap={24} />
          <Tooltip
            formatter={(v: any) => [fmtUSD(v as number), "Total"]}
            contentStyle={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
            labelStyle={{ color: "var(--dim)" }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#evoFill)" animationDuration={900} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

```

### `src/components/coldvault/ConceptoInput.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Campo de concepto con autoguardado. Antes solo guardaba en onBlur y sin mirar si el servidor
 * respondió bien: si el usuario cambiaba de pestaña, filtraba o cerraba la página antes del blur,
 * o si el guardado fallaba, el texto se perdía sin avisar. Ahora guarda solo (debounce), al salir
 * del campo, y al desmontarse; muestra el estado y deja reintentar si falla.
 */
export default function ConceptoInput({
  value, onSave, className, placeholder,
}: { value: string; onSave: (concepto: string) => Promise<boolean>; className?: string; placeholder?: string }) {
  const [text, setText] = useState(value);
  const [status, setStatus] = useState<Status>("idle");
  const saved = useRef(value);
  const textRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Si el valor guardado cambia desde afuera (otra pestaña, migración) y el usuario no está escribiendo, se sincroniza.
  useEffect(() => {
    if (!focused.current && value !== saved.current) { saved.current = value; textRef.current = value; setText(value); }
  }, [value]);

  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const current = textRef.current;
    if (current === saved.current) return;
    setStatus("saving");
    const ok = await onSaveRef.current(current);
    if (ok) { saved.current = current; setStatus("saved"); setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500); }
    else setStatus("error");
  };

  useEffect(() => () => {
    // Al desmontarse (cambio de pestaña/filtro) no se pierde lo escrito.
    if (timer.current) clearTimeout(timer.current);
    if (textRef.current !== saved.current) void onSaveRef.current(textRef.current);
  }, []);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        className={className}
        style={status === "error" ? { borderColor: "var(--neg)" } : undefined}
        placeholder={placeholder}
        value={text}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          setText(e.target.value); textRef.current = e.target.value; setStatus("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 800);
        }}
        onBlur={() => { focused.current = false; void flush(); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {status !== "idle" && (
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none"
          style={{ color: status === "error" ? "var(--neg)" : status === "saved" ? "var(--pos)" : "var(--faint)" }}
        >
          {status === "saving" ? "…" : status === "saved" ? "✓" : "✕"}
        </span>
      )}
      {status === "error" && (
        <button className="text-[10.5px] underline mt-0.5" style={{ color: "var(--neg)" }} onClick={() => void flush()}>
          No se guardó — reintentar
        </button>
      )}
    </div>
  );
}

```

### `src/components/coldvault/GlobalSearch.tsx`

```tsx
"use client";

import { useState } from "react";
import { Aliado, Movement, Wallet, fmtAmt, shortAddr } from "./shared";

export default function GlobalSearch({
  wallets, aliados, movements,
  onSelectWallet, onSelectAliado, onSelectMovement,
}: {
  wallets: Wallet[];
  aliados: Aliado[];
  movements: Movement[];
  onSelectWallet: (w: Wallet) => void;
  onSelectAliado: (a: Aliado) => void;
  onSelectMovement: (m: Movement) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const walletMatches = q ? wallets.filter((w) => w.label.toLowerCase().includes(q) || w.address.toLowerCase().includes(q)).slice(0, 5) : [];
  const aliadoMatches = q ? aliados.filter((a) => a.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const movementMatches = q
    ? movements.filter((m) => (m.counterparty || "").toLowerCase().includes(q) || m.txid.toLowerCase().includes(q) || m.asset.toLowerCase().includes(q)).slice(0, 5)
    : [];
  const hasResults = walletMatches.length + aliadoMatches.length + movementMatches.length > 0;

  const pick = (fn: () => void) => { fn(); setOpen(false); setQuery(""); };

  return (
    <div className="relative flex-1 max-w-[380px]">
      <input
        className="cv-input w-full"
        placeholder="Buscar dirección, aliado, hash o concepto…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && q && (
        <div
          className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-20"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 12px 30px rgba(0,0,0,0.4)" }}
        >
          {!hasResults ? (
            <div className="px-3.5 py-3 text-[12.5px]" style={{ color: "var(--faint)" }}>Sin resultados.</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {walletMatches.length > 0 && (
                <div>
                  <div className="px-3.5 pt-2.5 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--faint)" }}>Wallets</div>
                  {walletMatches.map((w) => (
                    <button key={w.id} className="cv-row w-full text-left px-3.5 py-2" onMouseDown={() => pick(() => onSelectWallet(w))}>
                      <div className="text-[12.5px]" style={{ color: "var(--ink)" }}>{w.label}</div>
                      <div className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>{shortAddr(w.address)}</div>
                    </button>
                  ))}
                </div>
              )}
              {aliadoMatches.length > 0 && (
                <div>
                  <div className="px-3.5 pt-2.5 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--faint)" }}>Aliados</div>
                  {aliadoMatches.map((a) => (
                    <button key={a.id} className="cv-row w-full text-left px-3.5 py-2 text-[12.5px]" style={{ color: "var(--ink)" }} onMouseDown={() => pick(() => onSelectAliado(a))}>
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
              {movementMatches.length > 0 && (
                <div>
                  <div className="px-3.5 pt-2.5 pb-1 text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--faint)" }}>Movimientos</div>
                  {movementMatches.map((m) => (
                    <button key={`${m.key}:${(m as any).walletId}`} className="cv-row w-full text-left px-3.5 py-2" onMouseDown={() => pick(() => onSelectMovement(m))}>
                      <div className="text-[12.5px]" style={{ color: m.direction === "out" ? "var(--neg)" : "var(--pos)" }}>
                        {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                      </div>
                      <div className="font-mono text-[11px]" style={{ color: "var(--faint)" }}>{shortAddr(m.counterparty)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

```

### `src/components/coldvault/PushBell.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushBell({ size = 34 }: { size?: number }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => setSubscribed(!!(await reg.pushManager.getSubscription())))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/notifications/subscription", {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } else {
        // El permiso se pide como el PRIMER await del gesto: en iOS (sobre todo instalado
        // como app de pantalla de inicio), cualquier await antes de este punto puede hacer
        // que Safari ya no considere esto "dentro" del toque del usuario y el permiso falle
        // en silencio (ni error ni cuadro de diálogo, la campana simplemente no cambia).
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError(permission === "denied" ? "Permiso denegado. Actívalo en Ajustes del teléfono/navegador para este sitio." : "No se concedió el permiso de notificaciones.");
          setBusy(false);
          return;
        }
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setError("Falta configurar la clave pública de notificaciones en el servidor.");
          setBusy(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
        const json = sub.toJSON();
        const res = await fetch("/api/notifications/subscription", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        if (!res.ok) throw new Error(`el servidor respondió ${res.status}`);
        setSubscribed(true);
      }
    } catch (e: any) {
      console.error("PushBell toggle error:", e);
      setError(e?.message ? `No se pudo activar: ${e.message}` : "No se pudo activar las notificaciones.");
    }
    setBusy(false);
  };

  if (!supported) return null;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={toggle}
        disabled={busy}
        className="cv-icon-btn justify-center rounded-full flex-shrink-0 transition-colors"
        style={
          subscribed
            ? { width: size, height: size, background: "var(--accent)", border: "1px solid var(--accent)", color: "#ffffff" }
            : { width: size, height: size, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)" }
        }
        title={subscribed ? "Notificaciones activadas — clic para desactivar" : "Notificaciones desactivadas — clic para activar"}
      >
        {subscribed ? <Bell size={15} fill="currentColor" /> : <BellOff size={15} />}
      </button>
      {error && (
        <div
          role="alert"
          className="cv-pop absolute right-0 top-full mt-2 z-50 w-[240px] rounded-xl px-3 py-2.5 text-[11.5px] shadow-lg"
          style={{ background: "var(--panel)", border: "1px solid var(--neg)", color: "var(--ink)", animationDuration: "0.15s" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

```
