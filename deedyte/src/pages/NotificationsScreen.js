import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { listNotifications, markNotificationRead } from '../api/user';
import { mark_notification_read, set_notifications } from '../../redux/notifications';
import { emitChatSocketAck } from '../socket/chatSocket';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'order', label: 'Orders' },
  { key: 'dispute', label: 'Disputes' },
  { key: 'return', label: 'Returns' },
  { key: 'chat', label: 'Chats' },
];

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { activeRole } = useAuth();
  const items = useSelector((state) => state.notifications?.items ?? []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [opening, setOpening] = useState(false);

  const visibleItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((item) => String(item.source_type ?? '').toLowerCase() === filter);
  }, [filter, items]);

  const load = useCallback(async (mode) => {
    if (mode === 'refresh') setRefreshing(true);
    setError('');
    try {
      const rows = await listNotifications(activeRole);
      dispatch(set_notifications(rows));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRole, dispatch]);

  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  const openTarget = async (item) => {
    const sourceId = Number(item.source_id);
    const type = String(item.source_type ?? '').toLowerCase();
    if (type === 'order') {
      navigation.navigate('Order-detail', {
        orderId: sourceId,
        order: { id: sourceId, order_id: sourceId },
      });
      return true;
    }
    if (type === 'dispute') {
      navigation.navigate('Dispute-detail', {
        disputeId: sourceId,
        dispute: { id: sourceId },
      });
      return true;
    }
    if (type === 'return') {
      navigation.navigate('Return-detail', {
        returnId: sourceId,
        returnItem: { return_id: sourceId },
      });
      return true;
    }
    if (type === 'chat') {
      const out = await emitChatSocketAck('get_rooms', {
        app_role: activeRole === 'vendor' ? 'vendor' : 'customer',
      });
      const rooms = Array.isArray(out?.result?.rooms) ? out.result.rooms : [];
      const room = rooms.find((entry) => Number(entry?.order_id) === sourceId);
      const roomId = String(room?.id ?? '').trim();
      if (!roomId) return false;
      navigation.navigate('Inbox', {
        chat: { roomId, name: `Order #${sourceId}` },
      });
      return true;
    }
    return false;
  };

  const onPressItem = async (item) => {
    if (opening) return;
    setOpening(true);
    try {
      if (item.status !== 'read') {
        await markNotificationRead(item.id);
        dispatch(mark_notification_read(item.id));
      }
      const opened = await openTarget(item);
      if (!opened) {
        Alert.alert('Notification', 'This update could not be opened.');
      }
    } catch (err) {
      Alert.alert(
        'Notification',
        err instanceof Error ? err.message : 'Could not update this notification.',
      );
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Modal visible={opening} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.backdrop}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </Modal>
      <FlatList
      data={visibleItems}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      contentContainerStyle={visibleItems.length === 0 ? styles.center : styles.list}
      ListHeaderComponent={
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((option) => {
              const selected = filter === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No notifications yet</Text>}
      renderItem={({ item }) => {
        const unread = item.status !== 'read';
        return (
          <TouchableOpacity
            style={[styles.row, unread ? styles.unread : styles.read]}
            onPress={() => onPressItem(item)}
          >
            <View style={styles.rowTop}>
              <View style={[styles.dot, unread ? styles.dotUnread : styles.dotRead]} />
              <Text style={[styles.badge, unread ? styles.badgeUnread : styles.badgeRead]}>
                {unread ? 'Unread' : 'Read'}
              </Text>
            </View>
            <Text style={[styles.title, !unread && styles.titleRead]}>{item.title}</Text>
            <Text style={[styles.message, !unread && styles.messageRead]}>{item.message}</Text>
            <Text style={styles.meta}>{formatWhen(item.created_at)}</Text>
          </TouchableOpacity>
        );
      }}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { backgroundColor: '#FFFFFF', paddingBottom: 8 },
  filters: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  chipSelected: { backgroundColor: '#111827' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextSelected: { color: '#FFFFFF' },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  unread: { backgroundColor: '#EFF6FF' },
  read: { backgroundColor: '#FFFFFF' },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  dotUnread: { backgroundColor: '#2563EB' },
  dotRead: { backgroundColor: '#D1D5DB' },
  badge: { fontSize: 12, fontWeight: '700' },
  badgeUnread: { color: '#1D4ED8' },
  badgeRead: { color: '#9CA3AF' },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  titleRead: { fontWeight: '500', color: '#6B7280' },
  message: { marginTop: 4, fontSize: 14, color: '#374151' },
  messageRead: { color: '#9CA3AF' },
  meta: { marginTop: 6, fontSize: 12, color: '#6B7280' },
  empty: { color: '#6B7280', fontSize: 15 },
  error: { color: '#B91C1C', padding: 16 },
});
