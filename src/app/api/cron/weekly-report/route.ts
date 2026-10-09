import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReport } from "@/lib/weeklyReport";
import { buildWeeklyReport } from "@/lib/weeklyReportBuild";

// La llama GitHub Actions los viernes (ver .github/workflows/weekly-report.yml) — Vercel Hobby solo permite
// un cron diario y ese ya está ocupado por daily-sync. Mismo esquema de autenticación que los otros crons.
//   ?preview=1  devuelve el asunto, los conteos y el HTML SIN enviar nada.
//   ?force=1    envía aunque ya se haya enviado hoy.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    if (req.nextUrl.searchParams.get("preview") === "1") {
      const { subject, html, counts, fromDay, toDay } = await buildWeeklyReport();
      return NextResponse.json({ subject, counts, fromDay, toDay, html });
    }
    const result = await sendWeeklyReport({ force: req.nextUrl.searchParams.get("force") === "1" });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "no se pudo enviar el reporte semanal" }, { status: 500 });
  }
}
