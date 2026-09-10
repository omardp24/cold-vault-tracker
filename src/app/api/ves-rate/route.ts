import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fetchVesRates } from "@/lib/exchangeRate";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const rates = await fetchVesRates();
  return NextResponse.json(rates);
}
