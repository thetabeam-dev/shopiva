import { useCallback, useEffect, useState } from 'react';
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
import { fetchOwnerShops } from '../../api/shop';
import { deleteProduct, getProducts } from '../../api/product';
import { useProfile } from '../../context/ProfileContext';
import { getProductImageUri } from '../../utils/productImageUtils';

const BRAND = '#00926e';
const BG = '#F0F1F4';
const CARD = '#FFFFFF';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BORDER = '#E8EAEF';

const nairaFmt = new Intl.NumberFormat('en-NG');

function formatNaira(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return '₦0';
  return `₦${nairaFmt.format(Math.round(n))}`;
}

/** @param {unknown} raw */
function parseSpecifications(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return /** @type {Record<string, unknown>} */ (raw);
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o != null && !Array.isArray(o) ? /** @type {Record<string, unknown>} */ (o) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** @param {Record<string, unknown>} specs */
function variantCountFromSpecs(specs) {
  const v = specs.variants ?? specs.deedyte_variants ?? specs.saved_variants;
  return Array.isArray(v) ? v.length : 0;
}

/** @param {Record<string, unknown>} p @param {string} shopDisplayName */
function mapApiProductToRow(p, shopDisplayName) {
  const specs = parseSpecifications(p.specifications);
  const idRaw = p.id ?? p.product_id;
  const createdRaw = p.created_at ?? p.createdAt;
  let created = '';
  if (createdRaw) {
    const d = new Date(String(createdRaw));
    created = Number.isNaN(d.getTime())
      ? String(createdRaw)
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const sales = Number(p.total_sales ?? p.totalSales ?? 0) || 0;
  const revenueN = Number(p.total_revenue ?? p.totalRevenue ?? 0) || 0;
  return {
    id: String(idRaw ?? ''),
    title: String(p.name ?? p.title ?? 'Untitled').trim() || 'Untitled',
    uri: getProductImageUri(p) || '',
    shop: shopDisplayName,
    variantCount: variantCountFromSpecs(specs),
    status: String(p.status ?? 'draft').toLowerCase(),
    sales,
    revenue: formatNaira(revenueN),
    created: created || '—',
  };
}

function shopIdOf(row) {
  const v = row?.id ?? row?.shopid ?? row?.shop_id;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return parseInt(String(v ?? ''), 10);
}

function shopNameOf(row) {
  return String(row?.name ?? row?.shopname ?? row?.shop_name ?? 'Shop').trim() || 'Shop';
}

/** @param {string} status */
function statusPillStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'published') {
    return { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' };
  }
  if (s === 'archived' || s === 'paused') {
    return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
  }
  return { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' };
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
 * Vendor product catalog — MVP: one shop (first created). Same API as web `GET /shop/:shopId/products/:id`.
 */
export default function VendorProductListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const [mvpShopId, setMvpShopId] = useState(/** @type {number | null} */ (null));
  const [mvpShopName, setMvpShopName] = useState('Shop');
  /** @type {ReturnType<typeof mapApiProductToRow>[]} */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(/** @type {string | null} */ (null));
  const [actionSheetProduct, setActionSheetProduct] = useState(
    /** @type {ReturnType<typeof mapApiProductToRow> | null} */ (null),
  );
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  /** MVP: always bind to the first shop in the owner list (no multi-shop UI). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uid = user?.id;
      if (!uid) {
        setMvpShopId(null);
        setMvpShopName('Shop');
        return;
      }
      try {
        const list = await fetchOwnerShops(uid);
        if (cancelled) return;
        const shops = Array.isArray(list) ? list : [];
        const first = shops[0];
        if (!first) {
          setMvpShopId(null);
          setMvpShopName('Shop');
          return;
        }
        const sid = shopIdOf(first);
        if (!Number.isNaN(sid) && sid > 0) {
          setMvpShopId(sid);
          setMvpShopName(shopNameOf(first));
        } else {
          setMvpShopId(null);
          setMvpShopName('Shop');
        }
      } catch {
        if (!cancelled) {
          setMvpShopId(null);
          setMvpShopName('Shop');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const loadProducts = useCallback(
    async (opts = /** @type {{ silent?: boolean }} */ ({})) => {
      const uid = user?.id;
      const sid = mvpShopId;
      if (!uid || !sid) {
        setRows([]);
        setListError(null);
        if (!opts.silent) setLoading(false);
        return;
      }
      if (!opts.silent) setListError(null);
      try {
        const data = await getProducts(sid, uid);
        const products = Array.isArray(data?.products) ? data.products : [];
        setRows(products.map((p) => mapApiProductToRow(/** @type {Record<string, unknown>} */ (p), mvpShopName)));
      } catch (e) {
        setRows([]);
        setListError(e instanceof Error ? e.message : 'Could not load products.');
      } finally {
        if (!opts.silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, mvpShopId, mvpShopName],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !mvpShopId) {
        setRows([]);
        setLoading(false);
        return undefined;
      }
      setLoading(true);
      loadProducts({ silent: false }).catch(() => {});
      return undefined;
    }, [user?.id, mvpShopId, loadProducts]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts({ silent: true }).catch(() => {});
  }, [loadProducts]);

  const onAddProduct = useCallback(() => {
    if (!mvpShopId) {
      Alert.alert('No shop', 'Create a shop in settings before adding products.');
      return;
    }
    navigation.navigate('AddProduct');
  }, [navigation, mvpShopId]);

  const closeProductActions = useCallback(() => {
    setActionSheetProduct(null);
  }, []);

  const onRowMenu = useCallback((row) => {
    setActionSheetProduct(row);
  }, []);

  const onEditProduct = useCallback(() => {
    if (!actionSheetProduct) return;
    const row = actionSheetProduct;
    closeProductActions();
    navigation.navigate('AddProduct', {
      productId: row.id,
      productTitle: row.title,
    });
  }, [actionSheetProduct, closeProductActions, navigation]);

  const onDeleteProduct = useCallback(() => {
    if (!actionSheetProduct) return;
    const row = actionSheetProduct;
    const uid = user?.id;
    const sid = mvpShopId;
    closeProductActions();

    if (!uid || !sid) {
      Alert.alert('Unable to delete product', 'Sign in and open your shop before deleting products.');
      return;
    }

    const productId = Number(row.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      Alert.alert('Unable to delete product', 'This product is missing a valid ID.');
      return;
    }

    Alert.alert(
      'Delete product',
      `Remove “${row.title}”? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingProduct(true);
            try {
              await deleteProduct(sid, productId, uid);
              Alert.alert('Deleted', 'Product deleted successfully.');
              await loadProducts({ silent: true });
            } catch (error) {
              Alert.alert(
                'Delete failed',
                error instanceof Error ? error.message : 'Could not delete this product.',
              );
            } finally {
              setIsDeletingProduct(false);
            }
          },
        },
      ],
    );
  }, [actionSheetProduct, closeProductActions, loadProducts, mvpShopId, user?.id]);

  return (
    <View style={styles.root}>
      {/* <View style={styles.toolbar}>
        <View style={styles.shopBadge}>
          <Icon name="storefront-outline" size={18} color={MUTED} />
          <Text style={styles.shopBadgeText} numberOfLines={1}>
            {mvpShopName}
          </Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={onAddProduct} activeOpacity={0.88}>
          <Icon name="add-circle-outline" size={20} color="#FFFFFF" style={styles.primaryBtnIcon} />
          <Text style={styles.primaryBtnText}>Add product</Text>
        </TouchableOpacity>
      </View> */}

      {listError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{listError}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={styles.centerLoadingText}>Loading products…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />
          }
        >
          {!user?.id ? (
            <View style={styles.emptyCard}>
              <Icon name="person-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Sign in</Text>
              <Text style={styles.emptySub}>Sign in as a vendor to see your catalog.</Text>
            </View>
          ) : !mvpShopId ? (
            <View style={styles.emptyCard}>
              <Icon name="storefront-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No shop yet</Text>
              <Text style={styles.emptySub}>Create a shop in settings, then your products will appear here.</Text>
            </View>
          ) : rows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Icon name="cube-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No products in this shop</Text>
              <Text style={styles.emptySub}>Add your first product — it will show here after you save.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={onAddProduct} activeOpacity={0.88}>
                <Text style={styles.emptyCtaText}>Add product</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.listMetaOnly}>
                {rows.length} {rows.length === 1 ? 'item' : 'items'} · {mvpShopName}
              </Text>
              
              {rows.map((row) => {
                const pill = statusPillStyle(row.status);
                {/* const openCard = () =>
                  Alert.alert(row.title, 'Product detail editor can open here when wired.'); */}
                return (
                  <View key={row.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Pressable
                        style={({ pressed }) => [styles.cardMainPress, pressed && styles.cardPressed]}
                        // onPress={openCard}
                        android_ripple={{ color: '#F3F4F6' }}
                      >
                                <View style={styles.thumb}>
                          {row.uri ? (
                            <Image source={{ uri: row.uri }} style={styles.thumbImage} resizeMode="cover" />
                          ) : (
                            <Icon name="image-outline" size={22} color="#9CA3AF" />
                          )}
                        </View>
                        <View style={styles.cardTitleBlock}>
                          <Text style={styles.cardTitle} numberOfLines={2}>
                            {row.title}
                          </Text>
                          <Text style={styles.cardSubtitle} numberOfLines={1}>
                            {row.variantCount} variant{row.variantCount !== 1 ? 's' : ''} · {row.shop}
                          </Text>
                        </View>
                      </Pressable>
                      <TouchableOpacity
                        style={styles.cardMenuBtn}
                        onPress={() => onRowMenu(row)}
                        hitSlop={10}
                        accessibilityLabel="Product actions"
                      >
                        <Icon name="ellipsis-horizontal" size={22} color="#6B7280" />
                      </TouchableOpacity>
                    </View>

                    <Pressable
                      style={({ pressed }) => [styles.cardLowerPress, pressed && styles.cardPressed]}
                      // onPress={openCard}
                      android_ripple={{ color: '#F3F4F6' }}
                    >
                      <View style={styles.pillRow}>
                        <View style={[styles.statusPill, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                          <Text style={[styles.statusPillText, { color: pill.text }]}>{String(row.status)}</Text>
                        </View>
                      </View>

                      <View style={styles.statsRow}>
                        <StatBlock label="Sales" value={String(row.sales)} />
                        <View style={styles.statDivider} />
                        <StatBlock label="Revenue" value={row.revenue} />
                        <View style={styles.statDivider} />
                        <StatBlock label="Created" value={row.created} />
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      <Modal
        visible={actionSheetProduct != null}
        transparent
        animationType="slide"
        onRequestClose={closeProductActions}
      >
        <View style={styles.actionSheetModalRoot}>
          <Pressable
            style={styles.actionSheetBackdrop}
            onPress={closeProductActions}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle} numberOfLines={2}>
              {actionSheetProduct?.title ?? 'Product'}
            </Text>
            {/* <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.modalRowPressed]}
              onPress={onEditProduct}
              accessibilityRole="button"
              accessibilityLabel="Edit product"
            >
              <Icon name="create-outline" size={22} color={TEXT} style={styles.actionSheetRowIcon} />
              <Text style={styles.actionSheetRowLabel}>Edit</Text>
            </Pressable> */}
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.modalRowPressed]}
              onPress={onDeleteProduct}
              accessibilityRole="button"
              accessibilityLabel="Delete product"
            >
              <Icon name="trash-outline" size={22} color="#B91C1C" style={styles.actionSheetRowIcon} />
              <Text style={styles.actionSheetRowLabelDanger}>Delete</Text>
            </Pressable>
            <TouchableOpacity style={styles.actionSheetCancel} onPress={closeProductActions} activeOpacity={0.85}>
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isDeletingProduct} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color={BRAND} />
            <Text style={styles.processingText}>Deleting product...</Text>
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
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  processingCard: {
    width: 180,
    height: 120,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  processingText: {
    marginTop: 12,
    color: TEXT,
    fontSize: 14,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FECACA',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#B91C1C',
    fontWeight: '600',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  centerLoadingText: {
    marginTop: 12,
    fontSize: 15,
    color: MUTED,
    fontWeight: '600',
  },
  shopBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '58%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFC',
  },
  shopBadgeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryBtnIcon: {
    marginRight: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
  cardPressed: {
    opacity: 0.94,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
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
  cardLowerPress: {
    borderRadius: 10,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
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
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 22,
  },
  cardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  cardMenuBtn: {
    padding: 4,
    marginTop: -2,
    marginRight: -4,
  },
  pillRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginLeft: 66,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F1F4',
  },
  statBlock: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#ECEEF2',
    marginHorizontal: 4,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 20,
    backgroundColor: BRAND,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalRowPressed: {
    backgroundColor: '#F9FAFB',
  },
  actionSheetModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
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
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 8,
    lineHeight: 24,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  actionSheetRowIcon: {
    marginRight: 14,
  },
  actionSheetRowLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT,
  },
  actionSheetRowLabelDanger: {
    fontSize: 17,
    fontWeight: '600',
    color: '#B91C1C',
  },
  actionSheetCancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  actionSheetCancelText: {
    fontSize: 17,
    fontWeight: '700',
    color: MUTED,
  },
});
