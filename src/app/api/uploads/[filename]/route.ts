import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;

  // Next.js normalmente ya decodifica el parámetro dinámico (incluye "/" codificadas como %2F),
  // pero por si acaso llega sin decodificar, lo resolvemos de forma segura sin doble-decodificar.
  let storagePath = params.filename;
  if (/%2f/i.test(storagePath)) storagePath = decodeURIComponent(storagePath);
  if (storagePath.includes("..")) return NextResponse.json({ error: "ruta inválida" }, { status: 400 });

  // Link firmado de corta duración — el archivo real vive en un bucket privado de Supabase Storage,
  // nunca es público, cada vista pasa primero por nuestra propia verificación de sesión.
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || "archivo no encontrado" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
