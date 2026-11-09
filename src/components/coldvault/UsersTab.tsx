"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, HeartPulse, MinusCircle, Plus, RefreshCw, Users } from "lucide-react";
import { ConfirmModal } from "./shared";

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

type Health = {
  config: Record<"smtp" | "push" | "gemini" | "trongrid" | "tronscan" | "cronSecret", boolean>;
  smtpVerified: boolean; smtpError: string | null; lastSnapshotAt: string | null; pushSubscribers: number;
  notifiedMovements: number; watchPrimed: boolean; weeklyReportSentFor: string | null; wallets: number;
};
type Level = "ok" | "warn" | "off";

/** Tarjeta "Estado del sistema": dice en claro qué integraciones funcionan y cuáles están sin configurar. */
function SystemHealth() {
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const load = async () => {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/system-status");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setH(d);
    } catch (e: any) { setErr(e.message || "No se pudo consultar el estado."); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ageH = h?.lastSnapshotAt ? (Date.now() - new Date(h.lastSnapshotAt).getTime()) / 3600_000 : null;
  const rows: { level: Level; title: string; text: string }[] = !h ? [] : [
    h.config.smtp
      ? h.smtpVerified
        ? { level: "ok", title: "Correo", text: "Conectado: los reportes semanal y mensual pueden enviarse." }
        : { level: "warn", title: "Correo", text: `Configurado pero no conecta${h.smtpError ? ` (${h.smtpError})` : ""}. Revisa la contraseña de aplicación de Gmail.` }
      : { level: "warn", title: "Correo", text: "Faltan GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD en Vercel: los reportes por correo NO salen." },
    h.config.push
      ? h.pushSubscribers > 0
        ? { level: "ok", title: "Notificaciones push", text: `Activas en ${h.pushSubscribers} dispositivo${h.pushSubscribers > 1 ? "s" : ""}.` }
        : { level: "warn", title: "Notificaciones push", text: "Configuradas, pero ningún dispositivo está suscrito. Toca la campana 🔔." }
      : { level: "warn", title: "Notificaciones push", text: "Faltan las claves VAPID en Vercel." },
    h.config.gemini ? { level: "ok", title: "Asistente con IA", text: "Clave de Gemini configurada." } : { level: "warn", title: "Asistente con IA", text: "Falta GEMINI_API_KEY en Vercel." },
    h.config.trongrid ? { level: "ok", title: "Lectura de Tron", text: "Clave de TronGrid configurada." } : { level: "warn", title: "Lectura de Tron", text: "Sin TRONGRID_KEY: se pueden dar errores 429 por límite de consultas." },
    ageH === null
      ? { level: "warn", title: "Snapshot diario", text: "Todavía no hay ninguno guardado." }
      : ageH <= 30 ? { level: "ok", title: "Snapshot diario", text: `Último hace ${ageH < 1 ? "menos de 1 h" : `${Math.round(ageH)} h`}.` }
      : { level: "warn", title: "Snapshot diario", text: `El último fue hace ${Math.round(ageH / 24)} días: el cron diario no está corriendo.` },
    h.config.cronSecret ? { level: "ok", title: "Tareas automáticas", text: `CRON_SECRET presente · ${h.notifiedMovements} movimientos ya vistos${h.watchPrimed ? "" : " · vigilante sin iniciar"}.` } : { level: "warn", title: "Tareas automáticas", text: "Falta CRON_SECRET: los crons son rechazados." },
    { level: h.weeklyReportSentFor ? "ok" : "off", title: "Reporte semanal", text: h.weeklyReportSentFor ? `Último enviado el ${h.weeklyReportSentFor}.` : "Aún no se ha enviado ninguno (sale los viernes por la tarde)." },
    { level: h.config.tronscan ? "ok" : "off", title: "Tronscan (opcional)", text: h.config.tronscan ? "Verificación de fraude activa." : "Sin TRONSCAN_KEY: la auditoría omite la lista de fraude de Tronscan." },
  ];
  const warnings = rows.filter((r) => r.level === "warn").length;

  return (
    <div className="cv-card cv-card-hover p-5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2"><HeartPulse size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Estado del sistema</div>
          {h && <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5" style={{ background: warnings ? "rgba(255,107,90,.14)" : "rgba(62,213,152,.14)", color: warnings ? "var(--neg)" : "var(--pos)" }}>{warnings ? `${warnings} por revisar` : "todo en orden"}</span>}
        </div>
        <button className="cv-btn-ghost cv-icon-btn" onClick={load} disabled={loading}><RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Revisar</button>
      </div>
      {err && <div className="text-[12px]" style={{ color: "var(--neg)" }}>{err}</div>}
      {!h && !err && <div className="space-y-2">{[0, 1, 2, 3].map((i) => <span key={i} className="cv-skeleton block" style={{ height: 38, width: "100%" }} />)}</div>}
      <div className="cv-stagger space-y-1.5">
        {rows.map((r) => (
          <div key={r.title} className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "var(--panel2)" }}>
            <span className="mt-0.5 flex-shrink-0" style={{ color: r.level === "ok" ? "var(--pos)" : r.level === "warn" ? "var(--amber)" : "var(--faint)" }}>
              {r.level === "ok" ? <CheckCircle2 size={15} /> : r.level === "warn" ? <AlertTriangle size={15} /> : <MinusCircle size={15} />}
            </span>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: "var(--ink)" }}>{r.title}</div>
              <div className="text-[11.5px] leading-snug" style={{ color: "var(--dim)" }}>{r.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    await fetch(`/api/users/${revokeTarget.id}`, { method: "DELETE" });
    setRevokeTarget(null);
    loadUsers();
  };

  return (
    <>
      <SystemHealth />
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
                <button className="cv-btn-ghost" onClick={() => setRevokeTarget({ id: u.id, name: u.name })}>Quitar acceso</button>
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

      <ConfirmModal
        open={!!revokeTarget} title="Quitar acceso"
        description={revokeTarget ? `${revokeTarget.name} ya no podrá entrar a Cold Vault.` : undefined}
        confirmLabel="Quitar acceso" danger
        onCancel={() => setRevokeTarget(null)} onConfirm={confirmRevoke}
      />
    </>
  );
}
