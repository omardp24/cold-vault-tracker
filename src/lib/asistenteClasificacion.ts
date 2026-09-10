import { GoogleGenAI, Type } from "@google/genai";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

export interface MovimientoAClasificar {
  chain: string;
  direction: "in" | "out";
  asset: string;
  amount: number;
}

export interface EjemploClasificado {
  chain: string;
  direction: "in" | "out";
  asset: string;
  amount: number;
  concepto: string;
  aliado?: string;
}

export interface ClasificacionSugerida {
  concepto: string;
  aliadoSugerido?: string;
}

/**
 * No intenta "adivinar" de quién es una dirección — no tiene forma de saberlo. Lo que sí
 * puede hacer útilmente: mirar cómo el usuario clasificó movimientos parecidos antes (mismo
 * activo/red/dirección, monto similar) y sugerir un concepto/aliado consistente con ese
 * patrón, para no repetir el mismo tipeo cada vez. Sin GEMINI_API_KEY o si la llamada falla,
 * devuelve null — nunca bloquea la clasificación manual normal.
 */
export async function sugerirClasificacion(
  movimiento: MovimientoAClasificar,
  ejemplos: EjemploClasificado[],
  aliadosConocidos: string[]
): Promise<ClasificacionSugerida | null> {
  const gen = getClient();
  if (!gen) return null;
  if (ejemplos.length === 0) return null; // sin historial parecido, no hay de dónde sacar un patrón

  try {
    const ejemplosTxt = ejemplos
      .slice(0, 8)
      .map((e) => `- ${e.direction === "out" ? "salida" : "entrada"} de ${e.amount} ${e.asset} (${e.chain}) → concepto: "${e.concepto}"${e.aliado ? `, aliado: "${e.aliado}"` : ""}`)
      .join("\n");

    const res = await gen.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents:
        `Estos son movimientos de criptomonedas que el usuario ya clasificó antes:\n${ejemplosTxt}\n\n` +
        `Ahora hay un movimiento nuevo sin clasificar: ${movimiento.direction === "out" ? "salida" : "entrada"} de ${movimiento.amount} ${movimiento.asset} en la red ${movimiento.chain}.\n` +
        `Basándote SOLO en el patrón de los ejemplos (monto parecido, mismo activo/red/dirección), sugiere un concepto corto (máximo 6 palabras) consistente con cómo el usuario clasifica este tipo de movimiento. Si claramente corresponde a uno de estos aliados conocidos (${aliadosConocidos.join(", ") || "ninguno"}), indícalo; si no hay suficiente parecido, no inventes uno.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepto: { type: Type.STRING },
            aliadoSugerido: { type: Type.STRING, nullable: true },
          },
          required: ["concepto"],
        },
      },
    });
    const text = res.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed.concepto) return null;
    return { concepto: parsed.concepto, aliadoSugerido: parsed.aliadoSugerido || undefined };
  } catch (e) {
    console.error("sugerirClasificacion() error:", e);
    return null;
  }
}
