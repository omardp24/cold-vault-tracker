import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const label = (body?.label || "").trim();
  if (!label) return NextResponse.json({ error: "La etiqueta no puede estar vacía." }, { status: 400 });

  const result = await updateDb((db) => {
    const wallet = db.wallets.find((w) => w.id === params.id);
    if (!wallet) return { error: "Wallet no encontrada." as const };
    const previousLabel = wallet.label;
    wallet.label = label;
    return { wallet, previousLabel };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  if (result.previousLabel !== result.wallet.label) {
    await logAudit(auth.user, "wallet.rename", { from: result.previousLabel, to: result.wallet.label });
  }
  return NextResponse.json(result.wallet);
}

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
