import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId, TransferPlan, PlanLeg } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";

export async function GET() {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const db = await readDb();
  const sorted = [...db.plans].sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json(sorted);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (!auth.ok) return auth.res as any;
  const body = await req.json();
  const { targetAmount, targetAsset, destination, destLabel, legs } = body as {
    targetAmount: number; targetAsset: string; destination: string; destLabel?: string;
    legs: { walletId: string; walletLabel: string; chain: string; asset: string; amount: number; isTest: boolean }[];
  };
  if (!destination || !legs?.length) return NextResponse.json({ error: "destination y legs son requeridos" }, { status: 400 });

  const plan: TransferPlan = {
    id: newId(),
    createdAt: Date.now(),
    targetAmount: targetAmount || 0,
    targetAsset: targetAsset || "",
    destination,
    destLabel: destLabel || "",
    legs: legs.map((l): PlanLeg => ({
      id: newId(),
      walletId: l.walletId,
      walletLabel: l.walletLabel,
      chain: l.chain as any,
      asset: l.asset,
      amount: l.amount,
      isTest: l.isTest,
      done: false,
      doneAt: null,
      txHash: "",
      notes: "",
      attachments: [],
    })),
  };

  await updateDb((db) => {
    db.plans.push(plan);
  });
  await logAudit(auth.user, "plan.create", { destination: plan.destination, targetAmount: plan.targetAmount, targetAsset: plan.targetAsset });
  return NextResponse.json(plan, { status: 201 });
}
