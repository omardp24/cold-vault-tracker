import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AssistantError, runAssistant, type ChatTurn } from "@/lib/assistant";

// Las herramientas del asistente consultan historial en varias redes (TronGrid, Ethplorer…): puede tardar.
export const maxDuration = 60;

// Tope simple por usuario (en memoria; en serverless es aproximado pero frena bucles y abusos).
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 40;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;

  const now = Date.now();
  const recent = (hits.get(auth.user.id) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_HITS) return NextResponse.json({ error: "Demasiadas consultas seguidas. Espera unos minutos." }, { status: 429 });
  hits.set(auth.user.id, [...recent, now]);

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const turns: ChatTurn[] = raw
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.text === "string" && m.text.trim())
    .slice(-16)
    .map((m: any) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  }

  try {
    return NextResponse.json(await runAssistant(turns));
  } catch (e: any) {
    if (e instanceof AssistantError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Error inesperado del asistente." }, { status: 500 });
  }
}
