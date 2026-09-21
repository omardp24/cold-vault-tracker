import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { fetchRangeMovements, veDayRange } from "@/lib/monthlyReport";
import { computePortfolioBreakdown } from "@/lib/portfolioValue";
import { buildStatementData, effectiveAliadoId } from "@/lib/statementAggregation";
import { generateStatementExcel } from "@/lib/statementExcel";
import { generateStatementPdf } from "@/lib/statementPdf";

// Estado de cuenta por rango de fechas (hora de Venezuela), opcionalmente de un solo aliado, armado
// en el servidor. Lo usan las tarjetas del asistente ("estado de cuenta de agosto de Juan").
export const maxDuration = 60;

const isDay = (d: any) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(`${d}T12:00:00Z`));

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const { desde, hasta, aliadoId, format } = (await req.json().catch(() => ({}))) as { desde?: string; hasta?: string; aliadoId?: string | null; format?: string };
  if (!isDay(desde) || !isDay(hasta) || desde! > hasta!) return NextResponse.json({ error: "Rango de fechas inválido." }, { status: 400 });
  if (format !== "pdf" && format !== "excel") return NextResponse.json({ error: "Formato inválido." }, { status: 400 });

  try {
    const db = await readDb();
    const aliado = aliadoId ? db.aliados.find((a) => a.id === aliadoId) : null;
    if (aliadoId && !aliado) return NextResponse.json({ error: "Ese aliado ya no existe." }, { status: 404 });

    const { from, to } = veDayRange(desde!, hasta!);
    const [breakdown, perWallet] = await Promise.all([
      computePortfolioBreakdown(),
      Promise.all(db.wallets.map(async (w) => {
        try { return (await fetchRangeMovements(w.chain, w.address, from.getTime(), to.getTime())).map((m) => ({ ...m, walletLabel: w.label })); }
        catch { return []; }
      })),
    ]);
    let movements = perWallet.flat();
    if (aliado) movements = movements.filter((m) => effectiveAliadoId(m, db.classifications, db.aliados) === aliado.id);

    const data = buildStatementData({
      wallets: db.wallets, aliados: db.aliados, classifications: db.classifications, movements,
      priceLookup: breakdown.priceLookup, holdings: breakdown.holdings, total: breakdown.total,
      incompleteWallets: db.wallets.filter((w) => breakdown.failedWalletIds.includes(w.id)).map((w) => w.label),
      generatedBy: `${auth.user.name}${aliado ? ` · Aliado: ${aliado.name}` : ""}`,
      dateFrom: desde, dateTo: hasta,
    });

    const buffer = format === "pdf" ? await generateStatementPdf(data) : await generateStatementExcel(data);
    const tag = `${desde}_${hasta}${aliado ? `_${aliado.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}` : ""}`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="estado_cuenta_${tag}.${format === "pdf" ? "pdf" : "xlsx"}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo generar el estado de cuenta." }, { status: 500 });
  }
}
