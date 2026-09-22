import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { createVendorShop, hasVendorShop } from '../../api/shop';
import { fetchCurrentUserOrStatus, updateUserRole } from '../../api/user';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../../utils/deviceLocation';
import FormKeyboardAvoiding from '../../components/FormKeyboardAvoiding';
import { getStoredAccessToken, getStoredUser, saveSession } from '../../auth/session';
import {
  selectCategoriesError,
  selectCategoriesLoading,
  selectCategoryOptions,
} from '../../../redux/categoriesSlice';

const BLACK = '#000000';
const MUTED = '#8E8E93';
const BRAND = '#00926e';

const VENDOR_TYPE_OPTIONS = [
  { label: 'Reseller', value: 'reseller' },
  { label: 'Drop-shipper', value: 'dropshipper' },
  { label: 'Manufacturer', value: 'manufacturer' },
];

export default function ShopSetupScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { setActiveRole, isAuthenticated } = useAuth();
  const [checkingShop, setCheckingShop] = useState(true);
  const [shopName, setShopName] = useState('');
  const [vendorType, setVendorType] = useState(
    /** @type {'reseller' | 'dropshipper' | 'manufacturer'} */ ('reseller'),
  );
  const categoryOptions = useSelector(selectCategoryOptions);
  const categoriesLoading = useSelector(selectCategoriesLoading);
  const categoriesError = useSelector(selectCategoriesError);
  const [category, setCategory] = useState(/** @type {string | null} */ (null));
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [coords, setCoords] = useState(
    /** @type {{ latitude: number; longitude: number } | null} */ (null),
  );
  const [locating, setLocating] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);

  const setupHint = useMemo(() => {
    if (coords) {
      return `Using device coordinates: ${coords.latitude.toFixed(
        4,
      )}, ${coords.longitude.toFixed(4)}`;
    }
    return 'No device coordinates yet. You can still type location manually.';
  }, [coords]);

  useEffect(() => {
    console.log("category options: ", categoryOptions)
  }, [categoryOptions]);

  useEffect(() => {
    if (!isAuthenticated) {
      setCheckingShop(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const hasShop = await hasVendorShop();
        if (cancelled) return;
        if (hasShop) {
          await setActiveRole('vendor');
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'home' }],
            }),
          );
          return;
        }
      } catch {
        /* show form */
      } finally {
        if (!cancelled) setCheckingShop(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigation, setActiveRole]);

  const goHomeAsVendor = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'home' }],
      }),
    );
  };

  const onUseMyLocation = async () => {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location permission',
          'Location access was denied. You can enter your location manually.',
        );
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
        // Coordinates alone are still useful.
      }
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  };

  const onCompleteVendorSetup = async () => {
    if (!isAuthenticated) {
      navigation.replace('Login', {
        allowSkip: false,
        intentRole: 'vendor',
      });
      return;
    }

    const user = await getStoredUser();
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
      Alert.alert(
        'Location',
        'Use device location or enter your location details manually.',
      );
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

      const token = await getStoredAccessToken();
      const refreshed = await fetchCurrentUserOrStatus();
      if (token && refreshed.user) {
        await saveSession(token, refreshed.user);
      }

      await setActiveRole('vendor');
      Alert.alert('Shop created', 'Your vendor shop is ready.', [
        { text: 'Continue', onPress: goHomeAsVendor },
      ]);
    } catch (e) {
      Alert.alert('Vendor setup', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmittingSetup(false);
    }
  };

  if (checkingShop) {
    return (
      <View style={[styles.loadingRoot, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return (
    <FormKeyboardAvoiding offset={0} style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sheetTitle}>Set up your shop</Text>
        <Text style={styles.sheetSub}>
          Register your shop to start selling on Deedyte.
        </Text>

        {!isAuthenticated ? (
          <View style={styles.authBanner}>
            <Text style={styles.authBannerText}>
              Sign in or create an account to register your shop.
            </Text>
            <View style={styles.authBannerActions}>
              <TouchableOpacity
                style={styles.authBannerBtn}
                onPress={() =>
                  navigation.replace('Login', {
                    allowSkip: false,
                    intentRole: 'vendor',
                  })
                }
              >
                <Text style={styles.authBannerBtnText}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.authBannerBtn, styles.authBannerBtnAlt]}
                onPress={() =>
                  navigation.replace('SignUp', {
                    allowSkip: false,
                    intentRole: 'vendor',
                  })
                }
              >
                <Text style={[styles.authBannerBtnText, styles.authBannerBtnTextAlt]}>
                  Create account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <LabeledInput
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          placeholder="e.g. Comfort Wear Hub"
        />

        <Text style={styles.label}>Vendor type</Text>
        <View style={styles.chipsWrap}>
          {VENDOR_TYPE_OPTIONS.map(opt => {
            const selected = vendorType === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() =>
                  setVendorType(
                    /** @type {'reseller' | 'dropshipper' | 'manufacturer'} */ (
                      opt.value
                    ),
                  )
                }
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
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
          onChange={item => setCategory(item.value)}
          disable={submittingSetup || categoriesLoading || categoryOptions.length === 0}
        />
        {categoriesError ? <Text style={styles.meta}>{categoriesError}</Text> : null}

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

        <LabeledInput
          label="Address (optional)"
          value={address}
          onChangeText={setAddress}
          placeholder="Street address"
        />
        <LabeledInput
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="City"
        />
        <LabeledInput
          label="State"
          value={stateName}
          onChangeText={setStateName}
          placeholder="State"
        />
        <LabeledInput
          label="Country"
          value={country}
          onChangeText={setCountry}
          placeholder="Country"
        />
        <LabeledInput
          label="Zip code (optional)"
          value={zipcode}
          onChangeText={setZipcode}
          placeholder="Zip code"
        />

        <TouchableOpacity
          style={[
            styles.primaryBtn,
            submittingSetup && styles.primaryBtnDisabled,
          ]}
          onPress={() => {
            void onCompleteVendorSetup();
          }}
          disabled={submittingSetup}
          activeOpacity={0.9}
        >
          {submittingSetup ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Create shop and continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </FormKeyboardAvoiding>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: BLACK,
    marginBottom: 6,
  },
  sheetSub: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 20,
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
    marginTop: 8,
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authBanner: {
    borderWidth: 1,
    borderColor: '#CFE8DF',
    backgroundColor: '#F0FAF6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  authBannerText: {
    fontSize: 14,
    color: '#1B5E4A',
    lineHeight: 20,
    marginBottom: 12,
  },
  authBannerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  authBannerBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authBannerBtnAlt: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BRAND,
  },
  authBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authBannerBtnTextAlt: {
    color: BRAND,
  },
});
