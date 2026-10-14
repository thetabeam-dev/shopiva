import { formatPhoneNumber } from "../utils/phone.js";

type WhatsAppConfig = {
  accessToken: string | undefined;
  phoneNumberId: string | undefined;
  templateName: string | undefined;
  templateLanguage: string | undefined;
  apiVersion: string | undefined;
};

type WhatsAppFetch = typeof fetch;

export function normalizeWhatsAppPhone(value: unknown): string | null {
  const subscriberNumber = formatPhoneNumber(value);
  if (!subscriberNumber || !/^\d{10}$/.test(subscriberNumber)) return null;
  return `234${subscriberNumber}`;
}

export function getWhatsAppConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig {
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN?.trim(),
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    templateName: env.WHATSAPP_TEMPLATE_NAME?.trim(),
    templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en",
    apiVersion: env.WHATSAPP_API_VERSION?.trim() || "v23.0",
  };
}

export function isWhatsAppConfigured(config = getWhatsAppConfig()): boolean {
  return Boolean(
    config.accessToken
      && config.phoneNumberId
      && config.templateName
      && config.templateLanguage
      && config.apiVersion
      && /^v\d+\.\d+$/.test(config.apiVersion),
  );
}

export async function sendWhatsAppTemplate(
  phone: unknown,
  config = getWhatsAppConfig(),
  fetchImpl: WhatsAppFetch = fetch,
  firstName = "there",
): Promise<string> {
  const recipient = normalizeWhatsAppPhone(phone);
  if (!recipient) throw new Error("Recipient does not have a valid Nigerian mobile number.");
  if (!isWhatsAppConfigured(config)) throw new Error("WhatsApp Cloud API is not configured.");

  const response = await fetchImpl(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "template",
        template: {
          name: config.templateName,
          language: { code: config.templateLanguage },
          components: [{
            type: "body",
            parameters: [{ type: "text", text: firstName.trim() || "there" }],
          }],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`WhatsApp provider rejected the message (HTTP ${response.status}).`);
  }

  const result = await response.json() as { messages?: Array<{ id?: string }> };
  const messageId = result.messages?.[0]?.id;
  if (!messageId) throw new Error("WhatsApp provider returned no message ID.");
  return messageId;
}
