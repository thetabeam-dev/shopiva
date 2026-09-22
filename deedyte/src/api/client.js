import { getStoredAccessToken, getStoredActiveRole } from '../auth/session';
import { notifyUnauthorized } from '../auth/unauthorized';
import { getApiBaseUrl } from './config';

/**
 * Same as {@link apiFetch}, but attaches `Authorization: Bearer <token>` when a session exists.
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiFetchAuth(path, options = {}) {
  const token = await getStoredAccessToken();
  const appRole = await getStoredActiveRole();
  const prev = options.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers)
    ? /** @type {Record<string, string>} */ ({ ...options.headers })
    : {};
  const headers = { ...prev };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  /** Lets the API scope responses if a route supports dual identity (same account, buyer vs seller context). */
  if (!headers['X-Deedyte-App-Role'] && !headers['x-deedyte-app-role']) {
    headers['X-Deedyte-App-Role'] = appRole === 'vendor' ? 'vendor' : 'customer';
  }
  const res = await apiFetch(path, { ...options, headers });
  if (token && res.status === 401) {
    notifyUnauthorized();
  }
  return res;
}

/**
 * JSON fetch against the Node server (no Next `/api/backend` proxy — RN talks to Node directly).
 * @param {string} path - Absolute path on API host, e.g. `/discover/vendors?category=fashion`
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalized}`;
  const { headers: optionHeaders, ...rest } = options;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(optionHeaders && typeof optionHeaders === 'object' && !(optionHeaders instanceof Headers)
      ? optionHeaders
      : {}),
  };
  return fetch(url, {
    ...rest,
    headers,
  });
}

/**
 * Authenticated fetch without forcing JSON `Content-Type` (for `FormData` uploads).
 * @param {string} path
 * @param {RequestInit} [options]
 */
export async function apiFetchAuthMultipart(path, options = {}) {
  const token = await getStoredAccessToken();
  const appRole = await getStoredActiveRole();
  const prev =
    options.headers && typeof options.headers === 'object' && !(options.headers instanceof Headers)
      ? /** @type {Record<string, string>} */ ({ ...options.headers })
      : {};
  const headers = { Accept: 'application/json', ...prev };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!headers['X-Deedyte-App-Role'] && !headers['x-deedyte-app-role']) {
    headers['X-Deedyte-App-Role'] = appRole === 'vendor' ? 'vendor' : 'customer';
  }
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalized}`;
  const res = await fetch(url, { ...options, headers });
  if (token && res.status === 401) {
    notifyUnauthorized();
  }
  return res;
}
