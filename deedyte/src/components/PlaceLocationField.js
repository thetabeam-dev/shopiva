import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { getCurrentCoordinates, requestLocationPermission, reverseGeocodeToPlace } from '../utils/deviceLocation';
import { placeDetails, suggestPlaces } from '../utils/tomtom';

/**
 * GPS fix or a Google place the user picks. Free text is not a saved location.
 * @param {{ onPlace: (place: { label: string; city: string; state: string; country: string; latitude: number; longitude: number }) => void; onClear?: () => void; disabled?: boolean }} props
 */
export default function PlaceLocationField({ onPlace, onClear, disabled, initialValue }) {
  const [text, setText] = useState(String(initialValue ?? ''));
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const next = String(initialValue ?? '').trim();
    if (!next) return;
    setText((current) => (current.trim() ? current : next));
  }, [initialValue]);

  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggestPlaces(q, controller.signal)
        .then((rows) => setSuggestions(rows))
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          setSuggestions([]);
          setError(err instanceof Error ? err.message : 'Location suggestions are unavailable.');
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, open]);

  const choosePlace = async (option) => {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError('');
    setOpen(false);
    try {
      const details = await placeDetails(option.placeId);
      const latitude = details.latitude;
      const longitude = details.longitude;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setError('That place has no coordinates. Choose another suggestion.');
        return;
      }
      const city = details.city || option.label;
      const state = details.state;
      const country = details.country || 'Nigeria';
      const label = [city, state].filter(Boolean).join(', ');
      setText(label || option.label);
      onPlace({ label: label || option.label, city, state, country, latitude, longitude });
    } catch {
      setError('Could not load that place. Try another suggestion.');
    } finally {
      setBusy(false);
    }
  };

  const useDevice = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setOpen(false);
    try {
      const granted = await requestLocationPermission({ interactive: true });
      if (!granted) {
        setError('Location is off. Type a place and choose a suggestion.');
        return;
      }
      const coords = await getCurrentCoordinates({ exact: true });
      const place = await reverseGeocodeToPlace(coords.latitude, coords.longitude);
      const label = [place.city, place.state].filter(Boolean).join(', ');
      setText(label);
      onPlace({
        label,
        city: place.city || '',
        state: place.state || '',
        country: place.country || 'Nigeria',
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch {
      setError('Could not read your location. Type a place and choose a suggestion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <TouchableOpacity style={styles.gpsBtn} onPress={useDevice} disabled={disabled || busy}>
        {busy ? <ActivityIndicator color="#00926E" /> : <Icon name="navigate-outline" size={18} color="#00926E" />}
        <Text style={styles.gpsText}>Use my location</Text>
      </TouchableOpacity>
      <TextInput
        value={text}
        editable={!disabled && !busy}
        onChangeText={(value) => {
          setText(value);
          setOpen(true);
          setError('');
          onClear?.();
        }}
        placeholder="Type a city or area"
        placeholderTextColor="#9A9A9A"
        style={styles.input}
        autoCorrect={false}
      />
      {open && suggestions.length > 0 ? (
        <View style={styles.list}>
          {suggestions.map((option) => (
            <Pressable key={option.placeId} style={styles.row} onPressIn={() => choosePlace(option)}>
              <Icon name="location-outline" size={16} color="#00926E" />
              <View style={styles.copy}>
                <Text style={styles.label} numberOfLines={1}>{option.label}</Text>
                {option.subtitle ? <Text style={styles.sub} numberOfLines={1}>{option.subtitle}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gpsText: { color: '#00926E', fontSize: 15, fontWeight: '700' },
  input: {
    height: 48,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  list: {
    marginTop: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  copy: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: '#111111' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  error: { marginTop: 6, color: '#B42318', fontSize: 13 },
});
