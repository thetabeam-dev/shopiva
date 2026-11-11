import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCardMedia } from './ProductCardMedia';
import { formatNaira } from '../utils/formatNaira';

const BRAND = '#00926E';
const BLACK = '#111111';
const CARD_RADIUS = 7;
const MAX_QTY = 9999;

/**
 * Asks the buyer how many units they want before an invoice request is sent.
 * @param {{
 *   visible: boolean;
 *   sending?: boolean;
 *   itemTitle?: string;
 *   itemImage?: string;
 *   itemAmount?: number;
 *   onCancel: () => void;
 *   onSubmit: (qty: number) => void | Promise<void>;
 * }} props
 */
export default function ChatQuantityModal({
  visible,
  sending = false,
  itemTitle = '',
  itemImage = '',
  itemAmount = 0,
  onCancel,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [qtyText, setQtyText] = useState('1');

  useEffect(() => {
    if (visible) setQtyText('1');
  }, [visible]);

  const qty = Math.min(MAX_QTY, Math.max(0, parseInt(qtyText, 10) || 0));
  const setQty = (next) => setQtyText(String(Math.min(MAX_QTY, Math.max(1, next))));
  const price = Number(itemAmount) || 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>How many do you need?</Text>
          <Text style={styles.hint}>The vendor uses this to prepare your checkout invoice.</Text>
          {itemTitle || itemImage ? (
            <View style={styles.productCard}>
              <ProductCardMedia uri={itemImage} style={styles.productThumb} />
              <View style={styles.productCopy}>
                <Text style={styles.productTitle} numberOfLines={2}>{itemTitle || 'Product'}</Text>
                {price > 0 ? <Text style={styles.productPrice}>{formatNaira(price)}</Text> : null}
              </View>
            </View>
          ) : null}
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setQty(qty - 1)}
              disabled={qty <= 1}
              style={({ pressed }) => [styles.stepBtn, qty <= 1 && styles.stepBtnDisabled, pressed && styles.pressed]}
              accessibilityLabel="Decrease quantity"
            >
              <Icon name="remove" size={22} color={BRAND} />
            </Pressable>
            <TextInput
              style={styles.qtyInput}
              value={qtyText}
              onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              textAlign="center"
              accessibilityLabel="Quantity"
            />
            <Pressable
              onPress={() => setQty(qty + 1)}
              disabled={qty >= MAX_QTY}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
              accessibilityLabel="Increase quantity"
            >
              <Icon name="add" size={22} color={BRAND} />
            </Pressable>
          </View>
          {price > 0 && qty > 0 ? (
            <Text style={styles.subtotal}>Items subtotal: {formatNaira(price * qty)}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => qty > 0 && !sending && onSubmit(qty)}
              disabled={qty <= 0 || sending}
              style={[styles.sendBtn, (qty <= 0 || sending) && styles.sendBtnDisabled]}
            >
              {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendText}>Request invoice</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
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
  hint: { marginTop: 6, marginBottom: 10, fontSize: 14, lineHeight: 20, color: BLACK },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F8F6',
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    padding: 8,
  },
  productThumb: { width: 56, height: 56, borderRadius: CARD_RADIUS, backgroundColor: '#E8EEEB' },
  productCopy: { flex: 1, minWidth: 0 },
  productTitle: { fontSize: 15, fontWeight: '700', color: BLACK },
  productPrice: { marginTop: 4, fontSize: 14, fontWeight: '700', color: BRAND },
  stepper: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  qtyInput: {
    width: 88,
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: '#D7E8E2',
    backgroundColor: '#F3F8F6',
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
  },
  subtotal: { marginTop: 10, textAlign: 'center', fontSize: 14, fontWeight: '600', color: BLACK },
  actions: { marginTop: 16, flexDirection: 'row', gap: 8 },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
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
  sendBtnDisabled: { opacity: 0.6 },
});
