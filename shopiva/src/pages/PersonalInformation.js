import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import Geolocation from '@react-native-community/geolocation';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile } from '../context/ProfileContext';
import { genderToApi, isVendorAccountRole, parseLocationString } from '../profile/normalizeUser';

const BG = '#FFFFFF';
const BLACK = '#000000';
const MUTED = '#8E8E93';
const FIELD_BG = '#F5F5F5';
const ICON_COLOR = '#6C6C6C';
const CLEAR_ICON = '#C7C7CC';
const LINK_BLUE = '#007AFF';

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

async function reverseGeocodeNominatim(lat, lon, signal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(lat),
  )}&lon=${encodeURIComponent(String(lon))}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Deedyte/1.0 (personal-information; contact: app-support@deedyte.local)',
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

function formatAddressFromNominatim(data) {
  const addr = data?.address;
  if (!addr) return '';
  const parts = [pickCity(addr), pickRegion(addr), pickCountry(addr)].filter(Boolean);
  return parts.join(', ');
}

/**
 * @param {string} fullName
 * @returns {{ fname: string; lname: string }}
 */
function splitFullName(fullName) {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { fname: '', lname: '' };
  const fname = parts[0];
  const lname = parts.length > 1 ? parts.slice(1).join(' ') : '';
  return { fname, lname };
}

/**
 * Build the initial editable name from a normalized profile.
 * Prefers API-backed profileName; falls back to displayName when present
 * (for buyers it may include the email-prefix fallback, but as a starting
 * value for editing that's acceptable — the user can clear it).
 * @param {{ profileName?: string; displayName?: string; email?: string } | null | undefined} u
 */
function initialNameFor(u) {
  if (!u) return '';
  const profile = String(u.profileName ?? '').trim();
  if (profile) return profile;
  const display = String(u.displayName ?? '').trim();
  if (!display) return '';
  /** Skip the email-prefix fallback so users start from a blank field rather than "". */
  const email = String(u.email ?? '').trim();
  if (email && display === email.split('@')[0]) return '';
  return display;
}

export default function PersonalInformationScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, saveProfileFields, refresh } = useProfile();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  useEffect(() => {
    if (!user?.id) return;
    setName(initialNameFor(user));
    setLocation(user.locationDisplay ?? '');
    setGender(user.gender ?? null);
  }, [user?.id, user?.profileName, user?.displayName, user?.email, user?.locationDisplay, user?.gender]);

  const onSave = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Profile', 'Sign in to save your profile.');
      return;
    }
    const fields = {};

    const trimmedName = name.trim();
    const previousName = initialNameFor(user);
    if (trimmedName !== previousName) {
      if (trimmedName.length > 0 && trimmedName.length < 2) {
        Alert.alert('Name', 'Enter at least 2 characters, or leave the field unchanged.');
        return;
      }
      const { fname, lname } = splitFullName(trimmedName);
      fields.fname = fname;
      fields.lname = lname;
    }

    const g = genderToApi(gender);
    if (g) fields.gender = g;
    const locParsed = parseLocationString(location);
    if (locParsed.city || locParsed.state || locParsed.country) {
      fields.location = locParsed;
    }
    if (Object.keys(fields).length === 0) {
      Alert.alert('Nothing to save', 'Update your name, gender, or location, then try again.');
      return;
    }
    setSaving(true);
    try {
      const out = await saveProfileFields(fields);
      if (out.ok) {
        Alert.alert('Saved', 'Your profile has been updated.');
      } else {
        Alert.alert('Could not save', out.message || 'Try again.');
      }
    } finally {
      setSaving(false);
    }
  }, [user, name, gender, location, saveProfileFields]);

  const onEditImage = useCallback(() => {

    Alert.alert('Edit image', 'Photo picker will be available in a future update.');
  }, []);

  const vendorAccount = isVendorAccountRole(user?.roleRaw);

  const avatarUri = user?.avatarUrl?.trim() || '';
  const avatarLetterSource = vendorAccount
    ? user?.profileName?.trim() || '?'
    : user?.displayName?.trim() || user?.email?.trim() || '?';
  const avatarLetter = avatarLetterSource.charAt(0).toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 32) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarBlock}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} resizeMode="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}>
              <Text style={styles.avatarPhText}>{avatarLetter}</Text>
            </View>
          )}
          <Pressable onPress={onEditImage} hitSlop={12} accessibilityRole="button">
            <Text style={styles.editImageLink}>Edit image</Text>
          </Pressable>
        </View>

        <View style={styles.fieldRow}>
          <Icon name="person-outline" size={20} color={ICON_COLOR} style={styles.fieldIcon} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={MUTED}
            style={styles.fieldInput}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            editable={!saving}
          />
          {name.length > 0 ? (
            <Pressable
              onPress={() => setName('')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Clear name"
            >
              <Icon name="close" size={18} color={CLEAR_ICON} />
            </Pressable>
          ) : null}
        </View>

        <ReadOnlyRow
          icon="mail-outline"
          value={user?.email}
          hint="Edit in Settings"
          onPress={() => navigation.navigate('profile-settings-email')}
        />
        <ReadOnlyRow
          icon="logo-whatsapp"
          value={user?.phone}
          hint="Edit in Settings"
          onPress={() => navigation.navigate('profile-settings-whatsapp')}
        />

        <View style={styles.fieldRow}>
          <Icon name="male-female-outline" size={20} color={ICON_COLOR} style={styles.fieldIcon} />
          <Dropdown
            style={styles.genderDropdown}
            containerStyle={styles.genderDropdownList}
            placeholderStyle={styles.dropdownPlaceholder}
            selectedTextStyle={styles.dropdownSelected}
            itemTextStyle={styles.dropdownItem}
            data={GENDER_OPTIONS}
            labelField="label"
            valueField="value"
            placeholder="Select gender"
            value={gender}
            onChange={(item) => setGender(item.value)}
          />
        </View>

        <LocationBlock value={location} onChangeText={setLocation} />

        <ReadOnlyRow icon="shield-checkmark-outline" value={user?.roleLabel} />

        <Text style={styles.infoHint}>
          Edit your name, gender, and location here. Email and WhatsApp can be changed in{' '}
          <Text style={styles.infoHintEm}>Settings</Text>.
          {vendorAccount ? ' Your shop name is managed in Profile → Shop info.' : ''}
        </Text>

        <Text style={styles.securityHint}>
          Password and other security options: Profile →{' '}
          <Text style={styles.securityHintEm}>Settings</Text>.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed, saving && styles.saveBtnDisabled]}
          onPress={() => {
            onSave().catch(() => {});
          }}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save location and gender"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save changes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReadOnlyRow({ icon, value, onPress, hint }) {
  const display = value != null && String(value).trim() !== '' ? String(value).trim() : '—';

  const row = (
    <>
      <Icon name={icon} size={20} color={ICON_COLOR} style={styles.fieldIcon} />
      <View style={styles.readOnlyBody}>
        <Text style={styles.readOnlyText} numberOfLines={3}>
          {display}
        </Text>
        {hint ? <Text style={styles.readOnlyHint}>{hint}</Text> : null}
      </View>
      {onPress ? (
        <Icon name="chevron-forward" size={18} color={MUTED} />
      ) : (
        <View style={styles.endPlaceholder} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.readOnlyRow, pressed && styles.readOnlyRowPressed]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {row}
      </Pressable>
    );
  }

  return <View style={styles.readOnlyRow}>{row}</View>;
}

function LocationBlock({ value, onChangeText }) {
  const [locateBusy, setLocateBusy] = useState(false);
  const geocodeAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
    };
  }, []);

  const useDeviceLocation = useCallback(() => {
    if (geocodeAbortRef.current) {
      geocodeAbortRef.current.abort();
    }
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    setLocateBusy(true);
    Geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const data = await reverseGeocodeNominatim(lat, lon, controller.signal);
          const line = formatAddressFromNominatim(data);
          onChangeText(line || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        } catch {
          onChangeText(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        } finally {
          setLocateBusy(false);
        }
      },
      (err) => {
        setLocateBusy(false);
        Alert.alert(
          'Location',
          err?.message || 'Could not read your position. Enable location permission in Settings.',
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  }, [onChangeText]);

  const canClear = value.length > 0;

  return (
    <View style={styles.locationBlock}>
      <Text style={styles.locationHeading}>Location</Text>
      <Text style={styles.locationSub}>
        {"Use your device's GPS to fill the address, or type below."}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.useLocBtn, pressed && styles.useLocBtnPressed]}
        onPress={useDeviceLocation}
        disabled={locateBusy}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
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

      <View style={[styles.fieldRow, styles.fieldRowMultiline]}>
        <Icon name="location-outline" size={20} color={ICON_COLOR} style={[styles.fieldIcon, styles.fieldIconTop]} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="City, area, or full address"
          placeholderTextColor={MUTED}
          style={[styles.fieldInput, styles.fieldInputMultiline]}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        {canClear ? (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Clear location"
            style={styles.clearTop}
          >
            <Icon name="close" size={18} color={CLEAR_ICON} />
          </Pressable>
        ) : (
          <View style={[styles.endPlaceholder, styles.clearTop]} />
        )}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 120;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 28,
    paddingTop: 4,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: FIELD_BG,
    marginBottom: 12,
  },
  avatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPhText: {
    fontSize: 36,
    fontWeight: '700',
    color: ICON_COLOR,
  },
  editImageLink: {
    fontSize: 16,
    fontWeight: '500',
    color: LINK_BLUE,
    letterSpacing: -0.2,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  readOnlyRowPressed: {
    opacity: 0.92,
  },
  readOnlyBody: {
    flex: 1,
  },
  readOnlyText: {
    fontSize: 16,
    color: BLACK,
    letterSpacing: -0.2,
  },
  readOnlyHint: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  genderDropdown: {
    flex: 1,
    minHeight: 48,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  genderDropdownList: {
    borderRadius: 10,
    marginTop: 4,
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: MUTED,
  },
  dropdownSelected: {
    fontSize: 16,
    color: BLACK,
  },
  dropdownItem: {
    fontSize: 16,
    color: BLACK,
  },
  locationBlock: {
    marginBottom: 14,
  },
  locationHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
    marginBottom: 6,
  },
  locationSub: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
    marginBottom: 12,
  },
  useLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: FIELD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    marginBottom: 12,
  },
  useLocBtnPressed: {
    opacity: 0.92,
  },
  useLocText: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
  },
  fieldRowMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 88,
    marginBottom: 0,
  },
  fieldIcon: {
    marginRight: 12,
  },
  fieldIconTop: {
    marginTop: 4,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: BLACK,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    minHeight: 48,
    letterSpacing: -0.2,
  },
  fieldInputMultiline: {
    minHeight: 72,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  endPlaceholder: {
    width: 22,
    height: 22,
  },
  clearTop: {
    marginTop: 4,
  },
  infoHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  infoHintEm: {
    fontWeight: '600',
    color: BLACK,
  },
  securityHint: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  securityHintEm: {
    fontWeight: '600',
    color: BLACK,
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: BLACK,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  saveBtnPressed: {
    opacity: 0.88,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});
