export const DELIVERY_TIMEFRAME_OPTIONS = [
  { label: 'Within 24 hours (today)', value: '24_hrs' },
  { label: 'Within 48 hours (tomorrow)', value: '48_hrs' },
  { label: 'Within 72 hours (3 days)', value: '72_hrs' },
  { label: 'Within 96 hours (4 days)', value: '96_hrs' },
  { label: 'Within 120 hours (5 days)', value: '120_hrs' },
  { label: 'Within 144 hours (6 days)', value: '144_hrs' },
  { label: 'Within 168 hours (7 days)', value: '168_hrs' },
];

const LEGACY_LABELS = {
  'same day delivery': '24_hrs',
  '1-2 days': '48_hrs',
  '3-5 days': '120_hrs',
  '5-7 days': '168_hrs',
  'more than 7 days': '168_hrs',
};

/** Maps an invoice delivery time (key, label, or older free-form label) to a timeframe key. */
export function deliveryTimeKey(raw) {
  const parts = String(raw ?? '').split('·').map((p) => p.trim().toLowerCase()).filter(Boolean);
  for (const part of parts.reverse()) {
    const match = DELIVERY_TIMEFRAME_OPTIONS.find(
      (o) => o.value === part || o.label.toLowerCase() === part,
    );
    if (match) return match.value;
    if (LEGACY_LABELS[part]) return LEGACY_LABELS[part];
  }
  return null;
}

export function deliveryTimeLabel(key) {
  return DELIVERY_TIMEFRAME_OPTIONS.find((o) => o.value === key)?.label ?? '';
}
