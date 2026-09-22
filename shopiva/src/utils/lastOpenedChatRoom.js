import AsyncStorage from '@react-native-async-storage/async-storage';

/** @typedef {'customer' | 'vendor'} ChatRoleScope */

const LEGACY_KEY = '@deedyte/last_opened_chat_room_id';

const keyForScope = (/** @type {ChatRoleScope} */ scope) =>
  scope === 'vendor'
    ? '@deedyte/last_opened_chat_room_vendor'
    : '@deedyte/last_opened_chat_room_customer';

/**
 * Last-opened chat room id for this app mode only (isolates buyer vs seller UI state).
 * @param {ChatRoleScope} [scope]
 * @returns {Promise<string | null>}
 */
export async function getLastOpenedChatRoomId(scope = 'customer') {
  try {
    const scoped = await AsyncStorage.getItem(keyForScope(scope));
    const t = scoped != null ? String(scoped).trim() : '';
    if (t) return t;
    if (scope === 'customer') {
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      const lt = legacy != null ? String(legacy).trim() : '';
      if (lt) {
        await AsyncStorage.setItem(keyForScope('customer'), lt);
        await AsyncStorage.removeItem(LEGACY_KEY);
        return lt;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} roomId
 * @param {ChatRoleScope} [scope]
 */
export async function setLastOpenedChatRoomId(roomId, scope = 'customer') {
  try {
    const t = roomId != null ? String(roomId).trim() : '';
    const k = keyForScope(scope);
    if (!t) {
      await AsyncStorage.removeItem(k);
      return;
    }
    await AsyncStorage.setItem(k, t);
    if (scope === 'customer') {
      await AsyncStorage.removeItem(LEGACY_KEY);
    }
  } catch {
    /* ignore */
  }
}
