// Acciones que el asistente PREPARA pero nunca ejecuta: el servidor las valida y las devuelve al
// cliente como tarjetas; solo se aplican cuando el usuario las confirma con un clic. Así el modelo
// no puede modificar datos por su cuenta (ni por texto malicioso que venga de la cadena).

export interface ClassifyItem {
  key: string;
  aliadoId: string | null;
  aliado: string;
  concepto: string;
  isFee?: boolean;
  detalle: string; // "12 sep · salida 500 USDT (≈$500) · Cold 1 · TXyz…abcd"
  confianza?: "alta" | "media";
  fuente?: "historial" | "ia" | "asistente";
  razon?: string;
}

export type AssistantAction =
  | { id: string; type: "clasificar"; titulo: string; items: ClassifyItem[] }
  | { id: string; type: "estado_cuenta"; titulo: string; desde: string; hasta: string; aliadoId: string | null; aliado: string | null };

export const shortAddr = (a: string | null) => (!a ? "—" : a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-5)}` : a);
