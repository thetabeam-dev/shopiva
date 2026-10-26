import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { getStorefrontProduct, getStorefrontShop } from '../api/storefront';
import { navigationRef } from '../navigation/root';

const KEY_PENDING_LINK = '@deedyte/deferred_link';

/** @type {Promise<string | null> | null} */
let referrerRead = null;

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

/**
 * Reads the Play install referrer once per launch and keeps a product link in
 * storage until the user is signed in. The native module only returns the
 * referrer on the first read after install.
 * @returns {Promise<string | null>}
 */
export function loadPendingDeferredLink() {
  if (!referrerRead) {
    referrerRead = (async () => {
      const stored = await AsyncStorage.getItem(KEY_PENDING_LINK).catch(() => null);
      if (stored) return stored;
      if (Platform.OS !== 'android' || !NativeModules.InstallReferrer) return null;
      try {
        const raw = await NativeModules.InstallReferrer.getReferrer();
        if (!raw) return null;
        const link = new URLSearchParams(raw).get('deeplink');
        if (!productFromLink(link)) return null;
        await AsyncStorage.setItem(KEY_PENDING_LINK, link);
        return link;
      } catch {
        return null;
      }
    })();
  }
  return referrerRead;
}

/**
 * Returns the saved product link and forgets it so it only opens once.
 * @returns {Promise<string | null>}
 */
export async function takePendingDeferredLink() {
  const link = await loadPendingDeferredLink();
  if (!link) return null;
  await AsyncStorage.removeItem(KEY_PENDING_LINK).catch(() => {});
  referrerRead = Promise.resolve(null);
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

/** Opens the saved deferred product, if any, on the customer Home stack. */
export async function openPendingDeferredProduct() {
  try {
    const target = productFromLink(await takePendingDeferredLink());
    if (!target) return;
    const params = await productRouteParams(target);
    if (params) navigateToProduct(params);
  } catch {
    // A failed deferred link should never block the user.
  }
}
