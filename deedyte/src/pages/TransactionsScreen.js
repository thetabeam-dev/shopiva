import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../context/ProfileContext';
import { fetchBuyerOrders } from '../api/buyer';
import { fetchOwnerShops, fetchShopTransactions } from '../api/shop';
import { formatNaira } from '../utils/formatNaira';

const BRAND = '#00926e';
const BG = '#F0F1F4';
const CARD = '#FFFFFF';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E8EAEF';

/** @param {unknown} raw */
function normalizeShop(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (raw);
  const id = Number(r.id ?? r.shop_id ?? r.shopId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const name = String(r.name ?? r.shop_name ?? 'Shop').trim() || 'Shop';
  return { id, name };
}

/** @param {unknown} value */
function formatTxDate(value) {
  if (value == null) return '—';
  const d = new Date(/** @type {string | number} */ (value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** @param {string} status */
function isPendingStatus(status) {
  const s = String(status ?? '').toLowerCase();
  return (
    s.includes('pending') ||
    s.includes('processing') ||
    s.includes('await') ||
    s.includes('hold') ||
    s === 'unpaid'
  );
}

/**
 * @param {Record<string, unknown>} order
 * @returns {Record<string, unknown>}
 */
function mapBuyerOrderRow(order) {
  const oid = String(order.order_id ?? '').trim() || '—';
  const amt = Number(order.amount ?? 0);
  const st = String(order.status ?? '');
  const pending = isPendingStatus(st);
  return {
    id: `buyer-ord-${oid}`,
    shop: String(order.product ?? 'Purchase').trim() || 'Order',
    date: formatTxDate(order.date),
    type: 'Purchase',
    reference: `ORD-${oid}`,
    amount: `−${formatNaira(amt)}`,
    positive: false,
    status: pending ? 'pending' : 'completed',
    meta: String(order.payment ?? '').trim(),
  };
}

/**
 * @param {Record<string, unknown>} t
 * @param {string} shopName
 * @param {number} index
 */
function mapVendorLedgerRow(t, shopName, index) {
  const raw = Number(t.amount ?? 0);
  const positive = raw >= 0;
  const absLabel = formatNaira(Math.abs(raw));
  const amount = positive ? `+${absLabel}` : `−${absLabel}`;
  const type = String(t.type ?? 'Entry');
  const ref = String(t.reference ?? `TX-${index}`);
  const pending = String(t.status ?? '').toLowerCase().includes('pending');
  return {
    id: `vendor-${ref}-${index}`,
    shop: shopName,
    date: formatTxDate(t.date),
    type,
    reference: ref,
    amount,
    positive,
    status: pending ? 'pending' : 'completed',
    meta: '',
  };
}

function SummaryCard({ label, value }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const pending = isPendingStatus(status);
  return (
    <View style={[styles.badge, pending ? styles.badgePending : styles.badgeCompleted]}>
      <Text style={[styles.badgeText, pending ? styles.badgeTextPending : styles.badgeTextCompleted]}>
        {pending ? 'Pending' : 'Completed'}
      </Text>
    </View>
  );
}

function typeIcon(type) {
  const t = String(type || '').toLowerCase();
  if (t === 'payout') return { name: 'arrow-up-circle-outline', color: '#7C3AED' };
  if (t === 'refund') return { name: 'return-down-back-outline', color: '#DC2626' };
  if (t === 'purchase') return { name: 'bag-handle-outline', color: '#2563EB' };
  return { name: 'cart-outline', color: '#059669' };
}

/**
 * Transactions — live buyer orders (customer) or shop ledger (vendor).
 */
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const { activeRole, isGuest } = useAuth();
  const uid = Number(user?.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    card1: '—',
    card2: '—',
    card3: '—',
    label1: 'Total spent',
    label2: 'Pending',
    label3: 'Refunds',
  });
  const [rows, setRows] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));
  const [shops, setShops] = useState(/** @type {Array<{ id: number; name: string }>} */ ([]));
  const [selectedShop, setSelectedShop] = useState(/** @type {{ id: number; name: string } | null} */ (null));
  const [shopModalOpen, setShopModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(uid) || uid <= 0) {
      setLoading(false);
      setRows([]);
      setError(isGuest ? 'Sign in to see your transactions.' : 'Profile not loaded yet.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (activeRole === 'vendor') {
        const shopListRaw = await fetchOwnerShops(uid);
        const s = shopListRaw[0];
        // console.log("shop:", shopListRaw);
        // const normalized = (Array.isArray(shopListRaw) ? shopListRaw : [])
        //   .map(normalizeShop)
        //   .filter((x) => x != null);
        // setShops(/** @type {typeof shops} */ (normalized));

        // const shopForTx =
        //   normalized.find((s) => s.id === selectedShop?.id) ?? normalized[0] ?? null;
        // if (shopForTx && (selectedShop?.id !== shopForTx.id || !selectedShop)) {
        // }
        setSelectedShop(s);

        if (!s) {
          setRows([]);
          setSummary((s) => ({
            ...s,
            label1: 'Total earnings',
            label2: 'Pending escrow',
            label3: 'Withdrawn',
            card1: formatNaira(0),
            card2: formatNaira(0),
            card3: formatNaira(0),
          }));
          return;
        }

        const { overview, transactions } = await fetchShopTransactions(s.id, uid);
        const o = overview && typeof overview === 'object' ? overview : {};

        console.log("shop overview:", o);
        console.log("shop transactions:", transactions);

        const earnings = Number(o.total_earnings ?? 0);
        const escrow = Number(o.pending_escrow ?? 0);
        const withdrawn = Number(o.total_withdrawal ?? 0);
        setSummary({
          label1: 'Total earnings',
          label2: 'Pending escrow',
          label3: 'Withdrawn',
          card1: formatNaira(earnings),
          card2: formatNaira(escrow),
          card3: formatNaira(withdrawn),
        });
        const list = Array.isArray(transactions) ? transactions : [];
        setRows(list.map((t, i) => mapVendorLedgerRow(/** @type {Record<string, unknown>} */ (t), shopForTx.name, i)));
      } else {
        const { orders: rawOrders } = await fetchBuyerOrders();
        const orders = Array.isArray(rawOrders) ? rawOrders : [];
        let totalSpent = 0;
        let pendingTotal = 0;
        let pendingCount = 0;
        for (const o of orders) {
          const row = o && typeof o === 'object' ? /** @type {Record<string, unknown>} */ (o) : {};
          const amt = Number(row.amount ?? 0);
          totalSpent += amt;
          if (isPendingStatus(row.status)) {
            pendingTotal += amt;
            pendingCount += 1;
          }
        }
        setSummary({
          label1: 'Total spent',
          label2: 'Pending orders',
          label3: 'Order count',
          card1: formatNaira(totalSpent),
          card2: pendingCount > 0 ? `${pendingCount} · ${formatNaira(pendingTotal)}` : '—',
          card3: String(orders.length),
        });
        setRows(orders.map((o) => mapBuyerOrderRow(/** @type {Record<string, unknown>} */ (o))));
        setShops([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [uid, activeRole, isGuest, selectedShop?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const listTitle = useMemo(() => {
    if (activeRole === 'vendor') {
      return selectedShop ? `Activity · ${selectedShop.name}` : 'Activity';
    }
    return 'Purchase history';
  }, [activeRole, selectedShop]);

  return (
    <View style={[styles.root, { paddingTop: 0 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
      >

        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.summaryGrid}>
          <SummaryCard label={summary.label1} value={summary.card1} />
          <SummaryCard label={summary.label2} value={summary.card2} />
          <SummaryCard label={summary.label3} value={summary.card3} />
        </View>

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={BRAND} size={"large"} />
            <Text style={styles.centerText}>Loading transactions…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.centerBlock}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading && !error ? (
          <>
            <Text style={styles.sectionLabel}>Activity</Text>
            <Text style={styles.listMetaOnly}>
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · {listTitle}
            </Text>

            {rows.length === 0 ? (
              <Text style={styles.emptyText}>
                {activeRole === 'vendor' ? 'No ledger entries yet for this shop.' : 'No orders yet.'}
              </Text>
            ) : null}

            {rows.map((row) => {
              const icon = typeIcon(row.type);
              const openCard = () =>
                Alert.alert(
                  String(row.reference),
                  `${String(row.type)} · ${String(row.date)}\n${String(row.amount)}${row.meta ? `\n${String(row.meta)}` : ''}`,
                );
              return (
                <View key={String(row.id)} style={styles.txCard}>
                  <View style={styles.txTop}>
                    <Pressable
                      style={({ pressed }) => [styles.txMainPress, pressed && styles.pressedOpacity]}
                      onPress={openCard}
                      android_ripple={{ color: '#F3F4F6' }}
                    >
                      <View style={[styles.txIconWrap, { backgroundColor: `${icon.color}18` }]}>
                        <Icon name={icon.name} size={22} color={icon.color} />
                      </View>
                      <View style={styles.txBody}>
                        <Text style={styles.txType}>{String(row.type)}</Text>
                        <Text style={styles.txRef} numberOfLines={1}>
                          {String(row.reference)}
                        </Text>
                        <Text style={styles.txDate}>{String(row.date)}</Text>
                        {row.shop ? (
                          <Text style={styles.txShop} numberOfLines={1}>
                            {String(row.shop)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.txFooterPress, pressed && styles.pressedOpacity]}
                    onPress={openCard}
                    android_ripple={{ color: '#F3F4F6' }}
                  >
                    <Text
                      style={[styles.txAmount, row.positive ? styles.amountPos : styles.amountNeg]}
                    >
                      {String(row.amount)}
                    </Text>
                    <StatusBadge status={String(row.status)} />
                  </Pressable>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={shopModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShopModalOpen(false)}
      >
        <Pressable style={styles.modalRoot} onPress={() => setShopModalOpen(false)}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
            <Text style={styles.modalTitle}>Shop</Text>
            <Text style={styles.modalHint}>Show transactions for</Text>
            {shops.map((s) => {
              const selected = s.id === selectedShop?.id;
              return (
                <Pressable
                  key={String(s.id)}
                  style={({ pressed }) => [
                    styles.modalRow,
                    selected && styles.modalRowSelected,
                    pressed && styles.modalRowPressed,
                  ]}
                  onPress={() => {
                    setSelectedShop(s);
                    setShopModalOpen(false);
                  }}
                >
                  <Icon name="storefront-outline" size={20} color={selected ? BRAND : MUTED} style={styles.modalRowIcon} />
                  <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>{s.name}</Text>
                  {selected ? <Icon name="checkmark-circle" size={22} color={BRAND} /> : <View style={styles.modalCheckSpacer} />}
                </Pressable>
              );
            })}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShopModalOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  shopFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: '100%',
  },
  shopFilterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    minWidth: 0,
  },
  pressedOpacity: { opacity: 0.92 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 0,
  },
  summaryCard: {
    width: '48%',
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    ...cardShadow,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.2,
  },
  listMetaOnly: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 14,
  },
  centerBlock: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  centerText: {
    marginTop: 10,
    fontSize: 14,
    color: MUTED,
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  emptyText: {
    fontSize: 15,
    color: MUTED,
    marginBottom: 16,
  },
  txCard: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    ...cardShadow,
  },
  txTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  txMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
    marginRight: 4,
    borderRadius: 10,
    paddingVertical: 2,
    paddingRight: 4,
  },
  txIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txBody: { flex: 1, minWidth: 0 },
  txType: { fontSize: 16, fontWeight: '800', color: TEXT },
  txRef: { marginTop: 4, fontSize: 14, fontWeight: '600', color: MUTED },
  txDate: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  txShop: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  txFooterPress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  txAmount: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  amountPos: { color: '#16A34A' },
  amountNeg: { color: '#DC2626' },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeCompleted: { backgroundColor: '#ECFDF5' },
  badgePending: { backgroundColor: '#FFFBEB' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextCompleted: { color: '#166534' },
  badgeTextPending: { color: '#B45309' },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalHint: { fontSize: 15, fontWeight: '700', color: TEXT, marginBottom: 16 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalRowPressed: { backgroundColor: '#F9FAFB' },
  modalRowSelected: { backgroundColor: '#FFF7ED' },
  modalRowIcon: { marginRight: 12 },
  modalRowText: { flex: 1, fontSize: 16, fontWeight: '600', color: TEXT },
  modalRowTextSelected: { color: BRAND },
  modalCheckSpacer: { width: 22, height: 22 },
  modalClose: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  modalCloseText: { fontSize: 16, fontWeight: '700', color: MUTED },
});
