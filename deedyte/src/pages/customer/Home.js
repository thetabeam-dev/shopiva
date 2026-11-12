import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { getStorefrontHomeProducts, getStorefrontProduct } from '../../api';
import { addBuyerCartLine, deleteBuyerCartLine, fetchBuyerCart, fetchRecentlyViewedProducts } from '../../api/buyer';
import { fetchWallet } from '../../api/user';
import { connectChatSocket } from '../../socket/chatSocket';
import { useProfile } from '../../context/ProfileContext';
import { NotificationBell } from '../../components/NotificationBell';
import { selectCategoryRows } from '../../../redux/categoriesSlice';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';
import { ProductCardMedia } from '../../components/ProductCardMedia';

function categoryKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shopRating(shop) {
  const rating = Number(shop?.ratingAverage ?? shop?.average_rating ?? shop?.averageRating ?? 0);
  const count = Number(shop?.reviewCount ?? shop?.review_count ?? 0);
  return {
    rating: Number.isFinite(rating) && rating > 0 ? rating : 0,
    count: Number.isFinite(count) && count > 0 ? Math.round(count) : 0,
  };
}

function formatSoldLabel(sold) {
  const n = Number(sold) || 0;
  if (n >= 10000) return `${Math.round(n / 1000)}K+ sold`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K+ sold`;
  if (n > 0) return `${n} sold`;
  return '';
}

function formatCategoryLabel(category) {
  return String(category ?? '')
    .split(' ')
    .map(word => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');
}

const BANNER_W = Dimensions.get('window').width - 32;
const PAGE_SIZE = 40;

function mapHomeProduct(product) {
  const price = Number(product.minPrice ?? product.price) || 0;
  const compare = Number(
    product.compareAtPrice ?? product.compare_at_price ?? product.maxPrice,
  ) || 0;
  const shop =
    product?.shop && typeof product.shop === 'object' && !Array.isArray(product.shop)
      ? product.shop
      : {};
  return {
    id: String(product.id),
    title: String(product.name ?? 'Product'),
    uri: getProductImageUri(product),
    price,
    comparePrice: compare > price ? compare : 0,
    sold: Number(product.sold ?? product.soldCount ?? 0) || 0,
    category: String(product?.category ?? '').trim().toLowerCase(),
    hasVariants: Boolean(product?.hasVariants),
    featured: Boolean(product.is_featured ?? product.isFeatured ?? product.featured),
    shop,
    product,
  };
}

const BANNERS = [
  {
    id: 'nearby',
    kicker: 'Near you',
    title: 'Shops close to your location',
    body: 'Open Explore to see vendors around you.',
    icon: 'location',
  },
  {
    id: 'shipping',
    kicker: 'Delivery',
    title: 'See the shipping fee first',
    body: 'Every shop here can estimate delivery before you pay.',
    icon: 'cube',
  },
  {
    id: 'escrow',
    kicker: 'Protected',
    title: 'Your payment stays in escrow',
    body: 'Funds are held until the order is on its way.',
    icon: 'shield-checkmark',
  },
];

function locationLabel(user) {
  const loc = user?.location;
  if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
    const state = String(loc.state ?? '').trim();
    if (state) return state;
  }
  const display = String(user?.locationDisplay ?? (typeof loc === 'string' ? loc : '')).trim();
  if (display) {
    const parts = display.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[1];
    if (parts.length === 1) return parts[0];
  }
  return 'Nigeria';
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const categoryRows = useSelector(selectCategoryRows);
  const [arrivals, setArrivals] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [wallet, setWallet] = useState(null);
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [cartBusyId, setCartBusyId] = useState('');
  const [cartLinesByProduct, setCartLinesByProduct] = useState(() => new Map());
  const [variantSheet, setVariantSheet] = useState(
    /** @type {null | { item: Record<string, unknown>; variants: Record<string, unknown>[]; selected: number | null }} */ (null),
  );
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const categories = useMemo(() => {
    const seen = new Set();
    const names = [];
    arrivals.forEach(item => {
      const label = String(item?.category ?? '').trim().toLowerCase();
      const key = categoryKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const row = categoryRows.find(entry => categoryKey(entry?.category) === key);
      names.push(String(row?.category ?? label).trim().toLowerCase());
    });
    return names;
  }, [arrivals, categoryRows]);

  useEffect(() => {
    if (selectedCategory === 'all') return;
    const wanted = categoryKey(selectedCategory);
    const stillListed = categories.some(item => categoryKey(item) === wanted);
    if (!stillListed) setSelectedCategory('all');
  }, [categories, selectedCategory]);

  const loadArrivals = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getStorefrontHomeProducts({ limit: PAGE_SIZE, offset: 0 });
      const products = Array.isArray(data?.products) ? data.products : [];
      setArrivals(products.map(mapHomeProduct));
      setHasMore(Boolean(data?.hasMore));
      setNextOffset(
        Number.isFinite(Number(data?.nextOffset)) ? Number(data.nextOffset) : products.length,
      );
    } catch {
      if (!refresh) {
        setArrivals([]);
        setHasMore(false);
        setNextOffset(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMoreArrivals = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await getStorefrontHomeProducts({ limit: PAGE_SIZE, offset: nextOffset });
      const products = Array.isArray(data?.products) ? data.products : [];
      setArrivals(prev => {
        const seen = new Set(prev.map(item => String(item.id)));
        return [
          ...prev,
          ...products.map(mapHomeProduct).filter(item => !seen.has(String(item.id))),
        ];
      });
      setHasMore(Boolean(data?.hasMore));
      setNextOffset(
        Number.isFinite(Number(data?.nextOffset))
          ? Number(data.nextOffset)
          : nextOffset + products.length,
      );
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextOffset]);

  useEffect(() => {
    loadArrivals().catch(() => {});
  }, [loadArrivals]);

  const loadWallet = useCallback(() => {
    if (!user?.id) {
      setWallet(null);
      return Promise.resolve();
    }
    setWalletRefreshing(true);
    return fetchWallet()
      .then(setWallet)
      .catch(() => setWallet(null))
      .finally(() => setWalletRefreshing(false));
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadWallet();
    }, [loadWallet]),
  );

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    let socket = null;
    const onWalletCredited = (payload) => {
      const kobo = Number(payload?.balance_kobo);
      if (!Number.isFinite(kobo)) return;
      setWallet(current => ({ ...(current ?? {}), balance_kobo: kobo }));
    };
    void connectChatSocket().then((next) => {
      if (!alive || !next) return;
      socket = next;
      next.on('wallet_credited', onWalletCredited);
    });
    return () => {
      alive = false;
      socket?.off('wallet_credited', onWalletCredited);
    };
  }, [user?.id]);

  const walletKobo = Number(wallet?.balance_kobo);
  const walletBalance = Number.isFinite(walletKobo) ? walletKobo / 100 : 0;
  const walletAddress = String(wallet?.address ?? '').trim();

  const visibleArrivals = useMemo(() => {
    if (selectedCategory === 'all') return arrivals;
    return arrivals.filter(item => categoryKey(item.category) === categoryKey(selectedCategory));
  }, [arrivals, selectedCategory]);
  const visibleRecentlyViewed = useMemo(() => {
    if (selectedCategory === 'all') return recentlyViewed;
    return recentlyViewed.filter(item => categoryKey(item.category) === categoryKey(selectedCategory));
  }, [recentlyViewed, selectedCategory]);

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

  const loadRecentlyViewed = useCallback(async () => {
    if (!user?.id) {
      setRecentlyViewed([]);
      return;
    }
    try {
      const productRows = await fetchRecentlyViewedProducts();
      setRecentlyViewed(
        productRows.map(product => {
          const shop = product?.shop && typeof product.shop === 'object' ? product.shop : {};
          return {
            id: String(product.id),
            title: String(product.name ?? 'Product'),
            uri: getProductImageUri(product) || String(product.thumbnail ?? ''),
            price: Number(product.minPrice ?? product.price) || 0,
            comparePrice: Number(product.maxPrice) || 0,
            category: String(product?.category ?? '').trim().toLowerCase(),
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
        }),
      );
    } catch {
      setRecentlyViewed([]);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      // void loadCartProducts();
      void loadRecentlyViewed();
    }, [loadRecentlyViewed]),
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
      <View style={[styles.header, { paddingTop: Platform.OS === "ios" ? 10 : 40 }]}>
        <View style={styles.identity}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Icon name="person" size={22} color="#00926E" />
            </View>
          )}
          <View style={styles.identityText}>
            <Text style={styles.name} numberOfLines={1}>{user?.displayName || 'Guest'}</Text>
            <Text style={styles.place} numberOfLines={1} ellipsizeMode="tail">{locationLabel(user)}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => navigation.navigate('ProductSearch')}
            accessibilityRole="button"
            accessibilityLabel="Search products"
          >
            <Icon name="search-outline" size={22} color="#111111" />
          </TouchableOpacity>
          <NotificationBell
            onPress={() => navigation.navigate('Notifications')}
            style={styles.bell}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chips}
      >
        {['all', ...categories].map(item => {
          const selected = item === selectedCategory;
          return (
            <TouchableOpacity
              key={item}
              style={styles.chip}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item === 'all' ? 'All' : formatCategoryLabel(item)}
              </Text>
              {selected ? <View style={styles.chipUnderline} /> : <View style={styles.chipUnderlineSpacer} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadArrivals({ refresh: true }).catch(() => {});
            }}
            tintColor="#00926E"
            colors={['#00926E']}
          />
        }
      >
      {user?.id ? (
        <View style={styles.walletCard}>
          <View style={styles.walletTop}>
            <Text style={styles.walletLabel}>Available balance</Text>
            <TouchableOpacity
              onPress={() => { void loadWallet(); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Refresh wallet"
            >
              {walletRefreshing ? (
                <ActivityIndicator color="#00926E" size="small" />
              ) : (
                <Icon name="refresh" size={22} color="#00926E" />
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.walletBalanceRow}>
            <Text style={styles.walletValue}>{formatNaira(wallet ? walletBalance : 0)}</Text>
            <TouchableOpacity
              style={styles.walletAddress}
              onPress={() => {
                if (!walletAddress) return;
                Clipboard.setString(walletAddress);
                Alert.alert('Copied', 'Address copied to clipboard.');
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy wallet address"
            >
              <Text style={styles.walletAddressText} numberOfLines={1}>
                Address {walletAddress || 'Not available'}
              </Text>
              <Icon name="copy-outline" size={16} color="#00926E" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.bannerBlock}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={BANNER_W + 10}
          decelerationRate="fast"
          contentContainerStyle={styles.bannerRow}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / (BANNER_W + 10));
            setBannerIndex(Math.max(0, Math.min(BANNERS.length - 1, index)));
          }}
        >
          {BANNERS.map((banner) => (
            <View key={banner.id} style={styles.banner}>
              <View style={styles.bannerWash} />
              <View style={styles.bannerOrb} />
              <View style={styles.bannerOrbSmall} />
              <View style={styles.bannerCopy}>
                <View style={styles.bannerKickerPill}>
                  <Text style={styles.bannerKicker}>{banner.kicker}</Text>
                </View>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.bannerBody}>{banner.body}</Text>
              </View>
              <View style={styles.bannerIconWrap}>
                <Icon name={banner.icon} size={28} color="#FFFFFF" />
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.bannerDots}>
          {BANNERS.map((banner, index) => (
            <View
              key={banner.id}
              style={[styles.bannerDot, index === bannerIndex && styles.bannerDotOn]}
            />
          ))}
        </View>
      </View>

      {visibleRecentlyViewed.length ? (
        <View style={styles.recentBlock}>
          <View style={styles.recentHead}>
            <Text style={styles.recentTitle}>Recently viewed</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('RecentlyViewedProducts')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="See all recently viewed products"
            >
              <Icon name="chevron-forward" size={22} color="#111111" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {visibleRecentlyViewed.map(item => (
              <TouchableOpacity
                key={`recent-${item.shop?.id}-${item.id}`}
                style={styles.recentCard}
                activeOpacity={0.9}
                onPress={() => openProduct(item)}
              >
                <ProductCardMedia uri={item.uri} style={styles.recentImage} />
                <Text style={styles.recentName} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.recentPrice}>{formatNaira(item.price)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={styles.card}>
              <View style={[styles.cardImage, styles.bone]} />
              <View style={styles.cardBody}>
                <View style={[styles.boneLine, { width: '92%' }]} />
                <View style={[styles.boneLine, { width: '64%', marginTop: 6 }]} />
                <View style={[styles.boneLine, { width: '48%', marginTop: 8, height: 12 }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {visibleArrivals.map(item => {
            const showCompare = item.comparePrice > item.price && item.price > 0;
            const { rating, count } = shopRating(item.shop);
            const soldLabel = formatSoldLabel(item.sold) || (count > 0 ? `${count} sold` : '');
            const official = Boolean(
              item.shop?.isVerified ?? item.shop?.is_verified ?? item.shop?.isverified,
            );
            const shopLabel = String(item.shop?.name ?? '').trim();
            const showTopRated = item.featured || rating >= 4.5;
            return (
              <TouchableOpacity
                key={`${item.shop?.id}-${item.id}`}
                style={styles.card}
                activeOpacity={0.92}
                onPress={() => openProduct(item)}
              >
                <ProductCardMedia uri={item.uri} style={styles.cardImage} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {showTopRated ? (
                    <Text style={styles.cardPromo} numberOfLines={1}>
                      {`Top Rated${item.category ? ` in ${formatCategoryLabel(item.category)}` : ''}`}
                    </Text>
                  ) : null}
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Icon
                        key={star}
                        name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'}
                        size={11}
                        color={rating > 0 ? '#F5A623' : '#D8D8D8'}
                      />
                    ))}
                    {soldLabel ? <Text style={styles.ratingText}>{soldLabel}</Text> : null}
                  </View>
                  {official && shopLabel ? (
                    <View style={styles.brandRow}>
                      <Icon name="shield-checkmark" size={12} color="#8B6914" />
                      <Text style={styles.brandText} numberOfLines={1}>
                        {`Brand Official Store: ${shopLabel}`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.priceRow}>
                    <View style={styles.priceCopy}>
                      {showCompare ? <Text style={styles.lastDay}>Last day</Text> : null}
                      <Text style={styles.cardPrice}>{formatNaira(item.price)}</Text>
                      {showCompare ? (
                        <Text style={styles.comparePrice}>{formatNaira(item.comparePrice)}</Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {!loading && visibleArrivals.length === 0 ? (
        <Text style={styles.empty}>
          {selectedCategory === 'all'
            ? 'No products yet. Explore shops to see what is in stock.'
            : `No products in ${formatCategoryLabel(selectedCategory)}.`}
        </Text>
      ) : null}
      {hasMore ? (
        <View style={styles.loadMoreWrap}>
          <TouchableOpacity
            style={[styles.loadMoreBtn, loadingMore && styles.loadMoreBtnOff]}
            activeOpacity={0.85}
            disabled={loadingMore}
            onPress={() => {
              void loadMoreArrivals();
            }}
            accessibilityRole="button"
            accessibilityLabel="Load more"
          >
            {loadingMore ? (
              <ActivityIndicator color="#00926E" />
            ) : (
              <Text style={styles.loadMoreText}>Load more</Text>
            )}
          </TouchableOpacity>
        </View>
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
  screen: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 16, minWidth: 0 },
  identityText: { flex: 1, minWidth: 0, maxWidth: '72%' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F2' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: '#111111' },
  place: { marginTop: 2, fontSize: 14, color: '#8A8A8A' },
  searchRow: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F4F4',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchActions: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingVertical: 0,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortMenu: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    overflow: 'hidden',
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sortItemOn: { backgroundColor: '#F3F8F6' },
  sortItemText: { fontSize: 15, color: '#111111' },
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#111111' },
  clearText: { fontSize: 15, fontWeight: '700', color: '#00926E' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },
  sectionHint: { marginTop: 2, marginBottom: 10, fontSize: 13, color: '#8A8A8A' },
  sheetOption: {
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sheetOptionOn: { backgroundColor: '#00926E' },
  sheetOptionText: { fontSize: 15, fontWeight: '600', color: '#333333' },
  sheetOptionTextOn: { color: '#FFFFFF' },
  priceInputs: { flexDirection: 'row', gap: 10 },
  priceInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111111',
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
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellActive: { backgroundColor: '#00926E' },
  chipRow: { height: 48, flexGrow: 0, backgroundColor: '#FFFFFF' },
  chips: { paddingHorizontal: 16, alignItems: 'flex-end', gap: 18 },
  chip: { alignItems: 'center', paddingBottom: 6 },
  chipText: { fontSize: 16, color: '#8A8A8A' },
  chipTextSelected: { color: '#111111', fontWeight: '700' },
  chipUnderline: {
    marginTop: 6,
    height: 2,
    width: '100%',
    backgroundColor: '#111111',
    borderRadius: 1,
  },
  chipUnderlineSpacer: { marginTop: 6, height: 2 },
  walletCard: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#F7F7F7',
    borderRadius: 7,
    padding: 18,
  },
  walletTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletLabel: { color: '#6B7280', fontSize: 13 },
  walletBalanceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  walletValue: { color: '#111111', fontSize: 32, fontWeight: '800', flexShrink: 0 },
  walletAddress: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '52%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  walletAddressText: { color: '#111111', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  bannerBlock: { marginTop: 12 },
  bannerRow: { paddingHorizontal: 16, gap: 10 },
  banner: {
    width: BANNER_W,
    minHeight: 148,
    borderRadius: 7,
    backgroundColor: '#00926E',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerWash: {
    position: 'absolute',
    left: -30,
    bottom: -46,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bannerOrb: {
    position: 'absolute',
    right: -28,
    top: -36,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bannerOrbSmall: {
    position: 'absolute',
    right: 54,
    bottom: -22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bannerCopy: { flex: 1, paddingRight: 12 },
  bannerKickerPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bannerKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  bannerTitle: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerBody: { marginTop: 6, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.88)' },
  bannerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDots: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D5D5D5' },
  bannerDotOn: { width: 16, backgroundColor: '#00926E' },
  recentBlock: {
    paddingTop: 4,
    marginBottom: 24,
  },
  recentHead: {
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },
  recentRow: {
    paddingHorizontal: 12,
    gap: 10,
  },
  recentCard: {
    width: 132,
    overflow: 'hidden',
  },
  recentImage: {
    width: 132,
    height: 132,
    borderRadius: 7,
    backgroundColor: '#F3F3F3',
  },
  recentName: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 17,
    color: '#222222',
    minHeight: 34,
  },
  recentPrice: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  grid: {
    paddingHorizontal: 2,
    paddingTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bone: { backgroundColor: '#ECECEC' },
  boneLine: { height: 14, borderRadius: 6, backgroundColor: '#ECECEC' },
  boneCart: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ECECEC' },
  list: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  listCard: {
    width: '100%',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 7,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listImage: {
    width: 92,
    height: 92,
    borderRadius: 7,
    backgroundColor: '#F3F3F3',
  },
  listBody: { flex: 1, minWidth: 0 },
  card: {
    width: '49.3%',
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 7,
    backgroundColor: '#F3F3F3',
  },
  cardBody: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    lineHeight: 17,
    color: '#1A1A1A',
    minHeight: 34,
  },
  cardPromo: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#E85D04',
  },
  ratingRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: { marginLeft: 4, fontSize: 11, color: '#6B6B6B' },
  brandRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandText: {
    flex: 1,
    fontSize: 11,
    color: '#6B6B6B',
  },
  priceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceCopy: { flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 5 },
  lastDay: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F56200',
  },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#111111' },
  comparePrice: {
    fontSize: 12,
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
  loadMoreWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 12,
  },
  loadMoreBtn: {
    minWidth: 160,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#00926E',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtnOff: { opacity: 0.65 },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00926E',
  },
});
