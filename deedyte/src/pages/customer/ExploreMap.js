import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import { getVendorsOnMapByCategory } from '../../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../context/ProfileContext';
import { placeDetails, suggestPlaces, tomtomTileUrl } from '../../utils/tomtom';
import { getCurrentCoordinates, requestLocationPermission, reverseGeocodeToPlace } from '../../utils/deviceLocation';
import { updateUserProfileFields } from '../../api/user';
import PlaceLocationField from '../../components/PlaceLocationField';
import ShopBrowseCard from '../../components/ShopBrowseCard';
import {
  storedUserCoordinate,
  vendorCoordinate,
} from '../../utils/exploreMap';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const SHEET_PEEK = 236;
const SHEET_EXPANDED = Math.round(SCREEN_H * 0.62);
const SHOP_CARD_W = SCREEN_W - 32;

function shopCategories(shop) {
  const raw = shop?.categories;
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? shop?.category ?? '')
      .replace(/[{}"]/g, '')
      .split(',');
  return list.map((item) => String(item).trim()).filter(Boolean);
}

function formatCategory(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatNaira(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

function tomtomLeafletHtml(tileUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #E7EEF2; }
  .tip { width: 168px; background: #fff; border-radius: 7px; padding: 8px 10px; font-family: sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,.16); }
  .tip b { display: block; font-size: 13px; color: #111; }
  .tip span { display: block; margin-top: 2px; font-size: 11px; color: #4B5563; }
  .tip em { display: block; margin-top: 4px; font-size: 12px; font-style: normal; font-weight: 700; color: #00926E; }
  .you { width: 22px; height: 22px; border-radius: 11px; background: rgba(26,115,232,0.18); display: flex; align-items: center; justify-content: center; }
  .you i { width: 14px; height: 14px; border-radius: 7px; background: #1A73E8; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(26,115,232,0.35); display: block; }
  .leaflet-div-icon { background: transparent; border: none; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([9.082, 8.6753], 6);
  L.tileLayer(${JSON.stringify(tileUrl)}, { maxZoom: 22, tileSize: 256 }).addTo(map);
  const pins = L.layerGroup().addTo(map);
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function region() {
    const b = map.getBounds();
    const c = map.getCenter();
    post({ type: 'region', latitude: c.lat, longitude: c.lng, latitudeDelta: Math.abs(b.getNorth() - b.getSouth()), longitudeDelta: Math.abs(b.getEast() - b.getWest()) });
  }
  map.on('moveend', region);
  window.moveTo = function (lat, lng, zoom) { map.setView([lat, lng], zoom); };
  window.zoomBy = function (step) { map.setZoom(map.getZoom() + step); };
  window.setMapInteractive = function (on) {
    if (on) { map.dragging.enable(); map.touchZoom.enable(); map.scrollWheelZoom.enable(); map.doubleClickZoom.enable(); }
    else { map.dragging.disable(); map.touchZoom.disable(); map.scrollWheelZoom.disable(); map.doubleClickZoom.disable(); }
  };
  window.renderPins = function (shops, me) {
    pins.clearLayers();
    (shops || []).forEach(function (shop) {
      const html = '<div class="tip"><b>' + shop.name + '</b><span>' + shop.categories + '</span><em>Avg shipping ' + shop.fee + '</em></div>';
      const icon = L.divIcon({ className: '', html: html, iconSize: [168, 72], iconAnchor: [84, 72] });
      L.marker([shop.latitude, shop.longitude], { icon: icon }).on('click', function () { post({ type: 'shop', id: shop.id }); }).addTo(pins);
    });
    if (me) {
      const icon = L.divIcon({ className: '', html: '<div class="you"><i></i></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([me.latitude, me.longitude], { icon: icon, zIndexOffset: 1000 }).addTo(pins);
    }
  };
  setTimeout(region, 300);
</script>
</body>
</html>`;
}

function zoomForDelta(delta) {
  const span = Number(delta);
  if (!Number.isFinite(span) || span <= 0) return 6;
  return Math.max(3, Math.min(18, Math.round(Math.log2(360 / span))));
}

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
  const { user, refresh } = useProfile();
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
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationPickerBusy, setLocationPickerBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapBox, setMapBox] = useState(null);
  /** @type {[string | null, function]} null = all categories */
  const [selectedCategory, setSelectedCategory] = useState(null);
  const mapRef = useRef(null);
  const webRef = useRef(null);
  const [webReady, setWebReady] = useState(false);
  const mapListRef = useRef(null);
  const searchRef = useRef(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(SHEET_PEEK)).current;
  const sheetDragStart = useRef(SHEET_PEEK);

  const snapSheet = (expanded) => {
    setSheetExpanded(expanded);
    Animated.spring(sheetHeight, {
      toValue: expanded ? SHEET_EXPANDED : SHEET_PEEK,
      useNativeDriver: false,
      friction: 9,
      tension: 68,
    }).start();
  };

  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation((value) => {
          sheetDragStart.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(
          SHEET_EXPANDED,
          Math.max(SHEET_PEEK, sheetDragStart.current - gesture.dy),
        );
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldExpand =
          gesture.dy < -36 ||
          gesture.vy < -0.55 ||
          sheetDragStart.current - gesture.dy > (SHEET_PEEK + SHEET_EXPANDED) / 2;
        snapSheet(shouldExpand);
      },
    }),
  ).current;

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
    const region = {
      latitude: savedLatitude,
      longitude: savedLongitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
    setMapRegion(region);
    if (Platform.OS === 'android') {
      webRef.current?.injectJavaScript(`window.moveTo && window.moveTo(${savedLatitude}, ${savedLongitude}, ${zoomForDelta(0.2)}); true;`);
      return;
    }
    mapRef.current?.animateToRegion(region, 400);
  }, [savedLatitude, savedLongitude, webReady]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !webReady) return;
    webRef.current?.injectJavaScript(
      `window.setMapInteractive && window.setMapInteractive(${sheetExpanded ? 'false' : 'true'}); true;`,
    );
  }, [sheetExpanded, webReady]);

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

  const categoryOptions = useMemo(() => {
    /** @type {Map<string, { key: string; label: string; count: number }>} */
    const counts = new Map();
    for (const shop of vendors) {
      for (const cat of shopCategories(shop)) {
        const key = cat.toLowerCase();
        if (!key) continue;
        const prev = counts.get(key) || { key, label: formatCategory(cat), count: 0 };
        prev.count += 1;
        counts.set(key, prev);
      }
    }
    return Array.from(counts.values()).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
  }, [vendors]);

  const mapShops = useMemo(() => (
    vendors
      .map((shop) => ({ shop, coordinate: vendorCoordinate(shop) }))
      .filter((pin) => pin.coordinate)
      .filter(({ shop }) => {
        if (!selectedCategory) return true;
        return shopCategories(shop).some(
          (cat) => cat.toLowerCase() === selectedCategory,
        );
      })
  ), [vendors, selectedCategory]);

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

  useEffect(() => {
    if (Platform.OS !== 'android' || !webReady) return;
    const pins = visibleShops.map(({ shop, coordinate }) => ({
      id: shop.id,
      name: escapeHtml(shop.name || 'Shop'),
      categories: escapeHtml(shopCategories(shop).map(formatCategory).join(', ') || 'No categories'),
      fee: escapeHtml(formatNaira(shop.averageShippingFee ?? shop.average_shipping_fee)),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    }));
    const me = showMe && savedCoord ? savedCoord : null;
    webRef.current?.injectJavaScript(`window.renderPins && window.renderPins(${JSON.stringify(pins)}, ${JSON.stringify(me)}); true;`);
  }, [visibleShops, showMe, savedCoord, webReady]);

  const selectPlace = async (option) => {
    Keyboard.dismiss();
    setQuery(option.label);
    setSuggestionsOpen(false);
    searchRef.current?.blur();
    try {
      const { latitude, longitude } = await placeDetails(option.placeId);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      setSelectedPlace({ latitude, longitude });
      moveMap({
        latitude,
        longitude,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      });
    } catch (error) {
      Alert.alert('Location search', error instanceof Error ? error.message : 'Could not load that place.');
    }
  };

  const zoomBy = (factor) => {
    if (Platform.OS === 'android') {
      const step = factor < 1 ? 1 : -1;
      webRef.current?.injectJavaScript(`window.zoomBy && window.zoomBy(${step}); true;`);
      return;
    }
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
    moveMap(next);
  };

  const moveMap = (region) => {
    setMapRegion(region);
    if (Platform.OS === 'android') {
      webRef.current?.injectJavaScript(`window.moveTo(${region.latitude}, ${region.longitude}, ${zoomForDelta(region.latitudeDelta)}); true;`);
      return;
    }
    mapRef.current?.animateToRegion(region, 400);
  };

  const showSavedLocation = (coord, label) => {
    setQuery(label);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setShowMe(true);
    setSelectedPlace(coord);
    setLocationPickerOpen(false);
    moveMap({
      ...coord,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    });
  };

  const saveProfileLocation = async (place) => {
    if (!user?.id) {
      Alert.alert('Location', 'Sign in to save your location.');
      return false;
    }
    const out = await updateUserProfileFields(user.id, {
      location: {
        city: place.city || '',
        state: place.state || '',
        country: place.country || 'Nigeria',
        latitude: place.latitude,
        longitude: place.longitude,
      },
    });
    if (!out.ok) {
      Alert.alert('Location', out.message || 'Could not save your location.');
      return false;
    }
    await refresh().catch(() => {});
    return true;
  };

  const goToMyLocation = async () => {
    const savedLabel = String(user?.locationDisplay ?? '').trim()
      || [user?.locationObj?.city, user?.locationObj?.state].filter(Boolean).join(', ');
    if (savedCoord) {
      showSavedLocation(savedCoord, savedLabel);
      return;
    }
    try {
      const granted = await requestLocationPermission({ interactive: true });
      if (!granted) {
        setLocationPickerOpen(true);
        return;
      }
      const coords = await getCurrentCoordinates({ exact: true });
      const latitude = Number(coords?.latitude);
      const longitude = Number(coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setLocationPickerOpen(true);
        return;
      }
      const place = await reverseGeocodeToPlace(latitude, longitude);
      const saved = await saveProfileLocation({
        city: place.city || '',
        state: place.state || '',
        country: place.country || 'Nigeria',
        latitude,
        longitude,
      });
      if (!saved) {
        setLocationPickerOpen(true);
        return;
      }
      showSavedLocation(
        { latitude, longitude },
        [place.city, place.state].filter(Boolean).join(', ') || savedLabel,
      );
    } catch {
      setLocationPickerOpen(true);
    }
  };

  const pickLocationFromModal = async (place) => {
    if (!place || locationPickerBusy) return;
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return;
    setLocationPickerBusy(true);
    try {
      const saved = await saveProfileLocation(place);
      if (!saved) return;
      showSavedLocation(
        { latitude: place.latitude, longitude: place.longitude },
        place.label || [place.city, place.state].filter(Boolean).join(', '),
      );
    } finally {
      setLocationPickerBusy(false);
    }
  };

  const focusShop = (shop, coordinate) => {
    moveMap({
      ...coordinate,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    });
    if (!sheetExpanded) snapSheet(true);
    const index = visibleShops.findIndex((pin) => pin.shop.id === shop.id);
    if (index >= 0) {
      requestAnimationFrame(() => {
        mapListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.15 });
      });
    }
  };

  const openShop = (shop) => navigation.navigate('Vendor', { vendor: shop, category: '__all__' });
  const sheetControlsBottom = (sheetExpanded ? SHEET_EXPANDED : SHEET_PEEK) + 16 + insets.bottom;

  return (
    <View style={styles.screen}>
      <View style={styles.topChrome} pointerEvents="box-none">
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryChips}
          contentContainerStyle={styles.categoryChipsContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory ? styles.categoryChipSelected : null]}
            onPress={() => setSelectedCategory(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !selectedCategory }}
            accessibilityLabel="All shop categories"
          >
            <Icon
              name="grid-outline"
              size={15}
              color={!selectedCategory ? '#FFFFFF' : '#374151'}
            />
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory ? styles.categoryChipTextSelected : null,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categoryOptions.map((option) => {
            const selected = selectedCategory === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.categoryChip, selected ? styles.categoryChipSelected : null]}
                onPress={() => setSelectedCategory(selected ? null : option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter by ${option.label}`}
              >
                <Icon
                  name="storefront-outline"
                  size={15}
                  color={selected ? '#FFFFFF' : '#374151'}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    selected ? styles.categoryChipTextSelected : null,
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {suggestionError && suggestionsOpen ? (
        <Text style={styles.suggestError}>{suggestionError}</Text>
      ) : null}
      {suggestions.length > 0 && suggestionsOpen ? (
        <View style={styles.suggestBox}>
          {suggestions.map((option) => (
            <Pressable
              key={option.key}
              style={styles.suggestRow}
              onPressIn={() => selectPlace(option)}
            >
              <Icon name="location-outline" size={16} color="#00926E" />
              <View style={styles.suggestCopy}>
                <Text style={styles.suggestLabel} numberOfLines={1}>{option.label}</Text>
                <Text style={styles.suggestSub} numberOfLines={1}>{option.subtitle}</Text>
              </View>
            </Pressable>
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
        <View
          style={mapBox ?? styles.map}
          pointerEvents={sheetExpanded ? 'none' : 'auto'}
          collapsable={false}
        >
          {Platform.OS === 'android' ? (
            <WebView
              ref={webRef}
              style={StyleSheet.absoluteFillObject}
              originWhitelist={['*']}
              source={{ html: tomtomLeafletHtml(tomtomTileUrl()) }}
              javaScriptEnabled
              domStorageEnabled
              onLoadEnd={() => setWebReady(true)}
              onMessage={(event) => {
                let message = null;
                try { message = JSON.parse(event.nativeEvent.data); } catch { message = null; }
                if (!message) return;
                if (message.type === 'region') {
                  setMapRegion({
                    latitude: Number(message.latitude),
                    longitude: Number(message.longitude),
                    latitudeDelta: Number(message.latitudeDelta),
                    longitudeDelta: Number(message.longitudeDelta),
                  });
                  return;
                }
                if (message.type === 'shop') {
                  const match = visibleShops.find((item) => String(item.shop.id) === String(message.id));
                  if (match) openShop(match.shop);
                }
              }}
            />
          ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            scrollEnabled={!sheetExpanded}
            zoomEnabled={!sheetExpanded}
            rotateEnabled={!sheetExpanded}
            pitchEnabled={!sheetExpanded}
            initialRegion={{
              latitude: savedCoord?.latitude ?? 9.082,
              longitude: savedCoord?.longitude ?? 8.6753,
              latitudeDelta: savedCoord ? 0.2 : 8,
              longitudeDelta: savedCoord ? 0.2 : 8,
            }}
            onRegionChangeComplete={setMapRegion}
            showsMyLocationButton={false}
            toolbarEnabled={false}
            mapPadding={{
              top: 72,
              right: 12,
              bottom: (sheetExpanded ? SHEET_EXPANDED : SHEET_PEEK) + 24,
              left: 12,
            }}
            mapType="standard"
          >
            {showMe && savedCoord ? (
              <Marker coordinate={savedCoord} pinColor="#1A73E8" title="You" zIndex={2} />
            ) : null}
            {visibleShops.map(({ shop, coordinate }) => {
              const categories = shopCategories(shop).map(formatCategory);
              return (
                <Marker
                  key={String(shop.id)}
                  coordinate={coordinate}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => openShop(shop)}
                >
                  <View style={styles.tip} collapsable={false}>
                    <Text style={styles.tipName} numberOfLines={1}>{shop.name || 'Shop'}</Text>
                    <Text style={styles.tipMeta} numberOfLines={2}>
                      {categories.length ? categories.join(', ') : 'No categories'}
                    </Text>
                    <Text style={styles.tipFee}>
                      Avg shipping {formatNaira(shop.averageShippingFee ?? shop.average_shipping_fee)}
                    </Text>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          )}
        </View>
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={[styles.zoomStack, { bottom: sheetControlsBottom }]}>
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
            style={[styles.locateBtn, { bottom: sheetControlsBottom }]}
            onPress={goToMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Show my location"
          >
            <Icon name="locate" size={22} color="#111111" />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.mapSheet,
              {
                height: sheetHeight,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
            collapsable={false}
            pointerEvents="auto"
          >
            <View {...sheetPan.panHandlers} style={styles.mapSheetHandleWrap}>
              <View style={styles.mapSheetGrabber} />
              <Pressable
                style={styles.mapSheetHead}
                onPress={() => snapSheet(!sheetExpanded)}
                accessibilityRole="button"
                accessibilityLabel={sheetExpanded ? 'Collapse shop list' : 'Expand shop list'}
              >
                <View style={styles.mapSheetHeadCopy}>
                  <Text style={styles.mapSheetTitle}>Shops in this area</Text>
                  <Text style={styles.mapSheetSubtitle}>
                    <Text style={styles.mapSheetCount}>{visibleShops.length}</Text>
                    {visibleShops.length === 1 ? ' shop nearby' : ' shops nearby'}
                  </Text>
                </View>
                <View style={styles.mapSheetHeadActions}>
                  <TouchableOpacity
                    style={styles.mapSheetAction}
                    onPress={() => navigation.navigate('Area-shops', {
                      shopIds: visibleShops.map((item) => item.shop.id),
                    })}
                    accessibilityRole="button"
                    accessibilityLabel="See all shops in this area"
                  >
                    <Icon name="arrow-forward" size={18} color="#111111" />
                  </TouchableOpacity>
                  <Icon
                    name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    color="#6B7280"
                  />
                </View>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#00926E" style={{ marginTop: 18 }} />
            ) : visibleShops.length === 0 ? (
              <Text style={styles.mapSheetEmpty}>No shops in this part of the map.</Text>
            ) : (
              <FlatList
                ref={mapListRef}
                style={styles.mapSheetList}
                data={visibleShops}
                keyExtractor={(item) => String(item.shop.id)}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                scrollEnabled
                bounces
                contentContainerStyle={styles.mapCardColumn}
                onScrollBeginDrag={() => {
                  if (!sheetExpanded) snapSheet(true);
                }}
                onScrollToIndexFailed={() => {}}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <ShopBrowseCard
                    item={item.shop}
                    width={SHOP_CARD_W}
                    onPress={() => openShop(item.shop)}
                  />
                )}
              />
            )}
          </Animated.View>
        </View>
      </View>

      <Modal
        visible={locationPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!locationPickerBusy) setLocationPickerOpen(false);
        }}
      >
        <View style={styles.locationModalRoot}>
          <ScrollView
            contentContainerStyle={styles.locationModalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.locationModalCard}>
              <View style={styles.locationModalIcon}>
                <Icon name="location-outline" size={36} color="#00926E" />
              </View>
              <Text style={styles.locationModalTitle}>Set your location</Text>
              <Text style={styles.locationModalBody}>
                We could not read your position. Type a city or area and choose a suggestion so shops near you can show on the map.
              </Text>
              <PlaceLocationField
                disabled={locationPickerBusy}
                onPlace={pickLocationFromModal}
              />
              {locationPickerBusy ? <ActivityIndicator color="#00926E" style={{ marginTop: 16 }} /> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  locationModalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  locationModalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 48,
  },
  locationModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  locationModalIcon: { alignItems: 'center', marginBottom: 10 },
  locationModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 10,
  },
  locationModalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  topChrome: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    zIndex: 6,
    elevation: 6,
  },
  searchWrap: {
    height: 48,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#111111' },
  categoryChips: {
    marginTop: 10,
    maxHeight: 44,
  },
  categoryChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 220,
  },
  categoryChipSelected: {
    backgroundColor: '#00926E',
    borderColor: '#00926E',
  },
  categoryChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  suggestError: {
    position: 'absolute',
    top: 118,
    left: 16,
    right: 16,
    color: '#B42318',
    fontSize: 13,
    zIndex: 6,
  },
  suggestBox: {
    position: 'absolute',
    top: 118,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    zIndex: 12,
    elevation: 12,
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
    bottom: 0,
    zIndex: 8,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
  },
  mapSheetHandleWrap: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  mapSheetGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  mapSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  mapSheetHeadCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  mapSheetTitle: { fontSize: 17, fontWeight: '700', color: '#111111' },
  mapSheetSubtitle: { marginTop: 2, fontSize: 13, color: '#6B7280' },
  mapSheetHeadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapSheetAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSheetCount: { fontSize: 13, fontWeight: '700', color: '#00926E' },
  mapSheetEmpty: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 7,
    padding: 14,
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
  },
  mapSheetList: {
    flex: 1,
  },
  mapCardColumn: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 12,
    flexGrow: 1,
  },
  tip: {
    width: 168,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
  },
  tipName: { fontSize: 13, fontWeight: '700', color: '#111111' },
  tipMeta: { marginTop: 2, fontSize: 11, color: '#4B5563' },
  tipFee: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#00926E' },
  tipTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 10,
    height: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
});
