import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  await updateDb((db) => {
    db.manual = db.manual.filter((m) => m.id !== params.id);
  });
  return NextResponse.json({ ok: true });
}
