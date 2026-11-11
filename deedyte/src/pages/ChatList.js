import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { connectChatSocket, emitChatSocketAck, getChatSocket } from '../socket/chatSocket';
import { getLastOpenedChatRoomId } from '../utils/lastOpenedChatRoom';
import { useSelector } from 'react-redux';
import { chatPreviewText } from '../utils/chatPreview';

const PAGE_BG = '#FFFFFF';
const BLACK = '#111111';
const MUTED = '#8E8E93';
const WA_GREEN = '#25D366';
const ROW_SEP = '#ECECEC';
const HEADER_TINT = '#075E54';

function Avatar({ name, avatarHue }) {
  const initials = String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View style={[styles.avatar, { backgroundColor: `hsl(${avatarHue}, 42%, 46%)` }]}>
      <Text style={styles.avatarText}>{initials || '?'}</Text>
    </View>
  );
}

function hueFromText(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  return Math.abs(h);
}

function toTimeLabel(value) {
  if (value == null) return '';
  const d = new Date(/** @type {string | number} */ (value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function mapRoomRow(room) {
  const roomId = String(room.id ?? room.roomId ?? '').trim();
  const orderId = String(room.order_id ?? room.orderId ?? '').trim();
  const counterpart = String(
    room.counterpart_name ??
      room.counterpartName ??
      room.participant_name ??
      room.shop_name ??
      room.shopName ??
      room.customer_name ??
      room.customerName ??
      '',
  ).trim();
  const rawName = String(room.name ?? '').trim();
  const isPlaceholder = (value) =>
    !value || /^order\s*#/i.test(value) || /^chat$/i.test(value) || /^inbox$/i.test(value);
  const name = !isPlaceholder(counterpart)
    ? counterpart
    : !isPlaceholder(rawName)
      ? rawName
      : 'Chat';
  const unreadCount = Math.max(0, Number(room.unread_count ?? room.unreadCount) || 0);
  return {
    id: roomId,
    roomId,
    orderId,
    name,
    avatarHue: hueFromText(roomId || name),
    unreadCount,
    lastAtLabel: toTimeLabel(room.updated_at ?? room.created_at ?? room.last_at),
    lastMessage: chatPreviewText(room.last_message ?? room.lastMessage) || 'No messages yet',
    shopId: Number(room.shop_id ?? room.shopId) || 0,
    shopSlug: String(room.shop_slug ?? room.shopSlug ?? '').trim(),
  };
}

function ChatRow({ item, onPress, highlightKind }) {
  const unread = item.unreadCount > 0;
  const highlighted = Boolean(highlightKind);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        highlighted && styles.rowHighlighted,
        pressed && styles.rowPressed,
      ]}
    >
      <Avatar name={item.name} avatarHue={item.avatarHue} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {item.name}
            </Text>
            {highlightKind === 'recent' ? (
              <View style={[styles.tagPill, styles.recentPill]}>
                <Text style={[styles.tagPillText, styles.recentPillText]}>Recent</Text>
              </View>
            ) : null}
            {highlightKind === 'purchased' ? (
              <View style={[styles.tagPill, styles.purchasedPill]}>
                <Text style={[styles.tagPillText, styles.purchasedPillText]}>Purchased</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.time, unread && styles.timeUnread]}>{item.lastAtLabel}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {unread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 9 ? '9+' : String(item.unreadCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function ListSeparator() {
  return <View style={styles.fullSep} />;
}

export default function ChatListScreen({
  navigation,
  route,
  chatRoomRouteName = 'chat-room',
  chatListTitle = 'Chats',
}) {
  const auth = useSelector((s) => s.auth);
  const storageScope = auth.activeRole === 'vendor' ? 'vendor' : 'customer';
  const appRolePayload = storageScope === 'vendor' ? 'vendor' : 'customer';
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightRoomIds, setHighlightRoomIds] = useState(new Set());
  const [lastOpenedId, setLastOpenedId] = useState(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await connectChatSocket();
      const out = await emitChatSocketAck('get_rooms', { app_role: appRolePayload });
      if (!out.success) {
        setRows([]);
        setError(out.message || 'Could not load chats');
        return;
      }
      const list =
        out.result && typeof out.result === 'object' && 'rooms' in out.result
          ? out.result.rooms
          : [];
      const mapped = (Array.isArray(list) ? list : [])
        .filter((x) => x && typeof x === 'object')
        .map((x) => mapRoomRow(x))
        .filter((x) => x.roomId);
      setRows(mapped);
      try {
        const lid = await getLastOpenedChatRoomId(storageScope);
        setLastOpenedId(lid && String(lid).trim() ? String(lid).trim() : null);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [storageScope, appRolePayload]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: chatListTitle });
  }, [navigation, chatListTitle]);

  useFocusEffect(
    useCallback(() => {
      void loadRooms();
      const socket = getChatSocket();
      const refresh = () => {
        void loadRooms();
      };
      socket?.on('room_created', refresh);
      socket?.on('message_created', refresh);
      return () => {
        socket?.off('room_created', refresh);
        socket?.off('message_created', refresh);
      };
    }, [loadRooms]),
  );

  useFocusEffect(
    useCallback(() => {
      const params =
        route?.params && typeof route.params === 'object' ? route.params : {};
      const rawIds = params.highlightRoomIds;
      const exp = params.highlightExpiresAt;
      const expiresOk = typeof exp !== 'number' || Date.now() < exp;
      const ids = Array.isArray(rawIds)
        ? rawIds.map((x) => String(x ?? '').trim()).filter(Boolean)
        : [];
      if (!ids.length || !expiresOk) {
        setHighlightRoomIds(new Set());
        return undefined;
      }
      setHighlightRoomIds(new Set(ids));
      const t = setTimeout(() => setHighlightRoomIds(new Set()), 14000);
      return () => clearTimeout(t);
    }, [route?.params]),
  );

  const sortedRows = useMemo(() => {
    const used = new Set();
    const out = [];

    const pushRow = (r) => {
      const id = String(r.roomId ?? r.id ?? '').trim();
      if (!id || used.has(id)) return;
      out.push(r);
      used.add(id);
    };

    if (lastOpenedId) {
      for (const r of rows) {
        const id = String(r.roomId ?? r.id ?? '').trim();
        if (id === lastOpenedId) {
          pushRow(r);
          break;
        }
      }
    }

    for (const r of rows) {
      const id = String(r.roomId ?? r.id ?? '').trim();
      if (!id || used.has(id)) continue;
      if (highlightRoomIds.has(id)) pushRow(r);
    }

    for (const r of rows) {
      pushRow(r);
    }

    return out;
  }, [rows, lastOpenedId, highlightRoomIds]);

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Pressable style={styles.searchPill} accessibilityRole="button">
          <Icon name="search-outline" size={18} color={MUTED} />
          <Text style={styles.searchPillText}>Search</Text>
        </Pressable>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const rid = String(item.roomId ?? item.id ?? '').trim();
      let highlightKind = null;
      if (rid && lastOpenedId && rid === lastOpenedId) highlightKind = 'recent';
      else if (rid && highlightRoomIds.has(rid)) highlightKind = 'purchased';
      return (
        <ChatRow
          item={item}
          highlightKind={highlightKind}
          onPress={() => navigation.navigate(chatRoomRouteName, { chat: item })}
        />
      );
    },
    [navigation, highlightRoomIds, lastOpenedId, chatRoomRouteName],
  );

  const listContentStyle = useMemo(
    () => [styles.listContent, { paddingBottom: Math.max(insets.bottom, 16) + 8 }],
    [insets.bottom],
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={sortedRows}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
        contentContainerStyle={listContentStyle}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {loading ? (
              <>
                <ActivityIndicator size="small" color="#00926e" />
                <Text style={styles.emptyText}>Loading chats…</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>{error || 'No chats yet.'}</Text>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  headerBlock: { marginBottom: 4 },
  listContent: { paddingHorizontal: 0 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  searchPillText: { fontSize: 15, color: MUTED, flex: 1 },
  fullSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: ROW_SEP,
    marginLeft: 82,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: PAGE_BG,
  },
  rowHighlighted: {
    backgroundColor: '#ECFDF3',
    borderLeftWidth: 4,
    borderLeftColor: '#00926e',
    paddingLeft: 12,
  },
  rowPressed: { backgroundColor: '#F5F5F5' },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    paddingRight: 12,
  },
  tagPill: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  recentPill: { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' },
  recentPillText: { color: '#0369A1' },
  purchasedPill: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  purchasedPillText: { color: '#047857' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  rowBody: { flex: 1, minWidth: 0, paddingBottom: 10 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    flex: 1,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '500',
    color: BLACK,
    minWidth: 0,
  },
  nameUnread: { fontWeight: '700' },
  time: { fontSize: 13, color: MUTED },
  timeUnread: { color: WA_GREEN, fontWeight: '600' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  preview: { flex: 1, fontSize: 15, color: MUTED, minWidth: 0 },
  previewUnread: { color: BLACK, fontWeight: '600' },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: WA_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: 'center' },
});
