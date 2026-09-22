import { TurboModuleRegistry } from 'react-native';
import { isPaystackConfigured } from '../config/paystack';

/** @type {'idle' | 'ok' | 'failed'} */
let paystackProviderLoadState = 'idle';

/** @type {null | import('react').ComponentType<any>} */
let CachedPaystackProvider = null;

/**
 * True when the native binary exposes WebView's TurboModule. We must check this *before*
 * importing react-native-webview: that package calls TurboModuleRegistry.getEnforcing at
 * module load, and RN may surface that as a fatal error that does not reliably unwind into
 * a surrounding try/catch.
 */
function isRNCWebViewNativeLinked() {
  try {
    return TurboModuleRegistry.get('RNCWebViewModule') != null;
  } catch {
    return false;
  }
}

function markPaystackNativeUnavailable(reason) {
  paystackProviderLoadState = 'failed';
  CachedPaystackProvider = null;
  if (__DEV__) {
    console.warn(
      '[Deedyte] Paystack checkout is disabled: react-native-webview is not linked in this native build. From the app root run `cd ios && pod install`, then clean-rebuild the iOS app (Xcode: Product → Clean Build Folder). Reloading Metro alone does not install native modules.',
      reason,
    );
  }
}

/**
 * Returns PaystackProvider from react-native-paystack-webview, or null if the native
 * binary does not include react-native-webview (e.g. iOS not rebuilt after `pod install`).
 */
export function getPaystackProvider() {
  if (!isPaystackConfigured()) return null;
  if (paystackProviderLoadState === 'failed') return null;
  if (paystackProviderLoadState === 'ok') return CachedPaystackProvider;

  if (!isRNCWebViewNativeLinked()) {
    markPaystackNativeUnavailable('RNCWebViewModule not registered');
    return null;
  }

  try {
    const mod = require('react-native-paystack-webview');
    CachedPaystackProvider = mod.PaystackProvider;
    paystackProviderLoadState = 'ok';
    return CachedPaystackProvider;
  } catch (e) {
    markPaystackNativeUnavailable(
      e && typeof e === 'object' && 'message' in e ? String(/** @type {{ message?: string }} */ (e).message) : String(e),
    );
    return null;
  }
}

export function canUsePaystackCheckout() {
  return isPaystackConfigured() && getPaystackProvider() != null;
}
