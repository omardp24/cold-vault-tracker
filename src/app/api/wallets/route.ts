import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId, Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

/**
 * Validación básica de formato por red. No garantiza que la dirección exista, pero atrapa
 * errores de tipeo antes de guardarlos (si no, la wallet se guarda y luego falla al leer
 * el saldo con un error confuso).
 */
function validateAddress(chain: Chain, address: string): string | null {
  const a = address.trim();
  if (chain === "TRON") {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "Una dirección de TRON empieza con 'T' y tiene 34 caracteres.";
  } else if (chain === "ETH") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(a)) return "Una dirección de Ethereum empieza con '0x' y tiene 42 caracteres.";
  } else if (chain === "BTC") {
    const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a);
    const segwit = /^bc1[a-z0-9]{25,62}$/i.test(a);
    if (!legacy && !segwit) return "Una dirección de Bitcoin empieza con 1, 3 o bc1.";
  }
  return null;
}

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const db = await readDb();
  return NextResponse.json(db.wallets);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { chain, address, label } = body as { chain: Chain; address: string; label?: string };
  if (!chain || !address) return NextResponse.json({ error: "chain y address son requeridos" }, { status: 400 });

  const clean = address.trim();
  const formatError = validateAddress(chain, clean);
  if (formatError) return NextResponse.json({ error: formatError }, { status: 400 });

  // Evita duplicados: la misma dirección repetida duplicaría su saldo en el total del portafolio.
  const result = await updateDb((db) => {
    const dup = db.wallets.find((w) => w.chain === chain && w.address.toLowerCase() === clean.toLowerCase());
    if (dup) return { error: `Esa dirección ya está registrada como "${dup.label}".` as const };
    const wallet = { id: newId(), chain, address: clean, label: (label || "").trim() || chain };
    db.wallets.push(wallet);
    return { wallet };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  await logAudit(auth.user, "wallet.create", { label: result.wallet.label, chain: result.wallet.chain });
  return NextResponse.json(result.wallet, { status: 201 });
}
