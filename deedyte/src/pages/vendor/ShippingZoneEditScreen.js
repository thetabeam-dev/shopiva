import { useState } from 'react';
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
  DISCOUNT_OPTIONS,
  formatAmountInput,
  NIGERIA_LOCATIONS,
  parseAmountInput,
  sharedStyles,
} from './shippingShared';
import { formatPriceInput } from '../../utils/variantOptions';
import { useNavigation } from '@react-navigation/native';
import { saveShippingZone } from '../../api/shop';

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

  const [zoneName, setZoneName] = useState(existingZone?.name ?? '');
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
  const [saving, setSaving] = useState(false);
  const shopId = route.params?.shopId;
  const userId = route.params?.userId;

  const onBaseFeeChange = (text) => {
    setBaseFeeText(text);
    setBaseFee(parseAmountInput(text));
  };

  const toggleLocation = (loc) => {
    setLocations((prev) =>
      prev.includes(loc) ? prev.filter((item) => item !== loc) : [...prev, loc],
    );
  };

  const removeLocation = (loc) => {
    setLocations((prev) => prev.filter((item) => item !== loc));
  };

  const onSave = async () => {
    const name = zoneName.trim();
    if (!name) {
      Alert.alert('Zone name required', 'Enter a name for this shipping zone.');
      return;
    }
    if (locations.length === 0) {
      Alert.alert('Locations required', 'Select at least one state or city for this zone.');
      return;
    }
    if (baseFee <= 0) {
      Alert.alert('Base fee required', 'Enter a base shipping fee for the first item.');
      return;
    }
    if (!shopId || !userId) {
      Alert.alert('Unable to save', 'Missing shop information. Please try again.');
      return;
    }

    const zoneId = existingZone?.id ?? slugFromName(name);
    const pinColors = [BRAND, '#16A34A', '#EA580C', '#2563EB', '#9333EA'];
    const colorIndex = Math.abs(zoneId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % pinColors.length;
    const pinColor = existingZone?.pinColor ?? pinColors[colorIndex];

    setSaving(true);
    try {
      await saveShippingZone(shopId, userId, {
        zoneId,
        name,
        locations,
        baseFee,
        discountPercent,
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
          onPress: () => {
            navigation.navigate({
              name: 'shipping-zones',
              params: { deletedZoneId: existingZone.id },
              merge: true,
            });
            navigation.goBack();
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
          <Text style={sharedStyles.fieldLabel}>Zone Name (Geo-Political Zones).</Text>
          <View style={sharedStyles.inputWrap}>
            <TextInput
              style={sharedStyles.textInput}
              value={zoneName}
              onChangeText={setZoneName}
              placeholder="Lagos"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={sharedStyles.fieldLabel}>Locations</Text>
          <Pressable
            style={[sharedStyles.inputWrap, { minHeight: 52, flexWrap: 'wrap', paddingVertical: 10 }]}
            onPress={() => setLocationPickerOpen(true)}
          >
            {locations.length === 0 ? (
              <Text style={{ color: '#9CA3AF', fontSize: 15 }}>Select states or cities</Text>
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
          <Text style={sharedStyles.fieldHint}>Select states or cities in this zone.</Text>
        </View>

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
              Select locations
            </Text>
            <TouchableOpacity onPress={() => setLocationPickerOpen(false)}>
              <Text style={{ color: BRAND, fontSize: 16, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
            {NIGERIA_LOCATIONS.map((loc) => {
              const selected = locations.includes(loc);
              return (
                <TouchableOpacity
                  key={loc}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F3F4F6',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onPress={() => toggleLocation(loc)}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      color: selected ? BRAND : '#111111',
                      fontWeight: selected ? '600' : '400',
                    }}
                  >
                    {loc}
                  </Text>
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
    </View>
  );
}
