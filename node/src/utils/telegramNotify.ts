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

type TelegramSendResult = {
  channel: TelegramAlertChannel;
  chatId: string;
  ok: boolean;
  status?: number;
  error?: string;
};

/** Candidate Bot API ids for a Telegram Web `#-NNNN` group peer. */
function chatIdCandidates(raw: string): string[] {
  const id = String(raw ?? "").trim();
  if (!id) return [];
  const out = [id];
  // Supergroups / channels often need -100XXXXXXXXXX while Web shows -XXXXXXXXXX
  if (/^-\d+$/.test(id) && !id.startsWith("-100")) {
    out.push(`-100${id.slice(1)}`);
  }
  return out;
}

async function postTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (res.ok) return { ok: true, status: res.status };
  const detail = await res.text().catch(() => "");
  return {
    ok: false,
    status: res.status,
    error: detail.slice(0, 300) || `HTTP ${res.status}`,
  };
}

/**
 * Send a plain-text Telegram message to a channel group.
 * Returns delivery status; never throws.
 */
export async function sendTelegramAlert(
  channel: TelegramAlertChannel,
  text: string,
): Promise<TelegramSendResult> {
  const token = telegramToken();
  const configuredId = chatIdFor(channel);
  if (!token) {
    return {
      channel,
      chatId: configuredId,
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not set",
    };
  }
  if (!configuredId) {
    return {
      channel,
      chatId: configuredId,
      ok: false,
      error: `No chat id configured for ${channel}`,
    };
  }

  const body = truncate(String(text ?? "").trim(), 3500);
  if (!body) {
    return { channel, chatId: configuredId, ok: false, error: "Empty message" };
  }

  try {
    let last: { ok: boolean; status: number; error?: string; chatId: string } | null =
      null;
    for (const chatId of chatIdCandidates(configuredId)) {
      const result = await postTelegramMessage(token, chatId, body);
      last = { ...result, chatId };
      if (result.ok) {
        return { channel, chatId, ok: true, status: result.status };
      }
      // Only fall through to -100… when Telegram says the peer is unknown.
      if (!String(result.error ?? "").includes("chat not found")) {
        break;
      }
    }
    if (process.env.NODE_ENV !== "production" && last?.error) {
      console.warn(
        `[telegram] sendMessage(${channel}) failed HTTP ${last.status}: ${last.error.slice(0, 200)}`,
      );
    }
    const failed: TelegramSendResult = {
      channel,
      chatId: last?.chatId ?? configuredId,
      ok: false,
      error:
        last?.error ||
        "chat not found — add the bot to the group, then copy chat.id from GET /ops/telegram-chats",
    };
    if (typeof last?.status === "number") failed.status = last.status;
    return failed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[telegram] sendMessage(${channel}) error:`, message);
    }
    return { channel, chatId: configuredId, ok: false, error: message };
  }
}

/**
 * List chats Telegram has delivered to this bot (after the bot is added
 * to a group and someone posts there, or the bot is @mentioned).
 */
export async function listTelegramVisibleChats(): Promise<{
  ok: boolean;
  chats: Array<{ id: number | string; type: string; title: string }>;
  error?: string;
  hint?: string;
}> {
  const token = telegramToken();
  if (!token) {
    return { ok: false, chats: [], error: "TELEGRAM_BOT_TOKEN is not set" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=100`,
    );
    type TgChat = {
      id?: number;
      type?: string;
      title?: string;
      username?: string;
    };
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: Array<{
        message?: { chat?: TgChat };
        my_chat_member?: { chat?: TgChat };
        channel_post?: { chat?: TgChat };
      }>;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        chats: [],
        error: data.description || `HTTP ${res.status}`,
      };
    }
    const byId = new Map<string, { id: number | string; type: string; title: string }>();
    for (const update of data.result ?? []) {
      const chat =
        update.message?.chat ||
        update.my_chat_member?.chat ||
        update.channel_post?.chat;
      if (!chat?.id) continue;
      const key = String(chat.id);
      byId.set(key, {
        id: chat.id,
        type: String(chat.type ?? "unknown"),
        title: String(chat.title || chat.username || key),
      });
    }
    return {
      ok: true,
      chats: [...byId.values()],
      hint:
        byId.size === 0
          ? "No chats yet. Add the bot to each group, send any message in the group, then reload this endpoint and copy the numeric id (keep the leading -)."
          : "Use these id values in TELEGRAM_CHAT_ID_* (keep the leading - for groups).",
    };
  } catch (err) {
    return {
      ok: false,
      chats: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Send one demo message to each configured ops group. */
export async function sendTelegramDemoMessages(): Promise<TelegramSendResult[]> {
  const stamp = new Date().toISOString();
  return Promise.all([
    sendTelegramAlert(
      "chat_room",
      `DeeDyte · Demo\nChannel: new chat room\nTime: ${stamp}`,
    ),
    sendTelegramAlert(
      "invoice_request",
      `DeeDyte · Demo\nChannel: invoice request\nTime: ${stamp}`,
    ),
    sendTelegramAlert(
      "paid_order",
      `DeeDyte · Demo\nChannel: paid order\nTime: ${stamp}`,
    ),
  ]);
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
