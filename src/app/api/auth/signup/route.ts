import { NextRequest, NextResponse } from "next/server";
import { registerUser, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, inviteCode } = body as { email: string; password: string; name: string; inviteCode?: string };
    if (!email?.trim() || !password || password.length < 8 || !name?.trim()) {
      return NextResponse.json({ error: "Nombre, correo y una contraseña de al menos 8 caracteres son requeridos." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "El correo no tiene un formato válido." }, { status: 400 });
    }

    const result = await registerUser({ email, password, name, inviteCode });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    const res = NextResponse.json({ id: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role });
    res.cookies.set(sessionCookieOptions().name, result.token, sessionCookieOptions());
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error de conexión con la base de datos." }, { status: 500 });
  }
}
