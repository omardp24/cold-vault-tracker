import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/db";
import { supabase, ATTACHMENTS_BUCKET } from "@/lib/supabase";
import { requireAuth } from "@/lib/auth";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
// Solo comprobantes: imágenes y PDF. Sin esto se podría subir cualquier tipo de archivo
// (incluidos ejecutables) al bucket de la empresa.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/heic", "application/pdf"]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const form = await req.formData();
  const legId = form.get("legId") as string | null;
  const file = form.get("file") as File | null;
  if (!legId || !file) return NextResponse.json({ error: "legId y file son requeridos" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "El archivo supera 8MB" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Solo se aceptan imágenes (PNG, JPG, GIF, WEBP, HEIC) o PDF." }, { status: 400 });
  }

  // Verifica que el plan/tramo existan ANTES de subir el archivo a Storage — evita un
  // upload huérfano si el id no es válido.
  const check = await readDb();
  const planCheck = check.plans.find((p) => p.id === params.id);
  if (!planCheck) return NextResponse.json({ error: "plan no encontrado" }, { status: 404 });
  if (!planCheck.legs.some((l) => l.id === legId)) return NextResponse.json({ error: "tramo no encontrado" }, { status: 404 });

  const safeOriginal = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storagePath = `${params.id}/${legId}/${newId()}-${safeOriginal}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `No se pudo subir el archivo: ${uploadError.message}` }, { status: 502 });
  }

  const attachment = {
    filename: storagePath,
    url: `/api/uploads/${encodeURIComponent(storagePath)}`,
    originalName: file.name,
    uploadedAt: Date.now(),
  };

  const result = await updateDb((db) => {
    const plan = db.plans.find((p) => p.id === params.id);
    if (!plan) return { error: "plan no encontrado" as const };
    const leg = plan.legs.find((l) => l.id === legId);
    if (!leg) return { error: "tramo no encontrado" as const };
    leg.attachments.push(attachment);
    return { plan };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ attachment, plan: result.plan });
}
