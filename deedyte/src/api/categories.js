import { apiFetch } from './client';

/**
 * Load category rows from the Node API.
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function getCategories() {
  const res = await apiFetch('/categories');
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const hint =
      data?.error ||
      data?.message ||
      `Could not load categories (HTTP ${res.status}).`;
    throw new Error(hint);
  }
  return Array.isArray(data) ? data : [];
}