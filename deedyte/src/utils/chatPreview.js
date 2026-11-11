const CARD_PREVIEWS = {
  invoice: 'Checkout invoice',
  invoice_request: 'Checkout invoice requested',
  invoice_paid: 'Order placed · Paid',
  invoice_cancelled: 'Checkout invoice cancelled',
  shipping: 'Shipping details',
  inquiry: 'Product enquiry',
};

/** Turns a room's last message into readable text; system cards are stored as JSON. */
export function chatPreviewText(raw) {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('{')) return text;
  try {
    const card = JSON.parse(text);
    const kind = String(card?.kind ?? card?.type ?? '');
    const label = CARD_PREVIEWS[kind];
    if (!label) return text;
    const title = String(card?.itemTitle ?? '').trim();
    return title && kind !== 'shipping' ? `${label}: ${title}` : label;
  } catch {
    const kind = text.match(/"(?:kind|type)"\s*:\s*"([a-z_]+)"/)?.[1] ?? '';
    const title = text.match(/"itemTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? '';
    const label = CARD_PREVIEWS[kind];
    if (!label) return text.startsWith('{"') ? 'New message' : text;
    return title && kind !== 'shipping' ? `${label}: ${title}` : label;
  }
}
