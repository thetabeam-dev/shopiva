import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "../../config/database.js";
import { formatPhoneNumber } from "../../utils/phone.js";

const OPT_OUT_REPLIES = new Set(["stop", "unsubscribe", "cancel", "end", "quit"]);

export function verifyWhatsAppWebhookSignature(body: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=") || !appSecret) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(body).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isWhatsAppOptOutReply(text: unknown): boolean {
  return typeof text === "string" && OPT_OUT_REPLIES.has(text.trim().toLowerCase());
}

export function WhatsAppWebhookVerificationController(request: Request, response: Response): void {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];
  if (mode === "subscribe" && typeof token === "string"
      && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      && typeof challenge === "string") {
    response.status(200).type("text/plain").send(challenge);
    return;
  }
  response.sendStatus(403);
}

export async function WhatsAppWebhookController(request: Request, response: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  const signature = request.header("x-hub-signature-256");
  if (!verifyWhatsAppWebhookSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET ?? "")) {
    response.sendStatus(401);
    return;
  }

  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    response.sendStatus(400);
    return;
  }

  try {
    const pool = await db();
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          if (message.type !== "text" || !isWhatsAppOptOutReply(message.text?.body)) continue;
          const subscriberNumber = formatPhoneNumber(message.from);
          if (!subscriberNumber) continue;

          await pool.query(
            `UPDATE users
             SET notificationpreferences = jsonb_set(
                   jsonb_set(
                     COALESCE(notificationpreferences, '{}'::jsonb),
                     '{whatsapp,marketing}',
                     'false'::jsonb,
                     true
                   ),
                   '{whatsapp,marketingOptOutAt}',
                   to_jsonb(NOW()),
                   true
                 )
             WHERE CASE
               WHEN LEFT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 3) = '234'
                 THEN SUBSTRING(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') FROM 4)
               ELSE LTRIM(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), '0')
             END = $1`,
            [subscriberNumber],
          );
        }
      }
    }
    response.sendStatus(200);
  } catch (error) {
    console.error("Failed to process WhatsApp webhook:", error);
    response.sendStatus(500);
  }
}
