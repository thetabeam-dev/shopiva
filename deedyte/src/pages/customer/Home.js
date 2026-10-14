import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

function formatCategoryLabel(category) {
  return String(category ?? '')
    .split(' ')
    .map(word => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(' ');
}

function locationLabel(user) {
  const loc = user?.locationDisplay || user?.location;
  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  if (loc && typeof loc === 'object') {
    const parts = [loc.city, loc.state, loc.country].map(part => String(part ?? '').trim()).filter(Boolean);
    if (parts.length) return parts[0];
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

  const openExplore = useCallback((category) => {
    navigation.getParent()?.navigate('Explore', {
      screen: 'Vendors',
      params: category ? { category } : {},
    });
  }, [navigation]);

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

  const name = user?.displayName || 'Guest';
  const place = locationLabel(user);
  const heroImage = visibleArrivals.find(item => item.uri)?.uri;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: 10, paddingBottom: 28 }}
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
      <View style={styles.header}>
        <View style={styles.identity}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Icon name="person" size={22} color="#00926E" />
            </View>
          )}
          <View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.place}>{place}</Text>
          </View>
        </View>
        <NotificationBell
          onPress={() => navigation.navigate('Notifications')}
          style={styles.bell}
        />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>New Collection</Text>
          <Text style={styles.heroBody}>
            Discover shops and products from vendors near you.
          </Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => openExplore()} activeOpacity={0.85}>
            <Text style={styles.exploreBtnText}>Explore</Text>
          </TouchableOpacity>
        </View>
        <ProductCardMedia uri={heroImage} style={styles.heroImage} />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Category</Text>
        <TouchableOpacity onPress={() => setSelectedCategory('all')}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
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
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {item === 'all' ? 'All' : formatCategoryLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>New arrival</Text>
        <TouchableOpacity onPress={() => openExplore()}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color="#00926E" style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {visibleArrivals.map(item => (
              <TouchableOpacity
                key={`${item.shop?.id}-${item.id}`}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() =>
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
                  })
                }
              >
                <ProductCardMedia uri={item.uri} style={styles.cardImage} />
                <View style={styles.cardMeta}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardPrice}>{formatNaira(item.price)}</Text>
                </View>
              </TouchableOpacity>
          ))}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  hero: {
    marginTop: 22,
    marginHorizontal: 20,
    backgroundColor: '#3C322F',
    borderRadius: 22,
    minHeight: 190,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  heroCopy: { flex: 1, padding: 22, justifyContent: 'center' },
  heroTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '800' },
  heroBody: { marginTop: 10, color: '#E7E0DC', fontSize: 15, lineHeight: 21 },
  exploreBtn: {
    marginTop: 18,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  exploreBtnText: { fontSize: 16, fontWeight: '600', color: '#111111' },
  heroImage: { width: 130, height: '100%' },
  sectionHead: {
    marginTop: 26,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: '#111111' },
  viewAll: { fontSize: 15, color: '#B0B0B0' },
  chipRow: { height: 58, flexGrow: 0 },
  chips: { paddingHorizontal: 20, paddingTop: 14, gap: 10, alignItems: 'center' },
  chip: {
    backgroundColor: '#F3F3F3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: { backgroundColor: '#111111' },
  chipText: { fontSize: 15, color: '#222222' },
  chipTextSelected: { color: '#FFFFFF' },
  grid: {
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: { width: '47%' },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#F3F3F3',
  },
  cardImageEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardMeta: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { flex: 1, fontSize: 15, color: '#222222' },
  cardPrice: { fontSize: 15, fontWeight: '700', color: '#111111' },
  empty: { paddingHorizontal: 20, paddingTop: 8, color: '#8A8A8A' },
});
