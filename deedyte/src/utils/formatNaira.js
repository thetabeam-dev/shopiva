/**
 * Nigerian Naira (NGN) — Unicode symbol ₦ (U+20A6).
 * @param {number | null | undefined} amount
 * @returns {string}
 */
export function formatNaira(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return `₦${Math.round(Number(amount)).toLocaleString('en-NG')}`;
}
