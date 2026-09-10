"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, RefreshCw, Search } from "lucide-react";
import { fmtUSD } from "./shared";

interface MarketCoin {
  id: string; symbol: string; name: string; image: string;
  price: number; change1h: number | null; change24h: number; change7d: number | null;
  marketCap: number | null; volume24h: number | null; rank: number | null;
  sparkline: number[];
}

const fmtCompactUSD = (n: number | null | undefined) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2, style: "currency", currency: "USD" }).format(n);
};

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || isNaN(value)) return <span style={{ color: "var(--faint)" }}>—</span>;
  const positive = value >= 0;
  return (
    <span className="font-mono font-semibold" style={{ color: positive ? "var(--pos)" : "var(--neg)" }}>
      {positive ? "▲" : "▼"}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <div style={{ width: 96, height: 32 }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 96, h = 32;
  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const positive = data[data.length - 1] >= data[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" strokeWidth="1.5" style={{ stroke: positive ? "var(--pos)" : "var(--neg)" }} />
    </svg>
  );
}

export default function MarketView() {
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/market/top?full=1");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setCoins(d);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "No se pudo cargar el mercado.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coins;
    return coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [coins, search]);

  return (
    <div className="cv-card cv-card-hover p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1"><LineChart size={16} strokeWidth={2.25} style={{ color: "var(--ink)" }} /><div className="font-display text-sm font-semibold">Mercado</div></div>
          <div className="text-[11.5px]" style={{ color: "var(--dim)" }}>
            Las 100 criptomonedas de mayor capitalización, precio y movimiento en vivo (CoinGecko).
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastUpdated && <span className="text-[11px]" style={{ color: "var(--faint)" }}>Actualizado {lastUpdated.toLocaleTimeString("es-VE")}</span>}
          <button className="cv-btn-ghost cv-icon-btn" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
        <input
          className="cv-input w-full sm:w-72"
          style={{ paddingLeft: 34 }}
          placeholder="Buscar por nombre o símbolo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div className="text-xs mb-3" style={{ color: "var(--neg)" }}>{error}</div>}

      {coins.length === 0 ? (
        <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--dim)" }}>{loading ? "Cargando…" : "Sin datos."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 780 }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--faint)" }}>
                <th className="p-2 w-10">#</th>
                <th className="p-2">Activo</th>
                <th className="p-2 text-right">Precio</th>
                <th className="p-2 text-right">1h</th>
                <th className="p-2 text-right">24h</th>
                <th className="p-2 text-right">7d</th>
                <th className="p-2 text-right">Cap. de mercado</th>
                <th className="p-2 text-right">Volumen (24h)</th>
                <th className="p-2 text-right">Últimos 7 días</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="cv-row border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="p-2 font-mono text-[12px]" style={{ color: "var(--faint)" }}>{c.rank ?? "—"}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={c.image} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>{c.name}</div>
                        <div className="text-[10.5px]" style={{ color: "var(--faint)" }}>{c.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-right font-mono text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{fmtUSD(c.price)}</td>
                  <td className="p-2 text-right"><ChangeCell value={c.change1h} /></td>
                  <td className="p-2 text-right"><ChangeCell value={c.change24h} /></td>
                  <td className="p-2 text-right"><ChangeCell value={c.change7d} /></td>
                  <td className="p-2 text-right font-mono text-[12.5px]" style={{ color: "var(--dim)" }}>{fmtCompactUSD(c.marketCap)}</td>
                  <td className="p-2 text-right font-mono text-[12.5px]" style={{ color: "var(--dim)" }}>{fmtCompactUSD(c.volume24h)}</td>
                  <td className="p-2 text-right"><Sparkline data={c.sparkline} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--dim)" }}>Sin resultados para "{search}".</div>}
        </div>
      )}
    </div>
  );
}
