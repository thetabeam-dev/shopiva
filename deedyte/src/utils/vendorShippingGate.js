import { checkShippingConfigStatus, fetchOwnerShops } from '../api/shop';

/**
 * Resolve the vendor's primary (first) shop id for MVP flows.
 * @param {number | string | null | undefined} userId
 * @returns {Promise<number | null>}
 */
export async function resolvePrimaryShopId(userId) {
  const uid = userId == null ? '' : String(userId).trim();
  if (!uid) return null;
  const list = await fetchOwnerShops(uid);
  const shops = Array.isArray(list) ? list : [];
  const first = shops[0];
  if (!first) return null;
  const raw = first.id ?? first.shopid ?? first.shop_id;
  const sid =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(sid) && sid > 0 ? sid : null;
}

/**
 * @param {number | string} shopId
 * @param {number | string} userId
 * @returns {Promise<{
 *   ready: boolean;
 *   hasFeeModel: boolean;
 *   hasZones: boolean;
 *   status: string;
 * }>}
 */
export async function getVendorShippingCreateGate(shopId, userId) {
  const status = await checkShippingConfigStatus(shopId, userId);
  const hasFeeModel = Boolean(status?.hasFeeModel);
  const hasZones = Boolean(status?.hasZones);
  return {
    ready: hasFeeModel && hasZones,
    hasFeeModel,
    hasZones,
    status: String(status?.status ?? 'not_set'),
  };
}

/**
 * Jump to Profile → Shop info (shipping model + zones setup).
 * @param {{ getParent?: () => { navigate?: Function } | undefined; navigate?: Function }} navigation
 */
export function navigateToShopShippingSetup(navigation) {
  const parent = navigation?.getParent?.();
  if (parent?.navigate) {
    parent.navigate('Profile', {
      screen: 'profile-shop-info',
    });
    return;
  }
  navigation?.navigate?.('profile-shop-info');
}
