import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { TextInput } from 'react-native-gesture-handler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { fetchBuyerOrder, uploadDisputeEvidence } from '../api';
import { getStoredUser } from '../auth/session';
import { connectChatSocket, emitSocketAck } from '../socket/chatSocket';
import { mapBuyerDisputeRow } from '../utils/buyerUi';
import { set_disputeInfo } from '../../redux/dispute';
import { set_orderInfo } from '../../redux/order';
import { set_orderList } from '../../redux/orders';
import { set_disputeList } from '../../redux/disputes';
import { formatNaira } from '../utils/formatNaira';


const PRIMARY = '#00926e';
const PAGE_BG = '#F2F2F3';
const CARD_BG = '#FFFFFF';
const BORDER = '#E0E0E0';
const MUTED = '#757575';
const ERROR = '#C62828';
const ERROR_BG = '#FFEBEE';
const EXPRESS_SHIPPING = 1000;

const DISPUTE_REASONS = [
  { label: 'Did not receive the order(s)', value: 'order_not_received' },
  { label: 'Item not as described', value: 'not_as_described' },
  { label: 'Wrong item received', value: 'wrong_item' },
  { label: 'Item is damaged', value: 'damaged_item' },
  { label: 'Item is defective / not working', value: 'defective_item' },
  { label: 'Missing items in package', value: 'missing_items' },
  { label: 'Other', value: 'other' },
];

const RESOLUTIONS = [
  // { label: 'Full refund', value: 'refund' },
  // { label: 'Replacement item', value: 'replacement' },
  { label: 'Return and refund', value: 'return_refund' },
];

const MIN_EVIDENCE = 1;
const MAX_EVIDENCE = 6;
const DESCRIPTION_MIN = 15;
const DESCRIPTION_MAX = 1000;

/**
 * @param {unknown} route
 * @param {{ order?: Record<string, unknown> } | null | undefined} orderInfo
 */
function resolveNumericOrderId(route, orderInfo) {
  const params = route?.params ?? {};
  const direct = params.orderId ?? params.order_id;
  if (direct != null) {
    const n = Number(direct);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  const fromNested = params.order?.orderId ?? params.order?.id ?? params.order?.order_id;
  if (fromNested != null) {
    const n = Number(fromNested);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  const o = orderInfo?.order;
  if (o && typeof o === 'object') {
    for (const key of ['id', 'order_id', 'orderId']) {
      const v = /** @type {Record<string, unknown>} */ (o)[key];
      if (v != null) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return Math.trunc(n);
      }
    }
  }
  return null;
}

function labelForValue(options, value) {
  return options.find((o) => o.value === value)?.label ?? value ?? '—';
}

/**
 * @param {unknown} row
 * @param {number} [index]
 */
function normalizeOrderItemLine(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const keyRaw = r.id ?? r.item_id ?? index;
  const key =
    (typeof keyRaw === 'string' || typeof keyRaw === 'number' ? String(keyRaw) : '').trim() ||
    `line-${index}`;
  const product =
    r.product && typeof r.product === 'object'
      ? /** @type {Record<string, unknown>} */ (r.product)
      : null;
  const title = String(product?.name ?? 'Item').trim() || 'Item';
  const unitPrice = Number(r.unit_price) || 0;
  const qty = Math.max(1, Number(r.qty ?? r.units ?? 1));
  let image = typeof r.image === 'string' ? r.image.trim() : '';
  if (!image && product) {
    if (typeof product.image === 'string' && product.image.trim()) {
      image = product.image.trim();
    } else if (Array.isArray(product.images)) {
      const first = product.images.find((x) => typeof x === 'string' && x.trim());
      if (typeof first === 'string') image = first.trim();
    }
  }
  return { key, title, image, unitPrice, qty };
}

/**
 * @param {{
 *   lines: Array<{ key: string; title: string; image: string; unitPrice: number; qty: number }>;
 *   styles: object;
 *   selectable?: boolean;
 *   selectedKeys?: string[];
 *   onToggle?: (key: string) => void;
 * }} p
 */
function OrderLinesList({ lines, styles: S, selectable, selectedKeys, onToggle }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <>
      {lines.map((line, idx) => {
        const lineTotal = line.unitPrice * line.qty;
        const last = idx === lines.length - 1;
        const selected = selectable && selectedKeys?.includes(line.key);
        const row = (
          <View style={[S.orderLine, last ? S.orderLineLast : null]}>
            {selectable ? (
              <View style={[S.itemSelectCheck, selected && S.itemSelectCheckOn]}>
                {selected ? <Text style={S.itemSelectCheckMark}>✓</Text> : null}
              </View>
            ) : null}
            {line.image ? (
              <Image source={{ uri: line.image }} style={S.orderThumb} resizeMode="cover" />
            ) : (
              <View style={[S.orderThumb, S.orderThumbPh]}>
                <Icon name="image-outline" size={22} color="#BDBDBD" />
              </View>
            )}
            <View style={S.orderLineBody}>
              <Text style={S.orderTitle} numberOfLines={2}>
                {line.title}
              </Text>
              <Text style={S.orderMeta}>
                {formatNaira(line.unitPrice)} × {line.qty}
              </Text>
            </View>
            <Text style={S.orderLineTotal}>{formatNaira(lineTotal)}</Text>
          </View>
        );
        if (!selectable || !onToggle) {
          return (
            <View key={line.key}>
              {row}
            </View>
          );
        }
        return (
          <Pressable
            key={line.key}
            onPress={() => onToggle(line.key)}
            style={({ pressed }) => [pressed && S.itemSelectRowPressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
          >
            {row}
          </Pressable>
        );
      })}
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

function ConfirmCheckbox({ checked, onToggle, label }) {
  return (
    <Pressable
      onPress={() => onToggle(!checked)}
      style={({ pressed }) => [styles.checkboxRow, pressed && styles.checkboxRowPressed]}
    >
      <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}


export default function OpenDispute() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const auth = useSelector((s) => s.auth);
  const { orderInfo } = useSelector((s) => s.orderInfo);
  const isCustomer = auth.activeRole === 'customer';

  const orderId = useMemo(
    () => resolveNumericOrderId(route, orderInfo),
    [route, orderInfo]
  );

  const [orderLabel, setOrderLabel] = useState(
    orderId != null ? `Order #${orderId}` : 'Order'
  );
  const [submitting, setSubmitting] = useState(false);
  const [disputeOpenItems, setDisputeOpenItems] = useState(false);
  /** @type {string[]} */
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);
  /** @type {string[]} */
  const [draftItemKeys, setDraftItemKeys] = useState([]);

  const orderItemLines = useMemo(() => {
    const items = orderInfo?.order_items;
    if (!Array.isArray(items)) return [];
    return items
      .map((row, i) => normalizeOrderItemLine(row, i))
      .filter((line) => line != null);
  }, [orderInfo?.order_items]);

  const selectedOrderLines = useMemo(
    () => orderItemLines.filter((line) => selectedItemKeys.includes(line.key)),
    [orderItemLines, selectedItemKeys]
  );

  const selectedItemsForMetadata = useMemo(() => {
    const items = orderInfo?.order_items;
    if (!Array.isArray(items)) return [];
    return items
      .map((row, i) => ({ row, line: normalizeOrderItemLine(row, i) }))
      .filter(({ line }) => line && selectedItemKeys.includes(line.key))
      .map(({ row, line }) => {
        const r = /** @type {Record<string, unknown>} */ (row);
        const orderItemId = Number(r.id);
        const productId = Number(r.item_id);
        const totalRaw = r.total_price != null ? Number(r.total_price) : NaN;
        return {
          order_item_id:
            Number.isFinite(orderItemId) && orderItemId > 0 ? orderItemId : null,
          item_id:
            Number.isFinite(productId) && productId > 0 ? productId : null,
          name: line.title,
          unit_price: line.unitPrice,
          qty: line.qty,
          total_price:
            Number.isFinite(totalRaw) && totalRaw >= 0
              ? totalRaw
              : line.unitPrice * line.qty,
          image: line.image || null,
        };
      });
  }, [orderInfo?.order_items, selectedItemKeys]);

  const draftOrderLines = useMemo(
    () => orderItemLines.filter((line) => draftItemKeys.includes(line.key)),
    [orderItemLines, draftItemKeys]
  );

  const draftSubtotal = useMemo(
    () => draftOrderLines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [draftOrderLines]
  );

  useEffect(() => {
    if (orderItemLines.length === 1) {
      setSelectedItemKeys([orderItemLines[0].key]);
    }
  }, [orderItemLines]);

  const handleOpenItemPicker = useCallback(() => {
    if (orderItemLines.length === 0) {
      Alert.alert('No items', 'This order has no items to dispute.');
      return;
    }
    if (orderItemLines.length === 1) {
      setSelectedItemKeys([orderItemLines[0].key]);
      return;
    }
    setDraftItemKeys([...selectedItemKeys]);
    setDisputeOpenItems(true);
  }, [orderItemLines, selectedItemKeys]);

  const toggleDraftItemKey = useCallback((key) => {
    setDraftItemKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const confirmItemSelection = useCallback(() => {
    if (draftItemKeys.length === 0) {
      Alert.alert('Select items', 'Choose at least one item from your order.');
      return;
    }
    setSelectedItemKeys([...draftItemKeys]);
    setDisputeOpenItems(false);
  }, [draftItemKeys]);

  const closeItemPicker = useCallback(() => {
    setDisputeOpenItems(false);
  }, []);

  const [reasonCode, setReasonCode] = useState(null);
  /** @type {{ id: string; uri: string; name: string; type: string }[]} */
  const [evidence, setEvidence] = useState([]);
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [resolution, setResolution] = useState(null);
  const [confirmedAccurate, setConfirmedAccurate] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Open dispute' });
  }, [navigation]);

  useEffect(() => {
    connectChatSocket();
  }, []);

  useLayoutEffect(() => {
    if (orderId == null) return;
    let cancelled = false;
    fetchBuyerOrder(orderId)
      .then(({ order }) => {
        if (cancelled || !order || typeof order !== 'object') return;
        const ref =
          order.order_id != null
            ? String(order.order_id)
            : order.id != null
              ? String(order.id)
              : String(orderId);
        const shop =
          order.shop && typeof order.shop === 'object'
            ? String(/** @type {{ name?: string }} */ (order.shop).name ?? '').trim()
            : '';
        setOrderLabel(shop ? `${shop} · #${ref}` : `Order #${ref}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const reasonLabel = labelForValue(DISPUTE_REASONS, reasonCode);

  const addEvidence = useCallback(async () => {
    if (evidenceUploading) return;
    if (evidence.length >= MAX_EVIDENCE) {
      Alert.alert('Limit reached', `You can add up to ${MAX_EVIDENCE} photos.`);
      return;
    }
    try {
      const picked = await pick({
        type: [types.images],
        allowMultiSelection: true,
      });
      const remaining = MAX_EVIDENCE - evidence.length;
      const slice = picked.slice(0, remaining);
      if (slice.length === 0) return;

      const copies = await keepLocalCopy({
        files: slice.map((f) => ({
          uri: f.uri,
          fileName: f.name || 'photo.jpg',
          ...(f.isVirtual && f.convertibleToMimeTypes?.[0]?.mimeType
            ? { convertVirtualFileToType: f.convertibleToMimeTypes[0].mimeType }
            : {}),
        })),
        destination: 'cachesDirectory',
      });
      const uriBySource = Object.fromEntries(
        copies.map((c) => [
          c.sourceUri,
          c.status === 'success' ? c.localUri : c.sourceUri,
        ])
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
          const result = await uploadDisputeEvidence({
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
            id: `dsp_${Date.now()}_${i}`,
            uri: url,
            name,
            type,
          });
        } catch (uploadErr) {
          failures.push(
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr)
          );
        }
      }

      if (uploaded.length > 0) {
        setEvidence((prev) => [...prev, ...uploaded].slice(0, MAX_EVIDENCE));
      }
      if (failures.length > 0) {
        Alert.alert(
          'Upload incomplete',
          failures.length === 1
            ? failures[0]
            : `${failures.length} photo(s) failed to upload. Please try again.`
        );
      }
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      Alert.alert('Photos', e instanceof Error ? e.message : String(e));
    } finally {
      setEvidenceUploading(false);
    }
  }, [evidence.length, evidenceUploading]);

  const removeEvidence = (id) => {
    setEvidence((prev) => prev.filter((x) => x.id !== id));
  };

  const validate = () => {
    if (!isCustomer) {
      Alert.alert(
        'Buyers only',
        'Disputes are submitted by the buyer who received the order.'
      );
      return false;
    }
    if (orderId == null) {
      Alert.alert('Order required', 'Open this screen from an order to link your dispute.');
      return false;
    }
    if (selectedItemKeys.length === 0) {
      Alert.alert(
        'Item required',
        'Select at least one item from your order before submitting.'
      );
      return false;
    }
    if (!reasonCode) {
      Alert.alert('Reason required', 'Select what is wrong with your order.');
      return false;
    }
    if (evidence.length < MIN_EVIDENCE) {
      Alert.alert(
        'Photos required',
        `Add at least ${MIN_EVIDENCE} photo showing the issue.`
      );
      return false;
    }
    const desc = description.trim();
    if (desc.length < DESCRIPTION_MIN) {
      Alert.alert(
        'Description required',
        `Describe the issue in at least ${DESCRIPTION_MIN} characters.`
      );
      return false;
    }
    if (desc.length > DESCRIPTION_MAX) {
      Alert.alert('Too long', `Keep your description under ${DESCRIPTION_MAX} characters.`);
      return false;
    }
    if (!resolution) {
      Alert.alert('Required', 'What resolution do you want?');
      return false;
    }
    if (!confirmedAccurate) {
      Alert.alert(
        'Confirmation required',
        'Confirm that your information and evidence are accurate.'
      );
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (evidenceUploading) {
      Alert.alert('Please wait', 'Photos are still uploading.');
      return;
    }
    if (!validate() || orderId == null) return;
    setSubmitting(true);
    try {
      const u = await getStoredUser();
      if (!u?.id) {
        Alert.alert('Sign in required', 'Please sign in to submit a dispute.');
        return;
      }
      const customerId = Number(u.id);
      const dispute_ref = `DSP-${customerId}-${Date.now()}`;
      const metadata = {
        reason_code: reasonCode,
        preferred_resolution: resolution,
        preferred_resolution_label: labelForValue(RESOLUTIONS, resolution),
        confirmed_accurate: confirmedAccurate,
        submitted_at: new Date().toISOString(),
        form_version: 'mvp',
        evidence: evidence.map((e) => ({
          file_name: e.name,
          mime_type: e.type,
          url: e.uri,
        })),
        shop_id:
          orderInfo?.shop?.id != null ? String(orderInfo.shop.id) : undefined,
        selected_items: selectedItemsForMetadata,
      };

      /** @type {Record<string, unknown>} */
      const payload = {
        dispute_ref,
        customer_id: customerId,
        order_id: orderId,
        status: 'open',
        reason: reasonLabel,
        description: description.trim(),
        source: 'customer',
        metadata,
      };

      const response = await emitSocketAck('raise_dispute', payload);
      if (!response.success) {
        throw new Error(response.error || response.message || 'Dispute failed');
      }
      dispatch(set_disputeInfo(response.dispute.customer.cdi));
      dispatch(set_disputeList(response.dispute.customer.cdl));
      if(auth.activeRole === "vendor"){
        dispatch(set_orderInfo(response.others.voi))
        dispatch(set_orderList(response.others.vol))
      }else{
        dispatch(set_orderInfo(response.others.coi))
        dispatch(set_orderList(response.others.col))
      }
      
  
      Alert.alert(
        'Dispute submitted',
        'We have received your dispute. Our team will review your evidence and contact you.',
        [
          {
            text: 'View dispute',
            onPress: () =>
              navigation.replace('Dispute-detail', {
                dispute: response.others.coi,
                disputeId: response.others.coi.dispute.id,
              }),
          },
        ]
      );
    } catch (e) {
      Alert.alert(
        'Could not submit',
        e instanceof Error ? e.message : String(e)
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isCustomer) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Buyer dispute</Text>
        <Text style={styles.centeredSub}>
          Only the buyer can open a post-delivery dispute. Switch to your customer
          account if you purchased this order.
        </Text>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPrimaryPressed]}
        >
          <Text style={styles.btnPrimaryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }



  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.root}>
        {submitting && <Spinner />}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 100 },
          ]}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Raise a dispute</Text>
            <Text style={styles.heroSub}>
              Funds for {orderLabel} are in escrow. Tell us what went wrong, add a
              photo, and choose how you would like this resolved.
            </Text>
            {orderId == null ? (
              <Text style={styles.heroWarning}>
                No order linked — open this screen from order details.
              </Text>
            ) : null}


          </View>
          <Section title="Select item from order">
            <Pressable
              onPress={handleOpenItemPicker}
              style={({ pressed }) => [
                styles.itemPickerRow,
                pressed && styles.itemPickerRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Select item from order"
            >
              <View style={styles.itemPickerBody}>
                {selectedOrderLines.length > 0 ? (
                  <OrderLinesList lines={selectedOrderLines} styles={styles} />
                ) : (
                  <Text style={styles.itemPickerPlaceholder}>
                    {orderItemLines.length > 1
                      ? 'Tap to select item(s) from your order'
                      : orderItemLines.length === 1
                        ? 'Item will be selected automatically'
                        : 'No items on this order'}
                  </Text>
                )}
              </View>
              {orderItemLines.length > 1 ? (
                <Icon name="chevron-forward" size={20} color={MUTED} style={styles.itemPickerChevron} />
              ) : null}
            </Pressable>
          </Section>
          <Section title="What is the issue with your order?">
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              itemTextStyle={styles.itemTextStyle}
              data={DISPUTE_REASONS}
              labelField="label"
              valueField="value"
              placeholder="Select a reason"
              value={reasonCode}
              onChange={(item) => setReasonCode(item.value)}
            />
          </Section>
          <Section
            title="Describe the issue"
            subtitle={`At least ${DESCRIPTION_MIN} characters.`}
          >
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              placeholder="e.g. I ordered a black iPhone 13 but received a blue iPhone 11."
              placeholderTextColor="#999"
              multiline
              maxLength={DESCRIPTION_MAX}
              value={description}
              onChangeText={setDescription}
            />
            <Text style={styles.charCount}>
              {description.trim().length} / {DESCRIPTION_MAX}
            </Text>
          </Section>

          
          <Section
            title="Add photos"
            subtitle="Clear photos of the item and packaging help us review faster."
          >
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.evidenceRow}
            >
              {evidence.map((item) => (
                <View key={item.id} style={styles.evidenceTile}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.evidenceImage}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => removeEvidence(item.id)}
                    style={styles.evidenceRemove}
                    hitSlop={8}
                  >
                    <Text style={styles.evidenceRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
              {evidence.length < MAX_EVIDENCE ? (
                <Pressable
                  onPress={addEvidence}
                  disabled={evidenceUploading}
                  style={({ pressed }) => [
                    styles.evidenceAdd,
                    pressed && !evidenceUploading && styles.evidenceAddPressed,
                    evidenceUploading && styles.evidenceAddDisabled,
                  ]}
                >
                  {evidenceUploading ? (
                    <ActivityIndicator color={PRIMARY} />
                  ) : (
                    <>
                      <Text style={styles.evidenceAddPlus}>+</Text>
                      <Text style={styles.evidenceAddLabel}>Add photo</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </ScrollView>
            <Text style={styles.hint}>
              {evidenceUploading
                ? 'Uploading photos…'
                : `${evidence.length} / ${MAX_EVIDENCE} photos`}
            </Text>
          </Section>
          <Section title="What resolution do you want?">
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownContainer}
              placeholderStyle={styles.placeholderStyle}
              selectedTextStyle={styles.selectedTextStyle}
              itemTextStyle={styles.itemTextStyle}
              data={RESOLUTIONS}
              labelField="label"
              valueField="value"
              placeholder="Select resolution"
              value={resolution}
              onChange={(item) => setResolution(item.value)}
            />
          </Section>
          <Section title="Confirmation">
            <ConfirmCheckbox
              checked={confirmedAccurate}
              onToggle={setConfirmedAccurate}
              label="I confirm that the information and evidence provided are accurate. I understand that false disputes may lead to account restrictions."
            />
          </Section>
        </ScrollView>
        <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            disabled={submitting || evidenceUploading}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnSecondaryPressed,
            ]}
          >
            <Text style={styles.btnSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={e => {
              Alert.alert(
                'Confirm Dispute',
                'Are you sure you want to Dispute the selected Orders',
                [
                  {
                    text: 'Confirm',
                    onPress: submit,
                    style: "destructive"
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                ]
              );
            }}
            disabled={submitting || evidenceUploading}
            style={({ pressed }) => [
              styles.btnPrimary,
              pressed && styles.btnPrimaryPressed,
              (submitting || evidenceUploading) && styles.btnDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Submit dispute</Text>
            )}
          </Pressable>
        </View>
      </View>
      <Modal
        visible={disputeOpenItems}
        animationType="slide"
        transparent
        onRequestClose={closeItemPicker}
      >
        <View style={styles.orderModalRoot}>
          <Pressable
            style={styles.orderModalBackdrop}
            onPress={closeItemPicker}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={[styles.orderModalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.orderModalGrabberWrap}>
              <View style={styles.orderModalGrabber} />
            </View>
            <Text style={styles.orderModalTitle}>Select items</Text>
            <Text style={styles.orderModalSubtitle}>
              Choose the item(s) you want to dispute
            </Text>
            <ScrollView
              style={styles.orderModalScroll}
              contentContainerStyle={styles.orderModalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.orderModalCard}>
                <OrderLinesList
                  lines={orderItemLines}
                  styles={styles}
                  selectable
                  selectedKeys={draftItemKeys}
                  onToggle={toggleDraftItemKey}
                />
              </View>
              {draftOrderLines.length > 0 ? (
                <View style={styles.orderModalTotals}>
                  <View style={[styles.orderModalTotalRow, styles.orderModalTotalRowGrand]}>
                    <Text style={styles.orderModalGrandLabel}>
                      {draftOrderLines.length} item{draftOrderLines.length === 1 ? '' : 's'} selected
                    </Text>
                    <Text style={styles.orderModalGrandValue}>{formatNaira(draftSubtotal)}</Text>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <Pressable
              onPress={confirmItemSelection}
              style={({ pressed }) => [
                styles.orderModalContinueBtn,
                pressed && styles.btnPrimaryPressed,
                draftItemKeys.length === 0 && styles.payBtnDisabled,
              ]}
            >
              <Text style={styles.orderModalContinueBtnText}>Done</Text>
            </Pressable>
            <Pressable onPress={closeItemPicker} style={styles.orderModalCloseLink}>
              <Text style={styles.orderModalCloseLinkText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  centered: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#F4F5F7',
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  centeredSub: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 24,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E6',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 14,
    color: '#555',
    lineHeight: 21,
  },
  heroWarning: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#C62828',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E2E6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 12,
  },
  dropdown: {
    minHeight: 52,
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 14,
    backgroundColor: '#FAFAFA',
  },
  dropdownContainer: {
    borderRadius: 5,
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  placeholderStyle: {
    fontSize: 14,
    color: '#999',
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  itemTextStyle: {
    fontSize: 14,
    color: '#111',
  },
  textInput: {
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111',
    backgroundColor: '#FAFAFA',
  },
  textInputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    marginTop: 6,
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
  },
  evidenceRow: {
    gap: 10,
    paddingVertical: 8,
  },
  evidenceTile: {
    width: 96,
    position: 'relative',
  },
  evidenceImage: {
    width: 96,
    height: 96,
    borderRadius: 5,
    backgroundColor: '#EEE',
  },
  evidenceRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceRemoveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  evidenceAdd: {
    width: 96,
    height: 96,
    borderRadius: 5,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CCC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  evidenceAddPressed: {
    backgroundColor: '#F0F0F0',
  },
  evidenceAddDisabled: {
    opacity: 0.6,
  },
  evidenceAddPlus: {
    fontSize: 28,
    color: '#888',
    lineHeight: 30,
  },
  evidenceAddLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  checkboxRowPressed: {
    opacity: 0.8,
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
    marginTop: 2,
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
    color: '#111',
    lineHeight: 21,
  },
  itemPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPickerBody: {
    flex: 1,
    minWidth: 0,
  },
  itemPickerRowPressed: {
    opacity: 0.85,
  },
  itemPickerPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  itemPickerChevron: {
    marginLeft: 8,
  },
  itemSelectRowPressed: {
    opacity: 0.85,
  },
  itemSelectCheck: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemSelectCheckOn: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  itemSelectCheckMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  orderLine: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  orderLineLast: {
    borderBottomWidth: 0,
  },
  orderThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
  },
  orderThumbPh: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  orderLineBody: { flex: 1, marginLeft: 12, marginRight: 8, minWidth: 0 },
  orderTitle: { fontSize: 15, fontWeight: '600', color: '#111' },
  orderMeta: { fontSize: 13, color: MUTED, marginTop: 4 },
  orderLineTotal: { fontSize: 15, fontWeight: '700', color: '#111' },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E2E6',
  },
  btnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D8A4A',
  },
  btnPrimaryPressed: {
    backgroundColor: '#0A6B3A',
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  btnSecondary: {
    height: 48,
    paddingHorizontal: 16,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  orderModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  orderModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  orderModalSheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
  },
  orderModalGrabberWrap: { alignItems: 'center', marginBottom: 8 },
  orderModalGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  orderModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  orderModalSubtitle: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 12,
  },
  orderModalScroll: {
    maxHeight: 360,
  },
  orderModalScrollContent: {
    paddingBottom: 8,
  },
  orderModalCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  orderModalTotals: {
    marginBottom: 8,
  },
  orderModalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderModalTotalRowGrand: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  orderModalTotalLabel: {
    fontSize: 15,
    color: '#444',
  },
  orderModalTotalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  orderModalGrandLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
  },
  orderModalGrandValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  orderModalContinueBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 6,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  orderModalContinueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  orderModalCloseLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderModalCloseLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: MUTED,
  },
});
