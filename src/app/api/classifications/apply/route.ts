import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

// Aplica en un solo guardado varias clasificaciones distintas (una por movimiento). Lo usan las
// tarjetas del asistente cuando el usuario confirma. Se valida todo en el servidor: nada de lo que
// llegue del cliente (o de la IA) se guarda sin comprobar que el aliado exista.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items.slice(0, 100) : [];
  if (items.length === 0) return NextResponse.json({ error: "No hay cambios que aplicar." }, { status: 400 });

  const result = await updateDb((db) => {
    const applied: { key: string; aliadoId: string | null; concepto: string; isFee: boolean }[] = [];
    let skipped = 0;
    for (const it of items) {
      const key = typeof it?.key === "string" ? it.key : "";
      const aliadoId = typeof it?.aliadoId === "string" ? it.aliadoId : null;
      if (!key || (aliadoId && !db.aliados.some((a) => a.id === aliadoId))) { skipped++; continue; }
      const current = db.classifications[key] || { aliadoId: null, concepto: "" };
      const isFee = it.isFee === true;
      db.classifications[key] = {
        aliadoId: isFee ? current.aliadoId : aliadoId ?? current.aliadoId,
        concepto: typeof it.concepto === "string" ? it.concepto.trim().slice(0, 120) : current.concepto,
        isFee: isFee || current.isFee,
      };
      applied.push({ key, ...{ aliadoId: db.classifications[key].aliadoId, concepto: db.classifications[key].concepto, isFee: !!db.classifications[key].isFee } });
    }
    return { applied, skipped };
  });
  await logAudit(auth.user, "classification.batch", { count: result.applied.length, source: "asistente" });
  return NextResponse.json({ ok: true, applied: result.applied, skipped: result.skipped });
}
