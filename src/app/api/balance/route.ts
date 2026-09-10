import { NextRequest, NextResponse } from "next/server";
import { balanceFetchers } from "@/lib/chains";
import type { Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const chain = req.nextUrl.searchParams.get("chain") as Chain | null;
  const address = req.nextUrl.searchParams.get("address");
  if (!chain || !address) return NextResponse.json({ error: "chain y address son requeridos" }, { status: 400 });
  const fetcher = balanceFetchers[chain];
  if (!fetcher) return NextResponse.json({ error: `red desconocida: ${chain}` }, { status: 400 });
  try {
    const result = await fetcher(address);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "error desconocido" }, { status: 502 });
  }
}
