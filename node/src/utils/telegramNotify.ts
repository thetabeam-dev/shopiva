/**
 * Fire-and-forget Telegram Bot API alerts for ops groups.
 * Requires TELEGRAM_BOT_TOKEN and per-event TELEGRAM_CHAT_ID_* values.
 */

export type TelegramAlertChannel = "chat_room" | "invoice_request" | "paid_order";

function telegramToken(): string {
  return String(process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
}

function chatIdFor(channel: TelegramAlertChannel): string {
  const map: Record<TelegramAlertChannel, string[]> = {
    chat_room: [
      "TELEGRAM_CHAT_ID_CHAT_ROOM",
      "TELEGRAM_CHAT_ID_ORDERS_INITIATION",
      "TELEGRAM_CHAT_ID",
    ],
    invoice_request: [
      "TELEGRAM_CHAT_ID_INVOICE_REQUEST",
      "TELEGRAM_CHAT_ID",
    ],
    paid_order: [
      "TELEGRAM_CHAT_ID_PAID_ORDER",
      "TELEGRAM_CHAT_ID_PAID_ORDERS",
      "TELEGRAM_CHAT_ID",
    ],
  };
  for (const key of map[channel]) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function truncate(value: string, max = 280): string {
  const t = value.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Send a plain-text Telegram message to a channel group. Never throws to callers.
 */
export async function sendTelegramAlert(
  channel: TelegramAlertChannel,
  text: string,
): Promise<void> {
  const token = telegramToken();
  const chatId = chatIdFor(channel);
  if (!token || !chatId) return;

  const body = truncate(String(text ?? "").trim(), 3500);
  if (!body) return;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[telegram] sendMessage(${channel}) failed HTTP ${res.status}: ${detail.slice(0, 200)}`,
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[telegram] sendMessage(${channel}) error:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export function notifyTelegramChatRoomCreated(input: {
  roomId: string;
  initiatorId: number;
  recipientId?: number | null;
  shopId?: number | null;
  orderId?: number | null;
  source?: string;
}): void {
  const lines = [
    "DeeDyte · New chat room",
    `Room: ${input.roomId}`,
    `Initiator user: ${input.initiatorId}`,
  ];
  if (input.recipientId != null) lines.push(`Recipient user: ${input.recipientId}`);
  if (input.shopId != null) lines.push(`Shop id: ${input.shopId}`);
  if (input.orderId != null && input.orderId > 0) {
    lines.push(`Order id: ${input.orderId}`);
  }
  if (input.source) lines.push(`Source: ${input.source}`);
  void sendTelegramAlert("chat_room", lines.join("\n"));
}

export function notifyTelegramInvoiceRequested(input: {
  roomId: string;
  senderId: number;
  messageId?: string | null;
  preview?: string | null;
}): void {
  const lines = [
    "DeeDyte · Invoice requested",
    `Room: ${input.roomId}`,
    `Buyer user: ${input.senderId}`,
  ];
  if (input.messageId) lines.push(`Message: ${input.messageId}`);
  if (input.preview) lines.push(`Preview: ${truncate(input.preview, 200)}`);
  void sendTelegramAlert("invoice_request", lines.join("\n"));
}

export function notifyTelegramOrderPaid(input: {
  orderId?: string | number | null;
  customerId?: string | number | null;
  shopId?: string | number | null;
  amountPaid?: string | number | null;
  totalPaid?: string | number | null;
  currency?: string | null;
  paymentReference?: string | null;
  source?: string;
}): void {
  const currency = String(input.currency ?? "NGN").trim() || "NGN";
  const amount = Number(input.totalPaid ?? input.amountPaid ?? 0);
  const lines = ["DeeDyte · Order paid"];
  if (input.orderId != null && String(input.orderId).trim() !== "") {
    lines.push(`Order: ${input.orderId}`);
  }
  if (input.customerId != null) lines.push(`Buyer user: ${input.customerId}`);
  if (input.shopId != null) lines.push(`Shop id: ${input.shopId}`);
  if (Number.isFinite(amount) && amount > 0) {
    lines.push(`Amount: ${currency} ${amount.toLocaleString("en-NG")}`);
  }
  if (input.paymentReference) {
    lines.push(`Reference: ${input.paymentReference}`);
  }
  if (input.source) lines.push(`Source: ${input.source}`);
  void sendTelegramAlert("paid_order", lines.join("\n"));
}

/** Parse system card kind from chat message content. */
export function chatCardKind(content: unknown): string {
  if (content != null && typeof content === "object" && !Array.isArray(content)) {
    return String(
      (content as Record<string, unknown>).kind ??
        (content as Record<string, unknown>).type ??
        "",
    )
      .trim()
      .toLowerCase();
  }
  const raw = String(content ?? "").trim();
  if (!raw.startsWith("{")) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return String(parsed.kind ?? parsed.type ?? "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}
