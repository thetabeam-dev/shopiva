import { useEffect, useMemo, useState } from 'react';
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
import ProductVariantCardPicker from './ProductVariantCardPicker';
import { formatNaira } from '../utils/formatNaira';
import { getStorefrontProduct } from '../api/storefront';
import { parseBulkTiers, unitPriceForBulk } from '../utils/bulkPricing';
import { normalizeStorefrontProductDetail } from '../utils/storefrontProductNormalize';
import {
  filterVariantDisplayAttrKeys,
  formatAttributeLabel,
  getVariantRowPrice,
  variantAttributeKeys,
} from '../utils/storefrontProductDetail';

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
 *   productId?: number;
 *   initialVariantId?: number;
 *   onCancel: () => void;
 *   onSubmit: (qty: number, variant: { inventoryId?: number; label: string; price?: number } | null) => void | Promise<void>;
 * }} props
 */
export default function ChatQuantityModal({
  visible,
  sending = false,
  itemTitle = '',
  itemImage = '',
  itemAmount = 0,
  productId = 0,
  initialVariantId = 0,
  onCancel,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();
  const [qtyText, setQtyText] = useState('1');

  const [variants, setVariants] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [productPrice, setProductPrice] = useState(0);
  const [bulkTiers, setBulkTiers] = useState(/** @type {ReturnType<typeof parseBulkTiers>} */ ([]));
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(/** @type {Record<string, unknown> | null} */ (null));

  useEffect(() => {
    if (visible) setQtyText('1');
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    setSelectedVariant(null);
    setVariants([]);
    setProductPrice(0);
    setBulkTiers([]);
    const pid = Number(productId) || 0;
    if (!(pid > 0)) return undefined;
    let cancelled = false;
    setVariantsLoading(true);
    getStorefrontProduct(pid)
      .then((data) => {
        if (cancelled) return;
        const d = normalizeStorefrontProductDetail(data);
        setProductPrice(Number(d?.price) || 0);
        setBulkTiers(parseBulkTiers(d?.bulkDiscount));
        const raw = d?.hasVariants && Array.isArray(d.variants) ? d.variants.filter((v) => v && typeof v === 'object') : [];
        const base = variantAttributeKeys(raw).length
          ? raw
          : raw.map((v, i) => ({ ...v, attributes: { option: `Option ${i + 1}` } }));
        const rows = base.map((v, index) => {
          const attrs = v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
          const attributes = {};
          Object.keys(attrs).forEach((k) => {
            attributes[k] = String(attrs[k] ?? '').trim();
          });
          return { ...v, attributes, optionKey: `${String(v.id ?? 'variant')}-${index}` };
        });
        setVariants(rows);
        const preset = initialVariantId > 0 ? rows.find((v) => Number(v.id) === Number(initialVariantId)) : null;
        if (preset) setSelectedVariant(preset);
        else if (rows.length === 1) setSelectedVariant(rows[0]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, productId, initialVariantId]);

  const attrKeys = useMemo(() => {
    const keys = variantAttributeKeys(variants);
    const filtered = filterVariantDisplayAttrKeys(keys);
    return filtered.length ? filtered : keys;
  }, [variants]);
  const hasVariants = variants.length > 0;
  const variantMissing = hasVariants && !selectedVariant;

  const qty = Math.min(MAX_QTY, Math.max(0, parseInt(qtyText, 10) || 0));
  const setQty = (next) => setQtyText(String(Math.min(MAX_QTY, Math.max(1, next))));
  const variantPrice = selectedVariant ? getVariantRowPrice(selectedVariant) : NaN;
  const basePrice = Number.isFinite(variantPrice) && variantPrice > 0
    ? variantPrice
    : hasVariants
      ? 0
      : productPrice || Number(itemAmount) || 0;
  const price = basePrice > 0 ? unitPriceForBulk(basePrice, bulkTiers, Math.max(1, qty)) : 0;
  const canSubmit = qty > 0 && !sending && !variantsLoading && !variantMissing;

  const submit = () => {
    if (!canSubmit) return;
    let variant = null;
    if (selectedVariant) {
      const a = selectedVariant.attributes && typeof selectedVariant.attributes === 'object' ? selectedVariant.attributes : {};
      const label = attrKeys
        .map((k) => (a[k] ? `${formatAttributeLabel(k)}: ${a[k]}` : ''))
        .filter(Boolean)
        .join(' · ');
      const inventoryId = Number(selectedVariant.id);
      const index = variants.findIndex((v) => v.optionKey === selectedVariant.optionKey);
      const details = attrKeys
        .filter((k) => a[k])
        .map((k) => ({ label: formatAttributeLabel(k), value: String(a[k]) }));
      const sku = String(selectedVariant.sku ?? '').trim();
      if (sku) details.push({ label: 'SKU', value: sku });
      variant = {
        name: index >= 0 && index < 26 ? `Variant ${String.fromCharCode(65 + index)}` : `Variant ${index + 1}`,
        details,
        inventoryId: Number.isFinite(inventoryId) && inventoryId > 0 ? inventoryId : undefined,
        label,
        price: price > 0 ? price : undefined,
      };
    }
    onSubmit(qty, variant);
  };

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
          {variantsLoading ? (
            <ActivityIndicator style={styles.variantLoading} color={BRAND} />
          ) : hasVariants ? (
            <View style={styles.variantBlock}>
              <Text style={styles.variantTitle}>{variants.length === 1 ? 'Features' : 'Select a variant'}</Text>
              <ProductVariantCardPicker
                attrKeys={attrKeys}
                variants={variants}
                selectedVariant={selectedVariant}
                onSelect={setSelectedVariant}
              />
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
              onPress={submit}
              disabled={!canSubmit}
              style={[styles.sendBtn, !canSubmit && styles.sendBtnDisabled]}
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
  variantLoading: { marginTop: 16 },
  variantBlock: { marginTop: 14 },
  variantTitle: { marginBottom: 8, fontSize: 14, fontWeight: '700', color: BLACK },
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
