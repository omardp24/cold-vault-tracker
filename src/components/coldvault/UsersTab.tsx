"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, MinusCircle, Plus, RefreshCw, UserMinus } from "lucide-react";
import { APP_TZ } from "@/lib/format";
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

type AdminView = "equipo" | "sistema" | "actividad";

/** Traduce la respuesta de /api/system-status a filas legibles: qué funciona y qué falta configurar. */
function healthRows(h: Health): { level: Level; title: string; text: string }[] {
  const ageH = h.lastSnapshotAt ? (Date.now() - new Date(h.lastSnapshotAt).getTime()) / 3600_000 : null;
  return [
    h.config.smtp
      ? h.smtpVerified
        ? { level: "ok", title: "Correo", text: "Conectado: los reportes semanal y mensual pueden enviarse." }
        : { level: "warn", title: "Correo", text: `Configurado pero no conecta${h.smtpError ? ` (${h.smtpError})` : ""}. Revisa la contraseña de aplicación de Gmail.` }
      : { level: "warn", title: "Correo", text: "Faltan GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD en Vercel: los reportes por correo NO salen." },
    h.config.push
      ? h.pushSubscribers > 0
        ? { level: "ok", title: "Notificaciones push", text: `Activas en ${h.pushSubscribers} dispositivo${h.pushSubscribers > 1 ? "s" : ""}.` }
        : { level: "warn", title: "Notificaciones push", text: "Configuradas, pero ningún dispositivo está suscrito. Toca la campana." }
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
}

const LEVEL_STYLE: Record<Level, { color: string; bg: string }> = {
  ok: { color: "var(--pos)", bg: "rgba(62,213,152,.14)" },
  warn: { color: "var(--amber)", bg: "var(--tint)" },
  off: { color: "var(--faint)", bg: "var(--panel2)" },
};
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("es-VE", { weekday: "short", day: "numeric", month: "short", timeZone: APP_TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: APP_TZ });

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--tint)", color: "var(--accent)" }}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function UsersTab({ currentUser }: { currentUser: { id: string; name: string; role: "owner" | "member" } }) {
  const [view, setView] = useState<AdminView>("equipo");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [invitesList, setInvitesList] = useState<any[]>([]);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [lastInviteCode, setLastInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthErr, setHealthErr] = useState("");
  const loadHealth = async () => {
    setHealthLoading(true); setHealthErr("");
    try {
      const res = await fetch("/api/system-status");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setHealth(d);
    } catch (e: any) { setHealthErr(e.message || "No se pudo consultar el estado."); }
    setHealthLoading(false);
  };

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

  useEffect(() => { loadUsers(); loadAuditLog(); loadHealth(); }, []);

  const generateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/users", { method: "POST" });
      const d = await res.json();
      if (res.ok) { setLastInviteCode(d.code); setCopied(false); loadUsers(); }
    } catch {}
    setGeneratingInvite(false);
  };
  const inviteLink = lastInviteCode && typeof window !== "undefined" ? `${window.location.origin}/signup?code=${lastInviteCode}` : "";
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin permiso del portapapeles */ }
  };

  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    await fetch(`/api/users/${revokeTarget.id}`, { method: "DELETE" });
    setRevokeTarget(null);
    loadUsers();
  };

  const rows = health ? healthRows(health) : [];
  const warnRows = rows.filter((r) => r.level === "warn");
  const restRows = rows.filter((r) => r.level !== "warn");
  const okCount = rows.filter((r) => r.level === "ok").length;

  // Bitácora agrupada por día (hora de Caracas).
  const logDays: { label: string; items: any[] }[] = [];
  auditLog.forEach((e) => {
    const label = dayOf(e.created_at);
    const last = logDays[logDays.length - 1];
    if (last && last.label === label) last.items.push(e); else logDays.push({ label, items: [e] });
  });

  const healthRow = (r: { level: Level; title: string; text: string }) => (
    <div key={r.title} className="flex items-start gap-3 py-3 border-t" style={{ borderColor: "var(--line)" }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: LEVEL_STYLE[r.level].bg, color: LEVEL_STYLE[r.level].color }}>
        {r.level === "ok" ? <CheckCircle2 size={15} /> : r.level === "warn" ? <AlertTriangle size={15} /> : <MinusCircle size={15} />}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{r.title}</div>
        <div className="text-[12px] leading-snug" style={{ color: "var(--dim)" }}>{r.text}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-display text-[15px] font-semibold">Usuarios y sistema</div>
        {health && (
          <button className="cv-tag" style={{ padding: "5px 11px", cursor: "pointer", border: "none", background: warnRows.length ? "var(--tint)" : "rgba(62,213,152,.14)", color: warnRows.length ? "var(--amber)" : "var(--pos)" }} onClick={() => setView("sistema")}>
            {warnRows.length ? <><AlertTriangle size={11} /> {warnRows.length} por revisar</> : <><CheckCircle2 size={11} /> Sistema en orden</>}
          </button>
        )}
      </div>
      <div className="mb-4">
        <div className="cv-subtabs" role="tablist" style={{ width: "fit-content" }}>
          {([["equipo", "Equipo", usersList.length || null], ["sistema", "Sistema", warnRows.length || null], ["actividad", "Actividad", null]] as [AdminView, string, number | null][]).map(([id, label, count]) => (
            <button key={id} role="tab" aria-selected={view === id} className="cv-subtab" data-active={view === id} onClick={() => setView(id)}>
              {label}{count !== null && <span className="cv-subtab-count">{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ============ EQUIPO ============ */}
      {view === "equipo" && (
        <div className="cv-tab-in grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3 sm:gap-4 items-start">
          <div className="cv-card p-4 sm:p-5">
            <div className="font-display text-sm font-semibold mb-1">Con acceso</div>
            <div className="cv-daylist">
              {usersList.length === 0 && <span className="cv-skeleton block mt-2" style={{ height: 48 }} />}
              {usersList.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 py-3 border-t" style={{ borderColor: "var(--line)" }}>
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13.5px] font-semibold truncate" style={{ color: "var(--ink)" }}>{u.name}</span>
                      {u.id === currentUser.id && <span className="cv-tag flex-shrink-0" style={{ background: "var(--panel2)", color: "var(--dim)" }}>tú</span>}
                    </div>
                    <div className="text-[11.5px] truncate" style={{ color: "var(--dim)" }}>{u.email}</div>
                  </div>
                  <span className="cv-tag flex-shrink-0" style={u.role === "owner" ? { background: "var(--tint)", color: "var(--accent)" } : { background: "var(--panel2)", color: "var(--dim)" }}>{u.role === "owner" ? "propietario" : "miembro"}</span>
                  {u.id !== currentUser.id && (
                    <button className="cv-x flex-shrink-0" onClick={() => setRevokeTarget({ id: u.id, name: u.name })} title={`Quitar acceso a ${u.name}`} aria-label={`Quitar acceso a ${u.name}`}><UserMinus size={16} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="cv-card p-4 sm:p-5">
            <div className="font-display text-sm font-semibold mb-1">Invitar a alguien</div>
            <div className="text-[12px] mb-3" style={{ color: "var(--dim)" }}>
              El código vale 7 días y un solo uso. La persona lo usa en «Crear cuenta» y pone su propia contraseña: nunca compartes ninguna clave.
            </div>
            <button className="cv-btn w-full inline-flex items-center justify-center gap-1.5" onClick={generateInvite} disabled={generatingInvite}>
              <Plus size={14} /> {generatingInvite ? "Generando…" : "Generar código de invitación"}
            </button>
            {lastInviteCode && (
              <div className="mt-3 rounded-xl p-3.5 cv-tab-in" style={{ background: "rgba(62,213,152,.12)", border: "1px solid var(--pos)" }}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--dim)" }}>Código nuevo</div>
                <div className="font-mono text-[20px] font-semibold tracking-wide" style={{ color: "var(--pos)" }}>{lastInviteCode}</div>
                <div className="font-addr text-[11px] mt-1.5 break-all" style={{ color: "var(--dim)" }}>{inviteLink}</div>
                <button className="cv-btn-ghost cv-icon-btn mt-2.5" onClick={copyInvite}>{copied ? <><Check size={13} /> ¡Enlace copiado!</> : <><Copy size={13} /> Copiar enlace</>}</button>
              </div>
            )}
            {invitesList.length > 0 && (
              <div className="mt-4">
                <div className="text-[10.5px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--faint)" }}>Invitaciones generadas</div>
                <div className="cv-daylist">
                  {invitesList.map((inv: any) => {
                    const st = inv.usedBy ? { t: "usada", c: "var(--pos)", b: "rgba(62,213,152,.14)" } : Date.now() > inv.expiresAt ? { t: "expirada", c: "var(--neg)", b: "rgba(255,107,90,.14)" } : { t: "pendiente", c: "var(--amber)", b: "var(--tint)" };
                    return (
                      <div key={inv.code} className="flex items-center justify-between gap-3 py-2 border-t" style={{ borderColor: "var(--line)" }}>
                        <span className="font-addr text-[12.5px] truncate" style={{ color: "var(--ink)" }}>{inv.code}</span>
                        <span className="cv-tag flex-shrink-0" style={{ background: st.b, color: st.c }}>{st.t}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ SISTEMA ============ */}
      {view === "sistema" && (
        <div className="cv-tab-in">
          <div className="cv-card p-4 sm:p-5 mb-3 sm:mb-4 flex items-center gap-3.5">
            <span className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: warnRows.length ? "var(--tint)" : "rgba(62,213,152,.14)", color: warnRows.length ? "var(--amber)" : "var(--pos)" }}>
              {warnRows.length ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[17px] font-bold leading-tight" style={{ color: "var(--ink)" }}>
                {!health ? (healthErr ? "No se pudo consultar" : "Revisando…") : warnRows.length ? `${warnRows.length} integraci${warnRows.length > 1 ? "ones" : "ón"} por revisar` : "Todo en orden"}
              </div>
              <div className="text-[12px]" style={{ color: "var(--dim)" }}>{health ? `${okCount} de ${rows.length} funcionando` : healthErr || "Consultando el estado de las integraciones."}</div>
            </div>
            <button className="cv-btn-ghost cv-icon-btn flex-shrink-0" onClick={loadHealth} disabled={healthLoading}><RefreshCw size={13} className={healthLoading ? "animate-spin" : ""} /> <span className="hidden sm:inline">Revisar</span></button>
          </div>
          {!health && !healthErr && <div className="cv-card p-4 sm:p-5 space-y-2">{[0, 1, 2, 3].map((i) => <span key={i} className="cv-skeleton block" style={{ height: 40, width: "100%" }} />)}</div>}
          {health && (
            <div className={`grid grid-cols-1 gap-3 sm:gap-4 items-start ${warnRows.length ? "lg:grid-cols-2" : ""}`}>
              {warnRows.length > 0 && (
                <div className="cv-card p-4 sm:p-5">
                  <div className="font-display text-sm font-semibold mb-1">Por revisar</div>
                  <div className="cv-daylist">{warnRows.map(healthRow)}</div>
                </div>
              )}
              <div className="cv-card p-4 sm:p-5">
                <div className="font-display text-sm font-semibold mb-1">{warnRows.length ? "En orden u opcional" : "Integraciones"}</div>
                <div className="cv-daylist">{restRows.map(healthRow)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ ACTIVIDAD ============ */}
      {view === "actividad" && (
        <div className="cv-tab-in">
          {auditLog.length === 0 ? (
            <div className="cv-card p-8 text-center text-[12.5px]" style={{ color: "var(--dim)" }}>Sin actividad registrada todavía.</div>
          ) : (
            logDays.map((g) => (
              <div key={g.label} className="mb-3">
                <div className="flex items-center gap-2 px-1 mb-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>{g.label}</span>
                  <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
                </div>
                <div className="cv-card px-3.5 sm:px-5 cv-daylist">
                  {g.items.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 py-2.5 border-t" style={{ borderColor: "var(--line)" }}>
                      <Avatar name={entry.user_name} size={28} />
                      <div className="min-w-0 flex-1 text-[12.5px]">
                        <span className="font-semibold" style={{ color: "var(--ink)" }}>{entry.user_name}</span>
                        <span style={{ color: "var(--dim)" }}> · {(ACTION_LABELS[entry.action]?.(entry.detail)) || entry.action}</span>
                      </div>
                      <span className="flex-shrink-0 font-mono text-[11px] pt-0.5" style={{ color: "var(--faint)" }}>{timeOf(entry.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ConfirmModal
        open={!!revokeTarget} title="Quitar acceso"
        description={revokeTarget ? `${revokeTarget.name} ya no podrá entrar a Cold Vault.` : undefined}
        confirmLabel="Quitar acceso" danger
        onCancel={() => setRevokeTarget(null)} onConfirm={confirmRevoke}
      />
    </>
  );
}
