import { db } from "../config/database.js";
import { sendNotificationEmail } from "./email.js";
import { sendFcmForActivities } from "./firebaseConfig.js";

const CART_REMINDER_LOCK_ID = 7_502_312;

type CartReminderRow = {
  user_id: number;
  item_count: number;
  quantity_total: number;
  email: string | null;
  fname: string | null;
  device_token: string | null;
};

export type CartReminderResult = {
  skippedBecauseAlreadyRunning: boolean;
  usersChecked: number;
  fcmSent: number;
  emailsSent: number;
  failures: number;
};

export function buildCartReminder(itemCount: number): { title: string; message: string } {
  const n = Number.isFinite(itemCount) && itemCount > 0 ? itemCount : 1;
  const items = n === 1 ? "1 item" : `${n} items`;
  return {
    title: "You still have items in your cart",
    message: `You have ${items} waiting in your cart. Open your cart to finish checkout.`,
  };
}

export async function sendAbandonedCartReminders(): Promise<CartReminderResult> {
  const result: CartReminderResult = {
    skippedBecauseAlreadyRunning: false,
    usersChecked: 0,
    fcmSent: 0,
    emailsSent: 0,
    failures: 0,
  };

  const pool = await db();
  const lockClient = await pool.connect();
  let hasLock = false;

  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [CART_REMINDER_LOCK_ID],
    );
    hasLock = lockResult.rows[0]?.acquired === true;
    if (!hasLock) {
      result.skippedBecauseAlreadyRunning = true;
      return result;
    }

    const { rows } = await lockClient.query<CartReminderRow>(
      `SELECT
         c.user_id,
         COUNT(*)::int AS item_count,
         COALESCE(SUM(c.quantity), 0)::int AS quantity_total,
         u.email,
         u.fname,
         u.devicetoken AS device_token
       FROM cart_items c
       INNER JOIN users u ON u.id = c.user_id
       GROUP BY c.user_id, u.email, u.fname, u.devicetoken
       ORDER BY c.user_id ASC`,
    );
    result.usersChecked = rows.length;

    for (const row of rows) {
      const userId = Number(row.user_id);
      if (!Number.isFinite(userId) || userId <= 0) {
        result.failures += 1;
        continue;
      }

      const { title, message } = buildCartReminder(Number(row.item_count));
      const deviceToken = String(row.device_token ?? "").trim();
      const email = String(row.email ?? "").trim();

      if (deviceToken) {
        try {
          const fcmResult = await sendFcmForActivities(
            deviceToken,
            title,
            message,
            null,
            {
              type: "cart",
              screen: "Cart",
              role: "customer",
              user_id: userId,
              item_count: Number(row.item_count) || 0,
            },
          );
          if (fcmResult.success) result.fcmSent += 1;
          else result.failures += 1;
        } catch (error) {
          result.failures += 1;
          console.error(`[cart-reminder] FCM failed for user ${userId}`, error);
        }
      }

      // if (email) {
      //   try {
      //     await sendNotificationEmail(email, {
      //       fname: String(row.fname ?? "").trim() || "there",
      //       title,
      //       message,
      //     });
      //     result.emailsSent += 1;
      //   } catch (error) {
      //     result.failures += 1;
      //     console.error(`[cart-reminder] email failed for user ${userId}`, error);
      //   }
      // }
    }

    return result;
  } finally {
    if (hasLock) {
      await lockClient
        .query("SELECT pg_advisory_unlock($1)", [CART_REMINDER_LOCK_ID])
        .catch((error) =>
          console.error("[cart-reminder] failed to release advisory lock", error),
        );
    }
    lockClient.release();
  }
}
