"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { ChainBadge } from "./coldvault/shared";

// Carcasa compartida de login y registro: fondo animado (orbes + rejilla), panel de marca con las
// ventajas de la app y, a la derecha, el formulario que cada página le pasa como hijo.

function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="cv-logo-ring" />
      <div className="relative w-full h-full rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))", boxShadow: "var(--glow)" }}>
        <svg width={size * 0.46} height={size * 0.46} viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
          <circle cx="12" cy="11" r="2.2" />
          <path d="M12 13.2V15.6" />
        </svg>
      </div>
    </div>
  );
}

const FEATURES = [
  { Icon: Wallet, title: "Saldos en vivo", text: "Bitcoin, Ethereum y Tron leídos desde tus direcciones públicas." },
  { Icon: ShieldCheck, title: "Auditoría de direcciones", text: "Sanciones OFAC, listas de fraude y direcciones que imitan a las tuyas." },
  { Icon: Sparkles, title: "Asistente con IA", text: "Clasifica movimientos, resume la semana y prepara estados de cuenta." },
  { Icon: Lock, title: "Solo lectura", text: "Nunca pide ni guarda claves privadas ni frases semilla." },
];

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="cv-auth min-h-screen flex items-center justify-center px-4 py-8 cv-safe-top" style={{ background: "var(--bg)" }}>
      <div className="cv-auth-grid" />
      <span className="cv-orb cv-orb-1" /><span className="cv-orb cv-orb-2" /><span className="cv-orb cv-orb-3" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Marca compacta: solo en móvil, donde el panel lateral no cabe */}
        <div className="md:hidden flex flex-col items-center text-center mb-6 cv-tab-in">
          <Logo size={52} />
          <div className="font-display text-xl font-bold mt-3" style={{ color: "var(--ink)" }}>Cold Vault</div>
          <div className="text-[12px] mt-1" style={{ color: "var(--dim)" }}>Todo tu frío, en un solo tablero.</div>
        </div>

        <div className="cv-auth-card grid grid-cols-1 md:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden cv-tab-in" style={{ boxShadow: "0 24px 70px rgba(0,0,0,0.4)", border: "1px solid var(--line)" }}>
          <div className="hidden md:flex flex-col justify-between gap-9 p-10 md:min-h-[560px]" style={{ background: "color-mix(in srgb, var(--panel2) 88%, transparent)" }}>
            <Logo />
            <div className="cv-stagger">
              <div className="font-display text-[28px] font-extrabold leading-[1.15]" style={{ color: "var(--ink)" }}>
                Todo tu frío,<br /><span className="cv-shine">en un solo tablero.</span>
              </div>
              <ul className="mt-6 space-y-3.5">
                {FEATURES.map(({ Icon, title, text }) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--tint)", color: "var(--accent)" }}><Icon size={16} strokeWidth={2.2} /></span>
                    <span>
                      <span className="block text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{title}</span>
                      <span className="block text-[12px] leading-snug" style={{ color: "var(--dim)" }}>{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[11px]" style={{ color: "var(--faint)" }}>Cold Vault · CAD Venezuela</div>
              <div className="flex -space-x-1.5">
                {(["BTC", "ETH", "TRON"] as const).map((c, i) => (
                  <span key={c} className="cv-bob rounded-full" style={{ animationDelay: `${i * 0.5}s`, border: "2px solid var(--panel2)" }}><ChainBadge chain={c} size={24} /></span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-7 sm:p-10" style={{ background: "color-mix(in srgb, var(--panel) 92%, transparent)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Campo de contraseña con botón para mostrar/ocultar (útil en el teléfono, donde es fácil equivocarse al teclear). */
export function PasswordInput({ value, onChange, minLength, autoComplete }: { value: string; onChange: (v: string) => void; minLength?: number; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete}
        className="cv-input w-full" style={{ paddingRight: 44 }} value={value} onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "none", border: "none", color: "var(--faint)", cursor: "pointer" }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
