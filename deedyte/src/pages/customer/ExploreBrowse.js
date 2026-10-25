import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { getVendorsOnMapByCategory } from '../../api';
import { useProfile } from '../../context/ProfileContext';
import { getCurrentCoordinates, requestLocationPermission } from '../../utils/deviceLocation';
import { normalizeVendorState, vendorStateRaw } from './Vendors';

import { placeDetails, suggestPlaces } from '../../utils/googlePlaces';

const WINDOW_W = Dimensions.get('window').width;
const CARD_W = Math.round(WINDOW_W * 0.62);
const MAP_CARD_W = Math.round(WINDOW_W * 0.72);

function shopCover(vendor) {
  const logo = String(vendor?.logo ?? '').trim();
  return logo;
}

function vendorCoordinate(vendor) {
  const latitude = Number(vendor?.lat);
  const longitude = Number(vendor?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function storedUserCoordinate(user) {
  const loc = user?.raw?.location;
  if (!loc || typeof loc !== 'object' || Array.isArray(loc)) return null;
  const coords = loc.coordinates && typeof loc.coordinates === 'object' ? loc.coordinates : loc;
  const latitude = Number(coords.latitude ?? coords.lat);
  const longitude = Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function shopPlace(vendor) {
  const city = String(vendor?.city ?? '').trim();
  const state = normalizeVendorState(vendorStateRaw(vendor));
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return String(vendor?.address ?? '').trim();
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function ExploreBrowse({ navigation }) {
  const { user } = useProfile();
  const savedCoord = storedUserCoordinate(user);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState('');
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const [mapRegion, setMapRegion] = useState(null);
  const mapRef = useRef(null);
  const mapListRef = useRef(null);
  const searchRef = useRef(null);
  const closingSearch = useRef(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const rows = await getVendorsOnMapByCategory('');
      setVendors(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load shops.');
      if (!isRefresh) setVendors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false).catch(() => {});
  }, [load]);

  const ensureLocation = useCallback(async (interactive) => {
    const granted = await requestLocationPermission({ interactive });
    setShowUserLocation(granted);
    setLocationReady(granted);
    if (!granted) return;
    try {
      const coords = await getCurrentCoordinates({ exact: true });
      setUserCoord(coords);
    } catch {
      // Permission is on. The map blue dot can still appear when a fix arrives.
    }
  }, []);

  useEffect(() => {
    ensureLocation(true).catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ensureLocation(false).catch(() => {});
    });
    return () => sub.remove();
  }, [ensureLocation]);

  useEffect(() => {
    if (!searchActive || !savedCoord) return;
    mapRef.current?.animateToRegion({
      latitude: savedCoord.latitude,
      longitude: savedCoord.longitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    }, 400);
  }, [searchActive, savedCoord?.latitude, savedCoord?.longitude]);

  useEffect(() => {
    const q = query.trim();
    if (!suggestionsOpen || q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggestPlaces(q, controller.signal)
        .then((rows) => {
          setSuggestionError('');
          setSuggestions(rows);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setSuggestions([]);
          setSuggestionError(err instanceof Error ? err.message : 'Location suggestions are unavailable.');
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, suggestionsOpen]);

  const selectPlace = async (option) => {
    setQuery(option.label);
    setSuggestionsOpen(false);
    setSearchActive(true);
    try {
      const details = await placeDetails(option.placeId);
      const latitude = details.latitude;
      const longitude = details.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }, 400);
    } catch {
      // The typed place stays in the search field.
    }
  };

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    /** @type {Map<string, object[]>} */
    const groups = new Map();
    for (const vendor of vendors) {
      const name = String(vendor?.name ?? '').toLowerCase();
      const place = shopPlace(vendor).toLowerCase();
      if (q && !name.includes(q) && !place.includes(q)) continue;
      const state = normalizeVendorState(vendorStateRaw(vendor)) || 'Other';
      const list = groups.get(state) || [];
      list.push(vendor);
      groups.set(state, list);
    }
    return [...groups.entries()]
      .map(([state, shops]) => ({ state, shops }))
      .sort((a, b) => b.shops.length - a.shops.length || a.state.localeCompare(b.state));
  }, [vendors, query]);

  const mapShops = useMemo(() => {
    const pins = [];
    for (const section of sections) {
      for (const shop of section.shops) {
        const coordinate = vendorCoordinate(shop);
        if (coordinate) pins.push({ shop, coordinate });
      }
    }
    return pins;
  }, [sections]);

  const visibleShops = useMemo(() => {
    if (!mapRegion) return mapShops;
    const latHalf = Number(mapRegion.latitudeDelta) / 2;
    const lngHalf = Number(mapRegion.longitudeDelta) / 2;
    if (!Number.isFinite(latHalf) || !Number.isFinite(lngHalf)) return mapShops;
    return mapShops.filter(({ coordinate }) => (
      Math.abs(coordinate.latitude - mapRegion.latitude) <= latHalf
      && Math.abs(coordinate.longitude - mapRegion.longitude) <= lngHalf
    ));
  }, [mapShops, mapRegion]);

  const goToMyLocation = () => {
    if (!savedCoord) {
      Alert.alert('Location', 'Save your location on your profile so the map can open it.');
      return;
    }
    mapRef.current?.animateToRegion({
      latitude: savedCoord.latitude,
      longitude: savedCoord.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 400);
  };

  const focusShop = (shop, coordinate) => {
    mapRef.current?.animateToRegion({
      ...coordinate,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }, 350);
    const index = visibleShops.findIndex((pin) => pin.shop.id === shop.id);
    if (index >= 0) {
      mapListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };


  const openState = (state) => {
    navigation.navigate('State-shops', { state });
  };

  const openShop = (vendor) => {
    navigation.navigate('Vendor', { vendor, category: '__all__' });
  };

  if (!locationReady) {
    return (
      <View style={styles.locationGate}>
        <Icon name="location-outline" size={36} color="#00926E" />
        <Text style={styles.locationGateTitle}>Location is required</Text>
        <Text style={styles.locationGateBody}>
          DeeDyte uses your location to show vendors close to you. Turn on location to continue.
        </Text>
        <TouchableOpacity style={styles.locationGateBtn} onPress={() => ensureLocation(true)}>
          <Text style={styles.locationGateBtnText}>Enable location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.searchWrap}>
        <Icon name="location-outline" size={18} color="#8A8A8A" />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => {
            setSearchActive(true);
            setSuggestionsOpen(true);
          }}
          onBlur={() => {
            if (!closingSearch.current) return;
            closingSearch.current = false;
            setSearchActive(false);
            setSuggestionsOpen(false);
          }}
          placeholder="Start your search"
          placeholderTextColor="#9A9A9A"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchActive ? (
          <TouchableOpacity
            onPress={() => {
              closingSearch.current = false;
              setQuery('');
              setSuggestionsOpen(false);
              setSearchActive(false);
              searchRef.current?.blur();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close map"
          >
            <Icon name="close" size={20} color="#111111" />
          </TouchableOpacity>
        ) : null}
      </View>
      {searchActive && suggestionsOpen && suggestionError ? (
        <Text style={styles.suggestError}>{suggestionError}</Text>
      ) : null}
      {searchActive && suggestionsOpen && suggestions.length > 0 ? (
        <View style={styles.suggestBox}>
          {suggestions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={styles.suggestRow}
              onPress={() => selectPlace(option)}
            >
              <Icon name="location-outline" size={16} color="#00926E" />
              <View style={styles.suggestCopy}>
                <Text style={styles.suggestLabel} numberOfLines={1}>{option.label}</Text>
                <Text style={styles.suggestSub} numberOfLines={1}>{option.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {searchActive ? (
        <View
          style={styles.mapWrap}
          collapsable={false}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.height);
            if (next > 0 && next !== mapHeight) setMapHeight(next);
          }}
        >
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={mapHeight > 0 ? { width: '100%', height: mapHeight } : styles.map}
            initialRegion={{
              latitude: savedCoord?.latitude ?? 9.082,
              longitude: savedCoord?.longitude ?? 8.6753,
              latitudeDelta: savedCoord ? 0.2 : 8,
              longitudeDelta: savedCoord ? 0.2 : 8,
            }}
            onRegionChangeComplete={setMapRegion}
            showsUserLocation={showUserLocation}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            loadingEnabled
            mapPadding={{ top: 12, right: 12, bottom: 210, left: 12 }}
          >
            {mapShops.map(({ shop, coordinate }) => (
              <Marker
                key={String(shop.id)}
                coordinate={coordinate}
                pinColor="#00926E"
                tracksViewChanges={false}
                onPress={() => focusShop(shop, coordinate)}
              />
            ))}
          </MapView>
          <TouchableOpacity
            style={styles.locateBtn}
            onPress={() => { void goToMyLocation(); }}
            accessibilityRole="button"
            accessibilityLabel="Show my location"
          >
            <Icon name="locate" size={22} color="#111111" />
          </TouchableOpacity>
          <View style={styles.mapSheet} pointerEvents="box-none">
            <View style={styles.mapSheetHead}>
              <Text style={styles.mapSheetTitle}>Shops in this area</Text>
              <TouchableOpacity
                style={styles.mapSheetAction}
                onPress={() => navigation.navigate('Area-shops', {
                  shops: visibleShops.map((item) => item.shop),
                })}
                accessibilityRole="button"
                accessibilityLabel="See shops in this area"
              >
                <Text style={styles.mapSheetCount}>{visibleShops.length}</Text>
                <Icon name="arrow-forward" size={18} color="#111111" />
              </TouchableOpacity>
            </View>
            {visibleShops.length === 0 ? (
              <Text style={styles.mapSheetEmpty}>No shops in this part of the map.</Text>
            ) : (
              <FlatList
                ref={mapListRef}
                horizontal
                data={visibleShops}
                keyExtractor={(item) => String(item.shop.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mapCardRow}
                onScrollToIndexFailed={() => {}}
                renderItem={({ item }) => {
                  const cover = shopCover(item.shop);
                  const place = shopPlace(item.shop);
                  return (
                    <TouchableOpacity
                      style={styles.mapCard}
                      activeOpacity={0.9}
                      onPress={() => openShop(item.shop)}
                    >
                      {cover ? (
                        <Image source={{ uri: cover }} style={styles.mapCardImage} />
                      ) : (
                        <View style={[styles.mapCardImage, styles.coverFallback]}>
                          <Text style={styles.coverLetter}>
                            {String(item.shop.name || 'S').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.mapCardTitle} numberOfLines={1}>{item.shop.name || 'Shop'}</Text>
                      {place ? <Text style={styles.mapCardSub} numberOfLines={1}>{place}</Text> : null}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      ) : null}
      {!searchActive && loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00926E" />
        </View>
      ) : !searchActive && error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : searchActive ? null : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#00926E" />
          }
        >
          {sections.length === 0 ? (
            <Text style={styles.muted}>No shops match that search.</Text>
          ) : sections.map((section) => (
            <View key={section.state} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHead}
                onPress={() => openState(section.state)}
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
  locationGate: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  locationGateTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  locationGateBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
  locationGateBtn: {
    marginTop: 20,
    backgroundColor: '#00926E',
    borderRadius: 7,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  locationGateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  searchWrap: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111111' },
  suggestError: { marginHorizontal: 16, marginBottom: 8, color: '#B42318', fontSize: 13 },
  suggestBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestCopy: { flex: 1 },
  suggestLabel: { fontSize: 15, fontWeight: '600', color: '#111111' },
  suggestSub: { marginTop: 1, fontSize: 12, color: '#6B7280' },
  mapWrap: { flex: 1, marginHorizontal: 16, marginBottom: 12, minHeight: 280 },
  map: { flex: 1 },
  locateBtn: {
    position: 'absolute',
    right: 12,
    bottom: 228,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  mapSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
  },
  mapSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mapSheetTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },
  mapSheetAction: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapSheetCount: { fontSize: 13, fontWeight: '700', color: '#00926E' },
  mapSheetEmpty: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 14,
    color: '#6B7280',
  },
  mapCardRow: { paddingHorizontal: 16, gap: 12 },
  mapCard: {
    width: MAP_CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 10,
  },
  mapCardImage: {
    width: '100%',
    height: 120,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  mapCardTitle: { marginTop: 8, fontSize: 15, fontWeight: '700', color: '#111111' },
  mapCardSub: { marginTop: 2, fontSize: 13, color: '#6B7280' },
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
