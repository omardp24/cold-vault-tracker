"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

/**
 * Campo de concepto con autoguardado. Antes solo guardaba en onBlur y sin mirar si el servidor
 * respondió bien: si el usuario cambiaba de pestaña, filtraba o cerraba la página antes del blur,
 * o si el guardado fallaba, el texto se perdía sin avisar. Ahora guarda solo (debounce), al salir
 * del campo, y al desmontarse; muestra el estado y deja reintentar si falla.
 */
export default function ConceptoInput({
  value, onSave, className, placeholder,
}: { value: string; onSave: (concepto: string) => Promise<boolean>; className?: string; placeholder?: string }) {
  const [text, setText] = useState(value);
  const [status, setStatus] = useState<Status>("idle");
  const saved = useRef(value);
  const textRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Si el valor guardado cambia desde afuera (otra pestaña, migración) y el usuario no está escribiendo, se sincroniza.
  useEffect(() => {
    if (!focused.current && value !== saved.current) { saved.current = value; textRef.current = value; setText(value); }
  }, [value]);

  const flush = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const current = textRef.current;
    if (current === saved.current) return;
    setStatus("saving");
    const ok = await onSaveRef.current(current);
    if (ok) { saved.current = current; setStatus("saved"); setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500); }
    else setStatus("error");
  };

  useEffect(() => () => {
    // Al desmontarse (cambio de pestaña/filtro) no se pierde lo escrito.
    if (timer.current) clearTimeout(timer.current);
    if (textRef.current !== saved.current) void onSaveRef.current(textRef.current);
  }, []);

  return (
    <div className="relative flex-1 min-w-0">
      <input
        className={className}
        style={status === "error" ? { borderColor: "var(--neg)" } : undefined}
        placeholder={placeholder}
        value={text}
        onFocus={() => { focused.current = true; }}
        onChange={(e) => {
          setText(e.target.value); textRef.current = e.target.value; setStatus("idle");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(flush, 800);
        }}
        onBlur={() => { focused.current = false; void flush(); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {status !== "idle" && (
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none"
          style={{ color: status === "error" ? "var(--neg)" : status === "saved" ? "var(--pos)" : "var(--faint)" }}
        >
          {status === "saving" ? "…" : status === "saved" ? "✓" : "✕"}
        </span>
      )}
      {status === "error" && (
        <button className="text-[10.5px] underline mt-0.5" style={{ color: "var(--neg)" }} onClick={() => void flush()}>
          No se guardó — reintentar
        </button>
      )}
    </div>
  );
}
