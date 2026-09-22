import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePaystack } from 'react-native-paystack-webview';
import { useProfile } from '../../context/ProfileContext';
import { fetchBuyerCart } from '../../api/buyer';
import { canUsePaystackCheckout } from '../../paystack/paystackNativeGate';
import { formatNaira } from '../../utils/formatNaira';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../../utils/deviceLocation';

const PRIMARY = '#00926e';
const PAGE_BG = '#F2F2F3';
const CARD_BG = '#FFFFFF';
const BORDER = '#E0E0E0';
const MUTED = '#757575';
const ERROR = '#C62828';
const ERROR_BG = '#FFEBEE';
const EXPRESS_SHIPPING = 1000;

/**
 * @param {string} email
 */
function isValidEmail(email) {
  const t = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * @param {string} phone
 */
function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
}

/**
 * @param {string} street
 */
function isValidStreet(street) {
  return street.trim().length >= 5;
}

/**
 * @param {unknown} row
 * @param {number} index
 */
function normalizeCheckoutLine(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const keyRaw = r.key ?? r.id;
  const key = (typeof keyRaw === 'string' || typeof keyRaw === 'number' ? String(keyRaw) : '').trim() || `line-${index}`;
  const title = String(r.title ?? 'Item').trim() || 'Item';
  const unitPrice = Number(r.unitPrice) || 0;
  const qty = Math.max(1, Math.min(99, Number(r.qty) || 1));
  const image = typeof r.image === 'string' ? r.image.trim() : '';
  const cartItemId = Number(r.cartItemId);
  const inventoryId = Number(r.inventoryId ?? r.inventory_id);
  const productIdRaw = r.productId ?? r.product_id;
  const productId = Number(productIdRaw);
  const shop_id = r.shop_id
  const variantFromLabel = typeof r.variantLabel === 'string' ? r.variantLabel.trim() : '';
  const variantFromSku = r.sku != null && String(r.sku).trim() ? String(r.sku).trim() : '';
  const variantLabel = variantFromLabel || variantFromSku;
  return {
    key,
    title,
    image,
    unitPrice,
    qty,
    shop_id,
    variantLabel,
    cartItemId: Number.isFinite(cartItemId) && cartItemId > 0 ? cartItemId : undefined,
    inventoryId: Number.isFinite(inventoryId) && inventoryId > 0 ? inventoryId : undefined,
    productId: Number.isFinite(productId) && productId > 0 ? productId : undefined,
  };
}

/** @param {{ lines: Array<{ key: string; title: string; image: string; unitPrice: number; qty: number; variantLabel: string }>; styles: object }} p */
function OrderLinesList({ lines, styles: S }) {
  return (
    <>
      {lines.map((line, idx) => {
        const lineTotal = line.unitPrice * line.qty;
        const last = idx === lines.length - 1;
        return (
          <View key={line.key} style={[S.orderLine, last ? S.orderLineLast : null]}>
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
              {line.variantLabel ? (
                <Text style={S.orderVariant} numberOfLines={1}>
                  {line.variantLabel}
                </Text>
              ) : null}
              <Text style={S.orderMeta}>
                {formatNaira(line.unitPrice)} × {line.qty}
              </Text>
            </View>
            <Text style={S.orderLineTotal}>{formatNaira(lineTotal)}</Text>
          </View>
        );
      })}
    </>
  );
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function CartCheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const route = useRoute();
  const { popup } = usePaystack();

  const [cartLoading, setCartLoading] = useState(true);
  const [checkoutLines, setCheckoutLines] = useState(
    /** @type {Array<{ key: string; title: string; image: string; unitPrice: number; qty: number; variantLabel: string; cartItemId?: number; inventoryId?: number; productId?: number }>} */ ([]),
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [delivery, setDelivery] = useState(('standard'));
  const [isLocating, setIsLocating] = useState(false);

  const [touchedSubmit, setTouchedSubmit] = useState(false);
  const [formBanner, setFormBanner] = useState('');
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [bottomToast, setBottomToast] = useState('');
  const toastTimerRef = useRef((null));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const rawNav = route.params?.checkoutLines;
      const hasNavLines = Array.isArray(rawNav) && rawNav.length > 0;

      if (hasNavLines) {
        setCartLoading(true);
        const normalized = rawNav
          .map((row, i) => normalizeCheckoutLine(row, i))
          .filter((x) => x != null);
        if (!cancelled) {

          setCheckoutLines(/** @type {typeof checkoutLines} */ (normalized));
          setCartLoading(false);
        }
        return () => {
          cancelled = true;
        };
      }

      (async () => {
        setCartLoading(true);
        try {
          const { lines: raw } = await fetchBuyerCart();
          if (cancelled) return;
          const lines = Array.isArray(raw) ? raw : [];
          const mapped = lines
            .map((l, i) => {
              const row = l && typeof l === 'object' ? /** @type {Record<string, unknown>} */ (l) : {};
              return normalizeCheckoutLine(
                {
                  key: String(row.id ?? ''),
                  cartItemId: row.cartItemId,
                  title: row.title,
                  image: row.image,
                  unitPrice: row.unitPrice,
                  qty: row.qty,
                  sku: row.sku,
                  inventoryId: row.inventoryId ?? row.inventory_id,
                  productId: row.productId ?? row.product_id,
                },
                i,
              );
            })
            .filter((x) => x != null);
          if (!cancelled) setCheckoutLines(/** @type {typeof checkoutLines} */ (mapped));
        } catch {
          if (!cancelled) setCheckoutLines([]);
        } finally {
          if (!cancelled) setCartLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [route.params]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setFullName((prev) => (prev.trim() ? prev : user.displayName || ''));
      setEmail((prev) => (prev.trim() ? prev : user.email || ''));
      setPhone((prev) => (prev.trim() ? prev : user.phone || ''));
      setCity((prev) => (prev.trim() ? prev : user.locationObj?.city || ''));
    }, [user]),
  );

  const subtotal = useMemo(
    () => checkoutLines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    [checkoutLines],
  );

  const shippingCost = delivery === 'express' ? EXPRESS_SHIPPING : 0;
  const shippingLabel = delivery === 'express' ? formatNaira(EXPRESS_SHIPPING) : 'Free';
  const escrowCharge = 200;
  const total = Math.max(0, subtotal + shippingCost + escrowCharge);

  const errors = useMemo(() => {
    const e = /** @type {Record<string, string>} */ ({});
    if (!fullName.trim()) e.fullName = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!isValidEmail(email)) e.email = 'Enter a valid email address.';
    if (!phone.trim()) e.phone = 'Phone number is required.';
    else if (!isValidPhone(phone)) e.phone = 'Enter a valid phone number.';
    if (!street.trim()) e.street = 'Street address is required.';
    else if (!isValidStreet(street)) e.street = 'Enter a complete street address.';
    if (!city.trim()) e.city = 'Enter your city.';
    // if (!zip.trim()) e.zip = 'Enter a ZIP or postal code.';
    return e;
  }, [fullName, email, phone, street, city]);

  const showErrors = touchedSubmit;
  const hasBlockingErrors = Object.keys(errors).length > 0;
  const hasEmptyRequiredFields = useMemo(
    () => !fullName.trim() || !email.trim() || !phone.trim() || !street.trim(),
    [fullName, email, phone, street, city],
  );

  const showBottomToast = useCallback((message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setBottomToast(message);
    toastTimerRef.current = setTimeout(() => {
      setBottomToast('');
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  const onUseCurrentLocation = useCallback(async () => {
    if (isLocating) return;
    setIsLocating(true);
    setFormBanner('');
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setFormBanner('Location permission was denied. You can still enter your address manually.');
        return;
      }

      const { latitude, longitude } = await getCurrentCoordinates();
      const place = await reverseGeocodeToPlace(latitude, longitude);
      const nextStreet = String(place?.street ?? '').trim();
      const nextCity = String(place?.city ?? place?.town ?? '').trim();
      const nextZip = String(place?.zip ?? '').trim();
      const nextCountry = String(place?.country ?? '').trim();

      if (nextStreet) setStreet(nextStreet);
      if (nextCity) setCity(nextCity);
      if (nextZip) setZip(nextZip);
      if (nextCountry) setCountry(nextCountry);

      if (!nextStreet && !nextCity && !nextZip && !nextCountry) {
        setFormBanner('We found your location, but could not extract an address. Please fill it in manually.');
        return;
      }

      showBottomToast('Address autofilled from your current location.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not access your location.';
      setFormBanner(msg || 'Could not access your location.');
    } finally {
      setIsLocating(false);
    }
  }, [isLocating, showBottomToast]);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const onPaystackCheckout = useCallback(() => {
    if (isPaying) return;
    setTouchedSubmit(true);
    setFormBanner('');
    if (subtotal <= 0) {
      setFormBanner('Your cart is empty. Add items before paying.');
      return;
    }
    if (hasBlockingErrors) {
      setFormBanner('Please complete all fields correctly before paying.');
      return;
    }
    if (!canUsePaystackCheckout()) {
      Alert.alert(
        'Paystack unavailable',
        'Paystack checkout is not available in this build. Rebuild the app after linking react-native-webview, then try again.',
      );
      return;
    }
    if (checkoutLines.some((l) => !l.inventoryId)) {
      setFormBanner('Each cart line needs a product variant (inventory). Refresh your cart and try again.');
      return;
    }
    const customerEmail = email.trim();
    if (!customerEmail) {
      setFormBanner('A valid email is required for Paystack checkout.');
      return;
    }
    /** Paystack `amount` for NGN is in kobo (smallest unit). */
    const amountKobo = Math.max(100, Math.round(Number(total) * 100));
    const reference = `deedyte_cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const firstLine = checkoutLines[0];

    const shippingSummary = `${street.trim()}, ${city.trim()}, ${zip.trim()}, ${country}`;
    const uid = Number(user?.id);
    if (!Number.isFinite(uid) || uid <= 0) {
      setFormBanner('You must be signed in to pay.');
      return;
    }

    /**
     * Must match server `parseAndValidateOrderMetadata` (used by Paystack webhook after verify).
     * Each line: `{ inventory_id, quantity, productId?, variant? }` — inventory_id is required for cart SKUs;
     * productId is optional cross-check for `webhookOrderFromPaystack`.
     */
    const paystackItems = checkoutLines.map((line) => {
      /** @type {Record<string, unknown>} */
      const item = {
        inventory_id: line.inventoryId,
        quantity: line.qty,
      };
      if (line.productId != null) item.productId = line.productId;
      if (line.variantLabel) item.variant = line.variantLabel;
      return item;
    });

    const shippingAddress = {
      fullName: fullName.trim(),
      email: customerEmail,
      phone: phone.trim(),
      street: street.trim(),
      city: city.trim(),
      zip: zip.trim(),
      country,
      delivery,
      summary: shippingSummary,
    };

    // Group items by shop_id to create orders array
    const ordersByShop = checkoutLines.reduce((acc, line) => {
      // Use shop_id from checkoutLines or default to a generic shop
      const shopId = line.shop_id || 'default-shop';
      console.log(line);
      
      if (!acc[shopId]) {
        acc[shopId] = [];
      }
      
      acc[shopId].push({
        item_id: String(line.productId),
        unit: line.qty,
        unit_price: line.unitPrice,
        total: line.unitPrice * line.qty,
        cart_id: line.cartItemId
      });
      
      return acc;
    }, {});

    // Build orders array with proper structure
    const ordersArray = Object.entries(ordersByShop).map(([shopId, items]) => {
      const orderSubtotal = items.reduce((sum, item) => sum + item.total, 0);
      
      return {
        shop_id: shopId,
        shipping_fee: shippingCost,
        shipping_method: delivery,
        subtotal: orderSubtotal,
        items,
      };
    });

    console.log("ordersArray: ", ordersArray);

    const pricingBreakdown = {
      currency: 'NGN',
      totalNaira: total,
      totalKobo: amountKobo,
      subtotalNaira: subtotal,
      shippingNaira: shippingCost,
    };

    setIsPaying(true);
    setFormBanner('');
    popup.checkout({
      email: customerEmail,
      amount: amountKobo/100,
      reference,
      metadata: {
        customer_id: String(uid),
        shipping_address: street.trim(),
        tax: 0,
        orders: ordersArray
      },
      onSuccess: (res) => {
        setIsPaying(false);
        setOrderSummaryOpen(false);
        const refStr =
          res && typeof res === 'object' && 'reference' in res
            ? String(/** @type {{ reference?: string }} */ (res).reference)
            : reference;
            console.log("reference", reference)
        navigation.replace('Payment-success', {
          reference: refStr,
          subtotal,
          shipping: shippingCost,
          total: total,
          itemCount: checkoutLines.length,
        });
      },
      onCancel: () => {
        setIsPaying(false);
        setOrderSummaryOpen(false);
        navigation.replace('Payment-failed', {
          reason: 'Payment was cancelled before completion.',
          subtotal,
          shipping: shippingCost,
          total,
        });
      },
      onError: (err) => {
        setIsPaying(false);
        setOrderSummaryOpen(false);
        const msg =
          err && typeof err === 'object' && 'message' in err
            ? String(/** @type {{ message?: string }} */ (err).message)
            : String(err || 'Something went wrong');
        navigation.replace('payment-failed', {
          reason: msg,
          subtotal,
          shipping: shippingCost,
          total,
        });
      },
    });
  }, [
    isPaying,
    hasBlockingErrors,
    subtotal,
    email,
    total,
    checkoutLines,
    delivery,
    shippingCost,
    street,
    city,
    zip,
    country,
    fullName,
    phone,
    user?.id,
    popup,
    navigation,
  ]);

  const onContinue = useCallback(() => {
    setTouchedSubmit(true);
    setFormBanner('');
    if (subtotal <= 0) {
      setFormBanner('Your cart is empty. Add items before paying.');
      return;
    }
    if (hasEmptyRequiredFields) {
      showBottomToast('Please fill in all required fields.');
      return;
    }
    if (hasBlockingErrors) {
      setFormBanner('Please complete all fields correctly before continuing.');
      return;
    }
    setOrderSummaryOpen(true);
  }, [subtotal, hasEmptyRequiredFields, hasBlockingErrors, showBottomToast]);

  const continueToPayment = useCallback(() => {
    setOrderSummaryOpen(false);
    onPaystackCheckout();
  }, [onPaystackCheckout]);

  const inputStyle = (key) => [
    styles.input,
    showErrors && errors[key] ? styles.inputError : null,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={[styles.root, { paddingTop: 5 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={CARD_BG} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollInner, { paddingBottom: 150 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {cartLoading ? (
            <Text style={styles.loadingText}>Loading your order…</Text>
          ) : subtotal <= 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing to check out</Text>
              <Text style={styles.emptyBody}>Your cart is empty. Go back and add products first.</Text>
              <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('cart')}>
                <Text style={styles.primaryBtnText}>Return to cart</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Contact information</Text>
                {formBanner ? (
                  <View style={styles.formBanner}>
                    <Text style={styles.formBannerText}>{formBanner}</Text>
                  </View>
                ) : null}

                <Text style={styles.label}>Full name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor="#AAA"
                  style={inputStyle('fullName')}
                  autoCapitalize="words"
                  accessibilityLabel="Full name"
                />
                {showErrors && errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor="#AAA"
                  style={inputStyle('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Email"
                />
                {showErrors && errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone"
                  placeholderTextColor="#AAA"
                  style={inputStyle('phone')}
                  keyboardType="phone-pad"
                  accessibilityLabel="Phone"
                />
                {showErrors && errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>Shipping address</Text>
                  <Pressable
                    onPress={onUseCurrentLocation}
                    disabled={isLocating}
                    style={[styles.locationBtn, isLocating ? styles.locationBtnDisabled : null]}
                    accessibilityRole="button"
                    accessibilityLabel="Use current location"
                  >
                    <Icon name="locate-outline" size={14} color={PRIMARY} />
                    <Text style={styles.locationBtnText}>{isLocating ? 'Locating…' : 'Use current location'}</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Street address</Text>
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="123 Main Street"
                  placeholderTextColor="#AAA"
                  style={inputStyle('street')}
                  accessibilityLabel="Street address"
                />
                {showErrors && errors.street ? <Text style={styles.errorText}>{errors.street}</Text> : null}

                <Text style={styles.label}>City</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  placeholderTextColor="#AAA"
                  style={inputStyle('city')}
                  accessibilityLabel="City"
                />
                {showErrors && errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}

                <Text style={styles.label}>ZIP / Postal code (optional)</Text>
                <TextInput
                  value={zip}
                  onChangeText={setZip}
                  placeholder="101241"
                  placeholderTextColor="#AAA"
                  style={inputStyle('zip')}
                  keyboardType="default"
                  accessibilityLabel="ZIP or postal code"
                />
                {showErrors && errors.zip ? <Text style={styles.errorText}>{errors.zip}</Text> : null}

                <Text style={styles.label}>Country</Text>
                <View style={styles.countryBox}>
                  <Text style={styles.countryText}>{country}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionHeading}>Delivery options</Text>
                <Pressable
                  onPress={() => setDelivery('standard')}
                  style={[styles.deliveryCard, delivery === 'standard' ? styles.deliveryCardSelected : styles.deliveryCardIdle]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: delivery === 'standard' }}
                >
                  <View style={styles.deliveryTextCol}>
                    <Text style={styles.deliveryTitle}>Standard shipping</Text>
                    <Text style={styles.deliverySub}>Delivered in 5–7 days</Text>
                  </View>
                  <Text style={styles.deliveryPrice}>Free</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDelivery('express')}
                  style={[styles.deliveryCard, delivery === 'express' ? styles.deliveryCardSelected : styles.deliveryCardIdle]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: delivery === 'express' }}
                >
                  <View style={styles.deliveryTextCol}>
                    <Text style={styles.deliveryTitle}>Express shipping</Text>
                    <Text style={styles.deliverySub}>Delivered in 2–3 days</Text>
                  </View>
                  <Text style={styles.deliveryPrice}>{formatNaira(EXPRESS_SHIPPING)}</Text>
                </Pressable>
              </View>

              {/* <Text style={styles.sectionHeading}>Payment method</Text> */}
              {/* <View style={styles.payRow}>
                <Text style={styles.payLabel}>Paystack</Text>
              </View> */}
            </>
          )}
        </ScrollView>

        {subtotal > 0 && !cartLoading ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Shipping</Text>
              <Text style={styles.footerMuted}>{shippingLabel}</Text>
            </View>
            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Escrow charges</Text>
              <Text style={styles.footerMuted}>{formatNaira(escrowCharge)}</Text>
            </View>
            <View style={styles.footerRowTotal}>
              <Text style={styles.totalWord}>Total</Text>
              <Text style={styles.totalAmount}>{formatNaira(total)}</Text>
            </View>
            <Pressable
              style={[styles.continueBtn, isPaying ? styles.payBtnDisabled : null]}
              onPress={onContinue}
              disabled={isPaying}
              accessibilityRole="button"
            >
              <Text style={styles.continueBtnText}>{isPaying ? 'Processing payment…' : 'Continue to payment'}</Text>
            </Pressable>
          </View>
        ) : null}

        <Modal
          visible={orderSummaryOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setOrderSummaryOpen(false)}
        >
          <View style={styles.orderModalRoot}>
            <Pressable style={styles.orderModalBackdrop} onPress={() => setOrderSummaryOpen(false)} accessibilityLabel="Close" />
            <View style={[styles.orderModalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.orderModalGrabberWrap}>
                <View style={styles.orderModalGrabber} />
              </View>
              <Text style={styles.orderModalTitle}>Your order</Text>
              <Text style={styles.orderModalSubtitle}>Review what you are about to pay for</Text>
              <ScrollView
                style={styles.orderModalScroll}
                contentContainerStyle={styles.orderModalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.orderModalCard}>
                  <OrderLinesList lines={checkoutLines} styles={styles} />
                </View>
                <View style={styles.orderModalTotals}>
                  <View style={styles.orderModalTotalRow}>
                    <Text style={styles.orderModalTotalLabel}>Subtotal</Text>
                    <Text style={styles.orderModalTotalValue}>{formatNaira(subtotal)}</Text>
                  </View>
                  <View style={styles.orderModalTotalRow}>
                    <Text style={styles.orderModalTotalLabel}>Shipping</Text>
                    <Text style={styles.orderModalTotalValue}>{shippingLabel}</Text>
                  </View>
                  <View style={styles.orderModalTotalRow}>
                    <Text style={styles.orderModalTotalLabel}>Escrow charges</Text>
                    <Text style={styles.orderModalTotalValue}>{formatNaira(escrowCharge)}</Text>
                  </View>
                  <View style={[styles.orderModalTotalRow, styles.orderModalTotalRowGrand]}>
                    <Text style={styles.orderModalGrandLabel}>Total</Text>
                    <Text style={styles.orderModalGrandValue}>{formatNaira(total)}</Text>
                  </View>
                </View>
              </ScrollView>
              <Pressable
                style={[styles.orderModalContinueBtn, isPaying ? styles.payBtnDisabled : null]}
                onPress={continueToPayment}
                disabled={isPaying}
                accessibilityRole="button"
                accessibilityLabel="Continue to payment"
              >
                <Text style={styles.orderModalContinueBtnText}>{isPaying ? 'Processing payment…' : 'Confirm & Pay'}</Text>
              </Pressable>
              <Pressable
                style={styles.orderModalCloseLink}
                onPress={() => setOrderSummaryOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.orderModalCloseLinkText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        {bottomToast ? (
          <View pointerEvents="none" style={[styles.toastWrap, { bottom: Math.max(insets.bottom, 14) + 84 }]}>
            <View style={styles.toastBox}>
              <Text style={styles.toastText}>{bottomToast}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    backgroundColor: CARD_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollInner: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  loadingText: {
    textAlign: 'center',
    color: MUTED,
    marginTop: 24,
    fontSize: 15,
  },
  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 16 },
  primaryBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 146, 110, 0.35)',
    backgroundColor: 'rgba(0, 146, 110, 0.08)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  locationBtnDisabled: {
    opacity: 0.7,
  },
  locationBtnText: {
    marginLeft: 6,
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '700',
  },
  orderLine: {
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
  orderVariant: { fontSize: 13, color: MUTED, marginTop: 2 },
  orderMeta: { fontSize: 13, color: MUTED, marginTop: 4 },
  orderLineTotal: { fontSize: 15, fontWeight: '700', color: '#111' },
  formBanner: {
    backgroundColor: ERROR_BG,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  formBannerText: {
    color: ERROR,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: '#111',
  },
  inputError: {
    borderColor: ERROR,
    backgroundColor: '#FFF8F8',
  },
  errorText: {
    color: ERROR,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
  },
  countryBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  countryText: { fontSize: 16, color: '#111' },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
    marginTop: 4,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  deliveryCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: 'rgba(0, 146, 110, 0.06)',
  },
  deliveryCardIdle: {
    borderColor: BORDER,
    backgroundColor: CARD_BG,
  },
  deliveryTextCol: { flex: 1, paddingRight: 12 },
  deliveryTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  deliverySub: { fontSize: 13, color: MUTED, marginTop: 4 },
  deliveryPrice: { fontSize: 16, fontWeight: '700', color: '#111' },
  payRow: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  payLabel: { fontSize: 16, fontWeight: '600', color: '#111', textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CARD_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  footerRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  footerMuted: { fontSize: 15, color: '#444' },
  totalWord: { fontSize: 17, fontWeight: '800', color: '#111' },
  totalAmount: { fontSize: 18, fontWeight: '800', color: '#111' },
  continueBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  headerOrderBtnPressed: {
    opacity: 0.75,
  },
  headerOrderBtnDisabled: {
    opacity: 0.45,
  },
  headerOrderBtnLabel: {
    marginLeft: 4,
    fontSize: 15,
    fontWeight: '700',
    color: PRIMARY,
  },
  headerOrderBtnLabelDisabled: {
    color: '#BDBDBD',
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
  toastWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 50,
  },
  toastBox: {
    maxWidth: '100%',
    backgroundColor: 'rgba(17,17,17,0.95)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
