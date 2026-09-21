import ExcelJS from "exceljs";
import type { StatementInput } from "./statementPdf";
import { caracasCalendarDate, fmtDateTime } from "./format";

const NAVY = "FF012D37";
const ORANGE = "FFF77B1C";
const GREEN = "FF008747";
const RED = "FFB23A3A";
const SURFACE = "FFF4F4F4";
const WHITE = "FFFFFFFF";

function headerRow(sheet: ExcelJS.Worksheet, labels: string[]) {
  const row = sheet.addRow(labels);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle" };
  });
  row.height = 20;
  return row;
}

export async function generateStatementExcel(input: StatementInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cold Vault";
  wb.created = new Date(input.generatedAt);

  // --- Portada / resumen ---
  const summary = wb.addWorksheet("Resumen");
  summary.columns = [{ width: 28 }, { width: 28 }];
  summary.mergeCells("A1:B1");
  const title = summary.getCell("A1");
  title.value = "COLD VAULT · Estado de Cuenta";
  title.font = { bold: true, size: 16, color: { argb: NAVY } };
  summary.mergeCells("A2:B2");
  summary.getCell("A2").value = "Comercializadora Agrícola Domínguez, C.A. — Portafolio de criptoactivos";
  summary.getCell("A2").font = { size: 10, color: { argb: "FF666666" } };

  summary.addRow([]);
  summary.addRow(["Generado", fmtDateTime(input.generatedAt)]);
  summary.addRow(["Por", input.generatedBy]);
  if (input.dateFrom || input.dateTo) summary.addRow(["Período", `${input.dateFrom || "inicio"} — ${input.dateTo || "hoy"}`]);
  summary.addRow([]);

  const valueRow = summary.addRow(["Valor total del portafolio", input.totalPortfolioValue]);
  valueRow.getCell(1).font = { bold: true, size: 11 };
  valueRow.getCell(2).font = { bold: true, size: 14, color: { argb: NAVY } };
  valueRow.getCell(2).numFmt = '"$"#,##0.00';

  if (input.incompleteWallets && input.incompleteWallets.length > 0) {
    const warn = summary.addRow(["⚠ TOTAL INCOMPLETO", `No se pudo leer el saldo de: ${input.incompleteWallets.join(", ")}`]);
    warn.getCell(1).font = { bold: true, color: { argb: RED } };
    warn.getCell(2).font = { color: { argb: RED } };
  }
  summary.addRow([]);

  if (input.flowSummary) {
    const h = summary.addRow(["FLUJO DEL PERÍODO", ""]);
    h.getCell(1).font = { bold: true, size: 11, color: { argb: NAVY } };
    const rIn = summary.addRow(["Entradas", input.flowSummary.inUsd]);
    rIn.getCell(2).numFmt = '"$"#,##0.00'; rIn.getCell(2).font = { color: { argb: GREEN }, bold: true };
    const rOut = summary.addRow(["Salidas", input.flowSummary.outUsd]);
    rOut.getCell(2).numFmt = '"$"#,##0.00'; rOut.getCell(2).font = { color: { argb: RED }, bold: true };
    const rNet = summary.addRow(["Neto", input.flowSummary.inUsd - input.flowSummary.outUsd]);
    rNet.getCell(2).numFmt = '"$"#,##0.00'; rNet.getCell(2).font = { bold: true };
    if (input.flowSummary.feeUsd > 0) {
      const rFee = summary.addRow(["Comisiones de red", input.flowSummary.feeUsd]);
      rFee.getCell(2).numFmt = '"$"#,##0.00';
    }
    summary.addRow(["", "Excluye transferencias entre wallets propias y comisiones de red."]).getCell(2).font = { size: 9, color: { argb: "FF666666" } };
    summary.addRow([]);
  }

  // --- Tenencias ---
  const holdings = wb.addWorksheet("Tenencias");
  holdings.columns = [{ width: 12 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 12 }];
  headerRow(holdings, ["Activo", "Cantidad", "Precio", "Valor", "% del total"]);
  input.holdings.forEach((h) => {
    const pct = input.totalPortfolioValue > 0 && h.value ? h.value / input.totalPortfolioValue : null;
    const row = holdings.addRow([h.symbol, h.amount, h.price, h.value, pct]);
    row.getCell(2).numFmt = "#,##0.000000";
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '"$"#,##0.00';
    row.getCell(4).font = { bold: true };
    row.getCell(5).numFmt = "0.0%";
  });

  // --- Movimientos ---
  const movs = wb.addWorksheet("Movimientos");
  movs.columns = [
    { width: 13 }, { width: 16 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 14 },
    { width: 26 }, { width: 20 }, { width: 26 },
  ];
  headerRow(movs, ["Fecha", "Wallet", "Red", "Tipo", "Activo", "Monto", "Contraparte", "Aliado", "Concepto"]);
  input.movements.forEach((m) => {
    const row = movs.addRow([
      m.date ? caracasCalendarDate(m.date) : "pendiente",
      m.walletLabel, m.chain, m.direction === "out" ? "Salida" : "Entrada",
      m.asset, m.amount, m.counterparty || "", m.aliado, m.concepto,
    ]);
    if (m.date) row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(6).numFmt = "#,##0.000000";
    row.getCell(4).font = { color: { argb: m.direction === "out" ? RED : GREEN }, bold: true };
    row.getCell(6).font = { color: { argb: m.direction === "out" ? RED : GREEN } };
  });
  movs.autoFilter = { from: "A1", to: "I1" };

  // --- Resumen por aliado ---
  if (input.aliadoOut.length > 0 || input.aliadoIn.length > 0) {
    const aliados = wb.addWorksheet("Por aliado");
    aliados.columns = [{ width: 24 }, { width: 10 }, { width: 28 }, { width: 16 }];
    if (input.aliadoOut.length > 0) {
      aliados.addRow(["PAGADO"]).getCell(1).font = { bold: true, color: { argb: RED } };
      headerRow(aliados, ["Aliado", "", "Montos", "Aprox. USD"]);
      input.aliadoOut.forEach((r) => {
        const row = aliados.addRow([r.name, "", r.assets, r.usdApprox]);
        row.getCell(4).numFmt = '"$"#,##0.00';
        row.getCell(4).font = { color: { argb: RED }, bold: true };
      });
      aliados.addRow([]);
    }
    if (input.aliadoIn.length > 0) {
      aliados.addRow(["RECIBIDO"]).getCell(1).font = { bold: true, color: { argb: GREEN } };
      headerRow(aliados, ["Aliado", "", "Montos", "Aprox. USD"]);
      input.aliadoIn.forEach((r) => {
        const row = aliados.addRow([r.name, "", r.assets, r.usdApprox]);
        row.getCell(4).numFmt = '"$"#,##0.00';
        row.getCell(4).font = { color: { argb: GREEN }, bold: true };
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
