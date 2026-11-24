import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteVendorOrderLine as apiDeleteLine,
  deleteVendorOrderShop,
  fetchVendorOrder,
  patchVendorOrderLine,
  postVendorOrderLine,
} from '../api/buyer';

export const MIN_VENDOR_ORDER_AMOUNT = 2000;

/** Previous on-device cart. Never read; removed so only the database is used. */
const LEGACY_LOCAL_CART_KEY = 'deedyte.vendorOrderCart.v1';

let legacyLocalCartCleared = false;

async function discardLegacyLocalCart() {
  if (legacyLocalCartCleared) return;
  legacyLocalCartCleared = true;
  try {
    await AsyncStorage.removeItem(LEGACY_LOCAL_CART_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @typedef {{
 *   key: string;
 *   cartItemId?: number;
 *   shopId: number;
 *   shopName: string;
 *   productId: number;
 *   inventoryId?: number;
 *   variantId?: number;
 *   variantLabel?: string;
 *   title: string;
 *   image: string;
 *   unitPrice: number;
 *   qty: number;
 * }} VendorOrderLine
 */

function linesFromResponse(data) {
  return Array.isArray(data?.lines) ? data.lines : [];
}

function lineId(lineOrKey) {
  if (lineOrKey && typeof lineOrKey === 'object') {
    return Number(lineOrKey.cartItemId ?? lineOrKey.key) || 0;
  }
  return Number(lineOrKey) || 0;
}

export function lineTotal(line) {
  return Math.max(0, Number(line?.unitPrice) || 0) * Math.max(1, Number(line?.qty) || 1);
}

export function orderSubtotal(lines) {
  return (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + lineTotal(line), 0);
}

export function lineKey(line) {
  if (line?.cartItemId || (line?.key && /^\d+$/.test(String(line.key)))) {
    return String(line.cartItemId ?? line.key);
  }
  const productId = Number(line?.productId) || 0;
  const inventoryId = Number(line?.inventoryId) || 0;
  const variantId = Number(line?.variantId) || 0;
  return `${productId}:${inventoryId}:${variantId}`;
}

/**
 * @param {number} shopId
 * @returns {Promise<VendorOrderLine[]>}
 */
export async function getVendorOrder(shopId) {
  await discardLegacyLocalCart();
  const sid = Number(shopId) || 0;
  if (!(sid > 0)) return [];
  const data = await fetchVendorOrder(sid);
  return linesFromResponse(data);
}

/**
 * @param {number} shopId
 * @param {VendorOrderLine} line
 */
export async function upsertVendorOrderLine(shopId, line) {
  await discardLegacyLocalCart();
  const sid = Number(shopId) || 0;
  if (sid < 1) throw new Error('Missing shop');
  const data = await postVendorOrderLine({
    shopId: sid,
    productId: Number(line.productId) || 0,
    inventoryId: Number(line.inventoryId) || undefined,
    qty: Math.min(99, Math.max(1, Number(line.qty) || 1)),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
    variantLabel: line.variantLabel,
  });
  if (data && data.ok === false) {
    throw new Error(String(data.error || data.message || 'Could not save vendor order'));
  }
  return linesFromResponse(data);
}

/**
 * @param {number} shopId
 * @param {string} key
 * @param {number} qty
 */
export async function setVendorOrderQty(shopId, key, qty) {
  await discardLegacyLocalCart();
  const id = lineId(key);
  if (!(id > 0)) {
    return getVendorOrder(shopId);
  }
  const nextQty = Math.min(99, Math.max(1, Number(qty) || 1));
  const data = await patchVendorOrderLine(id, nextQty);
  return linesFromResponse(data);
}

/**
 * @param {number} shopId
 * @param {string} key
 */
export async function removeVendorOrderLine(shopId, key) {
  await discardLegacyLocalCart();
  const id = lineId(key);
  if (!(id > 0)) {
    return getVendorOrder(shopId);
  }
  const data = await apiDeleteLine(id);
  return linesFromResponse(data);
}

export async function clearVendorOrder(shopId) {
  await discardLegacyLocalCart();
  const sid = Number(shopId) || 0;
  if (!(sid > 0)) return [];
  const data = await deleteVendorOrderShop(sid);
  return linesFromResponse(data);
}
