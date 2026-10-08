import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { listNotifications, markNotificationRead } from '../api/user';
import { mark_notification_read, set_notifications } from '../../redux/notifications';

function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export default function NotificationsScreen() {
  const dispatch = useDispatch();
  const { activeRole } = useAuth();
  const items = useSelector((state) => state.notifications?.items ?? []);
  const [loading, setLoading] = useState(items.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (mode) => {
    if (mode === 'refresh') setRefreshing(true);
    else if (items.length === 0) setLoading(true);
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
  }, [activeRole, dispatch, items.length]);

  useFocusEffect(
    useCallback(() => {
      load('focus');
    }, [load]),
  );

  const onPressItem = async (item) => {
    if (item.status === 'read') return;
    dispatch(mark_notification_read(item.id));
    try {
      await markNotificationRead(item.id);
    } catch {
      /* keep the local read state */
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
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
      contentContainerStyle={items.length === 0 ? styles.center : styles.list}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>No notifications yet</Text>}
      renderItem={({ item }) => {
        const unread = item.status !== 'read';
        return (
          <TouchableOpacity
            style={[styles.row, unread && styles.unread]}
            onPress={() => onPressItem(item)}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>{formatWhen(item.created_at)}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  list: { backgroundColor: '#FFFFFF', paddingVertical: 8 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  unread: { backgroundColor: '#F8FAFC' },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  message: { marginTop: 4, fontSize: 14, color: '#374151' },
  meta: { marginTop: 6, fontSize: 12, color: '#6B7280' },
  empty: { color: '#6B7280', fontSize: 15 },
  error: { color: '#B91C1C', padding: 16 },
});
