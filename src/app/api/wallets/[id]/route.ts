import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const removed = await updateDb((db) => {
    const wallet = db.wallets.find((w) => w.id === params.id) || null;
    db.wallets = db.wallets.filter((w) => w.id !== params.id);
    return wallet;
  });
  if (removed) await logAudit(auth.user, "wallet.delete", { label: removed.label, chain: removed.chain });
  return NextResponse.json({ ok: true });
}
