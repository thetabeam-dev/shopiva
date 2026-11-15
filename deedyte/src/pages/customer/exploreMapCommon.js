import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
} from 'react-native';
import { getVendorsOnMapByCategory } from '../../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../../context/ProfileContext';
import { placeDetails, suggestPlaces } from '../../utils/tomtom';
import { getCurrentCoordinates, requestLocationPermission, reverseGeocodeToPlace } from '../../utils/deviceLocation';
import { updateUserProfileFields } from '../../api/user';
import {
  storedUserCoordinate,
  vendorCoordinate,
} from '../../utils/exploreMap';

export const SCREEN_W = Dimensions.get('window').width;
export const SCREEN_H = Dimensions.get('window').height;
/** Collapsed sheet: ~10% of the screen when inactive. */
export const SHEET_PEEK = Math.max(72, Math.round(SCREEN_H * (Platform.OS === 'android' ? 0.12 : 0.05)));
export const SHEET_EXPANDED = Math.round(SCREEN_H * 0.62);
export const SHOP_CARD_W = SCREEN_W - 32;

export function shopCategories(shop) {
  const raw = shop?.categories;
  const list = Array.isArray(raw)
    ? raw
    : String(raw ?? shop?.category ?? '')
      .replace(/[{}"]/g, '')
      .split(',');
  return list.map((item) => String(item).trim()).filter(Boolean);
}

export function formatCategory(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/** Compact map pin payload: logo circle, or first letter of the shop name. */
export function mapPinFromShop(shop, coordinate) {
  const name = String(shop?.name || 'Shop').trim() || 'Shop';
  const letterMatch = name.match(/[A-Za-z0-9]/);
  const letter = escapeHtml((letterMatch?.[0] || '?').toUpperCase());
  const rawLogo = String(shop?.logo ?? '').trim();
  const logo = /^https?:\/\//i.test(rawLogo) ? escapeAttr(rawLogo) : '';
  return {
    id: shop?.id,
    letter,
    logo,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}

export function formatNaira(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `₦${Math.round(amount).toLocaleString('en-NG')}`;
}

export function zoomForDelta(delta) {
  const span = Number(delta);
  if (!Number.isFinite(span) || span <= 0) return 6;
  return Math.max(3, Math.min(18, Math.round(Math.log2(360 / span))));
}

export function distanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const arc = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

export function tomtomLeafletHtml(tileUrl) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #E7EEF2; }
  .pin {
    width: 40px; height: 40px; border-radius: 20px; overflow: hidden;
    background: #E8F5F1; border: 2px solid #00926E;
    box-shadow: 0 1px 4px rgba(0,0,0,.28);
    display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .pin img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pin span {
    font-size: 16px; font-weight: 800; color: #00926E; line-height: 1;
    text-transform: uppercase;
  }
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
  function pinHtml(shop) {
    var logo = String(shop.logo || '').trim();
    var letter = String(shop.letter || '?').slice(0, 1);
    if (logo) {
      return '<div class="pin"><img src="' + logo + '" alt="" onerror="this.parentNode.innerHTML=\\'<span>' + letter + '</span>\\'" /></div>';
    }
    return '<div class="pin"><span>' + letter + '</span></div>';
  }
  window.renderPins = function (shops, me) {
    pins.clearLayers();
    (shops || []).forEach(function (shop) {
      const icon = L.divIcon({ className: '', html: pinHtml(shop), iconSize: [40, 40], iconAnchor: [20, 20] });
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

/**
 * Shared Explore Map controller (search, shops, sheet, location).
 * Platform screens supply map adapters via `mapApiRef.current`.
 * @param {import('@react-navigation/native').NavigationProp<Record<string, object | undefined>>} navigation
 * @param {{ params?: { initialQuery?: string } }} route
 * @param {{ current?: {
 *   moveToRegion?: (region: object) => void;
 *   zoomByFactor?: (factor: number) => void;
 *   setInteractive?: (on: boolean) => void;
 *   renderPins?: (shops: object[], me: object | null) => void;
 *   ready?: boolean;
 * } }} mapApiRef
 */
export function useExploreMapController(navigation, route, mapApiRef) {
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
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [mapReadyTick, setMapReadyTick] = useState(0);
  const mapListRef = useRef(null);
  const searchRef = useRef(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetHeight = useRef(new Animated.Value(SHEET_PEEK)).current;
  const sheetDragStart = useRef(SHEET_PEEK);
  const sheetListDragging = useRef(false);

  const notifyMapReady = () => setMapReadyTick((n) => n + 1);

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
    mapApiRef?.current?.moveToRegion?.(region);
  }, [savedLatitude, savedLongitude, mapApiRef, mapReadyTick]);

  useEffect(() => {
    mapApiRef?.current?.setInteractive?.(!sheetExpanded);
  }, [sheetExpanded, mapApiRef, mapReadyTick]);

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
    mapApiRef?.current?.renderPins?.(visibleShops, showMe ? savedCoord : null);
  }, [visibleShops, showMe, savedCoord, mapApiRef, mapReadyTick]);

  const moveMap = (region) => {
    setMapRegion(region);
    mapApiRef?.current?.moveToRegion?.(region);
  };

  const zoomBy = (factor) => {
    if (mapApiRef?.current?.zoomByFactor) {
      mapApiRef.current.zoomByFactor(factor);
      return;
    }
    const region = mapRegion ?? {
      latitude: savedLatitude ?? 9.082,
      longitude: savedLongitude ?? 8.6753,
      latitudeDelta: savedCoord ? 0.2 : 8,
      longitudeDelta: savedCoord ? 0.2 : 8,
    };
    moveMap({
      ...region,
      latitudeDelta: Math.min(40, Math.max(0.002, region.latitudeDelta * factor)),
      longitudeDelta: Math.min(40, Math.max(0.002, region.longitudeDelta * factor)),
    });
  };

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

  const openShop = (shop) => navigation.navigate('Vendor', { vendor: shop, category: '__all__' });

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSelectedPlace(null);
    searchRef.current?.blur();
  };

  return {
    insets,
    savedCoord,
    query,
    setQuery,
    suggestionsOpen,
    setSuggestionsOpen,
    suggestions,
    suggestionError,
    mapRegion,
    setMapRegion,
    showMe,
    locationPickerOpen,
    setLocationPickerOpen,
    locationPickerBusy,
    loading,
    selectedCategory,
    setSelectedCategory,
    mapListRef,
    searchRef,
    sheetExpanded,
    sheetHeight,
    sheetListDragging,
    snapSheet,
    sheetPan,
    categoryOptions,
    visibleShops,
    selectPlace,
    zoomBy,
    moveMap,
    goToMyLocation,
    pickLocationFromModal,
    openShop,
    clearSearch,
    notifyMapReady,
  };
}

export const exploreMapStyles = StyleSheet.create({
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
    zIndex: 20,
    elevation: 20,
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
    zIndex: 21,
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
    zIndex: 22,
    elevation: 22,
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
  body: {
    flex: 1,
  },
  mapPane: {
    flex: 1,
    backgroundColor: '#E7EEF2',
    overflow: 'hidden',
  },
  mapSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  mapControlsDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  zoomStackDock: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  locateBtnDock: {
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
  mapSheetHost: {
    zIndex: 20,
    elevation: 24,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  mapSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    // iOS continuous corners so radius actually clips the white fill
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
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
});
