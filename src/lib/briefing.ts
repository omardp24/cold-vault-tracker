import type { Movement } from "./chains/types";
import type { DB } from "./db";
import { narrate, usd } from "./narrative";
import { assessSuspicion, buildKnownIndex } from "./suspicious";

// Resumen del día para la notificación push: cifras calculadas en código (entradas/salidas de las
// últimas 24 h, pendientes, sospechosas, variación del portafolio) y Gemini solo las redacta.

export interface BriefingInput {
  db: DB;
  recent: (Movement & { walletLabel: string })[]; // movimientos de las últimas 24 h ya traídos por el cron
  priceLookup: Record<string, number | null>;
  total: number;
  prevTotal: number | null;
  failedWallets: string[];
}

export async function buildBriefing(i: BriefingInput): Promise<{ title: string; body: string } | null> {
  const { db, recent, priceLookup } = i;
  if (recent.length === 0) return null;

  const isOwn = (m: Movement) => !!m.counterparty && db.wallets.some((w) => w.chain === m.chain && w.address.toLowerCase() === m.counterparty!.toLowerCase());
  const px = (m: Movement) => (!m.verified ? 0 : (priceLookup[m.asset] ?? (["USDT", "USDC", "DAI"].includes(m.asset.toUpperCase()) ? 1 : 0)) || 0);
  const contactsList = [
    ...db.wallets.map((w) => ({ chain: w.chain as string, address: w.address })),
    ...db.aliados.flatMap((a) => a.addresses.map((x) => ({ chain: x.chain as string, address: x.address }))),
  ];
  const contacts = buildKnownIndex(contactsList);
  const seen = buildKnownIndex([...contactsList, ...recent.filter((m) => m.direction === "out" && m.counterparty).map((m) => ({ chain: m.chain as string, address: m.counterparty! }))]);

  let entradas = 0, salidas = 0, nEntradas = 0, nSalidas = 0, pendientes = 0, sospechosas = 0, internas = 0;
  for (const m of recent) {
    if (isOwn(m)) { internas++; continue; }
    const value = px(m) * m.amount;
    if (assessSuspicion({ chain: m.chain, direction: m.direction, counterparty: m.counterparty, usd: value || null, verified: m.verified }, contacts, seen)) { sospechosas++; continue; }
    const cl = db.classifications[m.key];
    if (cl?.isFee) continue;
    if (m.direction === "in") { entradas += value; nEntradas++; } else { salidas += value; nSalidas++; }
    const byAddr = m.counterparty ? db.aliados.some((a) => a.addresses.some((x) => x.address.toLowerCase() === m.counterparty!.toLowerCase())) : false;
    if (!(cl?.aliadoId || byAddr) || !cl?.concepto?.trim()) pendientes++;
  }
  const delta = i.prevTotal ? i.total - i.prevTotal : null;

  const facts = {
    ultimas_24h: { entradas: { cantidad: nEntradas, usd: Math.round(entradas) }, salidas: { cantidad: nSalidas, usd: Math.round(salidas) }, transferencias_internas: internas },
    pendientes_por_clasificar: pendientes, posible_polvo_o_fraude: sospechosas,
    portafolio_total_usd: Math.round(i.total), variacion_desde_ayer_usd: delta === null ? null : Math.round(delta),
    wallets_sin_leer: i.failedWallets,
  };
  const fallback =
    `Entraron ${usd(entradas)} (${nEntradas}) y salieron ${usd(salidas)} (${nSalidas}). ` +
    (pendientes ? `${pendientes} por clasificar. ` : "Todo clasificado. ") +
    (sospechosas ? `${sospechosas} posible polvo/fraude. ` : "") + `Portafolio: ${usd(i.total)}.`;
  const { text } = await narrate({
    instruction: "Redacta un resumen MUY breve (máximo 2 frases, 45 palabras) para una notificación push de Cold Vault sobre las últimas 24 horas. Empieza por lo más importante (movimientos, pendientes por clasificar, alertas). Sin viñetas ni markdown.",
    facts, fallback,
  });
  return { title: "Resumen del día", body: text.replace(/\s+/g, " ").slice(0, 230) };
}
