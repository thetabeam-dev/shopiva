import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
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
import ShopPolicyViewerModal from '../../components/ShopPolicyViewerModal';
import { buildMvpCategoryFilters, formatMvpCategoryLabel } from '../../utils/mvpCategory';
import { selectCategoryTree } from '../../../redux/categoriesSlice';
import { getStorefrontProducts, getStorefrontShop, getStorefrontShopDelivery } from '../../api/storefront';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';
import { normalizeShopDelivery, parseShopId } from '../../utils/vendorDelivery';

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
      emptyColor="rgba(255,255,255,0.7)"
      countColor="#FFFFFF"
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

function ProductTile({ product, width, shop, navigation, vendor, category }) {
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
          <Image source={{ uri: product.uri }} style={styles.tileImage} resizeMode="cover" />
        ) : (
          <View style={[styles.tileImage, styles.tileImagePh]}>
            <Icon name="image-outline" size={32} color="rgba(255,255,255,0.45)" />
          </View>
        )}
        {/* MVP: wishlist heart on grid tile — disabled
        <TouchableOpacity
          style={styles.tileHeart}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => {}}
        >
          <Icon name="heart-outline" size={17} color="#000000" />
        </TouchableOpacity>
        */}
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
  const vendor = route.params?.vendor;
  const category = vendor?.category ?? 'fashion';
  const shopName = vendor?.name?.trim() || 'Shop';
  const insets = useSafeAreaInsets();

  const [filterOpen, setFilterOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [modalFilters, setModalFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [shopMeta, setShopMeta] = useState(/** @type {Record<string, unknown>} */ ({}));
  const [apiProducts, setApiProducts] = useState(/** @type {ReturnType<typeof mapStorefrontProductToTile>[]} */ ([]));
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState(
    /** @type {ReturnType<typeof normalizeShopDelivery>} */ (null),
  );
  const [deliveryError, setDeliveryError] = useState('');
  const slug = String(vendor?.slug ?? '').trim();

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
    if (!slug) {
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
          getStorefrontShop(slug).catch(() => ({ shop: {}, shopPolicies: null })),
          getStorefrontProducts(slug),
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
  }, [slug]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setFilterOpen(false);
      };
    }, []),
  );

  const products = apiProducts;
  const displayedProducts = useMemo(() => applyProductFilters(products, filters), [products, filters]);
  const heroUri = useMemo(() => {
    const banner = typeof shopMeta.banner === 'string' ? shopMeta.banner.trim() : '';
    const logo = typeof shopMeta.logo === 'string' ? shopMeta.logo.trim() : '';
    if (banner) return banner;
    if (logo) return logo;
    return '';
  }, [shopMeta]);

  const colW = (WINDOW_W - PAD * 2 - GRID_GAP) / 2;

  const topPad = insets.top + 8;

  const onFollow = useCallback(() => {
    setFollowing((f) => !f);
  }, []);

  const openDeliveryDetails = useCallback(async () => {
    setDeliveryModalVisible(true);
    if (!resolvedShopId) {
      setDeliveryInfo(null);
      setDeliveryError('This shop cannot load delivery details (missing id).');
      return;
    }
    if (deliveryInfo?.shopId === resolvedShopId && !deliveryError) {
      return;
    }
    setDeliveryLoading(true);
    setDeliveryError('');
    try {
      const raw = await getStorefrontShopDelivery(resolvedShopId);
      setDeliveryInfo(normalizeShopDelivery(raw));
    } catch (e) {
      setDeliveryInfo(null);
      setDeliveryError(
        e instanceof Error ? e.message : 'Could not load delivery details.',
      );
    } finally {
      setDeliveryLoading(false);
    }
  }, [resolvedShopId, deliveryInfo, deliveryError]);

  const deliveryHeaderActions = (
    <>
      <TouchableOpacity
        style={[styles.circleBrown, styles.heroIconGap]}
        onPress={() => navigation.navigate('Cart')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open cart"
      >
        <Icon name="cart-outline" size={20} color="#000000" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.circleBrown, styles.heroIconGap]}
        onPress={openDeliveryDetails}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Delivery details"
      >
        <Icon name="car-outline" size={20} color="#000000" />
      </TouchableOpacity>
    </>
  );

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
      <StatusBar barStyle="light-content" backgroundColor={BROWN} translucent />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 88 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {heroUri ? (
            <ImageBackground source={{ uri: heroUri }} style={styles.heroImage} resizeMode="cover">
              <View style={styles.heroTint} />
              <View style={styles.heroBrownFade} />
              <View style={[styles.heroTopBar, { paddingTop: topPad }]}>
                <View style={styles.heroTopLeft}>
                  <TouchableOpacity style={styles.circleBrown} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Icon name="arrow-back" size={22} color="#000000" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.circleBrown, styles.heroIconGap]} activeOpacity={0.85}>
                    <Icon name="search-outline" size={20} color="#000000" />
                  </TouchableOpacity>
                </View>
                <View style={styles.heroTopRight}>
                  <TouchableOpacity style={styles.followPill} onPress={onFollow} activeOpacity={0.88}>
                    <Text style={styles.followPillText}>{following ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>
                  {deliveryHeaderActions}
                  <TouchableOpacity style={[styles.circleBrown, styles.heroIconGap]} activeOpacity={0.85}>
                    <Icon name="share-outline" size={20} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.heroBrandBlock}>
                <Text style={styles.brandWordmark} numberOfLines={1}>
                  {shopName}
                </Text>
                {renderShopReviewSummary(shopMeta)}
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.heroImage, styles.heroSolid]}>
              <View style={styles.heroTint} />
              <View style={styles.heroBrownFade} />
              <View style={[styles.heroTopBar, { paddingTop: topPad }]}>
                <View style={styles.heroTopLeft}>
                  <TouchableOpacity style={styles.circleBrown} onPress={() => navigation.goBack()} activeOpacity={0.85}>
                    <Icon name="arrow-back" size={22} color="#000000" />
                  </TouchableOpacity>
                  {/* <TouchableOpacity style={[styles.circleBrown, styles.heroIconGap]} activeOpacity={0.85}>
                    <Icon name="search-outline" size={20} color="#000000" />
                  </TouchableOpacity> */}
                </View>
                <View style={styles.heroTopRight}>
                  {/* <TouchableOpacity style={styles.followPill} onPress={onFollow} activeOpacity={0.88}>
                    <Text style={styles.followPillText}>{following ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity> */}
                  {deliveryHeaderActions}
                  <TouchableOpacity style={[styles.circleBrown, styles.heroIconGap]} activeOpacity={0.85}>
                    <Icon name="share-outline" size={20} color="#000000" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.heroBrandBlock}>
                <Text style={styles.brandWordmark} numberOfLines={1}>
                  {shopName}
                </Text>
                {renderShopReviewSummary(shopMeta)}
              </View>
            </View>
          )}
        </View>

        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All products</Text>
            <TouchableOpacity style={styles.filterFab} onPress={openFilterModal} activeOpacity={0.88}>
              <Icon name="options-outline" size={20} color="#000000" />
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <View style={styles.productsLoading}>
              <ActivityIndicator size="large" color="#FFFFFF" />
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
                  vendor={vendor}
                  category={category}
                  shop={shopMeta}
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
      <ShopPolicyViewerModal
        visible={deliveryModalVisible}
        onClose={() => setDeliveryModalVisible(false)}
        title="Delivery details"
        clauses={[]}
        locations={deliveryInfo?.locations}
        deliveryMethod={deliveryInfo?.method}
        loading={deliveryLoading}
        emptyMessage={
          deliveryError ||
          'This vendor has not set delivery locations on Shopiva yet.'
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BROWN,
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
    backgroundColor: BROWN,
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
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileImagePh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  /* MVP: wishlist overlay on product tile — disabled (see commented TouchableOpacity above)
  tileHeart: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  */
  tileTitle: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
});
