"use client";

import type { Dispatch, SetStateAction } from "react";
import { CircleCheck, Clock, Download, Plus, Send } from "lucide-react";
import { Wallet, fmtAmt, shortAddr } from "./shared";

export interface XferLeg { id: string; walletId: string; asset: string; amount: string; isTest: boolean; }

export interface TransferViewProps {
  wallets: Wallet[];

  xferTargetAmount: string;
  setXferTargetAmount: Dispatch<SetStateAction<string>>;
  xferTargetAsset: string;
  setXferTargetAsset: Dispatch<SetStateAction<string>>;
  xferDest: string;
  setXferDest: Dispatch<SetStateAction<string>>;
  xferLegs: XferLeg[];
  includeTest: boolean;
  setIncludeTest: Dispatch<SetStateAction<boolean>>;
  testAmount: string;
  setTestAmount: Dispatch<SetStateAction<string>>;

  balanceCache: Record<string, { symbol: string; amount: number }[]>;
  feeCache: Record<string, any>;
  onLegWalletChange: (id: string, walletId: string) => void;
  updateLeg: (id: string, patch: Partial<XferLeg>) => void;
  removeLeg: (id: string) => void;
  addLeg: () => void;

  totalPlanned: number;
  targetNum: number;
  diff: number;

  buildPlan: () => void;
  planRunning: boolean;
  planError: string;

  destAudit: any;
  destAuditRunning: boolean;

  allLegs: XferLeg[];
  savePlan: () => void;
  savingPlan: boolean;

  plans: any[];
  updatePlanLeg: (planId: string, legId: string, patch: { done?: boolean; txHash?: string; notes?: string }) => void;
  uploadAttachment: (planId: string, legId: string, file: File) => void;
  deletePlan: (planId: string) => void;
}

export default function TransferView({
  wallets,
  xferTargetAmount, setXferTargetAmount, xferTargetAsset, setXferTargetAsset, xferDest, setXferDest,
  xferLegs, includeTest, setIncludeTest, testAmount, setTestAmount,
  balanceCache, feeCache, onLegWalletChange, updateLeg, removeLeg, addLeg,
  totalPlanned, targetNum, diff,
  buildPlan, planRunning, planError,
  destAudit, destAuditRunning,
  allLegs, savePlan, savingPlan,
  plans, updatePlanLeg, uploadAttachment, deletePlan,
}: TransferViewProps) {
  return (
    <>
      <div className="cv-card cv-card-hover p-5 mb-4">
        <div className="flex items-center gap-2 mb-1"><Send size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Plan de transferencia</div></div>
        <div className="text-[11.5px] mb-4" style={{ color: "var(--dim)" }}>
          Define cuánto necesitas que llegue en total al destino, arma los tramos desde tus distintas wallets (con transferencia de prueba primero si quieres), y verifica que sumen exacto antes de enviar nada de verdad. Esta app <strong>no envía nada</strong> — nunca tiene tus claves privadas.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Monto objetivo (lo que debe llegar en total)</div>
            <div className="flex gap-2">
              <input className="cv-input flex-1 min-w-0" placeholder="0.00" value={xferTargetAmount} onChange={(e) => setXferTargetAmount(e.target.value)} />
              <input className="cv-input w-20 flex-shrink-0" placeholder="USDT" value={xferTargetAsset} onChange={(e) => setXferTargetAsset(e.target.value.toUpperCase())} />
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Dirección destino (la misma para todos los tramos)</div>
            <input className="cv-input w-full" placeholder="Pega la dirección aquí" value={xferDest} onChange={(e) => setXferDest(e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg p-3 mb-3" style={{ background: "var(--panel2)" }}>
          <label className="flex items-start gap-2 text-[12.5px] cursor-pointer" style={{ color: "var(--ink)" }}>
            <input type="checkbox" className="mt-0.5" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} style={{ width: 17, height: 17 }} />
            <span>Incluir <strong>transferencia de prueba</strong> primero, desde la wallet del primer tramo</span>
          </label>
          {includeTest && (
            <div className="flex items-center gap-2 mt-2 pl-6">
              <span className="text-[12px]" style={{ color: "var(--dim)" }}>Monto:</span>
              <input className="cv-input w-24 py-1 px-2" value={testAmount} onChange={(e) => setTestAmount(e.target.value)} />
              <span className="text-[12px] font-medium">{xferLegs[0]?.asset || xferTargetAsset}</span>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {xferLegs.map((leg, i) => {
            const w = wallets.find((x) => x.id === leg.walletId);
            const bal = leg.walletId ? balanceCache[leg.walletId] : undefined;
            return (
              <div key={leg.id} className="rounded-lg p-3" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold" style={{ color: "var(--dim)" }}>Tramo {i + 1}</span>
                  <button className="cv-x" onClick={() => removeLeg(leg.id)}>✕</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select className="cv-select w-full" value={leg.walletId} onChange={(e) => onLegWalletChange(leg.id, e.target.value)}>
                    <option value="">Wallet origen…</option>
                    {wallets.map((wo) => <option key={wo.id} value={wo.id}>{wo.label} ({wo.chain})</option>)}
                  </select>
                  <select className="cv-select w-full" value={leg.asset} onChange={(e) => updateLeg(leg.id, { asset: e.target.value })} disabled={!bal}>
                    {!bal && <option value={leg.asset}>{leg.asset}</option>}
                    {bal?.map((b) => <option key={b.symbol} value={b.symbol}>{b.symbol} — disp. {fmtAmt(b.amount, 6)}</option>)}
                  </select>
                  <input className="cv-input w-full" placeholder="Monto de este tramo" value={leg.amount} onChange={(e) => updateLeg(leg.id, { amount: e.target.value })} />
                </div>
              </div>
            );
          })}
        </div>

        <button className="cv-btn-ghost cv-icon-btn mt-3" onClick={addLeg}><Plus size={13} /> Agregar tramo</button>

        <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="rounded-xl p-3" style={{ background: Math.abs(diff) < 0.000001 ? "rgba(62,213,152,.14)" : "var(--tint)" }}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--dim)" }}>Planificado</div>
                <div className="font-mono text-[14px] font-bold">{fmtAmt(totalPlanned)} {xferTargetAsset}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "var(--dim)" }}>Objetivo</div>
                <div className="font-mono text-[14px] font-bold">{fmtAmt(targetNum)} {xferTargetAsset}</div>
              </div>
            </div>
            <div className="text-[13px] font-semibold" style={{ color: Math.abs(diff) < 0.000001 ? "var(--pos)" : "var(--neg)" }}>
              {Math.abs(diff) < 0.000001 ? "✓ Cuadra exacto" : diff > 0 ? `⚠ Te pasas por ${fmtAmt(diff)}` : `⚠ Falta ${fmtAmt(-diff)}`}
            </div>
          </div>
        </div>

        <button className="cv-btn mt-4 w-full sm:w-auto" onClick={buildPlan} disabled={planRunning || xferLegs.length === 0}>
          {planRunning ? "Verificando…" : "Verificar plan (saldos, comisiones y destino)"}
        </button>
        {planError && <div className="text-xs mt-2" style={{ color: "var(--neg)" }}>{planError}</div>}
      </div>

      {xferDest.trim() && (destAudit || destAuditRunning) && (
        <div className="cv-card cv-card-hover p-5 mb-4">
          <div className="text-[11px] uppercase tracking-wide mb-1.5" style={{ color: "var(--dim)" }}>Auditoría de la dirección destino</div>
          {destAuditRunning ? (
            <div className="text-sm" style={{ color: "var(--dim)" }}>Auditando…</div>
          ) : destAudit?.error ? (
            <div className="text-xs" style={{ color: "var(--dim)" }}>No se pudo auditar: {destAudit.error}</div>
          ) : (
            <>
              <div className="text-sm font-semibold" style={{ color: destAudit.verdict === "high_risk" ? "var(--neg)" : destAudit.verdict === "caution" ? "var(--amber)" : "var(--pos)" }}>
                {destAudit.verdict === "high_risk" ? "🚫 ALTO RIESGO — no recomendado" : destAudit.verdict === "caution" ? "⚠ Revisar con cuidado" : "✓ Sin señales de alerta"}
              </div>
              {destAudit.sanctions?.sanctioned && <div className="text-xs mt-1" style={{ color: "var(--neg)" }}>En lista OFAC ({destAudit.sanctions.lists.join(", ")})</div>}
              {destAudit.poisoningMatches?.length > 0 && (
                <div className="text-xs mt-1" style={{ color: "var(--neg)" }}>Se parece a: {destAudit.poisoningMatches.map((p: any) => p.label).join(", ")}</div>
              )}
            </>
          )}
        </div>
      )}

      {allLegs.length > 0 && allLegs.some((l) => l.walletId) && (
        <div className="cv-card cv-card-hover p-5">
          <div className="font-display text-sm font-semibold mb-3">Checklist de ejecución</div>
          <div className="space-y-2.5">
            {allLegs.filter((l) => l.walletId).map((leg, i) => {
              const w = wallets.find((x) => x.id === leg.walletId)!;
              const amt = parseFloat(leg.amount) || 0;
              const isNative = leg.asset === (w.chain === "BTC" ? "BTC" : w.chain === "ETH" ? "ETH" : "TRX");
              const fee = feeCache[`${w.chain}-${!isNative}`];
              const feeLevels = fee?.levels || [];
              const worstFee = feeLevels.length ? Math.max(...feeLevels.map((l: any) => l.fee)) : 0;
              const bal = balanceCache[leg.walletId] || [];
              const available = bal.find((b) => b.symbol === leg.asset)?.amount ?? null;
              const gasAvailable = bal.find((b) => b.symbol === fee?.nativeSymbol)?.amount ?? null;
              const enoughAmount = available === null ? null : available >= amt;
              const enoughGas = gasAvailable === null ? null : isNative ? (available ?? 0) >= amt + worstFee : gasAvailable >= worstFee;
              return (
                <div key={leg.id} className="rounded-lg p-3" style={{ background: leg.isTest ? "var(--tint)" : "var(--panel2)", border: `1px solid ${leg.isTest ? "var(--amber)" : "var(--line)"}` }}>
                  <div className="text-sm">
                    {leg.isTest && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 mr-1.5" style={{ background: "var(--amber)", color: "var(--ink)" }}>PRUEBA</span>}
                    <strong>{i + 1}.</strong> Enviar <strong className="font-mono">{fmtAmt(amt)} {leg.asset}</strong> desde <strong>{w.label}</strong>
                  </div>
                  <div className="text-[11.5px] mt-1 flex flex-wrap gap-x-3" style={{ color: "var(--dim)" }}>
                    {available !== null && <span>disponible: {fmtAmt(available, 6)} {leg.asset}</span>}
                    {worstFee > 0 && <span>comisión est.: {fmtAmt(worstFee, 6)} {fee?.nativeSymbol}</span>}
                  </div>
                  {(enoughAmount === false || enoughGas === false) && (
                    <div className="text-[11.5px] font-semibold mt-1" style={{ color: "var(--neg)" }}>
                      {enoughAmount === false ? "✕ Saldo insuficiente para el monto" : "✕ Saldo insuficiente para la comisión de red"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] mt-4 pt-3 border-t" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
            Sigue este orden al hacer los envíos reales desde Ledger Live: primero la prueba (si la incluiste), confirma que llegó, y luego el resto de los tramos. Las comisiones son estimadas al momento de verificar el plan y pueden variar un poco para cuando envíes de verdad.
          </div>
          <button className="cv-btn mt-3 w-full sm:w-auto" onClick={savePlan} disabled={savingPlan}>
            {savingPlan ? "Guardando…" : (<><CircleCheck size={14} className="inline -mt-0.5 mr-1" />Guardar este plan en el historial</>)}
          </button>
        </div>
      )}

      {plans.length > 0 && (
        <div className="cv-card cv-card-hover p-5 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} />
            <div className="font-display text-sm font-semibold">Historial de transferencias</div>
          </div>
          <div className="space-y-3">
            {plans.map((plan) => {
              const doneCount = plan.legs.filter((l: any) => l.done).length;
              const allDone = doneCount === plan.legs.length;
              return (
                <div key={plan.id} className="rounded-lg p-3.5" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <div className="text-sm font-medium">
                        {fmtAmt(plan.targetAmount)} {plan.targetAsset} → {plan.destLabel || shortAddr(plan.destination)}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--dim)" }}>{new Date(plan.createdAt).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" })} · {plan.legs.length} tramo(s)</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-semibold rounded-full px-2 py-0.5" style={{ background: allDone ? "rgba(62,213,152,.14)" : "var(--tint)", color: allDone ? "var(--pos)" : "var(--amber)" }}>
                        {doneCount}/{plan.legs.length} {allDone ? "✓ completado" : "en progreso"}
                      </span>
                      <button className="cv-x" onClick={() => deletePlan(plan.id)}>✕</button>
                    </div>
                  </div>

                  <div className="space-y-2 mt-2.5">
                    {plan.legs.map((leg: any) => (
                      <div key={leg.id} className="rounded-md p-2.5" style={{ background: "var(--panel)", border: `1px solid ${leg.done ? "var(--pos)" : "var(--line)"}` }}>
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" className="mt-1" checked={leg.done} onChange={(e) => updatePlanLeg(plan.id, leg.id, { done: e.target.checked })} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              {leg.isTest && <span className="text-[10px] font-semibold rounded px-1.5 py-0.5 mr-1.5" style={{ background: "var(--amber)", color: "var(--ink)" }}>PRUEBA</span>}
                              <span className={leg.done ? "line-through" : ""} style={{ color: leg.done ? "var(--dim)" : "var(--ink)" }}>
                                {fmtAmt(leg.amount)} {leg.asset} desde {leg.walletLabel}
                              </span>
                            </div>
                            {leg.doneAt && <div className="text-[10.5px]" style={{ color: "var(--dim)" }}>transferido {new Date(leg.doneAt).toLocaleString("es-VE")}</div>}
                          </div>
                        </label>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-2 pl-0 sm:pl-6">
                          <input
                            className="cv-input w-full sm:flex-1 sm:min-w-[160px] py-1 px-2 text-[12px]"
                            placeholder="hash / txid de la transacción (opcional)"
                            defaultValue={leg.txHash}
                            onBlur={(e) => updatePlanLeg(plan.id, leg.id, { txHash: e.target.value })}
                          />
                          <label className="cv-btn-ghost text-[11.5px] cursor-pointer text-center w-full sm:w-auto">
                            <Download size={12} className="inline -mt-0.5 mr-1 rotate-180" />Adjuntar soporte
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(plan.id, leg.id, f); e.target.value = ""; }}
                            />
                          </label>
                        </div>

                        {leg.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pl-0 sm:pl-6">
                            {leg.attachments.map((att: any) => (
                              <a key={att.filename} href={att.url} target="_blank" rel="noreferrer" className="text-[11px] rounded px-2 py-1" style={{ background: "var(--panel2)", color: "var(--accent)", border: "1px solid var(--line)" }}>
                                {att.originalName.length > 18 ? att.originalName.slice(0, 15) + "…" : att.originalName}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
