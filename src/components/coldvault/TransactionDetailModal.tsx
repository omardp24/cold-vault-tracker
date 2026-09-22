"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, CreditCard, ExternalLink, X } from "lucide-react";
import { ChainBadge, Movement, fmtAmt, fmtDateTime, fmtUSD } from "./shared";

export interface TxDetailContext {
  wallet: { id: string; label: string; address: string };
  aliadoName: string | null;
  concepto: string;
  isFee: boolean;
  isInternal: boolean;
  internalWithLabel: string | null;
  usd: number | null;
  suspicion: { kind: "fraude" | "polvo"; label: string; reason: string } | null;
  sanctioned: boolean;
  blacklisted: boolean;
  poisoning: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-t" style={{ borderColor: "var(--line)" }}>
      <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--faint)" }}>{label}</div>
      <div className="text-[14px]" style={{ color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

/** Resumen de una operación, al estilo del detalle que muestra Ledger Live al tocar un movimiento. */
export default function TransactionDetailModal({ movement: m, ctx, onClose }: { movement: Movement; ctx: TxDetailContext; onClose: () => void }) {
  const [fee, setFee] = useState<{ fee: number; symbol: string } | null | undefined>(undefined); // undefined = cargando

  useEffect(() => {
    let cancelled = false;
    setFee(undefined);
    fetch(`/api/tx-fee?chain=${m.chain}&txid=${encodeURIComponent(m.txid)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setFee(d.fee != null ? { fee: d.fee, symbol: d.symbol } : null); })
      .catch(() => { if (!cancelled) setFee(null); });
    return () => { cancelled = true; };
  }, [m.chain, m.txid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const label = ctx.isInternal ? "Transferencia interna" : ctx.isFee ? "Comisión de red" : m.direction === "in" ? "Recibido" : "Enviado";
  const color = ctx.isInternal ? "var(--accent)" : ctx.isFee ? "#6B4FBB" : m.direction === "in" ? "var(--pos)" : "var(--neg)";
  const Icon = ctx.isInternal ? ArrowLeftRight : ctx.isFee ? CreditCard : m.direction === "in" ? ArrowDown : ArrowUp;

  const statusText = ctx.suspicion
    ? `${ctx.suspicion.kind === "fraude" ? "🚩" : "🗑"} ${ctx.suspicion.label}`
    : ctx.sanctioned ? "🚫 Contraparte sancionada (OFAC)"
    : ctx.blacklisted ? "🚫 Contraparte en lista negra"
    : ctx.poisoning ? "⚠ Dirección similar a otra que usas"
    : !m.verified ? "⚠ Token no verificado"
    : "Confirmado";
  const statusColor = ctx.suspicion || ctx.sanctioned || ctx.blacklisted ? "var(--neg)" : ctx.poisoning || !m.verified ? "var(--amber)" : "var(--pos)";

  const own = ctx.wallet.address;
  const from = m.direction === "out" ? own : m.counterparty;
  const to = m.direction === "out" ? m.counterparty : own;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Detalle de la operación">
      <div className="cv-pop absolute inset-0" style={{ background: "rgba(3,15,19,.65)", animationDuration: "0.15s" }} onClick={onClose} />
      <div
        className="cv-pop absolute inset-x-0 bottom-0 md:inset-0 md:m-auto flex flex-col overflow-hidden rounded-t-3xl md:rounded-2xl"
        style={{ background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 20px 60px rgba(0,0,0,.5)", maxHeight: "92dvh", height: "min(92dvh, 700px)", maxWidth: 440, width: "100%" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--dim)" }}>Detalle de la operación</span>
          <button className="cv-x" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          <div className="flex flex-col items-center text-center pt-6 pb-2">
            <div className="flex items-center justify-center rounded-2xl mb-3" style={{ width: 56, height: 56, border: `1.5px solid ${color}`, color }}>
              <Icon size={24} strokeWidth={2.25} />
            </div>
            <div className="font-display text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>{label}</div>
            <div className="font-mono text-[28px] font-bold leading-none" style={{ color }}>
              {ctx.isInternal ? "" : m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
            </div>
            {ctx.usd !== null && (
              <div className="text-[13px] mt-1.5" style={{ color: "var(--dim)" }}>
                {m.direction === "out" ? "−" : "+"}{fmtUSD(ctx.usd)} <span title="Valorado al precio actual del activo, no al del día de la operación." style={{ color: "var(--faint)", cursor: "help" }}>ⓘ</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-3 text-[12.5px] font-semibold" style={{ color: statusColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />{statusText}
            </div>
            {ctx.suspicion && <div className="text-[11.5px] mt-1 max-w-[320px]" style={{ color: "var(--dim)" }}>{ctx.suspicion.reason}</div>}
          </div>

          <Row label="Wallet">
            <span className="inline-flex items-center gap-1.5"><ChainBadge chain={m.chain} size={16} />{ctx.wallet.label}</span>
          </Row>
          {ctx.isInternal && ctx.internalWithLabel && <Row label="Hacia tu wallet">{ctx.internalWithLabel}</Row>}
          {!ctx.isInternal && !ctx.isFee && (
            <Row label="Aliado">{ctx.aliadoName || <span style={{ color: "var(--faint)" }}>Sin clasificar</span>}</Row>
          )}
          {!ctx.isInternal && !ctx.isFee && ctx.concepto.trim() && <Row label="Concepto">{ctx.concepto}</Row>}
          <Row label="Fecha">{m.date ? fmtDateTime(m.date) : "pendiente de confirmar"}</Row>
          <Row label="Comisión de red">
            {fee === undefined ? <span style={{ color: "var(--faint)" }}>Consultando…</span>
              : fee === null ? <span style={{ color: "var(--faint)" }}>No disponible</span>
              : <span className="font-mono">{fmtAmt(fee.fee, 8)} {fee.symbol}</span>}
          </Row>
          <Row label="ID de transacción">
            <span className="font-mono text-[12px] break-all" style={{ color: "var(--dim)" }}>{m.txid}</span>
          </Row>
          <Row label="De">
            <span className="font-mono text-[12px] break-all" style={{ color: "var(--dim)" }}>{from || "—"}</span>
          </Row>
          <Row label="Hacia">
            <span className="font-mono text-[12px] break-all" style={{ color: "var(--dim)" }}>{to || "—"}</span>
          </Row>

          <a href={m.explorer} target="_blank" rel="noreferrer" className="cv-btn-ghost w-full justify-center mt-5 inline-flex items-center gap-1.5">
            Ver en el explorador <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
