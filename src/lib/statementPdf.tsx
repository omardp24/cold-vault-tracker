import React from "react";
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

Font.register({
  family: "Helvetica-Bold-Fallback",
  fonts: [],
});

const NAVY = "#012D37";
const ORANGE = "#F77B1C";
const GREEN = "#008747";
const RED = "#B23A3A";
const LINE = "#E5E7E8";
const DIM = "#666666";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#333333" },
  headerBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandBox: { width: 26, height: 26, borderRadius: 6, backgroundColor: NAVY, alignItems: "center", justifyContent: "center", marginRight: 8 },
  brandBoxText: { color: "#F8B345", fontSize: 12, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: NAVY },
  subtitle: { fontSize: 8, color: DIM, marginTop: 1 },
  metaRight: { alignItems: "flex-end" },
  metaLabel: { fontSize: 7, color: DIM, textTransform: "uppercase" },
  metaValue: { fontSize: 9, color: "#333333", marginTop: 1 },
  divider: { borderBottomWidth: 2, borderBottomColor: ORANGE, marginVertical: 10 },
  sectionTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 14, marginBottom: 6 },
  heroBox: { backgroundColor: NAVY, borderRadius: 8, padding: 14, marginBottom: 4 },
  heroLabel: { fontSize: 7.5, color: "#F8B345", textTransform: "uppercase", letterSpacing: 1 },
  heroValue: { fontSize: 20, color: "#FFFFFF", fontFamily: "Helvetica-Bold", marginTop: 3 },
  table: { borderTopWidth: 1, borderTopColor: LINE },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5, alignItems: "center" },
  trHead: { flexDirection: "row", backgroundColor: "#F4F4F4", paddingVertical: 5, alignItems: "center" },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: DIM, textTransform: "uppercase" },
  td: { fontSize: 8.5 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#999999" },
});

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

export interface StatementHolding { symbol: string; amount: number; price: number | null; value: number | null }
export interface StatementMovement {
  date: number | null; walletLabel: string; chain: string; direction: "in" | "out";
  asset: string; amount: number; counterparty: string | null; aliado: string; concepto: string;
}
export interface StatementAliadoRow { name: string; assets: string; usdApprox: number }
export interface StatementInput {
  generatedBy: string;
  generatedAt: number;
  dateFrom?: string;
  dateTo?: string;
  incompleteWallets?: string[];
  flowSummary?: { inUsd: number; outUsd: number; feeUsd: number };
  totalPortfolioValue: number;
  holdings: StatementHolding[];
  movements: StatementMovement[];
  aliadoOut: StatementAliadoRow[];
  aliadoIn: StatementAliadoRow[];
}

function Header({ input }: { input: StatementInput }) {
  return (
    <>
      <View style={styles.headerBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBox}><Text style={styles.brandBoxText}>CV</Text></View>
          <View>
            <Text style={styles.title}>COLD VAULT · Estado de Cuenta</Text>
            <Text style={styles.subtitle}>Comercializadora Agrícola Domínguez, C.A. — Portafolio de criptoactivos</Text>
          </View>
        </View>
        <View style={styles.metaRight}>
          <Text style={styles.metaLabel}>Generado</Text>
          <Text style={styles.metaValue}>{new Date(input.generatedAt).toLocaleString("es-VE")}</Text>
          <Text style={styles.metaLabel}>Por</Text>
          <Text style={styles.metaValue}>{input.generatedBy}</Text>
        </View>
      </View>
      <View style={styles.divider} />
      {(input.dateFrom || input.dateTo) && (
        <Text style={{ fontSize: 8, color: DIM, marginBottom: 4 }}>
          Período: {input.dateFrom || "inicio"} — {input.dateTo || "hoy"}
        </Text>
      )}
    </>
  );
}

export function StatementDocument({ input }: { input: StatementInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header input={input} />

        <View style={styles.heroBox}>
          <Text style={styles.heroLabel}>Valor total del portafolio</Text>
          <Text style={styles.heroValue}>{fmtUSD(input.totalPortfolioValue)}</Text>
        </View>
        {input.incompleteWallets && input.incompleteWallets.length > 0 && (
          <View style={{ backgroundColor: "#FBEBEB", borderWidth: 1, borderColor: RED, borderRadius: 6, padding: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 8.5, color: RED, fontFamily: "Helvetica-Bold" }}>
              ADVERTENCIA: total incompleto
            </Text>
            <Text style={{ fontSize: 8, color: "#333333", marginTop: 2 }}>
              No se pudo leer el saldo de: {input.incompleteWallets.join(", ")}. El monto anterior NO incluye esas wallets.
            </Text>
          </View>
        )}

        {input.flowSummary && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1, backgroundColor: "#EAF6EF", borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 7, color: DIM, textTransform: "uppercase" }}>Entradas del período</Text>
              <Text style={{ fontSize: 12, color: GREEN, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{fmtUSD(input.flowSummary.inUsd)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#FBEBEB", borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 7, color: DIM, textTransform: "uppercase" }}>Salidas del período</Text>
              <Text style={{ fontSize: 12, color: RED, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{fmtUSD(input.flowSummary.outUsd)}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#F4F4F4", borderRadius: 6, padding: 8 }}>
              <Text style={{ fontSize: 7, color: DIM, textTransform: "uppercase" }}>Neto</Text>
              <Text style={{ fontSize: 12, color: NAVY, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{fmtUSD(input.flowSummary.inUsd - input.flowSummary.outUsd)}</Text>
            </View>
          </View>
        )}
        {input.flowSummary && input.flowSummary.feeUsd > 0 && (
          <Text style={{ fontSize: 7.5, color: DIM, marginTop: 5 }}>
            Comisiones de red del período: {fmtUSD(input.flowSummary.feeUsd)} (excluidas de entradas/salidas). Las transferencias entre wallets propias tampoco se cuentan.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Tenencias</Text>
        <View style={styles.table}>
          <View style={styles.trHead} fixed>
            <Text style={[styles.th, { width: "20%" }]}>Activo</Text>
            <Text style={[styles.th, { width: "25%" }]}>Cantidad</Text>
            <Text style={[styles.th, { width: "25%" }]}>Precio</Text>
            <Text style={[styles.th, { width: "30%" }]}>Valor</Text>
          </View>
          {input.holdings.map((h, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.td, { width: "20%", fontFamily: "Helvetica-Bold" }]}>{h.symbol}</Text>
              <Text style={[styles.td, { width: "25%" }]}>{fmtAmt(h.amount)}</Text>
              <Text style={[styles.td, { width: "25%" }]}>{fmtUSD(h.price)}</Text>
              <Text style={[styles.td, { width: "30%", fontFamily: "Helvetica-Bold" }]}>{fmtUSD(h.value)}</Text>
            </View>
          ))}
        </View>

        {(input.aliadoOut.length > 0 || input.aliadoIn.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Resumen por aliado</Text>
            {input.aliadoOut.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: RED, marginBottom: 3 }}>Pagado</Text>
                <View style={styles.table}>
                  <View style={styles.trHead}>
                    <Text style={[styles.th, { width: "40%" }]}>Aliado</Text>
                    <Text style={[styles.th, { width: "35%" }]}>Montos</Text>
                    <Text style={[styles.th, { width: "25%" }]}>Aprox. USD</Text>
                  </View>
                  {input.aliadoOut.map((r, i) => (
                    <View style={styles.tr} key={i}>
                      <Text style={[styles.td, { width: "40%" }]}>{r.name}</Text>
                      <Text style={[styles.td, { width: "35%" }]}>{r.assets}</Text>
                      <Text style={[styles.td, { width: "25%", color: RED, fontFamily: "Helvetica-Bold" }]}>{fmtUSD(r.usdApprox)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {input.aliadoIn.length > 0 && (
              <View>
                <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 }}>Recibido</Text>
                <View style={styles.table}>
                  <View style={styles.trHead}>
                    <Text style={[styles.th, { width: "40%" }]}>Aliado</Text>
                    <Text style={[styles.th, { width: "35%" }]}>Montos</Text>
                    <Text style={[styles.th, { width: "25%" }]}>Aprox. USD</Text>
                  </View>
                  {input.aliadoIn.map((r, i) => (
                    <View style={styles.tr} key={i}>
                      <Text style={[styles.td, { width: "40%" }]}>{r.name}</Text>
                      <Text style={[styles.td, { width: "35%" }]}>{r.assets}</Text>
                      <Text style={[styles.td, { width: "25%", color: GREEN, fontFamily: "Helvetica-Bold" }]}>{fmtUSD(r.usdApprox)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionTitle} break>Movimientos del período ({input.movements.length})</Text>
        <View style={styles.table}>
          <View style={styles.trHead} fixed>
            <Text style={[styles.th, { width: "13%" }]}>Fecha</Text>
            <Text style={[styles.th, { width: "15%" }]}>Wallet</Text>
            <Text style={[styles.th, { width: "18%" }]}>Monto</Text>
            <Text style={[styles.th, { width: "20%" }]}>Contraparte</Text>
            <Text style={[styles.th, { width: "17%" }]}>Aliado</Text>
            <Text style={[styles.th, { width: "17%" }]}>Concepto</Text>
          </View>
          {input.movements.map((m, i) => (
            <View style={styles.tr} key={i} wrap={false}>
              <Text style={[styles.td, { width: "13%", fontSize: 7.5 }]}>{fmtDate(m.date)}</Text>
              <Text style={[styles.td, { width: "15%", fontSize: 7.5 }]}>{m.walletLabel}</Text>
              <Text style={[styles.td, { width: "18%", color: m.direction === "out" ? RED : GREEN, fontFamily: "Helvetica-Bold" }]}>
                {m.direction === "out" ? "-" : "+"}{fmtAmt(m.amount)} {m.asset}
              </Text>
              <Text style={[styles.td, { width: "20%", fontSize: 7 }]}>{m.counterparty ? `${m.counterparty.slice(0, 8)}…${m.counterparty.slice(-4)}` : "—"}</Text>
              <Text style={[styles.td, { width: "17%", fontSize: 7.5 }]}>{m.aliado}</Text>
              <Text style={[styles.td, { width: "17%", fontSize: 7.5 }]}>{m.concepto || "—"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Cold Vault · Documento generado automáticamente para uso interno de administración</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function generateStatementPdf(input: StatementInput): Promise<Buffer> {
  return renderToBuffer(<StatementDocument input={input} />);
}
