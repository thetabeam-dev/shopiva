import express from "express";
import type { Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { db } from "../config/database.js";
import { sendEmail } from "../services/email.js";
import { isWhatsAppConfigured, normalizeWhatsAppPhone, sendWhatsAppTemplate } from "../services/whatsapp.js";

export const AdminEmailAutomationRouter = express.Router();

const CAMPAIGN_TYPE = "vendor_activation_empty_shop";
const PAGE_SIZE_MAX = 100;
const RECIPIENT_LIMIT = 100;
type CampaignChannel = "email" | "whatsapp";

const normalizedPhoneSql = `CASE
  WHEN LEFT(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), 3) = '234'
    THEN SUBSTRING(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g') FROM 4)
  ELSE LTRIM(regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g'), '0')
END`;

export function buildEligibleShopsSql(channel: CampaignChannel) {
  return `
  SELECT u.id AS user_id,
         u.email,
         u.phone AS owner_phone,
         s.id AS shop_id,
         s.name AS shop_name,
         product_totals.product_count,
         COALESCE((u.notificationpreferences #>> '{email,enabled}') = 'true', false) AS email_enabled,
         COALESCE((u.notificationpreferences #>> '{email,marketing}') = 'true', false) AS marketing_opt_in,
         COALESCE((u.notificationpreferences #>> '{whatsapp,marketing}') = 'true', false) AS whatsapp_opt_in,
         u.isactive AS user_active,
         u.accountstatus AS account_status,
         u.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$' AS valid_email,
         (${normalizedPhoneSql}) ~ '^[0-9]{10}$' AS valid_phone,
         EXISTS (
           SELECT 1
           FROM admin_email_campaign_recipients r
           JOIN admin_email_campaigns c ON c.id = r.campaign_id
           WHERE r.user_id = u.id
             AND r.status IN ('pending', 'sent')
             AND c.campaign_type = '${CAMPAIGN_TYPE}'
             AND c.channel = '${channel}'
             AND c.created_at >= NOW() - INTERVAL '30 days'
         ) AS contacted_recently
  FROM users u
  INNER JOIN shops s ON s.ownerid = u.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS product_count FROM products p WHERE p.shop_id = s.id
  ) product_totals ON TRUE
  WHERE u.role = 'entrepreneur'
    AND product_totals.product_count BETWEEN 0 AND 5
`;
}

export function buildCampaignRecipientsSql(channel: CampaignChannel) {
  if (channel === "whatsapp") {
    return `
      SELECT u.id, u.phone, u.fname
      FROM users u
      WHERE u.id = ANY($1::int[])
        AND u.role = 'entrepreneur'
        AND u.isactive = true
        AND u.accountstatus = 'active'
        AND (u.notificationpreferences #>> '{whatsapp,marketing}') = 'true'
        AND (${normalizedPhoneSql}) ~ '^[0-9]{10}$'
        AND EXISTS (
          SELECT 1 FROM shops s
          LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS product_count FROM products p WHERE p.shop_id = s.id
          ) product_totals ON TRUE
          WHERE s.ownerid = u.id
            AND product_totals.product_count BETWEEN 0 AND 5
        )
        AND NOT EXISTS (
          SELECT 1 FROM admin_email_campaign_recipients r
          JOIN admin_email_campaigns c ON c.id = r.campaign_id
          WHERE r.user_id = u.id
            AND r.status IN ('pending', 'sent')
            AND c.campaign_type = '${CAMPAIGN_TYPE}'
            AND c.channel = 'whatsapp'
            AND c.created_at >= NOW() - INTERVAL '30 days'
        )
      ORDER BY u.id
    `;
  }

  return `
  SELECT u.id, u.email, u.fname
  FROM users u
  WHERE u.id = ANY($1::int[])
    AND u.role = 'entrepreneur'
    AND u.isactive = true
    AND u.accountstatus = 'active'
    AND u.email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
    AND (u.notificationpreferences #>> '{email,enabled}') = 'true'
    AND (u.notificationpreferences #>> '{email,marketing}') = 'true'
    AND EXISTS (
      SELECT 1
      FROM shops s
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS product_count FROM products p WHERE p.shop_id = s.id
      ) product_totals ON TRUE
      WHERE s.ownerid = u.id
        AND product_totals.product_count BETWEEN 0 AND 5
    )
    AND NOT EXISTS (
      SELECT 1
      FROM admin_email_campaign_recipients r
      JOIN admin_email_campaigns c ON c.id = r.campaign_id
      WHERE r.user_id = u.id
        AND r.status IN ('pending', 'sent')
        AND c.campaign_type = '${CAMPAIGN_TYPE}'
        AND c.channel = 'email'
        AND c.created_at >= NOW() - INTERVAL '30 days'
    )
  ORDER BY u.id
`;
}

export const ELIGIBLE_SHOPS_SQL = buildEligibleShopsSql("email");
export const CAMPAIGN_RECIPIENTS_SQL = buildCampaignRecipientsSql("email");

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function deliverCampaignRecipients(
  candidates: Array<{ id: number; email: string; fname: string | null }>,
  campaignId: number,
  pool: Pool,
  sender: typeof sendEmail = sendEmail,
): Promise<{ sent: number; failed: number; results: Array<{ userId: number; status: "submitted" | "failed" }> }> {
  let sent = 0;
  let failed = 0;
  const results: Array<{ userId: number; status: "submitted" | "failed" }> = [];

  for (const recipient of candidates) {
    let status: "sent" | "failed" = "sent";
    try {
      const submitted = await sender({
        to: recipient.email,
        subject: "Your DeeDyte Shop Is Waiting for Products!",
        ...vendorEmail(recipient.fname),
      });
      if (!submitted) throw new Error("Email service did not accept the message.");
      sent += 1;
    } catch (error) {
      status = "failed";
      failed += 1;
      console.error("Vendor activation email failed:", { campaignId, userId: recipient.id, error });
    }
    await pool.query(
      `UPDATE admin_email_campaign_recipients
       SET status = $1, attempted_at = NOW(), failure_code = $2
       WHERE campaign_id = $3 AND user_id = $4`,
      [status, status === "failed" ? "EMAIL_DELIVERY_FAILED" : null, campaignId, recipient.id],
    );
    results.push({ userId: recipient.id, status: status === "sent" ? "submitted" : "failed" });
  }

  return { sent, failed, results };
}

export async function deliverWhatsAppCampaignRecipients(
  candidates: Array<{ id: number; phone: string; fname: string | null }>,
  campaignId: number,
  pool: Pool,
  sender: typeof sendWhatsAppTemplate = sendWhatsAppTemplate,
): Promise<{ sent: number; failed: number; results: Array<{ userId: number; status: "submitted" | "failed" }> }> {
  let sent = 0;
  let failed = 0;
  const results: Array<{ userId: number; status: "submitted" | "failed" }> = [];

  for (const recipient of candidates) {
    let status: "sent" | "failed" = "sent";
    try {
      await sender(recipient.phone, undefined, undefined, recipient.fname ?? "there");
      sent += 1;
    } catch (error) {
      status = "failed";
      failed += 1;
      console.error("Vendor activation WhatsApp failed:", { campaignId, userId: recipient.id, error });
    }
    await pool.query(
      `UPDATE admin_email_campaign_recipients
       SET status = $1, attempted_at = NOW(), failure_code = $2
       WHERE campaign_id = $3 AND user_id = $4`,
      [status, status === "failed" ? "WHATSAPP_DELIVERY_FAILED" : null, campaignId, recipient.id],
    );
    results.push({ userId: recipient.id, status: status === "sent" ? "submitted" : "failed" });
  }

  return { sent, failed, results };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function vendorEmail(firstName: string | null): { text: string; html: string } {
  const greeting = firstName?.trim() || "there";
  const safeGreeting = escapeHtml(greeting);
  return {
    text: `Hello ${greeting},\n\nYour shop on DeeDyte has fewer than six products listed. Add more products today to help customers discover what you offer and take the next step toward growing your business on DeeDyte. Log in to your DeeDyte account to upload products.\n\nWe look forward to seeing your shop grow!\n\nThe DeeDyte Team`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#19231f;max-width:600px;margin:auto;padding:32px"><p>Hello ${safeGreeting},</p><p>Your shop on DeeDyte has fewer than six products listed.</p><p>Add more products today to help customers discover what you offer and take the next step toward growing your business on DeeDyte.</p><p>Log in to your DeeDyte account to upload products.</p><p>We look forward to seeing your shop grow!</p><p>The DeeDyte Team</p></div>`,
  };
}

AdminEmailAutomationRouter.get("/admin/email-automation/shops-without-products", async (request: Request, response: Response) => {
  const page = parsePositiveInteger(request.query.page ?? "1");
  const pageSize = parsePositiveInteger(request.query.pageSize ?? "25");
  const channel = request.query.channel ?? "email";
  const productCountFilter = request.query.productCount;
  const productCount = productCountFilter == null || productCountFilter === ""
    ? null
    : typeof productCountFilter === "string" && /^[0-5]$/.test(productCountFilter)
      ? Number(productCountFilter)
      : Number.NaN;
  if (!page || !pageSize || pageSize > PAGE_SIZE_MAX
      || (channel !== "email" && channel !== "whatsapp")
      || Number.isNaN(productCount)) {
    response.status(400).json({ success: false, error: "Invalid pagination, channel, or product-count filter." });
    return;
  }
  const offset = (page - 1) * pageSize;
  if (!Number.isSafeInteger(offset)) {
    response.status(400).json({ success: false, error: "Invalid pagination parameters." });
    return;
  }

  try {
    const pool = await db();
    const eligibleShopsSql = buildEligibleShopsSql(channel);
    const channelConfigured = channel === "email" || isWhatsAppConfigured();
    const [{ rows: shops }, { rows: [totals] }] = await Promise.all([
      pool.query(
        `WITH eligible AS (${eligibleShopsSql})
          SELECT user_id AS "userId",
            ${channel === "email" ? "email" : "NULL::text AS email"},
                owner_phone AS "ownerPhone",
              shop_id AS "shopId", shop_name AS "shopName", product_count AS "productCount",
                email_enabled AS "emailEnabled", marketing_opt_in AS "marketingOptIn",
                whatsapp_opt_in AS "whatsappOptIn",
                user_active AS "userActive", account_status AS "accountStatus",
                valid_email AS "validEmail", valid_phone AS "validPhone",
                contacted_recently AS "contactedRecently"
         FROM eligible
         WHERE ($3::int IS NULL OR product_count = $3)
         ORDER BY shop_id
         LIMIT $1 OFFSET $2`,
        [pageSize, offset, productCount],
      ),
      pool.query(
        `WITH eligible AS (${eligibleShopsSql})
         SELECT COUNT(*)::int AS "totalShops",
                COUNT(DISTINCT user_id)::int AS "totalVendors",
                COUNT(DISTINCT user_id) FILTER (
                  WHERE user_active AND account_status = 'active' AND NOT contacted_recently
                    AND $1::boolean AND CASE WHEN $2 = 'email'
                      THEN email_enabled AND marketing_opt_in AND valid_email
                      ELSE whatsapp_opt_in AND valid_phone END
                )::int AS "campaignEligibleVendors"
         FROM eligible
         WHERE ($3::int IS NULL OR product_count = $3)`,
        [channelConfigured, channel, productCount],
      ),
    ]);

    const data = shops.map((shop) => {
      const consented = channel === "email" ? shop.emailEnabled && shop.marketingOptIn : shop.whatsappOptIn;
      const validRecipient = channel === "email" ? shop.validEmail : shop.validPhone;
      const eligible = channelConfigured && consented && shop.userActive
        && shop.accountStatus === "active" && validRecipient && !shop.contactedRecently;
      const ineligibleReason = !channelConfigured
        ? "WhatsApp sender is not configured"
        : !validRecipient
          ? channel === "email" ? "Email address is invalid" : "Phone number is invalid"
          : !shop.userActive || shop.accountStatus !== "active"
          ? "Vendor account is inactive"
          : !consented
            ? channel === "email" && !shop.emailEnabled
            ? "Email notifications are disabled"
              : channel === "email" ? "Marketing email preference is off" : "WhatsApp marketing preference is off"
            : shop.contactedRecently
              ? "Campaign sent or pending within 30 days"
              : null;
      return { ...shop, campaignEligible: eligible, ineligibleReason };
    });

    response.json({
      success: true,
      data,
      totalShops: totals.totalShops,
      totalVendors: totals.totalVendors,
      campaignEligibleVendors: totals.campaignEligibleVendors,
      channel,
      channelConfigured,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Failed to load vendors without products:", error);
    response.status(500).json({ success: false, error: "Unable to load vendor activation data." });
  }
});

AdminEmailAutomationRouter.post("/admin/email-automation/shops-without-products", async (request: Request, response: Response) => {
  const userIds = request.body?.userIds as unknown;
  const requestId = request.body?.requestId as unknown;
  const channel = request.body?.channel ?? "email";
  if (!Array.isArray(userIds) || userIds.length < 1 || userIds.length > RECIPIENT_LIMIT
      || userIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
      || new Set(userIds).size !== userIds.length
      || typeof requestId !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
      || (channel !== "email" && channel !== "whatsapp")) {
    response.status(400).json({ success: false, error: "Select 1 to 100 vendors, a valid channel, and provide a valid request ID." });
    return;
  }

  if (channel === "whatsapp" && !isWhatsAppConfigured()) {
    response.status(503).json({ success: false, error: "WhatsApp Cloud API and an approved template are not configured." });
    return;
  }

  let pool: Pool;
  let client: PoolClient;
  try {
    pool = await db();
    client = await pool.connect();
  } catch (error) {
    console.error("Failed to connect for vendor activation campaign:", error);
    response.status(500).json({ success: false, error: "Unable to connect to the campaign database." });
    return;
  }
  let candidates: Array<{ id: number; email?: string; phone?: string; fname: string | null }> = [];
  let campaignId: number;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(740112, 1)");

    const previous = await client.query(
      "SELECT id FROM admin_email_campaigns WHERE request_id = $1",
      [requestId],
    );
    if (previous.rows[0]) {
      await client.query("ROLLBACK");
      response.status(409).json({ success: false, error: "This campaign request was already submitted." });
      return;
    }

    const known = await client.query("SELECT id FROM users WHERE id = ANY($1::int[])", [userIds]);
    if (known.rows.length !== userIds.length) {
      await client.query("ROLLBACK");
      response.status(400).json({ success: false, error: "Recipient selection contains an invalid user." });
      return;
    }

    const eligible = await client.query(buildCampaignRecipientsSql(channel), [userIds]);
    candidates = eligible.rows;
    const eligibleIds = new Set(candidates.map((recipient) => recipient.id));
    const campaign = await client.query(
      `INSERT INTO admin_email_campaigns
         (request_id, campaign_type, channel, status, selected_count, skipped_count)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING id`,
      [requestId, CAMPAIGN_TYPE, channel, userIds.length, userIds.length - candidates.length],
    );
    campaignId = campaign.rows[0].id;

    for (const userId of userIds as number[]) {
      await client.query(
        `INSERT INTO admin_email_campaign_recipients (campaign_id, user_id, status)
         VALUES ($1, $2, $3)`,
        [campaignId, userId, eligibleIds.has(userId) ? "pending" : "skipped"],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to reserve vendor activation campaign:", error);
    response.status(500).json({ success: false, error: "Unable to reserve email campaign." });
    return;
  } finally {
    client.release();
  }

  let delivery: Awaited<ReturnType<typeof deliverCampaignRecipients>>;
  try {
    delivery = channel === "email"
      ? await deliverCampaignRecipients(candidates as Array<{ id: number; email: string; fname: string | null }>, campaignId, pool)
      : await deliverWhatsAppCampaignRecipients(candidates as Array<{ id: number; phone: string; fname: string | null }>, campaignId, pool);
  } catch (error) {
    console.error("Failed to record vendor activation delivery results:", { campaignId, error });
    response.status(500).json({ success: false, error: "Unable to record campaign delivery results." });
    return;
  }

  const skipped = userIds.length - candidates.length;
  const campaignStatus = candidates.length === 0 ? "no_recipients"
    : delivery.failed === 0 ? "sent"
      : delivery.sent === 0 ? "failed" : "partial";
  try {
    await pool.query(
      `UPDATE admin_email_campaigns
       SET status = $1, sent_count = $2, failed_count = $3, completed_at = NOW()
       WHERE id = $4`,
      [campaignStatus, delivery.sent, delivery.failed, campaignId],
    );
  } catch (error) {
    console.error("Failed to finalize vendor activation campaign:", { campaignId, error });
    response.status(500).json({ success: false, error: "Delivery completed but campaign results could not be finalized." });
    return;
  }

  console.info("Vendor activation campaign completed:", { campaignId, sent: delivery.sent, failed: delivery.failed, skipped });
  response.json({ success: true, campaignId, sent: delivery.sent, failed: delivery.failed, skipped, results: delivery.results });
});
