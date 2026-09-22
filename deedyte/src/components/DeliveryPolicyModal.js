import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveShopPolicyClause } from '../api/shop';

const BRAND = '#0D4F3C';
const MUTED = '#6B7280';
const BORDER = '#E8EAEF';
const BLACK = '#111111';
const ERR = '#B91C1C';

const DELIVERY_TIMELINE_OPTIONS = [
  { label: 'Same day delivery', value: 'Same day delivery' },
  { label: '1-2 days', value: '1-2 days' },
  { label: '3-5 days', value: '3-5 days' },
  { label: '5-7 days', value: '5-7 days' },
  { label: 'More than 7 days', value: 'More than 7 days' },
];

const DELIVERY_LOCATION_OPTIONS = [
  { label: 'Same city', value: 'Same city' },
  { label: 'Same state', value: 'Same state' },
  { label: 'Nationwide', value: 'Nationwide' },
  { label: 'Pickup only', value: 'Pickup only' },
];

const DELIVERY_METHOD_OPTIONS = [
  { label: 'Vendor self-delivery', value: 'Vendor self-delivery' },
  { label: 'Third-party courier', value: 'Third-party courier' },
  { label: 'Pickup from store', value: 'Pickup from store' },
  { label: 'Platform courier', value: 'Platform courier' },
];

const PROCESSING_TIME_UNIT_OPTIONS = [
  { label: 'hours', value: 'hours' },
  { label: 'days', value: 'days' },
];

const FAILED_DELIVERY_OPTIONS = [
  { label: 'Extra delivery fee required', value: 'Extra delivery fee required' },
  { label: 'Order returned', value: 'Order returned' },
  { label: 'Customer must reschedule', value: 'Customer must reschedule' },
];

const dropdownBase = {
  height: 48,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: BORDER,
  paddingHorizontal: 12,
  backgroundColor: '#FFFFFF',
};

/**
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   shopId: number;
 *   onSaved: () => void | Promise<void>;
 * }} props
 */
export default function DeliveryPolicyModal({ visible, onClose, shopId, onSaved }) {
  const insets = useSafeAreaInsets();
  const [deliveryTimeline, setDeliveryTimeline] = useState(DELIVERY_TIMELINE_OPTIONS[0].value);
  const [deliveryLocation, setDeliveryLocation] = useState(DELIVERY_LOCATION_OPTIONS[0].value);
  const [deliveryMethod, setDeliveryMethod] = useState(DELIVERY_METHOD_OPTIONS[0].value);
  const [processingTimeValue, setProcessingTimeValue] = useState('1');
  const [processingTimeUnit, setProcessingTimeUnit] = useState(PROCESSING_TIME_UNIT_OPTIONS[1].value);
  const [failedDeliveryPolicy, setFailedDeliveryPolicy] = useState(FAILED_DELIVERY_OPTIONS[2].value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDeliveryTimeline(DELIVERY_TIMELINE_OPTIONS[0].value);
    setDeliveryLocation(DELIVERY_LOCATION_OPTIONS[0].value);
    setDeliveryMethod(DELIVERY_METHOD_OPTIONS[0].value);
    setProcessingTimeValue('1');
    setProcessingTimeUnit(PROCESSING_TIME_UNIT_OPTIONS[1].value);
    setFailedDeliveryPolicy(FAILED_DELIVERY_OPTIONS[2].value);
    setErr('');
    setBusy(false);
  }, [visible]);

  const save = useCallback(async () => {
    const processingNumber = Number(processingTimeValue);
    if (!Number.isFinite(processingNumber) || processingNumber <= 0) {
      setErr('Enter a valid processing time.');
      return;
    }
    const payloadTitle = `Delivery: ${deliveryTimeline}`;
    const payloadContent = [
      `Delivery timeline: ${deliveryTimeline}`,
      '',
      `Delivery location: ${deliveryLocation}`,
      `Delivery method: ${deliveryMethod}`,
      `Processing time before shipping: ${processingNumber} ${processingTimeUnit}`,
      `If customer is not available: ${failedDeliveryPolicy}`,
    ]
      .join('\n')
      .trim();

    setBusy(true);
    setErr('');
    try {
      await saveShopPolicyClause(shopId, {
        target: 'delivery',
        title: payloadTitle,
        content: payloadContent,
      });
      await onSaved?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    shopId,
    deliveryTimeline,
    deliveryLocation,
    deliveryMethod,
    processingTimeValue,
    processingTimeUnit,
    failedDeliveryPolicy,
    onSaved,
    onClose,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !busy && onClose()} />
        <View style={[styles.card, { marginBottom: Math.max(insets.bottom, 12) }]}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Delivery policy</Text>
            <Text style={styles.subtitle}>
              Set delivery and shipping terms. Open days and business hours (including delivery) are set under Shop
              availability.
            </Text>

            <Text style={styles.label}>Delivery timeline</Text>
            <Dropdown
              style={dropdownBase}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.ph}
              selectedTextStyle={styles.sel}
              itemTextStyle={styles.item}
              data={DELIVERY_TIMELINE_OPTIONS}
              labelField="label"
              valueField="value"
              value={deliveryTimeline}
              onChange={(item) => setDeliveryTimeline(item.value)}
            />

            <Text style={styles.label}>Delivery location</Text>
            <Dropdown
              style={dropdownBase}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.ph}
              selectedTextStyle={styles.sel}
              itemTextStyle={styles.item}
              data={DELIVERY_LOCATION_OPTIONS}
              labelField="label"
              valueField="value"
              value={deliveryLocation}
              onChange={(item) => setDeliveryLocation(item.value)}
            />

            <Text style={styles.label}>Delivery method</Text>
            <Dropdown
              style={dropdownBase}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.ph}
              selectedTextStyle={styles.sel}
              itemTextStyle={styles.item}
              data={DELIVERY_METHOD_OPTIONS}
              labelField="label"
              valueField="value"
              value={deliveryMethod}
              onChange={(item) => setDeliveryMethod(item.value)}
            />

            <Text style={styles.label}>Processing time before shipping</Text>
            <View style={styles.processingRow}>
              <TextInput
                value={processingTimeValue}
                onChangeText={(t) => setProcessingTimeValue(t.replace(/[^\d]/g, ''))}
                keyboardType="number-pad"
                style={styles.processingInput}
                editable={!busy}
              />
              <View style={styles.unitWrap}>
                <Dropdown
                  style={[dropdownBase, { flex: 1, minWidth: 100 }]}
                  containerStyle={styles.dropdownList}
                  placeholderStyle={styles.ph}
                  selectedTextStyle={styles.sel}
                  itemTextStyle={styles.item}
                  data={PROCESSING_TIME_UNIT_OPTIONS}
                  labelField="label"
                  valueField="value"
                  value={processingTimeUnit}
                  onChange={(item) => setProcessingTimeUnit(item.value)}
                />
              </View>
            </View>

            <Text style={styles.label}>If customer is not available</Text>
            <Dropdown
              style={dropdownBase}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.ph}
              selectedTextStyle={styles.sel}
              itemTextStyle={styles.item}
              data={FAILED_DELIVERY_OPTIONS}
              labelField="label"
              valueField="value"
              value={failedDeliveryPolicy}
              onChange={(item) => setFailedDeliveryPolicy(item.value)}
            />

            {err ? <Text style={styles.err}>{err}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={() => save().catch(() => {})}
              style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed, busy && styles.btnDisabled]}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={BRAND} />
              ) : (
                <Text style={styles.btnOutlineText}>Save delivery policy</Text>
              )}
            </Pressable>
            <Pressable onPress={() => !busy && onClose()} style={styles.btnGhost} disabled={busy}>
              <Text style={styles.btnGhostText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '88%',
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  scroll: { maxHeight: 480 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  title: { fontSize: 17, fontWeight: '700', color: BLACK, marginBottom: 6 },
  subtitle: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#333333', marginBottom: 4, marginTop: 10 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  processingInput: {
    minWidth: 72,
    maxWidth: 120,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: BLACK,
  },
  unitWrap: { flex: 1, minWidth: 100 },
  dropdownList: { borderRadius: 8 },
  ph: { fontSize: 14, color: MUTED },
  sel: { fontSize: 14, color: BLACK },
  item: { fontSize: 14, color: BLACK },
  err: { color: ERR, fontSize: 13, marginTop: 12 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
  },
  btnOutline: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND,
    backgroundColor: '#FFFFFF',
    minWidth: 120,
    alignItems: 'center',
  },
  btnOutlineText: { fontSize: 12, fontWeight: '600', color: BRAND },
  btnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  btnGhostText: { fontSize: 12, color: '#333333' },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.55 },
});
