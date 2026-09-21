import { GoogleGenAI } from "@google/genai";

// Cliente y modelos de Gemini compartidos. Dos niveles: el ligero para chat/tareas cortas y el más
// capaz para lo que pide más razonamiento (clasificar en lote, analizar el mes). Se pueden cambiar
// por variable de entorno sin tocar código.
export const MODEL_FAST = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
export const MODEL_PRO = process.env.GEMINI_MODEL_PRO || "gemini-3.5-flash";

let client: GoogleGenAI | null = null;
export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}
