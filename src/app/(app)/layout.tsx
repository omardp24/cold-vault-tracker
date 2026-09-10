import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getSessionUser();
  } catch (e: any) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F4F4F4" }}>
        <div className="w-full max-w-md rounded-2xl p-7 text-center" style={{ background: "#FFFFFF", border: "1px solid #E5E7E8" }}>
          <div className="font-display text-lg font-bold mb-2" style={{ color: "#B23A3A" }}>No se pudo conectar con la base de datos</div>
          <div className="text-sm mb-3" style={{ color: "#333333" }}>{e.message}</div>
          <div className="text-xs" style={{ color: "#666666" }}>
            Revisa que <span className="font-mono">SUPABASE_URL</span> y <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> estén configurados correctamente (en <span className="font-mono">.env.local</span> local, o en las variables de entorno del proyecto en Vercel).
          </div>
        </div>
      </div>
    );
  }
  if (!user) redirect("/login");
  return <>{children}</>;
}
