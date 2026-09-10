import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const ATTACHMENTS_BUCKET = "cold-vault-attachments";

// Cliente perezoso: se crea la primera vez que realmente se usa, no al cargar el módulo.
// Next.js ejecuta el código de las rutas durante el build (para recolectar metadata) incluso
// sin variables de entorno reales todavía — instanciar el cliente ahí mismo rompería el build.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. Configúralos en .env.local (desarrollo) o en las variables de entorno de Vercel (producción)."
    );
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// Proxy para poder seguir escribiendo `supabase.from(...)` en el resto del código
// sin tener que llamar getSupabase() en cada sitio.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    // @ts-expect-error - acceso dinámico intencional
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
