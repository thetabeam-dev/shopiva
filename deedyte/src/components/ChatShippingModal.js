import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reverseGeocodeToPlace } from '../utils/deviceLocation';
import { useLocationLookup } from '../hooks/useLocationLookup';
import NigerianStatePickerModal, { matchNigerianState } from './NigerianStatePickerModal';
import zones from '../json/zones.json';

const BRAND = '#00926E';
const BLACK = '#111111';
const MUTED = '#757575';
const BORDER = '#E0E0E0';
const CARD_RADIUS = 10;

function citiesForState(stateName) {
  return zones.find((zone) => zone.name === stateName)?.cities ?? [];
}

function matchCity(stateName, raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return '';
  return citiesForState(stateName).find((city) => city.toLowerCase() === value) ?? '';
}

function matchCityLoose(stateName, candidates) {
  const cities = citiesForState(stateName);
  const values = candidates.map((item) => String(item ?? '').trim().toLowerCase()).filter(Boolean);
  for (const value of values) {
    const exact = cities.find((city) => city.toLowerCase() === value);
    if (exact) return exact;
  }
  for (const value of values) {
    const close = cities.find((city) => {
      const name = city.toLowerCase();
      return name.includes(value) || value.includes(name);
    });
    if (close) return close;
  }
  return '';
}

/**
 * @param {{
 *   visible: boolean;
 *   sending?: boolean;
 *   onCancel: () => void;
 *   onSubmit: (payload: Record<string, unknown>) => void | Promise<void>;
 *   initialValue?: Record<string, unknown> | null;
 * }} props
 */
export default function ChatShippingModal({ visible, sending = false, onCancel, onSubmit, initialValue = null }) {
  const insets = useSafeAreaInsets();
  const { locate, locationOverlay } = useLocationLookup();
  const [street, setStreet] = useState('');
  const [area1, setArea1] = useState('');
  const [area2, setArea2] = useState('');
  const [stateName, setStateName] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [coords, setCoords] = useState(
    /** @type {{ latitude: number; longitude: number } | null} */ (null),
  );
  const [isLocating, setIsLocating] = useState(false);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible || !initialValue || typeof initialValue !== 'object') return;
    const text = (v) => String(v ?? '').trim();
    setStreet(text(initialValue.street));
    setArea1(text(initialValue.area1 ?? initialValue.junction));
    setArea2(text(initialValue.area2));
    setStateName(text(initialValue.state));
    setCity(text(initialValue.city));
    setZip(text(initialValue.zip));
    const lat = Number(initialValue.latitude);
    const lng = Number(initialValue.longitude);
    setCoords(Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null);
  }, [visible, initialValue]);

  const onUseCurrentLocation = useCallback(async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const nextCoords = await locate();
      if (!nextCoords) return;
      const place = await reverseGeocodeToPlace(nextCoords.latitude, nextCoords.longitude);
      const nextStreet = String(place?.street ?? '').trim();
      const nextZip = String(place?.zip ?? '').trim();
      const nextState = matchNigerianState(String(place?.state ?? ''));
      const nextCity = nextState
        ? matchCityLoose(nextState, [place?.suburb, place?.town, place?.city, place?.neighbourhood])
        : '';
      const areaCandidates = [place?.suburb, place?.town, place?.neighbourhood, place?.city]
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      const nextArea1 = areaCandidates.find((item) => item.toLowerCase() !== nextCity.toLowerCase()) || areaCandidates[0] || '';
      const nextArea2 = areaCandidates.find(
        (item) => item.toLowerCase() !== nextArea1.toLowerCase() && item.toLowerCase() !== nextCity.toLowerCase(),
      ) || '';
      if (nextStreet) setStreet(nextStreet);
      if (nextArea1) setArea1(nextArea1);
      if (nextArea2) setArea2(nextArea2);
      if (nextZip) setZip(nextZip);
      if (nextState) setStateName(nextState);
      if (nextCity) setCity(nextCity);
      setCoords(nextCoords);
    } catch (err) {
      Alert.alert('Location', err instanceof Error ? err.message : 'Could not access your location.');
    } finally {
      setIsLocating(false);
    }
  }, [isLocating, locate]);

  const submit = () => {
    if (sending) return;
    const nextStreet = String(street).trim();
    const nextArea1 = String(area1).trim();
    const nextArea2 = String(area2).trim();
    const nextState = String(stateName).trim();
    const nextCity = String(city).trim();
    const nextZip = String(zip).trim();
    if (nextStreet.length < 2) {
      Alert.alert('Street address required', 'Enter your street address.');
      return;
    }
    if (!nextArea1) {
      Alert.alert('Area required', 'Enter a junction or landmark.');
      return;
    }
    if (!nextState) {
      Alert.alert('State required', 'Select a state.');
      return;
    }
    if (!nextCity) {
      Alert.alert('City required', 'Select a city.');
      return;
    }
    void onSubmit({
      street: nextStreet,
      area1: nextArea1,
      area2: nextArea2,
      junction: nextArea1,
      city: nextCity,
      state: nextState,
      zip: nextZip,
      country: 'Nigeria',
      label: [nextCity, nextState].filter(Boolean).join(', '),
      latitude: coords?.latitude,
      longitude: coords?.longitude,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {locationOverlay}
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Shipping address</Text>
            <Pressable
              onPress={() => { void onUseCurrentLocation(); }}
              disabled={isLocating || sending}
              style={[styles.locationBtn, isLocating ? styles.locationBtnDisabled : null]}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={BRAND} />
              ) : (
                <Icon name="locate-outline" size={14} color={BRAND} />
              )}
              <Text style={styles.locationBtnText}>{isLocating ? 'Locating…' : 'Use current location'}</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={styles.label}>Street address</Text>
            <TextInput
              style={styles.input}
              value={street}
              onChangeText={setStreet}
              placeholder="123 Main Street"
              placeholderTextColor="#AAA"
            />
            <Text style={styles.label}>Area 1 (e.g: Junction/Landmark)</Text>
            <TextInput
              style={styles.input}
              value={area1}
              onChangeText={setArea1}
              placeholder="Estate, landmark, or nearest bus stop"
              placeholderTextColor="#AAA"
            />
            <Text style={styles.label}>Area 2 (optional)</Text>
            <TextInput
              style={styles.input}
              value={area2}
              onChangeText={setArea2}
              placeholder="Extra landmark or direction"
              placeholderTextColor="#AAA"
            />
            <Text style={styles.label}>State</Text>
            <Pressable
              onPress={() => setStatePickerOpen(true)}
              style={styles.select}
            >
              <Text style={stateName ? styles.selectValue : styles.selectPlaceholder}>
                {stateName || 'Select a state'}
              </Text>
              <Icon name="chevron-down" size={18} color={MUTED} />
            </Pressable>
            <Text style={styles.label}>City</Text>
            <Pressable
              onPress={() => {
                if (!stateName) {
                  Alert.alert('Select a state', 'Select a state before choosing a city.');
                  return;
                }
                setCityPickerOpen(true);
              }}
              style={styles.select}
            >
              <Text style={city ? styles.selectValue : styles.selectPlaceholder}>
                {city || (stateName ? 'Select a city' : 'Select a state first')}
              </Text>
              <Icon name="chevron-down" size={18} color={MUTED} />
            </Pressable>
            <Text style={styles.label}>ZIP / Postal code (optional)</Text>
            <TextInput
              style={styles.input}
              value={zip}
              onChangeText={setZip}
              placeholder="101241"
              placeholderTextColor="#AAA"
            />
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={sending}
              style={[styles.sendBtn, sending ? styles.sendBtnDisabled : null]}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendText}>Continue</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      <NigerianStatePickerModal
        visible={statePickerOpen}
        selected={stateName}
        onClose={() => setStatePickerOpen(false)}
        onSelect={(next) => {
          setStateName(next);
          setCity((prev) => matchCity(next, prev));
          setStatePickerOpen(false);
        }}
      />
      <Modal visible={cityPickerOpen} animationType="slide" transparent onRequestClose={() => setCityPickerOpen(false)}>
        <View style={styles.pickerRoot}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setCityPickerOpen(false)} />
          <View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handle} />
            <Text style={styles.pickerTitle}>Select city</Text>
            <FlatList
              data={citiesForState(stateName)}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item === city;
                return (
                  <Pressable
                    onPress={() => {
                      setCity(item);
                      setCityPickerOpen(false);
                    }}
                    style={styles.cityRow}
                  >
                    <Text style={[styles.cityRowText, selected ? styles.cityRowTextSelected : null]}>{item}</Text>
                    {selected ? <Icon name="checkmark" size={18} color={BRAND} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: BLACK },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 146, 110, 0.35)',
    backgroundColor: 'rgba(0, 146, 110, 0.08)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  locationBtnDisabled: { opacity: 0.7 },
  locationBtnText: {
    marginLeft: 6,
    color: BRAND,
    fontSize: 12,
    fontWeight: '700',
  },
  body: { paddingBottom: 8 },
  label: { fontSize: 12, color: MUTED, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: BLACK,
  },
  select: {
    backgroundColor: '#F5F5F5',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: { fontSize: 16, color: BLACK },
  selectPlaceholder: { fontSize: 16, color: '#AAA' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: BRAND },
  sendBtn: {
    flex: 1,
    height: 44,
    borderRadius: 7,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  sendBtnDisabled: { opacity: 0.88 },
  pickerRoot: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '70%',
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: BLACK, marginBottom: 8 },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  cityRowText: { fontSize: 16, color: BLACK },
  cityRowTextSelected: { color: BRAND, fontWeight: '700' },
});
