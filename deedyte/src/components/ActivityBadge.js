import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { listNotifications, markNotificationRead } from '../api/user';
import { mark_notification_read, set_notifications } from '../../redux/notifications';
import store from '../../redux/store';

function matchesRole(itemRole, activeRole) {
  const role = String(itemRole ?? '').toLowerCase();
  if (activeRole === 'vendor') return role === 'vendor' || role === 'seller';
  return role === 'buyer' || role === 'customer';
}

export function activityKind(items, activeRole, sourceType, sourceId) {
  const id = Number(sourceId);
  if (!Number.isFinite(id)) return null;
  const match = (items ?? []).find((item) => {
    if (String(item?.status ?? '').toLowerCase() === 'read') return false;
    if (String(item?.source_type ?? '').toLowerCase() !== sourceType) return false;
    if (Number(item?.source_id) !== id) return false;
    return matchesRole(item.role, activeRole);
  });
  if (!match) return null;
  return /^new\b/i.test(String(match.title ?? '')) ? 'new' : 'updated';
}

export function dismissUpdatedActivity(sourceType, sourceId) {
  const state = store.getState();
  const activeRole = state?.auth?.activeRole;
  const id = Number(sourceId);
  if (!Number.isFinite(id)) return;
  const matches = (state?.notifications?.items ?? []).filter((item) => {
    if (String(item?.status ?? '').toLowerCase() === 'read') return false;
    if (String(item?.source_type ?? '').toLowerCase() !== sourceType) return false;
    if (Number(item?.source_id) !== id) return false;
    if (!matchesRole(item.role, activeRole)) return false;
    return !/^new\b/i.test(String(item.title ?? ''));
  });
  for (const item of matches) {
    store.dispatch(mark_notification_read(item.id));
    markNotificationRead(item.id).catch(() => {});
  }
}

export function ActivityBadge({ sourceType, sourceId }) {
  const dispatch = useDispatch();
  const { activeRole } = useAuth();
  const items = useSelector((state) => state.notifications?.items ?? []);
  const loadedRole = useRef('');
  const kind = activityKind(items, activeRole, sourceType, sourceId);

  useEffect(() => {
    if (loadedRole.current === activeRole) return;
    loadedRole.current = activeRole;
    listNotifications(activeRole)
      .then((rows) => dispatch(set_notifications(rows)))
      .catch(() => {});
  }, [activeRole, dispatch]);

  if (!kind) return null;
  const isNew = kind === 'new';
  return (
    <View style={[styles.pill, isNew ? styles.newPill : styles.updatedPill]}>
      <Text style={[styles.text, isNew ? styles.newText : styles.updatedText]}>
        {isNew ? 'New' : 'Updated'}
      </Text>
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
  },
  newPill: { backgroundColor: '#DCFCE7' },
  updatedPill: { backgroundColor: '#FEF3C7' },
  text: { fontSize: 11, fontWeight: '700' },
  newText: { color: '#166534' },
  updatedText: { color: '#92400E' },
});
