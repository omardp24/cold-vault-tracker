import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const RANGE_DAYS: Record<string, number> = { "7d": 7, "90d": 90, "1y": 365 };

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;

  const range = req.nextUrl.searchParams.get("range") || "90d";
  const days = RANGE_DAYS[range] ?? 90;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from("wallet_snapshots")
    .select("taken_at, balance_usd")
    .eq("wallet_id", params.id)
    .gte("taken_at", since)
    .order("taken_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (data || []).map((row) => ({
    date: new Date(row.taken_at).toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
    value: Number(row.balance_usd),
  }));
  return NextResponse.json(points);
}
