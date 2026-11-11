import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BRAND,
  buildPreviewLines,
  DISCOUNT_OPTIONS,
  formatAmountInput,
  GEO_ZONE_OPTIONS,
  inferGeoZone,
  NIGERIA_GEO_ZONES,
  parseAmountInput,
  sharedStyles,
  ShippingPreviewCard,
} from './shippingShared';
import { formatPriceInput } from '../../utils/variantOptions';
import { useNavigation } from '@react-navigation/native';
import { deleteShippingZone, getShippingZones, saveShippingZone } from '../../api/shop';
import ShippingZoneTutorial from './ShippingZoneTutorial';

/** @param {string} name */
function slugFromName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `zone-${Date.now()}`;
}

/**
 * Screen 4 — add or edit a shipping zone (name, locations, fees).
 */
export default function ShippingZoneEditScreen({ route }) {
  const insets = useSafeAreaInsets();
  const isEdit = route.params?.mode === 'edit';
  const existingZone = route.params?.zone;
  const defaultBaseFee = route.params?.defaultBaseFee ?? 1000;
  const defaultDiscount = route.params?.defaultDiscount ?? 50;
  const navigation = useNavigation();

  const inferredExisting = inferGeoZone(
    existingZone?.name,
    Array.isArray(existingZone?.locations) ? existingZone.locations : [],
  );
  const [zoneName, setZoneName] = useState(inferredExisting?.name ?? '');
  const [locations, setLocations] = useState(
    /** @type {string[]} */ (existingZone?.locations?.length ? [...existingZone.locations] : []),
  );
  const [baseFee, setBaseFee] = useState(existingZone?.baseFee ?? defaultBaseFee);
  const [baseFeeText, setBaseFeeText] = useState(
    formatAmountInput(existingZone?.baseFee ?? defaultBaseFee),
  );
  const [discountPercent, setDiscountPercent] = useState(
    existingZone?.discountPercent ?? defaultDiscount,
  );
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [takenByZone, setTakenByZone] = useState(/** @type {Record<string, string>} */ ({}));
  const [takenGeoZones, setTakenGeoZones] = useState(/** @type {Record<string, string>} */ ({}));
  const shopId = route.params?.shopId;
  const userId = route.params?.userId;
  const previewLines = useMemo(
    () => buildPreviewLines('multi_item_discount', baseFee, discountPercent),
    [baseFee, discountPercent],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
      // headerRight: () => (
      //   <TouchableOpacity
      //     onPress={() => setTutorialOpen(true)}
      //     hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      //     accessibilityRole="button"
      //     accessibilityLabel="Tutorial"
      //     style={{ paddingRight: 4 }}
      //   >
      //     <Icon name="play-circle-outline" size={26} color={BRAND} />
      //   </TouchableOpacity>
      // ),
    });
  }, [navigation]);

  useEffect(() => {
    if (!shopId || !userId) return;
    let active = true;
    getShippingZones(shopId, userId)
      .then((rows) => {
        if (!active) return;
        const currentId = existingZone?.id != null ? String(existingZone.id) : '';
        /** @type {Record<string, string>} */
        const taken = {};
        /** @type {Record<string, string>} */
        const takenGeos = {};
        for (const row of Array.isArray(rows) ? rows : []) {
          const zoneId = String(row.zone_id ?? row.id ?? '');
          if (currentId && zoneId === currentId) continue;
          const name = String(row.name ?? 'another zone');
          const locs = Array.isArray(row.locations) ? row.locations : [];
          for (const loc of locs) {
            const key = String(loc).trim();
            if (key) taken[key] = name;
          }
          const geo = inferGeoZone(name, locs);
          if (geo) takenGeos[geo.name] = name;
        }
        setTakenByZone(taken);
        setTakenGeoZones(takenGeos);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [shopId, userId, existingZone?.id]);

  const onBaseFeeChange = (text) => {
    setBaseFeeText(text);
    setBaseFee(parseAmountInput(text));
  };

  const selectedGeo = useMemo(
    () => NIGERIA_GEO_ZONES.find((zone) => zone.name === zoneName) ?? null,
    [zoneName],
  );
  const zoneStates = selectedGeo?.states ?? [];

  const geoZoneDropdownData = useMemo(
    () =>
      GEO_ZONE_OPTIONS.map((option) => {
        const taken = Boolean(takenGeoZones[option.value]) && option.value !== zoneName;
        return {
          ...option,
          disable: taken,
          label: taken ? `${option.label} (already added)` : option.label,
        };
      }),
    [takenGeoZones, zoneName],
  );

  const onSelectGeoZone = (item) => {
    const name = String(item?.value ?? '');
    if (!name || item?.disable || (takenGeoZones[name] && name !== zoneName)) {
      Alert.alert(
        'Zone already added',
        `${name || 'That zone'} is already in your shipping zones. Edit that zone instead.`,
      );
      return;
    }
    setZoneName(name);
    const nextStates = NIGERIA_GEO_ZONES.find((zone) => zone.name === name)?.states ?? [];
    setLocations((prev) => prev.filter((loc) => nextStates.includes(loc)));
  };

  const toggleLocation = (loc) => {
    const owner = takenByZone[loc];
    if (owner && !locations.includes(loc)) {
      Alert.alert(
        'State already in a zone',
        `${loc} is already in “${owner}”. Remove it from that zone before adding it here.`,
      );
      return;
    }
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((item) => item !== loc) : [...prev, loc],
    );
  };

  const removeLocation = (loc) => {
    setLocations((prev) => prev.filter((item) => item !== loc));
  };

  const onSave = async () => {
    const name = zoneName.trim();
    if (!selectedGeo) {
      Alert.alert(
        'Select a geo-political zone',
        'Choose one of Nigeria’s six geo-political zones. Do not type a custom name.',
      );
      return;
    }
    if (takenGeoZones[selectedGeo.name]) {
      Alert.alert(
        'Zone already added',
        `${selectedGeo.name} is already in your shipping zones. Edit that zone instead.`,
      );
      return;
    }
    if (locations.length === 0) {
      Alert.alert('States required', `Select at least one state in ${selectedGeo.name}.`);
      return;
    }
    // if (baseFee <= 0) {
    //   Alert.alert('Base fee required', 'Enter a base shipping fee for the first item.');
    //   return;
    // }
    if (!shopId || !userId) {
      Alert.alert('Unable to save', 'Missing shop information. Please try again.');
      return;
    }

    const zoneId = existingZone?.id ?? slugFromName(selectedGeo.name);
    const pinColor = existingZone?.pinColor ?? selectedGeo.color;

    setSaving(true);
    try {
      await saveShippingZone(shopId, userId, {
        zoneId,
        name,
        locations,
        baseFee: existingZone?.baseFee ?? 0,
        discountPercent: existingZone?.discountPercent ?? 0,
        pinColor,
      });

      // navigation.navigate({
      //   name: 'shipping-zones',
      //   params: {
      //     pendingZone: {
      //       id: zoneId,
      //       name,
      //       locations,
      //       baseFee,
      //       discountPercent,
      //       pinColor,
      //     },
      //   },
      //   merge: true,
      // });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Could not save shipping zone. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!isEdit || !existingZone?.id) {
      navigation.goBack();
      return;
    }

    Alert.alert(
      'Delete zone',
      `Remove "${existingZone.name}" from your shipping zones?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await deleteShippingZone(shopId, existingZone.id, userId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Delete failed', error?.message || 'Could not delete this shipping zone.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={sharedStyles.screen}>
      <ScrollView
        contentContainerStyle={[
          sharedStyles.scrollContent,
          { paddingBottom: insets.bottom + (isEdit ? 140 : 100) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 20 }}>
          <Text style={sharedStyles.fieldLabel}>Geo-political zone</Text>
          <Dropdown
            data={geoZoneDropdownData}
            labelField="label"
            valueField="value"
            disable={Boolean(isEdit && inferredExisting)}
            value={zoneName || null}
            onChange={onSelectGeoZone}
            style={sharedStyles.dropdown}
            placeholder="Select North Central, South West, …"
            placeholderStyle={sharedStyles.dropdownPlaceholder}
            selectedTextStyle={sharedStyles.dropdownSelected}
            itemTextStyle={{ fontSize: 15, color: '#111111' }}
            renderItem={(item) => {
              const taken = Boolean(item.disable);
              return (
                <View
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    opacity: taken ? 0.4 : 1,
                    backgroundColor: taken ? '#F3F4F6' : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: taken ? '#6B7280' : '#111111',
                      fontWeight: taken ? '400' : '500',
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            }}
            renderRightIcon={() => (
              <Icon name="chevron-down" size={18} color="#6B7280" />
            )}
          />
          <Text style={sharedStyles.fieldHint}>
            Pick one of Nigeria’s six geo-political zones. You cannot type a custom zone name.
          </Text>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={sharedStyles.fieldLabel}>States you ship to</Text>
          <Pressable
            style={[sharedStyles.inputWrap, { minHeight: 52, flexWrap: 'wrap', paddingVertical: 10 }]}
            onPress={() => {
              if (!selectedGeo) {
                Alert.alert(
                  'Select a zone first',
                  'Choose a geo-political zone, then pick the states in that zone.',
                );
                return;
              }
              setLocationPickerOpen(true);
            }}
          >
            {locations.length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 15 }}>
                {selectedGeo ? `Select states in ${selectedGeo.name}` : 'Select a geo-political zone first'}
              </Text>
            ) : (
              <View style={sharedStyles.tagRow}>
                {locations.map((loc) => (
                  <View key={loc} style={sharedStyles.locationTag}>
                    <Text style={sharedStyles.locationTagText}>{loc}</Text>
                    <Pressable hitSlop={6} onPress={() => removeLocation(loc)}>
                      <Icon name="close-circle" size={16} color={BRAND} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={{ marginLeft: 'auto' }}>
              <Icon name="chevron-down" size={18} color="#6B7280" />
            </View>
          </Pressable>
          <Text style={sharedStyles.fieldHint}>
            Only states in the selected geo-political zone are listed.
          </Text>
        </View>

        {/* Fees are set per order in the chat invoice for now.
        <View style={{ marginBottom: 20 }}>
          <Text style={sharedStyles.fieldLabel}>Base Shipping Fee (1st item)</Text>
          <View style={sharedStyles.inputWrap}>
            <Text style={sharedStyles.currencyPrefix}>₦</Text>
            <TextInput
              style={sharedStyles.textInput}
              value={formatPriceInput(baseFeeText)}
              onChangeText={onBaseFeeChange}
              keyboardType="number-pad"
              placeholder="1,000"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={sharedStyles.fieldLabel}>Discount for Additional Items</Text>
          <Dropdown
            data={DISCOUNT_OPTIONS}
            labelField="label"
            valueField="value"
            value={discountPercent}
            onChange={(item) => setDiscountPercent(item.value)}
            style={sharedStyles.dropdown}
            placeholder="Select discount"
            placeholderStyle={sharedStyles.dropdownPlaceholder}
            selectedTextStyle={sharedStyles.dropdownSelected}
            itemTextStyle={{ fontSize: 15, color: '#111111' }}
            renderRightIcon={() => (
              <Icon name="chevron-down" size={18} color="#6B7280" />
            )}
          />
        </View>

        <ShippingPreviewCard lines={previewLines} />
        */}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          backgroundColor: '#fff',
          display: 'flex',
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          height: isEdit ? 150 : 90,
          paddingHorizontal: 10,
        }}
      >
        <TouchableOpacity
          style={sharedStyles.primaryBtn}
          activeOpacity={0.88}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={sharedStyles.primaryBtnText}>Save Zone</Text>
        </TouchableOpacity>
        {isEdit ? (
          <TouchableOpacity
            style={sharedStyles.dangerBtn}
            activeOpacity={0.88}
            onPress={onDelete}
            disabled={saving}
          >
            <Text style={sharedStyles.dangerBtnText}>Delete Zone</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={locationPickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLocationPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: insets.top + 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111111' }}>
              {selectedGeo ? `States in ${selectedGeo.name}` : 'Select states'}
            </Text>
            <TouchableOpacity onPress={() => setLocationPickerOpen(false)}>
              <Text style={{ color: BRAND, fontSize: 16, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            {selectedGeo ? (
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                  backgroundColor: '#F7F7F8',
                }}
                onPress={() => {
                  const available = zoneStates.filter(
                    (loc) => !takenByZone[loc] || locations.includes(loc),
                  );
                  const allSelected =
                    available.length > 0 && available.every((loc) => locations.includes(loc));
                  if (allSelected) {
                    setLocations((prev) => prev.filter((loc) => !zoneStates.includes(loc)));
                    return;
                  }
                  setLocations((prev) => {
                    const next = new Set(prev);
                    available.forEach((loc) => next.add(loc));
                    return Array.from(next);
                  });
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: BRAND }}>
                  {zoneStates.filter((loc) => locations.includes(loc)).length ===
                  zoneStates.filter((loc) => !takenByZone[loc] || locations.includes(loc)).length
                    ? 'Clear all states'
                    : 'Select all states in this zone'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {zoneStates.map((loc) => {
              const selected = locations.includes(loc);
              const takenName = takenByZone[loc];
              const taken = Boolean(takenName) && !selected;
              return (
                <TouchableOpacity
                  key={loc}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    opacity: taken ? 0.4 : 1,
                  }}
                  onPress={() => toggleLocation(loc)}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        color: selected ? BRAND : '#111111',
                        fontWeight: selected ? '600' : '400',
                      }}
                    >
                      {loc}
                    </Text>
                    {taken ? (
                      <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        Already in {takenName}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Icon name="checkmark-circle" size={20} color={BRAND} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {saving ? (
        <View
          pointerEvents="auto"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={BRAND} />
        </View>
      ) : null}
      <ShippingZoneTutorial visible={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </View>
  );
}
