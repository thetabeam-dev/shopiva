import AsyncStorage from '@react-native-async-storage/async-storage';

const INVOICE_TIP_KEY = '@deedyte/buyer_invoice_request_tip_seen';

/**
 * @param {string | number | null | undefined} userId
 * @returns {string}
 */
function tipKey(userId) {
  const id = String(userId ?? '').trim();
  return id ? `${INVOICE_TIP_KEY}:${id}` : INVOICE_TIP_KEY;
}

/**
 * @param {string | number | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function hasSeenBuyerInvoiceTip(userId) {
  try {
    const value = await AsyncStorage.getItem(tipKey(userId));
    return value === '1';
  } catch {
    return false;
  }
}

/**
 * @param {string | number | null | undefined} userId
 * @returns {Promise<void>}
 */
export async function markBuyerInvoiceTipSeen(userId) {
  try {
    await AsyncStorage.setItem(tipKey(userId), '1');
  } catch {
    /* ignore storage failures */
  }
}
