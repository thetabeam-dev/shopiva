import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { getStorefrontProduct } from '../api/storefront';
import { ProductCardMedia } from './ProductCardMedia';
import { getProductImageUri } from '../utils/productImageUtils';
import { normalizeStorefrontProductDetail } from '../utils/storefrontProductNormalize';
import { formatNaira } from '../utils/formatNaira';
import { DELIVERY_TIMEFRAME_OPTIONS, deliveryTimeLabel } from '../utils/deliveryTime';

const BRAND = '#00926E';
const BLACK = '#111111';
const MUTED = '#667781';
const CARD_RADIUS = 7;


/**
 * @param {{
 *   visible: boolean;
 *   sending?: boolean;
 *   destination?: string;
 *   itemAmount?: number;
 *   itemTitle?: string;
 *   itemImage?: string;
 *   productId?: number;
 *   quantity?: number;
 *   onCancel: () => void;
 *   onSubmit: (payload: {
 *     amount: number;
 *     shipping: number;
 *     deliveryTime: string;
 *     destination: string;
 *     productId?: number;
 *     itemTitle?: string;
 *     itemImage?: string;
 *   }) => void | Promise<void>;
 * }} props
 */
export default function ChatInvoiceModal({
  visible,
  sending = false,
  destination = '',
  itemAmount = 0,
  itemTitle = '',
  itemImage = '',
  productId = 0,
  quantity = 1,
  onCancel,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [shipping, setShipping] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [productSnap, setProductSnap] = useState(
    /** @type {{ title: string; image: string; price: number; productId: number }} */ ({
      title: String(itemTitle ?? '').trim(),
      image: String(itemImage ?? '').trim(),
      price: Number(itemAmount) || 0,
      productId: Number(productId) || 0,
    }),
  );
  const dest = String(destination ?? '').trim();

  useEffect(() => {
    if (!visible) return;
    setShipping('');
    setDeliveryTime('');
    const fallback = {
      title: String(itemTitle ?? '').trim(),
      image: String(itemImage ?? '').trim(),
      price: Number(itemAmount) || 0,
      productId: Number(productId) || 0,
    };
    setProductSnap(fallback);
    setAmount(fallback.price > 0 ? String(fallback.price) : '');
    const pid = fallback.productId;
    if (!(pid > 0)) return undefined;
    let cancelled = false;
    void getStorefrontProduct(pid)
      .then((data) => {
        const detail = normalizeStorefrontProductDetail(data);
        if (!detail || cancelled) return;
        const price = Number(detail.price) || fallback.price;
        const title = String(detail.name ?? fallback.title).trim() || fallback.title;
        const image = String(getProductImageUri(detail) ?? fallback.image).trim();
        const next = { title, image, price, productId: pid };
        setProductSnap(next);
        if (price > 0) setAmount(String(price));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, itemAmount, itemTitle, itemImage, productId]);

  const submit = () => {
    if (sending) return;
    const nextAmount = Number(String(amount).replace(/,/g, '').trim());
    const nextShipping = Number(String(shipping).replace(/,/g, '').trim());
    const nextDelivery = String(deliveryTime).trim();
    if (!(nextAmount > 0)) {
      Alert.alert('Price unavailable', 'This product has no price yet. Set a price on the product first.');
      return;
    }
    if (!Number.isFinite(nextShipping) || nextShipping < 0 || !String(shipping).trim()) {
      Alert.alert('Shipping required', 'Enter the shipping fee.');
      return;
    }
    if (!nextDelivery) {
      Alert.alert('Delivery time required', 'Select how long delivery will take.');
      return;
    }
    void onSubmit({
      amount: nextAmount,
      shipping: nextShipping,
      deliveryTime: deliveryTimeLabel(nextDelivery) || nextDelivery,
      deliveryTimeKey: nextDelivery,
      destination: dest,
      productId: productSnap.productId || undefined,
      itemTitle: productSnap.title || undefined,
      itemImage: productSnap.image || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Checkout invoice</Text>
          <Text style={styles.hint}>
            {dest ? (
              <>
                How much will you charge to ship to{' '}
                <Text style={styles.hintPlace}>“{dest.replace(/,\s*\d{4,}\s*$/, '')}”</Text>?
              </>
            ) : 'Buyer has not shared a shipping address yet.'}
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {productSnap.title || productSnap.image ? (
              <View style={styles.productCard}>
                <ProductCardMedia uri={productSnap.image} style={styles.productThumb} />
                <View style={styles.productCopy}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {productSnap.title || 'Product'}
                  </Text>
                  {productSnap.price > 0 ? (
                    <Text style={styles.productPrice}>
                      {quantity > 1
                        ? `${quantity} × ${formatNaira(productSnap.price)} = ${formatNaira(productSnap.price * quantity)}`
                        : formatNaira(productSnap.price)}
                    </Text>
                  ) : null}
                  {quantity > 1 ? <Text style={styles.productQty}>Buyer wants {quantity} units</Text> : null}
                </View>
              </View>
            ) : null}
            <Text style={styles.label}>Shipping (₦)</Text>
            <TextInput
              style={styles.input}
              value={shipping}
              onChangeText={setShipping}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={MUTED}
            />
            <Text style={styles.label}>Delivery time</Text>
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPlaceholder}
              selectedTextStyle={styles.dropdownSelected}
              itemTextStyle={styles.dropdownItem}
              data={DELIVERY_TIMEFRAME_OPTIONS}
              labelField="label"
              valueField="value"
              placeholder="Select delivery time"
              value={deliveryTime || null}
              maxHeight={260}
              dropdownPosition="top"
              onChange={(item) => setDeliveryTime(String(item?.value ?? ''))}
            />
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={sending}
              style={[styles.sendBtn, sending ? styles.sendBtnDisabled : null]}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: BRAND },
  hint: { marginTop: 6, marginBottom: 8, fontSize: 14, lineHeight: 20, color: BLACK, fontWeight: '600' },
  hintPlace: { fontWeight: '800', color: BRAND },
  body: { paddingBottom: 8 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F8F6',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    padding: 8,
    marginBottom: 8,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#E8EEEB',
  },
  productCopy: { flex: 1, minWidth: 0 },
  productTitle: { fontSize: 15, fontWeight: '700', color: BLACK },
  productPrice: { marginTop: 4, fontSize: 14, fontWeight: '700', color: BRAND },
  productQty: { marginTop: 2, fontSize: 12, fontWeight: '600', color: MUTED },
  label: { marginTop: 8, marginBottom: 6, fontSize: 12, fontWeight: '700', color: BRAND },
  input: {
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    backgroundColor: '#F3F8F6',
    paddingHorizontal: 12,
    fontSize: 15,
    color: BLACK,
  },
  dropdown: {
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    backgroundColor: '#F3F8F6',
    paddingHorizontal: 12,
  },
  dropdownList: {
    borderRadius: CARD_RADIUS,
    borderColor: '#D7E8E2',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: MUTED,
  },
  dropdownSelected: {
    fontSize: 15,
    color: BLACK,
  },
  dropdownItem: {
    fontSize: 15,
    color: BLACK,
  },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: BRAND },
  sendBtn: {
    flex: 1,
    height: 44,
    borderRadius: CARD_RADIUS,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  sendBtnDisabled: { opacity: 0.88 },
});
