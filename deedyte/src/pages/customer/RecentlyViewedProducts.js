import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { getStorefrontProduct } from '../../api';
import {
  addBuyerCartLine,
  deleteBuyerCartLine,
  fetchBuyerCart,
  fetchRecentlyViewedProducts,
} from '../../api/buyer';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';
import { ProductCardMedia } from '../../components/ProductCardMedia';

function shopRating(shop) {
  const rating = Number(shop?.ratingAverage ?? shop?.average_rating ?? shop?.averageRating ?? 0);
  const count = Number(shop?.reviewCount ?? shop?.review_count ?? 0);
  return {
    rating: Number.isFinite(rating) && rating > 0 ? rating : 0,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
  };
}

function mapHistoryProduct(product) {
  const shop = product?.shop && typeof product.shop === 'object' ? product.shop : {};
  return {
    id: String(product.id),
    title: String(product.name ?? 'Product'),
    uri: getProductImageUri(product) || String(product.thumbnail ?? ''),
    price: Number(product.minPrice ?? product.price) || 0,
    comparePrice: Number(product.maxPrice) || 0,
    hasVariants: Boolean(product?.hasVariants),
    shop: {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      ratingAverage: shop.ratingAverage,
      reviewCount: shop.reviewCount,
    },
    product,
  };
}

export default function RecentlyViewedProductsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartBusyId, setCartBusyId] = useState('');
  const [cartLinesByProduct, setCartLinesByProduct] = useState(() => new Map());
  const [variantSheet, setVariantSheet] = useState(
    /** @type {null | { item: Record<string, unknown>; variants: Record<string, unknown>[]; selected: number | null }} */ (null),
  );

  const loadCartProducts = useCallback(async () => {
    try {
      const res = await fetchBuyerCart();
      const lines = Array.isArray(res?.lines) ? res.lines : [];
      const byProduct = new Map();
      lines.forEach(line => {
        if (!line || typeof line !== 'object') return;
        const id = String(line.productId ?? line.product_id ?? '').trim();
        if (!id) return;
        const cartItemId = Number(line.cartItemId ?? line.cart_item_id ?? line.id);
        const list = byProduct.get(id) ?? [];
        if (Number.isFinite(cartItemId)) list.push(cartItemId);
        byProduct.set(id, list);
      });
      setCartLinesByProduct(byProduct);
    } catch {
      setCartLinesByProduct(new Map());
    }
  }, []);

  const loadItems = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await fetchRecentlyViewedProducts();
      setItems(rows.map(mapHistoryProduct));
    } catch {
      if (!refresh) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadItems();
      // void loadCartProducts();
    }, [loadItems]),
  );

  const addLine = useCallback(async (inventoryId, unitPrice) => {
    const id = Number(inventoryId);
    if (!Number.isFinite(id) || id <= 0) {
      Alert.alert('Cart', 'This product cannot be added yet.');
      return false;
    }
    try {
      const opts = Number.isFinite(Number(unitPrice)) && Number(unitPrice) > 0
        ? { unitPrice: Number(unitPrice) }
        : {};
      await addBuyerCartLine(id, 1, opts);
      await loadCartProducts();
      Alert.alert('Cart', 'Added to your cart.');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        /unauthorized|401/i.test(msg) ? 'Sign in required' : 'Cart',
        /unauthorized|401/i.test(msg) ? 'Please sign in to add items to your cart.' : msg,
      );
      return false;
    }
  }, [loadCartProducts]);

  const onCartPress = useCallback(async (item) => {
    const key = `${item.shop?.id}-${item.id}`;
    if (cartBusyId) return;
    setCartBusyId(key);
    try {
      const existing = cartLinesByProduct.get(String(item.id));
      if (existing) {
        await Promise.all(existing.map(cartItemId => deleteBuyerCartLine(cartItemId)));
        await loadCartProducts();
        return;
      }
      const data = await getStorefrontProduct(item.id);
      const detail = data?.product && typeof data.product === 'object' ? data.product : null;
      const rawVariants = Array.isArray(detail?.variants) ? detail.variants : [];
      const variants = rawVariants.filter(row => row && typeof row === 'object');
      if (detail?.hasVariants && variants.length > 1) {
        setVariantSheet({ item, variants, selected: null });
        return;
      }
      if (detail?.hasVariants && variants.length === 1) {
        await addLine(variants[0].id, variants[0].price);
        return;
      }
      await addLine(detail?.inventoryId, detail?.price ?? item.price);
    } catch (e) {
      Alert.alert('Cart', e instanceof Error ? e.message : String(e));
    } finally {
      setCartBusyId('');
    }
  }, [addLine, cartBusyId, cartLinesByProduct, loadCartProducts]);

  const confirmVariant = useCallback(async () => {
    if (!variantSheet || variantSheet.selected == null) return;
    const row = variantSheet.variants[variantSheet.selected];
    if (!row) return;
    setCartBusyId(`${variantSheet.item?.shop?.id}-${variantSheet.item?.id}`);
    const ok = await addLine(row.id, row.price);
    setCartBusyId('');
    if (ok) setVariantSheet(null);
  }, [addLine, variantSheet]);

  const openProduct = useCallback((item) => {
    navigation.navigate('Product', {
      vendor: item.shop,
      productId: item.id,
      shop_id: item.shop?.id,
      product: {
        id: item.id,
        title: item.title,
        uri: item.uri,
        priceUsd: item.price,
        currency: 'NGN',
      },
    });
  }, [navigation]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadItems({ refresh: true }).catch(() => {});
            }}
            tintColor="#00926E"
            colors={['#00926E']}
          />
        }
      >
        {loading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={styles.card}>
                <View style={[styles.cardImage, styles.bone]} />
                <View>
                  <View style={[styles.boneLine, { width: '92%', marginTop: 8 }]} />
                  <View style={[styles.boneLine, { width: '64%', marginTop: 6 }]} />
                  <View style={[styles.boneLine, { width: '48%', marginTop: 8, height: 12 }]} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map(item => {
              const showCompare = item.comparePrice > item.price && item.price > 0;
              const { rating, count } = shopRating(item.shop);
              const inCart = cartLinesByProduct.has(String(item.id));
              return (
                <TouchableOpacity
                  key={`${item.shop?.id}-${item.id}`}
                  style={styles.card}
                  activeOpacity={0.9}
                  onPress={() => openProduct(item)}
                >
                  <ProductCardMedia uri={item.uri} style={styles.cardImage} />
                  <View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.ratingRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Icon
                          key={star}
                          name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'}
                          size={12}
                          color={rating > 0 ? '#E8A317' : '#D0D0D0'}
                        />
                      ))}
                      <Text style={styles.ratingText}>
                        {rating > 0 ? rating.toFixed(1) : 'New'}
                        {count > 0 ? ` (${count})` : ''}
                      </Text>
                    </View>
                    <View style={styles.priceRow}>
                      <View style={styles.priceCopy}>
                        <Text style={styles.cardPrice}>{formatNaira(item.price)}</Text>
                        {showCompare ? (
                          <Text style={styles.comparePrice}>{formatNaira(item.comparePrice)}</Text>
                        ) : null}
                      </View>
                      {/* <TouchableOpacity
                        style={[styles.cartBtn, inCart && styles.cartBtnOn]}
                        onPress={() => { void onCartPress(item); }}
                        disabled={Boolean(cartBusyId)}
                        hitSlop={6}
                        accessibilityLabel={inCart ? 'Remove from cart' : 'Add to cart'}
                      >
                        {cartBusyId === `${item.shop?.id}-${item.id}` ? (
                          <ActivityIndicator size="small" color={inCart ? '#FFFFFF' : '#00926E'} />
                        ) : (
                          <Icon name={inCart ? 'cart' : 'cart-outline'} size={18} color={inCart ? '#FFFFFF' : '#111111'} />
                        )}
                      </TouchableOpacity> */}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {!loading && items.length === 0 ? (
          <Text style={styles.empty}>You have not viewed any products yet.</Text>
        ) : null}
      </ScrollView>

      <Modal visible={variantSheet != null} transparent animationType="slide" onRequestClose={() => setVariantSheet(null)}>
        <View style={styles.modalFill}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setVariantSheet(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.variantHead}>
              <ProductCardMedia uri={variantSheet?.item?.uri} style={styles.variantThumb} />
              <View style={styles.variantHeadText}>
                <Text style={styles.variantName} numberOfLines={2}>{variantSheet?.item?.title}</Text>
                <Text style={styles.variantPrice}>
                  {variantSheet?.selected != null
                    ? formatNaira(Number(variantSheet.variants[variantSheet.selected]?.price) || 0)
                    : formatNaira(Number(variantSheet?.item?.price) || 0)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVariantSheet(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={24} color="#111111" />
              </TouchableOpacity>
            </View>
            <Text style={styles.variantSection}>Options</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.variantGrid}>
              {(variantSheet?.variants ?? []).map((row, index) => {
                const attrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
                const features = Object.entries(attrs)
                  .map(([key, value]) => ({
                    name: String(key).replace(/[_-]+/g, ' ').trim(),
                    value: String(value ?? '').trim(),
                  }))
                  .filter(feature => feature.value);
                const selected = variantSheet?.selected === index;
                const stock = Number(row.stock);
                const out = Number.isFinite(stock) && stock <= 0;
                return (
                  <TouchableOpacity
                    key={`${row.id}-${index}`}
                    style={[styles.variantTile, selected && styles.variantTileOn, out && styles.variantTileOff]}
                    disabled={out}
                    onPress={() => setVariantSheet(current => current ? { ...current, selected: index } : current)}
                  >
                    <ProductCardMedia uri={variantSheet?.item?.uri} style={styles.variantTileImage} />
                    <View style={styles.variantFeatures}>
                      {features.length ? features.map(feature => (
                        <Text key={`${feature.name}-${feature.value}`} style={styles.variantFeature}>
                          <Text style={styles.variantFeatureName}>{feature.name}: </Text>
                          {feature.value}
                        </Text>
                      )) : (
                        <Text style={styles.variantFeature}>{`Option ${index + 1}`}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {/* <TouchableOpacity
              style={[styles.applyBtn, (variantSheet?.selected == null || cartBusyId) && styles.applyBtnOff]}
              disabled={variantSheet?.selected == null || Boolean(cartBusyId)}
              onPress={() => { void confirmVariant(); }}
            >
              {cartBusyId ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.applyText}>
                  {variantSheet?.selected == null ? 'Select an option' : 'Add to cart'}
                </Text>
              )}
            </TouchableOpacity> */}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  grid: {
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bone: { backgroundColor: '#ECECEC' },
  boneLine: { height: 14, borderRadius: 6, backgroundColor: '#ECECEC' },
  card: {
    width: '48%',
    marginBottom: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 7,
    padding: 8,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 7,
    backgroundColor: '#F3F3F3',
  },
  cardTitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 18,
    color: '#222222',
    minHeight: 36,
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: { marginLeft: 4, fontSize: 12, color: '#666666' },
  priceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#111111' },
  comparePrice: {
    fontSize: 13,
    color: '#9A9A9A',
    textDecorationLine: 'line-through',
  },
  cartBtnOn: {
    backgroundColor: '#00926E',
    borderColor: '#00926E',
  },
  cartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingHorizontal: 20, paddingTop: 8, color: '#8A8A8A' },
  modalFill: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  variantHead: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  variantThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F3F3F3' },
  variantHeadText: { flex: 1, justifyContent: 'center' },
  variantName: { fontSize: 15, fontWeight: '700', color: '#111111' },
  variantPrice: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#00926E' },
  variantSection: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 16 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  variantTile: {
    width: '48%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#FFFFFF',
    padding: 8,
  },
  variantTileOn: { borderColor: '#00926E', borderWidth: 2 },
  variantTileOff: { opacity: 0.45 },
  variantTileImage: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#F3F3F3' },
  variantFeatures: { marginTop: 12, gap: 4 },
  variantFeature: { fontSize: 12, lineHeight: 16, color: '#222222' },
  variantFeatureName: { fontWeight: '700', textTransform: 'capitalize' },
  applyBtnOff: { opacity: 0.55 },
  applyBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#00926E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
