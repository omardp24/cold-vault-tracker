import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { verifyMailer } from "@/lib/mailer";
import { supabase } from "@/lib/supabase";

// Estado de salud del sistema, solo para el propietario. Existe porque varias integraciones fallan EN SILENCIO
// cuando falta una variable de entorno en Vercel (así pasó con el correo: los reportes nunca salieron y nadie
// se enteró). Solo devuelve si algo está configurado o no — nunca valores de claves.
export const maxDuration = 30;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Solo el propietario puede ver esto." }, { status: 403 });

  const e = process.env;
  const has = (...keys: string[]) => keys.every((k) => !!e[k]);
  const smtpConfigured = has("GMAIL_SMTP_USER", "GMAIL_SMTP_APP_PASSWORD");

  const [db, snap, notified, smtp] = await Promise.all([
    readDb(),
    supabase.from("portfolio_snapshots").select("taken_at").order("taken_at", { ascending: false }).limit(1),
    supabase.from("notified_movements").select("movement_key", { count: "exact", head: true }),
    smtpConfigured ? verifyMailer() : Promise.resolve({ ok: false, error: undefined as string | undefined }),
  ]);

  return NextResponse.json({
    config: {
      smtp: smtpConfigured, push: has("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
      gemini: has("GEMINI_API_KEY"), trongrid: has("TRONGRID_KEY"), tronscan: has("TRONSCAN_KEY"), cronSecret: has("CRON_SECRET"),
    },
    smtpVerified: smtp.ok, smtpError: smtp.error ?? null,
    lastSnapshotAt: snap.data?.[0]?.taken_at ?? null,
    pushSubscribers: db.pushSubscriptions.length,
    notifiedMovements: notified.count ?? 0,
    watchPrimed: !!db.movementWatchPrimed,
    weeklyReportSentFor: db.weeklyReportSentFor ?? null,
    wallets: db.wallets.length,
  });
}
