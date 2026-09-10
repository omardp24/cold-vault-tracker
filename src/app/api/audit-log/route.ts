import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Solo el propietario puede ver la actividad." }, { status: 403 });

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, user_name, action, detail")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
