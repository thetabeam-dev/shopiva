/**
 * Normalize category labels for matching chips ↔ product.category.
 * Mirrors the home-tab `categoryKey` helper in the mobile app.
 */
export function normalizeCategoryKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Postgres expression that applies the same normalization as {@link normalizeCategoryKey}.
 * `columnSql` must be a safe identifier/expression (e.g. `p.category`).
 */
export function sqlNormalizeCategoryKey(columnSql: string): string {
  return `TRIM(BOTH FROM regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(LOWER(BTRIM(COALESCE(${columnSql}, ''))), '&', ' and ', 'g'),
        '[_-]+', ' ', 'g'
      ),
      '[^a-z0-9]+', ' ', 'g'
    ),
    '\\s+', ' ', 'g'
  ))`;
}
