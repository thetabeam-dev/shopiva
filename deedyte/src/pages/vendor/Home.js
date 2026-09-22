import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../context/ProfileContext';
import { fetchOwnerShops, fetchShopOrders } from '../../api/shop';
import { getStorefrontProduct, getStorefrontProducts } from '../../api/storefront';
import { mapOrderRowToListItem } from '../../utils/buyerUi';
import { formatNaira } from '../../utils/formatNaira';

/** Vendor-only dashboard — not shared with customer flows or `HomeStackScreen`. */
const BRAND = '#00926E';
const BG = '#F4F5F7';
const CARD = '#FFFFFF';
const TEXT = '#111111';
const MUTED = '#6B7280';
const UP = '#16A34A';
const MAX_DASHBOARD_ORDERS = 5;

/** @param {Record<string, unknown>} row */
function shopIdOf(row) {
  const v = row.id ?? row.shopid ?? row.shop_id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {Record<string, unknown>} row */
function shopSlugOf(row) {
  const slug = row.slug ?? row.shop_slug ?? row.shopSlug ?? row.store_slug;
  const s = String(slug ?? '').trim();
  return s || '';
}

/** @param {Record<string, unknown>} row */
function shopCreatedAtMsOf(row) {
  const v = row.created_at ?? row.createdAt ?? row.created ?? row.date_created ?? row.created_on;
  if (v == null) return Number.POSITIVE_INFINITY;
  const ms = Number(new Date(String(v)));
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

/**
 * MVP: choose only the first-created shop for dashboard metrics.
 * @param {Record<string, unknown>[]} shops
 * @returns {Record<string, unknown> | null}
 */
function pickFirstCreatedShop(shops) {
  if (!Array.isArray(shops) || shops.length === 0) return null;
  return shops
    .slice()
    .sort((a, b) => {
      const aa = shopCreatedAtMsOf(/** @type {Record<string, unknown>} */ (a));
      const bb = shopCreatedAtMsOf(/** @type {Record<string, unknown>} */ (b));
      if (aa !== bb) return aa - bb;
      return shopIdOf(/** @type {Record<string, unknown>} */ (a)) - shopIdOf(/** @type {Record<string, unknown>} */ (b));
    })[0] || null;
}

/** @param {Record<string, unknown>} row */
function orderCustomerKey(row) {
  const candidates = [
    row.customer_id,
    row.buyer_id,
    row.user_id,
    row.client_id,
    row.email,
    row.phone,
  ];
  for (const candidate of candidates) {
    const key = String(candidate ?? '').trim();
    if (key) return key;
  }
  return '';
}

/** @param {Record<string, unknown>} inv */
function inventoryStockOf(inv) {
  const v = inv.stock ?? inv.quantity ?? inv.qty ?? inv.on_hand ?? inv.available;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** @param {Record<string, unknown>} inv */
function inventoryLowThresholdOf(inv) {
  const v = inv.low_stock ?? inv.reorder_level ?? inv.min_stock ?? inv.lowStock;
  const n = Number(v);
  return Number.isFinite(n) ? n : 5;
}

/**
 * Counts low inventory items for a single shop (MVP behavior).
 * @param {Record<string, unknown> | null} shop
 */
async function countLowInventoryAlerts(shop) {
  if (!shop) return 0;
  const slug = shopSlugOf(shop);
  if (!slug) return 0;

  const { products } = await getStorefrontProducts(slug);
  const list = Array.isArray(products) ? products : [];
  const checks = list.map(async (p) => {
    const pRow = /** @type {Record<string, unknown>} */ (p);
    const pid = pRow.id;
    if (pid == null) return 0;
    try {
      const detail = await getStorefrontProduct(pid);
      const prod = detail.product && typeof detail.product === 'object' ? /** @type {Record<string, unknown>} */ (detail.product) : {};
      const hasVariants = Boolean(prod.hasVariants);
      if (!hasVariants) {
        const stock = Number(prod.stock);
        const lowAt = 5;
        return Number.isFinite(stock) && stock <= lowAt ? 1 : 0;
      }
      const vars = Array.isArray(prod.variants) ? prod.variants : [];
      return vars.reduce((acc, v) => {
        const row = v && typeof v === 'object' ? /** @type {Record<string, unknown>} */ (v) : {};
        const stock = Number(row.stock);
        const lowAt = 5;
        return acc + (Number.isFinite(stock) && stock <= lowAt ? 1 : 0);
      }, 0);
    } catch {
      return 0;
    }
  });
  const values = await Promise.all(checks);
  return values.reduce((a, b) => a + b, 0);
}

function MetricCard({ title, value, footer, footerTone = 'muted', children }) {
  return (
    <View style={styles.metricCard}>
      {/* <TouchableOpacity style={styles.metricMenu} hitSlop={12} accessibilityLabel="Card options">
        <Icon name="ellipsis-vertical" size={18} color={MUTED} />
      </TouchableOpacity> */}
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {footer ? <Text style={[styles.metricFooter, footerTone === 'up' && styles.metricFooterUp]}>{footer}</Text> : null}
      {children}
    </View>
  );
}

function OrderPreviewRow({ title, time, detail, isLast, onPress }) {
  const content = (
    <View style={[styles.activityRow, isLast && styles.activityRowLast]}>
      <View style={[styles.activityIconWrap, { backgroundColor: '#E0F4EE' }]}>
        <Icon name="receipt-outline" size={20} color={BRAND} />
      </View>
      <View style={styles.activityBody}>
        <View style={styles.activityTitleRow}>
          <Text style={styles.activityTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.activityTime}>{time}</Text>
        </View>
        <Text style={styles.activityDetail} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.orderRowPressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useProfile();
  const userId = Number(user?.id);

  const [orders, setOrders] = useState(/** @type {ReturnType<typeof mapOrderRowToListItem>[]} */ ([]));
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [shopsCount, setShopsCount] = useState(0);
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [lowInventoryCount, setLowInventoryCount] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setOrders([]);
      setOrdersTotalCount(0);
      setShopsCount(0);
      setNewCustomersCount(0);
      setLowInventoryCount(0);
      setTotalSales(0);
      setOrdersLoading(false);
      setOrdersError('');
      return;
    }
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const shops = await fetchOwnerShops(userId);
      setShopsCount(shops.length);
      const firstShop = pickFirstCreatedShop(
        shops.map((s) => /** @type {Record<string, unknown>} */ (s)),
      );
      const shopId = firstShop ? shopIdOf(firstShop) : 0;
      if (!shopId) {
        setOrders([]);
        setOrdersTotalCount(0);
        setNewCustomersCount(0);
        setLowInventoryCount(0);
        setTotalSales(0);
        return;
      }
      const rows = await fetchShopOrders(shopId, userId);
      const allRows = Array.isArray(rows) ? rows : [];
      const allItems = allRows.map((r) => mapOrderRowToListItem(/** @type {Record<string, unknown>} */ (r)));
      setOrdersTotalCount(allItems.length);
      setTotalSales(allItems.reduce((sum, row) => sum + (Number(row.valueRupees) || 0), 0));
      const customerKeys = new Set(
        allRows
          .map((r) => orderCustomerKey(/** @type {Record<string, unknown>} */ (r)))
          .filter(Boolean),
      );
      setNewCustomersCount(customerKeys.size);

      // Do not block orders rendering if inventory APIs fail.
      void countLowInventoryAlerts(firstShop)
        .then((count) => setLowInventoryCount(count))
        .catch(() => setLowInventoryCount(0));

      const list = allRows
        .slice()
        .sort((a, b) => {
          const aa = Number(new Date(String((/** @type {Record<string, unknown>} */ (a)).date ?? 0)));
          const bb = Number(new Date(String((/** @type {Record<string, unknown>} */ (b)).date ?? 0)));
          return bb - aa;
        })
        .slice(0, MAX_DASHBOARD_ORDERS)
        .map((r) => mapOrderRowToListItem(/** @type {Record<string, unknown>} */ (r)));
      setOrders(list);
    } catch (e) {
      setOrders([]);
      setOrdersTotalCount(0);
      setShopsCount(0);
      setNewCustomersCount(0);
      setLowInventoryCount(0);
      setTotalSales(0);
      setOrdersError(e instanceof Error ? e.message : String(e));
    } finally {
      setOrdersLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders]),
  );

  const onViewAllOrders = useCallback(() => {
    const parent = navigation.getParent?.();
    parent?.navigate('Activities', {
      screen: 'VendorOrderFlow',
      params: { screen: 'order-list' },
    });
  }, [navigation]);

  const onOpenOrder = useCallback(
    (item) => {
      const parent = navigation.getParent?.();
      parent?.navigate('Activities', {
        screen: 'Order-detail',
        params: {
          order: item,
          orderId: item.orderId,
        },
      });
    },
    [navigation],
  );

  const hasMoreThanShown = ordersTotalCount > MAX_DASHBOARD_ORDERS;

  return (
    <View style={[styles.root, { paddingTop: 15 }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Dashboard</Text>
          <TouchableOpacity style={styles.exportBtn} accessibilityLabel="Export or upload">
            <Icon name="cloud-upload-outline" size={22} color={TEXT} />
          </TouchableOpacity>
        </View> */}

        <View style={styles.metricsGrid}>
          <MetricCard
            title="Total Sales"
            value={formatNaira(totalSales)}
            footer={`${ordersTotalCount} order(s) loaded`}
          />
          <MetricCard
            title="Total Orders"
            value={String(ordersTotalCount)}
            footerTone="up"
            footer={ordersTotalCount > 0 ? 'Orders in first-created shop' : 'No orders yet'}
          />
          <MetricCard
            title="New Customers"
            value={String(newCustomersCount)}
            footer={newCustomersCount > 0 ? 'Unique buyers in loaded orders' : 'No customer data yet'}
          />
          <View style={styles.metricCard}>
            <Text style={styles.metricTitle}>Low Inventory Alert</Text>
            <Text style={styles.metricValue}>{String(lowInventoryCount)}</Text>
            <Text style={styles.metricFooter}>
              {shopsCount > 0
                ? lowInventoryCount > 0
                  ? 'Items at or below threshold'
                  : 'No low-stock items found'
                : 'Set up your first shop in settings'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent orders</Text>
          <TouchableOpacity onPress={onViewAllOrders} hitSlop={8}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityCard}>
          {ordersLoading ? (
            <ActivityIndicator style={styles.ordersLoader} color={BRAND} />
          ) : ordersError ? (
            <Text style={styles.ordersMuted}>{ordersError}</Text>
          ) : orders.length === 0 ? (
            <Text style={styles.ordersMuted}>No orders yet. They will appear here after customers checkout.</Text>
          ) : (
            orders.map((item, index) => (
              <OrderPreviewRow
                key={item.orderId || item.id || String(index)}
                title={item.vendor || item.id || 'Order'}
                time={item.dateLabel}
                detail={`${String(item.statusRaw ?? item.status ?? '—')} · ${formatNaira(item.valueRupees)} · ${item.items} item(s)`}
                isLast={index === orders.length - 1}
                onPress={() => onOpenOrder(item)}
              />
            ))
          )}
          {!ordersLoading && !ordersError && hasMoreThanShown ? (
            <Text style={styles.ordersCapNote}>Showing up to {MAX_DASHBOARD_ORDERS} orders.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    marginLeft: 10,
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
  },
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  metricCard: {
    width: '48%',
    marginBottom: 12,
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 16,
    paddingTop: 36,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  metricMenu: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  metricTitle: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '600',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 6,
  },
  metricFooter: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
  },
  metricFooterUp: {
    color: UP,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  star: {
    marginRight: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  activityCard: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  activityRowLast: {
    marginBottom: 0,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityBody: {
    flex: 1,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    flexShrink: 1,
    marginRight: 8,
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
    flexShrink: 0,
  },
  activityDetail: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  ordersLoader: {
    paddingVertical: 20,
  },
  ordersMuted: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  ordersCapNote: {
    marginTop: 12,
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
  },
  orderRowPressed: {
    opacity: 0.85,
  },
});

