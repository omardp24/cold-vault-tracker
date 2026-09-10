import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateStatementPdf, StatementInput } from "@/lib/statementPdf";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  try {
    const input: StatementInput = await req.json();
    const buffer = await generateStatementPdf(input);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="estado_cuenta_${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo generar el PDF." }, { status: 500 });
  }
}
