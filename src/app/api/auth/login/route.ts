import { NextRequest, NextResponse } from "next/server";
import { attemptLogin, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body as { email: string; password: string };
    if (!email?.trim() || !password) return NextResponse.json({ error: "Correo y contraseña son requeridos." }, { status: 400 });

    const result = await attemptLogin(email, password);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const { user, token } = result;
    const res = NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
    res.cookies.set(sessionCookieOptions().name, token, sessionCookieOptions());
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error de conexión con la base de datos." }, { status: 500 });
  }
}
