import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const tests = [
    { name: "CoinGecko (precios)", url: "https://api.coingecko.com/api/v3/ping" },
    { name: "Mempool.space (BTC)", url: "https://mempool.space/api/blocks/tip/height" },
    {
      name: "Ethplorer (ETH)",
      url: `https://api.ethplorer.io/getAddressInfo/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?apiKey=${process.env.ETHPLORER_KEY || "freekey"}`,
    },
    {
      name: "TronGrid (TRON)",
      url: "https://api.trongrid.io/v1/accounts/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      headers: process.env.TRONGRID_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_KEY } : undefined,
    },
  ];
  const results = [];
  for (const t of tests) {
    try {
      const res = await fetch(t.url, { headers: t.headers, cache: "no-store" });
      results.push({ name: t.name, ok: res.ok, detail: res.ok ? `HTTP ${res.status} — OK` : `HTTP ${res.status}` });
    } catch (e: any) {
      results.push({ name: t.name, ok: false, detail: `${e.name || "Error"}: ${e.message}` });
    }
  }
  return NextResponse.json(results);
}
