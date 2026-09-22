import axios from "axios";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

/**
 * Default port — only relevant when {@link setApiBaseUrlOverride} is used to point
 * at a local Node server. Production traffic goes to {@link DEFAULT_API_BASE_URL}.
 * @type {string}
 */
export const API_DEFAULT_PORT = '3456';

/**
 * Live Deedyte API on Render. Used unless overridden via {@link setApiBaseUrlOverride}
 * for local development.
 */
// export const DEFAULT_API_BASE_URL = 'http://192.168.1.3:3456';
// export const DEFAULT_API_BASE_URL = 'http://172.20.10.4:3456';

// export const DEFAULT_API_BASE_URL = 'https://shopiva-4okj.onrender.com'; //Staging url
export const DEFAULT_API_BASE_URL = 'https://shopiva-1.onrender.com'; //Production url

/**
 * Optional full base URL override (e.g. local dev or staging):
 * `import { setApiBaseUrlOverride } from './api/config';`
 * `setApiBaseUrlOverride('http://192.168.1.10:3456');`
 */
let baseUrlOverride = null;

/** @param {string | null | undefined} url - e.g. http://192.168.0.5:3456 — trailing slash stripped; null clears */
export function setApiBaseUrlOverride(url) {
  baseUrlOverride = url && String(url).trim() ? String(url).trim().replace(/\/$/, '') : null;
}

export function getApiBaseUrlOverride() {
  return baseUrlOverride;
}

/**
 * Base URL for the Deedyte Node API.
 *
 * Default: {@link DEFAULT_API_BASE_URL} (the live Render deployment).
 * Override for local dev with {@link setApiBaseUrlOverride}, e.g.
 * `setApiBaseUrlOverride('http://10.0.2.2:3456')` on Android emulator
 * or `setApiBaseUrlOverride('http://localhost:3456')` on iOS simulator.
 */
export function getApiBaseUrl() {
  if (baseUrlOverride) {
    return baseUrlOverride;
  }
  return DEFAULT_API_BASE_URL;
}
