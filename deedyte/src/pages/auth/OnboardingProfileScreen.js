import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchCurrentUserOrStatus,
  updateUserPhone,
  updateUserProfileFields,
} from '../../api/user';
import { getStoredAccessToken, getStoredPreAuthChoice, getStoredUser, saveSession } from '../../auth/session';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../../utils/deviceLocation';
import { AUTH } from './theme';

const GENDERS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'other', label: 'Other' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * WhatsApp number, gender, city / region / country.
 */
export default function OnboardingProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [whatsapp, setWhatsapp] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  /** Set when GPS + geocode succeeds — included in saved `location`; cleared when user edits fields manually. */
  const [deviceCoords, setDeviceCoords] = useState(
    /** @type {{ latitude: number; longitude: number } | null} */ (null),
  );
  const [locLoading, setLocLoading] = useState(false);

  const clearDeviceCoords = useCallback(() => {
    setDeviceCoords(null);
  }, []);

  const useDeviceLocation = useCallback(async () => {
    setLocLoading(true);
    try {
      const ok = await requestLocationPermission();
      if (!ok) {
        Alert.alert(
          'Location off',
          'No problem — enter your city, state, and country in the fields below.',
        );
        return;
      }
      const { latitude, longitude } = await getCurrentCoordinates();
      const place = await reverseGeocodeToPlace(latitude, longitude);
      const hasAny = place.city || place.state || place.country;
      if (!hasAny) {
        Alert.alert(
          'Could not detect place',
          'Enter your city, state, and country manually below.',
        );
        return;
      }
      if (place.city) setCity(place.city);
      if (place.state) setState(place.state);
      if (place.country) setCountry(place.country);
      setDeviceCoords({ latitude, longitude });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const denied = /denied|permission|authorized|disabled|unavailable/i.test(msg);
      Alert.alert(
        denied ? 'Location unavailable' : 'Location',
        denied
          ? 'You can enter your city, state, and country manually below.'
          : `${msg}\n\nYou can still fill the fields manually.`,
      );
    } finally {
      setLocLoading(false);
    }
  }, []);

  const onContinue = useCallback(async () => {
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('WhatsApp number', 'Enter a valid number (include country code if needed).');
      return;
    }
    if (!gender) {
      Alert.alert('Gender', 'Please select an option.');
      return;
    }
    const cityOk = city.trim().length >= 2;
    const regionOk = state.trim().length >= 2;
    const countryOk = country.trim().length >= 2;
    if (!cityOk || !regionOk || !countryOk) {
      Alert.alert('Location', 'Fill in city, state / region, and country (at least 2 characters each).');
      return;
    }

    const token = await getStoredAccessToken();
    if (!token) {
      Alert.alert('Session', 'Please sign in again.');
      return;
    }

    /** Backend may key the user id as `id`, `user_id`, or `uid` (see normalizeUser.js). */
    const pickId = (u) => {
      if (!u || typeof u !== 'object') return undefined;
      const o = /** @type {Record<string, unknown>} */ (u);
      const raw = o.id ?? o.user_id ?? o.uid;
      const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    const currentUserRes = await fetchCurrentUserOrStatus();
    if (currentUserRes.status === 401) {
      Alert.alert('Session', 'Please sign in again.');
      return;
    }
    const stored = await getStoredUser();
    const id = pickId(currentUserRes.user) ?? pickId(stored);
    if (id == null) {
      Alert.alert(
        'Profile not found',
        currentUserRes.message ||
          'We couldn’t load your account. Check your connection and try again.',
      );
      return;
    }

    const trimmed = whatsapp.trim();
    const phonePayload = trimmed.startsWith('+') ? trimmed : `+${digits}`;

    setSubmitting(true);
    try {
      const phoneRes = await updateUserPhone(Number(id), phonePayload);
      if (!phoneRes.ok) {
        Alert.alert('Could not save phone', phoneRes.message || 'Try again.');
        return;
      }

      const profileRes = await updateUserProfileFields(Number(id), {
        gender,
        location: {
          city: city.trim(),
          state: state.trim(),
          country: country.trim(),
          ...(deviceCoords && {
            latitude: deviceCoords.latitude,
            longitude: deviceCoords.longitude,
          }),
        },
      });
      if (!profileRes.ok) {
        Alert.alert('Could not save profile', profileRes.message || 'Try again.');
        return;
      }

      const updatedProfile = (await fetchCurrentUserOrStatus()).user;
      await saveSession(token, updatedProfile ?? profileRes.user ?? phoneRes.user ?? null);

      const preAuthChoice = await getStoredPreAuthChoice();
      const isVendorIntent = preAuthChoice === 'vendor';

      if (!isVendorIntent) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'home' }],
          }),
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Shop-Onboarding' }],
          }),
        );
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [whatsapp, gender, city, state, country, navigation, deviceCoords]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Almost there</Text>
        <Text style={styles.sub}>WhatsApp, gender, and where you&apos;re based.</Text>

        <Text style={styles.label}>WhatsApp number</Text>
        <TextInput
          style={styles.input}
          placeholder="+2348012345678"
          placeholderTextColor={AUTH.textMuted}
          keyboardType="phone-pad"
          value={whatsapp}
          onChangeText={setWhatsapp}
          editable={!submitting}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g.key}
              style={[styles.chip, gender === g.key && styles.chipOn]}
              onPress={() => setGender(g.key)}
              disabled={submitting}
            >
              <Text style={[styles.chipText, gender === g.key && styles.chipTextOn]}>{g.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Where you&apos;re based</Text>
        <Text style={styles.locHint}>
          Use your phone&apos;s GPS to fill city and country, or type them yourself.
        </Text>
        <TouchableOpacity
          style={[styles.locBtn, (submitting || locLoading) && styles.locBtnDisabled]}
          onPress={useDeviceLocation}
          disabled={submitting || locLoading}
          activeOpacity={0.85}
        >
          {locLoading ? (
            <ActivityIndicator color={AUTH.primary} />
          ) : (
            <Icon name="navigate-outline" size={22} color="#000000" />
          )}
          <Text style={styles.locBtnText}>Use current location</Text>
        </TouchableOpacity>

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor={AUTH.textMuted}
          value={city}
          onChangeText={(t) => {
            clearDeviceCoords();
            setCity(t);
          }}
          editable={!submitting && !locLoading}
        />

        <Text style={styles.label}>State / region</Text>
        <TextInput
          style={styles.input}
          placeholder="State or region"
          placeholderTextColor={AUTH.textMuted}
          value={state}
          onChangeText={(t) => {
            clearDeviceCoords();
            setState(t);
          }}
          editable={!submitting && !locLoading}
        />

        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          placeholder="Country"
          placeholderTextColor={AUTH.textMuted}
          value={country}
          onChangeText={(t) => {
            clearDeviceCoords();
            setCountry(t);
          }}
          editable={!submitting && !locLoading}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, submitting && styles.primaryDisabled]}
          onPress={onContinue}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Continue to Deedyte</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AUTH.bg,
  },
  scroll: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: AUTH.text,
    marginBottom: 8,
  },
  sub: {
    fontSize: 15,
    color: AUTH.textMuted,
    marginBottom: 24,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH.text,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: AUTH.text,
    backgroundColor: AUTH.inputBg,
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.border,
    backgroundColor: AUTH.inputBg,
  },
  chipOn: {
    borderColor: AUTH.primary,
    backgroundColor: '#E8F5F1',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: AUTH.text,
  },
  chipTextOn: {
    color: AUTH.primary,
  },
  locHint: {
    fontSize: 13,
    color: AUTH.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  locBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.primary,
    backgroundColor: '#F0FAF7',
    marginBottom: 8,
  },
  locBtnDisabled: {
    opacity: 0.55,
  },
  locBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: AUTH.primary,
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: AUTH.primary,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryDisabled: {
    opacity: 0.85,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
