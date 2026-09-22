import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import type { Chain } from "@/lib/db";

// Comisión de red REALMENTE pagada por una transacción concreta (no la estimación de "cuánto
// costaría enviar ahora" que ya existe en /api/fees). Es una llamada aparte y tolerante a fallos —
// el detalle de la operación se muestra igual aunque esto falle, solo sin esa línea.
async function fetchFee(chain: Chain, txid: string): Promise<{ fee: number; symbol: string } | null> {
  try {
    if (chain === "BTC") {
      const res = await fetch(`https://mempool.space/api/tx/${txid}`, { cache: "no-store" });
      if (!res.ok) return null;
      const d = await res.json();
      return typeof d.fee === "number" ? { fee: d.fee / 1e8, symbol: "BTC" } : null;
    }
    if (chain === "ETH") {
      const key = process.env.ETHPLORER_KEY || "freekey";
      const res = await fetch(`https://api.ethplorer.io/getTxInfo/${txid}?apiKey=${key}`, { cache: "no-store" });
      if (!res.ok) return null;
      const d = await res.json();
      if (d.error || !d.gasUsed || !d.gasPrice) return null;
      return { fee: (Number(d.gasUsed) * Number(d.gasPrice)) / 1e18, symbol: "ETH" };
    }
    // TRON
    const res = await fetch("https://api.trongrid.io/wallet/gettransactioninfo", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.TRONGRID_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_KEY } : {}) },
      body: JSON.stringify({ value: txid }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const d = await res.json();
    const sun = d.fee ?? ((d.receipt?.net_fee || 0) + (d.receipt?.energy_fee || 0));
    return { fee: sun / 1e6, symbol: "TRX" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const chain = req.nextUrl.searchParams.get("chain") as Chain | null;
  const txid = req.nextUrl.searchParams.get("txid");
  if (!chain || !["BTC", "ETH", "TRON"].includes(chain) || !txid) {
    return NextResponse.json({ error: "chain y txid son requeridos" }, { status: 400 });
  }
  const result = await fetchFee(chain, txid);
  return NextResponse.json(result ? { fee: result.fee, symbol: result.symbol } : { fee: null, symbol: null });
}
