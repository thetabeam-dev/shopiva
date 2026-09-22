import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { TextInput } from 'react-native-gesture-handler';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStoredUser } from '../auth/session';
import { connectChatSocket, emitSocketAck } from '../socket/chatSocket';
import { set_orderInfo } from '../../redux/order';
import { useDispatch } from 'react-redux';
import { fetchShopOwner, uploadDeliveryEvidence } from '../api';
import FormKeyboardAvoiding from '../components/FormKeyboardAvoiding';

const VendorRejectReason = [
  { label: 'out of stock', value: 'out_of_stock' },
  { label: 'incorrect price', value: 'incorrect_price' },
  { label: 'cannot deliver', value: 'cannot_deliver' },
  { label: 'product damaged', value: 'product_damaged' },
  { label: 'store unavailable', value: 'store_unavailable' },
  { label: 'suspected fraud', value: 'suspected_fraud' },
  { label: 'shipping delay', value: 'shipping_delay' },
  { label: 'duplicate order', value: 'duplicate_order' },
  { label: 'product discontinued', value: 'product_discontinued' },
  { label: 'other', value: 'other' },
];

/** Used when vendor commits to a delivery / ship-by window. */
const FULFILLMENT_TIMEFRAME_OPTIONS = [
  { label: 'Within 24 hours (today)', value: '24_hrs' },
  { label: 'Within 48 hours (tomorrow)', value: '48_hrs' },
  { label: 'Within 72 hours (3 days)', value: '72_hrs' },
  { label: 'Within 96 hours (4 days)', value: '96_hrs' },
];

const SHIPPING_METHOD_OPTIONS = [
  { label: 'Third-party logistics partner', value: 'third_party_logistics' },
  { label: 'Dispatch rider', value: 'dispatch_rider' },
  { label: 'Courier service', value: 'courier_service' },
  { label: 'Bus transport / waybill', value: 'bus_waybill' },
  { label: 'Self delivery', value: 'self_delivery' },
  // { label: 'Customer pickup', value: 'customer_pickup' },
];

/** Carrier-assisted methods need a tracking / reference ID; self delivery does not. */
function shippingUsesTrackingId(method) {
  return method != null && method !== 'self_delivery';
}

/** Who handles the final mile when marking out for delivery. */
const FINAL_DELIVERY_HANDLER_OPTIONS = [
  { label: 'Third-party logistics', value: 'third_party_logistics' },
  { label: 'Dispatch rider', value: 'dispatch_rider' },
  { label: 'Courier service', value: 'courier_service' },
  { label: 'My team / Me', value: 'vendor_team' },
  { label: 'Customer pickup (at hub)', value: 'customer_pickup_hub' },
];

const MAX_DELIVERY_EVIDENCE = 8;
const MIN_DELIVERY_EVIDENCE = 2;

const CANCEL_ORDER_REASONS = [
  { label: 'Changed my mind / Ordered by mistake', value: 'changed_mind' },
  { label: 'Shipping is taking too long', value: 'delayed_shipping' },
  { label: 'Vendor asked me to cancel', value: 'vendor_requested_cancel' },
  { label: 'Found a better price elsewhere', value: 'better_price' },
  { label: 'Other', value: 'other' },
];

export default function OrderActionScreen() {
  const { action, data } = useRoute().params;
  const [acceptance_value, set_acceptance_value] = useState('');

  function updateAccptance(data) {
    set_acceptance_value(data.value);
  }

  return (
    <>
      {action === 'acceptance' && (
        <Acceptance
          acceptance_value={acceptance_value}
          data={data}
          updateAccptance={updateAccptance}
        />
      )}

      {action === 'processing' && <Processing data={data} />}

      {action === 'shipping' && <Shipping data={data} />}

      {action === 'out_for_delivery' && <OutForDelivery data={data} />}

      {action === 'delivered' && <MarkAsDelivered data={data} />}

      {action === 'confirmation' && <ConfirmDelivery data={data} />}
      {action === 'cancellation' && data?.actor_type === 'vendor' && (
        <VendorCancelOrder data={data} />
      )}
      {action === 'cancellation' && data?.actor_type === 'customer' && (
        <CancelOrder data={data} />
      )}
    </>
  );
}

function ConfirmCheckbox({ checked, onToggle, label, rowStyle }) {
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [
        styles.checkboxRow,
        rowStyle,
        pressed && styles.checkboxRowPressed,
      ]}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

function Acceptance({ acceptance_value, updateAccptance, data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  const [confirmItemsInStock, setConfirmItemsInStock] = useState(false);
  const [confirmFulfillOnTime, setConfirmFulfillOnTime] = useState(false);
  const [confirmPerformancePolicy, setConfirmPerformancePolicy] =
    useState(false);
  const [fulfillmentDuration, setFulfillmentDuration] = useState(null);

  const navigation = useNavigation();
  useEffect(() => {
    connectChatSocket();
  }, []);

  if (data.stage === 'order_rejected') {
    return (
      <>
        {(
          <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
            {loading && <Spinner />}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.processingScrollContent,
                styles.acceptanceScrollPaddingBottom,
                { paddingTop: 15 },
              ]}
            >
              <View style={styles.processingCard}>
                <Text style={styles.processingSectionTitle}>
                  Cannot fulfill this order
                </Text>
                <Text style={styles.processingSectionSubtitle}>
                  Choose the reason that best matches the situation. This is
                  shared with the customer.
                </Text>
                <Dropdown
                  style={styles.processingDropdown}
                  containerStyle={styles.dropdownContainer}
                  placeholderStyle={styles.placeholderStyle}
                  selectedTextStyle={styles.selectedTextStyle}
                  itemTextStyle={styles.itemTextStyle}
                  inputSearchStyle={styles.inputSearchStyle}
                  iconStyle={styles.iconStyle}
                  data={VendorRejectReason}
                  search
                  maxHeight={280}
                  labelField="label"
                  valueField="value"
                  placeholder="Select reason"
                  searchPlaceholder="Search reasons..."
                  value={acceptance_value}
                  onChange={item => {
                    updateAccptance(item);
                    setReason(item.value);
                  }}
                />
              </View>
              {acceptance_value === 'other' && (
                <View style={styles.processingCard}>
                  <Text style={styles.processingFieldLabel}>Other reason</Text>
                  <Text style={styles.processingFieldHint}>
                    Briefly explain so the customer understands.
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.acceptanceFormInput]}
                    placeholder="Describe the reason"
                    onChangeText={txt => setReason(txt)}
                  />
                </View>
              )}
              <View style={styles.processingCard}>
                <Text style={styles.processingFieldLabel}>
                  Additional details (optional)
                </Text>
                <Text style={styles.processingFieldHint}>
                  Extra context for support or your own records.
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textInputMultiline,
                    styles.acceptanceFormInput,
                  ]}
                  multiline
                  placeholder="Add optional notes…"
                  onChangeText={txt => setNote(txt)}
                />
              </View>
            </ScrollView>

            <View
              style={[
                styles.actionBar,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Pressable
                onPress={e => navigation.goBack()}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && styles.btnSecondaryPressed,
                ]}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                // onPress={onResendInvoice}
                onPress={e => {
                  Alert.alert(
                    'Reject Order Warning',
                    'You will not be able to reinstate this order after you reject it.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'Reject',
                        style: 'destructive',
                        onPress: async () => {
                          setLoading(!loading);
                          const u = await getStoredUser();
                          const response = await emitSocketAck(
                            'order_acceptance',
                            {
                              ...data,
                              meta: {
                                reason: reason,
                              },
                              notes: note,
                              actor_id: u.id,
                            },
                          );
                          if (response.success) {
                            dispatch(set_orderInfo(response.result));
                            navigation.goBack();
                          }
                        },
                      },
                    ],
                  );
                }}
                style={({ pressed }) => [
                  styles.btnReject,
                  pressed && styles.btnRejectPressed,
                ]}
              >
                <Text style={styles.btnRejectText}>Reject</Text>
              </Pressable>
            </View>
          </FormKeyboardAvoiding>
        )}
      </>
    );
  } else {
    return (
      <>
        {(
          <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
            {loading && <Spinner />}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.processingScrollContent,
                styles.acceptanceScrollPaddingBottom,
                { paddingTop: 15 },
              ]}
            >
              <View style={styles.processingCard}>
                <Text style={styles.processingSectionTitle}>Accept order</Text>
                <Text style={styles.processingSectionSubtitle}>
                  Confirm each statement. The customer is notified as soon as
                  you accept.
                </Text>
                <View style={styles.processingChecklist}>
                  <ConfirmCheckbox
                    checked={confirmItemsInStock}
                    onToggle={setConfirmItemsInStock}
                    label="Items are available in stock"
                    rowStyle={styles.processingCheckboxRow}
                  />
                  <View style={styles.processingChecklistDivider} />
                  <ConfirmCheckbox
                    checked={confirmFulfillOnTime}
                    onToggle={setConfirmFulfillOnTime}
                    label="I can fulfill this order on time"
                    rowStyle={styles.processingCheckboxRow}
                  />
                  <View style={styles.processingChecklistDivider} />
                  <ConfirmCheckbox
                    checked={confirmPerformancePolicy}
                    onToggle={setConfirmPerformancePolicy}
                    label="I understand performance policy"
                    rowStyle={styles.processingCheckboxRow}
                  />
                </View>
              </View>

              <View style={styles.processingCard}>
                <Text style={styles.processingFieldLabel}>
                  Estimated ship time
                </Text>
                <Text style={styles.processingFieldHint}>
                  When do you plan to hand this order to the carrier? This helps
                  set customer expectations.
                </Text>
                <Dropdown
                  style={styles.processingDropdown}
                  containerStyle={styles.dropdownContainer}
                  placeholderStyle={styles.placeholderStyle}
                  selectedTextStyle={styles.selectedTextStyle}
                  itemTextStyle={styles.processingDropdownItem}
                  iconStyle={styles.iconStyle}
                  data={FULFILLMENT_TIMEFRAME_OPTIONS}
                  maxHeight={280}
                  labelField="label"
                  valueField="value"
                  placeholder="Select timeframe"
                  value={fulfillmentDuration}
                  onChange={item => setFulfillmentDuration(item.value)}
                />
              </View>

              <View style={styles.processingCard}>
                <Text style={styles.processingFieldLabel}>
                  Notes (optional)
                </Text>
                <Text style={styles.processingFieldHint}>
                  Optional message stored on the order.
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textInputMultiline,
                    styles.acceptanceFormInput,
                  ]}
                  multiline
                  placeholder="Note something down…"
                  onChangeText={txt => setNote(txt)}
                />
              </View>

              <View
                style={[styles.processingCard, styles.acceptDisclaimerCard]}
              >
                <Text style={styles.acceptIntroText}>
                  By accepting this order, you confirm that the products are
                  available and will be shipped within the required timeframe.
                </Text>
              </View>
            </ScrollView>

            <View
              style={[
                styles.actionBar,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <Pressable
                onPress={e => navigation.goBack()}
                style={({ pressed }) => [
                  styles.btnSecondary,
                  pressed && styles.btnSecondaryPressed,
                ]}
              >
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  if (
                    !confirmItemsInStock ||
                    !confirmFulfillOnTime ||
                    !confirmPerformancePolicy
                  ) {
                    Alert.alert(
                      'Confirmation required',
                      'Please confirm all statements before accepting this order.',
                    );
                    return;
                  }
                  if (
                    fulfillmentDuration == null ||
                    fulfillmentDuration === ''
                  ) {
                    Alert.alert(
                      'Ship time required',
                      'Select when you will ship this order so the customer sees an accurate commitment.',
                    );
                    return;
                  }
                  setLoading(!loading);
                  const u = await getStoredUser();
                  

                  async function AcceptSubmit() {
                    const response = await emitSocketAck('order_acceptance', {
                      ...data,
                      meta: {
                        ...(data.meta && typeof data.meta === 'object'
                          ? data.meta
                          : {}),
                        vendor_confirmations: {
                          items_in_stock: true,
                          fulfill_on_time: true,
                          performance_policy: true,
                        },
                        fulfillment_duration: fulfillmentDuration,
                        fulfillment_duration_label: FULFILLMENT_TIMEFRAME_OPTIONS.find(
                          o => o.value === fulfillmentDuration
                        )?.label ?? null,
                      },
                      notes: note,
                      actor_id: u.id,
                    });
                    if (response.success) {
                      dispatch(set_orderInfo(response.result));
                      navigation.goBack();
                    }
                  }
                  Alert.alert(
                    'Confirm order acceptance',
                    'By accepting this order, you agree to deliver the item to the customer',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Confirm',
                        style: 'default',
                        onPress:  AcceptSubmit,
                      },
                    ],
                  );
                }}
                style={({ pressed }) => [
                  styles.btnAccept,
                  pressed && styles.btnAcceptPressed,
                ]}
              >
                <Text style={styles.btnAcceptText}>Accept</Text>
              </Pressable>
            </View>
          </FormKeyboardAvoiding>
        )}
      </>
    );
  }
}

function Processing({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [loading, setLoading] = useState(false);
  const [startedProcessing, setStartedProcessing] = useState(false);
  const [shipWithinCommitment, setShipWithinCommitment] = useState(false);
  const [fulfillmentDuration, setFulfillmentDuration] = useState(null);

  useEffect(() => {
    connectChatSocket();
  }, []);

  const submitProcessingMeta = () => ({
    ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
    started_processing: startedProcessing,
    ship_within_commitment: shipWithinCommitment,
    fulfillment_duration: fulfillmentDuration,
    fulfillment_duration_label:
      FULFILLMENT_TIMEFRAME_OPTIONS.find(o => o.value === fulfillmentDuration)
        ?.label ?? null,
  });

  const validateProcessing = () => {
    if (!startedProcessing || !shipWithinCommitment) {
      Alert.alert(
        'Confirmations required',
        'Check both boxes to confirm you are processing this order on schedule.',
      );
      return false;
    }
    if (fulfillmentDuration == null || fulfillmentDuration === '') {
      Alert.alert(
        'Ship time required',
        'Select when you expect to ship so the customer sees an accurate window.',
      );
      return false;
    }
    return true;
  };

  const runProcessingConfirm = async () => {
    if (!validateProcessing()) return;
    setLoading(!loading);
    const u = await getStoredUser();
    const response = await emitSocketAck('order_processing', {
      ...data,
      meta: submitProcessingMeta(),
      outcome: 'success',
      actor_id: u.id,
    });
    if (response.success) {
      dispatch(set_orderInfo(response.result));
      navigation.goBack();
    }
  };

  return (
    <>
      {(
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {loading && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>Process order</Text>
              <Text style={styles.processingSectionSubtitle}>
                Confirm you are actively preparing this order and will ship on
                time.
              </Text>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={startedProcessing}
                  onToggle={setStartedProcessing}
                  label="I've started processing this order"
                  rowStyle={styles.processingCheckboxRow}
                />
                <View style={styles.processingChecklistDivider} />
                <ConfirmCheckbox
                  checked={shipWithinCommitment}
                  onToggle={setShipWithinCommitment}
                  label="Order will ship within the required timeframe"
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Estimated ship time
              </Text>
              <Text style={styles.processingFieldHint}>
                When do you plan to hand this order to the carrier? This helps
                set customer expectations.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={FULFILLMENT_TIMEFRAME_OPTIONS}
                maxHeight={280}
                labelField="label"
                valueField="value"
                placeholder="Select timeframe"
                value={fulfillmentDuration}
                onChange={item => setFulfillmentDuration(item.value)}
              />
            </View>
            <View style={[styles.processingCard, styles.acceptDisclaimerCard]}>
              <Text style={styles.acceptIntroText}>
                By confirming, you state that the order is being prepared for
                shipment according to your commitments.
              </Text>
            </View>
          </ScrollView>
          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Confirm processing',
                  'Confirm you have started preparing this order for shipment.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'default',
                      onPress: runProcessingConfirm,
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.btnAccept,
                pressed && styles.btnAcceptPressed,
              ]}
            >
              <Text style={styles.btnAcceptText}>Confirm</Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

function Shipping({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [handedOffForShipping, setHandedOffForShipping] = useState(false);
  const [withinCommittedTimeframe, setWithinCommittedTimeframe] =
    useState(false);
  const [shippingMethod, setShippingMethod] = useState(null);
  const [estimatedDelivery, setEstimatedDelivery] = useState(null);
  const [trackingId, setTrackingId] = useState('');

  useEffect(() => {
    connectChatSocket();
  }, []);

  const optionLabel = (options, value) =>
    options.find(o => o.value === value)?.label ?? null;

  const buildShippingMeta = () => ({
    ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
    handed_off_for_shipping: handedOffForShipping,
    within_committed_timeframe: withinCommittedTimeframe,
    shipping_method: shippingMethod,
    shipping_method_label: optionLabel(SHIPPING_METHOD_OPTIONS, shippingMethod),
    estimated_delivery: estimatedDelivery,
    estimated_delivery_label: optionLabel(
      FULFILLMENT_TIMEFRAME_OPTIONS,
      estimatedDelivery,
    ),
    tracking_id: shippingUsesTrackingId(shippingMethod)
      ? trackingId.trim() || null
      : null,
  });

  const validateShipping = () => {
    if (!handedOffForShipping || !withinCommittedTimeframe) {
      Alert.alert(
        'Confirmations required',
        'Confirm both statements before you mark this order as shipping.',
      );
      return false;
    }
    if (shippingMethod == null || shippingMethod === '') {
      Alert.alert(
        'Shipping method',
        'Select how this order is being sent to the customer.',
      );
      return false;
    }
    if (shippingUsesTrackingId(shippingMethod)) {
      const tid = trackingId.trim();
      if (!tid) {
        Alert.alert(
          'Tracking or reference ID required',
          'Enter a waybill, tracking number, or reference for this shipment. Self delivery is the only option that skips this.',
        );
        return false;
      }
    }
    if (estimatedDelivery == null || estimatedDelivery === '') {
      Alert.alert(
        'Delivery window',
        'Select when the customer should expect delivery (or pickup).',
      );
      return false;
    }
    return true;
  };

  const submitShipping = async () => {
    if (!validateShipping()) return;
    setLoading(!loading);
    const u = await getStoredUser();
    const response = await emitSocketAck('order_shipping', {
      ...data,
      meta: buildShippingMeta(),
      outcome: 'success',
      actor_id: u.id,
    });
    if (response.success) {
      dispatch(set_orderInfo(response.result));
      navigation.goBack();
    }
  };

  return (
    <>
     

      {(
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
         {loading && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            {/* 1 — Commitments */}
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>Ship order</Text>
              <Text style={styles.processingSectionSubtitle}>
                Confirm the order is on its way (or ready for pickup) and still
                matches what you promised.
              </Text>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={handedOffForShipping}
                  onToggle={setHandedOffForShipping}
                  label="I've shipped this order or released it for delivery / pickup"
                  rowStyle={styles.processingCheckboxRow}
                />
                <View style={styles.processingChecklistDivider} />
                <ConfirmCheckbox
                  checked={withinCommittedTimeframe}
                  onToggle={setWithinCommittedTimeframe}
                  label="Delivery or pickup stays within the timeframe I committed to"
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>

            {/* 2 — How it ships */}
            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>Shipping method</Text>
              <Text style={styles.processingFieldHint}>
                How is this order reaching the customer?
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={SHIPPING_METHOD_OPTIONS}
                maxHeight={320}
                labelField="label"
                valueField="value"
                placeholder="Select shipping method"
                value={shippingMethod}
                onChange={item => {
                  setShippingMethod(item.value);
                  if (!shippingUsesTrackingId(item.value)) {
                    setTrackingId('');
                  }
                }}
              />
              {shippingUsesTrackingId(shippingMethod) ? (
                <>
                  <Text
                    style={[
                      styles.processingFieldLabel,
                      styles.shippingTrackingLabel,
                    ]}
                  >
                    Tracking or reference ID
                  </Text>
                  <Text style={styles.processingFieldHint}>
                    Waybill, AWB, rider/courier reference, bus waybill, or
                    pickup code — anything the customer can use to trace the
                    handoff. Not required for self delivery.
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.acceptanceFormInput]}
                    placeholder="Enter tracking or reference number"
                    value={trackingId}
                    onChangeText={setTrackingId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              ) : null}
            </View>

            {/* 3 — When it arrives */}
            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Expected delivery window
              </Text>
              <Text style={styles.processingFieldHint}>
                When should the customer expect the order? Align this with the
                method you chose.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={FULFILLMENT_TIMEFRAME_OPTIONS}
                maxHeight={280}
                labelField="label"
                valueField="value"
                placeholder="Select timeframe"
                value={estimatedDelivery}
                onChange={item => setEstimatedDelivery(item.value)}
              />
            </View>

            {/* 4 — Disclaimer */}
            <View style={[styles.processingCard, styles.acceptDisclaimerCard]}>
              <Text style={styles.acceptIntroText}>
                By confirming, you state that shipment or pickup details above
                are accurate. Keep the customer updated if anything changes.
              </Text>
            </View>
          </ScrollView>
          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Confirm shipping',
                  'Submit this shipping update for the customer?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'default',
                      onPress: submitShipping,
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.btnAccept,
                pressed && styles.btnAcceptPressed,
              ]}
            >
              <Text style={styles.btnAcceptText}>Confirm</Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

function OutForDelivery({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [confirmOutForDelivery, setConfirmOutForDelivery] = useState(false);
  const [finalDeliveryHandler, setFinalDeliveryHandler] = useState(null);
  const [riderContact, setRiderContact] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState(null);

  useEffect(() => {
    connectChatSocket();
  }, []);

  const optionLabel = (options, value) =>
    options.find(o => o.value === value)?.label ?? null;

  const buildMeta = () => ({
    ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
    out_for_delivery_confirmed: confirmOutForDelivery,
    final_delivery_handler: finalDeliveryHandler,
    final_delivery_handler_label: optionLabel(
      FINAL_DELIVERY_HANDLER_OPTIONS,
      finalDeliveryHandler,
    ),
    rider_contact: riderContact.trim() || null,
    expected_delivery: expectedDelivery,
    expected_delivery_label: optionLabel(
      FULFILLMENT_TIMEFRAME_OPTIONS,
      expectedDelivery,
    ),
  });

  const validate = () => {
    if (!confirmOutForDelivery) {
      Alert.alert(
        'Confirmation required',
        'Confirm that this order is out for final delivery before continuing.',
      );
      return false;
    }
    if (finalDeliveryHandler == null || finalDeliveryHandler === '') {
      Alert.alert(
        'Final delivery',
        'Select who is handling the final delivery.',
      );
      return false;
    }
    if (expectedDelivery == null || expectedDelivery === '') {
      Alert.alert(
        'Expected delivery',
        'Select when you expect this order to be delivered.',
      );
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(!loading);
    const u = await getStoredUser();
    const response = await emitSocketAck('order_out_for_delivery', {
      ...data,
      meta: buildMeta(),
      outcome: 'success',
      actor_id: u.id,
    });
    if (response.success) {
      dispatch(set_orderInfo(response.result));
      navigation.goBack();
    }
  };

  return (
    <>
      
      {(

        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {loading && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>
                Out for delivery
              </Text>
              <Text style={styles.processingSectionSubtitle}>
                Tell the customer the order is on the final leg to them.
              </Text>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={confirmOutForDelivery}
                  onToggle={setConfirmOutForDelivery}
                  label="I confirm this order is currently out for final delivery."
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Who is handling the final delivery?
              </Text>
              <Text style={styles.processingFieldHint}>
                Choose the party completing the last mile to the customer.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={FINAL_DELIVERY_HANDLER_OPTIONS}
                maxHeight={320}
                labelField="label"
                valueField="value"
                placeholder="Select handler"
                value={finalDeliveryHandler}
                onChange={item => setFinalDeliveryHandler(item.value)}
              />
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Rider contact number (optional)
              </Text>
              <Text style={styles.processingFieldHint}>
                If a rider or driver is involved, share their phone number for
                coordination.
              </Text>
              <TextInput
                style={[styles.textInput, styles.acceptanceFormInput]}
                placeholder="e.g. +234 801 234 5678"
                value={riderContact}
                onChangeText={setRiderContact}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                When do you expect this order to be delivered?
              </Text>
              <Text style={styles.processingFieldHint}>
                Sets customer expectations for arrival or pickup completion.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={FULFILLMENT_TIMEFRAME_OPTIONS}
                maxHeight={280}
                labelField="label"
                valueField="value"
                placeholder="Select timeframe"
                value={expectedDelivery}
                onChange={item => setExpectedDelivery(item.value)}
              />
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Confirm out for delivery',
                  'Submit this update for the customer?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'default',
                      onPress: submit,
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.btnAccept,
                pressed && styles.btnAcceptPressed,
              ]}
            >
              <Text style={styles.btnAcceptText}>Confirm</Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

function MarkAsDelivered({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [confirmed, setConfirmed] = useState(false);
  /** @type {{ id: string; uri: string; name: string; type: string }[]} */
  const [evidence, setEvidence] = useState([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    connectChatSocket();
  }, []);

  const addEvidence = async () => {
    if (evidenceUploading) return;
    if (evidence.length >= MAX_DELIVERY_EVIDENCE) {
      Alert.alert(
        'Limit reached',
        `You can add up to ${MAX_DELIVERY_EVIDENCE} photos.`,
      );
      return;
    }
    try {
      const picked = await pick({
        type: [types.images],
        allowMultiSelection: true,
      });
      const remaining = MAX_DELIVERY_EVIDENCE - evidence.length;
      const slice = picked.slice(0, remaining);
      if (slice.length === 0) return;

      const copies = await keepLocalCopy({
        files: slice.map(f => ({
          uri: f.uri,
          fileName: f.name || 'photo.jpg',
          ...(f.isVirtual && f.convertibleToMimeTypes?.[0]?.mimeType
            ? {
                convertVirtualFileToType: f.convertibleToMimeTypes[0].mimeType,
              }
            : {}),
        })),
        destination: 'cachesDirectory',
      });
      const uriBySource = Object.fromEntries(
        copies.map(c => [
          c.sourceUri,
          c.status === 'success' ? c.localUri : c.sourceUri,
        ]),
      );

      setEvidenceUploading(true);
      /** @type {{ id: string; uri: string; name: string; type: string }[]} */
      const uploaded = [];
      const failures = [];

      for (let i = 0; i < slice.length; i++) {
        const f = slice[i];
        const localUri = uriBySource[f.uri] || f.uri;
        const name = f.name || 'photo.jpg';
        const type = f.type || 'image/jpeg';
        try {
          const result = await uploadDeliveryEvidence({
            uri: localUri,
            name,
            type,
          });
          const url =
            (typeof result?.url === 'string' && result.url) ||
            (typeof result?.image?.url === 'string' && result.image.url) ||
            '';
          if (!url) {
            throw new Error('Upload succeeded but no image URL was returned.');
          }
          uploaded.push({
            id: `ev_${Date.now()}_${i}`,
            uri: url,
            name,
            type,
          });
        } catch (uploadErr) {
          failures.push(
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
          );
        }
      }

      if (uploaded.length > 0) {
        setEvidence(prev =>
          [...prev, ...uploaded].slice(0, MAX_DELIVERY_EVIDENCE),
        );
      }
      if (failures.length > 0) {
        Alert.alert(
          'Upload incomplete',
          failures.length === 1
            ? failures[0]
            : `${failures.length} photo(s) failed to upload. Please try again.`,
        );
      }
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Photos', e instanceof Error ? e.message : String(e));
    } finally {
      setEvidenceUploading(false);
    }
  };

  const removeEvidence = id => {
    setEvidence(prev => prev.filter(x => x.id !== id));
  };

  const submit = async () => {
    if (evidenceUploading) {
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    if (!confirmed) {
      Alert.alert(
        'Confirmation required',
        'Confirm that the order was delivered to the customer.',
      );
      return;
    }
    if (evidence.length < MIN_DELIVERY_EVIDENCE) {
      Alert.alert(
        'Photos required',
        `Add at least ${MIN_DELIVERY_EVIDENCE} photos: the buyer's signature and proof the order was delivered.`,
      );
      return;
    }
    setLoading(!loading);
    const u = await getStoredUser();
    const response = await emitSocketAck('order_delivered', {
      ...data,
      meta: {
        ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
        delivered_confirmed: true,
        delivery_evidence_count: evidence.length,
        delivery_evidence_files: evidence.map(e => ({
          file_name: e.name,
          mime_type: e.type,
          url: e.uri,
        })),
      },
      outcome: 'success',
      actor_id: u.id,
    });
    if (response.success) {
      dispatch(set_orderInfo(response.result));
      navigation.goBack();
    }
  };

  return (
    <>
      

      {(
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {loading && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>
                Mark as delivered
              </Text>
              <Text style={styles.processingSectionSubtitle}>
                Confirm the customer has received this order.
              </Text>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={confirmed}
                  onToggle={setConfirmed}
                  label="I confirm this order was delivered to the customer."
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Delivery evidence (photos)
              </Text>
              <Text style={styles.processingFieldHint}>
                Add clear photos: buyer signature, then proof of delivery
                (package / handoff). At least {MIN_DELIVERY_EVIDENCE} images, up
                to {MAX_DELIVERY_EVIDENCE}. Scroll sideways to review.
              </Text>
              <ScrollView
              keyboardShouldPersistTaps="handled"
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.evidenceGalleryRow}
              >
                {evidence.map(item => (
                  <View key={item.id} style={styles.evidenceTile}>
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.evidenceImage}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => removeEvidence(item.id)}
                      style={({ pressed }) => [
                        styles.evidenceRemoveBtn,
                        pressed && styles.evidenceRemoveBtnPressed,
                      ]}
                      hitSlop={8}
                    >
                      <Text style={styles.evidenceRemoveText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                {evidence.length < MAX_DELIVERY_EVIDENCE ? (
                  <Pressable
                    onPress={addEvidence}
                    disabled={evidenceUploading}
                    style={({ pressed }) => [
                      styles.evidenceAddTile,
                      pressed &&
                        !evidenceUploading &&
                        styles.evidenceAddTilePressed,
                      evidenceUploading && styles.evidenceAddTileDisabled,
                    ]}
                  >
                    {evidenceUploading ? (
                      <ActivityIndicator color="#0D8A4A" />
                    ) : (
                      <>
                        <Text style={styles.evidenceAddPlus}>+</Text>
                        <Text style={styles.evidenceAddLabel}>Add photo</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </ScrollView>
              <Text style={styles.evidenceCountLabel}>
                {evidenceUploading
                  ? 'Uploading photos…'
                  : `${evidence.length} / ${MAX_DELIVERY_EVIDENCE} photos`}
              </Text>
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={evidenceUploading || loading}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (evidenceUploading) {
                  Alert.alert('Please wait', 'Photos are still uploading.');
                  return;
                }
                Alert.alert(
                  'Confirm delivery',
                  'Mark this order as delivered for the customer?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'default',
                      onPress: submit,
                    },
                  ],
                );
              }}
              disabled={evidenceUploading || loading}
              style={({ pressed }) => [
                styles.btnAccept,
                pressed && styles.btnAcceptPressed,
              ]}
            >
              <Text style={styles.btnAcceptText}>Confirm</Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

function ConfirmDelivery({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [handedOffForShipping, setHandedOffForShipping] = useState(false);
  const [withinCommittedTimeframe, setWithinCommittedTimeframe] =
    useState(false);

  useEffect(() => {
    connectChatSocket();
  }, []);

  const validateShipping = () => {
    if (!handedOffForShipping || !withinCommittedTimeframe) {
      Alert.alert(
        'Confirmations required',
        'Confirm both statements before you mark this order as shipping.',
      );
      return false;
    }
    return true;
  };

  const submitOrder = async () => {
    if (!validateShipping()) return;
    setLoading(!loading);
    const u = await getStoredUser();
    const response = await emitSocketAck('order_confirmed', {
      ...data,
      meta: JSON.stringify({handedOffForShipping, withinCommittedTimeframe}),
      outcome: 'success',
      actor_id: u.id,
    });
    if (response.success) {
      dispatch(set_orderInfo(response.result));
      console.log("response - result",response.result);
      const orderItems = Array.isArray(response?.result?.order?.order_items)
        ? response.result.order.order_items
        : Array.isArray(response?.result?.order_items)
          ? response.result.order_items
          : [];

      const firstOrderItem = orderItems[0] ?? {};
      const orderItemId = firstOrderItem.id ?? firstOrderItem.order_item_id ?? null;
      const productId = firstOrderItem.product_id ?? firstOrderItem.productId ?? null;

      navigation.navigate("ShopReview", {
        shop: response.result.shop,
        order: {
          ...(response.result.order ?? {}),
          order_item_id: orderItemId,
          product_id: productId,
        },
        orderItemId,
        order_item_id: orderItemId,
        productId,
        product_id: productId,
      })
      // navigation.goBack();
    }
  };

  return (
    <>
      
      {(
        
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {loading && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            {/* 1 — Commitments */}
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>
                Confirm Delivery & Release Payment
              </Text>
              <Text style={styles.processingSectionSubtitle}>
                Please confirm the following to release the escrow funds to the
                vendor:
              </Text>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={handedOffForShipping}
                  onToggle={setHandedOffForShipping}
                  label="I have received all items in the correct quantity."
                  rowStyle={styles.processingCheckboxRow}
                />
                <View style={styles.processingChecklistDivider} />
                <ConfirmCheckbox
                  checked={withinCommittedTimeframe}
                  onToggle={setWithinCommittedTimeframe}
                  label="The items are in good condition and match the description."
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>

            {/* 4 — Disclaimer */}
            <View style={[styles.processingCard, styles.acceptDisclaimerCard]}>
              <Text style={styles.acceptIntroText}>
                Warning: Once you confirm, funds will be released to the vendor
                and this order cannot be disputed.
              </Text>
            </View>
          </ScrollView>
          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => {
                Alert.alert('link to dispute screen');
              }}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Raise Dispute</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Confirm order',
                  'Once you confirm, the escrow funds will be released to the vendor.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      style: 'default',
                      onPress: submitOrder,
                    },
                  ],
                );
              }}
              style={({ pressed }) => [
                styles.btnAccept,
                pressed && styles.btnAcceptPressed,
              ]}
            >
              <Text style={styles.btnAcceptText}>Confirm & Pay Vendor</Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

/** Vendor cancels an accepted / in-progress order (not the same as declining at acceptance). */
function VendorCancelOrder({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  // const [loading, setLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState(null);
  const [otherReason, setOtherReason] = useState('');
  const [note, setNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    connectChatSocket();
  }, []);

  const validate = () => {
    if (!cancelReason) {
      Alert.alert(
        'Reason required',
        'Select why you are cancelling this order.',
      );
      return false;
    }
    if (cancelReason === 'other' && !otherReason.trim()) {
      Alert.alert(
        'Details required',
        'Briefly explain why you are cancelling.',
      );
      return false;
    }
    if (!confirmCancel) {
      Alert.alert(
        'Confirmation required',
        'Confirm that you want to cancel this order for the customer.',
      );
      return false;
    }
    return true;
  };

  const submitCancellation = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const u = await getStoredUser();
      const reason =
        cancelReason === 'other' ? otherReason.trim() : cancelReason;
      const response = await emitSocketAck('order_cancelled', {
        ...data,
        meta: {
          ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
          reason,
          cancel_reason_code: cancelReason,
          cancelled_by: 'vendor',
        },
        notes:
          note.trim() || (cancelReason === 'other' ? otherReason.trim() : ''),
        outcome: 'success',
        actor_id: u.id,
      });
      if (response.success) {
        dispatch(set_orderInfo(response.result));
        navigation.goBack();
      } else {
        Alert.alert(
          'Cancellation failed',
          response?.message ||
            response?.error ||
            'Could not cancel this order. Try again.',
        );
      }
    } catch (e) {
      Alert.alert(
        'Cancellation failed',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onPressConfirm = () => {
    if (!validate()) return;
    Alert.alert(
      'Cancel order',
      'This order will be cancelled for your shop and the customer will be notified. You cannot undo this from the app.',
      [
        { text: 'Keep order', style: 'cancel' },
        {
          text: 'Cancel order',
          style: 'destructive',
          onPress: submitCancellation,
        },
      ],
    );
  };

  return (
    <>
      
      {(
        
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {submitting && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>Cancel order</Text>
              <Text style={styles.processingSectionSubtitle}>
                Tell the customer why you cannot complete this order. They may
                receive a refund according to Deedyte policy.
              </Text>
            </View>

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Cancellation reason
              </Text>
              <Text style={styles.processingFieldHint}>
                Choose the reason that best matches your situation.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.itemTextStyle}
                inputSearchStyle={styles.inputSearchStyle}
                iconStyle={styles.iconStyle}
                data={VendorRejectReason}
                search
                maxHeight={320}
                labelField="label"
                valueField="value"
                placeholder="Select reason"
                searchPlaceholder="Search reasons..."
                value={cancelReason}
                onChange={item => setCancelReason(item.value)}
              />
            </View>

            {cancelReason === 'other' ? (
              <View style={styles.processingCard}>
                <Text style={styles.processingFieldLabel}>Other reason</Text>
                <TextInput
                  style={[styles.textInput, styles.acceptanceFormInput]}
                  placeholder="Describe the reason"
                  onChangeText={setOtherReason}
                />
              </View>
            ) : null}

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Message to customer (optional)
              </Text>
              <Text style={styles.processingFieldHint}>
                Extra context shown in order history or support.
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textInputMultiline,
                  styles.acceptanceFormInput,
                ]}
                multiline
                placeholder="Add optional notes…"
                value={note}
                onChangeText={setNote}
              />
            </View>

            <View style={styles.processingCard}>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={confirmCancel}
                  onToggle={setConfirmCancel}
                  label="I understand this order will be cancelled and the customer will be notified."
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Keep order</Text>
            </Pressable>
            <Pressable
              onPress={onPressConfirm}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btnReject,
                pressed && styles.btnRejectPressed,
              ]}
            >
              <Text style={styles.btnRejectText}>
                {submitting ? 'Cancelling…' : 'Cancel order'}
              </Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

/** Customer cancels before / during fulfillment (escrow cancel delivery). */
function CancelOrder({ data }) {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [cancelReason, setCancelReason] = useState(null);
  const [otherReason, setOtherReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const postShipment = Boolean(data?.post_shipment);
  const orderTotal = Number(data?.order_total ?? 0);
  const restockingFee = Number(data?.restocking_fee ?? 0);
  const refundAmount = Math.max(0, orderTotal - restockingFee);

  useEffect(() => {
    connectChatSocket();
  }, []);

  const validate = () => {
    if (!cancelReason) {
      Alert.alert(
        'Reason required',
        'Select why you are cancelling this order.',
      );
      return false;
    }
    if (cancelReason === 'other' && !otherReason.trim()) {
      Alert.alert(
        'Details required',
        'Briefly describe your reason for cancelling.',
      );
      return false;
    }
    if (!confirmCancel) {
      Alert.alert(
        'Confirmation required',
        'Confirm that you want to cancel this order.',
      );
      return false;
    }
    return true;
  };

  const submitCancellation = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const u = await getStoredUser();
      const reason =
        cancelReason === 'other' ? otherReason.trim() : cancelReason;
      const response = await emitSocketAck('order_cancelled', {
        ...data,
        meta: {
          ...(data.meta && typeof data.meta === 'object' ? data.meta : {}),
          reason,
          cancel_reason_code: cancelReason,
          post_shipment: postShipment,
          order_total: orderTotal,
          restocking_fee: restockingFee,
          refund_amount: refundAmount,
        },
        notes: cancelReason === 'other' ? otherReason.trim() : '',
        outcome: 'success',
        actor_id: u.id,
      });
      if (response.success) {
        dispatch(set_orderInfo(response.result));
        navigation.goBack();
      } else {
        Alert.alert(
          'Cancellation failed',
          response?.message ||
            response?.error ||
            'Could not cancel this order. Try again.',
        );
      }
    } catch (e) {
      Alert.alert(
        'Cancellation failed',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onPressConfirm = () => {
    if (!validate()) return;

    if (postShipment) {
      Alert.alert(
        'Cancel delivery',
        `The vendor has already packed and shipped your order.\n\nA restocking fee of ₦${restockingFee.toLocaleString()} may be deducted from your refund.\n\nEstimated refund: ₦${refundAmount.toLocaleString()}`,
        [
          { text: 'Keep order', style: 'cancel' },
          {
            text: 'Confirm cancellation',
            style: 'destructive',
            onPress: submitCancellation,
          },
          {
            text: 'Raise dispute instead',
            onPress: () =>
              navigation.navigate('Open-dispute', {
                orderId: data?.order_id,
              }),
          },
        ],
      );
      return;
    }

    Alert.alert('Cancel order', 'Are you sure you want to cancel this order?', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Confirm cancellation',
        style: 'destructive',
        onPress: submitCancellation,
      },
    ]);
  };

  return (
    <>
      
      {(
        
        <FormKeyboardAvoiding style={[styles.cnt, styles.processingRoot]}>
        {submitting && <Spinner />}
          <ScrollView
              keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.processingScrollContent,
              styles.acceptanceScrollPaddingBottom,
              { paddingTop: 15 },
            ]}
          >
            <View style={styles.processingCard}>
              <Text style={styles.processingSectionTitle}>
                Order cancellation
              </Text>
              <Text style={styles.processingSectionSubtitle}>
                {postShipment
                  ? 'This order is already in transit. Cancelling may reduce your refund.'
                  : 'Tell us why you want to cancel. The vendor will be notified.'}
              </Text>
            </View>

            {postShipment ? (
              <View
                style={[
                  styles.processingCard,
                  styles.acceptDisclaimerCard,
                  { backgroundColor: '#fff' },
                ]}
              >
                <Text style={styles.acceptIntroText}>
                  Restocking fee (est.): ₦{restockingFee.toLocaleString()}
                  {'\n'}
                  Estimated refund: ₦{refundAmount.toLocaleString()}
                </Text>
              </View>
            ) : null}

            <View style={styles.processingCard}>
              <Text style={styles.processingFieldLabel}>
                Cancellation reason
              </Text>
              <Text style={styles.processingFieldHint}>
                Select the option that best describes your situation.
              </Text>
              <Dropdown
                style={styles.processingDropdown}
                containerStyle={styles.dropdownContainer}
                placeholderStyle={styles.placeholderStyle}
                selectedTextStyle={styles.selectedTextStyle}
                itemTextStyle={styles.processingDropdownItem}
                iconStyle={styles.iconStyle}
                data={CANCEL_ORDER_REASONS}
                maxHeight={320}
                labelField="label"
                valueField="value"
                placeholder="Select reason"
                value={cancelReason}
                onChange={item => setCancelReason(item.value)}
              />
            </View>

            {cancelReason === 'other' ? (
              <View style={styles.processingCard}>
                <Text style={styles.processingFieldLabel}>Other reason</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textInputMultiline,
                    styles.acceptanceFormInput,
                  ]}
                  multiline
                  placeholder="Describe why you are cancelling…"
                  value={otherReason}
                  onChangeText={setOtherReason}
                />
              </View>
            ) : null}

            <View style={styles.processingCard}>
              <View style={styles.processingChecklist}>
                <ConfirmCheckbox
                  checked={confirmCancel}
                  onToggle={setConfirmCancel}
                  label="I understand this order will be cancelled and I may receive a partial refund depending on order status."
                  rowStyle={styles.processingCheckboxRow}
                />
              </View>
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btnSecondary,
                pressed && styles.btnSecondaryPressed,
              ]}
            >
              <Text style={styles.btnSecondaryText}>Keep order</Text>
            </Pressable>
            <Pressable
              onPress={onPressConfirm}
              disabled={submitting}
              style={({ pressed }) => [
                styles.btnReject,
                pressed && styles.btnRejectPressed,
              ]}
            >
              <Text style={styles.btnRejectText}>
                {submitting ? 'Cancelling…' : 'Confirm cancellation'}
              </Text>
            </Pressable>
          </View>
        </FormKeyboardAvoiding>
      )}
    </>
  );
}

function Spinner() {
  return (
    <>
      <View
        style={{
          height: '100%',
          width: '100%',
          position: 'absolute',
          top: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}
      >
        <ActivityIndicator size="large" color="green" />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  cnt: {
    flex: 1,
    // backgroundColor: '#FFFFFF',
  },
  processingRoot: {
    backgroundColor: '#F2F3F5',
  },
  processingScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  acceptanceScrollPaddingBottom: {
    paddingBottom: 100,
  },
  acceptanceFormInput: {
    borderRadius: 5,
    borderColor: '#DCDCE0',
  },
  acceptDisclaimerCard: {
    backgroundColor: '#F8F9FA',
    borderColor: '#ECECEF',
  },
  processingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E7EB',
  },
  processingSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  processingSectionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#5C5C66',
    lineHeight: 19,
    marginBottom: 14,
  },
  processingChecklist: {
    backgroundColor: '#F8F9FA',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ECECEF',
    overflow: 'hidden',
  },
  processingChecklistDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E2E6',
    marginLeft: 46,
  },
  processingCheckboxRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  processingFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  processingFieldHint: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B6B76',
    lineHeight: 17,
    marginBottom: 12,
  },
  processingDropdown: {
    minHeight: 50,
    borderColor: '#DCDCE0',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
  },
  processingDropdownItem: {
    fontSize: 14,
    color: '#111111',
  },
  shippingTrackingLabel: {
    marginTop: 16,
  },
  evidenceGalleryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 4,
  },
  evidenceTile: {
    width: 104,
    height: 104,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ECECEF',
    borderWidth: 1,
    borderColor: '#DCDCE0',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  evidenceRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceRemoveBtnPressed: {
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  evidenceRemoveText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: -1,
  },
  evidenceAddTile: {
    width: 104,
    height: 104,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#0D8A4A',
    backgroundColor: '#F0FAF4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  evidenceAddTilePressed: {
    backgroundColor: '#DCEFE6',
  },
  evidenceAddTileDisabled: {
    opacity: 0.6,
  },
  evidenceAddPlus: {
    fontSize: 28,
    fontWeight: '300',
    color: '#0D8A4A',
    lineHeight: 32,
  },
  evidenceAddLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D8A4A',
    marginTop: 2,
    textAlign: 'center',
  },
  evidenceCountLabel: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B6B76',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E2E6',
  },
  btnAccept: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D8A4A',
  },
  btnAcceptPressed: {
    backgroundColor: '#0A6B3A',
  },
  btnAcceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  btnSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  btnSecondaryPressed: {
    backgroundColor: '#EBEBEB',
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  btnReject: {
    flex: 1,
    height: 44,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
  },
  btnRejectPressed: {
    backgroundColor: '#A01A1A',
  },
  btnRejectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  dropdownBlock: {
    width: '95%',
    alignSelf: 'center',
  },
  dropdown: {
    minHeight: 52,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
    marginTop: 8,
  },
  dropdownContainer: {
    borderRadius: 8,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#999999',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  itemTextStyle: {
    fontSize: 14,
    textTransform: 'capitalize',
    color: '#111111',
  },
  inputSearchStyle: {
    height: 44,
    fontSize: 14,
    borderRadius: 8,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  iconStyle: {
    width: 20,
    height: 20,
    tintColor: '#999999',
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#C62828',
    fontWeight: '500',
  },
  inputCnt: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  acceptIntroText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#333333',
    lineHeight: 22,
  },
  textInput: {
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111111',
    backgroundColor: '#FAFAFA',
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  checkboxRowPressed: {
    opacity: 0.75,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#0D8A4A',
    borderColor: '#0D8A4A',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111111',
  },
});
