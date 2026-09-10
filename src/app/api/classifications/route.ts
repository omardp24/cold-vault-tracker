import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const db = await readDb();
  return NextResponse.json(db.classifications);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { key, aliadoId, concepto, isFee } = body as { key: string; aliadoId?: string | null; concepto?: string; isFee?: boolean };
  if (!key) return NextResponse.json({ error: "key es requerido" }, { status: 400 });

  const classification = await updateDb((db) => {
    const current = db.classifications[key] || { aliadoId: null, concepto: "" };
    db.classifications[key] = {
      aliadoId: aliadoId !== undefined ? aliadoId : current.aliadoId,
      concepto: concepto !== undefined ? concepto : current.concepto,
      isFee: isFee !== undefined ? isFee : current.isFee,
    };
    return db.classifications[key];
  });
  await logAudit(auth.user, "classification.set", { key, aliadoId: classification.aliadoId, concepto: classification.concepto, isFee: classification.isFee });
  return NextResponse.json(classification);
}
