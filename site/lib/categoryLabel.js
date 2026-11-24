export function formatCategoryLabel(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function categoryHref(key) {
  const slug = String(key ?? "").trim().toLowerCase();
  return `/${encodeURIComponent(slug)}`;
}

export function isProductIdParam(value) {
  return /^\d+$/.test(String(value ?? "").trim());
}
