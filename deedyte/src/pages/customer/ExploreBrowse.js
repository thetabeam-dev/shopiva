import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getVendorsOnMapByCategory } from '../../api';
import { normalizeVendorState, vendorStateRaw } from './Vendors';
import { shopCover, shopPlace } from '../../utils/exploreMap';

const CARD_W = Math.round(Dimensions.get('window').width * 0.62);

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function ExploreBrowse({ navigation }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const rows = await getVendorsOnMapByCategory('');
      setVendors(Array.isArray(rows) ? rows : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load shops.');
      if (!isRefresh) setVendors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const sections = useMemo(() => {
    /** @type {Map<string, object[]>} */
    const groups = new Map();
    for (const vendor of vendors) {
      const state = normalizeVendorState(vendorStateRaw(vendor)) || 'Other';
      const list = groups.get(state) || [];
      list.push(vendor);
      groups.set(state, list);
    }
    return [...groups.entries()]
      .map(([state, shops]) => ({ state, shops }))
      .sort((a, b) => b.shops.length - a.shops.length || a.state.localeCompare(b.state));
  }, [vendors]);

  const openShop = (vendor) => {
    navigation.navigate('Vendor', { vendor, category: '__all__' });
  };

  return (
    <View style={styles.screen}>
      <TouchableOpacity
        style={styles.searchWrap}
        onPress={() => navigation.navigate('Explore-map')}
        accessibilityRole="button"
        accessibilityLabel="Search places on map"
      >
        <Icon name="location-outline" size={18} color="#8A8A8A" />
        <Text style={styles.searchPlaceholder}>Start your search</Text>
        <Icon name="search-outline" size={20} color="#8A8A8A" />
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00926E" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#00926E" />
          }
        >
          {sections.length === 0 ? (
            <Text style={styles.muted}>No shops available.</Text>
          ) : sections.map((section) => (
            <View key={section.state} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHead}
                onPress={() => navigation.navigate('State-shops', { state: section.state })}
                accessibilityRole="button"
                accessibilityLabel={`See all shops in ${section.state}`}
              >
                <Text style={styles.sectionTitle} numberOfLines={1}>Shops in {section.state}</Text>
                <Icon name="arrow-forward" size={20} color="#111111" />
              </TouchableOpacity>
              <FlatList
                horizontal
                data={section.shops}
                keyExtractor={(item) => String(item.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                renderItem={({ item }) => {
                  const cover = shopCover(item);
                  const place = shopPlace(item);
                  return (
                    <TouchableOpacity
                      style={styles.card}
                      activeOpacity={0.9}
                      onPress={() => openShop(item)}
                    >
                      {cover ? (
                        <Image source={{ uri: cover }} style={styles.cover} />
                      ) : (
                        <View style={[styles.cover, styles.coverFallback]}>
                          <Text style={styles.coverLetter}>
                            {String(item.name || 'S').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.name || 'Shop'}</Text>
                      {place ? <Text style={styles.cardSub} numberOfLines={1}>{place}</Text> : null}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchPlaceholder: { flex: 1, fontSize: 16, color: '#9A9A9A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: '#6B7280', fontSize: 15, textAlign: 'center' },
  scroll: { paddingBottom: 28 },
  section: { marginTop: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111111', marginRight: 12 },
  row: { paddingHorizontal: 16, gap: 12 },
  card: { width: CARD_W },
  cover: {
    width: CARD_W,
    height: 168,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F1' },
  coverLetter: { fontSize: 36, fontWeight: '700', color: '#00926E' },
  cardTitle: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#111111' },
  cardSub: { marginTop: 2, fontSize: 13, color: '#6B7280' },
});
