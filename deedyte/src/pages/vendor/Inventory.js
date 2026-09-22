import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../context/ProfileContext';
import { fetchOwnerShops, fetchShopInventory } from '../../api/shop';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';

const BRAND = '#00926e';
const BG = '#F0F1F4';
const CARD = '#FFFFFF';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E8EAEF';

/** @param {Record<string, unknown>} row */
function shopIdOf(row) {
  const v = row.id ?? row.shopid ?? row.shop_id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {Record<string, unknown>} row */
function shopNameOf(row) {
  const v = row.name ?? row.shop_name ?? row.shopName;
  const s = String(v ?? '').trim();
  return s || 'Shop';
}

/** @param {unknown} v */
function toNumber(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Concise "1w ago" / "3d ago" / "just now". */
function timeAgo(value) {
  if (!value) return '—';
  const ms = Number(new Date(String(value)));
  if (!Number.isFinite(ms)) return '—';
  const diff = Math.max(0, Date.now() - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`;
  return `${Math.floor(diff / (365 * day))}y ago`;
}

/**
 * Map an API inventory row into the shape the UI cards render.
 * @param {Record<string, unknown>} raw
 * @param {string} shopName
 */
function normalizeInventoryRow(raw, shopName) {
  const id = String(raw.id ?? raw.inventory_id ?? '');
  const productId = raw.product_id ?? raw.productId ?? null;
  const productName = String(raw.product_name ?? raw.productName ?? raw.name ?? 'Untitled product').trim();
  const sku = String(raw.sku ?? '').trim() || '—';
  const price = toNumber(raw.price);
  const currency = String(raw.currency ?? 'NGN').toUpperCase();
  const stock = toNumber(raw.quantity_available ?? raw.quantity ?? raw.stock);
  const reserved = toNumber(raw.quantity_reserved ?? raw.reserved ?? 0);
  const lowStock = toNumber(raw.low_stock_threshold ?? raw.low_stock ?? 0);
  const isActive = raw.is_active != null ? Boolean(raw.is_active) : true;
  return {
    id: id || `${productId ?? 'p'}-${sku}`,
    productId: productId != null ? String(productId) : '',
    product: productName,
    shop: shopName,
    sku,
    uri: getProductImageUri(raw.product ?? raw) || '',
    price,
    currency,
    stock,
    reserved,
    lowStock,
    isActive,
    createdAgo: timeAgo(raw.created_at ?? raw.createdAt ?? raw.created),
    updatedAgo: timeAgo(raw.updated_at ?? raw.updatedAt ?? raw.updated),
  };
}

/** @param {ReturnType<typeof normalizeInventoryRow>} row */
function stockPill(row) {
  if (row.stock <= 0) {
    return { label: 'Out of stock', bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' };
  }
  if (row.lowStock > 0 && row.stock <= row.lowStock) {
    return { label: 'Low stock', bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' };
  }
  return { label: 'In stock', bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
}

/** @param {boolean} active */
function activePill(active) {
  if (active) {
    return { label: 'Active', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
  }
  return { label: 'Inactive', bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
}

function StatBlock({ label, value }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Vendor inventory — backed by `GET /shop/:shopId/inventory/:userId`.
 */
export default function VendorInventoryScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const userId = Number(user?.id ?? 0);

  const [shops, setShops] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [selectedShopId, setSelectedShopId] = useState(/** @type {number | null} */ (null));
  const [rows, setRows] = useState(/** @type {ReturnType<typeof normalizeInventoryRow>[]} */ ([]));

  const [loadingShops, setLoadingShops] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [actionRow, setActionRow] = useState(
    /** @type {ReturnType<typeof normalizeInventoryRow> | null} */ (null),
  );

  const selectedShop = useMemo(
    () => shops.find((s) => shopIdOf(s) === selectedShopId) ?? null,
    [shops, selectedShopId],
  );
  const selectedShopName = selectedShop ? shopNameOf(selectedShop) : '';

  const loadInventoryFor = useCallback(
    async (shopId, shopName) => {
      if (!userId || !shopId) return;
      setLoadingInventory(true);
      setError(null);
      try {
        const list = await fetchShopInventory(shopId, userId);
        setRows(
          list.map((r) => normalizeInventoryRow(/** @type {Record<string, unknown>} */ (r), shopName)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setRows([]);
      } finally {
        setLoadingInventory(false);
      }
    },
    [userId],
  );

  const loadShopsAndInventory = useCallback(async () => {
    if (!userId) {
      setShops([]);
      setRows([]);
      setSelectedShopId(null);
      setLoadingShops(false);
      return;
    }
    setError(null);
    try {
      const list = await fetchOwnerShops(userId);
      const valid = (Array.isArray(list) ? list : []).filter((s) => shopIdOf(s) > 0);
      setShops(valid);
      const next = valid.find((s) => shopIdOf(s) === selectedShopId) ?? valid[0] ?? null;
      const nextId = next ? shopIdOf(next) : null;
      setSelectedShopId(nextId);
      if (next && nextId) {
        await loadInventoryFor(nextId, shopNameOf(next));
      } else {
        setRows([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setShops([]);
      setRows([]);
      setSelectedShopId(null);
    } finally {
      setLoadingShops(false);
    }
  }, [userId, selectedShopId, loadInventoryFor]);

  useFocusEffect(
    useCallback(() => {
      setLoadingShops(true);
      loadShopsAndInventory().catch(() => {});
    }, [loadShopsAndInventory]),
  );

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadShopsAndInventory();
    } finally {
      setRefreshing(false);
    }
  }, [loadShopsAndInventory, refreshing]);

  const onSwitchShop = useCallback(
    (shop) => {
      const id = shopIdOf(shop);
      const name = shopNameOf(shop);
      setSelectedShopId(id);
      setShopModalOpen(false);
      void loadInventoryFor(id, name);
    },
    [loadInventoryFor],
  );

  const closeActions = useCallback(() => setActionRow(null), []);

  const onEdit = useCallback(() => {
    if (!actionRow) return;
    const row = actionRow;
    closeActions();
    navigation.navigate('AddProduct', {
      productId: row.productId || row.id,
      productTitle: row.product,
      fromInventory: true,
    });
  }, [actionRow, closeActions, navigation]);

  const onDelete = useCallback(() => {
    if (!actionRow) return;
    const row = actionRow;
    closeActions();
    Alert.alert(
      'Remove inventory row',
      `Remove stock row for "${row.product}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Coming soon', 'Inventory deletion from this screen is not wired yet.'),
        },
      ],
    );
  }, [actionRow, closeActions]);

  const showShopSwitcher = shops.length > 1;
  const showInitialLoader = loadingShops && shops.length === 0 && rows.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />
        }
      >
        {showShopSwitcher ? (
          <Pressable
            style={({ pressed }) => [styles.shopFilterRow, pressed && styles.cardPressed]}
            onPress={() => setShopModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Change shop"
          >
            <Icon name="storefront-outline" size={18} color={MUTED} />
            <Text style={styles.shopFilterText} numberOfLines={1}>
              Shop: {selectedShopName || '—'}
            </Text>
            <Icon name="chevron-down" size={18} color={MUTED} />
          </Pressable>
        ) : null}

        {showInitialLoader ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={BRAND} />
            <Text style={styles.loadingText}>Loading inventory…</Text>
          </View>
        ) : !userId ? (
          <View style={styles.emptyCard}>
            <Icon name="lock-closed-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Sign in to view inventory</Text>
            <Text style={styles.emptySub}>Switch to your vendor account to manage stock.</Text>
          </View>
        ) : shops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="storefront-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No shop yet</Text>
            <Text style={styles.emptySub}>
              Set up your shop in Profile → Settings to start tracking inventory.
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Icon name="alert-circle-outline" size={40} color="#EF4444" />
            <Text style={styles.emptyTitle}>Could not load inventory</Text>
            <Text style={styles.emptySub}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                if (selectedShopId && selectedShopName) {
                  void loadInventoryFor(selectedShopId, selectedShopName);
                } else {
                  void loadShopsAndInventory();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : loadingInventory && rows.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={BRAND} />
            <Text style={styles.loadingText}>Loading inventory…</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="layers-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No inventory in this shop</Text>
            <Text style={styles.emptySub}>
              Create a product to start tracking stock for {selectedShopName || 'this shop'}.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.listMetaOnly}>
              {rows.length} {rows.length === 1 ? 'SKU' : 'SKUs'}
              {selectedShopName ? ` · ${selectedShopName}` : ''}
            </Text>
            {rows.map((row) => {
              const sPill = stockPill(row);
              const aPill = activePill(row.isActive);
              const priceLabel =
                row.currency === 'NGN'
                  ? formatNaira(row.price)
                  : `${row.currency} ${row.price.toFixed(2)}`;
              const openCard = () => "";
              {/* const openCard = () => setActionRow(row); */}
              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Pressable
                      style={({ pressed }) => [styles.cardMainPress, pressed && styles.cardPressed]}
                      onPress={openCard}
                      android_ripple={{ color: '#F3F4F6' }}
                    >
                      <View style={styles.thumb}>
                        {row.uri ? (
                          <Image source={{ uri: row.uri }} style={styles.thumbImage} resizeMode="cover" />
                        ) : (
                          <Icon name="cube-outline" size={22} color="#9CA3AF" />
                        )}
                      </View>
                      <View style={styles.cardTitleBlock}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {row.product}
                        </Text>
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                          SKU {row.sku}
                          {selectedShopName ? ` · ${selectedShopName}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [styles.cardLowerPress, pressed && styles.cardPressed]}
                    onPress={openCard}
                    android_ripple={{ color: '#F3F4F6' }}
                  >
                    <View style={styles.pillRow}>
                      <View style={[styles.statusPill, { backgroundColor: sPill.bg, borderColor: sPill.border }]}>
                        <Text style={[styles.statusPillText, { color: sPill.text }]}>{sPill.label}</Text>
                      </View>
                      <View style={[styles.statusPill, styles.pillSpacer, { backgroundColor: aPill.bg, borderColor: aPill.border }]}>
                        <Text style={[styles.statusPillText, { color: aPill.text }]}>{aPill.label}</Text>
                      </View>
                    </View>

                    <View style={styles.statsRow}>
                      <StatBlock label="On hand" value={String(row.stock)} />
                      <View style={styles.statDivider} />
                      <StatBlock label="Reserved" value={String(row.reserved)} />
                      <View style={styles.statDivider} />
                      <StatBlock label="Price" value={priceLabel} />
                    </View>
                    <View style={styles.statsRowSecond}>
                      <StatBlock label="Low at" value={row.lowStock > 0 ? String(row.lowStock) : '—'} />
                      <View style={styles.statDivider} />
                      <StatBlock label="Updated" value={row.updatedAgo} />
                      <View style={styles.statDivider} />
                      <StatBlock label="Created" value={row.createdAgo} />
                    </View>
                  </Pressable>
                </View>
              );
            })}
            {loadingInventory && rows.length > 0 ? (
              <View style={styles.refreshHint}>
                <ActivityIndicator size="small" color={BRAND} />
                <Text style={styles.refreshHintText}>Refreshing…</Text>
              </View>
            ) : null}
          </>
        )}
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
            <Text style={styles.modalHint}>Show inventory for</Text>
            {shops.map((shopRow) => {
              const id = shopIdOf(shopRow);
              const name = shopNameOf(shopRow);
              const selected = id === selectedShopId;
              return (
                <Pressable
                  key={id}
                  style={({ pressed }) => [
                    styles.modalRow,
                    selected && styles.modalRowSelected,
                    pressed && styles.modalRowPressed,
                  ]}
                  onPress={() => onSwitchShop(shopRow)}
                >
                  <Icon
                    name="storefront-outline"
                    size={20}
                    color={selected ? BRAND : MUTED}
                    style={styles.modalRowIcon}
                  />
                  <Text style={[styles.modalRowText, selected && styles.modalRowTextSelected]}>{name}</Text>
                  {selected ? (
                    <Icon name="checkmark-circle" size={22} color={BRAND} />
                  ) : (
                    <View style={styles.modalCheckSpacer} />
                  )}
                </Pressable>
              );
            })}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShopModalOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={actionRow != null} transparent animationType="slide" onRequestClose={closeActions}>
        <View style={styles.actionSheetModalRoot}>
          <Pressable style={styles.actionSheetBackdrop} onPress={closeActions} accessibilityLabel="Dismiss" />
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle} numberOfLines={2}>
              {actionRow?.product ?? 'Item'}
            </Text>
            <Text style={styles.actionSheetSub} numberOfLines={1}>
              SKU {actionRow?.sku ?? '—'}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.modalRowPressed]}
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit"
            >
              <Icon name="create-outline" size={22} color={TEXT} style={styles.actionSheetRowIcon} />
              <Text style={styles.actionSheetRowLabel}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.modalRowPressed]}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete"
            >
              <Icon name="trash-outline" size={22} color="#B91C1C" style={styles.actionSheetRowIcon} />
              <Text style={styles.actionSheetRowLabelDanger}>Delete</Text>
            </Pressable>
            <TouchableOpacity style={styles.actionSheetCancel} onPress={closeActions} activeOpacity={0.85}>
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  shopFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
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
  listMetaOnly: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 14,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    ...cardShadow,
  },
  cardPressed: { opacity: 0.94 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardMainPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
    marginRight: 4,
    borderRadius: 10,
    paddingVertical: 2,
    paddingRight: 4,
  },
  cardLowerPress: { borderRadius: 10, marginHorizontal: -4, paddingHorizontal: 4 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  cardTitleBlock: { flex: 1, minWidth: 0, paddingRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: TEXT, lineHeight: 22 },
  cardSubtitle: { marginTop: 4, fontSize: 13, color: MUTED, fontWeight: '500' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginLeft: 66, gap: 8 },
  pillSpacer: { marginLeft: 0 },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
  },
  statsRowSecond: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
  },
  statBlock: { flex: 1, minWidth: 0 },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: { fontSize: 14, fontWeight: '700', color: TEXT },
  statDivider: { width: 1, backgroundColor: '#ECEEF2', marginHorizontal: 4 },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  loadingText: { fontSize: 14, color: MUTED, fontWeight: '600' },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { marginTop: 16, fontSize: 17, fontWeight: '700', color: TEXT, textAlign: 'center' },
  emptySub: { marginTop: 8, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND,
  },
  retryBtnText: { color: BRAND, fontWeight: '700', fontSize: 14 },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  refreshHintText: { fontSize: 12, color: MUTED, fontWeight: '600' },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  actionSheetModalRoot: { flex: 1, justifyContent: 'flex-end' },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  actionSheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 10,
    backgroundColor: '#D1D5DB',
    marginBottom: 12,
  },
  actionSheetTitle: { fontSize: 17, fontWeight: '800', color: TEXT, marginBottom: 4, lineHeight: 24 },
  actionSheetSub: { fontSize: 13, color: MUTED, fontWeight: '600', marginBottom: 8 },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  actionSheetRowIcon: { marginRight: 14 },
  actionSheetRowLabel: { fontSize: 17, fontWeight: '600', color: TEXT },
  actionSheetRowLabelDanger: { fontSize: 17, fontWeight: '600', color: '#B91C1C' },
  actionSheetCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  actionSheetCancelText: { fontSize: 17, fontWeight: '700', color: MUTED },
});
