import { getMessaging } from '@react-native-firebase/messaging';
import { apiFetch } from './client';
import { DEFAULT_API_BASE_URL, getApiBaseUrl } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * Matches Deedyte Express (`deedyte/node`): `/user/signin`, `/user/signup`.
 * Responses: `{ token, user?, message?, error? }`.
 */

/** @returns {string} */
function cannotReachApiMessage() {
  const base = getApiBaseUrl();
  if (base === DEFAULT_API_BASE_URL) {
    return `Cannot reach the Deedyte API at ${base}. Check your internet connection and try again — Render free instances may take ~30s to wake up.`;
  }
  return `Cannot reach the API at ${base}. Make sure the Node server (deedyte/node) is running and reachable from your device.`;
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 */
async function apiFetchSafe(path, options) {
  try {
    return await apiFetch(path, options);
  } catch {
    return /** @type {const} */ ({ __networkError: true });
  }
}

/** @param {{ __networkError?: boolean } | Response} res */
function isNetworkError(res) {
  return res && typeof res === 'object' && '__networkError' in res && res.__networkError;
}

/**
 * @param {string} fullName
 * @returns {{ fname: string; lname: string }}
 */
function splitFullName(fullName) {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  const fname = parts[0] ?? 'User';
  const lname = parts.length > 1 ? parts.slice(1).join(' ') : '';
  return { fname, lname };
}

/**
 * @param {unknown} body
 * @returns {string | null}
 */
function pickToken(body) {
  if (!body || typeof body !== 'object') return null;
  const b = /** @type {Record<string, unknown>} */ (body);
  const nested = b.data && typeof b.data === 'object' ? /** @type {Record<string, unknown>} */ (b.data) : null;
  const t =
    b.token ||
    b.accessToken ||
    b.access_token ||
    nested?.token ||
    nested?.accessToken;
  return typeof t === 'string' && t.length > 0 ? t : null;
}

/**
 * @param {unknown} body
 * @returns {object | null}
 */
function pickUser(body) {
  if (!body || typeof body !== 'object') return null;
  const b = /** @type {Record<string, unknown>} */ (body);
  const nested = b.data && typeof b.data === 'object' ? /** @type {Record<string, unknown>} */ (b.data) : null;
  const u = b.user || nested?.user || nested?.profile;
  return u && typeof u === 'object' ? /** @type {object} */ (u) : null;
}

/**
 * @param {unknown} body
 * @param {Response} res
 */
function pickErrorMessage(body, res) {
  if (body && typeof body === 'object') {
    const b = /** @type {Record<string, unknown>} */ (body);
    const msg = b.error ?? b.message ?? b.detail ?? b.details;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return `Request failed (HTTP ${res.status})`;
}

/**
 * @param {unknown} body
 */
function needsVerification(body) {
  if (!body || typeof body !== 'object') return false;
  const b = /** @type {Record<string, unknown>} */ (body);
  return Boolean(
    b.requiresVerification ||
      b.verificationRequired ||
      b.needsVerification ||
      b.verifyEmail ||
      nestedBool(b.data, 'requiresVerification'),
  );
}

/** @param {unknown} data @param {string} key */
function nestedBool(data, key) {
  if (!data || typeof data !== 'object') return false;
  return Boolean(/** @type {Record<string, unknown>} */ (data)[key]);
}

/**
 * @param {string} emailOrUsername
 * @param {string} password
 * @returns {Promise<{ ok: true, token: string, user: object | null } | { ok: false, needsVerification?: boolean, email?: string, message: string }>}
 */
export async function loginWithPassword(emailOrUsername, password) {
  const login = String(emailOrUsername ?? '').trim();
  const pwd = String(password ?? '');
  if (!login || !pwd) {
    return { ok: false, message: 'Enter email or username and password.' };
  }
  // const fcmToken = await getMessaging().getToken();
  // Alert.alert(fcmToken)
  // console.log('Device FCM Token:', token);
  // await AsyncStorage.setItem("fcm", (fcmToken));

  /** Backend `/user/signin` expects `{ email, password }` (email sign-in only). */
  const res = await apiFetchSafe('/user/signin', {
    method: 'POST',
    body: JSON.stringify({
      email: login,
      password: pwd,
      // fcmToken
    }),
  });

  if (isNetworkError(res)) {
    return { ok: false, message: cannotReachApiMessage() };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickErrorMessage(data, res) };
  }

  const token = pickToken(data);
  if (token) {
    return { ok: true, token, user: pickUser(data) };
  }

  if (needsVerification(data)) {
    const email =
      (typeof data === 'object' && data && 'email' in data && typeof /** @type {{ email?: string }} */ (data).email === 'string'
        ? /** @type {{ email?: string }} */ (data).email
        : null) || (login.includes('@') ? login : undefined);
    return {
      ok: false,
      needsVerification: true,
      email: email || login,
      message: typeof data === 'object' && data && 'message' in data ? String(/** @type {{ message?: string }} */ (data).message || '') : '',
    };
  }

  return {
    ok: false,
    message: pickErrorMessage(data, res) || 'Login did not return a token. Check server response shape.',
  };
}

/**
 * @param {{ name: string; email: string; password: string }} fields
 */
export async function registerAccount({ name, email, password }) {
  const em = String(email).trim().toLowerCase();
  const { fname, lname } = splitFullName(name);

  const res = await apiFetchSafe('/user/signup', {
    method: 'POST',
    body: JSON.stringify({
      fname,
      lname,
      email: em,
      password: String(password),
      provider: 'local',
      role: 'customer',
      src: 'app',
      deviceId: 'react-native',
      deviceToken: 'react-native',
    }),
  });

  if (isNetworkError(res)) {
    return { ok: false, message: cannotReachApiMessage() };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickErrorMessage(data, res) };
  }

  const token = pickToken(data);
  if (token) {
    return { ok: true, token, user: pickUser(data) };
  }

  return {
    ok: true,
    pendingVerification: true,
    message:
      (typeof data === 'object' && data && 'message' in data && typeof /** @type {{ message?: string }} */ (data).message === 'string'
        ? /** @type {{ message?: string }} */ (data).message
        : '') || 'Check your email for a verification code.',
  };
}

/**
 * @param {string} email
 * @param {string} code
 */
export async function verifyEmailCode(email, code) {
  const res = await apiFetchSafe('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email).trim().toLowerCase(),
      code: String(code).trim(),
    }),
  });

  if (isNetworkError(res)) {
    return { ok: false, message: cannotReachApiMessage() };
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickErrorMessage(data, res) };
  }

  const token = pickToken(data);
  if (!token) {
    return {
      ok: false,
      message: pickErrorMessage(data, res) || 'Verification succeeded but no token was returned.',
    };
  }

  return { ok: true, token, user: pickUser(data) };
}

/** Fallback if your server only exposes POST /api/auth/verify */
export async function verifyEmailCodeAlt(email, code) {
  const res = await apiFetchSafe('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({
      email: String(email).trim().toLowerCase(),
      code: String(code).trim(),
    }),
  });
  if (isNetworkError(res)) {
    return { ok: false, message: cannotReachApiMessage() };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickErrorMessage(data, res) };
  }
  const token = pickToken(data);
  if (!token) return { ok: false, message: pickErrorMessage(data, res) };
  return { ok: true, token, user: pickUser(data) };
}

/** Tries `verify-email` first, then `verify` (handy while server routes are in flux). */
export async function verifyEmailCodeWithFallback(email, code) {
  const first = await verifyEmailCode(email, code);
  if (first.ok) return first;
  const second = await verifyEmailCodeAlt(email, code);
  if (second.ok) return second;
  return { ok: false, message: first.message || second.message || 'Verification failed.' };
}

/**
 * @param {string} email
 */
export async function resendVerificationEmail(email) {
  const res = await apiFetchSafe('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: String(email).trim().toLowerCase() }),
  });
  if (isNetworkError(res)) {
    return { ok: false, message: cannotReachApiMessage() };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, message: pickErrorMessage(data, res) };
  }
  return {
    ok: true,
    message:
      (typeof data === 'object' && data && 'message' in data ? String(/** @type {{ message?: string }} */ (data).message || '') : '') ||
      'If an account exists, a new code was sent.',
  };
}
