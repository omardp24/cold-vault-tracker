import { NextRequest, NextResponse } from "next/server";
import { estimateBtcFee, estimateEthFee, estimateTronFee } from "@/lib/fees";
import type { Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const chain = req.nextUrl.searchParams.get("chain") as Chain | null;
  const isToken = req.nextUrl.searchParams.get("isToken") === "true";
  if (!chain) return NextResponse.json({ error: "chain es requerido" }, { status: 400 });

  try {
    const estimate =
      chain === "BTC" ? await estimateBtcFee() : chain === "ETH" ? await estimateEthFee(isToken) : await estimateTronFee(isToken);
    // Guarda la última respuesta buena — si la API externa se cae, servimos esto en vez de un error.
    await supabase.from("fee_cache").upsert({ chain, is_token: isToken, payload: estimate, updated_at: new Date().toISOString() });
    return NextResponse.json(estimate);
  } catch (e: any) {
    const { data: cached } = await supabase
      .from("fee_cache")
      .select("payload, updated_at")
      .eq("chain", chain)
      .eq("is_token", isToken)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({ ...(cached.payload as object), stale: true, staleSince: cached.updated_at });
    }
    return NextResponse.json({ error: e.message || "no se pudo estimar la comisión" }, { status: 502 });
  }
}
