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
                    <button key={m.key} className="cv-row w-full text-left px-3.5 py-2" onMouseDown={() => pick(() => onSelectMovement(m))}>
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
