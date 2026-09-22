import { Linking, NativeModules, Platform } from 'react-native';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { DISABLE_AUTH_STORAGE } from './devAuth';
import { getOAuthStartUrl, parseOAuthCallbackUrl, oauthErrorMessage } from '../api/oauth';

/** Must match server `OAUTH_APP_REDIRECT_URI` (default `deedyte://oauth`). */
export const OAUTH_REDIRECT_URI = 'deedyte://oauth';

/**
 * True when the native module is linked. If false, `InAppBrowser.isAvailable` will crash
 * (it calls `NativeModules.RNInAppBrowser.isAvailable` and the module is null until a full rebuild).
 */
function hasNativeInAppBrowser() {
  return NativeModules.RNInAppBrowser != null;
}

/**
 * Runs OAuth in Custom Tabs / ASWebAuthenticationSession when native code is present.
 * Otherwise opens the auth URL with Linking — complete sign-in via `deedyte://oauth` deep link (see `navigations/index.js`).
 * @param {'google' | 'facebook' | 'apple'} provider
 * @returns {Promise<{ ok: true, token: string } | { ok: false, cancelled?: boolean, external?: boolean, message?: string }>}
 */
export async function runOAuthInPopup(provider) {
  const authUrl = getOAuthStartUrl(provider);

  // Native module missing until: iOS `pod install` + rebuild; Android `./gradlew` rebuild after `npm install`
  if (!hasNativeInAppBrowser()) {
    try {
      await Linking.openURL(authUrl);
      return { ok: false, external: true };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : 'Could not open sign-in. Rebuild the app after installing native dependencies.',
      };
    }
  }

  let available = false;
  try {
    available = await InAppBrowser.isAvailable();
  } catch {
    available = false;
  }

  if (!available) {
    try {
      await Linking.openURL(authUrl);
      return { ok: false, external: true };
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error ? e.message : 'Sign-in browser is not available on this device.',
      };
    }
  }

  const iosOptions =
    Platform.OS === 'ios'
      ? {
          modalPresentationStyle: 'pageSheet',
          modalEnabled: true,
          dismissButtonStyle: 'cancel',
          /** Avoid reusing Safari / provider cookies during auth testing */
          ephemeralWebSession: DISABLE_AUTH_STORAGE,
        }
      : {};

  const androidOptions =
    Platform.OS === 'android'
      ? {
          showTitle: true,
          toolbarColor: '#FFFFFF',
          enableUrlBarHiding: false,
          forceCloseOnRedirection: true,
        }
      : {};

  /** @type {Record<string, unknown>} */
  const options = { ...iosOptions, ...androidOptions };

  let result;
  try {
    result = await InAppBrowser.openAuth(authUrl, OAUTH_REDIRECT_URI, options);
  } catch (e) {
    try {
      await Linking.openURL(authUrl);
      return { ok: false, external: true };
    } catch {
      return {
        ok: false,
        message:
          e instanceof Error
            ? e.message
            : 'Could not start sign-in. Try rebuilding the app.',
      };
    }
  }

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true };
  }

  if (result.type !== 'success' || !result.url) {
    return {
      ok: false,
      message: 'Sign-in did not complete.',
    };
  }

  const parsed = parseOAuthCallbackUrl(result.url);
  if (parsed?.error) {
    return {
      ok: false,
      message: oauthErrorMessage(parsed.error),
    };
  }

  if (!parsed?.token) {
    return {
      ok: false,
      message: 'No session token was returned. Try again.',
    };
  }

  return { ok: true, token: parsed.token };
}
