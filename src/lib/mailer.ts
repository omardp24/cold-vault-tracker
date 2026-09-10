import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined; // undefined = todavía no se intentó crear

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const { GMAIL_SMTP_USER, GMAIL_SMTP_APP_PASSWORD } = process.env;
  if (!GMAIL_SMTP_USER || !GMAIL_SMTP_APP_PASSWORD) {
    console.warn("Correo deshabilitado: faltan GMAIL_SMTP_USER/GMAIL_SMTP_APP_PASSWORD.");
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_SMTP_USER, pass: GMAIL_SMTP_APP_PASSWORD },
  });
  return transporter;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export async function sendMail(opts: { to: string; subject: string; html: string; attachments?: MailAttachment[] }): Promise<void> {
  const t = getTransporter();
  if (!t) return; // fail-safe, mismo criterio que el resto de integraciones opcionales del proyecto
  try {
    await t.sendMail({
      from: `"Cold Vault" <${process.env.GMAIL_SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments,
    });
  } catch (e: any) {
    console.error("sendMail() error:", e.message || e);
  }
}
