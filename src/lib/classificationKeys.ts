import type { Classification } from "./db";

// Antes la clave de un movimiento TRON/ETH era `${chain}-${txid}-${posición en la lista}`. La
// posición cambia cada vez que llega un movimiento nuevo, así que los conceptos y aliados ya
// guardados quedaban "huérfanos" (el movimiento seguía ahí, pero su clave ya no coincidía).
// Ahora la clave es `${chain}-${txid}-${n}` donde n solo numera las transferencias repetidas
// dentro de una MISMA tx (estable). Esta migración recupera lo ya guardado: cada clave vieja
// trae el txid, así que se puede reasignar aunque su posición ya no coincida con la actual.
const LEGACY = /^(TRON|ETH)-(.+)-(\d+)$/;

const hasData = (c: Classification) => !!(c.aliadoId || c.concepto?.trim() || c.isFee);
const same = (a: Classification, b: Classification) =>
  (a.aliadoId ?? null) === (b.aliadoId ?? null) && (a.concepto ?? "") === (b.concepto ?? "") && !!a.isFee === !!b.isFee;

export function migrateLegacyClassificationKeys(input: Record<string, Classification>): Record<string, Classification> {
  const out: Record<string, Classification> = {};
  const groups: Record<string, { idx: number; c: Classification }[]> = {};

  for (const [key, c] of Object.entries(input)) {
    const m = LEGACY.exec(key);
    if (!m) { out[key] = c; continue; } // BTC u otros formatos: se dejan tal cual
    (groups[`${m[1]}-${m[2]}`] ||= []).push({ idx: parseInt(m[3], 10), c });
  }

  for (const [base, entries] of Object.entries(groups)) {
    entries.sort((a, b) => a.idx - b.idx);
    // Duplicados por el corrimiento de posiciones (mismo dato guardado bajo posiciones distintas): se colapsan.
    const distinct: Classification[] = [];
    for (const { c } of entries) {
      if (!hasData(c)) continue;
      if (!distinct.some((d) => same(d, c))) distinct.push(c);
    }
    distinct.forEach((c, occ) => { out[`${base}-${occ}`] = c; });
  }
  return out;
}
