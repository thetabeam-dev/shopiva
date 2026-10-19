import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import { sendEmail } from "./email.js";
import { baseTemplate } from "../templates/email/base.js";

const PIN_TTL_MS = 15 * 60 * 1000;
const SALT_ROUNDS = 10;

type RecoveryEntry = {
  userId: number;
  email: string;
  pinHash: string;
  expiresAt: number;
  verified: boolean;
  resetToken: string | null;
};

const recoveryByUser = new Map<number, RecoveryEntry>();

function hashCode(userId: number, pin: string): string {
  return crypto.createHash("sha256").update(`${userId}:${pin}`).digest("hex");
}

function emailHtml(fname: string, pin: string): string {
  const content = `
    <h2>Reset your wallet PIN</h2>
    <p>Hi ${fname},</p>
    <p>Use this PIN to continue resetting your DeeDyte wallet PIN:</p>
    <div class="code">${pin}</div>
    <p style="font-size: 14px; color: #6b7280;">This PIN expires in 15 minutes. If you did not ask to reset your wallet PIN, you can ignore this email.</p>
  `;
  return baseTemplate(content, `Your Deedyte wallet PIN reset code is ${pin}`);
}

export async function RequestWalletPinResetService(userId: number, rawEmail: unknown) {
  const id = Number(userId);
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  }

  const { rows } = await (await db()).query(
    `SELECT u.id, u.fname, u.email, u.accountstatus, w.id AS wallet_id
     FROM users u
     LEFT JOIN wallets w ON w.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [id]
  );
  const user = rows[0] as
    | { id: number; fname?: string; email?: string; accountstatus?: string; wallet_id?: string | null }
    | undefined;
  if (!user || String(user.accountstatus ?? "").toLowerCase() === "deleted") {
    throw Object.assign(new Error("Account not found."), { status: 404 });
  }
  if (String(user.email ?? "").trim().toLowerCase() !== email) {
    throw Object.assign(new Error("That email does not match this account."), { status: 400 });
  }
  if (!user.wallet_id) {
    throw Object.assign(new Error("Wallet not found."), { status: 404 });
  }

  const pin = String(crypto.randomInt(100000, 1000000));
  recoveryByUser.set(id, {
    userId: id,
    email,
    pinHash: hashCode(id, pin),
    expiresAt: Date.now() + PIN_TTL_MS,
    verified: false,
    resetToken: null,
  });

  const fname = String(user.fname ?? "there").trim() || "there";
  await sendEmail({
    to: email,
    subject: "Your Deedyte wallet PIN reset code",
    html: emailHtml(fname, pin),
  });
  return { success: true };
}

export async function VerifyWalletPinResetService(userId: number, rawPin: unknown) {
  const id = Number(userId);
  const pin = typeof rawPin === "string" ? rawPin.trim() : "";
  const entry = recoveryByUser.get(id);
  if (!entry || entry.expiresAt < Date.now()) {
    recoveryByUser.delete(id);
    throw Object.assign(new Error("That PIN is invalid or has expired. Request a new one."), { status: 400 });
  }
  const digest = hashCode(id, pin);
  const matches =
    /^\d{6}$/.test(pin) &&
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

export async function ResetWalletPinService(
  userId: number,
  rawToken: unknown,
  rawPin: unknown,
  rawConfirm: unknown
) {
  const id = Number(userId);
  const resetToken = typeof rawToken === "string" ? rawToken.trim() : "";
  const pin = String(rawPin ?? "").replace(/\D/g, "");
  const confirm = String(rawConfirm ?? "").replace(/\D/g, "");
  if (pin.length !== 4 || confirm.length !== 4) {
    throw Object.assign(new Error("Wallet PIN must be 4 digits."), { status: 400 });
  }
  if (pin !== confirm) {
    throw Object.assign(new Error("PIN and confirmation do not match."), { status: 400 });
  }
  const entry = recoveryByUser.get(id);
  if (!entry || !entry.verified || !entry.resetToken || entry.expiresAt < Date.now()) {
    throw Object.assign(new Error("Confirm the email PIN before resetting your wallet PIN."), { status: 400 });
  }
  const tokenOk =
    resetToken.length === entry.resetToken.length &&
    crypto.timingSafeEqual(Buffer.from(resetToken), Buffer.from(entry.resetToken));
  if (!tokenOk) {
    throw Object.assign(new Error("Confirm the email PIN before resetting your wallet PIN."), { status: 400 });
  }
  const hashed = await bcrypt.hash(pin, SALT_ROUNDS);
  const { rowCount } = await (await db()).query(
    `UPDATE wallets SET pin = $2, updated_at = NOW() WHERE user_id = $1`,
    [id, hashed]
  );
  if (!Number(rowCount)) {
    throw Object.assign(new Error("Wallet not found."), { status: 404 });
  }
  recoveryByUser.delete(id);
  return { success: true };
}
