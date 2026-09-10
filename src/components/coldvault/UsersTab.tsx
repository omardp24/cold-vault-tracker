"use client";

import { useEffect, useState } from "react";
import { Activity, Plus, Users } from "lucide-react";

const ACTION_LABELS: Record<string, (detail: any) => string> = {
  "wallet.create": (d) => `Añadió la wallet "${d?.label}" (${d?.chain})`,
  "wallet.delete": (d) => `Eliminó la wallet "${d?.label}" (${d?.chain})`,
  "aliado.create": (d) => `Creó el aliado "${d?.name}"`,
  "aliado.delete": (d) => `Eliminó el aliado "${d?.name}"`,
  "classification.set": (d) => `Clasificó un movimiento${d?.concepto ? `: "${d.concepto}"` : ""}`,
  "classification.batch": (d) => `Clasificó ${d?.count} movimientos en lote`,
  "user.invite": () => `Generó un código de invitación`,
  "user.revoke": (d) => `Quitó el acceso a ${d?.name} (${d?.email})`,
  "plan.create": (d) => `Creó un plan de transferencia hacia ${d?.destination?.slice?.(0, 10)}…`,
  "plan.delete": (d) => `Eliminó un plan de transferencia`,
};

export default function UsersTab({ currentUser }: { currentUser: { id: string; name: string; role: "owner" | "member" } }) {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<any[]>([]);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState("");
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const loadUsers = async () => {
    const res = await fetch("/api/users");
    const d = await res.json();
    if (res.ok) { setUsersList(d.users); setInvitesList(d.invites); }
  };

  const loadAuditLog = async () => {
    const res = await fetch("/api/audit-log");
    const d = await res.json();
    if (res.ok) setAuditLog(d);
  };

  useEffect(() => { loadUsers(); loadAuditLog(); }, []);

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/users", { method: "POST" });
      const d = await res.json();
      if (res.ok) { setLastInviteCode(d.code); loadUsers(); }
    } catch {}
    setGeneratingInvite(false);
  };

  const revokeUser = async (id: string) => {
    if (!window.confirm("¿Quitarle el acceso a esta persona?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    loadUsers();
  };

  return (
    <>
      <div className="cv-card cv-card-hover p-5 mb-4">
        <div className="flex items-center gap-2 mb-1"><Plus size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Invitar a alguien</div></div>
        <div className="text-[11.5px] mb-3" style={{ color: "var(--dim)" }}>
          Genera un código de invitación (válido 7 días, un solo uso) y compárteselo por el medio que prefieras. La persona lo usa en la página de "Crear cuenta" para poner su propia contraseña — tú nunca tienes que compartir ninguna clave.
        </div>
        <button className="cv-btn" onClick={generateInvite} disabled={generatingInvite}>
          {generatingInvite ? "Generando…" : (<><Plus size={14} className="inline -mt-0.5 mr-1" />Generar código de invitación</>)}
        </button>
        {lastInviteCode && (
          <div className="mt-3 rounded-lg p-3" style={{ background: "rgba(62,213,152,.14)", border: "1px solid var(--pos)" }}>
            <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--dim)" }}>Código nuevo</div>
            <div className="font-mono text-lg font-semibold" style={{ color: "var(--pos)" }}>{lastInviteCode}</div>
            <div className="text-[11px] mt-1 break-all" style={{ color: "var(--dim)" }}>
              Enlace directo: {typeof window !== "undefined" ? `${window.location.origin}/signup?code=${lastInviteCode}` : ""}
            </div>
          </div>
        )}

        {invitesList.length > 0 && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
            <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--dim)" }}>Invitaciones generadas</div>
            {invitesList.map((inv: any) => (
              <div key={inv.code} className="flex items-center justify-between text-[12px] py-1">
                <span className="font-mono">{inv.code}</span>
                <span style={{ color: inv.usedBy ? "var(--pos)" : Date.now() > inv.expiresAt ? "var(--neg)" : "var(--dim)" }}>
                  {inv.usedBy ? "✓ usada" : Date.now() > inv.expiresAt ? "✕ expirada" : "pendiente"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cv-card cv-card-hover p-5">
        <div className="flex items-center gap-2 mb-3"><Users size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Con acceso</div></div>
        <div className="space-y-2">
          {usersList.map((u: any) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg p-3" style={{ background: "var(--panel2)" }}>
              <div>
                <div className="text-sm font-medium">{u.name} {u.id === currentUser.id && <span style={{ color: "var(--dim)" }}>(tú)</span>}</div>
                <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>{u.email} · {u.role === "owner" ? "propietario" : "miembro"}</div>
              </div>
              {u.id !== currentUser.id && (
                <button className="cv-btn-ghost" onClick={() => revokeUser(u.id)}>Quitar acceso</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="cv-card cv-card-hover p-5 mt-4">
        <div className="flex items-center gap-2 mb-3"><Activity size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Actividad reciente</div></div>
        {auditLog.length === 0 ? (
          <div className="text-[12.5px]" style={{ color: "var(--dim)" }}>Sin actividad registrada todavía.</div>
        ) : (
          <div className="space-y-2">
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 text-[12.5px] py-1.5 border-t" style={{ borderColor: "var(--line)" }}>
                <div>
                  <span className="font-medium" style={{ color: "var(--ink)" }}>{entry.user_name}</span>
                  <span style={{ color: "var(--dim)" }}> · {(ACTION_LABELS[entry.action]?.(entry.detail)) || entry.action}</span>
                </div>
                <span className="flex-shrink-0 text-[11px]" style={{ color: "var(--faint)" }}>
                  {new Date(entry.created_at).toLocaleString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
