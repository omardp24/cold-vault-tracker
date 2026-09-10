import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sugerirClasificacion, type EjemploClasificado, type MovimientoAClasificar } from "@/lib/asistenteClasificacion";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { movimiento, ejemplos, aliadosConocidos } = body as {
    movimiento: MovimientoAClasificar;
    ejemplos: EjemploClasificado[];
    aliadosConocidos: string[];
  };
  if (!movimiento) return NextResponse.json({ error: "movimiento es requerido" }, { status: 400 });

  const sugerencia = await sugerirClasificacion(movimiento, ejemplos || [], aliadosConocidos || []);
  if (!sugerencia) return NextResponse.json({ error: "sin sugerencia disponible" }, { status: 503 });
  return NextResponse.json(sugerencia);
}
