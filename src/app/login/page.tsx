"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell, { PasswordInput } from "@/components/AuthShell";

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
    <AuthShell>
      <div className="font-display text-xl font-bold mb-1" style={{ color: "var(--ink)" }}>Bienvenido de vuelta</div>
      <div className="text-[12.5px] mb-6" style={{ color: "var(--dim)" }}>Entra con el correo con el que te invitaron.</div>

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Correo</div>
          <input type="email" required autoComplete="email" className="cv-input w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Contraseña</div>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {error && <div role="alert" className="text-xs rounded-lg px-3 py-2 cv-tab-in" style={{ background: "rgba(255,107,90,.12)", border: "1px solid var(--neg)", color: "var(--neg)" }}>{error}</div>}
        <button type="submit" className="cv-btn w-full" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button>
      </form>

      <div className="text-[12px] mt-5 text-center" style={{ color: "var(--dim)" }}>
        ¿Tienes una invitación? <Link href="/signup" className="font-medium" style={{ color: "var(--accent)" }}>Crear cuenta</Link>
      </div>
    </AuthShell>
  );
}
