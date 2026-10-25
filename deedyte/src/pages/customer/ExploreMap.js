import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { getVendorsOnMapByCategory } from '../../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../context/ProfileContext';
import { placeDetails, suggestPlaces, tomtomTileUrl } from '../../utils/tomtom';
import {
  shopCover,
  shopPlace,
  storedUserCoordinate,
  vendorCoordinate,
} from '../../utils/exploreMap';

const MAP_CARD_W = Math.round(Dimensions.get('window').width * 0.72);

function distanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const arc = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

/**
 * @param {{
 *   navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>>;
 *   route: { params?: { initialQuery?: string } };
 * }} props
 */
export default function ExploreMap({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const savedCoord = storedUserCoordinate(user);
  const savedLatitude = savedCoord?.latitude;
  const savedLongitude = savedCoord?.longitude;
  const [vendors, setVendors] = useState([]);
  const [query, setQuery] = useState(route.params?.initialQuery ?? '');
  const [suggestionsOpen, setSuggestionsOpen] = useState(Boolean(route.params?.initialQuery));
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionError, setSuggestionError] = useState('');
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showMe, setShowMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapBox, setMapBox] = useState(null);
  const mapRef = useRef(null);
  const mapListRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let active = true;
    getVendorsOnMapByCategory('')
      .then((rows) => {
        if (active) setVendors(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (active) {
          Alert.alert('Explore map', error instanceof Error ? error.message : 'Could not load shops.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(savedLatitude) || !Number.isFinite(savedLongitude)) return;
    mapRef.current?.animateToRegion({
      latitude: savedLatitude,
      longitude: savedLongitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    }, 400);
  }, [savedLatitude, savedLongitude]);

  useEffect(() => {
    const search = query.trim();
    if (!suggestionsOpen || search.length < 2) {
      setSuggestions([]);
      setSuggestionError('');
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggestPlaces(search, controller.signal)
        .then((rows) => {
          setSuggestionError('');
          setSuggestions(rows);
        })
        .catch((error) => {
          if (error?.name === 'AbortError') return;
          setSuggestions([]);
          setSuggestionError(error instanceof Error ? error.message : 'Location suggestions are unavailable.');
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, suggestionsOpen]);

  const mapShops = useMemo(() => (
    vendors
      .map((shop) => ({ shop, coordinate: vendorCoordinate(shop) }))
      .filter((pin) => pin.coordinate)
  ), [vendors]);

  const visibleShops = useMemo(() => {
    if (selectedPlace) {
      const ranked = mapShops
        .map((pin) => ({ ...pin, distanceKm: distanceKm(selectedPlace, pin.coordinate) }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
      const nearby = ranked.filter((pin) => pin.distanceKm <= 25);
      return (nearby.length ? nearby : ranked.slice(0, 8));
    }
    if (!mapRegion) return mapShops;
    const latHalf = Number(mapRegion.latitudeDelta) / 2;
    const lngHalf = Number(mapRegion.longitudeDelta) / 2;
    if (!Number.isFinite(latHalf) || !Number.isFinite(lngHalf)) return mapShops;
    return mapShops.filter(({ coordinate }) => (
      Math.abs(coordinate.latitude - mapRegion.latitude) <= latHalf
      && Math.abs(coordinate.longitude - mapRegion.longitude) <= lngHalf
    ));
  }, [mapShops, mapRegion, selectedPlace]);

  const selectPlace = async (option) => {
    setQuery(option.label);
    setSuggestionsOpen(false);
    searchRef.current?.blur();
    try {
      const { latitude, longitude } = await placeDetails(option.placeId);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      setSelectedPlace({ latitude, longitude });
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }, 400);
    } catch (error) {
      Alert.alert('Location search', error instanceof Error ? error.message : 'Could not load that place.');
    }
  };

  const zoomBy = (factor) => {
    const region = mapRegion ?? {
      latitude: savedLatitude ?? 9.082,
      longitude: savedLongitude ?? 8.6753,
      latitudeDelta: savedCoord ? 0.2 : 8,
      longitudeDelta: savedCoord ? 0.2 : 8,
    };
    const next = {
      ...region,
      latitudeDelta: Math.min(40, Math.max(0.002, region.latitudeDelta * factor)),
      longitudeDelta: Math.min(40, Math.max(0.002, region.longitudeDelta * factor)),
    };
    setMapRegion(next);
    mapRef.current?.animateToRegion(next, 180);
  };

  const goToMyLocation = () => {
    if (!savedCoord) {
      Alert.alert('Location', 'Your saved profile location does not include coordinates.');
      return;
    }
    setShowMe(true);
    mapRef.current?.animateToRegion({
      ...savedCoord,
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
    if (index >= 0) mapListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  };

  const openShop = (shop) => navigation.navigate('Vendor', { vendor: shop, category: '__all__' });

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
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="Start your search"
          placeholderTextColor="#9A9A9A"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setSuggestions([]);
              setSuggestionsOpen(false);
              setSelectedPlace(null);
              searchRef.current?.blur();
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear location search"
          >
            <Icon name="close" size={20} color="#111111" />
          </TouchableOpacity>
        ) : null}
      </View>

      {suggestionError && suggestionsOpen ? (
        <Text style={styles.suggestError}>{suggestionError}</Text>
      ) : null}
      {suggestions.length > 0 && suggestionsOpen ? (
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

      <View
        style={styles.mapWrap}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setMapBox({ width, height });
        }}
      >
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={mapBox ?? styles.map}
          initialRegion={{
            latitude: savedCoord?.latitude ?? 9.082,
            longitude: savedCoord?.longitude ?? 8.6753,
            latitudeDelta: savedCoord ? 0.2 : 8,
            longitudeDelta: savedCoord ? 0.2 : 8,
          }}
          onRegionChangeComplete={setMapRegion}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          mapPadding={{ top: 72, right: 12, bottom: 210, left: 12 }}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        >
          {Platform.OS === 'android' ? (
            <UrlTile
              urlTemplate={tomtomTileUrl()}
              maximumZ={22}
              flipY={false}
              shouldReplaceMapContent
            />
          ) : null}
          {showMe && savedCoord ? (
            <Marker coordinate={savedCoord} pinColor="#1A73E8" title="You" zIndex={2} />
          ) : null}
          {visibleShops.map(({ shop, coordinate }) => (
            <Marker
              key={String(shop.id)}
              coordinate={coordinate}
              pinColor="#00926E"
              tracksViewChanges={false}
              onPress={() => focusShop(shop, coordinate)}
            />
          ))}
        </MapView>
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.zoomStack, { bottom: 304 + insets.bottom }]}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(0.8)}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Icon name="add" size={22} color="#111111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(1.25)}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Icon name="remove" size={22} color="#111111" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.locateBtn, { bottom: 300 + insets.bottom }]}
            onPress={goToMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Show my location"
          >
            <Icon name="locate" size={22} color="#111111" />
          </TouchableOpacity>

          <View style={[styles.mapSheet, { bottom: 12 + insets.bottom }]} pointerEvents="box-none">
            <View style={styles.mapSheetHead}>
              <Text style={styles.mapSheetTitle}>
                <Text style={styles.mapSheetCount}>({visibleShops.length})</Text> Shops In This Area
              </Text>
              <TouchableOpacity
                style={styles.mapSheetAction}
                onPress={() => navigation.navigate('Area-shops', {
                  shopIds: visibleShops.map((item) => item.shop.id),
                })}
                accessibilityRole="button"
                accessibilityLabel="See shops in this area"
              >
                <Icon name="arrow-forward" size={18} color="#111111" />
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color="#00926E" />
            ) : visibleShops.length === 0 ? (
              <Text style={styles.mapSheetEmpty}>No shops in this part of the map.</Text>
            ) : (
              <FlatList
                ref={mapListRef}
                horizontal
                data={visibleShops}
                keyExtractor={(item) => String(item.shop.id)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mapCardRow}
                onScrollToIndexFailed={() => { }}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  searchWrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 6,
    elevation: 6,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111111' },
  suggestError: {
    position: 'absolute',
    top: 68,
    left: 16,
    right: 16,
    color: '#B42318',
    fontSize: 13,
    zIndex: 6,
  },
  suggestBox: {
    position: 'absolute',
    top: 68,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    zIndex: 3,
    elevation: 3,
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
  mapWrap: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    elevation: 8,
    // marginBottom: 20
  },
  zoomStack: {
    position: 'absolute',
    right: 16,
    bottom: 304,
    zIndex: 6,
    gap: 8,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  locateBtn: {
    position: 'absolute',
    left: 16,
    bottom: 300,
    zIndex: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    bottom: 12,
    zIndex: 4,
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
  mapSheetCount: { fontSize: 16, fontWeight: '700', color: '#00926E' },
  mapSheetEmpty: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 14,
    color: '#6B7280',
  },
  mapCardRow: { paddingHorizontal: 16, gap: 12, marginBottom: Platform.OS === 'android' ? 40 : 10 },
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
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F1' },
  coverLetter: { fontSize: 36, fontWeight: '700', color: '#00926E' },
  mapCardTitle: { marginTop: 8, fontSize: 15, fontWeight: '700', color: '#111111' },
  mapCardSub: { marginTop: 2, fontSize: 13, color: '#6B7280' },
});
