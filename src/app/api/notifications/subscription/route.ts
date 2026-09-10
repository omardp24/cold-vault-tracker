import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { endpoint, keys } = body as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "endpoint y keys son requeridos" }, { status: 400 });
  }

  await updateDb((db) => {
    db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
    db.pushSubscriptions.push({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json().catch(() => ({}));
  const { endpoint } = body as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "endpoint es requerido" }, { status: 400 });

  await updateDb((db) => {
    db.pushSubscriptions = db.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  });
  return NextResponse.json({ ok: true });
}
