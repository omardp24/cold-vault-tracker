"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Download, Send, Sparkles, Trash2, X } from "lucide-react";
import type { AssistantAction, ClassifyItem } from "@/lib/assistantActions";

interface Msg { role: "user" | "assistant"; text: string; tools?: string[]; error?: boolean; actions?: AssistantAction[] }
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
                    {i.confianza && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: i.confianza === "alta" ? "rgba(80,180,120,.18)" : "rgba(220,170,60,.18)", color: "var(--dim)" }}>{i.fuente === "historial" ? "historial" : "IA"} · {i.confianza}</span>}
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

export default function AssistantPanel({ onClassificationsApplied }: { onClassificationsApplied?: (applied: AppliedClassification[]) => void }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, ActionOutcome>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setMsgs([...next, { role: "assistant", text: d.reply, tools: d.toolsUsed, actions: d.actions }]);
    } catch (e: any) {
      setMsgs([...next, { role: "assistant", text: e.message || "No se pudo consultar al asistente.", error: true }]);
    }
    setBusy(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)} title="Asistente de IA"
          className="fixed z-40 right-4 bottom-[88px] md:bottom-6 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg"
          style={{ background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}
        >
          <Sparkles size={17} /><span className="text-[13px] font-semibold hidden sm:inline">Asistente</span>
        </button>
      )}

      {open && (
        <>
          {/* Fondo: tocar afuera cierra (en móvil el asistente es una hoja tipo pop-up, no pantalla completa) */}
          <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(0,0,0,.55)" }} onClick={() => setOpen(false)} />
          <div
            role="dialog" aria-label="Asistente de IA"
            className="fixed z-50 inset-x-0 bottom-0 h-[80dvh] rounded-t-3xl md:inset-x-auto md:right-6 md:bottom-6 md:w-[400px] md:h-[600px] md:max-h-[calc(100vh-3rem)] md:rounded-2xl flex flex-col overflow-hidden"
            style={{ background: "var(--panel)", border: "1px solid var(--line)", boxShadow: "0 -8px 40px rgba(0,0,0,.4)", color: "var(--ink)" }}
          >
          <div className="md:hidden flex justify-center pt-2" onClick={() => setOpen(false)}>
            <div className="w-10 h-1 rounded-full" style={{ background: "var(--line)" }} />
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)", background: "var(--panel2)" }}>
            <div className="flex items-center gap-2">
              <Sparkles size={16} style={{ color: "var(--accent)" }} />
              <div>
                <div className="font-display text-sm font-semibold leading-tight">Asistente Cold Vault</div>
                <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>Audita, clasifica y responde con tus datos</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && <button className="cv-x" title="Nueva conversación" onClick={() => setMsgs([])}><Trash2 size={15} /></button>}
              <button className="cv-x" title="Cerrar" onClick={() => setOpen(false)}><X size={18} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px]">
            {msgs.length === 0 && (
              <div>
                <div className="rounded-xl p-3 mb-3 text-[12.5px]" style={{ background: "var(--panel2)", color: "var(--dim)" }}>
                  Hola, soy tu asistente. Puedo clasificar tus pendientes aprendiendo de lo que ya hiciste, auditar contrapartes, resumir periodos, preparar estados de cuenta y explicarte la app. Nada se guarda sin que tú lo confirmes.
                </div>
                <div className="flex flex-col gap-2">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => send(q)} className="text-left text-[12.5px] rounded-xl px-3 py-2" style={{ background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--ink)", cursor: "pointer" }}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className="max-w-[88%] rounded-2xl px-3.5 py-2.5"
                  style={m.role === "user"
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: m.error ? "rgba(178,58,58,.14)" : "var(--panel2)", color: m.error ? "var(--neg)" : "var(--ink)", border: "1px solid var(--line)" }}
                >
                  {m.role === "user" ? m.text : <Rich text={m.text} />}
                  {m.tools && m.tools.length > 0 && (
                    <div className="text-[10px] mt-2 pt-1.5 border-t" style={{ borderColor: "var(--line)", color: "var(--faint)" }}>
                      Consultó: {Array.from(new Set(m.tools.map((t) => TOOL_LABEL[t] || t))).join(", ")}
                    </div>
                  )}
                  {m.actions?.map((a) => a.type === "clasificar"
                    ? <ClassifyCard key={a.id} action={a} outcome={outcomes[a.id]} onResolve={(o) => setOutcomes((x) => ({ ...x, [a.id]: o }))} onApplied={(ap) => onClassificationsApplied?.(ap)} />
                    : <StatementCard key={a.id} action={a} />)}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 text-[12.5px] animate-pulse" style={{ background: "var(--panel2)", color: "var(--dim)", border: "1px solid var(--line)" }}>Revisando tus datos…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className="flex items-end gap-2 p-3 border-t" style={{ borderColor: "var(--line)", paddingBottom: "max(12px, env(safe-area-inset-bottom))" }} onSubmit={(e) => { e.preventDefault(); void send(input); }}>
            <textarea
              className="cv-input flex-1 resize-none py-2 px-3 text-[13px]" rows={1} maxLength={2000}
              placeholder="Pregunta algo o pide una auditoría…" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
            />
            <button type="submit" disabled={busy || !input.trim()} className="cv-btn flex-shrink-0" style={{ padding: "10px 12px" }}><Send size={15} /></button>
          </form>
          </div>
        </>
      )}
    </>
  );
}
