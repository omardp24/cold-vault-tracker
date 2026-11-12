import type { Movement } from "./chains/types";
import type { Wallet } from "./db";

/**
 * Cambio de moneda (swap): sale un activo y entra otro distinto, en tus wallets de la misma red,
 * casi al mismo tiempo y por un valor parecido. Ej. real: 100 USDT salen de "Tron CAD" a un
 * servicio de cambio y 2 minutos después llegan 307 TRX a "Tron CAD 2" (para pagar gas).
 *
 * No es una entrada ni una salida de la tesorería — el dinero solo cambió de forma — así que, igual
 * que las transferencias internas, queda fuera de entradas/salidas/neto y no se pide clasificarlo.
 * Las dos patas suelen ser transacciones distintas (y hasta en wallets distintas), por eso se
 * emparejan por tiempo y valor en vez de por hash.
 */
export interface SwapPair { id: string; out: Movement; in: Movement }

const BEFORE_MS = 10 * 60_000; // lo recibido puede figurar un poco antes por el orden de bloques
const AFTER_MS = 60 * 60_000;
// Los precios son los de hoy (no los del día del cambio), así que el margen es amplio; con activos
// distintos dentro de una hora, un falso emparejamiento es muy raro.
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;

export function detectSwaps(
  movements: Movement[],
  wallets: Wallet[],
  priceOf: (m: Movement) => number | null,
  /** true = este movimiento no puede ser parte de un swap (ej. ya asignado a un aliado o marcado como comisión). */
  excluded: (m: Movement) => boolean = () => false,
): Map<string, SwapPair> {
  const own = (m: Movement) => !!m.counterparty && wallets.some((w) => w.chain === m.chain && w.address.toLowerCase() === m.counterparty!.toLowerCase());
  const cands = movements.filter((m) => m.verified && m.date && !own(m) && !excluded(m));
  const usd = (m: Movement) => { const p = priceOf(m); return p ? p * m.amount : null; };
  const outs = cands.filter((m) => m.direction === "out").sort((a, b) => a.date! - b.date!);
  const ins = cands.filter((m) => m.direction === "in");
  const used = new Set<string>();
  const result = new Map<string, SwapPair>();
  for (const o of outs) {
    const vo = usd(o);
    if (!vo || result.has(o.key)) continue;
    let best: Movement | null = null;
    let bestDt = Infinity;
    for (const i of ins) {
      if (used.has(i.key) || i.chain !== o.chain || i.asset === o.asset) continue;
      const dt = i.date! - o.date!;
      if (dt < -BEFORE_MS || dt > AFTER_MS) continue;
      const vi = usd(i);
      if (!vi) continue;
      const r = vi / vo;
      if (r < MIN_RATIO || r > MAX_RATIO) continue;
      if (Math.abs(dt) < bestDt) { best = i; bestDt = Math.abs(dt); }
    }
    if (!best) continue;
    const pair = { id: `${o.key}~${best.key}`, out: o, in: best };
    result.set(o.key, pair);
    result.set(best.key, pair);
    used.add(best.key);
  }
  return result;
}
