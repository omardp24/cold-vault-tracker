import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const list = data.map((c: any) => ({
      id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image,
      price: c.current_price, change24h: c.price_change_percentage_24h,
    }));
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "no se pudo obtener el mercado" }, { status: 502 });
  }
}
