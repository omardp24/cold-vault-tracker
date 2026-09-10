import webpush from "web-push";
import { readDb, updateDb } from "./db";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Manda un push a todas las suscripciones guardadas. Puerto directo del patrón de
 * src/notificaciones/push.service.ts en Recordatorio, sin NestJS: si faltan las VAPID_*
 * no hace nada (deshabilitado con warning, mismo criterio que el resto de integraciones
 * opcionales de este proyecto); si una suscripción devuelve 404/410 (revocada por el
 * navegador), se borra sola.
 */
export async function sendToAll(payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.warn("Push deshabilitado: faltan VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT.");
    return;
  }
  const db = await readDb();
  if (db.pushSubscriptions.length === 0) return;

  const expired: string[] = [];
  await Promise.all(db.pushSubscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) expired.push(sub.endpoint);
      else console.error("push.sendToAll() error:", e?.message || e);
    }
  }));

  if (expired.length > 0) {
    await updateDb((d) => {
      d.pushSubscriptions = d.pushSubscriptions.filter((s) => !expired.includes(s.endpoint));
    });
  }
}
