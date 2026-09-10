import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

// PATCH: actualiza un tramo específico del plan (marcar como transferido, hash, notas)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { legId, done, txHash, notes } = body as { legId: string; done?: boolean; txHash?: string; notes?: string };

  const result = await updateDb((db) => {
    const plan = db.plans.find((p) => p.id === params.id);
    if (!plan) return { error: "plan no encontrado" as const };
    const leg = plan.legs.find((l) => l.id === legId);
    if (!leg) return { error: "tramo no encontrado" as const };

    if (done !== undefined) { leg.done = done; leg.doneAt = done ? Date.now() : null; }
    if (txHash !== undefined) leg.txHash = txHash;
    if (notes !== undefined) leg.notes = notes;

    return { plan };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result.plan);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const removed = await updateDb((db) => {
    const plan = db.plans.find((p) => p.id === params.id) || null;
    db.plans = db.plans.filter((p) => p.id !== params.id);
    return plan;
  });
  if (removed) await logAudit(auth.user, "plan.delete", { destination: removed.destination, targetAmount: removed.targetAmount });
  return NextResponse.json({ ok: true });
}
