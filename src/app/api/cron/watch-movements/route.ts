import { NextRequest, NextResponse } from "next/server";
import { watchAndNotifyMovements } from "@/lib/movementWatch";

// La llama un cron externo cada pocos minutos (ver .github/workflows/watch-movements.yml) —
// Vercel Hobby solo permite crons diarios, así que la vigilancia casi en tiempo real vive fuera
// de Vercel. Mismo esquema de autenticación que el cron diario: bearer token propio, no sesión.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const result = await watchAndNotifyMovements();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "no se pudo completar la vigilancia de movimientos" }, { status: 500 });
  }
}
