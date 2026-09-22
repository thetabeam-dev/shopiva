import { getApiBaseUrl } from './config';

const START_PATHS = {
  google: '/api/oauth/google',
  facebook: '/api/oauth/facebook',
  apple: '/api/oauth/apple',
};

/**
 * Opens in the system browser / Safari — server redirects back to `deedyte://oauth?token=...`.
 * @param {'google' | 'facebook' | 'apple'} provider
 */
export function getOAuthStartUrl(provider) {
  const p = String(provider).toLowerCase();
  const path = START_PATHS[p];
  if (!path) {
    throw new Error(`Unknown OAuth provider: ${provider}`);
  }
  return `${getApiBaseUrl()}${path}`;
}

/**
 * @param {string} url
 * @returns {{ token?: string, error?: string } | null}
 */
export function parseOAuthCallbackUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  if (!url.includes('deedyte://oauth')) {
    return null;
  }
  try {
    const qi = url.indexOf('?');
    if (qi === -1) {
      return {};
    }
    const qs = url.slice(qi + 1);
    const params = new URLSearchParams(qs);
    const token = params.get('token');
    const error = params.get('error');
    /** @type {{ token?: string, error?: string }} */
    const out = {};
    if (token) out.token = token;
    if (error) out.error = error;
    return out;
  } catch {
    return null;
  }
}

/** @param {string} [code] */
export function oauthErrorMessage(code) {
  if (!code) return 'Sign-in failed.';
  const map = {
    google_not_configured: 'Google sign-in is not configured on the API server.',
    facebook_not_configured: 'Facebook sign-in is not configured on the API server.',
    apple_not_configured: 'Sign in with Apple is not configured yet.',
    oauth_failed: 'Sign-in was cancelled or failed.',
  };
  return map[code] ?? code;
}
