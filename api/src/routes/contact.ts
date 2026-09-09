import { Router } from "express";
import { config } from "../config";
import { sendMail } from "../services/mailer";

export const contactRouter = Router();

const MAX_LEN = { name: 200, email: 320, message: 5000 };
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

// In-memory per-IP counter. This is the one fully unauthenticated route on
// this API (no Clerk token, no shared secret), so it's the one place a
// bot could hammer for free — good enough for the handful of legitimate
// submissions a real contact form gets, and resets on every deploy/restart
// which is an acceptable tradeoff for a single-instance Starter service.
const submissionsByIp = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = submissionsByIp.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    submissionsByIp.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generic on purpose — this API also fronts the contact form for other,
// unrelated static sites owned by the same person, forwarding through the
// mailer already set up above rather than each site standing up its own.
contactRouter.post("/contact", async (req, res, next) => {
  try {
    if (isRateLimited(req.ip ?? "unknown")) {
      res.status(429).json({ error: "Too many requests. Please try again later." });
      return;
    }

    const { name, email, message, company } = req.body ?? {};

    // Honeypot: a real visitor never fills this hidden field in. Checked
    // here too, not just client-side, since this route has no other gate.
    if (typeof company === "string" && company.trim()) {
      res.status(200).json({ ok: true });
      return;
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !message.trim() ||
      !isValidEmail(email) ||
      name.length > MAX_LEN.name ||
      email.length > MAX_LEN.email ||
      message.length > MAX_LEN.message
    ) {
      res.status(400).json({ error: "Invalid submission" });
      return;
    }

    await sendMail(
      [config.contactFormToEmail],
      // nodemailer/mail-composer already encodes header values safely, but
      // stripping CR/LF from a user-supplied subject is cheap and removes
      // any reliance on that being true.
      `New contact form message from ${name.replace(/[\r\n]+/g, " ")}`,
      `From: ${name} <${email}>\n\n${message}`,
      { replyTo: email },
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});
