"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, Check, ChevronDown, Download, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import type { AssistantAction, ClassifyItem } from "@/lib/assistantActions";

interface Msg { role: "user" | "assistant"; text: string; ts: number; tools?: string[]; error?: boolean; actions?: AssistantAction[] }
export interface AppliedClassification { key: string; aliadoId: string | null; concepto: string; isFee: boolean }

const TOOL_LABEL: Record<string, string> = {
  resumen_portafolio: "portafolio", listar_aliados: "aliados", listar_movimientos: "movimientos",
  detectar_polvo_y_fraude: "polvo y fraude", auditar_direccion: "auditoría de dirección", auditar_pendientes: "auditoría de pendientes",
  sugerir_clasificaciones: "clasificación automática", preparar_clasificacion: "clasificación", preparar_estado_de_cuenta: "estado de cuenta",
};

const QUICK = [
  "Clasifica mis movimientos pendientes",
  "Resumen de la última semana",
  "Audita mis movimientos pendientes",
  "Detecta transferencias de polvo y fraudes",
  "Estado de cuenta del mes pasado",
];

// Renderizador mínimo (negritas, código, listas) sin dangerouslySetInnerHTML: el texto de la IA nunca se inyecta como HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="font-mono text-[11.5px] px-1 rounded" style={{ background: "var(--panel)" }}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (/^\s*-{3,}\s*$/.test(line)) return <hr key={i} style={{ borderColor: "var(--line)" }} />;
        const heading = /^\s*#{1,4}\s+(.*)$/.exec(line);
        if (heading) return <div key={i} className="font-display font-semibold text-[13.5px] pt-1">{inline(heading[1])}</div>;
        if (bullet) return <div key={i} className="flex gap-2"><span style={{ color: "var(--accent)" }}>•</span><span>{inline(bullet[1])}</span></div>;
        if (num) return <div key={i} className="flex gap-2"><span className="font-mono text-[11.5px]" style={{ color: "var(--accent)" }}>{num[1]}.</span><span>{inline(num[2])}</span></div>;
        return <div key={i}>{inline(line)}</div>;
      })}
    </div>
  );
}

type ActionOutcome = { kind: "done" | "discarded"; text: string };

function ClassifyCard({ action, outcome, onResolve, onApplied }: {
  action: Extract<AssistantAction, { type: "clasificar" }>; outcome?: ActionOutcome;
  onResolve: (o: ActionOutcome) => void; onApplied: (a: AppliedClassification[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(action.items.filter((i) => !(i.fuente === "ia" && i.confianza !== "alta")).map((i) => i.key))); // las de IA con confianza media empiezan sin marcar
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const apply = async () => {
    const items = action.items.filter((i: ClassifyItem) => picked.has(i.key)).map((i) => ({ key: i.key, aliadoId: i.aliadoId, concepto: i.concepto, isFee: i.isFee }));
    if (items.length === 0) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/classifications/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      onApplied(d.applied || []);
      onResolve({ kind: "done", text: `✓ Se aplicaron ${d.applied?.length ?? items.length} clasificaciones${d.skipped ? ` (${d.skipped} omitidas)` : ""}.` });
    } catch (e: any) { setErr(e.message || "No se pudo guardar."); }
    setBusy(false);
  };
  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--accent)", background: "var(--panel)" }}>
      <div className="px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5" style={{ background: "var(--panel2)" }}><Check size={13} style={{ color: "var(--accent)" }} />{action.titulo}</div>
      {outcome ? <div className="px-3 py-2.5 text-[12px]" style={{ color: outcome.kind === "done" ? "var(--pos)" : "var(--dim)" }}>{outcome.text}</div> : (
        <>
          <div className="max-h-[260px] overflow-y-auto divide-y" style={{ borderColor: "var(--line)" }}>
            {action.items.map((i) => (
              <label key={i.key} className="flex gap-2 px-3 py-2 cursor-pointer text-[12px]" style={{ borderColor: "var(--line)" }}>
                <input type="checkbox" checked={picked.has(i.key)} onChange={() => toggle(i.key)} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block"><strong>{i.aliado}</strong>{i.concepto ? <> · {i.concepto}</> : null}
                    {i.confianza && <span className="ml-1.5 whitespace-nowrap text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: i.confianza === "alta" ? "rgba(80,180,120,.18)" : "rgba(220,170,60,.18)", color: "var(--dim)" }}>{i.fuente === "historial" ? "historial" : "IA"} · {i.confianza}</span>}
                  </span>
                  <span className="block text-[11px] break-words" style={{ color: "var(--faint)" }}>{i.detalle}</span>
                  {i.razon && <span className="block text-[10.5px] italic" style={{ color: "var(--faint)" }}>{i.razon}</span>}
                </span>
              </label>
            ))}
          </div>
          {err && <div className="px-3 py-1.5 text-[11.5px]" style={{ color: "var(--neg)" }}>{err}</div>}
          <div className="flex gap-2 p-2.5 border-t" style={{ borderColor: "var(--line)" }}>
            <button className="cv-btn flex-1" disabled={busy || picked.size === 0} onClick={apply}>{busy ? "Guardando…" : `Aplicar ${picked.size}`}</button>
            <button className="cv-btn-ghost" disabled={busy} onClick={() => onResolve({ kind: "discarded", text: "Descartado, no se guardó nada." })}>Descartar</button>
          </div>
        </>
      )}
    </div>
  );
}

function StatementCard({ action }: { action: Extract<AssistantAction, { type: "estado_cuenta" }> }) {
  const [busy, setBusy] = useState<"pdf" | "excel" | null>(null);
  const [err, setErr] = useState("");
  const download = async (format: "pdf" | "excel") => {
    setBusy(format); setErr("");
    try {
      const res = await fetch("/api/statement/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ desde: action.desde, hasta: action.hasta, aliadoId: action.aliadoId, format }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Error ${res.status}`); }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `estado_cuenta_${action.desde}_${action.hasta}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e: any) { setErr(e.message || "No se pudo generar."); }
    setBusy(null);
  };
  return (
    <div className="mt-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--accent)", background: "var(--panel)" }}>
      <div className="px-3 py-2 text-[12px] font-semibold flex items-center gap-1.5" style={{ background: "var(--panel2)" }}><Download size={13} style={{ color: "var(--accent)" }} />{action.titulo}</div>
      <div className="flex gap-2 p-2.5">
        <button className="cv-btn flex-1" disabled={!!busy} onClick={() => download("pdf")}>{busy === "pdf" ? "Generando…" : "Descargar PDF"}</button>
        <button className="cv-btn-ghost flex-1" disabled={!!busy} onClick={() => download("excel")}>{busy === "excel" ? "Generando…" : "Excel"}</button>
      </div>
      {err && <div className="px-3 pb-2 text-[11.5px]" style={{ color: "var(--neg)" }}>{err}</div>}
    </div>
  );
}

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

function Avatar({ size = 30, online = false }: { size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: "linear-gradient(135deg, var(--accent), #ffb15e)", color: "#fff" }}>
      <Bot size={Math.round(size * 0.55)} strokeWidth={2.2} />
      {online && <span className="absolute -right-0.5 -bottom-0.5 rounded-full" style={{ width: Math.round(size * 0.3), height: Math.round(size * 0.3), background: "var(--pos)", border: "2px solid var(--panel)" }} />}
    </span>
  );
}

function Typing() {
  return (
    <div className="flex items-end gap-2">
      <Avatar size={26} />
      <div className="rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1" style={{ background: "var(--panel)", border: "1px solid var(--line)" }} aria-label="El asistente está escribiendo">
        {[0, 1, 2].map((d) => <span key={d} className="cv-dot" style={{ animationDelay: `${d * 0.16}s` }} />)}
      </div>
    </div>
  );
}

export default function AssistantPanel({ onClassificationsApplied }: { onClassificationsApplied?: (applied: AppliedClassification[]) => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Globo de invitación ("¿Necesitas ayuda?") una sola vez por sesión, como en un chat de soporte.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("cv-assistant-teaser") === "1"; } catch { /* sin almacenamiento */ }
    if (seen) return;
    const show = setTimeout(() => setTeaser(true), 2500);
    const hide = setTimeout(() => setTeaser(false), 12000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);
  const dismissTeaser = () => { setTeaser(false); try { sessionStorage.setItem("cv-assistant-teaser", "1"); } catch { /* ok */ } };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);

  // El textarea crece con el texto (hasta ~4 líneas), como el campo de un chat.
  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [input, open]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text, ts: Date.now() }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setMsgs([...next, { role: "assistant", text: d.reply, tools: d.toolsUsed, actions: d.actions, ts: Date.now() }]);
    } catch (e: any) {
      setMsgs([...next, { role: "assistant", text: e.message || "No se pudo consultar al asistente.", error: true, ts: Date.now() }]);
    }
    setBusy(false);
  };

  const openChat = () => { dismissTeaser(); setOpen(true); setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250); };

  return (
    <>
      {!open && (
        <div className="fixed z-40 right-4 flex items-end gap-2 md:bottom-6" style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}>
          {teaser && (
            <button
              onClick={openChat}
              className="cv-pop relative mb-2 max-w-[210px] rounded-2xl rounded-br-md px-3.5 py-2.5 text-left text-[12.5px] shadow-lg"
              style={{ background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)", cursor: "pointer" }}
            >
              <span className="font-semibold">¿Necesitas ayuda? 👋</span>
              <span className="block text-[11.5px]" style={{ color: "var(--dim)" }}>Puedo clasificar tus pendientes o resumirte la semana.</span>
              <span role="button" aria-label="Cerrar aviso" onClick={(e) => { e.stopPropagation(); dismissTeaser(); }} className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)" }}><X size={11} /></span>
            </button>
          )}
          <button
            onClick={openChat} title="Asistente de IA" aria-label="Abrir el asistente"
            className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl"
            style={{ background: "linear-gradient(135deg, var(--accent), #ffb15e)", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 8px 24px rgba(247,123,28,.45)" }}
          >
            <MessageCircle size={25} strokeWidth={2.1} />
            <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full" style={{ background: "var(--pos)", border: "2.5px solid var(--bg)" }} />
          </button>
        </div>
      )}

      {open && (
        <>
          {/* Fondo tenue: tocar fuera minimiza el chat (solo móvil) */}
          <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,.35)" }} onClick={() => setOpen(false)} />
          <div
            role="dialog" aria-label="Asistente de IA"
            className="cv-pop fixed z-50 left-3 right-3 flex flex-col overflow-hidden rounded-3xl md:left-auto md:right-6 md:bottom-6 md:w-[390px] md:h-[610px] md:max-h-[calc(100vh-3rem)]"
            style={{
              bottom: "calc(80px + env(safe-area-inset-bottom))", height: "min(74dvh, 640px)",
              background: "var(--bg)", border: "1px solid var(--line)", boxShadow: "0 18px 60px rgba(0,0,0,.5)", color: "var(--ink)",
            }}
          >
            {/* Encabezado tipo soporte: avatar, estado "en línea" y acciones */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "linear-gradient(135deg, var(--accent), #ff9a45)", color: "#fff" }}>
              <span className="relative inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,.22)" }}>
                <Bot size={22} strokeWidth={2.1} />
                <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full" style={{ background: "#3ed598", border: "2px solid var(--accent)" }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[14.5px] font-semibold leading-tight">Asistente Cold Vault</div>
                <div className="text-[11.5px] opacity-90">En línea · responde al instante</div>
              </div>
              {msgs.length > 0 && <button className="cv-chat-btn" title="Nueva conversación" aria-label="Nueva conversación" onClick={() => setMsgs([])}><RotateCcw size={16} /></button>}
              <button className="cv-chat-btn" title="Minimizar" aria-label="Minimizar el chat" onClick={() => setOpen(false)}><ChevronDown size={22} /></button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-4 text-[13.5px]">
              {/* Saludo inicial como mensaje del asistente + respuestas rápidas */}
              <div className="flex items-end gap-2">
                <Avatar size={26} />
                <div className="max-w-[84%]">
                  <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                    ¡Hola! 👋 Soy el asistente de <strong>Cold Vault</strong>. Puedo clasificar tus pendientes aprendiendo de lo que ya hiciste, auditar contrapartes, resumir periodos y preparar estados de cuenta. <span style={{ color: "var(--dim)" }}>Nada se guarda sin que tú lo confirmes.</span>
                  </div>
                </div>
              </div>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-2 pl-9">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => send(q)} className="rounded-full px-3 py-1.5 text-left text-[12.5px] font-medium" style={{ background: "var(--panel)", border: "1px solid var(--accent)", color: "var(--accent)", cursor: "pointer" }}>{q}</button>
                  ))}
                </div>
              )}

              {msgs.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex flex-col items-end">
                  <div className="max-w-[84%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5" style={{ background: "var(--accent)", color: "#fff" }}>{m.text}</div>
                  <span className="mt-0.5 text-[10px]" style={{ color: "var(--faint)" }}>{fmtTime(m.ts)}</span>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <Avatar size={26} />
                  <div className="min-w-0 max-w-[88%]">
                    <div
                      className="rounded-2xl rounded-bl-md px-3.5 py-2.5"
                      style={{ background: m.error ? "rgba(178,58,58,.14)" : "var(--panel)", color: m.error ? "var(--neg)" : "var(--ink)", border: `1px solid ${m.error ? "var(--neg)" : "var(--line)"}` }}
                    >
                      <Rich text={m.text} />
                      {m.tools && m.tools.length > 0 && (
                        <div className="mt-2 border-t pt-1.5 text-[10px]" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
                          Consultó: {Array.from(new Set(m.tools.map((t) => TOOL_LABEL[t] || t))).join(", ")}
                        </div>
                      )}
                    </div>
                    {m.actions?.map((a) => a.type === "clasificar"
                      ? <ClassifyCard key={a.id} action={a} outcome={outcomes[a.id]} onResolve={(o) => setOutcomes((x) => ({ ...x, [a.id]: o }))} onApplied={(ap) => onClassificationsApplied?.(ap)} />
                      : <StatementCard key={a.id} action={a} />)}
                    <span className="mt-0.5 block text-[10px]" style={{ color: "var(--faint)" }}>{fmtTime(m.ts)}</span>
                  </div>
                </div>
              ))}
              {busy && <Typing />}
              <div ref={endRef} />
            </div>

            {/* Sugerencias rápidas siempre a mano una vez empezada la conversación */}
            {msgs.length > 0 && !busy && (
              <div className="flex gap-2 overflow-x-auto px-3.5 pb-2 pt-1" style={{ scrollbarWidth: "none" }}>
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="flex-shrink-0 rounded-full px-3 py-1 text-[11.5px]" style={{ background: "var(--panel)", border: "1px solid var(--line)", color: "var(--dim)", cursor: "pointer", whiteSpace: "nowrap" }}>{q}</button>
                ))}
              </div>
            )}

            <form
              className="border-t px-3 pt-2.5" style={{ borderColor: "var(--line)", background: "var(--panel)", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
              onSubmit={(e) => { e.preventDefault(); void send(input); }}
            >
              <div className="flex items-end gap-2 rounded-3xl px-3 py-1.5" style={{ background: "var(--bg)", border: "1px solid var(--line)" }}>
                <textarea
                  ref={inputRef} rows={1} maxLength={2000} value={input}
                  placeholder="Escribe tu mensaje…" aria-label="Mensaje"
                  className="max-h-24 min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-[14px] outline-none"
                  style={{ color: "var(--ink)", border: "none" }}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" className="mb-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: input.trim() && !busy ? "var(--accent)" : "var(--line)", color: "#fff", border: "none", cursor: input.trim() && !busy ? "pointer" : "default", transition: "background .15s" }}>
                  <Send size={15} />
                </button>
              </div>
              <div className="pb-1 pt-1.5 text-center text-[10px]" style={{ color: "var(--faint)" }}>La IA puede equivocarse: verifica cifras clave.</div>
            </form>
          </div>
        </>
      )}
    </>
  );
}
