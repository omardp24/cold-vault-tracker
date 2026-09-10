import { supabase } from "./supabase";

/**
 * Registra una acción en el log de auditoría interno. Nunca lanza — un fallo acá
 * (tabla no creada todavía, red caída) no debe tumbar la acción real que se está
 * auditando, solo se pierde ese registro.
 */
export async function logAudit(user: { id: string; name: string }, action: string, detail?: Record<string, any>): Promise<void> {
  try {
    const { error } = await supabase.from("audit_log").insert({
      user_id: user.id,
      user_name: user.name,
      action,
      detail: detail ?? null,
    });
    if (error) console.error("logAudit() error:", error.message);
  } catch (e: any) {
    console.error("logAudit() error:", e.message);
  }
}
