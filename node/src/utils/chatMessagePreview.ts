/** Human-readable labels for system chat cards (FCM + room last_message). */
const CARD_LABELS: Record<string, string> = {
  invoice: "Checkout invoice",
  invoice_request: "Checkout invoice requested",
  invoice_request_declined: "Invoice request declined",
  invoice_paid: "Order placed · Paid",
  invoice_cancelled: "Checkout invoice cancelled",
  shipping: "Shipping details",
  inquiry: "Product enquiry",
};

function looksLikeJsonObject(text: string): boolean {
  const t = text.trim();
  return t.startsWith("{") || t.startsWith("[") || t === "[object Object]";
}

function safeItemTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  const title = value.trim();
  if (!title || title === "[object Object]" || looksLikeJsonObject(title)) return "";
  return title.slice(0, 80);
}

function labelForKind(kind: string, title: string): string {
  const label = CARD_LABELS[kind];
  if (!label) return "";
  if (!title || kind === "shipping" || kind === "invoice_cancelled" || kind === "invoice_request_declined") {
    return label;
  }
  return `${label}: ${title}`;
}

function previewFromCard(card: Record<string, unknown>): string | null {
  const kind = String(card.kind ?? card.type ?? "").trim();
  if (!kind) return null;
  const titled = labelForKind(kind, safeItemTitle(card.itemTitle));
  if (titled) return titled;
  // Unknown card kind — never leak raw JSON to users
  return "Chat update";
}

/**
 * Normalize create_message content so objects become JSON strings
 * (Socket.IO may deliver structured payloads as objects).
 */
export function normalizeChatContent(content: unknown): string | null {
  if (content == null) return null;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed || null;
  }
  if (typeof content === "object") {
    try {
      return JSON.stringify(content);
    } catch {
      return null;
    }
  }
  const asString = String(content).trim();
  if (!asString || asString === "[object Object]") return null;
  return asString;
}

/**
 * Preview text for FCM banners and chat_rooms.last_message.
 * Never returns raw JSON / [object Object].
 */
export function chatMessagePreview(content: unknown, maxLen = 140): string {
  if (content != null && typeof content === "object" && !Array.isArray(content)) {
    const fromObj = previewFromCard(content as Record<string, unknown>);
    if (fromObj) return fromObj.slice(0, maxLen);
  }

  const raw = normalizeChatContent(content) ?? "";
  if (!raw) return "New chat message";
  if (raw === "[object Object]") return "Chat update";

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const fromCard = previewFromCard(parsed as Record<string, unknown>);
        if (fromCard) return fromCard.slice(0, maxLen);
      }
    } catch {
      const kind = raw.match(/"(?:kind|type)"\s*:\s*"([a-z_]+)"/)?.[1] ?? "";
      const titleMatch = raw.match(/"itemTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? "";
      const titled = labelForKind(kind, safeItemTitle(titleMatch.replace(/\\"/g, '"')));
      if (titled) return titled.slice(0, maxLen);
      if (looksLikeJsonObject(raw)) return "Chat update";
    }
    if (looksLikeJsonObject(raw)) return "Chat update";
  }

  return raw.slice(0, maxLen);
}
