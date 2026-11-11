"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Ban, Check, CircleHelp, Copy, History, Search, ShieldAlert, ShieldCheck, ShieldX, TriangleAlert, X } from "lucide-react";
import { CHAIN_LABEL, ChainBadge, Chain, fmtAmt, fmtDate, fmtDateTime, shortAddr } from "./shared";

type Verdict = "clean" | "caution" | "high_risk";
type CheckState = "ok" | "bad" | "warn" | "unknown";
interface RecentAudit { chain: Chain; address: string; verdict: Verdict; at: number; }

const RECENT_KEY = "cv-audit-recent";
const VERDICT: Record<Verdict, { bg: string; color: string; title: string; note: string; Icon: typeof ShieldCheck }> = {
  clean: { bg: "rgba(62,213,152,.14)", color: "var(--pos)", title: "Sin señales de alerta", note: "No encontramos indicios en las fuentes consultadas.", Icon: ShieldCheck },
  caution: { bg: "var(--tint)", color: "var(--amber)", title: "Revisar con cuidado", note: "Hay algo que conviene mirar antes de transferir.", Icon: ShieldAlert },
  high_risk: { bg: "rgba(255,107,90,.14)", color: "var(--neg)", title: "Alto riesgo", note: "No se recomienda transferir a esta dirección.", Icon: ShieldX },
};
const WHAT_WE_CHECK: [string, string][] = [
  ["Sanciones OFAC", "Lista pública del Tesoro de EE. UU. (BTC, ETH, TRX, USDT, USDC)."],
  ["Direcciones clonadas", "Si se parece a una dirección que ya conoces sin ser la misma."],
  ["Actividad on-chain", "Cuántos movimientos tiene y desde cuándo."],
  ["Saldo y listas negras", "Saldo actual y, en Tron, la base de seguridad de Tronscan."],
];

// Deduce la red por el formato de la dirección, para no obligar a elegirla a mano.
const guessChain = (addr: string): Chain | null => {
  const a = addr.trim();
  if (/^0x[0-9a-fA-F]{6,}$/.test(a)) return "ETH";
  if (/^T[1-9A-HJ-NP-Za-km-z]{20,}$/.test(a)) return "TRON";
  if (/^(bc1|[13])[0-9A-Za-z]{20,}$/.test(a)) return "BTC";
  return null;
};

function CheckRow({ state, title, children }: { state: CheckState; title: string; children: ReactNode }) {
  const cfg = {
    ok: { color: "var(--pos)", bg: "rgba(62,213,152,.14)", Icon: Check },
    bad: { color: "var(--neg)", bg: "rgba(255,107,90,.14)", Icon: Ban },
    warn: { color: "var(--amber)", bg: "var(--tint)", Icon: TriangleAlert },
    unknown: { color: "var(--faint)", bg: "var(--panel2)", Icon: CircleHelp },
  }[state];
  return (
    <div className="flex items-start gap-3 py-3 border-t" style={{ borderColor: "var(--line)" }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}><cfg.Icon size={15} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{title}</div>
        <div className="text-[13px] mt-0.5" style={{ color: "var(--ink)" }}>{children}</div>
      </div>
    </div>
  );
}

export default function AuditTab() {
  const [auditChain, setAuditChain] = useState<Chain>("TRON");
  const [auditAddr, setAuditAddr] = useState("");
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditError, setAuditError] = useState("");
  const [recent, setRecent] = useState<RecentAudit[]>([]);
  const [copied, setCopied] = useState(false);

  // Últimas auditorías: solo en este navegador, como atajo para repetir una consulta.
  useEffect(() => {
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); if (Array.isArray(r)) setRecent(r.slice(0, 6)); } catch { /* sin almacenamiento local */ }
  }, []);
  const saveRecent = (list: RecentAudit[]) => {
    setRecent(list);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* sin almacenamiento local */ }
  };

  const onAddrChange = (value: string) => {
    setAuditAddr(value);
    const g = guessChain(value);
    if (g) setAuditChain(g);
  };

  const runAudit = async (chain: Chain = auditChain, address: string = auditAddr) => {
    const addr = address.trim();
    if (!addr) return;
    setAuditRunning(true); setAuditError(""); setAuditResult(null);
    try {
      const res = await fetch(`/api/audit?chain=${chain}&address=${encodeURIComponent(addr)}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      setAuditResult(d);
      saveRecent([{ chain, address: addr, verdict: d.verdict as Verdict, at: Date.now() }, ...recent.filter((r) => !(r.chain === chain && r.address === addr))].slice(0, 6));
    } catch (e: any) {
      setAuditError(e.message || "No se pudo completar la auditoría.");
    }
    setAuditRunning(false);
  };

  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(auditResult.address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* sin permiso del portapapeles */ }
  };

  const r = auditResult;
  const v = r ? VERDICT[r.verdict as Verdict] || VERDICT.caution : null;
  const tronFlags = r?.tronscanSecurity?.checked
    ? [
        r.tronscanSecurity.hasFraudTransaction && "historial de transacciones fraudulentas",
        r.tronscanSecurity.fraudTokenCreator && "creador de tokens falsos",
        r.tronscanSecurity.isBlackList && "en lista negra",
      ].filter(Boolean) as string[]
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
      <div className="min-w-0">
        {/* Consulta */}
        <div className="cv-card p-4 sm:p-6 mb-3 sm:mb-4">
          <div className="cv-eyebrow mb-1.5">Antes de transferir</div>
          <div className="font-display text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: "var(--ink)" }}>Audita una dirección</div>
          <div className="text-[12.5px] mt-1.5 mb-4" style={{ color: "var(--dim)" }}>Pega la dirección de destino. La red se detecta sola por el formato.</div>

          <div className="cv-subtabs mb-2.5" style={{ width: "fit-content" }} role="radiogroup" aria-label="Red">
            {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => (
              <button key={c} role="radio" aria-checked={auditChain === c} className="cv-subtab" data-active={auditChain === c} onClick={() => setAuditChain(c)}>
                <ChainBadge chain={c} size={16} /> {CHAIN_LABEL[c]}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                className="cv-input w-full" style={{ paddingRight: auditAddr ? 38 : undefined }} placeholder="Dirección a auditar"
                value={auditAddr} onChange={(e) => onAddrChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runAudit(); }}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Dirección a auditar"
              />
              {auditAddr && (
                <button className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center" style={{ width: 32, height: 32, background: "none", border: "none", color: "var(--faint)", cursor: "pointer" }} onClick={() => setAuditAddr("")} title="Borrar" aria-label="Borrar dirección"><X size={15} /></button>
              )}
            </div>
            <button className="cv-btn inline-flex items-center justify-center gap-1.5 flex-shrink-0" onClick={() => runAudit()} disabled={auditRunning || !auditAddr.trim()}>
              <Search size={14} /> {auditRunning ? "Auditando…" : "Auditar"}
            </button>
          </div>
          {auditError && <div className="text-xs mt-2.5" style={{ color: "var(--neg)" }}>{auditError}</div>}
        </div>

        {/* Cargando */}
        {auditRunning && (
          <div className="cv-card p-4 sm:p-6">
            <span className="cv-skeleton block mb-4" style={{ height: 76, borderRadius: 14 }} />
            {[0, 1, 2, 3].map((i) => <span key={i} className="cv-skeleton block mb-2.5" style={{ height: 40, borderRadius: 10, animationDelay: `${i * 90}ms` }} />)}
          </div>
        )}

        {/* Informe */}
        {r && v && (
          <div className="cv-card overflow-hidden cv-tab-in">
            <div className="p-4 sm:p-6 flex items-start gap-3.5" style={{ background: v.bg }}>
              <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--panel)", color: v.color }}><v.Icon size={26} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[18px] sm:text-[20px] font-bold leading-tight" style={{ color: v.color }}>{v.title}</div>
                <div className="text-[12.5px] mt-0.5" style={{ color: "var(--ink)" }}>{v.note}</div>
                <div className="flex items-center gap-2 mt-2.5 min-w-0">
                  <ChainBadge chain={r.chain as Chain} size={18} />
                  <span className="font-mono text-[11.5px] break-all min-w-0" style={{ color: "var(--dim)" }}>{r.address}</span>
                  <button className="flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: "none", border: "none", color: copied ? "var(--pos)" : "var(--dim)", cursor: "pointer" }} onClick={copyAddress} title="Copiar dirección" aria-label="Copiar dirección">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-2 cv-daylist">
              <CheckRow state={r.sanctions.sanctioned ? "bad" : "ok"} title="Sanciones OFAC">
                {r.sanctions.sanctioned
                  ? <span className="font-semibold" style={{ color: "var(--neg)" }}>Encontrada en la lista SDN ({r.sanctions.lists.join(", ")})</span>
                  : "No aparece en la lista OFAC"}
                <div className="text-[11px] mt-0.5" style={{ color: "var(--faint)" }}>Lista sincronizada {fmtDateTime(new Date(r.sanctions.lastChecked).getTime())}</div>
              </CheckRow>

              <CheckRow state={r.poisoningMatches.length > 0 ? "bad" : "ok"} title="Direcciones clonadas">
                {r.poisoningMatches.length > 0
                  ? <span className="font-semibold" style={{ color: "var(--neg)" }}>Se parece a {r.poisoningMatches.map((p: any) => p.label).join(", ")}, pero NO es la misma dirección</span>
                  : "No coincide con direcciones que ya conoces"}
              </CheckRow>

              {r.chain === "TRON" && (
                <CheckRow
                  state={r.tronscanBlacklist?.blacklisted || tronFlags.length > 0 ? "bad" : r.tronscanSecurity?.checked ? "ok" : "unknown"}
                  title="Tronscan (seguridad Tron)"
                >
                  {r.tronscanBlacklist?.blacklisted
                    ? <span className="font-semibold" style={{ color: "var(--neg)" }}>En lista negra de: {r.tronscanBlacklist.tokens.join(", ")}</span>
                    : "No está en la lista negra de stablecoins (USDT/USDC)"}
                  {r.tronscanSecurity?.checked ? (
                    tronFlags.length > 0
                      ? <div className="font-semibold mt-0.5" style={{ color: "var(--neg)" }}>Tronscan reporta: {tronFlags.join(" · ")}</div>
                      : <div className="mt-0.5" style={{ color: "var(--dim)" }}>Sin banderas de fraude en la base de seguridad de Tronscan</div>
                  ) : (
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--faint)" }}>
                      Verificación de fraude/spam no activa — agrega <span className="font-mono">TRONSCAN_KEY</span> en tu <span className="font-mono">.env.local</span> (key gratuita en tronscan.org) para habilitarla.
                    </div>
                  )}
                </CheckRow>
              )}

              <CheckRow state={r.activity.historyError ? "unknown" : r.activity.txSeen === 0 ? "warn" : "ok"} title="Actividad on-chain">
                {r.activity.historyError ? (
                  <span style={{ color: "var(--dim)" }}>No se pudo leer: {r.activity.historyError}</span>
                ) : r.activity.txSeen === 0 ? (
                  "Sin movimientos registrados — wallet nueva o inactiva."
                ) : (
                  <>
                    <span className="font-mono font-semibold">{r.activity.txSeen}{r.activity.hasMoreHistory ? "+" : ""}</span> movimiento(s) visto(s)
                    {r.activity.oldestSeen && <span style={{ color: "var(--dim)" }}> · desde {fmtDate(r.activity.oldestSeen)} hasta {fmtDate(r.activity.newestSeen)}</span>}
                  </>
                )}
              </CheckRow>

              <CheckRow state={r.balance.error ? "unknown" : "ok"} title="Saldo actual">
                {r.balance.error ? (
                  <span style={{ color: "var(--dim)" }}>No se pudo leer: {r.balance.error}</span>
                ) : r.balance.summary.length === 0 ? (
                  "Sin saldo detectado."
                ) : (
                  <span className="flex flex-wrap gap-1.5 mt-1">
                    {r.balance.summary.map((s: any) => (
                      <span key={s.symbol} className="whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[12px]" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>{fmtAmt(s.amount, 4)} {s.symbol}</span>
                    ))}
                  </span>
                )}
              </CheckRow>
            </div>

            <div className="text-[11px] px-4 sm:px-6 py-3 border-t" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
              Esta auditoría combina la lista pública de sanciones de la OFAC con patrones on-chain simples propios. No sustituye tu criterio ni es asesoría legal o financiera — un resultado «sin señales de alerta» no es garantía de que la wallet sea segura, solo que no encontramos indicios en estas fuentes.
            </div>
          </div>
        )}
      </div>

      {/* Columna lateral: recientes y qué se revisa */}
      <div className="min-w-0 space-y-3 sm:space-y-4">
        {recent.length > 0 && (
          <div className="cv-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2"><History size={15} style={{ color: "var(--dim)" }} /><div className="font-display text-sm font-semibold">Auditorías recientes</div></div>
              <button className="text-[11px]" style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer" }} onClick={() => saveRecent([])}>Borrar</button>
            </div>
            <div className="cv-daylist">
              {recent.map((a) => (
                <button key={`${a.chain}:${a.address}`} className="cv-row w-full text-left flex items-center gap-2.5 py-2.5 px-1 border-t rounded-md"
                  style={{ background: "none", borderLeft: "none", borderRight: "none", borderBottom: "none", borderColor: "var(--line)", color: "var(--ink)", cursor: "pointer" }}
                  onClick={() => { setAuditChain(a.chain); setAuditAddr(a.address); runAudit(a.chain, a.address); }} title="Volver a auditar">
                  <ChainBadge chain={a.chain} size={22} />
                  <span className="min-w-0 flex-1 block">
                    <span className="block font-mono text-[12.5px]">{shortAddr(a.address)}</span>
                    <span className="block text-[11px]" style={{ color: "var(--faint)" }}>{fmtDateTime(a.at)}</span>
                  </span>
                  <span className="cv-tag flex-shrink-0" style={{ background: VERDICT[a.verdict]?.bg, color: VERDICT[a.verdict]?.color }}>{VERDICT[a.verdict]?.title}</span>
                </button>
              ))}
            </div>
            <div className="text-[10.5px] mt-2" style={{ color: "var(--faint)" }}>Se guardan solo en este navegador.</div>
          </div>
        )}

        <div className="cv-card p-4 sm:p-5">
          <div className="font-display text-sm font-semibold mb-1">Qué se revisa</div>
          <div className="cv-daylist">
            {WHAT_WE_CHECK.map(([title, text], i) => (
              <div key={title} className="flex items-start gap-3 py-2.5 border-t" style={{ borderColor: "var(--line)" }}>
                <span className="font-mono text-[11px] font-semibold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--tint)", color: "var(--accent)" }}>{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium" style={{ color: "var(--ink)" }}>{title}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
