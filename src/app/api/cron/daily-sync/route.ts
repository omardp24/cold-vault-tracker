import { NextRequest, NextResponse } from "next/server";
import { runDailySync } from "@/lib/dailySync";

// La llama Vercel Cron (ver vercel.json), no un usuario logueado — no hay cookie de sesión
// que verificar, así que se protege con un bearer token propio en vez de requireAuth().
// Un solo cron para todo (snapshot de portafolio + por wallet, notificaciones push de
// movimientos nuevos/sospechosos, reporte mensual por correo el día 1) — evita depender
// de más de un cron job del plan de Vercel.
// Recorre todas las wallets, arma el resumen con IA y (día 1) el reporte mensual: puede tardar.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await runDailySync();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "no se pudo completar la sincronización diaria" }, { status: 500 });
  }
}
