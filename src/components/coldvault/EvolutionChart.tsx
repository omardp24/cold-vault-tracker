"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { fmtUSD } from "./shared";

export type HistoryRange = "7d" | "90d" | "1y";
export interface PortfolioHistoryPoint { date: string; value: number; }

export default function EvolutionChart({ history, loading }: { history: PortfolioHistoryPoint[]; loading: boolean }) {
  if (loading) {
    return <div className="h-[220px] flex items-center justify-center text-[12.5px]" style={{ color: "var(--faint)" }}>Cargando…</div>;
  }
  // Con un solo punto (o ninguno) no hay línea que trazar todavía — el cron recién
  // empieza a guardar snapshots desde que se despliega, no hay forma de reconstruir
  // el valor histórico de antes de eso.
  if (history.length < 2) {
    return (
      <div className="h-[220px] flex flex-col items-center justify-center text-center px-4" style={{ color: "var(--faint)" }}>
        <div className="text-[12.5px]">Todavía no hay suficiente historial.</div>
        <div className="text-[11px] mt-1">Se guarda un snapshot del portafolio una vez al día — vuelve en unos días.</div>
      </div>
    );
  }
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--faint)" }} axisLine={false} tickLine={false} minTickGap={24} />
          <Tooltip
            formatter={(v: any) => [fmtUSD(v as number), "Total"]}
            contentStyle={{ background: "var(--panel2)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" }}
            labelStyle={{ color: "var(--dim)" }}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#evoFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
