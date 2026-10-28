import { db } from "../config/database.js";
import { sendNotificationEmail } from "./email.js";
import { sendFcmForActivities } from "./firebaseConfig.js";
import { createAndEmitNotification } from "./notifications.js";
import {
  getShopSetupFaults,
  parseShopLocationCoords,
  shopSetupFaultInstructions,
  type ShopSetupFault,
} from "../utils/shopSetup.js";

const SHOP_SETUP_AUDIT_LOCK_ID = 7_502_311;

type ShopSetupAuditRow = {
  shop_id: number;
  shop_name: string;
  location: unknown;
  owner_id: number;
  owner_fname: string | null;
  owner_email: string | null;
  device_token: string | null;
  no_products: boolean;
  shipping_not_configured: boolean;
};

export type ShopSetupReminderResult = {
  skippedBecauseAlreadyRunning: boolean;
  shopsChecked: number;
  shopsWithFaults: number;
  inAppSent: number;
  fcmSent: number;
  emailsSent: number;
  failures: number;
};

export const SHOP_SETUP_AUDIT_SQL = `
  SELECT
    s.id AS shop_id,
    s.name AS shop_name,
    s.location,
    u.id AS owner_id,
    u.fname AS owner_fname,
    u.email AS owner_email,
    u.devicetoken AS device_token,
    NOT EXISTS (
      SELECT 1
      FROM products p
      WHERE p.shop_id = s.id
    ) AS no_products,
    NOT (
      (
        EXISTS (
          SELECT 1
          FROM shipping_fee_models sfm
          WHERE sfm.shop_id = s.id
            AND sfm.base_fee > 0
        )
        OR EXISTS (
          SELECT 1
          FROM shipping_multi_item_discounts smid
          WHERE smid.shop_id = s.id
            AND smid.base_fee > 0
        )
      )
      AND EXISTS (
        SELECT 1
        FROM shipping_zones sz
        WHERE sz.shop_id = s.id
          AND sz.base_fee > 0
          AND COALESCE(cardinality(sz.locations), 0) > 0
      )
    ) AS shipping_not_configured
  FROM shops s
  INNER JOIN users u ON u.id = s.ownerid
  ORDER BY s.id ASC
`;

function joinInstructions(instructions: readonly string[]): string {
  if (instructions.length <= 1) return instructions[0] ?? "";
  if (instructions.length === 2) {
    return `${instructions[0]} and ${instructions[1]}`;
  }
  return `${instructions.slice(0, -1).join(", ")}, and ${instructions.at(-1)}`;
}

export function buildShopSetupReminder(
  shopName: string,
  faults: readonly ShopSetupFault[],
): { title: string; message: string } {
  const safeShopName = String(shopName ?? "").trim() || "Your shop";
  const instructions = shopSetupFaultInstructions(faults);
  return {
    title: "Complete your shop setup",
    message: `${safeShopName} needs attention. Please ${joinInstructions(instructions)} so customers can discover your products and place orders.`,
  };
}

/**
 * Audits every shop and reminds owners whose setup is incomplete.
 *
 * A PostgreSQL advisory lock ensures that only one server instance executes
 * the job for a given 12-hour cron tick.
 */
export async function sendShopSetupReminders(): Promise<ShopSetupReminderResult> {
  const result: ShopSetupReminderResult = {
    skippedBecauseAlreadyRunning: false,
    shopsChecked: 0,
    shopsWithFaults: 0,
    inAppSent: 0,
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
      [SHOP_SETUP_AUDIT_LOCK_ID],
    );
    hasLock = lockResult.rows[0]?.acquired === true;
    if (!hasLock) {
      result.skippedBecauseAlreadyRunning = true;
      return result;
    }

    const { rows } = await lockClient.query<ShopSetupAuditRow>(
      SHOP_SETUP_AUDIT_SQL,
    );
    result.shopsChecked = rows.length;

    for (const row of rows) {
      const shopId = Number(row.shop_id);
      const ownerId = Number(row.owner_id);
      if (
        !Number.isFinite(shopId) ||
        shopId <= 0 ||
        !Number.isFinite(ownerId) ||
        ownerId <= 0
      ) {
        result.failures += 1;
        continue;
      }

      const faults = getShopSetupFaults({
        noProducts: row.no_products,
        shippingNotConfigured: row.shipping_not_configured,
        coordinatesNotSet: parseShopLocationCoords(row.location) == null,
      });
      if (!faults.length) continue;

      result.shopsWithFaults += 1;
      const { title, message } = buildShopSetupReminder(
        row.shop_name,
        faults,
      );

      try {
        const notification = await createAndEmitNotification({
          recipientId: ownerId,
          title,
          message,
          sourceType: "shop",
          sourceId: shopId,
          role: "vendor",
        });
        if (notification) result.inAppSent += 1;
        else result.failures += 1;
      } catch (error) {
        result.failures += 1;
        console.error(
          `[shop-setup] in-app notification failed for shop ${shopId}`,
          error,
        );
      }

      const deviceToken = String(row.device_token ?? "").trim();
      if (deviceToken) {
        try {
          const fcmResult = await sendFcmForActivities(
            deviceToken,
            title,
            message,
            null,
            {
              type: "shop_setup",
              shop_id: shopId,
              faults,
              role: "vendor",
            },
          );
          if (fcmResult.success) result.fcmSent += 1;
          else result.failures += 1;
        } catch (error) {
          result.failures += 1;
          console.error(
            `[shop-setup] FCM notification failed for shop ${shopId}`,
            error,
          );
        }
      }

      const email = String(row.owner_email ?? "").trim();
      if (email) {
        try {
          await sendNotificationEmail(email, {
            fname: String(row.owner_fname ?? "").trim() || "there",
            title,
            message,
          });
          result.emailsSent += 1;
        } catch (error) {
          result.failures += 1;
          console.error(
            `[shop-setup] email notification failed for shop ${shopId}`,
            error,
          );
        }
      }
    }

    return result;
  } finally {
    if (hasLock) {
      await lockClient
        .query("SELECT pg_advisory_unlock($1)", [SHOP_SETUP_AUDIT_LOCK_ID])
        .catch((error) =>
          console.error("[shop-setup] failed to release advisory lock", error),
        );
    }
    lockClient.release();
  }
}
