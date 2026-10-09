import type { DB } from "./db";
import { readDb, updateDb } from "./db";
import { sendMail } from "./mailer";
import { generateStatementPdf } from "./statementPdf";
import { buildWeeklyReport, type WeeklyReport } from "./weeklyReportBuild";

// Destinatario(s) del reporte semanal: variable WEEKLY_REPORT_TO (separados por coma) o, por defecto, el
// correo corporativo del dueño.
const recipients = () => (process.env.WEEKLY_REPORT_TO || "omdominguez@cadvenezuela.com").split(",").map((s) => s.trim()).filter(Boolean);

export interface WeeklySendResult {
  sent: boolean;
  skipped?: string;
  to?: string[];
  counts?: WeeklyReport["counts"];
}

/** Arma y envía el reporte semanal. Un segundo intento el mismo día (reintento del cron) no duplica el correo. */
export async function sendWeeklyReport(opts: { force?: boolean } = {}): Promise<WeeklySendResult> {
  const db: DB = await readDb();
  const report = await buildWeeklyReport(db);
  if (!opts.force && db.weeklyReportSentFor === report.toDay) return { sent: false, skipped: `ya se envió el ${report.toDay}`, counts: report.counts };

  const pdf = await generateStatementPdf(report.statementInput);
  const to = recipients();
  const ok = await sendMail({
    to: to.join(", "), subject: report.subject, html: report.html,
    attachments: [{ filename: `estado_cuenta_semana_${report.toDay}.pdf`, content: pdf }],
  });
  if (!ok) throw new Error("No se pudo enviar el correo (revisa GMAIL_SMTP_USER / GMAIL_SMTP_APP_PASSWORD).");
  await updateDb((d) => { d.weeklyReportSentFor = report.toDay; });
  return { sent: true, to, counts: report.counts };
}
