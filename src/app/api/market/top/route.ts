import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * `full` trae el detalle estilo CoinMarketCap para la pestaña Mercado (top 100, cambios a
 * 1h/24h/7d, cap. de mercado, volumen, sparkline de 7 días). Sin ese flag devuelve la versión
 * liviana de siempre (top 20, solo precio + 24h) — la sigue usando el resumen de mercado que se
 * muestra en el portafolio en pantallas chicas, que no necesita todo lo demás.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const full = req.nextUrl.searchParams.get("full") === "1";
  const perPage = full ? 100 : 20;
  const params = new URLSearchParams({
    vs_currency: "usd", order: "market_cap_desc", per_page: String(perPage), page: "1",
    sparkline: full ? "true" : "false",
    price_change_percentage: full ? "1h,24h,7d" : "24h",
  });
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const list = data.map((c: any) => ({
      id: c.id, symbol: c.symbol.toUpperCase(), name: c.name, image: c.image,
      price: c.current_price, change24h: c.price_change_percentage_24h,
      ...(full && {
        rank: c.market_cap_rank,
        change1h: c.price_change_percentage_1h_in_currency,
        change7d: c.price_change_percentage_7d_in_currency,
        marketCap: c.market_cap,
        volume24h: c.total_volume,
        sparkline: c.sparkline_in_7d?.price || [],
      }),
    }));
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "no se pudo obtener el mercado" }, { status: 502 });
  }
}
