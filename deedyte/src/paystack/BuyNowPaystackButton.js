import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { usePaystack } from 'react-native-paystack-webview';
import { formatNaira } from '../utils/formatNaira';

const styles = StyleSheet.create({
  buyNow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 10,
    marginBottom: 28,
  },
  buyNowText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  buyNowIcon: {
    marginLeft: 10,
  },
});

/**
 * @typedef {{
 *   firstInventoryId?: number;
 *   unitPrice?: number;
 *   variantSummary?: string;
 *   variantSku?: string;
 *   variantCurrency?: string;
 * }} CheckoutOverrides
 */

function buildCustomFields({
  title,
  qty,
  inventoryId,
  productId,
  variantSummary,
  variantSku,
  unitPriceLabel,
  variantCurrency,
}) {
  /** @type {{ display_name: string; variable_name: string; value: string }[]} */
  const fields = [
    { display_name: 'Product', variable_name: 'product_title', value: String(title).slice(0, 120) },
    { display_name: 'Quantity', variable_name: 'quantity', value: String(qty) },
    { display_name: 'Inventory ID', variable_name: 'inventory_id', value: String(inventoryId) },
  ];
  if (variantSummary && String(variantSummary).trim()) {
    fields.push({
      display_name: 'Variant',
      variable_name: 'variant_summary',
      value: String(variantSummary).trim().slice(0, 200),
    });
  }
  if (variantSku && String(variantSku).trim()) {
    fields.push({
      display_name: 'SKU',
      variable_name: 'sku',
      value: String(variantSku).trim().slice(0, 80),
    });
  }
  if (unitPriceLabel && String(unitPriceLabel).trim()) {
    fields.push({
      display_name: 'Unit price',
      variable_name: 'unit_price',
      value: String(unitPriceLabel).trim().slice(0, 40),
    });
  }
  if (variantCurrency && String(variantCurrency).trim()) {
    fields.push({
      display_name: 'Currency',
      variable_name: 'currency',
      value: String(variantCurrency).trim().slice(0, 8),
    });
  }
  if (productId != null && String(productId).trim() !== '') {
    fields.push({
      display_name: 'Product ID',
      variable_name: 'product_id',
      value: String(productId).trim(),
    });
  }
  return fields;
}

const BuyNowPaystackButton = forwardRef(function BuyNowPaystackButton(
  {
    navigation,
    loggedIn,
    signOut,
    userEmail,
    firstInventoryId,
    qty,
    unitPrice,
    title,
    productId,
    /** When false, variant is out of stock — button is disabled and taps show a message. */
    canCheckout = true,
    /** When checkout is blocked, optional override for the alert body (e.g. detail API error). */
    checkoutBlockedMessage = '',
    /**
     * When true, tapping Buy now only opens the variant sheet (via onRequestVariantSheet).
     * After the customer picks a variant, parent calls ref.startCheckout(overrides).
     */
    requireVariantSheet = false,
    onRequestVariantSheet,
    /** Merged into Paystack metadata when `startCheckout` is called without overrides (e.g. variant label). */
    variantSummary: variantSummaryProp = '',
    variantSku: variantSkuProp = '',
    variantCurrency: variantCurrencyProp = '',
  },
  ref,
) {
  const { popup } = usePaystack();

  const startCheckout = useCallback(
    (overrides = /** @type {CheckoutOverrides} */ ({})) => {
      if (!loggedIn) {
        Alert.alert('Sign in required', 'Please sign in to complete payment.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign in', onPress: () => void signOut() },
        ]);
        return;
      }
      const invId = overrides.firstInventoryId ?? firstInventoryId;
      const price = overrides.unitPrice != null ? Number(overrides.unitPrice) : Number(unitPrice);
      const variantSummary = overrides.variantSummary ?? variantSummaryProp;
      const variantSku = overrides.variantSku ?? variantSkuProp;
      const variantCurrency = overrides.variantCurrency ?? variantCurrencyProp;

      if (invId == null) {
        Alert.alert('Unavailable', 'This product has no purchasable variant yet.');
        return;
      }
      const email = String(userEmail ?? '').trim();
      if (!email) {
        Alert.alert('Email required', 'Add an email to your account in Profile before paying with Paystack.');
        return;
      }
      const total = Math.max(1, Math.round(Number(price) * qty));
      const reference = `deedyte_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const unitPriceLabel = formatNaira(Number(price));

      popup.checkout({
        email,
        amount: total,
        reference,
        metadata: {
          custom_fields: buildCustomFields({
            title,
            qty,
            inventoryId: invId,
            productId,
            variantSummary,
            variantSku,
            unitPriceLabel,
            variantCurrency,
          }),
        },
        onSuccess: (res) => {
          const refStr =
            res && typeof res === 'object' && 'reference' in res
              ? String(/** @type {{ reference?: string }} */ (res).reference)
              : reference;
          Alert.alert(
            'Payment successful',
            `Reference: ${refStr}\n\nYour payment was completed. Order updates can be added when the server verifies this charge.`,
            [
              { text: 'OK', style: 'default' },
              { text: 'View cart', onPress: () => navigation.navigate('cart') },
            ],
          );
        },
        onCancel: () => {},
        onError: (err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String(/** @type {{ message?: string }} */ (err).message)
              : String(err || 'Something went wrong');
          Alert.alert('Payment error', msg);
        },
      });
    },
    [
      loggedIn,
      signOut,
      firstInventoryId,
      userEmail,
      unitPrice,
      qty,
      title,
      productId,
      popup,
      navigation,
      variantSummaryProp,
      variantSkuProp,
      variantCurrencyProp,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      /** @param {CheckoutOverrides} [overrides] */
      startCheckout: (overrides) => {
        startCheckout(overrides ?? {});
      },
    }),
    [startCheckout],
  );

  const onBuy = useCallback(() => {
    /** Open variant sheet before login / Paystack so the tap never goes straight to checkout. */
    if (requireVariantSheet) {
      onRequestVariantSheet?.();
      return;
    }
    if (!canCheckout) {
      const custom = String(checkoutBlockedMessage ?? '').trim();
      Alert.alert(
        'Almost there',
        custom ||
          'This item is not ready for checkout. If you see Options above, pick an in-stock combination. If not, it may be out of stock.',
      );
      return;
    }
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Please sign in to complete payment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => void signOut() },
      ]);
      return;
    }
    startCheckout();
  }, [canCheckout, checkoutBlockedMessage, loggedIn, signOut, requireVariantSheet, onRequestVariantSheet, startCheckout]);

  return (
    <TouchableOpacity
      style={styles.buyNow}
      activeOpacity={0.88}
      onPress={onBuy}
    >
      <Text style={styles.buyNowText}>Buy now</Text>
      <Icon name="card-outline" size={22} color="#000000" style={styles.buyNowIcon} />
    </TouchableOpacity>
  );
});

export default BuyNowPaystackButton;
