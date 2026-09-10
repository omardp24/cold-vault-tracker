import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    const db = await readDb();
    if (!user) return NextResponse.json({ user: null, hasAnyUser: db.users.length > 0 });
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, hasAnyUser: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error de conexión con la base de datos." }, { status: 500 });
  }
}
