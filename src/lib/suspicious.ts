// Detección de transferencias de "polvo" (dust) y de posible fraude por envenenamiento de direcciones
// (address poisoning): el atacante te manda 1–2 USD desde una dirección casi idéntica (mismos primeros y
// últimos caracteres) a una con la que ya operas, para que la copies del historial y le envíes fondos a él.
// Son reglas determinísticas a propósito: es un patrón mecánico y una regla acierta siempre igual y no
// cuesta nada; Gemini se usa después (asistente) para explicar y revisar los casos, no para adivinar.
// Módulo puro (sin React ni Node) para poder usarlo en el cliente y en el servidor.

export const DUST_MAX_USD = 5;
const LOOKALIKE_MAX_USD = 50; // un envenenamiento real manda montos chicos; uno de miles no es "polvo"

export interface Suspicion {
  kind: "fraude" | "polvo";
  label: string;
  reason: string;
  similarTo?: string;
}

const fp = (addr: string, chain: string) => {
  const a = addr.toLowerCase();
  const pre = chain === "ETH" ? 6 : 4; // 0x + 4 en ETH; 'T' + 3 en TRON
  return a.length >= 14 ? `${chain}:${a.slice(0, pre)}…${a.slice(-4)}` : null;
};

export interface KnownIndex {
  /** fingerprint → direcciones conocidas con ese fingerprint */
  byFp: Map<string, string[]>;
  known: Set<string>;
}

export function buildKnownIndex(addrs: { chain: string; address: string }[]): KnownIndex {
  const byFp = new Map<string, string[]>();
  const known = new Set<string>();
  for (const { chain, address } of addrs) {
    const lc = address.toLowerCase();
    known.add(lc);
    const key = fp(address, chain);
    if (!key) continue;
    const list = byFp.get(key) || [];
    if (!list.includes(lc)) list.push(lc);
    byFp.set(key, list);
  }
  return { byFp, known };
}

export interface SuspicionInput {
  chain: string;
  direction: "in" | "out";
  counterparty: string | null;
  usd: number | null;
  verified: boolean;
}

/**
 * `contacts` = wallets propias + aliados (a quién le pagas/cobras de verdad). `seen` = además, todas las
 * contrapartes de tus salidas: una dirección a la que ya enviaste dinero no es "polvo" desconocido.
 */
export function assessSuspicion(m: SuspicionInput, contacts: KnownIndex, seen: KnownIndex): Suspicion | null {
  if (!m.counterparty) return null;
  const cp = m.counterparty.toLowerCase();

  if (m.direction === "out") {
    // Lo más grave: enviar a una dirección casi idéntica a un contacto pero que NO es el contacto.
    const twins = (contacts.byFp.get(fp(m.counterparty, m.chain) || "") || []).filter((a) => a !== cp);
    if (twins.length > 0 && !contacts.known.has(cp)) {
      return { kind: "fraude", label: "Posible fraude", similarTo: twins[0], reason: "Enviaste fondos a una dirección casi idéntica a la de un contacto tuyo, pero no es la misma. Verifica en el explorador que no sea un envenenamiento de direcciones." };
    }
    return null;
  }

  if (contacts.known.has(cp)) return null; // un aliado o una wallet tuya nunca es polvo
  const twins = (seen.byFp.get(fp(m.counterparty, m.chain) || "") || []).filter((a) => a !== cp);
  const small = m.usd !== null && m.usd <= LOOKALIKE_MAX_USD;
  if (twins.length > 0 && (small || !m.verified || m.usd === null)) {
    return { kind: "fraude", label: "Posible fraude", similarTo: twins[0], reason: `Monto pequeño desde una dirección casi idéntica a otra con la que ya operas (${twins[0].slice(0, 6)}…${twins[0].slice(-4)}). Es el patrón típico de envenenamiento de direcciones: no la copies del historial.` };
  }
  if (!m.verified) return { kind: "polvo", label: "Token falso", reason: "El token dice ser una moneda conocida pero su contrato no es el oficial: es spam o intento de estafa." };
  if (m.usd !== null && m.usd <= DUST_MAX_USD && !seen.known.has(cp)) {
    return { kind: "polvo", label: "Polvo", reason: `Entrada de solo ${m.usd.toFixed(2)} USD desde una dirección desconocida: transferencia de "polvo" (dust), normalmente para rastrear o envenenar tu historial.` };
  }
  return null;
}
