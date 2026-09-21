"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Sparkles, Trash2, X } from "lucide-react";

interface Msg { role: "user" | "assistant"; text: string; tools?: string[]; error?: boolean }

const TOOL_LABEL: Record<string, string> = {
  resumen_portafolio: "portafolio", listar_aliados: "aliados", listar_movimientos: "movimientos",
  detectar_polvo_y_fraude: "polvo y fraude", auditar_direccion: "auditoría de dirección", auditar_pendientes: "auditoría de pendientes",
};

const QUICK = [
  "Audita mis movimientos pendientes",
  "¿Cómo va el portafolio?",
  "Detecta transferencias de polvo y fraudes",
  "¿Cómo exporto el estado de cuenta?",
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

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
      setMsgs([...next, { role: "assistant", text: d.reply, tools: d.toolsUsed }]);
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
                <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>Audita y responde con tus datos · solo lectura</div>
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
                  Hola, soy tu asistente. Puedo revisar tus movimientos pendientes, auditar contrapartes, resumir el portafolio y explicarte cómo usar la app. No modifico nada: solo te digo qué encontré y qué hacer.
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
