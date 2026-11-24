import AsyncStorage from '@react-native-async-storage/async-storage';

export const MIN_VENDOR_ORDER_AMOUNT = 2000;

const STORAGE_KEY = 'deedyte.vendorOrderCart.v1';

/**
 * @typedef {{
 *   key: string;
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

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return /** @type {Record<string, VendorOrderLine[]>} */ (parsed);
  } catch {
    return {};
  }
}

async function writeAll(data) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function shopKey(shopId) {
  return String(Number(shopId) || 0);
}

export function lineTotal(line) {
  return Math.max(0, Number(line?.unitPrice) || 0) * Math.max(1, Number(line?.qty) || 1);
}

export function orderSubtotal(lines) {
  return (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + lineTotal(line), 0);
}

export function lineKey(line) {
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
  const all = await readAll();
  const rows = all[shopKey(shopId)];
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} shopId
 * @param {VendorOrderLine} line
 */
export async function upsertVendorOrderLine(shopId, line) {
  const sid = Number(shopId) || 0;
  if (sid < 1) throw new Error('Missing shop');
  const nextLine = {
    ...line,
    shopId: sid,
    key: lineKey(line),
    qty: Math.min(99, Math.max(1, Number(line.qty) || 1)),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
  };
  const all = await readAll();
  const current = Array.isArray(all[shopKey(sid)]) ? all[shopKey(sid)] : [];
  const idx = current.findIndex((row) => lineKey(row) === nextLine.key);
  if (idx >= 0) {
    current[idx] = { ...current[idx], ...nextLine, qty: nextLine.qty };
  } else {
    current.push(nextLine);
  }
  all[shopKey(sid)] = current;
  await writeAll(all);
  return current;
}

/**
 * @param {number} shopId
 * @param {string} key
 * @param {number} qty
 */
export async function setVendorOrderQty(shopId, key, qty) {
  const all = await readAll();
  const sid = shopKey(shopId);
  const current = Array.isArray(all[sid]) ? all[sid] : [];
  const nextQty = Math.min(99, Math.max(1, Number(qty) || 1));
  all[sid] = current.map((row) => (lineKey(row) === key ? { ...row, qty: nextQty } : row));
  await writeAll(all);
  return all[sid];
}

/**
 * @param {number} shopId
 * @param {string} key
 */
export async function removeVendorOrderLine(shopId, key) {
  const all = await readAll();
  const sid = shopKey(shopId);
  const current = Array.isArray(all[sid]) ? all[sid] : [];
  all[sid] = current.filter((row) => lineKey(row) !== key);
  if (!all[sid].length) delete all[sid];
  await writeAll(all);
  return all[sid] ?? [];
}

export async function clearVendorOrder(shopId) {
  const all = await readAll();
  delete all[shopKey(shopId)];
  await writeAll(all);
}

/**
 * Merge the product currently on screen into this vendor's order without writing it.
 * @param {VendorOrderLine[]} existing
 * @param {VendorOrderLine} line
 */
export function mergeCurrentLine(existing, line) {
  const rows = Array.isArray(existing) ? existing.map((row) => ({ ...row })) : [];
  const key = lineKey(line);
  const idx = rows.findIndex((row) => lineKey(row) === key);
  const next = {
    ...line,
    key,
    qty: Math.min(99, Math.max(1, Number(line.qty) || 1)),
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
  };
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.push(next);
  return rows;
}
