"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell, { PasswordInput } from "@/components/AuthShell";

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
    <AuthShell>
        <div className="font-display text-xl font-bold mb-1" style={{ color: "var(--ink)" }}>Crear cuenta</div>
        <div className="text-[12.5px] mb-6" style={{ color: "var(--dim)" }}>
          {hasAnyUser === false ? "Primera vez: esta cuenta será la propietaria de la herramienta." : "Crear cuenta con invitación."}
        </div>

        {initError ? (
          <div className="text-xs rounded-lg p-3" style={{ background: "rgba(255,107,90,.14)", border: "1px solid var(--neg)", color: "var(--neg)" }}>
            No se pudo conectar: {initError}
            <div className="mt-1" style={{ color: "var(--dim)" }}>Revisa que <span className="font-addr">SUPABASE_URL</span> y <span className="font-addr">SUPABASE_SERVICE_ROLE_KEY</span> estén configurados.</div>
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
              <PasswordInput value={password} onChange={setPassword} minLength={8} autoComplete="new-password" />
            </div>
            {hasAnyUser && (
              <div>
                <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Código de invitación</div>
                <input required className="cv-input w-full font-addr" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} />
              </div>
            )}
            {error && <div className="text-xs" style={{ color: "var(--neg)" }}>{error}</div>}
            <button type="submit" className="cv-btn w-full" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</button>
          </form>
        )}

        <div className="text-[12px] mt-4 text-center" style={{ color: "var(--dim)" }}>
          ¿Ya tienes cuenta? <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>Entrar</Link>
        </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
