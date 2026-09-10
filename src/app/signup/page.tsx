"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [hasAnyUser, setHasAnyUser] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(params.get("code") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [initError, setInitError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `Error ${r.status} al conectar con el servidor.`);
        setHasAnyUser(d.hasAnyUser);
      })
      .catch((e) => setInitError(e.message || "No se pudo conectar con el servidor."));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode: hasAnyUser ? inviteCode : undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo crear la cuenta.");
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
          <div className="font-display text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>Crear cuenta</div>
          <div className="text-[12px] mb-6" style={{ color: "var(--dim)" }}>
            {hasAnyUser === false ? "Primera vez: esta cuenta será la propietaria de la herramienta." : "Crear cuenta con invitación."}
          </div>

          {initError ? (
            <div className="text-xs rounded-lg p-3" style={{ background: "rgba(255,107,90,.14)", border: "1px solid var(--neg)", color: "var(--neg)" }}>
              No se pudo conectar: {initError}
              <div className="mt-1" style={{ color: "var(--dim)" }}>Revisa que <span className="font-mono">SUPABASE_URL</span> y <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> estén configurados.</div>
            </div>
          ) : hasAnyUser === null ? (
            <div className="text-sm" style={{ color: "var(--dim)" }}>Cargando…</div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Nombre</div>
                <input required className="cv-input w-full" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Correo</div>
                <input type="email" required className="cv-input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Contraseña (mínimo 8 caracteres)</div>
                <input type="password" required minLength={8} className="cv-input w-full" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {hasAnyUser && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Código de invitación</div>
                  <input required className="cv-input w-full font-mono" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
                </div>
              )}
              {error && <div className="text-xs" style={{ color: "var(--neg)" }}>{error}</div>}
              <button type="submit" className="cv-btn w-full" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</button>
            </form>
          )}

          <div className="text-[12px] mt-4 text-center" style={{ color: "var(--dim)" }}>
            ¿Ya tienes cuenta? <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>Entrar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
