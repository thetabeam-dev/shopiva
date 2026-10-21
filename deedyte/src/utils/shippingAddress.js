/**
 * @param {unknown} raw
 * @returns {Record<string, string> | null}
 */
export function parseShippingAddress(raw) {
  if (raw && typeof raw === 'object') return /** @type {Record<string, string>} */ (raw);
  const text = String(raw ?? '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    const loose = {};
    const pattern = /([A-Za-z0-9_]+)\s*:\s*"([^"]*)"/g;
    let match = pattern.exec(text);
    while (match) {
      loose[match[1]] = match[2];
      match = pattern.exec(text);
    }
    if (Object.keys(loose).length) return loose;
  }
  return null;
}

function capitalizeWords(value) {
  return String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Readable delivery line. Legacy plain-text addresses stay as written.
 * @param {unknown} raw
 * @param {string} [emptyLabel]
 */
export function formatShippingAddress(raw, emptyLabel = 'Not available') {
  const parsed = parseShippingAddress(raw);
  if (!parsed) {
    const text = String(raw ?? '').trim();
    return text ? capitalizeWords(text) : emptyLabel;
  }
  const parts = [
    parsed.street_address ?? parsed.street,
    parsed.area_1 ?? parsed.area1,
    parsed.area_2 ?? parsed.area2,
    parsed.city,
    parsed.state,
    parsed.zipcode ?? parsed.zip_code ?? parsed.zip,
  ]
    .map((part) => capitalizeWords(part))
    .filter(Boolean);
  return parts.join(', ') || emptyLabel;
}

/** @param {unknown} raw */
export function shippingAddressState(raw) {
  const parsed = parseShippingAddress(raw);
  return String(parsed?.state ?? '').trim();
}
