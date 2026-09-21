import { Type } from "@google/genai";
import type { ClassifyItem } from "./assistantActions";
import { shortAddr } from "./assistantActions";
import type { DB } from "./db";
import { getGemini, MODEL_PRO } from "./gemini";
import { assessAll, type Loaded, type Row } from "./movementsLoader";

// Clasificación automática por aprendizaje. Dos capas:
//  1) Determinista: si la misma contraparte (o el mismo aliado + dirección) ya se clasificó antes, se
//     reutiliza el aliado/concepto más frecuente. Es lo más fiable.
//  2) Gemini (modelo más capaz): para lo que queda, mira el patrón de cada aliado (conceptos, dirección,
//     rango de montos) y propone solo si el parecido es claro. Solo puede elegir aliados que YA existen.
// Nada se guarda aquí: devuelve propuestas que el usuario aprueba una a una.

const MAX_AI_ITEMS = 30;
const MAX_PROPOSALS = 40;

type Bucket = Map<string, { aliadoId: string; concepto: string; n: number }>;
const bump = (b: Bucket, aliadoId: string, concepto: string) => {
  const k = `${aliadoId}\u0000${concepto}`;
  const e = b.get(k);
  if (e) e.n++; else b.set(k, { aliadoId, concepto, n: 1 });
};
const best = (b: Bucket | undefined, only?: string | null) =>
  b ? [...b.values()].filter((e) => !only || e.aliadoId === only).sort((x, y) => y.n - x.n)[0] : undefined;

const safeSymbol = (s: string) => (/^[A-Za-z0-9._-]{1,12}$/.test(s) ? s : "TOKEN?");

export const detalleOf = (r: Row) =>
  `${r.fecha} · ${r.direccion} ${r.monto} ${safeSymbol(r.activo)}${r.usd !== null ? ` (≈$${r.usd})` : ""} · ${r.wallet} · ${shortAddr(r.contraparte)}`;

export interface ClassifyProposals {
  proposals: ClassifyItem[];
  pendientes: number; // pendientes elegibles (sin contar internas, comisiones ni sospechosas)
  sinPropuesta: number;
  notas: string[];
}

export async function proposeClassifications(db: DB, loaded: Loaded): Promise<ClassifyProposals> {
  const { rows, raw } = loaded;
  const susp = assessAll(db, raw, rows);
  const notas: string[] = [];

  // Historial: lo ya clasificado, por contraparte y por aliado+dirección.
  const byCp = new Map<string, Bucket>();
  const byAliadoDir = new Map<string, Bucket>();
  const perAliado = new Map<string, { concepts: Bucket; entradas: number; salidas: number; min: number; max: number }>();
  rows.forEach((r, i) => {
    if (r.estado !== "clasificado" || !r.aliadoId || !r.concepto || susp.has(i)) return;
    if (r.contraparte) {
      const k = `${r.chain}:${r.contraparte.toLowerCase()}`;
      bump(byCp.get(k) || byCp.set(k, new Map()).get(k)!, r.aliadoId, r.concepto);
    }
    const kd = `${r.aliadoId}|${r.direccion}`;
    bump(byAliadoDir.get(kd) || byAliadoDir.set(kd, new Map()).get(kd)!, r.aliadoId, r.concepto);
    const pa = perAliado.get(r.aliadoId) || perAliado.set(r.aliadoId, { concepts: new Map(), entradas: 0, salidas: 0, min: Infinity, max: 0 }).get(r.aliadoId)!;
    bump(pa.concepts, r.aliadoId, r.concepto);
    r.direccion === "entrada" ? pa.entradas++ : pa.salidas++;
    if (r.usd !== null) { pa.min = Math.min(pa.min, r.usd); pa.max = Math.max(pa.max, r.usd); }
  });

  const aliadoName = (id: string) => db.aliados.find((a) => a.id === id)?.name || "—";
  const pendingIdx = rows.map((r, i) => i).filter((i) => rows[i].estado === "pendiente" && rows[i].verificado && !susp.has(i));

  const proposals: ClassifyItem[] = [];
  const rest: number[] = [];
  for (const i of pendingIdx) {
    const r = rows[i];
    const cp = r.contraparte ? byCp.get(`${r.chain}:${r.contraparte.toLowerCase()}`) : undefined;
    // Si ya hay aliado (por dirección o clasificación parcial), solo se acepta historial de ese mismo aliado.
    const hit = best(cp, r.aliadoId) || (r.aliadoId ? best(byAliadoDir.get(`${r.aliadoId}|${r.direccion}`), r.aliadoId) : undefined);
    if (hit) {
      const viaCp = !!best(cp, r.aliadoId);
      proposals.push({
        key: r.key, aliadoId: hit.aliadoId, aliado: aliadoName(hit.aliadoId),
        concepto: r.concepto || hit.concepto, // si ya tenía concepto propio, se respeta
        detalle: detalleOf(r), fuente: "historial", confianza: viaCp && hit.n >= 2 ? "alta" : "media",
        razon: viaCp ? `Misma dirección clasificada ${hit.n} ${hit.n === 1 ? "vez" : "veces"} antes` : `Concepto más usado con este aliado en ${r.direccion}s`,
      });
    } else rest.push(i);
  }

  // Capa de IA para el resto (solo si hay aliados de donde elegir).
  let sinPropuesta = 0;
  if (rest.length > 0 && db.aliados.length > 0) {
    const gen = getGemini();
    const batch = rest.sort((a, b) => (rows[b].usd || 0) - (rows[a].usd || 0)).slice(0, MAX_AI_ITEMS);
    sinPropuesta = rest.length - batch.length;
    if (!gen) notas.push("La IA no está configurada (falta GEMINI_API_KEY): solo se usó el historial.");
    else {
      try {
        const aliadosCtx = db.aliados.map((a) => {
          const pa = perAliado.get(a.id);
          return {
            aliado: a.name,
            conceptos_frecuentes: pa ? [...pa.concepts.values()].sort((x, y) => y.n - x.n).slice(0, 4).map((c) => `${c.concepto} (${c.n})`) : [],
            movimientos_clasificados: pa ? { entradas: pa.entradas, salidas: pa.salidas } : { entradas: 0, salidas: 0 },
            rango_usd: pa && pa.max > 0 ? [Math.round(pa.min), Math.round(pa.max)] : null,
          };
        });
        const pend = batch.map((i, n) => ({ id: n + 1, direccion: rows[i].direccion, activo: safeSymbol(rows[i].activo), monto: rows[i].monto, usd: rows[i].usd, wallet: rows[i].wallet, fecha: rows[i].fecha, aliado_ya_asignado: rows[i].aliadoId ? aliadoName(rows[i].aliadoId!) : null, concepto_ya_escrito: rows[i].concepto || null }));
        const res = await gen.models.generateContent({
          model: MODEL_PRO,
          contents:
            `Eres el auditor de una empresa que mueve criptomonedas. Debes proponer aliado y concepto para movimientos aún sin clasificar, imitando cómo el usuario ya clasificó movimientos parecidos.\n\n` +
            `ALIADOS EXISTENTES Y SU PATRÓN:\n${JSON.stringify(aliadosCtx)}\n\nMOVIMIENTOS PENDIENTES:\n${JSON.stringify(pend)}\n\n` +
            `REGLAS: (1) "aliado" debe ser EXACTAMENTE uno de los aliados existentes; si ninguno encaja claramente, omite ese movimiento. (2) Considera dirección, rango de montos, wallet y conceptos frecuentes. (3) Si "aliado_ya_asignado" existe, úsalo. (4) Si "concepto_ya_escrito" existe, repítelo tal cual. (5) El concepto es corto (máx. 6 palabras), en el estilo de los conceptos frecuentes; no inventes datos. (6) confianza "alta" solo si el patrón es inequívoco; si dudas, "media" o no lo incluyas. (7) "razon" en una frase.`,
          config: {
            temperature: 0.2, responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                propuestas: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: { id: { type: Type.NUMBER }, aliado: { type: Type.STRING }, concepto: { type: Type.STRING }, confianza: { type: Type.STRING }, razon: { type: Type.STRING } },
                    required: ["id", "aliado", "concepto", "confianza", "razon"],
                  },
                },
              },
              required: ["propuestas"],
            },
          },
        });
        const parsed = JSON.parse(res.text || "{}");
        const used = new Set<number>();
        for (const p of parsed.propuestas || []) {
          const idx = batch[Number(p.id) - 1];
          const al = db.aliados.find((a) => a.name.toLowerCase() === String(p.aliado || "").trim().toLowerCase());
          const concepto = String(p.concepto || "").trim().slice(0, 80);
          if (idx === undefined || !al || !concepto || used.has(idx)) continue;
          const r = rows[idx];
          if (r.aliadoId && r.aliadoId !== al.id) continue;
          used.add(idx);
          proposals.push({
            key: r.key, aliadoId: al.id, aliado: al.name, concepto: r.concepto || concepto, detalle: detalleOf(r),
            fuente: "ia", confianza: p.confianza === "alta" ? "alta" : "media", razon: String(p.razon || "").slice(0, 160),
          });
        }
        sinPropuesta += batch.length - used.size;
      } catch (e: any) {
        console.error("proposeClassifications IA:", e?.message || e);
        notas.push("La IA no respondió; solo se usó el historial.");
        sinPropuesta += batch.length;
      }
    }
  } else sinPropuesta += rest.length;

  return { proposals: proposals.slice(0, MAX_PROPOSALS), pendientes: pendingIdx.length, sinPropuesta, notas };
}
