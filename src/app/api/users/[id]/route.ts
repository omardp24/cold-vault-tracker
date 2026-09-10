import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { logAudit } from "@/lib/auditLog";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Solo el propietario puede quitar acceso." }, { status: 403 });
  if (params.id === user.id) return NextResponse.json({ error: "No puedes quitarte acceso a ti mismo." }, { status: 400 });

  const removed = await updateDb((db) => {
    const target = db.users.find((u) => u.id === params.id) || null;
    db.users = db.users.filter((u) => u.id !== params.id);
    // invalidar todas las sesiones de ese usuario
    for (const [token, s] of Object.entries(db.sessions)) {
      if (s.userId === params.id) delete db.sessions[token];
    }
    return target;
  });
  if (removed) await logAudit(user, "user.revoke", { name: removed.name, email: removed.email });
  return NextResponse.json({ ok: true });
}
