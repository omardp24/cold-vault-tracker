"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo iniciar sesión.");
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 cv-safe-top" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden cv-fade-in" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="hidden md:flex flex-col justify-between p-9" style={{ background: "var(--panel2)" }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(140deg, var(--accent), var(--amber))", boxShadow: "var(--glow)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--panel)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
              <circle cx="12" cy="11" r="2.2" />
              <path d="M12 13.2V15.6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-2xl font-bold leading-tight" style={{ color: "var(--ink)" }}>
              Todo tu frío,<br />en un solo tablero.
            </div>
            <div className="text-[13px] mt-3 leading-relaxed" style={{ color: "var(--dim)" }}>
              Portafolio, movimientos, auditoría de direcciones y planes de transferencia — leídos en vivo desde tus direcciones públicas de Ledger.
            </div>
          </div>
          <div className="text-[11px]" style={{ color: "var(--faint)" }}>Cold Vault · CAD Venezuela</div>
        </div>

        <div className="p-7 sm:p-9" style={{ background: "var(--panel)" }}>
          <div className="font-display text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>Entrar</div>
          <div className="text-[12px] mb-6" style={{ color: "var(--dim)" }}>Usa el correo con el que te invitaron.</div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Correo</div>
              <input type="email" required className="cv-input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Contraseña</div>
              <input type="password" required className="cv-input w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-xs" style={{ color: "var(--neg)" }}>{error}</div>}
            <button type="submit" className="cv-btn w-full" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
          </form>

          <div className="text-[12px] mt-4 text-center" style={{ color: "var(--dim)" }}>
            ¿Tienes una invitación? <Link href="/signup" className="font-medium" style={{ color: "var(--accent)" }}>Crear cuenta</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
