const CARD_LABELS = {
  invoice: 'Checkout invoice',
  shipping: 'Shipping details',
  inquiry: 'Product enquiry',
};

export function previewChatContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const kind = String(parsed.kind ?? parsed.type ?? '').toLowerCase();
        const title = String(parsed.itemTitle ?? parsed.title ?? '').trim();
        const label = CARD_LABELS[kind];
        if (label) return title && kind !== 'shipping' ? `${label}: ${title}` : label;
        return 'Chat update';
      }
    } catch {
      return 'Chat update';
    }
  }
  return raw;
}

export function parseChatCard(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const kind = String(parsed.kind ?? parsed.type ?? '').toLowerCase();
    if (!kind) return null;
    return { ...parsed, kind };
  } catch {
    return null;
  }
}
