import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { connectChatSocket, emitChatSocketAck, getChatSocket } from '../socket/chatSocket';

/** @type {{ customer: Record<string, number>, vendor: Record<string, number> }} */
let byRole = { customer: {}, vendor: {} };
/** @type {Set<() => void>} */
const listeners = new Set();

function roleKey(activeRole) {
  return activeRole === 'vendor' ? 'vendor' : 'customer';
}

function publish() {
  listeners.forEach((listener) => listener());
}

export async function refreshUnreadChats(activeRole) {
  const role = roleKey(activeRole);
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
  byRole = { ...byRole, [role]: next };
  publish();
}

function watchMessages() {
  connectChatSocket().then((socket) => {
    if (!socket || socket.__unreadChatsBound) return;
    socket.__unreadChatsBound = true;
    socket.on('message_created', () => {
      refreshUnreadChats('customer').catch(() => {});
      refreshUnreadChats('vendor').catch(() => {});
    });
  });
}

function totalFor(activeRole) {
  return Object.values(byRole[roleKey(activeRole)] ?? {}).reduce(
    (acc, count) => acc + Number(count || 0),
    0,
  );
}

export function useUnreadChatTotal() {
  const { activeRole } = useAuth();
  const [total, setTotal] = useState(() => totalFor(activeRole));

  useEffect(() => {
    const sync = () => setTotal(totalFor(activeRole));
    listeners.add(sync);
    sync();
    refreshUnreadChats(activeRole).catch(() => {});
    watchMessages();
    return () => {
      listeners.delete(sync);
    };
  }, [activeRole]);

  return total;
}

export function useUnreadMessageCount(orderId) {
  const { activeRole } = useAuth();
  const key = String(orderId ?? '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(key ? Number(byRole[roleKey(activeRole)]?.[key] ?? 0) : 0);
    listeners.add(sync);
    sync();
    refreshUnreadChats(activeRole).catch(() => {});
    watchMessages();
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
