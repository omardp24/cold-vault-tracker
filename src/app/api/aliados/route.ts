import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId, Aliado } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const db = await readDb();
  return NextResponse.json(db.aliados);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { name } = body as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "name es requerido" }, { status: 400 });

  // Si ya existe un aliado con ese nombre, devuélvelo en vez de duplicarlo: dos aliados con el
  // mismo nombre dividirían los totales de una misma persona en dos líneas del reporte.
  const result = await updateDb((db) => {
    const existing = db.aliados.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (existing) return { created: false as const, aliado: existing };
    const aliado: Aliado = { id: newId(), name: name.trim(), addresses: [] };
    db.aliados.push(aliado);
    return { created: true as const, aliado };
  });
  if (result.created) await logAudit(auth.user, "aliado.create", { name: result.aliado.name });
  return NextResponse.json(result.aliado, { status: result.created ? 201 : 200 });
}
