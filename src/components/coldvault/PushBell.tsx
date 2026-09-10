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

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => setSubscribed(!!(await reg.pushManager.getSubscription())))
      .catch(() => {});
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (subscribed) {
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
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { setBusy(false); return; }
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) { setBusy(false); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource });
        const json = sub.toJSON();
        await fetch("/api/notifications/subscription", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        setSubscribed(true);
      }
    } catch (e) {
      console.error("PushBell toggle error:", e);
    }
    setBusy(false);
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="cv-icon-btn justify-center rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: "var(--panel2)", border: "1px solid var(--line)", color: subscribed ? "var(--accent)" : "var(--dim)" }}
      title={subscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
    >
      {subscribed ? <Bell size={15} /> : <BellOff size={15} />}
    </button>
  );
}
