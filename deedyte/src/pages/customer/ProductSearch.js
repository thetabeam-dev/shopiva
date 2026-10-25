import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { getStorefrontProducts, getVendorsOnMapByCategory } from '../../api';
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

const SORTS = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'az', label: 'A-Z' },
  { key: 'za', label: 'Z-A' },
  { key: 'price_asc', label: 'Price ascending' },
  { key: 'price_desc', label: 'Price descending' },
];

export default function ProductSearchScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const categoryRows = useSelector(selectCategoryRows);
  const [arrivals, setArrivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortKey, setSortKey] = useState('relevance');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState('all');
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');

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
    let cancelled = false;
    (async () => {
      setLoading(true);
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
                }));
              } catch {
                return [];
              }
            }),
          );
          collected.push(...lists.flat());
        }
        if (!cancelled) setArrivals(collected);
      } catch {
        if (!cancelled) setArrivals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice.trim() === '' ? null : Number(minPrice);
    const max = maxPrice.trim() === '' ? null : Number(maxPrice);
    const filtered = arrivals.filter(item => {
      if (selectedCategory !== 'all' && categoryKey(item.category) !== categoryKey(selectedCategory)) {
        return false;
      }
      if (q && !String(item.title ?? '').toLowerCase().includes(q)) return false;
      if (min != null && Number.isFinite(min) && item.price < min) return false;
      if (max != null && Number.isFinite(max) && item.price > max) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sortKey === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortKey === 'za') sorted.sort((a, b) => b.title.localeCompare(a.title));
    else if (sortKey === 'price_asc') sorted.sort((a, b) => a.price - b.price);
    else if (sortKey === 'price_desc') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }, [arrivals, query, minPrice, maxPrice, selectedCategory, sortKey]);

  const filtersActive = selectedCategory !== 'all' || minPrice.trim() !== '' || maxPrice.trim() !== '';

  const openFilters = () => {
    setDraftCategory(selectedCategory);
    setDraftMin(minPrice);
    setDraftMax(maxPrice);
    setSortOpen(false);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setSelectedCategory(draftCategory);
    setMinPrice(draftMin.replace(/[^\d.]/g, ''));
    setMaxPrice(draftMax.replace(/[^\d.]/g, ''));
    setFilterOpen(false);
  };

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
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Icon name="search-outline" size={18} color="#8A8A8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            placeholderTextColor="#9A9A9A"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Icon name="close-circle" size={18} color="#B0B0B0" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, filtersActive && styles.iconBtnOn]}
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Filter products"
        >
          <Icon name="options-outline" size={20} color={filtersActive ? '#FFFFFF' : '#111111'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setSortOpen(open => !open)}
          accessibilityRole="button"
          accessibilityLabel="Sort products"
        >
          <Icon name="swap-vertical-outline" size={20} color="#111111" />
        </TouchableOpacity>
      </View>

      {sortOpen ? (
        <View style={styles.sortMenu}>
          {SORTS.map(option => {
            const selected = option.key === sortKey;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.sortItem, selected && styles.sortItemOn]}
                onPress={() => {
                  setSortKey(option.key);
                  setSortOpen(false);
                }}
              >
                <Text style={styles.sortItemText}>{option.label}</Text>
                <Icon
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selected ? '#00926E' : '#C5C5C5'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#00926E" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {results.map(item => {
              const showCompare = item.comparePrice > item.price && item.price > 0;
              return (
                <TouchableOpacity
                  key={`${item.shop?.id}-${item.id}`}
                  style={styles.card}
                  activeOpacity={0.9}
                  onPress={() => openProduct(item)}
                >
                  <ProductCardMedia uri={item.uri} style={styles.cardImage} />
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.cardPrice}>{formatNaira(item.price)}</Text>
                    {showCompare ? (
                      <Text style={styles.comparePrice}>{formatNaira(item.comparePrice)}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {results.length === 0 ? (
            <Text style={styles.empty}>
              {query.trim()
                ? `No products match “${query.trim()}”.`
                : 'No products match these filters.'}
            </Text>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalFill}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setFilterOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setFilterOpen(false)} hitSlop={8}>
                <Icon name="close" size={22} color="#111111" />
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => {
                  setDraftCategory('all');
                  setDraftMin('');
                  setDraftMax('');
                }}
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Price</Text>
              <Text style={styles.sectionHint}>Set a range in naira</Text>
              <View style={styles.priceInputs}>
                <TextInput
                  value={draftMin}
                  onChangeText={setDraftMin}
                  placeholder="Min (₦)"
                  placeholderTextColor="#9A9A9A"
                  keyboardType="decimal-pad"
                  style={styles.priceInput}
                />
                <TextInput
                  value={draftMax}
                  onChangeText={setDraftMax}
                  placeholder="Max (₦)"
                  placeholderTextColor="#9A9A9A"
                  keyboardType="decimal-pad"
                  style={styles.priceInput}
                />
              </View>
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Category</Text>
              <Text style={styles.sectionHint}>Pick one to focus</Text>
              {['all', ...categories].map(item => {
                const selected = categoryKey(item) === categoryKey(draftCategory);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.sheetOption, selected && styles.sheetOptionOn]}
                    onPress={() => setDraftCategory(item)}
                  >
                    <Text style={[styles.sheetOptionText, selected && styles.sheetOptionTextOn]}>
                      {item === 'all' ? 'All' : formatCategoryLabel(item)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F4F4',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    paddingVertical: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnOn: { backgroundColor: '#00926E' },
  sortMenu: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
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
  grid: {
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
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
  priceRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#111111' },
  comparePrice: {
    fontSize: 13,
    color: '#9A9A9A',
    textDecorationLine: 'line-through',
  },
  empty: { paddingHorizontal: 20, paddingTop: 8, color: '#8A8A8A' },
  modalFill: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
    borderRadius: 7,
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
    borderRadius: 7,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111111',
  },
  applyBtn: {
    marginTop: 12,
    height: 50,
    borderRadius: 7,
    backgroundColor: '#00926E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
