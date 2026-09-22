import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Dropdown } from 'react-native-element-dropdown';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../context/ProfileContext';
import { createVendorShop, hasVendorShop } from '../api/shop';
import { updateUserRole } from '../api/user';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../utils/deviceLocation';
import FormKeyboardAvoiding from '../components/FormKeyboardAvoiding';
import {
  selectCategoriesError,
  selectCategoriesLoading,
  selectCategoryOptions,
} from '../../redux/categoriesSlice';

const BLACK = '#000000';
const PAGE_BG = '#F7F7F8';
const CARD_BG = '#FFFFFF';
const MUTED = '#8E8E93';
const BRAND = '#00926e';

const VENDOR_TYPE_OPTIONS = [
  { label: 'Reseller', value: 'reseller' },
  { label: 'Drop-shipper', value: 'dropshipper' },
  { label: 'Manufacturer', value: 'manufacturer' },
];

export default function ProfileSettings() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { signOut, activeRole, setActiveRole, isAuthenticated } = useAuth();
  const { user, refresh } = useProfile();
  const vendorMode = activeRole === 'vendor';
  const [switchBusy, setSwitchBusy] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);
  const [shopName, setShopName] = useState('');
  const [vendorType, setVendorType] = useState(/** @type {'reseller' | 'dropshipper' | 'manufacturer'} */ ('reseller'));
  const categoryOptions = useSelector(selectCategoryOptions);
  const categoriesLoading = useSelector(selectCategoriesLoading);
  const categoriesError = useSelector(selectCategoriesError);
  const [category, setCategory] = useState(/** @type {string | null} */ (null));
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [coords, setCoords] = useState(/** @type {{ latitude: number; longitude: number } | null} */ (null));
  const [locating, setLocating] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const setupHint = useMemo(() => {
    if (coords) {
      return `Using device coordinates: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }
    return 'No device coordinates yet. You can still type location manually.';
  }, [coords]);

  const onAuthAction = () => {
    if (!isAuthenticated) {
      void signOut();
      return;
    }
    Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const onUseMyLocation = async () => {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert('Location permission', 'Location access was denied. You can enter your location manually.');
        return;
      }
      const c = await getCurrentCoordinates();
      setCoords(c);
      try {
        const place = await reverseGeocodeToPlace(c.latitude, c.longitude);
        if (!city.trim()) setCity(place.city || '');
        if (!stateName.trim()) setStateName(place.state || '');
        if (!country.trim()) setCountry(place.country || '');
      } catch {
        // Silent: coordinates are still useful even when reverse geocode fails.
      }
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  };

  const onToggleVendorMode = async (enabled) => {
    if (enabled === vendorMode) return;
    if (!enabled) {
      setSwitchBusy(true);
      try {
        await setActiveRole('customer');
      } finally {
        setSwitchBusy(false);
      }
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in before enabling vendor mode.');
      return;
    }

    setSwitchBusy(true);
    try {
      const hasShop = await hasVendorShop();
      if (hasShop) {
        await setActiveRole('vendor');
        return;
      }
      setSetupVisible(true);
    } catch (e) {
      Alert.alert('Vendor setup', e instanceof Error ? e.message : String(e));
    } finally {
      setSwitchBusy(false);
    }
  };

  const onCompleteVendorSetup = async () => {
    const name = shopName.trim();
    if (name.length < 2) {
      Alert.alert('Shop name', 'Enter a valid shop name.');
      return;
    }
    const categoryValue = String(category ?? '').trim();
    if (!categoryValue) {
      Alert.alert('Category', 'Select a shop category.');
      return;
    }
    const hasTypedLocation =
      address.trim().length > 0 ||
      city.trim().length > 0 ||
      stateName.trim().length > 0 ||
      country.trim().length > 0 ||
      zipcode.trim().length > 0;
    if (!coords && !hasTypedLocation) {
      Alert.alert('Location', 'Use device location or enter your location details manually.');
      return;
    }

    setSubmittingSetup(true);
    try {
      await createVendorShop({
        name,
        vendorType,
        category: categoryValue,
        location: {
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: stateName.trim() || undefined,
          country: country.trim() || undefined,
          zipcode: zipcode.trim() || undefined,
          ...(coords && {
            coordinates: { lat: coords.latitude, lng: coords.longitude },
          }),
        },
      });

      const uid = Number(user?.id);
      if (!Number.isNaN(uid) && uid > 0) {
        await updateUserRole(uid, 'vendor');
      }
      await refresh().catch(() => {});
      await setActiveRole('vendor');
      setSetupVisible(false);
      Alert.alert('Vendor mode enabled', 'Your shop profile has been created.');
    } catch (e) {
      Alert.alert('Vendor setup', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmittingSetup(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuCard}>
          <RoleToggleRow enabled={vendorMode} onToggle={onToggleVendorMode} busy={switchBusy} />
          <View style={styles.menuDivider} />
          <SettingsRow
            icon="mail-outline"
            title="Change email"
            onPress={() => navigation.navigate('profile-settings-email')}
          />
          <View style={styles.menuDivider} />
          <SettingsRow
            icon="lock-closed-outline"
            title="Password"
            onPress={() => navigation.navigate('profile-settings-password')}
          />
          <View style={styles.menuDivider} />
          <SettingsRow
            icon="logo-whatsapp"
            title="WhatsApp number"
            onPress={() => navigation.navigate('profile-settings-whatsapp')}
          />
          <View style={styles.menuDivider} />
          <SettingsRow
            icon="location-outline"
            title="Location"
            onPress={() => navigation.navigate('profile-settings-location')}
          />
          {vendorMode ? (
            <>
              <View style={styles.menuDivider} />
              <SettingsRow
                icon="card-outline"
                title="Payout setup"
                onPress={() => navigation.navigate('profile-settings-payout')}
              />
            </>
          ) : null}
          <View style={styles.menuDivider} />
          <SettingsRow
            icon={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
            title={isAuthenticated ? 'Sign out' : 'Sign in'}
            onPress={onAuthAction}
          />
          {isAuthenticated ? (
            <>
              <View style={styles.menuDivider} />
              <SettingsRow
                icon="trash-outline"
                title="Delete Account"
                onPress={() => navigation.navigate('profile-settings-delete-account')}
              />
            </>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={setupVisible}
        transparent
        animationType="slide"
        onRequestClose={() => (submittingSetup ? null : setSetupVisible(false))}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => (submittingSetup ? null : setSetupVisible(false))}
          />
          <FormKeyboardAvoiding offset={0} style={{ width: '100%' }}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Set up vendor mode</Text>
              <TouchableOpacity
                onPress={() => (submittingSetup ? null : setSetupVisible(false))}
                disabled={submittingSetup}
                style={styles.sheetCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="close" size={26} color={submittingSetup ? MUTED : BLACK} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>
              First time only. Provide your shop details to enable vendor navigation.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetBody}
            >
              <LabeledInput label="Shop name" value={shopName} onChangeText={setShopName} placeholder="e.g. Comfort Wear Hub" />

              <Text style={styles.label}>Vendor type</Text>
              <View style={styles.chipsWrap}>
                {VENDOR_TYPE_OPTIONS.map((opt) => {
                  const selected = vendorType === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setVendorType(/** @type {'reseller' | 'dropshipper' | 'manufacturer'} */ (opt.value))}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>
                Category <Text style={styles.required}>*</Text>
              </Text>
              <Dropdown
                style={styles.dropdown}
                containerStyle={styles.dropdownList}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                itemTextStyle={styles.dropdownItemText}
                inputSearchStyle={styles.dropdownSearch}
                data={categoryOptions}
                search
                maxHeight={260}
                labelField="label"
                valueField="value"
                placeholder={categoriesLoading ? 'Loading categories...' : 'Select a category'}
                searchPlaceholder="Search categories..."
                value={category}
                onChange={(item) => setCategory(item.value)}
                disable={submittingSetup || categoriesLoading || categoryOptions.length === 0}
              />
              {categoriesError ? <Text style={styles.locationHint}>{categoriesError}</Text> : null}

              <View style={styles.locationHeaderRow}>
                <Text style={styles.label}>Shop location</Text>
                <TouchableOpacity
                  onPress={() => {
                    void onUseMyLocation();
                  }}
                  style={styles.locationBtn}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={BRAND} />
                  ) : (
                    <Text style={styles.locationBtnText}>Use device location</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.locationHint}>{setupHint}</Text>

              <LabeledInput label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Street address" />
              <LabeledInput label="City" value={city} onChangeText={setCity} placeholder="City" />
              <LabeledInput label="State" value={stateName} onChangeText={setStateName} placeholder="State" />
              <LabeledInput label="Country" value={country} onChangeText={setCountry} placeholder="Country" />
              <LabeledInput label="Zip code (optional)" value={zipcode} onChangeText={setZipcode} placeholder="Zip code" />
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, submittingSetup && styles.primaryBtnDisabled]}
              onPress={() => {
                void onCompleteVendorSetup();
              }}
              disabled={submittingSetup}
              activeOpacity={0.9}
            >
              {submittingSetup ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Create shop and enable vendor mode</Text>
              )}
            </TouchableOpacity>
          </View>
          </FormKeyboardAvoiding>
        </View>
      </Modal>
    </>
  );
}

function LabeledInput({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A0A0A0"
        autoCapitalize="words"
      />
    </View>
  );
}

function SettingsRow({ icon, title, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
    >
      <View style={styles.menuLeft}>
        <Icon name={icon} size={22} color={BLACK} />
        <Text style={styles.menuTitle}>{title}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={BLACK} />
    </Pressable>
  );
}

function RoleToggleRow({ enabled, onToggle, busy }) {
  return (
    <View style={styles.menuRow}>
      <View style={styles.menuLeft}>
        <Icon name="swap-horizontal-outline" size={22} color={BLACK} />
        <View style={styles.roleTextCol}>
          <Text style={styles.menuTitle}>Vendor mode</Text>
          <Text style={styles.roleHint}>{enabled ? 'Using vendor navigation' : 'Using customer navigation'}</Text>
        </View>
      </View>
      {busy ? (
        <ActivityIndicator color={BRAND} />
      ) : (
        <Switch
          value={enabled}
          onValueChange={(v) => {
            void onToggle(v);
          }}
          trackColor={{ false: '#E5E5EA', true: '#C8F5E8' }}
          thumbColor={enabled ? '#00926e' : '#F4F4F5'}
          ios_backgroundColor="#E5E5EA"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  intro: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 16,
  },
  menuCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  menuRowPressed: {
    backgroundColor: '#FAFAFA',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: BLACK,
    flex: 1,
  },
  roleTextCol: {
    flex: 1,
  },
  roleHint: {
    marginTop: 2,
    fontSize: 12,
    color: MUTED,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 10,
    backgroundColor: '#D8D8D8',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: BLACK,
    flex: 1,
    paddingRight: 8,
  },
  sheetCloseBtn: {
    padding: 4,
    marginTop: -2,
    marginRight: -4,
  },
  sheetSub: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  sheetBody: {
    paddingBottom: 14,
  },
  inputBlock: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#111111',
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  required: {
    color: '#C62828',
    fontWeight: '700',
  },
  dropdown: {
    height: 46,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  dropdownList: {
    borderRadius: 10,
    borderColor: '#E4E4E7',
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#111111',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111111',
  },
  dropdownSearch: {
    height: 40,
    fontSize: 14,
    borderRadius: 8,
    borderColor: '#E4E4E7',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#DEDEDE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: BRAND,
    backgroundColor: '#E8F8F2',
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: BRAND,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  locationBtn: {
    minHeight: 32,
    borderWidth: 1,
    borderColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  locationBtnText: {
    color: BRAND,
    fontSize: 12,
    fontWeight: '600',
  },
  locationHint: {
    marginTop: 5,
    marginBottom: 10,
    fontSize: 12,
    color: MUTED,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginLeft: 48,
  },
});
