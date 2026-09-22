import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISABLE_AUTH_STORAGE } from './devAuth';

const KEY_TOKEN = '@deedyte/auth_token';
const KEY_USER = '@deedyte/auth_user';
const KEY_ACTIVE_ROLE = '@deedyte/active_role';
const KEY_TOKEN_EXPIRES_AT = '@deedyte/auth_token_expires_at';
const KEY_PREAUTH_CHOICE = '@deedyte/preauth_choice';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** In-memory fallback when {@link DISABLE_AUTH_STORAGE} is true */
let memoryToken = null;

/** @type {object | null} */
let memoryUser = null;

/** @type {'customer' | 'vendor' | null} */
let memoryActiveRole = null;

/** Epoch ms when in-memory token expires. */
let memoryTokenExpiresAt = null;

/** @type {'customer' | 'vendor' | null} */
let memoryPreAuthChoice = null;

/**
 * @param {string | null | undefined} token
 * @param {object | null | undefined} user
 */
export async function saveSession(token, user = null) {
  const now = Date.now();
  const expiresAt = token ? now + TOKEN_TTL_MS : null;
  if (DISABLE_AUTH_STORAGE) {
    memoryToken = token ? String(token) : null;
    memoryUser = user ?? null;
    memoryTokenExpiresAt = expiresAt;
    return;
  }

  memoryToken = null;
  memoryUser = null;
  memoryTokenExpiresAt = null;

  if (token) {
    await AsyncStorage.setItem(KEY_TOKEN, String(token));
    await AsyncStorage.setItem(KEY_TOKEN_EXPIRES_AT, String(expiresAt));
  } else {
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_TOKEN_EXPIRES_AT]);
  }
  if (user != null) {
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(KEY_USER);
  }
}

/** @returns {Promise<string | null>} */
export async function getStoredAccessToken() {
  if (DISABLE_AUTH_STORAGE) {
    if (!memoryToken) return null;
    if (memoryTokenExpiresAt != null && Number(memoryTokenExpiresAt) <= Date.now()) {
      memoryToken = null;
      memoryUser = null;
      memoryTokenExpiresAt = null;
      return null;
    }
    return memoryToken;
  }
  try {
    const token = await AsyncStorage.getItem(KEY_TOKEN);
    if (!token) return null;
    const expiresRaw = await AsyncStorage.getItem(KEY_TOKEN_EXPIRES_AT);
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt)) {
      // Backfill expiry for older sessions created before TTL was introduced.
      await AsyncStorage.setItem(KEY_TOKEN_EXPIRES_AT, String(Date.now() + TOKEN_TTL_MS));
      return token;
    }
    if (expiresAt <= Date.now()) {
      await AsyncStorage.multiRemove([KEY_TOKEN, KEY_USER, KEY_TOKEN_EXPIRES_AT]);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/** @returns {Promise<object | null>} */
export async function getStoredUser() {
  if (DISABLE_AUTH_STORAGE) {
    return memoryUser;
  }
  try {
    const raw = await AsyncStorage.getItem(KEY_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} role
 * @returns {'customer' | 'vendor' | null}
 */
function normalizeRole(role) {
  const v = String(role ?? '').trim().toLowerCase();
  if (v === 'vendor') return 'vendor';
  if (v === 'customer') return 'customer';
  return null;
}

/**
 * @param {string | null | undefined} choice
 * @returns {'customer' | 'vendor' | null}
 */
function normalizePreAuthChoice(choice) {
  const v = String(choice ?? '').trim().toLowerCase();
  if (v === 'vendor') return 'vendor';
  if (v === 'customer') return 'customer';
  return null;
}

/**
 * Persists preferred signed-in app role.
 * @param {'customer' | 'vendor'} role
 */
export async function saveActiveRole(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return;
  if (DISABLE_AUTH_STORAGE) {
    memoryActiveRole = normalized;
    return;
  }
  await AsyncStorage.setItem(KEY_ACTIVE_ROLE, normalized);
}

/** @returns {Promise<'customer' | 'vendor' | null>} */
export async function getStoredActiveRole() {
  if (DISABLE_AUTH_STORAGE) {
    return memoryActiveRole;
  }
  try {
    return normalizeRole(await AsyncStorage.getItem(KEY_ACTIVE_ROLE));
  } catch {
    return null;
  }
}

/**
 * Stores the one-time pre-auth choice (customer/vendor) shown before login.
 * This intentionally survives sign-out; reset via clearAllDeedyteStorage.
 * @param {'customer' | 'vendor'} choice
 */
export async function savePreAuthChoice(choice) {
  const normalized = normalizePreAuthChoice(choice);
  if (!normalized) return;
  if (DISABLE_AUTH_STORAGE) {
    memoryPreAuthChoice = normalized;
    return;
  }
  await AsyncStorage.setItem(KEY_PREAUTH_CHOICE, normalized);
}

/** @returns {Promise<'customer' | 'vendor' | null>} */
export async function getStoredPreAuthChoice() {
  if (DISABLE_AUTH_STORAGE) {
    return memoryPreAuthChoice;
  }
  try {
    return normalizePreAuthChoice(await AsyncStorage.getItem(KEY_PREAUTH_CHOICE));
  } catch {
    return null;
  }
}

/** Clears auth token/user (memory + AsyncStorage keys used by this module). */
export async function clearSession() {
  memoryToken = null;
  memoryUser = null;
  memoryActiveRole = null;
  memoryTokenExpiresAt = null;
  await AsyncStorage.multiRemove([KEY_TOKEN, KEY_USER, KEY_ACTIVE_ROLE, KEY_TOKEN_EXPIRES_AT]);
}

/**
 * Deletes **all** persisted keys prefixed with `@deedyte` (auth + anything else you add later)
 * and clears in-memory auth. Use for a completely fresh local state.
 */
export async function clearAllDeedyteStorage() {
  memoryToken = null;
  memoryUser = null;
  memoryActiveRole = null;
  memoryTokenExpiresAt = null;
  memoryPreAuthChoice = null;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => typeof k === 'string' && k.startsWith('@deedyte'));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_USER, KEY_ACTIVE_ROLE, KEY_TOKEN_EXPIRES_AT]);
  }
}
