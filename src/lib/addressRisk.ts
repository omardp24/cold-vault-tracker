import { checkSanctioned } from "./sanctions";
import { checkStablecoinBlacklist, checkAccountSecurity } from "./tronscan";
import type { Chain, DB } from "./db";

function fingerprint(addr: string): string {
  return addr.length >= 12 ? `${addr.slice(0, 6).toLowerCase()}…${addr.slice(-4).toLowerCase()}` : addr.toLowerCase();
}

export interface AddressRisk {
  verdict: "clean" | "caution" | "high_risk";
  sanctions: { sanctioned: boolean; lists: string[]; lastChecked: number };
  tronscanBlacklist: { blacklisted: boolean; tokens: string[] } | null;
  tronscanSecurity: { checked: boolean; hasFraudTransaction?: boolean; fraudTokenCreator?: boolean; sendAdByMemo?: boolean; isBlackList?: boolean } | null;
  tronscanRisky: boolean;
  poisoningMatches: { address: string; label: string }[];
}

/**
 * Núcleo de la auditoría de una dirección — sanciones OFAC + blacklist/fraude de Tronscan (solo
 * TRON) + "address poisoning" contra tus propias wallets y aliados. No incluye historial ni saldo
 * (eso lo agrega /api/audit/route.ts por separado, solo para la auditoría manual bajo demanda) —
 * este núcleo es liviano a propósito porque también lo llama el cron diario por cada movimiento
 * entrante nuevo, y ahí sí importa no encarecer la consulta con datos que no hacen falta para decidir
 * si avisar o no.
 */
export async function assessAddressRisk(chain: Chain, address: string, db: DB): Promise<AddressRisk> {
  const sanctions = await checkSanctioned(chain, address).catch(() => ({ sanctioned: false, lists: [] as string[], lastChecked: 0 }));

  let tronscanBlacklist: { blacklisted: boolean; tokens: string[] } | null = null;
  let tronscanSecurity: AddressRisk["tronscanSecurity"] = null;
  let tronscanRisky = false;
  if (chain === "TRON") {
    const [blacklist, security] = await Promise.all([
      checkStablecoinBlacklist(address),
      checkAccountSecurity(address),
    ]);
    tronscanBlacklist = blacklist;
    tronscanSecurity = security;
    tronscanRisky = blacklist.blacklisted || (security.checked && !!(security.hasFraudTransaction || security.fraudTokenCreator || security.isBlackList));
  }

  const known = [
    ...db.wallets.map((w) => ({ address: w.address, label: `tu wallet "${w.label}"` })),
    ...db.aliados.flatMap((a) => a.addresses.map((ad) => ({ address: ad.address, label: `tu aliado "${a.name}"` }))),
  ];
  const targetFp = fingerprint(address);
  const poisoningMatches = known
    .filter((k) => k.address.toLowerCase() !== address.toLowerCase() && fingerprint(k.address) === targetFp)
    .map((k) => ({ address: k.address, label: k.label }));

  const verdict: AddressRisk["verdict"] = sanctions.sanctioned || tronscanRisky || poisoningMatches.length > 0 ? "high_risk" : "clean";

  return {
    verdict,
    sanctions,
    tronscanBlacklist,
    tronscanSecurity,
    tronscanRisky,
    poisoningMatches,
  };
}
