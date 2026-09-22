import { apiFetch } from './client';

/**
 * Load active logistics providers from the Node API.
 * @returns {Promise<Record<string, unknown>[]>}
 */
export async function getLogisticsProviders() {
  const res = await apiFetch('/logistics-providers');
  const data = await res.json().catch(() => []);
  if (!res.ok) {
    const hint =
      data?.error ||
      data?.message ||
      `Could not load logistics providers (HTTP ${res.status}).`;
    throw new Error(hint);
  }
  return Array.isArray(data) ? data : [];
}