import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { keys, aliadoId, concepto, isFee } = body as { keys: string[]; aliadoId?: string | null; concepto?: string; isFee?: boolean };
  if (!Array.isArray(keys) || keys.length === 0) return NextResponse.json({ error: "keys es requerido" }, { status: 400 });

  await updateDb((db) => {
    keys.forEach((key) => {
      const current = db.classifications[key] || { aliadoId: null, concepto: "" };
      db.classifications[key] = {
        aliadoId: aliadoId !== undefined ? aliadoId : current.aliadoId,
        concepto: concepto !== undefined ? concepto : current.concepto,
        isFee: isFee !== undefined ? isFee : current.isFee,
      };
    });
  });
  await logAudit(auth.user, "classification.batch", { count: keys.length, aliadoId, concepto, isFee });
  return NextResponse.json({ ok: true, updated: keys.length });
}
