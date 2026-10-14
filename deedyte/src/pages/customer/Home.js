import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { getStorefrontProducts, getVendorsOnMapByCategory } from '../../api';
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

function formatCategoryLabel(category) {
  return String(category ?? '')
    .split(' ')
    .map(word => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');
}

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

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
      const shops = await getVendorsOnMapByCategory('');
      const withSlug = shops.filter(shop => String(shop?.slug ?? '').trim());
      const collected = [];
      const batchSize = 5;
      for (let i = 0; i < withSlug.length && collected.length < 200; i += batchSize) {
        const chunk = withSlug.slice(i, i + batchSize);
        const lists = await Promise.all(
          chunk.map(async shop => {
            try {
              const data = await getStorefrontProducts(shop.slug);
              const products = Array.isArray(data?.products) ? data.products : [];
              return products.map(product => ({
                id: String(product.id),
                title: String(product.name ?? 'Product'),
                uri: getProductImageUri(product),
                price: Number(product.minPrice ?? product.price) || 0,
                comparePrice: Number(product.maxPrice) || 0,
                category: String(product?.category ?? '').trim().toLowerCase(),
                shop,
                product,
              }));
            } catch {
              return [];
            }
          }),
        );
        collected.push(...lists.flat());
      }
      setArrivals(collected);
    } catch {
      if (!refresh) setArrivals([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadArrivals().catch(() => {});
  }, [loadArrivals]);

  const visibleArrivals = useMemo(() => {
    if (selectedCategory === 'all') return arrivals;
    const wanted = categoryKey(selectedCategory);
    return arrivals.filter(item => categoryKey(item.category) === wanted);
  }, [arrivals, selectedCategory]);

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
        <NotificationBell
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bell}
        />
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
      {/* <View style={styles.promo}>
        <Icon name="checkmark" size={16} color="#1F8A4C" />
        <Text style={styles.promoText}>Free shipping</Text>
        <Text style={styles.promoDivider}>|</Text>
        <Icon name="checkmark" size={16} color="#1F8A4C" />
        <Text style={styles.promoText}>Price adjustment within 30 days</Text>
        <Icon name="chevron-forward" size={16} color="#8A8A8A" />
      </View> */}

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={styles.card}>
              <View style={[styles.cardImage, styles.bone]} />
              <View style={[styles.boneLine, { width: '92%', marginTop: 8 }]} />
              <View style={[styles.boneLine, { width: '64%', marginTop: 6 }]} />
              <View style={[styles.boneLine, { width: '48%', marginTop: 8, height: 12 }]} />
              <View style={styles.priceRow}>
                <View style={[styles.boneLine, { width: '42%', height: 16 }]} />
                <View style={styles.boneCart} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.grid}>
          {visibleArrivals.map(item => {
            const showCompare = item.comparePrice > item.price && item.price > 0;
            const { rating, count } = shopRating(item.shop);
            return (
              <TouchableOpacity
                key={`${item.shop?.id}-${item.id}`}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => openProduct(item)}
              >
                <ProductCardMedia uri={item.uri} style={styles.cardImage} />
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
                  <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => openProduct(item)}
                    hitSlop={6}
                  >
                    <Icon name="cart-outline" size={18} color="#111111" />
                  </TouchableOpacity>
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
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 16, minWidth: 0 },
  identityText: { flex: 1, minWidth: 0, maxWidth: '72%' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F2' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700', color: '#111111' },
  place: { marginTop: 2, fontSize: 14, color: '#8A8A8A' },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { height: 48, flexGrow: 0, marginTop: 8, backgroundColor: '#FFFFFF' },
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
  promo: {
    marginTop: 4,
    marginHorizontal: 16,
    backgroundColor: '#F3F8F4',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoText: { fontSize: 13, color: '#222222', flexShrink: 1 },
  promoDivider: { color: '#C5C5C5', marginHorizontal: 2 },
  grid: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bone: { backgroundColor: '#ECECEC' },
  boneLine: { height: 14, borderRadius: 6, backgroundColor: '#ECECEC' },
  boneCart: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ECECEC' },
  card: { width: '48%', marginBottom: 18 },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
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
});
