import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, NativeModules, Platform } from 'react-native';
import { getStorefrontProduct, getStorefrontShop } from '../api/storefront';
import { navigationRef } from '../navigation/root';

const KEY_PENDING_LINK = '@deedyte/deferred_link';
const KEY_PENDING_LINK_AT = '@deedyte/deferred_link_at';
/** A link the user never got to open is dropped after this long. */
const PENDING_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Promise<string | null> | null} */
let referrerRead = null;

/** @param {string} url */
async function savePendingLink(url) {
  await AsyncStorage.multiSet([
    [KEY_PENDING_LINK, url],
    [KEY_PENDING_LINK_AT, String(Date.now())],
  ]).catch(() => {});
}

/** @returns {Promise<string | null>} */
async function readStoredLink() {
  const pairs = await AsyncStorage.multiGet([KEY_PENDING_LINK, KEY_PENDING_LINK_AT]).catch(() => null);
  const link = pairs?.[0]?.[1] ?? null;
  if (!link) return null;
  const savedAt = Number(pairs?.[1]?.[1]);
  if (!savedAt || Date.now() - savedAt > PENDING_LINK_TTL_MS) {
    await AsyncStorage.multiRemove([KEY_PENDING_LINK, KEY_PENDING_LINK_AT]).catch(() => {});
    return null;
  }
  return link;
}

/** Forgets the saved product link without opening it. */
export async function discardPendingDeferredLink() {
  await AsyncStorage.multiRemove([KEY_PENDING_LINK, KEY_PENDING_LINK_AT]).catch(() => {});
  referrerRead = Promise.resolve(null);
}

/**
 * Accepts `/store/<slug>/<id>` and `/store/<slug>/product/<id>`.
 * @param {string | null | undefined} link
 * @returns {{ slug: string; productId: number } | null}
 */
export function productFromLink(link) {
  if (!link) return null;
  let path = '';
  try {
    path = new URL(link).pathname;
  } catch {
    return null;
  }
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'store' || segments.length < 3) return null;
  const productId = Number(segments[segments.length - 1]);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return { slug: segments[1], productId };
}

/** @returns {Promise<string | null>} */
async function readAndroidInstallReferrer() {
  if (!NativeModules.InstallReferrer) return null;
  const raw = await NativeModules.InstallReferrer.getReferrer();
  if (!raw) return null;
  return new URLSearchParams(raw).get('deeplink');
}

/**
 * Reads the Play install referrer once per launch and keeps a product link in
 * storage until the user is signed in. iOS has no install referrer, so there
 * is no deferred link there; installed iOS apps get product links through
 * Universal Links instead (see `queueProductLink`).
 * @returns {Promise<string | null>}
 */
export function loadPendingDeferredLink() {
  if (!referrerRead) {
    referrerRead = (async () => {
      const stored = await readStoredLink();
      if (stored) return stored;
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl && productFromLink(initialUrl)) {
        await savePendingLink(initialUrl);
        return initialUrl;
      }
      if (Platform.OS !== 'android') return null;
      try {
        const link = await readAndroidInstallReferrer();
        if (!link || !productFromLink(link)) return null;
        await savePendingLink(link);
        return link;
      } catch {
        return null;
      }
    })();
  }
  return referrerRead;
}

/**
 * Saves a product link that opened the app (Universal Link / App Link) so it
 * goes through the same sign-in-then-open flow as a deferred link.
 * @param {string | null | undefined} url
 * @returns {Promise<boolean>} true when the URL is a product link
 */
export async function queueProductLink(url) {
  if (!url || !productFromLink(url)) return false;
  await savePendingLink(url);
  referrerRead = Promise.resolve(url);
  return true;
}

/**
 * Returns the saved product link and forgets it so it only opens once.
 * @returns {Promise<string | null>}
 */
export async function takePendingDeferredLink() {
  const link = await loadPendingDeferredLink();
  if (!link) return null;
  await discardPendingDeferredLink();
  return link;
}

/**
 * Product needs the shop as `vendor`, same params as Home's `openProduct`.
 * @param {{ slug: string; productId: number }} target
 */
async function productRouteParams(target) {
  const [shopRes, productRes] = await Promise.all([
    getStorefrontShop(target.slug).catch(() => null),
    getStorefrontProduct(target.productId).catch(() => null),
  ]);
  const shop = shopRes?.shop && typeof shopRes.shop === 'object' ? shopRes.shop : null;
  if (!shop?.id) return null;
  const product = productRes?.product && typeof productRes.product === 'object' ? productRes.product : {};
  const images = Array.isArray(product.images) ? product.images : [];
  return {
    vendor: shop,
    productId: target.productId,
    shop_id: shop.id,
    product: {
      id: target.productId,
      title: product.name ?? product.title,
      uri: product.image ?? images[0],
      priceUsd: product.price,
      currency: 'NGN',
    },
  };
}

/**
 * The app stack mounts or resets right before this runs, so retry until ready.
 * @param {Record<string, unknown>} params
 */
function navigateToProduct(params, attempt = 0) {
  if (!navigationRef.isReady()) {
    if (attempt < 20) setTimeout(() => navigateToProduct(params, attempt + 1), 250);
    return;
  }
  navigationRef.navigate('home', {
    screen: 'Home',
    params: { screen: 'Product', params },
  });
}

let onboardingInProgress = false;

/**
 * While the signup profile ("Almost there") is open, pending links wait; that
 * screen clears this and opens the product once the profile is saved.
 * @param {boolean} value
 */
export function setOnboardingInProgress(value) {
  onboardingInProgress = value;
}

/** Opens the saved deferred product, if any, on the customer Home stack. */
export async function openPendingDeferredProduct() {
  if (onboardingInProgress) return;
  try {
    const target = productFromLink(await takePendingDeferredLink());
    if (!target) return;
    const params = await productRouteParams(target);
    if (params) navigateToProduct(params);
  } catch {
    // A failed deferred link should never block the user.
  }
}
