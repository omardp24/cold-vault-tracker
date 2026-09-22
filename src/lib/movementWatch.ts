import { assessAddressRisk } from "./addressRisk";
import { historyFetchers } from "./chains";
import type { HistoryPage } from "./chains/types";
import type { DB } from "./db";
import { readDb, updateDb } from "./db";
import { sendToAll } from "./push";
import { supabase } from "./supabase";

export interface WatchResult {
  scanned: number;
  notified: number;
}

/**
 * Revisa las wallets en busca de movimientos nuevos y avisa por push de CADA UNO (no solo los
 * sin clasificar o riesgosos) — es la vigilancia "casi en tiempo real" que corre cada pocos
 * minutos desde fuera de Vercel (ver .github/workflows/watch-movements.yml), separada del cron
 * diario de Vercel (dailySync.ts), que solo corre una vez al día y hace el resto (snapshot,
 * resumen del día, reporte mensual). Mismo criterio de deduplicación que antes usaba dailySync:
 * la tabla `notified_movements` es compartida, así que un movimiento nunca se notifica dos veces
 * aunque ambos procesos lo vean.
 */
export async function watchAndNotifyMovements(db?: DB): Promise<WatchResult> {
  const state = db || (await readDb());
  let scanned = 0;
  let notified = 0;

  // Primera vez que corre esto: todo el historial actual (hasta ~25 por wallet) se marca como ya
  // visto SIN avisar — si no, activar la vigilancia dispararía un aviso por cada movimiento que ya
  // existía desde antes (decenas de golpe). Mismo espíritu que el "barrido inicial" del ingreso de
  // Gmail en Recordatorio: desde este punto en adelante sí se notifica todo lo nuevo.
  if (!state.movementWatchPrimed) {
    for (const w of state.wallets) {
      try {
        const hist = (await historyFetchers[w.chain](w.address)) as HistoryPage;
        const page = hist.movements.slice(0, 25);
        scanned += page.length;
        if (page.length > 0) {
          await supabase.from("notified_movements").upsert(page.map((m) => ({ movement_key: m.key })), { onConflict: "movement_key", ignoreDuplicates: true });
        }
      } catch (e) {
        console.error(`watchAndNotifyMovements (barrido inicial): error procesando wallet ${w.label}:`, e);
      }
    }
    await updateDb((d) => { d.movementWatchPrimed = true; });
    return { scanned, notified: 0 };
  }

  for (const w of state.wallets) {
    try {
      const hist = (await historyFetchers[w.chain](w.address)) as HistoryPage;
      const page = hist.movements.slice(0, 25); // un vistazo a lo más reciente, no todo el historial
      if (page.length === 0) continue;
      scanned += page.length;

      // Las claves de movimientos antes incluían la posición en la lista (ver lib/classificationKeys.ts).
      // Un movimiento también se considera conocido si ya hay una fila con el mismo `${red}-${txid}-…`,
      // sin importar el sufijo, para no reavisar de todo lo ya notificado con el formato viejo.
      const baseOf = (k: string) => k.replace(/-\d+$/, "");
      const orFilter = [`movement_key.in.(${page.map((m) => m.key).join(",")})`, ...page.map((m) => `movement_key.like.${m.chain}-${m.txid}-*`)].join(",");
      const { data: knownRows } = await supabase.from("notified_movements").select("movement_key").or(orFilter);
      const known = new Set((knownRows || []).flatMap((r) => [r.movement_key, baseOf(r.movement_key)]));
      const toMark: string[] = [];

      for (const m of page) {
        if (known.has(m.key) || known.has(baseOf(m.key))) continue;
        toMark.push(m.key);

        const classification = state.classifications[m.key];
        if (classification?.isFee) continue; // ya clasificado como comisión — no es una "operación" nueva que avisar

        const isInternal = !!m.counterparty && state.wallets.some((ow) => ow.chain === m.chain && ow.address.toLowerCase() === m.counterparty!.toLowerCase());

        if (isInternal) {
          const toLabel = state.wallets.find((ow) => ow.chain === m.chain && ow.address.toLowerCase() === m.counterparty!.toLowerCase())?.label;
          await sendToAll({
            title: "↔ Transferencia interna",
            body: `${m.amount} ${m.asset} de ${w.label} a ${toLabel || "otra de tus wallets"}`,
            data: { movementKey: m.key, chain: m.chain },
          });
          notified++;
          continue;
        }

        // Auditoría completa (sanciones OFAC + blacklist/fraude de Tronscan + "address poisoning"):
        // así una contraparte marcada como fraude/estafa también se resalta, no solo el caso OFAC.
        const risk = m.counterparty ? await assessAddressRisk(m.chain, m.counterparty, state).catch(() => null) : null;
        const isRisky = risk?.verdict === "high_risk";
        const unclassified = !classification?.aliadoId || !classification?.concepto?.trim();
        const riskReason = risk?.sanctions.sanctioned
          ? "está en lista OFAC"
          : risk?.tronscanRisky
          ? "está marcada como fraude/estafa en Tronscan"
          : risk?.poisoningMatches.length
          ? `se parece a ${risk.poisoningMatches[0].label}`
          : null;

        await sendToAll({
          title: isRisky
            ? "🚫 Movimiento con contraparte riesgosa"
            : m.direction === "in" ? "💰 Nuevo ingreso" : "📤 Nueva salida",
          body: isRisky
            ? `${m.direction === "out" ? "Salida hacia" : "Entrada desde"} una dirección que ${riskReason} — ${m.amount} ${m.asset} en ${w.label}`
            : `${m.direction === "out" ? "Salida" : "Entrada"} de ${m.amount} ${m.asset} en ${w.label}${unclassified ? " · sin clasificar" : ""}`,
          data: { movementKey: m.key, chain: m.chain },
        });
        notified++;
      }

      if (toMark.length > 0) {
        await supabase.from("notified_movements").upsert(toMark.map((k) => ({ movement_key: k })), { onConflict: "movement_key", ignoreDuplicates: true });
      }
    } catch (e) {
      console.error(`watchAndNotifyMovements: error procesando wallet ${w.label}:`, e);
    }
  }

  return { scanned, notified };
}
