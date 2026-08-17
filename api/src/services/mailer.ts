import nodemailer from "nodemailer";
import { config } from "../config";

// Fastmail SMTP — see README's "Admin notification emails" section for how
// the sending address is set up. Volume here is a handful of emails a
// month at most (one per new signup), well within any provider's limits.
const transporter = nodemailer.createTransport({
  host: "smtp.fastmail.com",
  port: 587,
  secure: false, // STARTTLS on 587, not implicit TLS
  auth: {
    user: config.smtpUser,
    pass: config.smtpPassword,
  },
});

export async function sendMail(to: string[], subject: string, text: string): Promise<void> {
  if (to.length === 0) return;

  await transporter.sendMail({
    from: config.notificationFromEmail,
    to,
    subject,
    text,
  });
}
