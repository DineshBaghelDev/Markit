import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

// Gmail SMTP with an app password (GMAIL_USER, GMAIL_APP_PASSWORD).
// Safety: mail is only delivered to addresses on EMAIL_ALLOWLIST, so real prospects are never emailed by accident.
export const DAILY_SEND_LIMIT = 20;
export const OPT_OUT_LINE = "If you would rather not hear from us, reply \"unsubscribe\" and we will not contact you again.";

export function emailConfig() {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const allowlist = (process.env.EMAIL_ALLOWLIST ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return { user, pass, allowlist };
}

export const isAllowedRecipient = (email: string, allowlist: string[]) => allowlist.includes(email.trim().toLowerCase());

// Appends the opt-out line. First-touch emails deliberately contain no meeting link.
export const finalizeBody = (body: string) => `${body.trim()}

--
${OPT_OUT_LINE}`;

let transport: Transporter | undefined;

export async function sendEmail(message: { to: string; subject: string; body: string; fromName: string }) {
  const { user, pass } = emailConfig();
  if (!user || !pass) throw new Error("Email is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD.");
  transport ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  const info = await transport.sendMail({
    from: { name: message.fromName, address: user },
    to: message.to,
    subject: message.subject,
    text: message.body,
  });
  return info.messageId as string;
}
