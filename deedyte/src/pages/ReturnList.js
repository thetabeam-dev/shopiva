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
import { formatNaira } from '../utils/formatNaira';
import { fetchBuyerReturns } from '../api/buyer';
import { useDispatch, useSelector } from 'react-redux';
import { getStoredUser } from '../auth/session';
import { fetchOwnerShops, fetchShopReturns } from '../api';
import { set_returnList } from '../../redux/returns';
import { RETURN_STATUS_THEME, RETURN_PAY_THEME, COLOR } from '../utils/statusTheme';

const FILTERS = [
  { key: 'all', label: 'All' },
  ...Object.entries(RETURN_STATUS_THEME).map(([key, theme]) => ({
    key,
    label: theme.label,
  })),
];

function statusThemeFor(raw) {
  const key = String(raw ?? '').toLowerCase().trim();
  if (RETURN_STATUS_THEME[key]) return RETURN_STATUS_THEME[key];
  if (key.includes('cancel')) return RETURN_STATUS_THEME.return_cancellation;
  if (key.includes('confirm')) return RETURN_STATUS_THEME.return_confirmed;
  if (key.includes('deliver') && !key.includes('out_for'))
    return RETURN_STATUS_THEME.return_delivered;
  if (key.includes('out_for') || key.includes('out-for'))
    return RETURN_STATUS_THEME.return_out_for_delivery;
  if (key.includes('ship')) return RETURN_STATUS_THEME.return_shipping;
  if (key.includes('process')) return RETURN_STATUS_THEME.return_processing;
  if (key.includes('accept')) return RETURN_STATUS_THEME.return_accepted;
  if (key.includes('initiated') || key.includes('pending'))
    return RETURN_STATUS_THEME.return_initiated;
  return RETURN_STATUS_THEME.return_initiated;
}

function ReturnCard({ item, onPress }) {
  const t = statusThemeFor(item.statusRaw ?? item.status);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: t.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: t.dot }]} />
        </View>
        <View style={styles.cardTitleCol}>
          <Text style={styles.orderId}>{`RTN-${item?.return_id}`}</Text>
          {/* <Text style={styles.vendorLine} numberOfLines={1}>
            {item.customer}
            auth.activeRole === "vendor" ? item.customer : item.vendor
          </Text> */}
        </View>
        <Icon name="chevron-forward" size={20} color={COLOR.MUTED} />
      </View>

      <View style={styles.grid}>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>Items</Text>
          <Text style={styles.gridValue}>{item.qty}</Text>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.gridLabel}>Value</Text>
          <Text style={styles.gridValue}>{formatNaira(item.amount)}</Text>
        </View>
        <View style={[styles.gridCol, styles.gridColLast]}>
          <Text style={styles.gridLabel}>Status</Text>
          <View style={[styles.statusPill, { backgroundColor: t.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: t.dot }]} />
            <Text style={[styles.statusPillText, { color: t.text, textTransform: "capitalize" }]}>{item.status.split('_').join(" ")}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ReturnListScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const auth = useSelector(s => s.auth)
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { returnList } = useSelector(s => s.returnList);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        let { id: userId } = await getStoredUser();

        let shopId;

        if (auth.activeRole !== "customer") {
          let shop = await fetchOwnerShops(userId);
          if (!shop) {
            Alert.alert("no shops")
            return;
          }
          shopId = shop[0].id;
        }
        const data = auth.activeRole === "customer" ? await fetchBuyerReturns() : await fetchShopReturns(shopId, userId);
        if (cancelled) return;

        dispatch(set_returnList((Array.isArray(data) ? data : data.returns)))
      } catch (e) {
        if (!cancelled) {
          dispatch(set_returnList([]))
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
    const list = Array.isArray(returnList) ? returnList : [];
    if (filter === 'all') return list;
    return list.filter((o) => {
      const status = String(o.statusRaw ?? o.status ?? '')
        .toLowerCase()
        .trim();
      return status === filter;
    });
  }, [filter, returnList]);

  const renderItem = useCallback(
    ({ item }) => (
      <ReturnCard
        item={item}
        onPress={() =>
          navigation.navigate('Return-detail', {
            returnItem: item,
            returnId: item.return_id,
          })
        }
      />
    ),
    [navigation],
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
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}>
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
        <Text style={styles.loadingText}>Loading returns…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: 15, paddingHorizontal: 24 }]}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.loadingText}>Sign in and ensure the API is running to see your returns.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, {paddingTop: 15}]}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item?.id ?? item?.return_id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.loadingText}>No returns in this filter yet.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLOR.BG,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLOR.MUTED,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
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
    color: COLOR.DARK,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: COLOR.MUTED,
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
    borderRadius: 10,
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
    color: COLOR.DARK,
  },
  chipTextSelected: {
    color: COLOR.NEUTRAL,
  },
  separator: {
    height: 12,
  },
  card: {
    backgroundColor: COLOR.NEUTRAL,
    borderRadius: 10,
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
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.DARK,
  },
  vendorLine: {
    fontSize: 13,
    color: COLOR.MUTED,
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ECECEC',
    paddingTop: 14,
  },
  gridCol: {
    flex: 1,
  },
  gridColLast: {
    alignItems: 'flex-start'
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLOR.MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  gridValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLOR.DARK,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
  },
});
