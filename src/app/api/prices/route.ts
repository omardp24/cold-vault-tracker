import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchPrices } from "@/lib/prices";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) return NextResponse.json({});
  try {
    const data = await fetchPrices(ids.split(","));
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "error desconocido" }, { status: 502 });
  }
}
