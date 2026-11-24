import { getStoredAccessToken, getStoredActiveRole } from '../auth/session';
import { notifyUnauthorized } from '../auth/unauthorized';
import { getApiBaseUrl } from './config';

const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  image: 'image/jpeg',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  video: 'video/mp4',
};

/**
 * Map picker / platform aliases onto IANA types the API accepts.
 * @param {string} [type]
 * @param {string} [fileName]
 */
export function normalizeUploadMime(type, fileName = '') {
  const raw = String(type || '').toLowerCase().trim();
  if (MIME_ALIASES[raw]) return MIME_ALIASES[raw];
  if (raw.includes('/')) return raw;
  const ext = String(fileName).split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  return raw || 'image/jpeg';
}

/**
 * React Native multipart file part (`uri` + mime + name).
 * @param {{ uri: string; type?: string; mimeType?: string; name?: string; fileName?: string }} file
 */
export function toRnFilePart(file) {
  const name = file.name || file.fileName || 'upload.jpg';
  return {
    uri: file.uri,
    name,
    type: normalizeUploadMime(file.type || file.mimeType, name),
  };
}

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
  const method = String(rest.method || 'GET').toUpperCase();
  const hasBody = rest.body != null && rest.body !== '';
  const headers = {
    Accept: 'application/json',
    ...(optionHeaders && typeof optionHeaders === 'object' && !(optionHeaders instanceof Headers)
      ? optionHeaders
      : {}),
  };
  if (hasBody && !headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, {
    cache: 'no-store',
    ...rest,
    method,
    headers,
  });
}

/**
 * Native XHR so RN `{ uri, name, type }` FormData is not run through Expo's fetch polyfill.
 * @param {string} url
 * @param {{ method?: string; headers?: Record<string, string>; body: FormData }} options
 */
function xhrSendForm(url, { method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => {
      if (value != null && value !== '') {
        xhr.setRequestHeader(key, String(value));
      }
    });
    xhr.onload = () => {
      const status = xhr.status;
      const text = xhr.responseText || '';
      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
          try {
            return JSON.parse(text);
          } catch {
            return {};
          }
        },
        text: async () => text,
      });
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.send(body);
  });
}

/**
 * Authenticated multipart upload. Does not set `Content-Type` (boundary is set by XHR).
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
  const res = await xhrSendForm(url, {
    method: options.method || 'POST',
    headers,
    body: options.body,
  });
  if (token && res.status === 401) {
    notifyUnauthorized();
  }
  return res;
}
