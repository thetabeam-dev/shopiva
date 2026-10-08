import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { connectChatSocket, emitChatSocketAck, getChatSocket } from '../socket/chatSocket';

/** @type {Record<string, number>} */
let byOrder = {};
/** @type {Set<() => void>} */
const listeners = new Set();
let loadedRole = '';

function publish(next) {
  byOrder = next;
  listeners.forEach((listener) => listener());
}

export async function refreshUnreadChats(activeRole) {
  const role = activeRole === 'vendor' ? 'vendor' : 'customer';
  const out = await emitChatSocketAck('get_rooms', { app_role: role });
  const rooms = Array.isArray(out?.result?.rooms) ? out.result.rooms : [];
  /** @type {Record<string, number>} */
  const next = {};
  for (const room of rooms) {
    const orderId = String(room?.order_id ?? '');
    const count = Number(room?.unread_count ?? 0);
    if (!orderId || !Number.isFinite(count) || count <= 0) continue;
    next[orderId] = (next[orderId] ?? 0) + count;
  }
  loadedRole = role;
  publish(next);
}

function watchMessages(activeRole) {
  connectChatSocket().then((socket) => {
    if (!socket || socket.__unreadChatsBound) return;
    socket.__unreadChatsBound = true;
    socket.on('message_created', () => {
      const role = loadedRole || (activeRole === 'vendor' ? 'vendor' : 'customer');
      refreshUnreadChats(role).catch(() => {});
    });
  });
}

export function useUnreadMessageCount(orderId) {
  const { activeRole } = useAuth();
  const key = String(orderId ?? '');
  const [count, setCount] = useState(key ? byOrder[key] ?? 0 : 0);

  useEffect(() => {
    const sync = () => setCount(key ? byOrder[key] ?? 0 : 0);
    listeners.add(sync);
    sync();
    if (loadedRole !== (activeRole === 'vendor' ? 'vendor' : 'customer')) {
      refreshUnreadChats(activeRole).catch(() => {});
    }
    watchMessages(activeRole);
    return () => {
      listeners.delete(sync);
    };
  }, [activeRole, key]);

  return count;
}

export function UnreadMessageBadge({ orderId }) {
  const count = useUnreadMessageCount(orderId);
  if (!count) return null;
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{count > 99 ? '99+ unread' : `${count} unread`}</Text>
    </View>
  );
}

export function MessageIconBadge({ count }) {
  if (!count) return null;
  return (
    <View style={styles.dot}>
      <Text style={styles.dotText}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
  },
  pillText: { fontSize: 11, fontWeight: '700', color: '#B91C1C' },
  dot: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
