export function formatCategoryLabel(value) {
  return String(value ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function categoryHref(key) {
  return `/vendors?category=${encodeURIComponent(key)}`;
}
