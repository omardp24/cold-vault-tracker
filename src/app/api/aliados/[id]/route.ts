import { NextRequest, NextResponse } from "next/server";
import { updateDb, Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

// PATCH: gestiona direcciones conocidas de este aliado (añadir o quitar)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { chain, address, action } = body as { chain: Chain; address: string; action?: "add" | "remove" };

  const result = await updateDb((db) => {
    const aliado = db.aliados.find((a) => a.id === params.id);
    if (!aliado) return { error: "aliado no encontrado" as const };
    if (action === "remove") {
      aliado.addresses = aliado.addresses.filter((x) => x.address.toLowerCase() !== address.toLowerCase());
    } else {
      const exists = aliado.addresses.some((x) => x.address.toLowerCase() === address.toLowerCase());
      if (!exists) aliado.addresses.push({ chain, address });
    }
    return { aliado };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json(result.aliado);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const removed = await updateDb((db) => {
    const aliado = db.aliados.find((a) => a.id === params.id) || null;
    db.aliados = db.aliados.filter((a) => a.id !== params.id);
    // Limpia las clasificaciones que apuntaban a este aliado — si no, quedan huérfanas:
    // los movimientos dejarían de contarse como pendientes pero mostrarían un aliado inexistente.
    Object.keys(db.classifications).forEach((key) => {
      if (db.classifications[key].aliadoId === params.id) {
        db.classifications[key] = { ...db.classifications[key], aliadoId: null };
      }
    });
    return aliado;
  });
  if (removed) await logAudit(auth.user, "aliado.delete", { name: removed.name });
  return NextResponse.json({ ok: true });
}
