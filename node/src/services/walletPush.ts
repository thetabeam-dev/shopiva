import { db } from "../config/database.js";
import { sendFcmForActivities } from "./firebaseConfig.js";

export async function pushWalletFcm(userId: number, title: string, body: string) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;
  const { rows } = await (await db()).query<{ devicetoken: string | null }>(
    `SELECT devicetoken FROM users WHERE id = $1`,
    [id]
  );
  const token = String(rows[0]?.devicetoken ?? "").trim();
  if (!token) return;
  await sendFcmForActivities(token, title, body, null, { type: "wallet" });
}

export function nairaLabel(amount: number) {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
