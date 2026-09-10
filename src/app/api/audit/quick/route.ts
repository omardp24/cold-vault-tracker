import { NextRequest, NextResponse } from "next/server";
import { checkSanctioned } from "@/lib/sanctions";
import { checkStablecoinBlacklist } from "@/lib/tronscan";
import type { Chain } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface QuickAuditRequest {
  addresses: { chain: Chain; address: string }[];
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body: QuickAuditRequest = await req.json();
  const list = (body.addresses || []).filter((a) => a.chain && a.address);
  // deduplicar por chain+address
  const uniqueMap = new Map<string, { chain: Chain; address: string }>();
  list.forEach((a) => uniqueMap.set(`${a.chain}:${a.address.toLowerCase()}`, a));
  const unique = Array.from(uniqueMap.values());

  const results: Record<string, { sanctioned: boolean; sanctionLists: string[]; blacklisted: boolean }> = {};

  await Promise.all(
    unique.map(async (a) => {
      const key = `${a.chain}:${a.address.toLowerCase()}`;
      const sanctions = await checkSanctioned(a.chain, a.address);
      let blacklisted = false;
      if (a.chain === "TRON") {
        const bl = await checkStablecoinBlacklist(a.address);
        blacklisted = bl.blacklisted;
      }
      results[key] = { sanctioned: sanctions.sanctioned, sanctionLists: sanctions.lists, blacklisted };
    })
  );

  return NextResponse.json(results);
}
