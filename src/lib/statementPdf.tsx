import path from "path";
import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

// Fuentes propias (no las del sistema) para que el PDF coincida con el diseño hecho en Claude
// Design (modernist-23fe4502…, ver "Formato de exportación estado de cuenta.zip"). Se registran
// desde archivos locales (src/lib/fonts/) en vez de bajarlas de Google Fonts en cada generación —
// más rápido y no depende de que la red esté disponible justo cuando corre el cron mensual.
// outputFileTracingIncludes en next.config.mjs asegura que estos .ttf viajen con la función
// serverless en Vercel (si no, fs.readFileSync fallaría en producción aunque funcione en local).
const FONTS_DIR = path.join(process.cwd(), "src", "lib", "fonts");
Font.register({
  family: "Sora",
  fonts: [
    { src: path.join(FONTS_DIR, "Sora-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "Sora-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONTS_DIR, "Sora-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONTS_DIR, "Sora-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
Font.register({
  family: "IBM Plex Mono",
  fonts: [
    { src: path.join(FONTS_DIR, "IBMPlexMono-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTS_DIR, "IBMPlexMono-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONTS_DIR, "IBMPlexMono-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const NAVY = "#012D37";
const ORANGE = "#F77B1C";
const AMBER = "#F8B345";
const GREEN = "#008747";
const RED = "#B23A3A";
const LINE = "#E5E7E8";
const DIM = "#666666";
const INK = "#333333";
const TINT = "#F4F4F4";
const RED_TINT = "#FBEBEB";
const SORA = "Sora";
const MONO = "IBM Plex Mono";

const styles = StyleSheet.create({
  page: { padding: "14mm", fontFamily: SORA, fontSize: 9, color: INK },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: ORANGE },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandBox: { width: 20, height: 20, backgroundColor: NAVY, color: AMBER, alignItems: "center", justifyContent: "center", fontSize: 8.5, fontWeight: 700 },
  headerTitle: { fontSize: 9, fontWeight: 700, color: NAVY, letterSpacing: 0.5 },
  headerPeriod: { fontSize: 7.5, color: DIM, letterSpacing: 1.5, textTransform: "uppercase" },
  footer: { position: "absolute", bottom: "10mm", left: "14mm", right: "14mm", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 6, borderTopWidth: 1, borderTopColor: LINE, fontSize: 7, color: "#999999" },
  overline: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", color: ORANGE },
  periodBig: { fontFamily: SORA, fontSize: 26, fontWeight: 800, color: NAVY, marginTop: 6 },
  periodRange: { fontFamily: MONO, fontSize: 8.5, color: DIM, marginTop: 4 },
  metaLabel: { fontSize: 7, color: DIM, textTransform: "uppercase", letterSpacing: 0.8 },
  metaValue: { fontFamily: MONO, fontSize: 8, color: INK },
  heroBox: { backgroundColor: NAVY, padding: 14, marginTop: 14, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 20 },
  heroLabel: { fontSize: 7, color: AMBER, textTransform: "uppercase", letterSpacing: 1.5 },
  heroValue: { fontFamily: SORA, fontSize: 21, fontWeight: 800, color: "#FFFFFF", marginTop: 4 },
  heroCaption: { fontSize: 7.5, color: "#8FA9B1", textAlign: "right" },
  heroCaptionMono: { fontFamily: MONO, fontSize: 7.5, color: AMBER, textAlign: "right", marginTop: 2 },
  flowCard: { flex: 1, borderWidth: 1, borderColor: LINE, padding: "7pt 10pt" },
  flowLabel: { fontSize: 7, color: DIM, textTransform: "uppercase", letterSpacing: 1 },
  flowValue: { fontFamily: SORA, fontSize: 13, fontWeight: 700, marginTop: 3 },
  feeNote: { fontSize: 7.5, color: DIM, marginTop: 5 },
  h2: { fontFamily: SORA, fontSize: 11, fontWeight: 700, color: NAVY, marginTop: 18, paddingBottom: 5, borderBottomWidth: 2, borderBottomColor: NAVY },
  table: { borderTopWidth: 1, borderTopColor: LINE, marginTop: 8 },
  trHead: { flexDirection: "row", backgroundColor: TINT, paddingVertical: 4, alignItems: "center" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 4, alignItems: "center" },
  th: { fontSize: 6.5, fontWeight: 700, color: DIM, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 5 },
  td: { fontSize: 7.8, paddingHorizontal: 5 },
  tdMono: { fontFamily: MONO, fontSize: 7.8, paddingHorizontal: 5 },
});

// ---- Formatters ----
function fmtUSD(n: number | null | undefined) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtAmt(n: number | null | undefined, d = 6) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: d });
}
function fmtDate(ms: number | null) {
  if (!ms) return "pendiente";
  return new Date(ms).toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}
function shortAddr(a: string | null) {
  return a ? `${a.slice(0, 8)}…${a.slice(-4)}` : "—";
}
function periodLabels(dateFrom?: string, dateTo?: string): { big: string; range: string } {
  if (!dateFrom && !dateTo) return { big: "ESTADO DE CUENTA", range: "Todo el historial" };
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
  const range = `${from ? fmtDate(from.getTime()) : "inicio"} — ${to ? fmtDate(to.getTime()) : "hoy"}`;
  const lastDayOfMonth = from ? new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate() : 0;
  const isFullMonth = !!(from && to && from.getDate() === 1 && to.getFullYear() === from.getFullYear() && to.getMonth() === from.getMonth() && to.getDate() === lastDayOfMonth);
  if (isFullMonth && from) return { big: from.toLocaleDateString("es-VE", { month: "long", year: "numeric" }).toUpperCase(), range };
  return { big: "ESTADO DE CUENTA", range };
}

// ---- Tipos ----
export interface StatementHolding { symbol: string; amount: number; price: number | null; value: number | null }
export interface StatementMovement {
  date: number | null; walletLabel: string; chain: string; direction: "in" | "out";
  asset: string; amount: number; counterparty: string | null; aliado: string; concepto: string;
}
export interface StatementAliadoRow { name: string; assets: string; usdApprox: number }
export interface StatementWalletRow { label: string; chainLabel: string; aliadoCount: number; movCount: number; inUsd: number; outUsd: number; netUsd: number }
export interface StatementDetailMovement {
  date: number | null; direction: "in" | "out"; amount: number; asset: string;
  counterparty: string | null; txid: string; concepto: string; usd: number | null;
}
export interface StatementAliadoGroup { name: string; movs: StatementDetailMovement[]; inUsd: number; outUsd: number; netUsd: number; assetsNetLabel: string }
export interface StatementWalletBlock { label: string; chainLabel: string; address: string; inUsd: number; outUsd: number; netUsd: number; groups: StatementAliadoGroup[] }
export interface StatementFeeRow { date: number | null; walletLabel: string; amount: number; asset: string; usd: number | null; txid: string }
export interface StatementInternalRow { date: number | null; fromWallet: string; toWallet: string; amount: number; asset: string; txid: string }
export interface StatementUnclassifiedRow { date: number | null; walletLabel: string; direction: "in" | "out"; amount: number; asset: string; counterparty: string | null; txid: string; usd: number | null }

export interface StatementInput {
  generatedBy: string;
  generatedAt: number;
  dateFrom?: string;
  dateTo?: string;
  incompleteWallets?: string[];
  flowSummary?: { inUsd: number; outUsd: number; feeUsd: number };
  totalPortfolioValue: number;
  walletCount: number;
  holdings: StatementHolding[];
  movements: StatementMovement[];
  aliadoOut: StatementAliadoRow[];
  aliadoIn: StatementAliadoRow[];
  walletRows: StatementWalletRow[];
  walletBlocks: StatementWalletBlock[];
  fees: StatementFeeRow[];
  internals: StatementInternalRow[];
  unclassified: StatementUnclassifiedRow[];
}

const HOLDING_COLORS = [NAVY, ORANGE, GREEN, AMBER, "#2E6B8C", "#82C35A", "#B23A3A"];

function Header({ periodShort }: { periodShort: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerBrand}>
        <View style={styles.brandBox}><Text>CV</Text></View>
        <Text style={styles.headerTitle}>COLD VAULT · Estado de cuenta</Text>
      </View>
      <Text style={styles.headerPeriod}>{periodShort}</Text>
    </View>
  );
}

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>Cold Vault · Documento generado automáticamente para uso interno de administración</Text>
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );
}

export function StatementDocument({ input }: { input: StatementInput }) {
  const { big: periodBig, range: periodRange } = periodLabels(input.dateFrom, input.dateTo);
  const periodShort = input.dateFrom || input.dateTo ? periodRange : "Historial completo";
  const total = input.totalPortfolioValue;
  const holdings = input.holdings.map((h, i) => ({ ...h, color: HOLDING_COLORS[i % HOLDING_COLORS.length], pct: total > 0 && h.value ? (h.value / total) * 100 : 0 }));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header periodShort={periodShort} />

        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginTop: 12 }}>
          <View>
            <Text style={styles.overline}>Estado de cuenta · Portafolio de criptoactivos</Text>
            <Text style={styles.periodBig}>{periodBig}</Text>
            <Text style={styles.periodRange}>{periodRange}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            {[
              ["Generado", new Date(input.generatedAt).toLocaleString("es-VE")],
              ["Por", input.generatedBy],
              ["Wallets", String(input.walletCount)],
              ["Movimientos", String(input.movements.length)],
            ].map(([label, value], i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: i === 0 ? 0 : 2 }}>
                <Text style={styles.metaLabel}>{label}</Text>
                <Text style={styles.metaValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.heroBox}>
          <View>
            <Text style={styles.heroLabel}>Valor total del portafolio</Text>
            <Text style={styles.heroValue}>{fmtUSD(total)}</Text>
          </View>
          <View>
            <Text style={styles.heroCaption}>Valorado a precio de mercado</Text>
            <Text style={styles.heroCaptionMono}>{new Date(input.generatedAt).toLocaleString("es-VE")}</Text>
          </View>
        </View>

        {input.incompleteWallets && input.incompleteWallets.length > 0 && (
          <View style={{ backgroundColor: RED_TINT, borderWidth: 1, borderColor: RED, padding: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 8.5, color: RED, fontWeight: 700 }}>ADVERTENCIA: total incompleto</Text>
            <Text style={{ fontSize: 8, color: INK, marginTop: 2 }}>
              No se pudo leer el saldo de: {input.incompleteWallets.join(", ")}. El monto anterior NO incluye esas wallets.
            </Text>
          </View>
        )}

        {input.flowSummary && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <View style={[styles.flowCard, { borderLeftWidth: 3, borderLeftColor: GREEN }]}>
              <Text style={styles.flowLabel}>Entradas del período</Text>
              <Text style={[styles.flowValue, { color: GREEN }]}>{fmtUSD(input.flowSummary.inUsd)}</Text>
            </View>
            <View style={[styles.flowCard, { borderLeftWidth: 3, borderLeftColor: RED }]}>
              <Text style={styles.flowLabel}>Salidas del período</Text>
              <Text style={[styles.flowValue, { color: RED }]}>{fmtUSD(input.flowSummary.outUsd)}</Text>
            </View>
            <View style={[styles.flowCard, { borderLeftWidth: 3, borderLeftColor: NAVY, backgroundColor: TINT }]}>
              <Text style={styles.flowLabel}>Neto</Text>
              <Text style={[styles.flowValue, { color: NAVY }]}>{fmtUSD(input.flowSummary.inUsd - input.flowSummary.outUsd)}</Text>
            </View>
          </View>
        )}
        {input.flowSummary && (
          <Text style={styles.feeNote}>
            Comisiones de red del período: {fmtUSD(input.flowSummary.feeUsd)} (excluidas de entradas y salidas). Las transferencias entre wallets propias tampoco se cuentan.
          </Text>
        )}

        {/* ---- Tenencias ---- */}
        <Text style={styles.h2}>Tenencias</Text>
        {holdings.length > 0 && (
          <>
            <View style={{ flexDirection: "row", height: 7, marginTop: 10, gap: 2 }}>
              {holdings.map((h, i) => <View key={i} style={{ backgroundColor: h.color, width: `${Math.max(h.pct, 0.5)}%` }} />)}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
              {holdings.map((h, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 7, height: 7, backgroundColor: h.color }} />
                  <Text style={{ fontSize: 7.5, fontWeight: 600, color: INK }}>{h.symbol}</Text>
                  <Text style={{ fontFamily: MONO, fontSize: 7.5, color: DIM }}>{h.pct.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}
        <View style={styles.table}>
          <View style={styles.trHead} fixed>
            <Text style={[styles.th, { width: "16%" }]}>Activo</Text>
            <Text style={[styles.th, { width: "23%", textAlign: "right" }]}>Cantidad</Text>
            <Text style={[styles.th, { width: "23%", textAlign: "right" }]}>Precio</Text>
            <Text style={[styles.th, { width: "23%", textAlign: "right" }]}>Valor</Text>
            <Text style={[styles.th, { width: "15%", textAlign: "right" }]}>% total</Text>
          </View>
          {holdings.map((h, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={[styles.td, { width: "16%", fontWeight: 700, color: NAVY }]}>{h.symbol}</Text>
              <Text style={[styles.tdMono, { width: "23%", textAlign: "right" }]}>{fmtAmt(h.amount)}</Text>
              <Text style={[styles.tdMono, { width: "23%", textAlign: "right", color: DIM }]}>{fmtUSD(h.price)}</Text>
              <Text style={[styles.tdMono, { width: "23%", textAlign: "right", fontWeight: 600 }]}>{fmtUSD(h.value)}</Text>
              <Text style={[styles.tdMono, { width: "15%", textAlign: "right", color: DIM }]}>{h.pct.toFixed(1)}%</Text>
            </View>
          ))}
          <View style={[styles.tr, { borderBottomWidth: 2, borderBottomColor: NAVY, borderTopWidth: 1, borderTopColor: LINE }]} wrap={false}>
            <Text style={[styles.td, { width: "16%", fontWeight: 700, color: NAVY }]}>Total</Text>
            <Text style={{ width: "23%" }} />
            <Text style={{ width: "23%" }} />
            <Text style={[styles.tdMono, { width: "23%", textAlign: "right", fontWeight: 700, color: NAVY }]}>{fmtUSD(total)}</Text>
            <Text style={[styles.tdMono, { width: "15%", textAlign: "right", color: DIM }]}>100.0%</Text>
          </View>
        </View>

        {/* ---- Resumen por wallet ---- */}
        {input.walletRows.length > 0 && (
          <>
            <Text style={styles.h2}>Resumen por wallet</Text>
            <View style={styles.table}>
              <View style={styles.trHead} fixed>
                <Text style={[styles.th, { width: "24%" }]}>Wallet</Text>
                <Text style={[styles.th, { width: "13%" }]}>Red</Text>
                <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Aliados</Text>
                <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>Movs.</Text>
                <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>Entradas</Text>
                <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>Salidas</Text>
                <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>Neto</Text>
              </View>
              {input.walletRows.map((w, i) => (
                <View style={styles.tr} key={i} wrap={false}>
                  <Text style={[styles.td, { width: "24%", fontWeight: 600, color: NAVY }]}>{w.label}</Text>
                  <Text style={[styles.td, { width: "13%", color: DIM }]}>{w.chainLabel}</Text>
                  <Text style={[styles.tdMono, { width: "12%", textAlign: "right" }]}>{w.aliadoCount}</Text>
                  <Text style={[styles.tdMono, { width: "12%", textAlign: "right" }]}>{w.movCount}</Text>
                  <Text style={[styles.tdMono, { width: "13%", textAlign: "right", color: GREEN }]}>{fmtUSD(w.inUsd)}</Text>
                  <Text style={[styles.tdMono, { width: "13%", textAlign: "right", color: RED }]}>{fmtUSD(w.outUsd)}</Text>
                  <Text style={[styles.tdMono, { width: "13%", textAlign: "right", fontWeight: 600, color: NAVY }]}>{fmtUSD(w.netUsd)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ---- Detalle por wallet y aliado ---- */}
        {input.walletBlocks.length > 0 && (
          <>
            <Text style={styles.h2} break>Detalle por wallet y aliado</Text>
            <Text style={{ fontSize: 7.5, color: DIM, marginTop: 5 }}>
              Cada wallet abre su propio bloque; dentro, un sub-bloque por aliado con sus movimientos, contraparte y hash de transacción.
            </Text>
            {input.walletBlocks.map((w, wi) => (
              <View key={wi} style={{ marginTop: 14 }}>
                <View style={{ backgroundColor: NAVY, color: "#FFFFFF", padding: "6pt 10pt", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }} wrap={false}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text style={{ fontFamily: SORA, fontSize: 10, fontWeight: 700, color: "#FFFFFF" }}>{w.label}</Text>
                    <Text style={{ fontSize: 6.5, color: AMBER, textTransform: "uppercase", letterSpacing: 1 }}>{w.chainLabel}</Text>
                    <Text style={{ fontFamily: MONO, fontSize: 7, color: "#8FA9B1" }}>{shortAddr(w.address)}</Text>
                  </View>
                  <Text style={{ fontFamily: MONO, fontSize: 8 }}>
                    <Text style={{ color: "#3ED598" }}>{`+${fmtUSD(w.inUsd)}`}</Text>
                    <Text style={{ color: "#8FA9B1" }}> · </Text>
                    <Text style={{ color: "#FF9B8E" }}>{`−${fmtUSD(w.outUsd)}`}</Text>
                  </Text>
                </View>

                {w.groups.map((g, gi) => (
                  <View key={gi} style={{ borderLeftWidth: 3, borderLeftColor: ORANGE, paddingLeft: 9, marginTop: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 3 }} wrap={false}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
                        <Text style={{ fontFamily: SORA, fontSize: 9, fontWeight: 700, color: NAVY }}>{g.name}</Text>
                        <Text style={{ fontSize: 6.5, color: DIM, textTransform: "uppercase" }}>{g.movs.length === 1 ? "1 movimiento" : `${g.movs.length} movimientos`}</Text>
                      </View>
                      <Text style={{ fontFamily: MONO, fontSize: 7.5 }}>
                        <Text style={{ color: GREEN }}>{`+${fmtUSD(g.inUsd)}`}</Text>
                        <Text style={{ color: "#C9D8DD" }}> / </Text>
                        <Text style={{ color: RED }}>{`−${fmtUSD(g.outUsd)}`}</Text>
                        <Text style={{ color: DIM }}> → </Text>
                        <Text style={{ fontWeight: 600, color: NAVY }}>{fmtUSD(g.netUsd)}</Text>
                      </Text>
                    </View>
                    <Text style={{ fontFamily: MONO, fontSize: 7, color: DIM, marginTop: 3 }}>Neto por activo: {g.assetsNetLabel}</Text>

                    <View style={[styles.table, { marginTop: 5 }]}>
                      <View style={styles.trHead}>
                        <Text style={[styles.th, { width: "12%" }]}>Fecha</Text>
                        <Text style={[styles.th, { width: "18%", textAlign: "right" }]}>Monto</Text>
                        <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>USD</Text>
                        <Text style={[styles.th, { width: "18%" }]}>Contraparte</Text>
                        <Text style={[styles.th, { width: "17%" }]}>Hash</Text>
                        <Text style={[styles.th, { width: "22%" }]}>Concepto</Text>
                      </View>
                      {g.movs.map((m, mi) => (
                        <View style={styles.tr} key={mi} wrap={false}>
                          <Text style={[styles.tdMono, { width: "12%", fontSize: 7, color: DIM }]}>{fmtDate(m.date)}</Text>
                          <Text style={[styles.tdMono, { width: "18%", textAlign: "right", fontWeight: 600, color: m.direction === "out" ? RED : GREEN }]}>
                            {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                          </Text>
                          <Text style={[styles.tdMono, { width: "13%", textAlign: "right", color: INK }]}>{fmtUSD(m.usd)}</Text>
                          <Text style={[styles.tdMono, { width: "18%", fontSize: 6.5, color: DIM }]}>{shortAddr(m.counterparty)}</Text>
                          <Text style={[styles.tdMono, { width: "17%", fontSize: 6.5, color: DIM }]}>{m.txid.slice(0, 12)}…</Text>
                          <Text style={[styles.td, { width: "22%", fontSize: 7 }]}>{m.concepto || "—"}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ---- Partidas fuera del flujo ---- */}
        {(input.fees.length > 0 || input.internals.length > 0 || input.unclassified.length > 0) && (
          <>
            <Text style={styles.h2}>Partidas fuera del flujo</Text>

            {input.fees.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: 1 }}>Comisiones de red</Text>
                <View style={styles.table}>
                  <View style={styles.trHead} fixed>
                    <Text style={[styles.th, { width: "16%" }]}>Fecha</Text>
                    <Text style={[styles.th, { width: "28%" }]}>Wallet</Text>
                    <Text style={[styles.th, { width: "20%", textAlign: "right" }]}>Monto</Text>
                    <Text style={[styles.th, { width: "16%", textAlign: "right" }]}>USD</Text>
                    <Text style={[styles.th, { width: "20%" }]}>Hash</Text>
                  </View>
                  {input.fees.map((f, i) => (
                    <View style={styles.tr} key={i} wrap={false}>
                      <Text style={[styles.tdMono, { width: "16%", fontSize: 7, color: DIM }]}>{fmtDate(f.date)}</Text>
                      <Text style={[styles.td, { width: "28%" }]}>{f.walletLabel}</Text>
                      <Text style={[styles.tdMono, { width: "20%", textAlign: "right" }]}>{fmtAmt(f.amount)} {f.asset}</Text>
                      <Text style={[styles.tdMono, { width: "16%", textAlign: "right" }]}>{fmtUSD(f.usd)}</Text>
                      <Text style={[styles.tdMono, { width: "20%", fontSize: 6.5, color: DIM }]}>{f.txid.slice(0, 12)}…</Text>
                    </View>
                  ))}
                  <View style={styles.tr} wrap={false}>
                    <Text style={[styles.td, { width: "44%", fontWeight: 600, color: NAVY }]}>Total comisiones</Text>
                    <Text style={[styles.tdMono, { width: "20%" }]} />
                    <Text style={[styles.tdMono, { width: "16%", textAlign: "right", fontWeight: 700, color: NAVY }]}>
                      {fmtUSD(input.fees.reduce((s, f) => s + (f.usd || 0), 0))}
                    </Text>
                    <Text style={{ width: "20%" }} />
                  </View>
                </View>
              </View>
            )}

            {input.internals.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: ORANGE, textTransform: "uppercase", letterSpacing: 1 }}>Transferencias internas</Text>
                <Text style={{ fontSize: 7.5, color: DIM, marginTop: 2 }}>Movimientos entre wallets propias. No afectan entradas, salidas ni neto.</Text>
                <View style={styles.table}>
                  <View style={styles.trHead} fixed>
                    <Text style={[styles.th, { width: "16%" }]}>Fecha</Text>
                    <Text style={[styles.th, { width: "26%" }]}>Origen</Text>
                    <Text style={[styles.th, { width: "26%" }]}>Destino</Text>
                    <Text style={[styles.th, { width: "16%", textAlign: "right" }]}>Monto</Text>
                    <Text style={[styles.th, { width: "16%" }]}>Hash</Text>
                  </View>
                  {input.internals.map((t, i) => (
                    <View style={styles.tr} key={i} wrap={false}>
                      <Text style={[styles.tdMono, { width: "16%", fontSize: 7, color: DIM }]}>{fmtDate(t.date)}</Text>
                      <Text style={[styles.td, { width: "26%" }]}>{t.fromWallet}</Text>
                      <Text style={[styles.td, { width: "26%" }]}>{t.toWallet}</Text>
                      <Text style={[styles.tdMono, { width: "16%", textAlign: "right" }]}>{fmtAmt(t.amount)} {t.asset}</Text>
                      <Text style={[styles.tdMono, { width: "16%", fontSize: 6.5, color: DIM }]}>{t.txid.slice(0, 12)}…</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {input.unclassified.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: RED, textTransform: "uppercase", letterSpacing: 1 }}>Sin clasificar</Text>
                <Text style={{ fontSize: 7.5, color: DIM, marginTop: 2 }}>Pendientes de asignar aliado y concepto. Sí cuentan en entradas y salidas del período.</Text>
                <View style={styles.table}>
                  <View style={[styles.trHead, { backgroundColor: RED_TINT }]} fixed>
                    <Text style={[styles.th, { width: "14%" }]}>Fecha</Text>
                    <Text style={[styles.th, { width: "20%" }]}>Wallet</Text>
                    <Text style={[styles.th, { width: "17%", textAlign: "right" }]}>Monto</Text>
                    <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>USD</Text>
                    <Text style={[styles.th, { width: "18%" }]}>Contraparte</Text>
                    <Text style={[styles.th, { width: "18%" }]}>Hash</Text>
                  </View>
                  {input.unclassified.map((m, i) => (
                    <View style={styles.tr} key={i} wrap={false}>
                      <Text style={[styles.tdMono, { width: "14%", fontSize: 7, color: DIM }]}>{fmtDate(m.date)}</Text>
                      <Text style={[styles.td, { width: "20%" }]}>{m.walletLabel}</Text>
                      <Text style={[styles.tdMono, { width: "17%", textAlign: "right", fontWeight: 600, color: m.direction === "out" ? RED : GREEN }]}>
                        {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
                      </Text>
                      <Text style={[styles.tdMono, { width: "13%", textAlign: "right" }]}>{fmtUSD(m.usd)}</Text>
                      <Text style={[styles.tdMono, { width: "18%", fontSize: 6.5, color: DIM }]}>{shortAddr(m.counterparty)}</Text>
                      <Text style={[styles.tdMono, { width: "18%", fontSize: 6.5, color: DIM }]}>{m.txid.slice(0, 12)}…</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ---- Anexo: todos los movimientos ---- */}
        <Text style={styles.h2} break>Anexo · Movimientos del período ({input.movements.length})</Text>
        <View style={styles.table}>
          <View style={styles.trHead} fixed>
            <Text style={[styles.th, { width: "12%" }]}>Fecha</Text>
            <Text style={[styles.th, { width: "14%" }]}>Wallet</Text>
            <Text style={[styles.th, { width: "17%", textAlign: "right" }]}>Monto</Text>
            <Text style={[styles.th, { width: "16%" }]}>Contraparte</Text>
            <Text style={[styles.th, { width: "18%" }]}>Aliado</Text>
            <Text style={[styles.th, { width: "23%" }]}>Concepto</Text>
          </View>
          {input.movements.map((m, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={[styles.tdMono, { width: "12%", fontSize: 7, color: DIM }]}>{fmtDate(m.date)}</Text>
              <Text style={[styles.td, { width: "14%", fontSize: 7.5 }]}>{m.walletLabel}</Text>
              <Text style={[styles.tdMono, { width: "17%", textAlign: "right", fontWeight: 600, color: m.direction === "out" ? RED : GREEN }]}>
                {m.direction === "out" ? "−" : "+"}{fmtAmt(m.amount)} {m.asset}
              </Text>
              <Text style={[styles.tdMono, { width: "16%", fontSize: 6.5, color: DIM }]}>{shortAddr(m.counterparty)}</Text>
              <Text style={[styles.td, { width: "18%", fontSize: 7.5 }]}>{m.aliado}</Text>
              <Text style={[styles.td, { width: "23%", fontSize: 7.5, color: DIM }]}>{m.concepto || "—"}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16, borderTopWidth: 2, borderTopColor: ORANGE, paddingTop: 7 }}>
          <Text style={{ fontSize: 7.5, color: DIM, lineHeight: 1.5 }}>
            Los valores en USD de movimientos históricos usan el precio de mercado vigente al momento de generar el documento, no el precio del día de la transacción. Documento de uso interno; no constituye un estado financiero auditado.
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

export async function generateStatementPdf(input: StatementInput): Promise<Buffer> {
  return renderToBuffer(<StatementDocument input={input} />);
}
