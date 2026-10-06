import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import { model } from "../models/user.js";
import { sendEmail } from "./email.js";
import { baseTemplate } from "../templates/email/base.js";

const PIN_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 10;

type RecoveryEntry = {
  userId: number;
  pinHash: string;
  expiresAt: number;
  verified: boolean;
  resetToken: string | null;
};

const recoveryByEmail = new Map<string, RecoveryEntry>();

function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function hashPin(email: string, pin: string): string {
  return crypto.createHash("sha256").update(`${email}:${pin}`).digest("hex");
}

function pinEmailHtml(fname: string, pin: string): string {
  const content = `
    <h2>Reset your password</h2>
    <p>Hi ${fname},</p>
    <p>Use this PIN to continue resetting your DeeDyte password:</p>
    <div class="code">${pin}</div>
    <p style="font-size: 14px; color: #6b7280;">This PIN expires in 15 minutes. If you did not ask to reset your password, you can ignore this email.</p>
  `;
  return baseTemplate(content, `Your Deedyte password reset PIN is ${pin}`);
}

export async function RequestPasswordResetPinService(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const { rows: users } = await (await db()).query(
    `SELECT id, fname, provider, accountstatus FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  const user = users?.[0] as
    | { id: number; fname?: string; password?: string; provider?: string; accountstatus?: string }
    | undefined;
  if (!user || String(user.accountstatus ?? "").toLowerCase() === "deleted") {
    throw Object.assign(new Error("No account found for this email."), { status: 404 });
  }

  const provider = String(user.provider ?? "").toLowerCase();
  if (provider === "google" || provider === "facebook" || provider === "apple") {
    const label = provider.charAt(0).toUpperCase() + provider.slice(1);
    throw Object.assign(
      new Error(`This account uses ${label} sign-in. Log in with ${label} instead of resetting a password.`),
      { status: 400 },
    );
  }

  const pin = String(crypto.randomInt(100000, 1000000));
  recoveryByEmail.set(email, {
    userId: Number(user.id),
    pinHash: hashPin(email, pin),
    expiresAt: Date.now() + PIN_TTL_MS,
    verified: false,
    resetToken: null,
  });

  const fname = String(user.fname ?? "there").trim() || "there";
  await sendEmail({
    to: email,
    subject: "Your Deedyte password reset PIN",
    html: pinEmailHtml(fname, pin),
  });

  return { success: true };
}

export async function VerifyPasswordResetPinService(rawEmail: unknown, rawPin: unknown) {
  const email = normalizeEmail(rawEmail);
  const pin = typeof rawPin === "string" ? rawPin.trim() : "";
  const entry = recoveryByEmail.get(email);
  if (!entry || entry.expiresAt < Date.now()) {
    recoveryByEmail.delete(email);
    throw Object.assign(new Error("That PIN is invalid or has expired. Request a new one."), { status: 400 });
  }
  const digest = hashPin(email, pin);
  const matches =
    pin.length > 0 &&
    digest.length === entry.pinHash.length &&
    crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(entry.pinHash));
  if (!matches) {
    throw Object.assign(new Error("That PIN is incorrect."), { status: 400 });
  }
  const resetToken = crypto.randomBytes(24).toString("hex");
  entry.verified = true;
  entry.resetToken = resetToken;
  entry.expiresAt = Date.now() + PIN_TTL_MS;
  return { success: true, resetToken };
}

export async function ResetPasswordWithPinService(
  rawEmail: unknown,
  rawToken: unknown,
  rawPassword: unknown,
) {
  const email = normalizeEmail(rawEmail);
  const resetToken = typeof rawToken === "string" ? rawToken.trim() : "";
  const newPassword = typeof rawPassword === "string" ? rawPassword : "";
  if (newPassword.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
  }
  const entry = recoveryByEmail.get(email);
  if (!entry || !entry.verified || !entry.resetToken || entry.expiresAt < Date.now()) {
    throw Object.assign(new Error("Confirm the PIN before resetting your password."), { status: 400 });
  }
  const tokenOk =
    resetToken.length === entry.resetToken.length &&
    crypto.timingSafeEqual(Buffer.from(resetToken), Buffer.from(entry.resetToken));
  if (!tokenOk) {
    throw Object.assign(new Error("Confirm the PIN before resetting your password."), { status: 400 });
  }
  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await model.updatePassword({ id: entry.userId, password: hashed });
  recoveryByEmail.delete(email);
  return { success: true };
}
