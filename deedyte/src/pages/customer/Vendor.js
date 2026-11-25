import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import RatingRow from '../../components/RatingRow';
import { buildMvpCategoryFilters, formatMvpCategoryLabel } from '../../utils/mvpCategory';
import { selectCategoryTree } from '../../../redux/categoriesSlice';
import { getStorefrontProduct, getStorefrontProducts, getStorefrontShop } from '../../api/storefront';
import { recordShopView } from '../../api/buyer';
import { useAuth } from '../../hooks/useAuth';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';
import { ProductCardMedia } from '../../components/ProductCardMedia';
import { normalizeStorefrontProductDetail } from '../../utils/storefrontProductNormalize';
import { formatAttributeLabel } from '../../utils/storefrontProductDetail';
import { parseShopId } from '../../utils/vendorDelivery';
import {
  getVendorOrder,
  orderSubtotal,
  removeVendorOrderLine,
  upsertVendorOrderLine,
} from '../../utils/vendorOrderCart';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const BROWN = '#00926e';
const BROWN_SOFT = '#00926e';
const PAD = 16;
const GRID_GAP = 12;

const GENDERS = ['Male', 'Female'];

/** @type {{ gender: string | null; subCategory: string | null; type: string | null; sortPrice: 'none' | 'asc' | 'desc' }} */
const DEFAULT_FILTERS = {
  gender: null,
  subCategory: null,
  type: null,
  sortPrice: 'none',
};

const GENDER_OPTIONS = [
  { label: 'Any', value: null },
  ...GENDERS.map((g) => ({ label: g, value: g })),
];
const SORT_OPTIONS = [
  { label: 'Default', value: 'none' },
  { label: 'Price: low to high', value: 'asc' },
  { label: 'Price: high to low', value: 'desc' },
];

function renderShopReviewSummary(shop) {
  const rating = Number(shop?.average_rating ?? shop?.averageRating ?? shop?.ratingAverage ?? 0);
  const count  = Number(shop?.review_count  ?? shop?.reviewCount  ?? shop?.ratingCount  ?? 0);
  return (
    <RatingRow
      rating={rating}
      count={count}
      starSize={17}
      activeColor="#E8C547"
      emptyColor="#D1D5DB"
      countColor="#111111"
      countSize={14}
      style={{ marginTop: 4 }}
    />
  );
}

/**
 * @param {object[]} products
 * @param {{ gender: string | null; subCategory: string | null; type: string | null; sortPrice: 'none' | 'asc' | 'desc' }} f
 */
function applyProductFilters(products, f) {
  let list = products.filter((p) => {
    if (f.gender && p.gender !== f.gender) return false;
    if (f.subCategory && p.subCategory !== f.subCategory) return false;
    if (f.type && f.subCategory && p.type !== f.type) return false;
    return true;
  });
  list = [...list];
  if (f.sortPrice === 'asc') {
    list.sort((a, b) => a.priceUsd - b.priceUsd);
  } else if (f.sortPrice === 'desc') {
    list.sort((a, b) => b.priceUsd - a.priceUsd);
  }
  return list;
}

/**
 * @param {Record<string, unknown>} p
 * @param {number} index
 */
function mapStorefrontProductToTile(p, index) {
  const id = String(p.id ?? index);
  const title = String(p.name ?? p.title ?? 'Product').trim() || 'Product';
  const uri = getProductImageUri(p) || '';
  const hasVariants = Boolean(p.hasVariants);
  const minPrice = Number(p.minPrice) || 0;
  const maxPrice = Number(p.maxPrice) || minPrice;
  const gender = String(p.gender ?? 'Male');
  const subCategory = String(p.subCategory ?? p.subcategory ?? 'general').toLowerCase();
  const type = String(p.type ?? subCategory).toLowerCase();
  const shop_id = String(p.shop_id ?? "");
  return {
    key: id,
    title,
    uri,
    shop_id,
    hasVariants,
    minPrice,
    maxPrice,
    priceUsd: minPrice,
    currency: 'NGN',
    gender,
    subCategory,
    type,
  };
}

/**
 * @param {{ priceUsd?: number; currency?: string }} p
 */
function formatProductTilePrice(p) {
  if (p.hasVariants && Number(p.minPrice) !== Number(p.maxPrice)) {
    return `${formatNaira(Number(p.minPrice) || 0)} – ${formatNaira(Number(p.maxPrice) || 0)}`;
  }
  return formatNaira(Number(p.minPrice ?? p.priceUsd) || 0);
}

/**
 * @param {{ title: string; options: { label: string; value: string | null }[]; value: string | null; onChange: (v: string | null) => void; embedded?: boolean }} p
 */
function FilterChipSection({ title, options, value, onChange, embedded }) {
  const chips = (
    <View style={styles.filterChipsWrap}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value ?? 'any')}
            style={[styles.filterChip, selected && styles.filterChipSelected]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.85}
          >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  if (embedded) {
    return chips;
  }
  return (
    <View style={styles.filterSection}>
      {title ? <Text style={styles.filterSectionTitle}>{title}</Text> : null}
      {chips}
    </View>
  );
}

function ProductTile({
  product,
  width,
  shop,
  navigation,
  vendor,
  category,
  inVendorCart,
  cartBusy,
  onToggleVendorCart,
}) {
  return (
    <TouchableOpacity
      style={[styles.tile, { width }]}
      activeOpacity={0.92}
      onPress={() =>
        navigation.navigate('Product', {
          vendor,
          category: category ?? 'fashion',
          productId: String(product.key),
          shop_id: shop.id,
          product: {
            id: product.key,
            key: product.key,
            title: product.title,
            uri: product.uri,
            priceUsd: product.priceUsd,
            currency: product.currency,
            gender: product.gender,
            subCategory: product.subCategory,
            type: product.type,
          },
        })
      }
    >
      <View style={styles.tileImageWrap}>
        {product.uri ? (
          <ProductCardMedia uri={product.uri} style={styles.tileImage} />
        ) : (
          <View style={[styles.tileImage, styles.tileImagePh]}>
            <Icon name="image-outline" size={32} color="#9CA3AF" />
          </View>
        )}
        <TouchableOpacity
          style={[styles.tileCartBadge, inVendorCart && styles.tileCartBadgeOn]}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => onToggleVendorCart(product)}
          disabled={cartBusy}
          accessibilityRole="button"
          accessibilityLabel={inVendorCart ? 'Remove from vendor cart' : 'Add to vendor cart'}
        >
          {cartBusy ? (
            <ActivityIndicator size="small" color={inVendorCart ? '#FFFFFF' : '#00926e'} />
          ) : (
            <Icon
              name={inVendorCart ? 'cart' : 'cart-outline'}
              size={17}
              color={inVendorCart ? '#FFFFFF' : '#111111'}
            />
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {product.title}
      </Text>
      <Text style={styles.tilePrice}>{formatProductTilePrice(product)}</Text>
    </TouchableOpacity>
  );
}

/**
 * @param {{ route: { params?: { vendor?: { id: number; name?: string; slug?: string }; category?: string } }; navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function VendorShopScreen({ route, navigation }) {
  const { isAuthenticated, signOut } = useAuth();
  const vendor = route.params?.vendor;
  const category = vendor?.category ?? 'fashion';
  const shopName = vendor?.name?.trim() || 'Shop';
  const insets = useSafeAreaInsets();

  const [filterOpen, setFilterOpen] = useState(false);
  const [profileTab, setProfileTab] = useState('products');
  const [following, setFollowing] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [modalFilters, setModalFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [shopMeta, setShopMeta] = useState(/** @type {Record<string, unknown>} */ ({}));
  const [apiProducts, setApiProducts] = useState(/** @type {ReturnType<typeof mapStorefrontProductToTile>[]} */ ([]));
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [shopReviews, setShopReviews] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [vendorOrderCount, setVendorOrderCount] = useState(0);
  const [vendorOrderSubtotal, setVendorOrderSubtotal] = useState(0);
  const [vendorCartProductIds, setVendorCartProductIds] = useState(() => new Set());
  const [vendorCartLineIdsByProduct, setVendorCartLineIdsByProduct] = useState(() => new Map());
  const [vendorCartBusyId, setVendorCartBusyId] = useState('');
  const [variantSheet, setVariantSheet] = useState(
    /** @type {{ product: ReturnType<typeof mapStorefrontProductToTile>; variants: Record<string, unknown>[]; selected: number | null } | null} */ (
      null
    ),
  );
  const slug = String(vendor?.slug ?? '').trim();
  const storefrontKey =
    slug ||
    (parseShopId(vendor?.id) || parseShopId(vendor?.shop_id)
      ? String(parseShopId(vendor?.id) || parseShopId(vendor?.shop_id))
      : '');

  const resolvedShopId = useMemo(
    () =>
      parseShopId(shopMeta?.id) ||
      parseShopId(shopMeta?.shop_id) ||
      parseShopId(vendor?.id) ||
      parseShopId(vendor?.shop_id),
    [shopMeta?.id, shopMeta?.shop_id, vendor?.id, vendor?.shop_id],
  );

  const categoryTree = useSelector(selectCategoryTree);

  const { subCategories, typesBySubCategory, subTypePairs } = useMemo(
    () => buildMvpCategoryFilters(categoryTree, category),
    [categoryTree, category],
  );

  const subCategoryOptions = useMemo(
    () => [{ label: 'Any', value: null }, ...subCategories.map((s) => ({ label: formatMvpCategoryLabel(s), value: s }))],
    [subCategories],
  );

  const modalTypeOptions = useMemo(() => {
    const sub = modalFilters.subCategory;
    if (!sub) {
      return [{ label: 'Any', value: null }];
    }
    const arr = typesBySubCategory.get(sub) ?? [];
    return [{ label: 'Any', value: null }, ...arr.map((t) => ({ label: formatMvpCategoryLabel(t), value: t }))];
  }, [modalFilters.subCategory, typesBySubCategory]);

  useEffect(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setModalFilters({ ...DEFAULT_FILTERS });
  }, [category]);

  useEffect(() => {
    if (!storefrontKey) {
      setProductsLoading(false);
      setProductsError('This shop is missing a link (slug).');
      setApiProducts([]);
      setShopMeta({});
      return;
    }
    let cancelled = false;
    (async () => {
      setProductsLoading(true);
      setProductsError('');
      try {
        const [shopRes, prodRes] = await Promise.all([
          getStorefrontShop(storefrontKey).catch(() => ({ shop: {}, shopPolicies: null, reviews: [] })),
          getStorefrontProducts(storefrontKey),
        ]);
        
        if (cancelled) return;
        const shop = shopRes.shop && typeof shopRes.shop === 'object' ? shopRes.shop : {};
        const metrics = shopRes.shopReviewMetrics && typeof shopRes.shopReviewMetrics === 'object'
          ? shopRes.shopReviewMetrics
          : {};
        const incomingVendor = vendor && typeof vendor === 'object' ? vendor : {};
        setShopMeta(/** @type {Record<string, unknown>} */ ({
          ...incomingVendor,
          ...metrics,
          ...shop,
          average_rating: shop.average_rating
            ?? metrics.average_rating
            ?? incomingVendor.average_rating
            ?? incomingVendor.averageRating
            ?? incomingVendor.ratingAverage
            ?? 0,
          review_count: shop.review_count
            ?? metrics.review_count
            ?? incomingVendor.review_count
            ?? incomingVendor.reviewCount
            ?? incomingVendor.ratingCount
            ?? 0,
        }));
        const list = Array.isArray(prodRes.products) ? prodRes.products : [];
        setApiProducts(list.map(mapStorefrontProductToTile));
        setShopReviews(Array.isArray(shopRes.reviews) ? shopRes.reviews : []);
        const viewedShopId =
          parseShopId(shop.id) ||
          parseShopId(incomingVendor.id) ||
          parseShopId(incomingVendor.shop_id);
        if (viewedShopId) void recordShopView(viewedShopId).catch(() => {});
      } catch (e) {
        if (!cancelled) {
          setProductsError(e instanceof Error ? e.message : String(e));
          setApiProducts([]);
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storefrontKey]);

  const applyVendorCartRows = useCallback((rows) => {
    const list = Array.isArray(rows) ? rows : [];
    setVendorOrderCount(list.length);
    setVendorOrderSubtotal(orderSubtotal(list));
    const ids = new Set();
    const byProduct = new Map();
    list.forEach((row) => {
      const pid = String(row?.productId ?? '').trim();
      if (!pid) return;
      ids.add(pid);
      const cid = Number(row?.cartItemId ?? row?.key);
      const next = byProduct.get(pid) ?? [];
      if (Number.isFinite(cid) && cid > 0) next.push(cid);
      byProduct.set(pid, next);
    });
    setVendorCartProductIds(ids);
    setVendorCartLineIdsByProduct(byProduct);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const sid = resolvedShopId;
      if (sid) {
        void getVendorOrder(sid)
          .then(applyVendorCartRows)
          .catch(() => applyVendorCartRows([]));
      } else {
        applyVendorCartRows([]);
      }
      return () => {
        setFilterOpen(false);
      };
    }, [resolvedShopId, applyVendorCartRows]),
  );

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      StatusBar.setHidden(true, 'fade');
      return () => {
        StatusBar.setHidden(false, 'fade');
      };
    }, []),
  );

  const products = apiProducts;
  const displayedProducts = useMemo(() => applyProductFilters(products, filters), [products, filters]);
  const coverUri = typeof shopMeta.banner === 'string' ? shopMeta.banner.trim() : '';
  const logoUri = typeof shopMeta.logo === 'string' ? shopMeta.logo.trim() : '';
  const about = String(shopMeta.description ?? shopMeta.bio ?? shopMeta.about ?? '').trim();
  const joinedLabel = useMemo(() => {
    const raw = shopMeta.created_at ?? shopMeta.createdAt;
    const date = raw ? new Date(String(raw)) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [shopMeta]);
  const followerCount = Number(shopMeta.follower_count ?? shopMeta.followers ?? 0) || 0;
  const displayName = String(shopMeta.name ?? shopName).trim() || shopName;

  const addProductToVendorCart = useCallback(
    async (product, inventoryId, unitPrice, variantLabel) => {
      const sid = resolvedShopId;
      const productId = Number(product?.key);
      const invId = Number(inventoryId);
      if (!(sid > 0) || !(productId > 0) || !(invId > 0)) {
        Alert.alert('Vendor cart', 'This product cannot be added yet.');
        return false;
      }
      const rows = await upsertVendorOrderLine(sid, {
        shopId: sid,
        shopName: displayName,
        productId,
        inventoryId: invId,
        variantId: invId,
        variantLabel,
        title: String(product?.title ?? '').trim(),
        image: String(product?.uri ?? '').trim(),
        unitPrice: Number(unitPrice) || Number(product?.minPrice) || 0,
        qty: 1,
      });
      applyVendorCartRows(rows);
      return true;
    },
    [resolvedShopId, displayName, applyVendorCartRows],
  );

  const onToggleVendorCart = useCallback(
    async (product) => {
      const productId = String(product?.key ?? '').trim();
      if (!productId || vendorCartBusyId) return;
      if (!isAuthenticated) {
        Alert.alert('Sign in required', 'Please sign in to manage your vendor cart.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign in', onPress: () => void signOut() },
        ]);
        return;
      }
      const sid = resolvedShopId;
      if (!(sid > 0)) {
        Alert.alert('Vendor cart', 'This shop could not be identified.');
        return;
      }
      setVendorCartBusyId(productId);
      try {
        const existing = vendorCartLineIdsByProduct.get(productId);
        if (existing?.length) {
          let rows = [];
          for (const lineId of existing) {
            rows = await removeVendorOrderLine(sid, lineId);
          }
          applyVendorCartRows(rows);
          return;
        }
        const data = await getStorefrontProduct(productId);
        const detail = normalizeStorefrontProductDetail(data);
        const rawVariants = Array.isArray(detail?.variants) ? detail.variants : [];
        const variants = rawVariants.filter((row) => row && typeof row === 'object');
        if (detail?.hasVariants && variants.length > 1) {
          setVariantSheet({ product, variants, selected: null });
          return;
        }
        if (detail?.hasVariants && variants.length === 1) {
          const row = variants[0];
          const attrs =
            row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
          const variantLabel = Object.entries(attrs)
            .map(([key, value]) => `${formatAttributeLabel(key)}: ${String(value ?? '').trim()}`)
            .filter((part) => !part.endsWith(': '))
            .join(' · ');
          await addProductToVendorCart(product, row.id, row.price, variantLabel);
          return;
        }
        await addProductToVendorCart(
          product,
          detail?.inventoryId,
          detail?.price ?? product.minPrice,
          '',
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        Alert.alert(
          /unauthorized|401/i.test(msg) ? 'Sign in required' : 'Vendor cart',
          /unauthorized|401/i.test(msg) ? 'Please sign in to manage your vendor cart.' : msg,
        );
      } finally {
        setVendorCartBusyId('');
      }
    },
    [
      vendorCartBusyId,
      isAuthenticated,
      signOut,
      resolvedShopId,
      vendorCartLineIdsByProduct,
      applyVendorCartRows,
      addProductToVendorCart,
    ],
  );

  const confirmVariant = useCallback(async () => {
    if (!variantSheet || variantSheet.selected == null) return;
    const row = variantSheet.variants[variantSheet.selected];
    if (!row) return;
    const productId = String(variantSheet.product?.key ?? '').trim();
    setVendorCartBusyId(productId);
    try {
      const attrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : {};
      const variantLabel = Object.entries(attrs)
        .map(([key, value]) => `${formatAttributeLabel(key)}: ${String(value ?? '').trim()}`)
        .filter((part) => !part.endsWith(': '))
        .join(' · ');
      const ok = await addProductToVendorCart(
        variantSheet.product,
        row.id,
        row.price,
        variantLabel,
      );
      if (ok) setVariantSheet(null);
    } catch (e) {
      Alert.alert('Vendor cart', e instanceof Error ? e.message : String(e));
    } finally {
      setVendorCartBusyId('');
    }
  }, [variantSheet, addProductToVendorCart]);

  const colW = (WINDOW_W - PAD * 2 - GRID_GAP) / 2;

  const topPad = insets.top + 8;

  const onFollow = useCallback(() => {
    setFollowing((f) => !f);
  }, []);

  const openFilterModal = useCallback(() => {
    const m = { ...filters };
    if (m.type && !m.subCategory) m.type = null;
    if (m.type && m.subCategory) {
      const allowed = typesBySubCategory.get(m.subCategory) ?? [];
      if (!allowed.includes(m.type)) m.type = null;
    }
    setModalFilters(m);
    setFilterOpen(true);
  }, [filters, typesBySubCategory]);

  const applyModalFilters = useCallback(() => {
    let next = { ...modalFilters };
    if (next.type && !next.subCategory) next.type = null;
    if (next.type && next.subCategory) {
      const allowed = typesBySubCategory.get(next.subCategory) ?? [];
      if (!allowed.includes(next.type)) next.type = null;
    }
    setFilters(next);
    setFilterOpen(false);
  }, [modalFilters, typesBySubCategory]);

  const resetModalFilters = useCallback(() => {
    setModalFilters({ ...DEFAULT_FILTERS });
  }, []);

  const clearAllFiltersAndClose = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setModalFilters({ ...DEFAULT_FILTERS });
    setFilterOpen(false);
  }, []);

  if (!vendor) {
    return (
      <View style={[styles.fallback, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.fallbackText}>Missing vendor.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fallbackBtn}>
          <Text style={styles.fallbackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar
        hidden={Platform.OS === 'android'}
        barStyle="dark-content"
        backgroundColor="#E7F6EF"
        translucent={Platform.OS !== 'android'}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cover}>
          {coverUri ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Icon name="arrow-back" size={22} color="#111111" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.vendorCartBtn}
            onPress={() =>
              navigation.navigate('Vendor-order', {
                shopId: resolvedShopId,
                shopName: displayName,
                vendor,
              })
            }
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              vendorOrderCount > 0
                ? `Vendor cart, ${vendorOrderCount} item${vendorOrderCount === 1 ? '' : 's'}`
                : 'Vendor cart'
            }
          >
            <Icon name="cart-outline" size={22} color="#111111" />
            {vendorOrderCount > 0 ? (
              <View style={styles.vendorCartBadge}>
                <Text style={styles.vendorCartBadgeText}>
                  {vendorOrderCount > 99 ? '99+' : String(vendorOrderCount)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.profileBody}>
          <View style={styles.profileTop}>
            <View style={styles.avatarRing}>
              {logoUri ? (
                <Image source={{ uri: logoUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.shareBtn}
              activeOpacity={0.85}
              onPress={() => {
                const storeSlug = String(shopMeta.slug ?? slug ?? '').trim();
                if (!storeSlug) return;
                const url = `https://www.deedyte.com/store/${encodeURIComponent(storeSlug)}`;
                Share.share({
                  message: `Check out ${displayName} on DeeDyte! ${url}`,
                  title: displayName,
                  url,
                }).catch(() => {});
              }}
            >
              <Text style={styles.shareBtnText}>Share profile</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.profileName}>{displayName}</Text>
          {about ? <Text style={styles.profileAbout}>{about}</Text> : null}
          {joinedLabel ? <Text style={styles.profileMeta}>Joined {joinedLabel}</Text> : null}
          <Text style={styles.profileCounts}>
            <Text style={styles.profileCountStrong}>{apiProducts.length} products</Text>
            {'    '}
            {/* <Text style={styles.profileCountStrong}>{followerCount} followers</Text> */}
          </Text>
          <View style={styles.profileTabs}>
            <TouchableOpacity style={styles.profileTab} onPress={() => setProfileTab('products')}>
              <Text style={[styles.profileTabText, profileTab === 'products' && styles.profileTabTextOn]}>Products</Text>
              {profileTab === 'products' ? <View style={styles.profileTabLine} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileTab} onPress={() => setProfileTab('reviews')}>
              <Text style={[styles.profileTabText, profileTab === 'reviews' && styles.profileTabTextOn]}>Reviews</Text>
              {profileTab === 'reviews' ? <View style={styles.profileTabLine} /> : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.productsSection}>
          {profileTab === 'products' ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All products</Text>
            <TouchableOpacity style={styles.filterFab} onPress={openFilterModal} activeOpacity={0.88}>
              <Icon name="options-outline" size={20} color="#111111" />
            </TouchableOpacity>
          </View>
          ) : shopReviews.length === 0 ? (
            <View style={styles.reviewsEmpty}>
              <Icon name="chatbubble-ellipses-outline" size={42} color="#9CA3AF" />
              <Text style={styles.reviewsEmptyTitle}>No reviews yet</Text>
              <Text style={styles.reviewsEmptyHint}>Buyers’ reviews will show here after a completed order.</Text>
            </View>
          ) : (
            <View style={styles.reviewsPane}>
              {shopReviews.map((review) => {
                const name = String(review.reviewer_name ?? '').trim() || 'Buyer';
                const place = String(review.reviewer_location ?? '').trim();
                const comment = String(review.comment ?? '').trim();
                const ratingTitle = String(review.title ?? '')
                  .trim()
                  .replace(/\b\w/g, (letter) => letter.toUpperCase());
                const rating = Number(review.rating) || 0;
                const created = review.created_at ? new Date(String(review.created_at)) : null;
                const dateLabel = created && !Number.isNaN(created.getTime())
                  ? created.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';
                return (
                  <View key={String(review.id)} style={styles.reviewCard}>
                    <View style={styles.reviewHead}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.reviewIdentity}>
                        <Text style={styles.reviewName} numberOfLines={1}>{name}</Text>
                        {place ? <Text style={styles.reviewPlace} numberOfLines={1}>{place}</Text> : null}
                        {dateLabel ? <Text style={styles.reviewDate}>{dateLabel}</Text> : null}
                      </View>
                    </View>
                    <RatingRow rating={rating} count={0} starSize={14} activeColor="#E8A317" emptyColor="#E5E7EB" countColor="#6B7280" />
                    {ratingTitle ? <Text style={styles.reviewTitle}>{ratingTitle}</Text> : null}
                    {comment ? <Text style={styles.reviewComment}>{comment}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}
          {profileTab === 'reviews' ? null : productsLoading ? (
            <View style={styles.productsLoading}>
              <ActivityIndicator size="large" color={BROWN} />
              <Text style={styles.productsLoadingText}>Loading products…</Text>
            </View>
          ) : productsError ? (
            <Text style={styles.emptyFilter}>{productsError}</Text>
          ) : displayedProducts.length === 0 ? (
            <Text style={styles.emptyFilter}>No products match these filters.</Text>
          ) : (
            <View style={styles.grid}>
              {displayedProducts.map((p) => (
                <ProductTile
                  key={p.key}
                  product={p}
                  width={colW}
                  navigation={navigation}
                  vendor={{
                    ...vendor,
                    logo:
                      (typeof shopMeta.logo === 'string' && shopMeta.logo.trim()) ||
                      vendor?.logo ||
                      '',
                  }}
                  category={category}
                  shop={shopMeta}
                  inVendorCart={vendorCartProductIds.has(String(p.key))}
                  cartBusy={vendorCartBusyId === String(p.key)}
                  onToggleVendorCart={onToggleVendorCart}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.filterModalRoot}>
          <TouchableOpacity style={styles.filterBackdrop} activeOpacity={1} onPress={() => setFilterOpen(false)} />
          <View style={[styles.filterSheet, { maxHeight: WINDOW_H * 0.88 }]}>
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter products</Text>
              <TouchableOpacity
                style={styles.filterCloseButton}
                onPress={() => setFilterOpen(false)}
                hitSlop={10}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close filters"
              >
                <Icon name="close" size={24} color="#111111" />
              </TouchableOpacity>
            </View>
            <Text style={styles.filterSheetHint}>
              Pick a sub-category first, then choose a type for that group. Tap Apply to update the grid.
            </Text>
            <ScrollView
              style={styles.filterScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <FilterChipSection
                title="Gender"
                options={GENDER_OPTIONS}
                value={modalFilters.gender}
                onChange={(v) => setModalFilters((s) => ({ ...s, gender: v }))}
              />
              <FilterChipSection
                title="Sub-category"
                options={subCategoryOptions}
                value={modalFilters.subCategory}
                onChange={(v) => setModalFilters((s) => ({ ...s, subCategory: v, type: null }))}
              />
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Type</Text>
                {!modalFilters.subCategory ? (
                  <Text style={styles.filterTypeHint}>Select a sub-category to see types for that group.</Text>
                ) : (
                  <FilterChipSection
                    title=""
                    embedded
                    options={modalTypeOptions}
                    value={modalFilters.type}
                    onChange={(v) => setModalFilters((s) => ({ ...s, type: v }))}
                  />
                )}
              </View>
              <FilterChipSection
                title="Sort"
                options={SORT_OPTIONS}
                value={modalFilters.sortPrice}
                onChange={(v) =>
                  setModalFilters((s) => ({
                    ...s,
                    sortPrice: v === 'asc' || v === 'desc' || v === 'none' ? v : 'none',
                  }))
                }
              />
            </ScrollView>
            <View style={styles.filterFooterRow}>
              <TouchableOpacity style={styles.filterResetBtn} onPress={resetModalFilters} activeOpacity={0.88}>
                <Text style={styles.filterResetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterClearBtn} onPress={clearAllFiltersAndClose} activeOpacity={0.88}>
                <Text style={styles.filterClearText}>Clear all</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.filterSheetBtn} onPress={applyModalFilters} activeOpacity={0.9}>
              <Text style={styles.filterSheetBtnText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={variantSheet != null}
        transparent
        animationType="slide"
        onRequestClose={() => setVariantSheet(null)}
      >
        <View style={styles.variantModalFill}>
          <Pressable style={styles.variantBackdrop} onPress={() => setVariantSheet(null)} />
          <View style={[styles.variantSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.variantHandle} />
            <View style={styles.variantHead}>
              <ProductCardMedia uri={variantSheet?.product?.uri} style={styles.variantThumb} />
              <View style={styles.variantHeadText}>
                <Text style={styles.variantName} numberOfLines={2}>
                  {variantSheet?.product?.title}
                </Text>
                <Text style={styles.variantPrice}>
                  {variantSheet?.selected != null
                    ? formatNaira(Number(variantSheet.variants[variantSheet.selected]?.price) || 0)
                    : formatProductTilePrice(variantSheet?.product ?? {})}
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
                    name: formatAttributeLabel(key),
                    value: String(value ?? '').trim(),
                  }))
                  .filter((feature) => feature.value);
                const selected = variantSheet?.selected === index;
                const stock = Number(row.stock);
                const out = Number.isFinite(stock) && stock <= 0;
                return (
                  <TouchableOpacity
                    key={`${row.id}-${index}`}
                    style={[
                      styles.variantTile,
                      selected && styles.variantTileOn,
                      out && styles.variantTileOff,
                    ]}
                    disabled={out}
                    onPress={() =>
                      setVariantSheet((current) =>
                        current ? { ...current, selected: index } : current,
                      )
                    }
                  >
                    <ProductCardMedia
                      uri={variantSheet?.product?.uri}
                      style={styles.variantTileImage}
                    />
                    <View style={styles.variantFeatures}>
                      {features.length ? (
                        features.map((feature) => (
                          <Text
                            key={`${feature.name}-${feature.value}`}
                            style={styles.variantFeature}
                          >
                            <Text style={styles.variantFeatureName}>{feature.name}: </Text>
                            {feature.value}
                          </Text>
                        ))
                      ) : (
                        <Text style={styles.variantFeature}>{`Option ${index + 1}`}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.variantApplyBtn,
                (variantSheet?.selected == null || Boolean(vendorCartBusyId)) &&
                  styles.variantApplyBtnOff,
              ]}
              disabled={variantSheet?.selected == null || Boolean(vendorCartBusyId)}
              onPress={() => {
                void confirmVariant();
              }}
            >
              {vendorCartBusyId ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.variantApplyText}>
                  {variantSheet?.selected == null ? 'Select an option' : 'Add to vendor cart'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cover: {
    height: 168,
    backgroundColor: '#E7F6EF',
  },
  backBtn: {
    position: 'absolute',
    top: 8,
    left: 12,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  vendorCartBtn: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  vendorCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#00926e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  vendorCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  profileBody: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  profileTop: {
    marginTop: -36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#E7F6EF',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '700',
    color: BROWN,
  },
  shareBtn: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  profileName: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#111111',
  },
  profileAbout: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: '#111111',
  },
  profileMeta: {
    marginTop: 12,
    fontSize: 14,
    color: '#374151',
  },
  profileCounts: {
    marginTop: 14,
    fontSize: 15,
    color: '#111111',
  },
  profileCountStrong: {
    fontWeight: '800',
  },
  profileTabs: {
    marginTop: 18,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  profileTab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
  },
  profileTabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  profileTabTextOn: {
    color: '#111111',
  },
  profileTabLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    height: 2,
    backgroundColor: '#111111',
  },
  reviewsPane: {
    paddingVertical: 12,
    gap: 12,
  },
  reviewsEmpty: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  reviewsEmptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  reviewsEmptyHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E7F6EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: BROWN,
  },
  reviewIdentity: {
    flex: 1,
    marginLeft: 10,
  },
  reviewName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  reviewPlace: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280',
  },
  reviewDate: {
    marginTop: 2,
    fontSize: 12,
    color: '#9CA3AF',
  },
  reviewTitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  reviewComment: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#111111',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    width: '100%',
    minHeight: 300,
  },
  heroImage: {
    width: '100%',
    minHeight: 300,
    justifyContent: 'space-between',
  },
  heroSolid: {
    backgroundColor: '#006c51',
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(25, 18, 14, 0.42)',
  },
  heroBrownFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: BROWN,
    opacity: 0.94,
  },
  heroTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    zIndex: 2,
  },
  heroTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleBrown: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconGap: {
    marginLeft: 10,
  },
  followPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BROWN_SOFT,
  },
  followPillText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  heroBrandBlock: {
    paddingHorizontal: PAD,
    paddingBottom: 28,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  brandWordmark: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  shopReviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  brandRating: {
    color: 'rgba(255,255,255,0.96)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  heroRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  heroRatingNum: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    fontWeight: '600',
  },
  heroStar: {
    marginLeft: 6,
  },
  heroRatingParen: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    marginLeft: 6,
  },
  productsSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: PAD,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 4,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '600',
  },
  filterFab: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    marginBottom: GRID_GAP + 8,
  },
  tileImageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileImagePh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  tileCartBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCartBadgeOn: {
    backgroundColor: '#00926e',
  },
  tileTitle: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    lineHeight: 19,
  },
  tileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tileReviews: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginLeft: 6,
  },
  tilePrice: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  fallback: {
    flex: 1,
    backgroundColor: BROWN,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    marginBottom: 16,
  },
  fallbackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fallbackBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  filterModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    zIndex: 2,
    elevation: 12,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  filterCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  filterSheetHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
    lineHeight: 18,
  },
  filterScroll: {
    maxHeight: WINDOW_H * 0.52,
    marginBottom: 12,
  },
  filterSection: {
    marginBottom: 18,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
    marginBottom: 10,
  },
  filterTypeHint: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 4,
  },
  filterChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipSelected: {
    backgroundColor: 'rgba(0, 146, 110, 0.12)',
    borderColor: '#00926e',
  },
  filterChipText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#00926e',
    fontWeight: '700',
  },
  filterFooterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  filterResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
  },
  filterResetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
  },
  filterClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#B71C1C',
  },
  filterSheetBtn: {
    backgroundColor: '#00926e',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterSheetBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyFilter: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  productsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productsLoadingText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  variantModalFill: { flex: 1, justifyContent: 'flex-end' },
  variantBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  variantSheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  variantHandle: {
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
  variantApplyBtnOff: { opacity: 0.55 },
  variantApplyBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#00926E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantApplyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
