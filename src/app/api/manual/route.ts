import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const db = await readDb();
  return NextResponse.json(db.manual);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { coinId, symbol, qty } = body as { coinId: string; symbol?: string; qty: number };
  if (!coinId?.trim()) return NextResponse.json({ error: "coinId es requerido" }, { status: 400 });
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "La cantidad debe ser un número mayor que cero." }, { status: 400 });
  }
  const holding = await updateDb((db) => {
    const h = { id: newId(), coinId: coinId.trim().toLowerCase(), symbol: (symbol || coinId).trim().toUpperCase(), qty: amount };
    db.manual.push(h);
    return h;
  });
  return NextResponse.json(holding, { status: 201 });
}
