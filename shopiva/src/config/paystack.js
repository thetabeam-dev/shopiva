// import { PAYSTACK_PUBLIC_KEY } from '@env';

const PAYSTACK_PUBLIC_KEY = "pk_live_13343a7bd4deeebc644070871efcdf8fdcf280f7"
/**
 * Paystack public key from `.env` (see `.env.example`). Never put secret keys in the app.
 * @returns {string}
 */
export function getPaystackPublicKey() {
  return String(PAYSTACK_PUBLIC_KEY ?? '').trim();
}

/**
 * Test mode: `pk_test_…` from Paystack Dashboard with **Test** toggled on.
 * Live mode: `pk_live_…` (real charges). For Pistachio testing, use test keys only.
 * @returns {boolean}
 */
export function isPaystackTestMode() {
  return getPaystackPublicKey().startsWith('pk_test_');
}

/** @returns {boolean} */
export function isPaystackLiveMode() {
  return getPaystackPublicKey().startsWith('pk_live_');
}

/** @returns {boolean} */
export function isPaystackConfigured() {
  const k = getPaystackPublicKey();
  return k.startsWith('pk_test_') || k.startsWith('pk_live_');
}

let warnedLiveInDev = false;

/** Call once at app start (e.g. from App). Logs if a live public key is used while debugging. */
export function warnIfPaystackLiveInDev() {
  if (!__DEV__ || warnedLiveInDev) return;
  if (!isPaystackLiveMode()) return;
  warnedLiveInDev = true;
  console.warn(
    '[Shopiva] PAYSTACK_PUBLIC_KEY is LIVE (pk_live_). For Pistachio / integration testing use TEST keys: Paystack Dashboard → toggle **Test** → copy **pk_test_** into `.env`, then restart Metro with `--reset-cache`.',
  );
}
