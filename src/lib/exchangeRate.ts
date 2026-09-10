export interface VesRates {
  bcv: number | null;
  paralelo: number | null;
}

// API pública de pydolarve.org (BCV oficial + monitor paralelo). No pude verificar la forma
// exacta de la respuesta en vivo desde este entorno (el sandbox de desarrollo no resuelve ese
// dominio — sí lo resolverá el server real en producción), así que esto busca el precio en
// varias rutas plausibles dentro del JSON en vez de asumir una sola forma; si ninguna calza,
// devuelve null para ese campo en vez de romper la tarjeta de portafolio.
function extractPrice(data: any, monitorKey: string): number | null {
  if (!data) return null;
  const candidates = [
    data?.monitors?.[monitorKey]?.price,
    data?.price,
    data?.promedio,
    data?.monitors && Object.values(data.monitors)[0] && (Object.values(data.monitors)[0] as any).price,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && c > 0) return c;
  }
  return null;
}

async function fetchOne(page: string, monitorKey: string): Promise<number | null> {
  try {
    const res = await fetch(`https://pydolarve.org/api/v1/dolar?page=${page}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return extractPrice(data, monitorKey);
  } catch {
    return null;
  }
}

export async function fetchVesRates(): Promise<VesRates> {
  const [bcv, paralelo] = await Promise.all([
    fetchOne("bcv", "bcv"),
    fetchOne("enparalelovzla", "enparalelovzla"),
  ]);
  return { bcv, paralelo };
}
