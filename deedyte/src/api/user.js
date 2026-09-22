import DeviceInfo from 'react-native-device-info';
import { apiFetchAuth } from './client';
import { getApiBaseUrl } from './config';
import { Platform } from 'react-native';
import axios from 'axios';

/**
 * @param {unknown} data
 * @param {Response} res
 */
function pickError(data, res) {
  if (data && typeof data === 'object' && 'error' in data && data.error != null) {
    return String(/** @type {{ error?: string }} */ (data).error);
  }
  if (data && typeof data === 'object' && 'message' in data && data.message != null) {
    return String(/** @type {{ message?: string }} */ (data).message);
  }
  return `Request failed (HTTP ${res.status})`;
}

/**
 * Same request as {@link fetchCurrentUser}, with HTTP status for auth bootstrap.
 * @returns {Promise<{ ok: boolean; status: number; user: object | null; message: string }>}
 */
export async function fetchCurrentUserOrStatus() {

  const res = await apiFetchAuth('/user/authorization', {
    method: 'POST',
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    user: res.ok ? /** @type {object | null} */ (data.data ?? null) : null,
    message: pickError(data, res),
  };
}

/** Current profile (same shape as middleware `authenticateUser`). */
export async function fetchCurrentUser() {
  const r = await fetchCurrentUserOrStatus();
  return r.user;
}

/** Current profile (same shape as middleware `authenticateUser`). */
export async function fetchReturnId(orderId, role) {
  // const normalizedRole =
  //   String(role ?? '').trim().toLowerCase() === 'vendor' ? 'entrepreneur' : 'customer';
  const res = await apiFetchAuth(`/return/${orderId}`, {
    method: 'GET',
    // body: JSON.stringify({ role: normalizedRole }),
  });
  const data = await res.json().catch(() => ({}));
  console.log("data: ", data)
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return {
    ok: true,
    id: data.id.id
  };
}

/**
 * @param {number} userId
 * @param {string} role – app roles: `customer` | `vendor` (API may still expect `entrepreneur` for vendor)
 */
export async function updateUserRole(userId, role) {
  const normalizedRole =
    String(role ?? '').trim().toLowerCase() === 'vendor' ? 'entrepreneur' : 'customer';
  const res = await apiFetchAuth(`/user/role/update/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ role: normalizedRole }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return {
    ok: true,
    user: /** @type {object | undefined} */ (
      /** @type {{ user?: object }} */ (data).user
    ),
  };
}

/**
 * @param {number} userId
 * @param {string} email
 */
export async function updateUserEmail(userId, email) {
  const em = String(email ?? '').trim().toLowerCase();
  const res = await apiFetchAuth(`/user/email/update/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ email: em }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return {
    ok: true,
    user: /** @type {object | undefined} */ (
      /** @type {{ user?: object }} */ (data).user
    ),
  };
}

/**
 * @param {number} userId
 * @param {string} password – plain text; server hashes with bcrypt
 */
export async function updateUserPassword(userId, password) {
  const res = await apiFetchAuth(`/user/password/update/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ password: String(password ?? '') }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return { ok: true };
}

/**
 * @param {number} userId
 * @param {string} phone – WhatsApp / phone (digits or E.164)
 */
export async function updateUserPhone(userId, phone) {
  const res = await apiFetchAuth(`/user/phone/update/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ phone }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return {
    ok: true,
    user: /** @type {object | undefined} */ (
      /** @type {{ user?: object }} */ (data).user
    ),
  };
}

/**
 * @param {number} userId
 * @param {{
 *   fname?: string;
 *   lname?: string;
 *   gender?: string;
 *   preferredLanguage?: string;
 *   timezone?: string;
 *   location?: { city?: string; state?: string; country?: string }
 * }} fields
 */
export async function updateUserProfileFields(userId, fields) {
  const res = await apiFetchAuth(`/user/profile/update/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickError(data, res) };
  }
  return {
    ok: true,
    user: /** @type {object | undefined} */ (
      /** @type {{ user?: object }} */ (data).user
    ),
  };
}

/**
 * Permanently deletes the authenticated account.
 * @param {{
 *   password?: string;
 *   oauthProvider?: 'google' | 'facebook' | 'apple';
 *   oauthReauthenticated?: boolean;
 *   oauthReauthenticatedAt?: string;
 *   oauthReauthToken?: string;
 * }} [payload]
 */
export async function deleteAccount(payload = {}) {
  const res = await apiFetchAuth('/api/account', {
    method: 'DELETE',
    body: JSON.stringify(payload ?? {}),
  });

  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      message:
        (typeof data === 'object' && data && 'message' in data
          ? String(/** @type {{ message?: string }} */ (data).message ?? '')
          : '') || 'Account deleted successfully.',
    };
  }

  const message = pickError(data, res);
  if (res.status === 401) return { ok: false, status: 401, message };
  if (res.status === 403) return { ok: false, status: 403, message };
  if (res.status === 422) return { ok: false, status: 422, message };
  if (res.status >= 500) return { ok: false, status: 500, message };
  return { ok: false, status: res.status, message };
}

/** Debug: open in browser — `await pingApi()` */
export async function pingApi() {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/health`);
  return res.ok;
}



export const checkForUpdate = async () => {
  try {
    const base = getApiBaseUrl();
    const currentVersion = DeviceInfo.getVersion();
    const platformConfig =
    Platform.OS === 'ios' ? 'ios' : 'android';
      console.log("currentVersion: ", currentVersion);
      console.log("platformConfig: ", platformConfig);

    const { data } = await axios.get(`${base}/config/app-version`, {
      params: {
        _v: currentVersion,
        _os: platformConfig,
      },
    });

    return data;
    // App is up to date
  } catch (error) {
    console.error('Failed to check app version:', error);
  }
};
