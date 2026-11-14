import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, NativeModules, Platform } from 'react-native';
import { getStorefrontProduct, getStorefrontShop } from '../api/storefront';
import { navigationRef } from '../navigation/root';

const KEY_PENDING_LINK = '@deedyte/deferred_link';
const KEY_PENDING_LINK_AT = '@deedyte/deferred_link_at';
/** A link the user never got to open is dropped after this long. */
const PENDING_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** Buyer app routes under `/store/…` that are not a public shop slug. */
const STORE_APP_SEGMENTS = new Set([
  'cart',
  'checkouts',
  'orders',
  'disputes',
  'inbox',
]);

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

/** Forgets the saved deferred link without opening it. */
export async function discardPendingDeferredLink() {
  await AsyncStorage.multiRemove([KEY_PENDING_LINK, KEY_PENDING_LINK_AT]).catch(() => {});
  referrerRead = Promise.resolve(null);
}

/**
 * @param {string | null | undefined} link
 * @returns {string[]}
 */
function pathSegments(link) {
  if (!link) return [];
  try {
    return new URL(link).pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return [];
  }
}

/**
 * Accepts the site product PDP: `/{productId}`
 * @param {string | null | undefined} link
 * @returns {{ slug: string | null; productId: number } | null}
 */
export function productFromLink(link) {
  const segments = pathSegments(link);
  if (segments.length !== 1 || !/^\d+$/.test(segments[0])) return null;
  const productId = Number(segments[0]);
  if (!Number.isInteger(productId) || productId <= 0) return null;
  return { slug: null, productId };
}

/**
 * Accepts the public shop storefront: `/store/<slug>`
 * (not `/store/<slug>/<id>`, and not `/store/cart`, inbox, etc.).
 * @param {string | null | undefined} link
 * @returns {{ slug: string } | null}
 */
export function storeFromLink(link) {
  const segments = pathSegments(link);
  if (segments.length !== 2 || segments[0] !== 'store') return null;
  const slug = String(segments[1] || '').trim();
  if (!slug || STORE_APP_SEGMENTS.has(slug.toLowerCase())) return null;
  if (/^\d+$/.test(slug)) return null;
  return { slug };
}

/** @param {string | null | undefined} link */
function isDeferredLink(link) {
  return Boolean(productFromLink(link) || storeFromLink(link));
}

/** @returns {Promise<string | null>} */
async function readAndroidInstallReferrer() {
  if (!NativeModules.InstallReferrer) return null;
  const raw = await NativeModules.InstallReferrer.getReferrer();
  if (!raw) return null;
  return new URLSearchParams(raw).get('deeplink');
}

/**
 * Reads the Play install referrer once per launch and keeps a product/store
 * link in storage until the user is signed in. iOS has no install referrer;
 * installed iOS apps get links through Universal Links (`queueProductLink`).
 * @returns {Promise<string | null>}
 */
export function loadPendingDeferredLink() {
  if (!referrerRead) {
    referrerRead = (async () => {
      const stored = await readStoredLink();
      if (stored) return stored;
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (initialUrl && isDeferredLink(initialUrl)) {
        await savePendingLink(initialUrl);
        return initialUrl;
      }
      if (Platform.OS !== 'android') return null;
      try {
        const link = await readAndroidInstallReferrer();
        if (!link || !isDeferredLink(link)) return null;
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
 * Saves a product or store link that opened the app (Universal Link / App Link)
 * so it goes through the same sign-in-then-open flow as a deferred link.
 * @param {string | null | undefined} url
 * @returns {Promise<boolean>} true when the URL is a supported deferred link
 */
export async function queueProductLink(url) {
  if (!url || !isDeferredLink(url)) return false;
  await savePendingLink(url);
  referrerRead = Promise.resolve(url);
  return true;
}

/**
 * Returns the saved deferred link and forgets it so it only opens once.
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
 * Canonical `/{id}` links omit the slug; resolve it from the product payload.
 * @param {{ slug: string | null; productId: number }} target
 */
async function productRouteParams(target) {
  const productRes = await getStorefrontProduct(target.productId).catch(() => null);
  const product =
    productRes?.product && typeof productRes.product === 'object' ? productRes.product : {};
  const slugFromProduct =
    typeof product.slug === 'string' && product.slug.trim() ? product.slug.trim() : null;
  const slug = (target.slug && String(target.slug).trim()) || slugFromProduct;
  if (!slug) return null;

  const shopRes = await getStorefrontShop(slug).catch(() => null);
  const shop = shopRes?.shop && typeof shopRes.shop === 'object' ? shopRes.shop : null;
  if (!shop?.id) return null;
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
 * @param {{ slug: string }} target
 * @returns {Promise<{ vendor: Record<string, unknown>; category: string } | null>}
 */
async function storeRouteParams(target) {
  const shopRes = await getStorefrontShop(target.slug).catch(() => null);
  const shop = shopRes?.shop && typeof shopRes.shop === 'object' ? shopRes.shop : null;
  if (!shop?.id && !shop?.slug) return null;
  return {
    vendor: {
      ...shop,
      slug: shop.slug || target.slug,
    },
    category: '__all__',
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

/**
 * @param {Record<string, unknown>} params
 */
function navigateToVendor(params, attempt = 0) {
  if (!navigationRef.isReady()) {
    if (attempt < 20) setTimeout(() => navigateToVendor(params, attempt + 1), 250);
    return;
  }
  navigationRef.navigate('home', {
    screen: 'Home',
    params: { screen: 'Vendor', params },
  });
}

let onboardingInProgress = false;

/**
 * While the signup profile ("Almost there") is open, pending links wait; that
 * screen clears this and opens the destination once the profile is saved.
 * @param {boolean} value
 */
export function setOnboardingInProgress(value) {
  onboardingInProgress = value;
}

/** Opens the saved deferred product or store, if any, on the customer Home stack. */
export async function openPendingDeferredProduct() {
  if (onboardingInProgress) return;
  try {
    const link = await takePendingDeferredLink();
    if (!link) return;

    const productTarget = productFromLink(link);
    if (productTarget) {
      const params = await productRouteParams(productTarget);
      if (params) navigateToProduct(params);
      return;
    }

    const storeTarget = storeFromLink(link);
    if (storeTarget) {
      const params = await storeRouteParams(storeTarget);
      if (params) navigateToVendor(params);
    }
  } catch {
    // A failed deferred link should never block the user.
  }
}
