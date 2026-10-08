import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { listNotifications } from '../api/user';
import { set_notifications } from '../../redux/notifications';

function unreadCountForRole(items, activeRole) {
  const role = activeRole === 'vendor' ? 'vendor' : 'buyer';
  return items.filter((item) => {
    if (String(item?.status ?? '').toLowerCase() === 'read') return false;
    const itemRole = String(item?.role ?? '').toLowerCase();
    if (role === 'vendor') return itemRole === 'vendor' || itemRole === 'seller';
    return itemRole === 'buyer' || itemRole === 'customer';
  }).length;
}

export function NotificationBell({ onPress, style }) {
  const dispatch = useDispatch();
  const { activeRole } = useAuth();
  const items = useSelector((state) => state.notifications?.items ?? []);
  const unread = unreadCountForRole(items, activeRole);

  useEffect(() => {
    let cancelled = false;
    listNotifications(activeRole)
      .then((rows) => {
        if (!cancelled) dispatch(set_notifications(rows));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeRole, dispatch]);

  const label = unread > 99 ? '99+' : String(unread);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={onPress}
      style={style}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Icon name="notifications-outline" size={22} color="#000000" />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
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
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
