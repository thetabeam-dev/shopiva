import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ShopPolicyViewerModal from '../../components/ShopPolicyViewerModal';
import { ShopOverflowMenu } from '../../components/ShopOverflowMenu';
import {
  getVendorsOnMapByCategory,
  getStorefrontProducts,
  getStorefrontShop,
  getStorefrontShopDelivery,
} from '../../api';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';
import { extractCustomerPolicySections } from '../../utils/shopPoliciesForCustomer';
import { normalizeShopDelivery, parseShopId } from '../../utils/vendorDelivery';
import { useSelector } from 'react-redux';
import {
  selectCategoriesError,
  selectCategoriesLoading,
  selectCategoryKeys,
  selectCategoryRows,
} from '../../../redux/categoriesSlice';

const WINDOW_W = Dimensions.get('window').width;
const WINDOW_H = Dimensions.get('window').height;

function formatCategoryLabel(category) {
  return String(category ?? '')
    .split(' ')
    .map(word => word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word)
    .join(' ');
}

/** @type {readonly string[]} Nigeria states + FCT (canonical labels). */
const NG_STATES = Object.freeze([
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Federal Capital Territory',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
]);

const STATE_LOOKUP = new Map(
  NG_STATES.map(s => [s.trim().toLowerCase().replace(/\s+/g, ' '), s]),
);

/** Map common API spellings to canonical {@link NG_STATES} names. */
const STATE_ALIASES = new Map([
  ['fct', 'Federal Capital Territory'],
  ['f.c.t.', 'Federal Capital Territory'],
  ['abuja', 'Federal Capital Territory'],
  ['f c t', 'Federal Capital Territory'],
]);

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeVendorState(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  const alias = STATE_ALIASES.get(t);
  if (alias) return alias;
  const direct = STATE_LOOKUP.get(t);
  if (direct) return direct;
  for (const s of NG_STATES) {
    if (s.toLowerCase().replace(/\s+/g, ' ') === t) return s;
  }
  return null;
}

/**
 * @param {{ state?: string | null }[]} vendors
 * @returns {{ key: string; name: string | null; count: number }[]}
 */
function buildLocationRows(vendors) {
  const counts = new Map();
  let other = 0;
  for (const v of vendors) {
    const canon = normalizeVendorState(v.state);
    if (canon) {
      counts.set(canon, (counts.get(canon) || 0) + 1);
    } else {
      other += 1;
    }
  }
  const stateRows = NG_STATES.map(name => ({
    key: name,
    name,
    count: counts.get(name) ?? 0,
  }));
  if (other > 0) {
    stateRows.push({ key: 'Other', name: 'Other', count: other });
  }
  stateRows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.name.localeCompare(b.name);
  });
  return [{ key: '__all__', name: null, count: vendors.length }, ...stateRows];
}
const CARD_PAD = 18;
const PRODUCT_GAP = 10;
const PRODUCT_W = Math.min(
  132,
  Math.floor((WINDOW_W - 32 - CARD_PAD * 2 - 24) / 2.2),
);

const DARK = {
  cardBg: '#00926e',
  primaryText: '#FFFFFF',
  secondaryText: 'rgba(255,255,255,0.72)',
  ratingStar: '#E8C547',
  footerCta: 'rgba(255, 255, 255, 0.2)',
  productTileBg: 'rgba(255,255,255,0.12)',
  // heartBg: 'rgba(0,0,0,0.38)', // MVP: wishlist heart on product tiles — disabled
  priceBadge: 'rgba(0,0,0,0.55)',
};
const LIGHT = {
  cardBg: '#FFFFFF',
  primaryText: '#111111',
  secondaryText: 'rgba(17,17,17,0.55)',
  ratingStar: '#E8A317',
  footerCta: '#E8E8E8',
  productTileBg: '#F0F2F5',
  // heartBg: 'rgba(0,0,0,0.35)', // MVP: wishlist
  priceBadge: 'rgba(0,0,0,0.55)',
};

/**
 * @param {{ city?: string | null; state?: string | null; address?: string | null }} v
 */
function vendorLocationLine(v) {
  const city = String(v.city ?? '').trim();
  const state = String(v.state ?? '').trim();
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return String(v.address ?? '').trim();
}

/**
 * @param {unknown} n
 */
function formatCompactCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return '';
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}K`;
  return String(Math.round(x));
}

/**
 * @param {Record<string, unknown> | null | undefined} v
 * @returns {{ rating: number; count: number } | null}
 */
function vendorReviewStats(v) {
  if (!v || typeof v !== 'object') return null;
  const rec = /** @type {Record<string, unknown>} */ (v);
  const ratingRaw =
    rec.average_rating ??
    rec.averageRating ??
    rec.ratingAverage ??
    rec.rating ??
    0;
  const countRaw =
    rec.review_count ??
    rec.reviewCount ??
    rec.ratingCount ??
    rec.rating_count ??
    0;
  const rating = Number(ratingRaw);
  const count = Number(countRaw);
  if (!Number.isFinite(rating) || rating <= 0) {
    return null;
  }
  return {
    rating,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
  };
}

function renderRatingStars(rating, activeColor, emptyColor) {
  const safeRating = Number.isFinite(Number(rating)) ? Number(rating) : 0;
  const stars = Array.from({ length: 5 }, (_, idx) => idx + 1);
  return (
    <View style={styles.inlineRatingRow}>
      {stars.map(star => (
        <Icon
          key={star}
          name={star <= Math.round(safeRating) ? 'star' : 'star-outline'}
          size={13}
          color={star <= Math.round(safeRating) ? activeColor : emptyColor}
        />
      ))}
    </View>
  );
}

/**
 * @param {{ loading?: boolean; items?: { key: string; uri: string; priceLabel: string; title: string; priceUsd: number; currency: string; gender?: string; subCategory?: string; type?: string }[] }} [preview]
 * @param {string} category
 */
function VendorCard({
  item,
  index,
  onOpenShop,
  onPressMenu,
  preview,
  category,
}) {
  const navigation = useNavigation();
  const isDark = index % 2 === 0;
  const t = isDark ? DARK : LIGHT;
  const slug = String(item.slug ?? '').trim();
  const loc = vendorLocationLine(item);
  const pv = preview ?? { loading: Boolean(slug), items: [] };
  const carouselItems = Array.isArray(pv.items) ? pv.items : [];

  return (
    <View
      style={[styles.card, { backgroundColor: t.cardBg, borderRadius: 10 }]}
    >
      <View style={styles.cardInner}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              styles.avatar,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#E8E8E8' },
            ]}
            onPress={() => onOpenShop?.(item)}
          >
            <Text style={[styles.avatarLetter, { color: t.primaryText }]}>
              {(item.name || 'S').trim().charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerText} onPress={() => onOpenShop?.(item)}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.vendorName, { color: t.primaryText }]}
                numberOfLines={1}
              >
                {item.name || 'Shop'}
              </Text>
              <Text style={{fontSize: 8, color: '#fff'}}>●</Text>
              <View style={styles.inlineRatingWrap}>
                {(() => {
                  const stats = vendorReviewStats(item);
                  if (stats) {
                    return (
                      <>
                        {renderRatingStars(stats.rating, t.ratingStar, t.secondaryText)}
                        {stats.count > 0 ? (
                          <Text style={[styles.reviewCountText, { color: t.primaryText }]}>
                            {formatCompactCount(stats.count)}
                          </Text>
                        ) : null}
                      </>
                    );
                  }
                  return renderRatingStars(0, t.ratingStar, t.secondaryText);
                })()}
              </View>
            </View>
            {loc ? (
              <View style={styles.cardLocationRow}>
                <View style={styles.locationIconWrap}>
                  <Icon
                    name="location-outline"
                    size={14}
                    color={t.secondaryText}
                  />
                </View>
                <Text
                  style={[styles.locationText, { color: t.secondaryText }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  {...(Platform.OS === 'android'
                    ? { includeFontPadding: false }
                    : {})}
                >
                  {loc}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconHit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => onPressMenu?.(item)}
            accessibilityRole="button"
            accessibilityLabel="Shop options"
          >
            <Icon name="ellipsis-vertical" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        {pv.loading ? (
          <View style={[styles.carouselLoading, { minHeight: PRODUCT_W }]}>
            <ActivityIndicator color={isDark ? '#fff' : '#00926e'} />
          </View>
        ) : carouselItems.length === 0 ? (
          <Text style={[styles.carouselEmpty, { color: t.secondaryText }]}>
            {slug
              ? 'No published products in this shop yet.'
              : 'Open shop to see products.'}
          </Text>
        ) : (
          <FlatList
            horizontal
            nestedScrollEnabled
            data={carouselItems}
            keyExtractor={p => p.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselPad}
            renderItem={({ item: p }) => (
              <TouchableOpacity
                style={[
                  styles.productCell,
                  { width: PRODUCT_W, backgroundColor: t.productTileBg },
                ]}
                onPress={() => {
                  navigation.navigate('Product', {
                    vendor: item,
                    category: category ?? 'fashion',
                    productId: String(p.key),
                    shop_id: item.id,
                    product: {
                      id: p.key,
                      key: p.key,
                      title: p.title,
                      uri: p.uri,
                      priceUsd: p.priceUsd,
                      currency: p.currency,
                      gender: p.gender,
                      subCategory: p.subCategory,
                      type: p.type,
                    },
                  });
                }}
              >
                {p.uri ? (
                  <Image
                    source={{ uri: p.uri }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.productImage, styles.productImagePh]}>
                    <Icon
                      name="image-outline"
                      size={28}
                      color={isDark ? '#00897B' : '#999'}
                    />
                  </View>
                )}
                <View
                  style={[styles.priceBadge, { backgroundColor: t.priceBadge }]}
                >
                  <Text style={styles.priceBadgeText}>{p.priceLabel}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <TouchableOpacity style={styles.footerRow} onPress={() => onOpenShop?.(item)}>
          <Text style={[styles.footerLabel, { color: t.primaryText }]}>
            Explore shop
          </Text>
          <View
            style={[styles.arrowCta, { backgroundColor: t.footerCta }]}
            activeOpacity={0.85}
            onPress={() => onOpenShop?.(item)}
          >
            <Icon name="arrow-forward" size={22} color={isDark ? "#fff" : "#000000"} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * @param {{
 *   visible: boolean;
 *   vendors: { id: number; state?: string | null }[];
 *   locationFilter: string | null;
 *   onSelectLocation: (stateName: string | null) => void;
 *   onClose: () => void;
 * }} props
 */
function VendorLocationSheet({
  visible,
  vendors,
  locationFilter,
  onSelectLocation,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
    }
  }, [visible]);

  const rows = useMemo(() => buildLocationRows(vendors), [vendors]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const label =
        r.name == null ? 'all locations' : `${r.name}`.toLowerCase();
      return label.includes(q) || String(r.count).includes(q);
    });
  }, [rows, searchQuery]);

  const listMaxH = Math.min(WINDOW_H * 0.52, 420);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.filterModalRoot}>
        <TouchableOpacity
          style={styles.filterBackdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss location picker"
        />
        <View style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <View style={styles.locationSheetHeader}>
            <Text style={styles.locationSheetTitle}>Select location</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.locationCloseHit}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={26} color="#000000" />
            </TouchableOpacity>
          </View>

          <View style={styles.locationSearchOuter}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search and select location"
              placeholderTextColor="#9AA0A6"
              style={styles.locationSearchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <Icon
              name="chevron-down"
              size={20}
              color="#000000"
              style={styles.locationSearchChevron}
            />
          </View>

          <FlatList
            data={filteredRows}
            keyExtractor={item => item.key}
            style={[styles.locationList, { maxHeight: listMaxH }]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={styles.locationRowSep} />
            )}
            renderItem={({ item }) => {
              const selected =
                (item.name == null && locationFilter == null) ||
                (item.name != null && item.name === locationFilter);
              const label = item.name == null ? 'All locations' : item.name;
              return (
                <TouchableOpacity
                  style={[
                    styles.locationRow,
                    selected && styles.locationRowSelected,
                  ]}
                  onPress={() => onSelectLocation(item.name)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.locationRowText,
                      selected && styles.locationRowTextSelected,
                    ]}
                  >
                    {label} ({item.count})
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}



/**
 * @param {{ route: import('@react-navigation/native').RouteProp<Record<string, object | undefined>, 'vendors'>; navigation: import('@react-navigation/native').NativeStackNavigationProp<Record<string, object | undefined>, 'vendors'> }} props
 */
export default function VendorScreen({ route, navigation }) {
  const routeCategory = String(route.params?.category ?? '').trim().toLowerCase();
  const categoryRows = useSelector(selectCategoryRows);
  const categories = useSelector(selectCategoryKeys);
  const categoriesLoading = useSelector(selectCategoriesLoading);
  const categoriesError = useSelector(selectCategoriesError) ?? '';
  const visibleCategories = useMemo(
    () =>
      categoryRows
        .filter(row => Number(row?.existingProductCount ?? 0) > 0)
        .map(row => String(row?.category ?? '').trim().toLowerCase())
        .filter(Boolean),
    [categoryRows],
  );
  const [selectedCategory, setSelectedCategory] = useState(routeCategory);
  const category = selectedCategory;
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  /** Vendor row opened in the ⋮ menu, or `null` when closed. */
  const [menuVendor, setMenuVendor] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  /** `null` = all states. */
  const [locationFilter, setLocationFilter] = useState(
    /** @type {string | null} */ (null),
  );
  /** @type {Record<string, { loading: boolean; items: { key: string; uri: string; priceLabel: string }[] }>} */
  const [slugPreviews, setSlugPreviews] = useState({});
  const [vendorPolicyModalVisible, setVendorPolicyModalVisible] =
    useState(false);
  const [vendorPolicyLoading, setVendorPolicyLoading] = useState(false);
  const [vendorPolicyTitle, setVendorPolicyTitle] = useState('');
  const [vendorPolicyClauses, setVendorPolicyClauses] = useState(
    /** @type {{ title: string; content: string }[]} */ ([]),
  );
  const [vendorPolicyEmptyMessage, setVendorPolicyEmptyMessage] = useState('');
  const [vendorDeliveryLocations, setVendorDeliveryLocations] = useState(
    /** @type {{ name: string; fee?: number }[]} */ ([]),
  );
  const [vendorDeliveryMethod, setVendorDeliveryMethod] = useState(
    /** @type {{ title?: string; description?: string } | undefined} */ (undefined),
  );

  useEffect(() => {
    if (!visibleCategories.length) {
      setSelectedCategory('');
      return;
    }

    setSelectedCategory((current) => {
      const currentKey = String(current ?? '').trim().toLowerCase();
      if (currentKey) {
        const existing = visibleCategories.find((option) => option === currentKey);
        if (existing) return existing;
      }

      const routeMatch = visibleCategories.find((option) => option === routeCategory);
      return routeMatch ?? visibleCategories[0];
    });
  }, [routeCategory, visibleCategories]);

  useEffect(() => {
    if (!category) {
      setLoading(false);
      setVendors([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getVendorsOnMapByCategory(category);
        if (!cancelled) {
          setVendors(rows);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setVendors([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  useEffect(() => {
    const slugs = [
      ...new Set(
        vendors.map(v => String(v?.slug ?? '').trim()).filter(Boolean),
      ),
    ];
    if (!slugs.length) {
      setSlugPreviews({});
      return;
    }
    let cancelled = false;
    const next = {};
    for (const s of slugs) {
      next[s] = { loading: true, items: [] };
    }
    setSlugPreviews(next);
    const CONC = 5;
    (async () => {
      for (let i = 0; i < slugs.length; i += CONC) {
        if (cancelled) return;
        const chunk = slugs.slice(i, i + CONC);
        await Promise.all(
          chunk.map(async slug => {
            try {
              const { products } = await getStorefrontProducts(slug);
              if (cancelled) return;
              const list = Array.isArray(products) ? products : [];
              const items = list.slice(0, 8).map((p, idx) => {
                const id = String(p?.id ?? idx);
                const uri = getProductImageUri(p) || '';
                const minPrice = Number(p?.minPrice) || 0;
                const maxPrice = Number(p?.maxPrice) || minPrice;
                const hasVariants = Boolean(p?.hasVariants);
                const title =
                  String(p?.name ?? p?.title ?? 'Product').trim() || 'Product';
                const priceLabel =
                  hasVariants && minPrice !== maxPrice
                    ? `${formatNaira(minPrice)} – ${formatNaira(maxPrice)}`
                    : formatNaira(minPrice);
                return {
                  key: id,
                  uri,
                  priceLabel,
                  title,
                  priceUsd: minPrice,
                  currency: String(p?.currency ?? 'NGN'),
                  gender: p?.gender == null ? undefined : String(p.gender),
                  subCategory:
                    p?.subCategory == null && p?.subcategory == null
                      ? undefined
                      : String(p?.subCategory ?? p?.subcategory),
                  type: p?.type == null ? undefined : String(p.type),
                };
              });
              setSlugPreviews(prev => ({
                ...prev,
                [slug]: { loading: false, items },
              }));
            } catch {
              if (!cancelled) {
                setSlugPreviews(prev => ({
                  ...prev,
                  [slug]: { loading: false, items: [] },
                }));
              }
            }
          }),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendors]);

  useEffect(() => {
    setLocationFilter(null);
  }, [category]);

  useEffect(() => {
    if (route.params?.openVendorFilter != null) {
      setFilterVisible(true);
      navigation.setParams({ openVendorFilter: undefined });
    }
  }, [route.params?.openVendorFilter, navigation]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setFilterVisible(false);
        setMenuVendor(null);
        setVendorPolicyModalVisible(false);
        setVendorPolicyLoading(false);
      };
    }, []),
  );

  const closeVendorMenu = useCallback(() => setMenuVendor(null), []);

  const openVendorShopPolicy = useCallback(async () => {
    const v = menuVendor;
    if (!v || typeof v !== 'object') return;
    const row = /** @type {Record<string, unknown>} */ (v);
    const slug = String(row.slug ?? '').trim();
    const shopLabel = String(row.name ?? 'Shop').trim() || 'Shop';
    closeVendorMenu();
    if (!slug) {
      Alert.alert('Shopiva', 'This shop cannot load policies (missing link).');
      return;
    }
    setVendorPolicyTitle(`${shopLabel} — Shop policies`);
    setVendorPolicyClauses([]);
    setVendorDeliveryLocations([]);
    setVendorDeliveryMethod(undefined);
    setVendorPolicyEmptyMessage('');
    setVendorPolicyLoading(true);
    setVendorPolicyModalVisible(true);
    try {
      const res = await getStorefrontShop(slug);
      const sp = res.shopPolicies;
      const sections = extractCustomerPolicySections(
        sp && typeof sp === 'object'
          ? /** @type {Record<string, unknown>} */ (sp)
          : null,
      );
      const clauses = [
        ...sections.delivery,
        ...sections.refund,
        ...sections.custom,
      ];
      setVendorPolicyClauses(clauses);
      setVendorPolicyEmptyMessage(
        clauses.length
          ? ''
          : 'This shop has not published shop policies on Shopiva yet.',
      );
    } catch (e) {
      setVendorPolicyClauses([]);
      setVendorPolicyEmptyMessage(
        e instanceof Error ? e.message : 'Could not load shop policies.',
      );
    } finally {
      setVendorPolicyLoading(false);
    }
  }, [menuVendor, closeVendorMenu]);

  const openVendorDeliveryPolicy = useCallback(async () => {
    const v = menuVendor;
    if (!v || typeof v !== 'object') return;
    const row = /** @type {Record<string, unknown>} */ (v);
    const shopId = parseShopId(row.id ?? row.shop_id ?? row.shopId);
    const shopLabel = String(row.name ?? 'Shop').trim() || 'Shop';
    closeVendorMenu();
    if (!shopId) {
      Alert.alert('Shopiva', 'This shop cannot load delivery details (missing id).');
      return;
    }
    setVendorPolicyTitle('Delivery details');
    setVendorPolicyClauses([]);
    setVendorDeliveryLocations([]);
    setVendorDeliveryMethod(undefined);
    setVendorPolicyEmptyMessage('');
    setVendorPolicyLoading(true);
    setVendorPolicyModalVisible(true);
    try {
      const raw = await getStorefrontShopDelivery(shopId);
      const delivery = normalizeShopDelivery(raw);
      setVendorDeliveryLocations(delivery?.locations || []);
      setVendorDeliveryMethod(delivery?.method);
      setVendorPolicyEmptyMessage(
        delivery?.locations?.length
          ? ''
          : `${shopLabel} has not set delivery locations on Shopiva yet.`,
      );
    } catch (e) {
      setVendorDeliveryLocations([]);
      setVendorPolicyEmptyMessage(
        e instanceof Error
          ? e.message
          : 'Could not load delivery details.',
      );
    } finally {
      setVendorPolicyLoading(false);
    }
  }, [menuVendor, closeVendorMenu]);

  const menuSlug = menuVendor ? String(menuVendor.slug ?? '').trim() : '';
  const menuHeaderImage =
    menuSlug && slugPreviews[menuSlug]?.items?.[0]?.uri
      ? String(slugPreviews[menuSlug].items[0].uri)
      : '';

  const menuSheetTitle = useMemo(() => {
    if (!menuVendor) return '';
    return String(menuVendor.name ?? 'Shop').trim() || 'Shop';
  }, [menuVendor]);

  const menuSheetSubtitle = useMemo(() => {
    if (!menuVendor) return '';
    const stats = vendorReviewStats(menuVendor);
    if (stats) {
      return `${stats.rating.toFixed(1)} ★${stats.count > 0 ? ` (${formatCompactCount(stats.count)})` : ''}`;
    }
    return vendorLocationLine(menuVendor) || '';
  }, [menuVendor]);

  const renderVendorCard = useCallback(
    ({ item, index }) => (
      <VendorCard
        item={item}
        index={index}
        category={category}
        preview={slugPreviews[String(item.slug ?? '').trim()]}
        onOpenShop={shop =>
          navigation.navigate('Vendor', { vendor: shop, category })
        }
        onPressMenu={row =>
          setMenuVendor(/** @type {Record<string, unknown>} */ (row))
        }
      />
    ),
    [navigation, category, slugPreviews],
  );

  const vendorMenuSheet = (
    <ShopOverflowMenu
      visible={menuVendor != null}
      onClose={closeVendorMenu}
      title={menuSheetTitle}
      subtitle={menuSheetSubtitle}
      headerImageUri={menuHeaderImage}
      fallbackLetter={menuSheetTitle ? menuSheetTitle.charAt(0) : 'S'}
      onVisitShop={() => {
        closeVendorMenu();
        if (menuVendor) {
          navigation.navigate('Vendor', { vendor: menuVendor, category });
        }
      }}
      onFollow={() => {
        closeVendorMenu();
        Alert.alert(
          'Shopiva',
          'Following shops will be available in a future update.',
        );
      }}
      // onNotInterested={() => {
      //   closeVendorMenu();
      //   Alert.alert('Thanks', 'We will tune your recommendations over time.');
      // }}
      // onReport={() => {
      //   closeVendorMenu();
      //   Alert.alert('Report shop', 'Thanks for the report. Our team will review it.');
      // }}
      onViewShopPolicy={openVendorShopPolicy}
      onDeliveryPolicy={openVendorDeliveryPolicy}
    />
  );

  const vendorPolicySheet = (
    <ShopPolicyViewerModal
      visible={vendorPolicyModalVisible}
      loading={vendorPolicyLoading}
      onClose={() => {
        setVendorPolicyModalVisible(false);
        setVendorPolicyLoading(false);
      }}
      title={vendorPolicyTitle}
      clauses={vendorPolicyClauses}
      locations={vendorDeliveryLocations}
      deliveryMethod={vendorDeliveryMethod}
      emptyMessage={vendorPolicyEmptyMessage}
    />
  );

  const closeFilter = useCallback(() => {
    setFilterVisible(false);
  }, []);

  const displayedVendors = useMemo(() => {
    if (locationFilter == null) return vendors;
    return vendors.filter(
      v => normalizeVendorState(v.state) === locationFilter,
    );
  }, [vendors, locationFilter]);

  const handleSelectLocation = useCallback(stateName => {
    setLocationFilter(stateName);
    setFilterVisible(false);
  }, []);

  const categorySlider = (
    <View style={styles.categorySliderSection}>
      <FlatList
        horizontal
        data={visibleCategories}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categorySliderContent}
        renderItem={({ item }) => {
          const selected = item === selectedCategory;
          return (
            <TouchableOpacity
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              onPress={() => setSelectedCategory(item)}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${formatCategoryLabel(item)} shops`}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>
                {formatCategoryLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  const filterSheet = (
    <VendorLocationSheet
      visible={filterVisible}
      vendors={vendors}
      locationFilter={locationFilter}
      onSelectLocation={handleSelectLocation}
      onClose={closeFilter}
    />
  );

  if (loading) {
    return (
      <View style={styles.flexFill}>
        {categorySlider}
        {categoriesError ? <Text style={styles.error}>{categoriesError}</Text> : null}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00926e" />
          <Text style={styles.muted}>Loading vendors…</Text>
        </View>
        {filterSheet}
        {vendorMenuSheet}
        {vendorPolicySheet}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.flexFill}>
        {categorySlider}
        {categoriesError ? <Text style={styles.error}>{categoriesError}</Text> : null}
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
        {filterSheet}
        {vendorMenuSheet}
        {vendorPolicySheet}
      </View>
    );
  }

  return (
    <View style={styles.flexFill}>
      {categorySlider}
      {categoriesLoading ? <ActivityIndicator color="#00926e" /> : null}
      {categoriesError ? <Text style={styles.error}>{categoriesError}</Text> : null}
      <View style={styles.screen}>
        <FlatList
          data={displayedVendors}
          keyExtractor={item => String(item.id)}
          renderItem={renderVendorCard}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListEmptyComponent={
            <Text style={styles.muted}>
              {locationFilter
                ? `No vendors in ${locationFilter} for this category.`
                : 'No vendors found for this category.'}
            </Text>
          }
        />
      </View>
      {filterSheet}
      {vendorMenuSheet}
      {vendorPolicySheet}
    </View>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#EFEFEF',
    paddingTop: 20,
  },
  categorySliderSection: {
    backgroundColor: '#EFEFEF',
    paddingTop: 8,
    paddingBottom: 8,
  },
  categorySliderTitle: {
    color: '#202124',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 10,
  },
  categorySliderContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E3E6',
  },
  categoryChipSelected: {
    backgroundColor: '#00926E',
    borderColor: '#00926E',
  },
  categoryChipText: {
    color: '#3F4348',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  categoryHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#EFEFEF',
  },
  card: {
    overflow: 'hidden',
  },
  cardInner: {
    padding: CARD_PAD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  vendorName: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  inlineRatingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  inlineRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    flexWrap: 'nowrap',
    marginTop: 2,
    minWidth: 0,
  },
  locationIconWrap: {
    width: 18,
    height: 18,
    marginRight: 4,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontSize: 13,
    lineHeight: 20,
    minWidth: 0,
    paddingTop: Platform.OS === 'ios' ? 1 : 0,
  },
  carouselLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  carouselEmpty: {
    fontSize: 13,
    paddingVertical: 20,
    paddingHorizontal: 4,
  },
  iconHit: {
    padding: 4,
  },
  carouselPad: {
    paddingBottom: 4,
  },
  productCell: {
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: PRODUCT_GAP,
    aspectRatio: 1,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  /* MVP: wishlist overlay on carousel tile — disabled (see commented TouchableOpacity above)
  heartBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerLabel: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  arrowCta: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    maxHeight: Math.round(WINDOW_H * 0.88),
  },
  filterHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 10,
    backgroundColor: '#D8D8D8',
    marginBottom: 12,
  },
  locationSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  locationSheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  locationCloseHit: {
    padding: 4,
  },
  locationSearchOuter: {
    borderWidth: 1,
    borderColor: '#1A73E8',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 10,
    marginBottom: 12,
    minHeight: 46,
    backgroundColor: '#FFFFFF',
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingVertical: 10,
    paddingRight: 8,
  },
  locationSearchChevron: {
    marginLeft: 4,
  },
  locationList: {
    marginTop: 4,
  },
  locationRow: {
    paddingVertical: 7,
    paddingHorizontal: 0,
    borderRadius: 10,
  },
  locationRowSelected: {
    backgroundColor: '#E8F0FE',
  },
  locationRowText: {
    fontSize: 16,
    color: '#202124',
  },
  locationRowTextSelected: {
    fontWeight: '600',
    color: '#174EA6',
  },
  locationRowSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E8EAED',
    marginLeft: 12,
  },
});
