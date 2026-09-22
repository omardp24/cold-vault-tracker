"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushBell({ size = 34 }: { size?: number }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => setSubscribed(!!(await reg.pushManager.getSubscription())))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(t);
  }, [error]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/notifications/subscription", {
            method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } else {
        // El permiso se pide como el PRIMER await del gesto: en iOS (sobre todo instalado
        // como app de pantalla de inicio), cualquier await antes de este punto puede hacer
        // que Safari ya no considere esto "dentro" del toque del usuario y el permiso falle
        // en silencio (ni error ni cuadro de diálogo, la campana simplemente no cambia).
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError(permission === "denied" ? "Permiso denegado. Actívalo en Ajustes del teléfono/navegador para este sitio." : "No se concedió el permiso de notificaciones.");
          setBusy(false);
          return;
        }
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setError("Falta configurar la clave pública de notificaciones en el servidor.");
          setBusy(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
        const json = sub.toJSON();
        const res = await fetch("/api/notifications/subscription", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        if (!res.ok) throw new Error(`el servidor respondió ${res.status}`);
        setSubscribed(true);
      }
    } catch (e: any) {
      console.error("PushBell toggle error:", e);
      setError(e?.message ? `No se pudo activar: ${e.message}` : "No se pudo activar las notificaciones.");
    }
    setBusy(false);
  };

  if (!supported) return null;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={toggle}
        disabled={busy}
        className="cv-icon-btn justify-center rounded-full flex-shrink-0 transition-colors"
        style={
          subscribed
            ? { width: size, height: size, background: "var(--accent)", border: "1px solid var(--accent)", color: "#ffffff" }
            : { width: size, height: size, background: "var(--panel2)", border: "1px solid var(--line)", color: "var(--dim)" }
        }
        title={subscribed ? "Notificaciones activadas — clic para desactivar" : "Notificaciones desactivadas — clic para activar"}
      >
        {subscribed ? <Bell size={15} fill="currentColor" /> : <BellOff size={15} />}
      </button>
      {error && (
        <div
          role="alert"
          className="cv-pop absolute right-0 top-full mt-2 z-50 w-[240px] rounded-xl px-3 py-2.5 text-[11.5px] shadow-lg"
          style={{ background: "var(--panel)", border: "1px solid var(--neg)", color: "var(--ink)", animationDuration: "0.15s" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
