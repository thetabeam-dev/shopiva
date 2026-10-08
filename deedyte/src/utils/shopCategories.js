/**
 * `shops.category` is a text array. Older rows and APIs may still send one string.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseShopCategories(raw) {
  if (Array.isArray(raw)) {
    return uniqueCategories(raw);
  }
  if (raw == null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return uniqueCategories(parsed);
    } catch {
      // Fall through to a single label.
    }
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    return uniqueCategories(
      text
        .slice(1, -1)
        .split(',')
        .map(part => part.trim().replace(/^"|"$/g, '')),
    );
  }
  return uniqueCategories([text]);
}

/** @param {unknown[]} values */
function uniqueCategories(values) {
  const out = [];
  for (const value of values) {
    const key = String(value ?? '').trim().toLowerCase();
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}
