import { FIXED_STABLECOINS } from "./assets";
import { historyFetchers } from "./chains";
import type { HistoryPage, Movement } from "./chains/types";
import type { Chain, DB } from "./db";
import { fmtDate } from "./format";
import { assessSuspicion, buildKnownIndex, type Suspicion } from "./suspicious";

// ---------- Datos de apoyo ----------

export type RawMovement = Movement & { walletLabel: string };
export interface Loaded { rows: Row[]; raw: RawMovement[]; notas: string[] }

export interface Row {
  key: string; aliadoId: string | null;
  fecha: string; wallet: string; direccion: "entrada" | "salida"; monto: number; activo: string; usd: number | null;
  contraparte: string | null; aliado: string; concepto: string; estado: string; verificado: boolean; chain: Chain;
}

export async function loadMovements(db: DB, prices: Record<string, number | null>, dias: number): Promise<Loaded> {
  const since = Date.now() - dias * 86400_000;
  const notas: string[] = [];
  const collected: (Movement & { walletLabel: string })[] = [];
  const fetchOne = async (w: DB["wallets"][number]) => {
    try {
      const hist = (await historyFetchers[w.chain](w.address)) as HistoryPage;
      hist.movements.forEach((m) => collected.push({ ...m, walletLabel: w.label }));
    } catch (e: any) {
      notas.push(`No se pudo leer el historial de "${w.label}" (${e.message || "error"}).`);
    }
  };
  // TRON en serie (límite de tasa de TronGrid), el resto en paralelo — mismo criterio que el portafolio.
  await Promise.all(db.wallets.filter((w) => w.chain !== "TRON").map(fetchOne));
  for (const w of db.wallets.filter((w) => w.chain === "TRON")) await fetchOne(w);

  const own = (chain: Chain, addr: string | null) => !!addr && db.wallets.some((w) => w.chain === chain && w.address.toLowerCase() === addr.toLowerCase());
  const aliadoOf = (m: Movement) => {
    const cl = db.classifications[m.key];
    if (cl?.aliadoId) return db.aliados.find((a) => a.id === cl.aliadoId) || null;
    if (!m.counterparty) return null;
    const c = m.counterparty.toLowerCase();
    return db.aliados.find((a) => a.addresses.some((x) => x.address.toLowerCase() === c)) || null;
  };

  const raw = collected.filter((m) => m.date && m.date >= since).sort((a, b) => (b.date || 0) - (a.date || 0));
  const rows: Row[] = raw.map((m) => {
    const cl = db.classifications[m.key];
    const al = aliadoOf(m);
    const px = !m.verified ? null : prices[m.asset] ?? (FIXED_STABLECOINS.has(m.asset.toUpperCase()) ? 1 : null);
    const concepto = cl?.concepto?.trim() || "";
    const estado = own(m.chain, m.counterparty) ? "transferencia interna" : cl?.isFee ? "comisión de red" : !al || !concepto ? "pendiente" : "clasificado";
    return {
      key: m.key, aliadoId: al?.id ?? null, fecha: fmtDate(m.date), wallet: m.walletLabel, direccion: m.direction === "in" ? "entrada" : "salida", monto: m.amount, activo: m.asset,
      usd: px !== null ? Math.round(px * m.amount * 100) / 100 : null, contraparte: m.counterparty, aliado: al?.name || "sin clasificar",
      concepto, estado, verificado: m.verified, chain: m.chain,
    };
  });
  return { rows, raw, notas };
}

export const clampDias = (v: any) => Math.min(180, Math.max(1, Number(v) || 30));


/** Reglas fijas de polvo/fraude sobre lo cargado (las mismas que usa la app). Devuelve el índice en `raw` → sospecha. */
export function assessAll(db: DB, raw: RawMovement[], rows: Row[]): Map<number, Suspicion> {
  const contactsList = [
    ...db.wallets.map((w) => ({ chain: w.chain as string, address: w.address })),
    ...db.aliados.flatMap((a) => a.addresses.map((x) => ({ chain: x.chain as string, address: x.address }))),
  ];
  const paid = raw.filter((m) => m.direction === "out" && m.counterparty).map((m) => ({ chain: m.chain as string, address: m.counterparty! }));
  const contacts = buildKnownIndex(contactsList);
  const seen = buildKnownIndex([...contactsList, ...paid]);
  const own = (chain: Chain, addr: string | null) => !!addr && db.wallets.some((w) => w.chain === chain && w.address.toLowerCase() === addr.toLowerCase());
  const out = new Map<number, Suspicion>();
  raw.forEach((m, i) => {
    if (own(m.chain, m.counterparty)) return;
    const sus = assessSuspicion({ chain: m.chain, direction: m.direction, counterparty: m.counterparty, usd: rows[i].usd, verified: m.verified }, contacts, seen);
    if (sus) out.set(i, sus);
  });
  return out;
}
