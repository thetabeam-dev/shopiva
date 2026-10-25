import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import CategoryKnowMore from '../../components/CategoryKnowMore';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { createVendorShop, fetchOwnerShops, hasVendorShop, updateVendorShop } from '../../api/shop';
import { fetchCurrentUserOrStatus, updateUserRole } from '../../api/user';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../../utils/deviceLocation';
import { useLocationLookup } from '../../hooks/useLocationLookup';
import FormKeyboardAvoiding from '../../components/FormKeyboardAvoiding';
import PlaceLocationField from '../../components/PlaceLocationField';
import NigerianStatePickerModal, { matchNigerianState } from '../../components/NigerianStatePickerModal';
import { getStoredAccessToken, getStoredUser, saveSession } from '../../auth/session';
import { formatMvpCategoryLabel } from '../../utils/mvpCategory';
import { shopRecordHasLocation } from '../../utils/shopLocation';
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
  const [categories, setCategories] = useState(/** @type {string[]} */ ([]));
  const [categoryModal, setCategoryModal] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [country, setCountry] = useState('Nigeria');
  const [zipcode, setZipcode] = useState('');
  const [coords, setCoords] = useState(
    /** @type {{ latitude: number; longitude: number } | null} */ (null),
  );
  const [locating, setLocating] = useState(false);
  const { locate, locationOverlay } = useLocationLookup();
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [existingShopId, setExistingShopId] = useState(/** @type {number | null} */ (null));

  const setupHint = useMemo(() => {
    if (coords) {
      return `Using device coordinates: ${coords.latitude.toFixed(
        4,
      )}, ${coords.longitude.toFixed(4)}`;
    }
    return 'City and state are required. Zip code is optional.';
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
          const stored = await getStoredUser();
          const uid = Number(stored?.id);
          const shops = Number.isFinite(uid) ? await fetchOwnerShops(uid).catch(() => []) : [];
          const shop = Array.isArray(shops) ? shops[0] : null;
          if (shop && shopRecordHasLocation(shop)) {
            await setActiveRole('vendor');
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'home' }],
              }),
            );
            return;
          }
          const shopId = Number(shop?.id ?? shop?.shop_id);
          if (Number.isFinite(shopId) && shopId > 0) setExistingShopId(shopId);
          if (shop?.name) setShopName(String(shop.name));
          void requestLocationPermission().then(async granted => {
            if (!granted || cancelled) {
              Alert.alert(
                'Shop location',
                'Allow location to set your shop, or enter the city and state below.',
              );
              return;
            }
            try {
              const c = await getCurrentCoordinates();
              if (!cancelled) setCoords(c);
            } catch {
              /* manual entry remains available */
            }
          });
        } else {
          void requestLocationPermission().then(async granted => {
            if (!granted || cancelled) return;
            try {
              const c = await getCurrentCoordinates();
              if (!cancelled) setCoords(c);
            } catch {
              /* manual entry remains available */
            }
          });
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
      const c = await locate();
      if (!c) return;
      setCoords(c);
      try {
        const place = await reverseGeocodeToPlace(c.latitude, c.longitude);
        if (!city.trim()) setCity(place.city || '');
        if (!stateName.trim()) setStateName(matchNigerianState(place.state || ''));
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
    if (!existingShopId && name.length < 2) {
      Alert.alert('Shop name', 'Enter a valid shop name.');
      return;
    }
    if (!existingShopId && !categories.length) {
      Alert.alert('Category', 'Select at least one shop category.');
      return;
    }
    if (!coords || !city.trim() || !stateName.trim()) {
      Alert.alert('Shop location', 'Use your current location or choose a suggested place so we can save coordinates.');
      return;
    }

    setSubmittingSetup(true);
    try {
      const location = {
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: stateName.trim() || undefined,
        country: country.trim() || undefined,
        zipcode: zipcode.trim() || undefined,
        ...(coords && {
          coordinates: { lat: coords.latitude, lng: coords.longitude },
        }),
      };
      if (existingShopId) {
        const uid = Number(user?.id);
        await updateVendorShop(existingShopId, uid, { location });
      } else {
        await createVendorShop({
          name,
          vendorType,
          category: categories,
          location,
        });
      }

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
    <>
    {locationOverlay}
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
          Register your shop to start selling on Deedyte. City and state are required.
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
          Categories <Text style={styles.required}>*</Text>
        </Text>
        <Pressable
          style={styles.dropdown}
          onPress={() => setCategoryModal(true)}
          disabled={submittingSetup || categoriesLoading}
        >
          <Text
            style={categories.length ? styles.dropdownSelectedText : styles.dropdownPlaceholder}
            numberOfLines={1}
          >
            {categoriesLoading
              ? 'Loading categories...'
              : categories.length
                ? categories.map(value => formatMvpCategoryLabel(value)).join(', ')
                : 'Select categories'}
          </Text>
        </Pressable>
        {categoriesError ? <Text style={styles.meta}>{categoriesError}</Text> : null}

        <View style={styles.locationHeaderRow}>
          <Text style={styles.label}>Shop location</Text>
        </View>
        <Text style={styles.locationHint}>Use your location or choose a suggested place. Coordinates are saved with it.</Text>
        <PlaceLocationField
          onClear={() => setCoords(null)}
          onPlace={(place) => {
            setCity(place.city);
            if (place.state) setStateName(matchNigerianState(place.state) || place.state);
            if (place.country) setCountry(place.country);
            setCoords({ latitude: place.latitude, longitude: place.longitude });
          }}
        />
        <LabeledInput
          label="Address (optional)"
          value={address}
          onChangeText={setAddress}
          placeholder="Street address"
        />
        <View style={styles.inputBlock}>
        <Text style={styles.label}>State<Text style={styles.required}> *</Text></Text>
        <TouchableOpacity
          style={[styles.input, styles.statePicker]}
          onPress={() => setStatePickerOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Select state"
        >
          <Text style={stateName ? styles.stateValue : styles.statePlaceholder}>
            {stateName || 'Select a state'}
          </Text>
          <Icon name="chevron-down" size={18} color="#6B7280" />
        </TouchableOpacity>
        </View>
        <NigerianStatePickerModal
          visible={statePickerOpen}
          selected={stateName}
          onClose={() => setStatePickerOpen(false)}
          onSelect={(next) => {
            setStateName(next);
            setStatePickerOpen(false);
          }}
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
            (submittingSetup || !city.trim() || !stateName.trim()) && styles.primaryBtnDisabled,
          ]}
          onPress={() => {
            void onCompleteVendorSetup();
          }}
          disabled={submittingSetup || !city.trim() || !stateName.trim()}
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
    <Modal
      visible={categoryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setCategoryModal(false)}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryModal(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Categories</Text>
          <Text style={styles.meta}>Select every category this shop sells.</Text>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            {categoryOptions.map(opt => {
              const selected = categories.includes(opt.value);
              return (
                <View
                  key={opt.value}
                  style={[styles.pickerItem, selected && styles.pickerItemSelected]}
                >
                  <Pressable
                    style={styles.pickerItemCopy}
                    onPress={() => {
                      if (!selected && categories.length >= 3) {
                        Alert.alert(
                          'Category limit',
                          'A shop can have at most 3 categories. Remove one before adding another.',
                        );
                        return;
                      }
                      setCategories(current =>
                        selected
                          ? current.filter(item => item !== opt.value)
                          : [...current, opt.value],
                      );
                    }}
                  >
                    <Text style={styles.pickerItemText}>{opt.label}</Text>
                  </Pressable>
                  <CategoryKnowMore label={opt.label} productTypes={opt.productTypes} />
                  {selected ? (
                    <Icon name="checkmark-circle" size={22} color={BRAND} />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setCategoryModal(false)}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
    </>
  );
}

function LabeledInput({ label, required, value, onChangeText, placeholder }) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
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
  statePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  stateValue: { fontSize: 16, color: '#111111' },
  statePlaceholder: { fontSize: 16, color: '#A0A0A0' },
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
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 460,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    gap: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#F3FAF7',
  },
  pickerItemCopy: { flex: 1 },
  pickerItemText: {
    fontSize: 15,
    color: '#222222',
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
