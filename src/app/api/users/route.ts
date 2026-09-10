import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createInvite } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { logAudit } from "@/lib/auditLog";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const db = await readDb();
  const users = db.users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt }));
  const invites = user.role === "owner"
    ? db.invites.map((i) => ({ code: i.code, createdAt: i.createdAt, expiresAt: i.expiresAt, usedBy: i.usedBy }))
    : [];
  return NextResponse.json({ users, invites, me: user.id, myRole: user.role });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Solo el propietario puede invitar personas." }, { status: 403 });
  const code = await createInvite(user.id);
  await logAudit(user, "user.invite", { code });
  return NextResponse.json({ code });
}
