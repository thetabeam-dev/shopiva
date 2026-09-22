import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BLACK, MUTED, settingsFormStyles as s } from './settingsFields';

const WINDOW_W = Dimensions.get('window').width;
const MAP_HEIGHT = 240;
const MAP_WIDTH = WINDOW_W - 32;

/** Default map center (Mumbai) before GPS or user pan. */
const DEFAULT_REGION = {
  latitude: 19.076,
  longitude: 72.8777,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const DEBOUNCE_MS = 650;

/**
 * Reverse geocode via OpenStreetMap Nominatim (no API key).
 * Respect usage: single-threaded, identify app — see https://operations.osmfoundation.org/policies/nominatim/
 */
async function reverseGeocodeNominatim(lat, lon, signal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(lat),
  )}&lon=${encodeURIComponent(String(lon))}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Deedyte/1.0 (location-settings; contact: app-support@deedyte.local)',
    },
  });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  return res.json();
}

function pickCity(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.suburb ||
    addr.hamlet ||
    addr.municipality ||
    ''
  );
}

function pickRegion(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return addr.state || addr.region || addr.county || '';
}

function pickCountry(addr) {
  if (!addr || typeof addr !== 'object') return '';
  return addr.country || '';
}

export default function SettingsLocationScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const geocodeAbortRef = useRef(null);
  const debounceRef = useRef(null);

  const [latitude, setLatitude] = useState(DEFAULT_REGION.latitude);
  const [longitude, setLongitude] = useState(DEFAULT_REGION.longitude);
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [locateBusy, setLocateBusy] = useState(false);

  const runReverseGeocode = useCallback((lat, lon) => {
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
    const controller = new AbortController();
    geocodeAbortRef.current = controller;
    setGeocodeBusy(true);

    reverseGeocodeNominatim(lat, lon, controller.signal)
      .then((data) => {
        const addr = data?.address;
        setCity(pickCity(addr));
        setRegion(pickRegion(addr));
        setCountry(pickCountry(addr));
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setCity('');
        setRegion('');
        setCountry('');
      })
      .finally(() => {
        setGeocodeBusy(false);
      });
  }, []);

  const scheduleGeocode = useCallback(
    (lat, lon) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runReverseGeocode(lat, lon), DEBOUNCE_MS);
    },
    [runReverseGeocode],
  );

  useEffect(() => {
    runReverseGeocode(DEFAULT_REGION.latitude, DEFAULT_REGION.longitude);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
    };
  }, [runReverseGeocode]);

  const onRegionChangeComplete = useCallback(
    (r) => {
      setLatitude(r.latitude);
      setLongitude(r.longitude);
      scheduleGeocode(r.latitude, r.longitude);
    },
    [scheduleGeocode],
  );

  const useCurrentLocation = useCallback(() => {
    setLocateBusy(true);
    Geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const next = {
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        };
        mapRef.current?.animateToRegion(next, 450);
        setLatitude(lat);
        setLongitude(lon);
        scheduleGeocode(lat, lon);
        setLocateBusy(false);
      },
      (err) => {
        setLocateBusy(false);
        Alert.alert(
          'Location',
          err?.message || 'Could not read your position. Enable location permission or drag the map.',
        );
      },
      { enableHighAccuracy: true, timeout: 18000, maximumAge: 60000 },
    );
  }, [scheduleGeocode]);

  const onSave = useCallback(() => {
    const parts = [city.trim(), region.trim(), country.trim()].filter(Boolean);
    const line = parts.join(', ');
    const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    Alert.alert(
      'Saved',
      line
        ? `Your location preferences have been updated.\n\n${line}\n(${coords})`
        : `Your map pin has been saved.\n\n${coords}`,
    );
  }, [city, region, country, latitude, longitude]);

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <Text style={s.intro}>
          Pan and zoom the map so the pin sits where you live or shop most often. We fill city and
          country for you — you can still edit the text.
        </Text>

        <View style={styles.mapCard}>
          <View style={[styles.mapWrap, { width: MAP_WIDTH, height: MAP_HEIGHT }]}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              initialRegion={DEFAULT_REGION}
              onRegionChangeComplete={onRegionChangeComplete}
              rotateEnabled={false}
              pitchEnabled={false}
              showsCompass={false}
              showsPointsOfInterest
              showsBuildings={false}
              mapType="standard"
            />
            <View style={styles.pinOverlay} pointerEvents="none">
              <Icon name="location-sharp" size={42} color={BLACK} style={styles.pinIcon} />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.useLocBtn, pressed && styles.useLocBtnPressed]}
            onPress={useCurrentLocation}
            disabled={locateBusy}
          >
            {locateBusy ? (
              <ActivityIndicator color={BLACK} />
            ) : (
              <>
                <Icon name="navigate-outline" size={20} color={BLACK} />
                <Text style={styles.useLocText}>Use current location</Text>
              </>
            )}
          </Pressable>

          <View style={styles.geoRow}>
            {geocodeBusy ? (
              <>
                <ActivityIndicator size="small" color={MUTED} />
                <Text style={styles.geoHint}>Looking up address…</Text>
              </>
            ) : (
              <Text style={styles.geoHint} numberOfLines={1}>
                Pin: {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </Text>
            )}
          </View>
        </View>

        <View style={s.card}>
          <Field label="City">
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor={MUTED}
              style={s.input}
              autoCapitalize="words"
            />
          </Field>
          <View style={s.divider} />
          <Field label="Region / state (optional)">
            <TextInput
              value={region}
              onChangeText={setRegion}
              placeholder="Region or state"
              placeholderTextColor={MUTED}
              style={s.input}
              autoCapitalize="words"
            />
          </Field>
          <View style={s.divider} />
          <Field label="Country">
            <TextInput
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              placeholderTextColor={MUTED}
              style={s.input}
              autoCapitalize="words"
            />
          </Field>
        </View>

        <Pressable style={({ pressed }) => [s.saveBtn, pressed && s.saveBtnPressed]} onPress={onSave}>
          <Text style={s.saveBtnText}>Save location</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
    padding: 12,
    marginBottom: 16,
    alignSelf: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  mapWrap: {
    alignSelf: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ECECEC',
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  pinIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  useLocBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F3F5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0E0E0',
  },
  useLocBtnPressed: {
    opacity: 0.9,
  },
  useLocText: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
  },
  geoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    minHeight: 22,
  },
  geoHint: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },
});
