import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBuyerDisputes } from '../api/buyer';
// import { mapBuyerDisputeRow } from '../utils/buyerUi';
import { useDispatch, useSelector } from 'react-redux';
import { fetchOwnerShops, fetchShopDisputes } from '../api';
import { getStoredUser } from '../auth/session';
import { connectChatSocket } from '../socket/chatSocket';
import { set_disputeInfo } from '../../redux/dispute';
import { set_disputeList } from '../../redux/disputes';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const PAGE_BG = '#F2F2F4';
const BLACK = '#111111';
const MUTED = '#8E8E93';
const WHITE = '#FFFFFF';
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'Under review' },
  { key: 'resolved', label: 'Resolved' },
];

const STATUS_THEME = {
  open: {
    pillBg: '#FFF3E0',
    pillText: '#C45C00',
    iconBg: '#FFF3E0',
    icon: 'alert-circle-outline',
    iconColor: '#C45C00',
  },
  under_review: {
    pillBg: '#E3F2FD',
    pillText: '#1565C0',
    iconBg: '#E3F2FD',
    icon: 'search-outline',
    iconColor: '#1565C0',
  },
  resolved: {
    pillBg: '#E8F5E9',
    pillText: '#2E7D32',
    iconBg: '#E8F5E9',
    icon: 'checkmark-circle-outline',
    iconColor: '#2E7D32',
  },
};

function statusLabel(key) {
  if (key === 'under_review') return 'Under review';
  if (key === 'open') return 'Open';
  if (key === 'resolved') return 'Resolved';
  return key;
}

function DisputeCard({ item, onPress }) {
  const t = STATUS_THEME[item.status] ?? STATUS_THEME.open;
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: t.iconBg }]}>
          <Icon name={t.icon} size={22} color={t.iconColor} />
        </View>
        <View style={styles.cardTitleCol}>
          <Text style={styles.disputeId}>{item.dispute_ref}</Text>
          <Text style={styles.orderRef} numberOfLines={1}>
            ORD-{item?.order?.id} · {item.reason}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={MUTED} />
      </View>

      <Text style={styles.summary} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Opened</Text>
          <Text style={styles.metaValue}>{dayjs().to(dayjs(item.created_at))}</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={styles.metaLabel}>Updated</Text>
          <Text style={styles.metaValue}>{dayjs().to(dayjs(item.updated_at))}</Text>
        </View>
        <View style={[styles.metaCol, styles.metaColLast]}>
          <Text style={styles.metaLabel}>Status</Text>
          <View style={[styles.statusPill, { backgroundColor: t.pillBg }]}>
            <Text style={[styles.statusPillText, { color: t.pillText, textTransform: "capitalize" }]}>
              {statusLabel(item.status)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function DisputesListScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const auth = useSelector((s) => s.auth);
  const { disputeList } = useSelector((s) => s.disputeList);


  useEffect(() => {
    connectChatSocket();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        let { id: userId } = await getStoredUser();

        let shopId;
        if (auth.activeRole === 'vendor') {
          let shops = await fetchOwnerShops(userId);
          shopId = shops[0].id;
        }
        const data =
          auth.activeRole === 'customer'
            ? await fetchBuyerDisputes({
                includeClosed: true,
                backfill: false,
              })
            : await fetchShopDisputes(shopId, userId, {});

        if (cancelled) return;
        const rows =
          auth.activeRole === 'customer'
            ? Array.isArray(data?.disputes)
              ? data.disputes
              : []
            : Array.isArray(data)
              ? data
              : [];
        dispatch(set_disputeList(rows));
      } catch (e) {
        if (!cancelled) {
          dispatch(set_disputeList([]));
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth.activeRole, dispatch]);

  const data = useMemo(() => {
    if (filter === 'all') return disputeList;
    return disputeList.filter((d) => d.status === filter);
  }, [filter, disputeList]);

  const renderItem = useCallback(
    ({ item }) => (
      <DisputeCard
        item={item}
        onPress={() => {
          dispatch(set_disputeInfo(item));
          navigation.navigate('Dispute-detail', {
            dispute: item,
            disputeId: item.id,
          });
        }}
      />
    ),
    [dispatch, navigation],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
    
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
              >
                <Text
                  style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ),
    [filter],
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: 15 }]}>
        <ActivityIndicator size="large" color="#00926e" />
        <Text style={styles.emptySub}>Loading disputes…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: 15, paddingHorizontal: 24 }]}>
        <Text style={styles.errorBanner}>{error}</Text>
        <Text style={styles.emptySub}>Sign in to load disputes from your account.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, {paddingTop: 15}]}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item?.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="document-text-outline" size={40} color={MUTED} />
            <Text style={styles.emptyTitle}>No disputes</Text>
            <Text style={styles.emptySub}>Nothing in this filter yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBanner: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  headerBlock: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: BLACK,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: MUTED,
    marginTop: 4,
    marginBottom: 18,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 5,
  },
  chipIdle: {
    backgroundColor: '#E8E8EA',
  },
  chipSelected: {
    backgroundColor: '#1A1A1A',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextIdle: {
    color: BLACK,
  },
  chipTextSelected: {
    color: WHITE,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 5,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardPressed: {
    opacity: 0.96,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  disputeId: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
  },
  orderRef: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  summary: {
    fontSize: 14,
    color: BLACK,
    lineHeight: 20,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
    paddingTop: 14,
  },
  metaCol: {
    flex: 1,
  },
  metaColLast: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: BLACK,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: BLACK,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 14,
    color: MUTED,
    marginTop: 6,
    textAlign: 'center',
  },
});
