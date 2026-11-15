const CARD_PREVIEWS = {
  invoice: 'Checkout invoice',
  invoice_request: 'Checkout invoice requested',
  invoice_request_declined: 'Invoice request declined',
  invoice_paid: 'Order placed · Paid',
  invoice_cancelled: 'Checkout invoice cancelled',
  shipping: 'Shipping details',
  inquiry: 'Product enquiry',
};

function looksLikeJson(text) {
  const t = String(text ?? '').trim();
  return t.startsWith('{') || t.startsWith('[') || t === '[object Object]';
}

function safeTitle(value) {
  if (typeof value !== 'string') return '';
  const title = value.trim();
  if (!title || title === '[object Object]' || looksLikeJson(title)) return '';
  return title;
}

function labelForKind(kind, title) {
  const label = CARD_PREVIEWS[kind];
  if (!label) return '';
  if (
    !title ||
    kind === 'shipping' ||
    kind === 'invoice_cancelled' ||
    kind === 'invoice_request_declined'
  ) {
    return label;
  }
  return `${label}: ${title}`;
}

/** Turns a room's last message into readable text; system cards are stored as JSON. */
export function chatPreviewText(raw) {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const kind = String(raw.kind ?? raw.type ?? '');
    const labeled = labelForKind(kind, safeTitle(raw.itemTitle));
    return labeled || 'Chat update';
  }

  const text = String(raw ?? '').trim();
  if (!text || text === '[object Object]') return text === '[object Object]' ? 'Chat update' : text;
  if (!text.startsWith('{') && !text.startsWith('[')) return text;

  try {
    const card = JSON.parse(text);
    if (card && typeof card === 'object' && !Array.isArray(card)) {
      const kind = String(card.kind ?? card.type ?? '');
      const labeled = labelForKind(kind, safeTitle(card.itemTitle));
      return labeled || 'Chat update';
    }
  } catch {
    const kind = text.match(/"(?:kind|type)"\s*:\s*"([a-z_]+)"/)?.[1] ?? '';
    const title = text.match(/"itemTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? '';
    const labeled = labelForKind(kind, safeTitle(title));
    if (labeled) return labeled;
  }

  return looksLikeJson(text) ? 'Chat update' : text;
}
