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
import { reverseGeocodeToPlace } from '../../utils/deviceLocation';
import { useLocationLookup } from '../../hooks/useLocationLookup';
import { AUTH } from './theme';
import NigerianStatePickerModal, { matchNigerianState } from '../../components/NigerianStatePickerModal';
import PlaceLocationField from '../../components/PlaceLocationField';

function nigerianMobilePayload(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('234')) digits = digits.slice(3);
  digits = digits.replace(/^0+/, '');
  if (!/^[789]\d{9}$/.test(digits)) return null;
  return `+234${digits}`;
}

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
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [country, setCountry] = useState('Nigeria');
  const [submitting, setSubmitting] = useState(false);
  /** Set when GPS + geocode succeeds — included in saved `location`; cleared when user edits fields manually. */
  const [deviceCoords, setDeviceCoords] = useState(
    /** @type {{ latitude: number; longitude: number } | null} */ (null),
  );
  const [locLoading, setLocLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const { locate, locationOverlay } = useLocationLookup();

  const clearDeviceCoords = useCallback(() => {
    setDeviceCoords(null);
  }, []);

  const useDeviceLocation = useCallback(async () => {
    if (locLoading) return;
    setLocLoading(true);
    try {
      const coords = await locate();
      if (!coords) return;
      const { latitude, longitude } = coords;
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
      if (place.state) setState(matchNigerianState(place.state));
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
  }, [locLoading, locate]);

  const onContinue = useCallback(async () => {
    const phonePayload = nigerianMobilePayload(whatsapp);
    if (!phonePayload) {
      setPhoneError('Enter a valid Nigerian mobile number, for example 8012345678.');
      return;
    }
    setPhoneError('');
    if (!gender) {
      Alert.alert('Gender', 'Please select an option.');
      return;
    }
    const cityOk = city.trim().length >= 2;
    const regionOk = state.trim().length >= 2;
    const countryOk = country.trim().length >= 2;
    if (!deviceCoords || !cityOk || !regionOk) {
      Alert.alert('Location', 'Use your current location or choose a suggested place so we can save coordinates.');
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
      {locationOverlay}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Almost there</Text>
        <Text style={styles.sub}>WhatsApp, gender, and where you&apos;re based.</Text>

        <Text style={styles.label}>Phone number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.dialCode}>
            <Text style={styles.dialCodeText}>+234</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="8012345678"
            placeholderTextColor={AUTH.textMuted}
            keyboardType="phone-pad"
            value={whatsapp}
            onChangeText={(value) => {
              setWhatsapp(value);
              if (phoneError) setPhoneError('');
            }}
            editable={!submitting}
          />
        </View>
        {phoneError ? <Text style={styles.fieldError}>{phoneError}</Text> : null}

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
          Use your location, or type a place and choose a suggestion. A location is saved only when it has coordinates.
        </Text>
        <PlaceLocationField
          disabled={submitting}
          onClear={clearDeviceCoords}
          onPlace={(place) => {
            setCity(place.city);
            if (place.state) setState(matchNigerianState(place.state) || place.state);
            if (place.country) setCountry(place.country);
            setDeviceCoords({ latitude: place.latitude, longitude: place.longitude });
          }}
        />

        <Text style={styles.label}>State / region</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setStatePickerOpen(true)}
          disabled={submitting || locLoading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Select state"
        >
          <Text style={state ? styles.stateValue : styles.statePlaceholder}>
            {state || 'Select a state'}
          </Text>
        </TouchableOpacity>
        <NigerianStatePickerModal
          visible={statePickerOpen}
          selected={state}
          onClose={() => setStatePickerOpen(false)}
          onSelect={(next) => {
            clearDeviceCoords();
            setState(next);
            setStatePickerOpen(false);
          }}
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialCode: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AUTH.border,
    backgroundColor: AUTH.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: AUTH.text,
  },
  phoneInput: {
    flex: 1,
  },
  fieldError: {
    marginTop: 6,
    color: '#B42318',
    fontSize: 13,
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
    justifyContent: 'center',
  },
  stateValue: { fontSize: 16, color: AUTH.text },
  statePlaceholder: { fontSize: 16, color: AUTH.textMuted },
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
