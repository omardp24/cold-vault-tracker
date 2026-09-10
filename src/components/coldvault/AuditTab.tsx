"use client";

import { useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { CHAIN_LABEL, Chain, fmtAmt, fmtDate } from "./shared";

export default function AuditTab() {
  const [auditChain, setAuditChain] = useState<Chain>("TRON");
  const [auditAddr, setAuditAddr] = useState("");
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditError, setAuditError] = useState("");

  const runAudit = async () => {
    if (!auditAddr.trim()) return;
    setAuditRunning(true); setAuditError(""); setAuditResult(null);
    try {
      const res = await fetch(`/api/audit?chain=${auditChain}&address=${encodeURIComponent(auditAddr.trim())}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      setAuditResult(d);
    } catch (e: any) {
      setAuditError(e.message || "No se pudo completar la auditoría.");
    }
    setAuditRunning(false);
  };

  return (
    <>
      <div className="cv-card cv-card-hover p-5 mb-4">
        <div className="flex items-center gap-2 mb-1"><ShieldCheck size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Auditar una wallet antes de transferir</div></div>
        <div className="text-[11.5px] mb-3" style={{ color: "var(--dim)" }}>
          Cruza la dirección contra la lista pública de sanciones de la OFAC (Tesoro de EE.UU., BTC/ETH/TRX/USDT/USDC), revisa su actividad on-chain, y verifica si se parece sospechosamente a alguna dirección que ya conoces.
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-wrap">
          <select className="cv-select w-full sm:w-auto" value={auditChain} onChange={(e) => setAuditChain(e.target.value as Chain)}>
            {(Object.keys(CHAIN_LABEL) as Chain[]).map((c) => <option key={c} value={c}>{CHAIN_LABEL[c]}</option>)}
          </select>
          <input className="cv-input w-full sm:flex-1 sm:min-w-[220px]" placeholder="Dirección a auditar" value={auditAddr} onChange={(e) => setAuditAddr(e.target.value)} />
          <button className="cv-btn" onClick={runAudit} disabled={auditRunning || !auditAddr.trim()}>
            {auditRunning ? "Auditando…" : (<><Search size={14} className="inline -mt-0.5 mr-1" />Auditar</>)}
          </button>
        </div>
        {auditError && <div className="text-xs mt-2" style={{ color: "var(--neg)" }}>{auditError}</div>}
      </div>

      {auditResult && (
        <div className="cv-card cv-card-hover p-5">
          {(() => {
            const v = auditResult.verdict as "clean" | "caution" | "high_risk";
            const cfg = {
              clean: { bg: "rgba(62,213,152,.14)", border: "var(--pos)", color: "var(--pos)", label: "✓ Sin señales de alerta" },
              caution: { bg: "var(--tint)", border: "var(--amber)", color: "var(--amber)", label: "⚠ Revisar con cuidado" },
              high_risk: { bg: "rgba(255,107,90,.14)", border: "var(--neg)", color: "var(--neg)", label: "🚫 ALTO RIESGO — no recomendado transferir" },
            }[v];
            return (
              <div className="rounded-lg p-4 mb-4" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <div className="font-display text-base font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
                <div className="font-mono text-[11px] mt-1" style={{ color: "var(--dim)" }}>{auditResult.address}</div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
              <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Sanciones OFAC</div>
              {auditResult.sanctions.sanctioned ? (
                <div className="text-sm font-semibold" style={{ color: "var(--neg)" }}>
                  🚫 Encontrada en lista SDN ({auditResult.sanctions.lists.join(", ")})
                </div>
              ) : (
                <div className="text-sm font-semibold" style={{ color: "var(--pos)" }}>✓ No aparece en la lista OFAC</div>
              )}
              <div className="text-[10.5px] mt-1" style={{ color: "var(--faint)" }}>
                Lista sincronizada {new Date(auditResult.sanctions.lastChecked).toLocaleString("es-VE")}
              </div>
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
              <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Direcciones clonadas</div>
              {auditResult.poisoningMatches.length > 0 ? (
                <div className="text-sm font-semibold" style={{ color: "var(--neg)" }}>
                  🚫 Se parece a {auditResult.poisoningMatches.map((p: any) => p.label).join(", ")} — pero NO es la misma dirección
                </div>
              ) : (
                <div className="text-sm font-semibold" style={{ color: "var(--pos)" }}>✓ No coincide con direcciones que ya conoces</div>
              )}
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
              <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Actividad on-chain</div>
              {auditResult.activity.historyError ? (
                <div className="text-xs" style={{ color: "var(--dim)" }}>No se pudo leer: {auditResult.activity.historyError}</div>
              ) : auditResult.activity.txSeen === 0 ? (
                <div className="text-sm" style={{ color: "var(--ink)" }}>Sin movimientos registrados — wallet nueva o inactiva.</div>
              ) : (
                <div className="text-sm" style={{ color: "var(--ink)" }}>
                  {auditResult.activity.txSeen}{auditResult.activity.hasMoreHistory ? "+" : ""} movimiento(s) visto(s)
                  {auditResult.activity.oldestSeen && (
                    <> · desde {fmtDate(auditResult.activity.oldestSeen)} hasta {fmtDate(auditResult.activity.newestSeen)}</>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg p-4" style={{ background: "var(--panel2)" }}>
              <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Saldo actual</div>
              {auditResult.balance.error ? (
                <div className="text-xs" style={{ color: "var(--dim)" }}>No se pudo leer: {auditResult.balance.error}</div>
              ) : auditResult.balance.summary.length === 0 ? (
                <div className="text-sm" style={{ color: "var(--ink)" }}>Sin saldo detectado.</div>
              ) : (
                <div className="text-sm font-mono" style={{ color: "var(--ink)" }}>
                  {auditResult.balance.summary.map((s: any) => `${fmtAmt(s.amount, 4)} ${s.symbol}`).join(" · ")}
                </div>
              )}
            </div>

            {auditResult.chain === "TRON" && (
              <div className="rounded-lg p-4" style={{ background: "var(--panel2)", gridColumn: "1 / -1" }}>
                <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Tronscan (seguridad TRON)</div>
                <div className="text-sm mb-1" style={{ color: auditResult.tronscanBlacklist?.blacklisted ? "var(--neg)" : "var(--pos)" }}>
                  {auditResult.tronscanBlacklist?.blacklisted
                    ? `🚫 En lista negra de: ${auditResult.tronscanBlacklist.tokens.join(", ")}`
                    : "✓ No está en la lista negra de stablecoins (USDT/USDC)"}
                </div>
                {auditResult.tronscanSecurity?.checked ? (
                  (auditResult.tronscanSecurity.hasFraudTransaction || auditResult.tronscanSecurity.fraudTokenCreator || auditResult.tronscanSecurity.isBlackList) ? (
                    <div className="text-sm font-semibold" style={{ color: "var(--neg)" }}>
                      🚫 Tronscan reporta: {[
                        auditResult.tronscanSecurity.hasFraudTransaction && "historial de transacciones fraudulentas",
                        auditResult.tronscanSecurity.fraudTokenCreator && "creador de tokens falsos",
                        auditResult.tronscanSecurity.isBlackList && "en lista negra",
                      ].filter(Boolean).join(" · ")}
                    </div>
                  ) : (
                    <div className="text-sm" style={{ color: "var(--pos)" }}>✓ Sin banderas de fraude en la base de seguridad de Tronscan</div>
                  )
                ) : (
                  <div className="text-[11px]" style={{ color: "var(--faint)" }}>
                    Verificación de fraude/spam no activa — agrega <span className="font-mono">TRONSCAN_KEY</span> en tu <span className="font-mono">.env.local</span> (key gratuita en tronscan.org) para habilitarla.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="text-[11px] mt-4 pt-3 border-t" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
            Esta auditoría combina la lista pública de sanciones de la OFAC con patrones on-chain simples propios. No sustituye tu criterio ni es asesoría legal o financiera — un resultado "sin señales de alerta" no es garantía de que la wallet sea segura, solo que no encontramos indicios en estas fuentes.
          </div>
        </div>
      )}
    </>
  );
}
