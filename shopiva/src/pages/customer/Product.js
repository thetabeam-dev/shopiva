import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { ShopOverflowMenu } from '../../components/ShopOverflowMenu';
import ShopPolicyViewerModal from '../../components/ShopPolicyViewerModal';
import ProductVariantCardPicker from '../../components/ProductVariantCardPicker';
import ProductReviewsSection from '../../components/ProductReviewsSection';
import RatingRow from '../../components/RatingRow';
import { getStorefrontProduct } from '../../api/storefront';
import {
  formatAttributeLabel,
  isVariantPurchasable,
  resolveVariantSelection,
  variantAttributeKeys,
  filterVariantDisplayAttrKeys,
  getVariantRowPrice,
} from '../../utils/storefrontProductDetail';
import { normalizeStorefrontProductDetail } from '../../utils/storefrontProductNormalize';
import { extractCustomerPolicySections } from '../../utils/shopPoliciesForCustomer';
import {
  addBuyerCartLine,
  deleteBuyerCartLine,
  fetchBuyerCart,
  patchBuyerCartLine,
} from '../../api/buyer';
import { formatNaira } from '../../utils/formatNaira';
import { getProductImageUri } from '../../utils/productImageUtils';

const { width: WINDOW_W } = Dimensions.get('window');
const PURPLE = '#00926e';
const PAD = 16;
const CART_TOAST_MS = 2400;

/**
 * @param {{ route: { params?: { product?: object; vendor?: { id: number; name?: string; slug?: string }; category?: string } }; navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function ProductScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, signOut } = useAuth();
  const loggedIn = isAuthenticated;
  const vendor = route.params?.vendor;
  const category = vendor ?? 'fashion';
  const routeProduct = route.params?.product;
  const shopId = route.params?.shop_id;
  const routeProductId = route.params?.productId;

  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  /** Bumped to retry GET /storefront/product/:id without changing route params. */
  const [detailRetryToken, setDetailRetryToken] = useState(0);
  /** Storefront product detail DTO from GET /storefront/product/:id */
  const [detailProduct, setDetailProduct] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  const [shopPolicies, setShopPolicies] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  const [productReviews, setProductReviews] = useState(
    /** @type {unknown[]} */ ([]),
  );
  const [reviewMetrics, setReviewMetrics] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  /** Vendors publish delivery policy only; opened from the ⋮ menu. */
  const [deliveryPolicyModalVisible, setDeliveryPolicyModalVisible] =
    useState(false);
  /** Resolved variant when all attribute axes are chosen (null until complete + in stock). */
  const [selectedVariant, setSelectedVariant] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  /** Per-axis selection for `hasVariants` products (values are attribute string or null). */
  const [selectedAttrs, setSelectedAttrs] = useState(
    /** @type {Record<string, string | null>} */ ({}),
  );
  /** Cart line for the currently selected inventory row (if any). */
  const [cartLineForSelection, setCartLineForSelection] = useState(
    /** @type {{ cartItemId: number; qty: number } | null} */ (null),
  );
  const [cartToggleBusy, setCartToggleBusy] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastHideTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );
  /* MVP: wishlist / save-for-later disabled
  const [saved, setSaved] = useState(false);
  */

  const shopName = vendor?.name?.trim() || 'Shop';
  const productIdParam =
    routeProductId ?? routeProduct?.id ?? routeProduct?.key;
  const hasNumericProductId = useMemo(() => {
    const s = productIdParam != null ? String(productIdParam).trim() : '';
    return s.length > 0 && !Number.isNaN(Number(s));
  }, [productIdParam]);

  const bumpDetailRetry = useCallback(() => {
    setDetailRetryToken(n => n + 1);
  }, []);

  useEffect(() => {
    const pid = productIdParam != null ? String(productIdParam).trim() : '';
    if (!pid || Number.isNaN(Number(pid))) {
      setDetailProduct(null);
      setDetailError(
        pid ? 'This product link uses an invalid id.' : 'Missing product id.',
      );
      setShopPolicies(null);
      setProductReviews([]);
      setReviewMetrics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setDetailError('');
      try {
        const data = await getStorefrontProduct(parseInt(pid, 10));
        if (cancelled) return;
        const normalized = normalizeStorefrontProductDetail(data);
        if (!normalized) {
          setDetailProduct(null);
          setDetailError(
            'The server returned product data we could not read. Try again in a moment.',
          );
          setShopPolicies(null);
          setProductReviews([]);
          setReviewMetrics(null);
        } else {
          setDetailProduct(normalized);
          setDetailError('');
          const sp = data.shopPolicies;
          setShopPolicies(
            sp && typeof sp === 'object'
              ? /** @type {Record<string, unknown>} */ (sp)
              : null,
          );
          setProductReviews(
            Array.isArray(data.productReviews) ? data.productReviews : [],
          );
          const rm = data.reviewMetrics;
          setReviewMetrics(
            rm && typeof rm === 'object'
              ? /** @type {Record<string, unknown>} */ (rm)
              : null,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : String(e));
          setDetailProduct(null);
          setShopPolicies(null);
          setProductReviews([]);
          setReviewMetrics(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productIdParam, detailRetryToken]);

  const d = detailProduct;
  const variants = useMemo(() => {
    const raw = d?.variants;
    return Array.isArray(raw)
      ? raw.filter(x => x && typeof x === 'object')
      : [];
  }, [d?.variants]);

  /** Ensure at least one attribute axis so buyers can complete selection (covers empty `attributes` from API). */
  const variantsForUi = useMemo(() => {
    if (!variants.length) return [];
    const base = variantAttributeKeys(variants).length
      ? variants
      : variants.map((v, i) => ({
          ...v,
          attributes: { option: `Option ${i + 1}` },
        }));
    /** Coerce attribute values to strings so chip labels and equality checks match API numbers/objects. */
    return base.map(v => {
      if (!v || typeof v !== 'object') return v;
      const raw =
        v.attributes && typeof v.attributes === 'object'
          ? /** @type {Record<string, unknown>} */ ({ ...v.attributes })
          : {};
      const attributes = /** @type {Record<string, string>} */ ({});
      for (const k of Object.keys(raw)) {
        attributes[k] = String(raw[k] ?? '').trim();
      }
      return { ...v, attributes };
    });
  }, [variants]);

  /**
   * API may set `hasVariants` with an empty `variants` array. We only treat it as a variant product when
   * there are rows to show; otherwise checkout uses the simple product fields on `d`.
   */
  const hasVariants = Boolean(d?.hasVariants) && variantsForUi.length > 0;

  const rawVariantAttrKeys = useMemo(
    () => variantAttributeKeys(variantsForUi),
    [variantsForUi],
  );
  /** Omit price/stock-like keys from attributes so tiles show only buyer-facing options (color, material, …). */
  const attrKeys = useMemo(() => {
    const filtered = filterVariantDisplayAttrKeys(rawVariantAttrKeys);
    return filtered.length ? filtered : rawVariantAttrKeys;
  }, [rawVariantAttrKeys]);

  useEffect(() => {
    if (!hasVariants || !attrKeys.length) {
      setSelectedAttrs({});
      setSelectedVariant(null);
      return;
    }
    const init = /** @type {Record<string, string | null>} */ ({});
    for (const k of attrKeys) init[k] = null;
    setSelectedAttrs(init);
    setSelectedVariant(null);
  }, [productIdParam, hasVariants, attrKeys.join('\u0001')]);

  useEffect(() => {
    if (!hasVariants) {
      setSelectedVariant(null);
      return;
    }
    const resolved = resolveVariantSelection(
      variantsForUi,
      attrKeys,
      selectedAttrs,
    );
    setSelectedVariant(resolved);
  }, [hasVariants, variantsForUi, attrKeys, selectedAttrs]);

  const mergedProduct = useMemo(() => {
    const p = routeProduct || {};
    const name = String(d?.name ?? p.title ?? 'Product').trim() || 'Product';
    const uri =
      getProductImageUri(p) ||
      getProductImageUri(d) ||
      '';
    let priceUsd = 0;
    if (!hasVariants && d) {
      priceUsd = Number(d.price) || 0;
    } else if (hasVariants && selectedVariant) {
      const pv = getVariantRowPrice(
        /** @type {Record<string, unknown>} */ (selectedVariant),
      );
      priceUsd = Number.isFinite(pv) ? pv : 0;
    } else if (typeof p.priceUsd === 'number') {
      priceUsd = p.priceUsd;
    }
    return {
      ...p,
      title: name,
      uri,
      shop_id: shopId,
      priceUsd,
      currency: 'NGN',
      description:
        typeof d?.description === 'string' ? d.description : p.description,
    };
  }, [routeProduct, shopId, d, hasVariants, selectedVariant]);

  const product = mergedProduct;

  const policySections = useMemo(
    () => extractCustomerPolicySections(shopPolicies),
    [shopPolicies],
  );

  const selectedInventoryId = useMemo(() => {
    if (!d) return null;
    if (hasVariants && selectedVariant) {
      const id = Number(selectedVariant.id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
    if (!hasVariants) {
      const id = Number(d.inventoryId);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
    return null;
  }, [d, hasVariants, selectedVariant]);

  const title = product?.title || 'Product';

  const priceDisplayLabel = useMemo(() => {
    if (!d) {
      if (hasVariants) {
        const nums = variantsForUi
          .map(v =>
            getVariantRowPrice(/** @type {Record<string, unknown>} */ (v)),
          )
          .filter(n => Number.isFinite(n) && n > 0);
        if (!nums.length) return '—';
        const lo = Math.min(...nums);
        const hi = Math.max(...nums);
        return lo === hi
          ? formatNaira(lo)
          : `${formatNaira(lo)} – ${formatNaira(hi)}`;
      }
      const fallback = Number(routeProduct?.priceUsd);
      return Number.isFinite(fallback) && fallback > 0
        ? formatNaira(fallback)
        : '—';
    }
    if (!hasVariants) return formatNaira(Number(d.price) || 0);
    if (selectedVariant) {
      const vp = getVariantRowPrice(
        /** @type {Record<string, unknown>} */ (selectedVariant),
      );
      return Number.isFinite(vp) ? formatNaira(vp) : '—';
    }
    const nums = variantsForUi
      .map(v => getVariantRowPrice(/** @type {Record<string, unknown>} */ (v)))
      .filter(n => Number.isFinite(n) && n > 0);
    if (!nums.length) return '—';
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return lo === hi
      ? formatNaira(lo)
      : `${formatNaira(lo)} – ${formatNaira(hi)}`;
  }, [d, hasVariants, selectedVariant, variantsForUi, routeProduct?.priceUsd]);

  const applyVariantPick = useCallback(
    v => {
      if (!v || typeof v !== 'object') return;
      const a =
        v.attributes && typeof v.attributes === 'object'
          ? /** @type {Record<string, unknown>} */ (v.attributes)
          : {};
      const next = /** @type {Record<string, string | null>} */ ({});
      for (const k of attrKeys) {
        const raw = a[k];
        next[k] = raw != null && String(raw).trim() ? String(raw).trim() : null;
      }
      setSelectedAttrs(next);
    },
    [attrKeys],
  );

  const reviewStats = useMemo(() => {
    const list = Array.isArray(productReviews) ? productReviews : [];
    const m =
      reviewMetrics && typeof reviewMetrics === 'object'
        ? /** @type {Record<string, unknown>} */ (reviewMetrics)
        : null;
    const mc = Number(m?.review_count ?? m?.reviewCount ?? 0) || 0;
    const ma = Number(m?.average_rating ?? m?.averageRating ?? 0) || 0;
    const sumFromList = () =>
      list.reduce((s, r) => {
        const row =
          r && typeof r === 'object'
            ? /** @type {Record<string, unknown>} */ (r)
            : {};
        return s + (Number(row.rating) || 0);
      }, 0);
    if (mc > 0 && ma > 0) return { count: mc, avg: ma };
    if (mc > 0 && list.length)
      return { count: mc, avg: sumFromList() / list.length };
    if (mc > 0) return { count: mc, avg: 0 };
    if (!list.length) return { count: 0, avg: 0 };
    const sum = sumFromList();
    return { count: list.length, avg: sum / list.length };
  }, [productReviews, reviewMetrics]);

  const galleryUrls = useMemo(() => {
    const imgs =
      d && Array.isArray(d.images)
        ? d.images.filter(x => typeof x === 'string' && x.trim())
        : [];
    if (imgs.length) return imgs.map(x => String(x).trim());
    const u = typeof product?.uri === 'string' ? product.uri.trim() : '';
    return u ? [u] : [];
  }, [d, product?.uri]);

  useEffect(() => {
    setImgIndex(0);
  }, [galleryUrls.length, productIdParam]);

  const bumpQty = useCallback(delta => {
    setQty(q => Math.min(99, Math.max(1, q + delta)));
  }, []);

  const showCartToast = useCallback(
    message => {
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current);
        toastHideTimerRef.current = null;
      }
      setToastMessage(message);
      setToastVisible(true);
      toastOpacity.setValue(0);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      toastHideTimerRef.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setToastVisible(false);
        });
        toastHideTimerRef.current = null;
      }, CART_TOAST_MS);
    },
    [toastOpacity],
  );

  useEffect(() => {
    return () => {
      if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);
    };
  }, []);

  const syncCartMembership = useCallback(async () => {
    if (!loggedIn || !selectedInventoryId) {
      setCartLineForSelection(null);
      return;
    }
    try {
      const res = await fetchBuyerCart();
      const lines = Array.isArray(res.lines) ? res.lines : [];
      const inv = selectedInventoryId;
      const hit = lines.find(l => {
        if (!l || typeof l !== 'object') return false;
        const r = /** @type {Record<string, unknown>} */ (l);
        const iid = Number(r.inventoryId ?? r.inventory_id);
        return Number.isFinite(iid) && iid === inv;
      });
      if (!hit) {
        setCartLineForSelection(null);
        return;
      }
      const r = /** @type {Record<string, unknown>} */ (hit);
      const cartItemId = Number(r.cartItemId ?? r.cart_item_id);
      const q = Number(r.qty ?? r.quantity ?? 1);
      if (Number.isFinite(cartItemId) && cartItemId > 0) {
        setCartLineForSelection({
          cartItemId,
          qty: Number.isFinite(q) && q > 0 ? q : 1,
        });
      } else {
        setCartLineForSelection(null);
      }
    } catch {
      setCartLineForSelection(null);
    }
  }, [loggedIn, selectedInventoryId]);

  useFocusEffect(
    useCallback(() => {
      void syncCartMembership();
      return () => {
        setOverflowMenuOpen(false);
        setDeliveryPolicyModalVisible(false);
      };
    }, [syncCartMembership]),
  );

  useEffect(() => {
    void syncCartMembership();
  }, [syncCartMembership]);

  const performAddToCart = useCallback(
    /** @returns {Promise<boolean>} */
    async inventoryId => {
      setCartToggleBusy(true);
      try {
        let cartOpts = /** @type {{ unitPrice?: number }} */ ({});
        if (hasVariants && selectedVariant) {
          const vp = getVariantRowPrice(
            /** @type {Record<string, unknown>} */ (selectedVariant),
          );
          if (Number.isFinite(vp)) cartOpts = { unitPrice: vp };
        } else if (d && !hasVariants) {
          const p = Number(d.price) || 0;
          if (p > 0) cartOpts = { unitPrice: p };
        }
        await addBuyerCartLine(inventoryId, qty, cartOpts);
        showCartToast('Added to your cart.');
        await syncCartMembership();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
          Alert.alert(
            'Sign in required',
            'Please sign in to add items to your cart.',
          );
        } else {
          Alert.alert('Cart', msg);
        }
        return false;
      } finally {
        setCartToggleBusy(false);
      }
    },
    [qty, showCartToast, syncCartMembership, hasVariants, selectedVariant, d],
  );

  const performRemoveFromCart = useCallback(async () => {
    const line = cartLineForSelection;
    if (!line?.cartItemId) return;
    setCartToggleBusy(true);
    try {
      await deleteBuyerCartLine(line.cartItemId);
      showCartToast('Removed from your cart.');
      await syncCartMembership();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('unauthorized') || msg.includes('401')) {
        Alert.alert('Sign in required', 'Please sign in to manage your cart.');
      } else {
        Alert.alert('Cart', msg);
      }
    } finally {
      setCartToggleBusy(false);
    }
  }, [cartLineForSelection, showCartToast, syncCartMembership]);

  const requireVariantSelection = useCallback(() => {
    if (hasVariants && !selectedVariant) {
      Alert.alert(
        'Please select a variant',
        'Choose all options for this product before continuing.',
      );
      return true;
    }
    return false;
  }, [hasVariants, selectedVariant]);

  const variantSummaryText = useMemo(() => {
    if (!hasVariants || !selectedVariant) return '';
    const a =
      selectedVariant.attributes &&
      typeof selectedVariant.attributes === 'object'
        ? selectedVariant.attributes
        : {};
    return Object.keys(a)
      .map(k => `${formatAttributeLabel(k)}: ${a[k]}`)
      .join(' · ');
  }, [hasVariants, selectedVariant]);

  const checkoutUnitPrice = useMemo(() => {
    if (!d) {
      const fallback = Number(routeProduct?.priceUsd);
      return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
    }
    if (!hasVariants) return Number(d.price) || 0;
    if (selectedVariant) {
      const pv = getVariantRowPrice(
        /** @type {Record<string, unknown>} */ (selectedVariant),
      );
      return Number.isFinite(pv) ? pv : 0;
    }
    return 0;
  }, [d, hasVariants, selectedVariant, routeProduct?.priceUsd]);

  const anyVariantInStock = variantsForUi.some(v =>
    isVariantPurchasable(/** @type {Record<string, unknown>} */ (v)),
  );

  const noSimpleStock =
    !hasVariants &&
    d &&
    Number(d.stock) <= 0 &&
    !Boolean(d.allowBackorder ?? d.allow_backorder);

  const selectedLineInCart = cartLineForSelection != null;

  const ensureReadyForCartOrCheckout = useCallback(() => {
    if (cartToggleBusy) return false;
    if (!d) {
      Alert.alert(
        'Product',
        detailLoading
          ? 'Still loading this product. Try again in a moment.'
          : detailError.trim() ||
              'Product details are not available. Pull down to refresh or tap Try again above.',
      );
      return false;
    }
    if (hasVariants && !anyVariantInStock) {
      Alert.alert(
        'Out of stock',
        'No variant of this product is in stock right now.',
      );
      return false;
    }
    if (noSimpleStock) {
      Alert.alert('Out of stock', 'This product is not in stock right now.');
      return false;
    }
    if (requireVariantSelection()) return false;
    if (selectedInventoryId == null) {
      Alert.alert(
        'Cart',
        'This product cannot be added right now. Check your options or try again later.',
      );
      return false;
    }
    if (!loggedIn) {
      Alert.alert('Sign in required', 'Please sign in to continue.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', onPress: () => void signOut() },
      ]);
      return false;
    }
    return true;
  }, [
    cartToggleBusy,
    d,
    detailLoading,
    detailError,
    hasVariants,
    anyVariantInStock,
    noSimpleStock,
    requireVariantSelection,
    selectedInventoryId,
    loggedIn,
    signOut,
  ]);

  const handleBuyNow = useCallback(async () => {
    if (!ensureReadyForCartOrCheckout()) return;

    setLoading(true);

    const imageUri =
      galleryUrls[0] ||
      (typeof product?.uri === 'string' ? product.uri.trim() : '') ||
      '';
    const buyLine = {
      key:
        selectedInventoryId != null
          ? `inv-${selectedInventoryId}`
          : `product-${String(productIdParam ?? '')}`,
      title,
      image: imageUri,
      unitPrice: checkoutUnitPrice,
      qty,
      shop_id: shopId,
      productId: product.id,
      inventoryId: selectedInventoryId ?? undefined,
      variantLabel: variantSummaryText || undefined,
      cartItemId: undefined,
    };

    setLoading(false);
    navigation.navigate('Cart-checkout', {
      checkoutSource: 'product',
      checkoutLines: [buyLine],
    });
  }, [
    ensureReadyForCartOrCheckout,
    galleryUrls,
    product?.uri,
    productIdParam,
    title,
    checkoutUnitPrice,
    qty,
    shopId,
    product.id,
    selectedInventoryId,
    navigation,
    variantSummaryText,
  ]);

  if (!vendor) {
    return (
      <View style={[styles.fallback, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.fallbackText}>Product unavailable.</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.fallbackBtn}
        >
          <Text style={styles.fallbackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (detailLoading && !routeProduct?.title) {
    return (
      <View style={[styles.fallback, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color={PURPLE} />
        <Text style={styles.fallbackText}>Loading product…</Text>
      </View>
    );
  }

  if (detailError && !routeProduct?.title) {
    return (
      <View style={[styles.fallback, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.fallbackText}>{detailError}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.fallbackBtn}
        >
          <Text style={styles.fallbackBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <View style={styles.root}>
      {
        loading && <Spinner />
      }
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: insets.bottom + 88 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          hasNumericProductId ? (
            <RefreshControl
              refreshing={detailLoading}
              onRefresh={bumpDetailRetry}
              tintColor={PURPLE}
              colors={[PURPLE]}
            />
          ) : undefined
        }
      >
        <View style={[styles.vendorHeader, { paddingTop: Platform.OS === 'android' ? insets.top : 15 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBack}
            hitSlop={{ top: 8, bottom: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="chevron-back" size={26} color="#000000" />
          </TouchableOpacity>
          <View style={styles.vendorLeft}>
            <View style={styles.vendorAvatar}>
              <Text style={styles.vendorAvatarLetter}>
                {shopName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.vendorTextCol}>
              <Text style={styles.vendorName} numberOfLines={1}>
                {shopName}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.headerCartHit, !loggedIn && styles.headerLoginHit]}
            onPress={() => {
              if (loggedIn) {
                navigation.navigate('Cart');
              } else {
                void signOut();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={loggedIn ? 'Open cart' : 'Login'}
          >
            {loggedIn ? (
              <Icon name="cart-outline" size={24} color="#000000" />
            ) : (
              <Text style={styles.headerLoginText}>Login</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.moreHit}
            onPress={() => setOverflowMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Product options"
          >
            <Icon name="ellipsis-vertical" size={22} color="#000000" />
          </TouchableOpacity>
        </View>
        {!d && !detailLoading && detailError.trim() ? (
          <View
            style={styles.detailFailBanner}
            accessibilityLabel={`Product details error: ${detailError}`}
          >
            <Text style={styles.detailFailTitle}>
              Could not load full product details
            </Text>
            <Text style={styles.detailFailText}>{detailError}</Text>
            {hasNumericProductId ? (
              <TouchableOpacity
                style={styles.detailFailRetry}
                onPress={bumpDetailRetry}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Retry loading product"
              >
                <Text style={styles.detailFailRetryText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <View style={styles.heroWrap}>
          {galleryUrls.length > 0 ? (
            <>
              <Image
                source={{ uri: galleryUrls[imgIndex % galleryUrls.length] }}
                style={styles.heroImg}
                resizeMode="cover"
              />
              {galleryUrls.length > 1 ? (
                <>
                  <TouchableOpacity
                    style={[styles.heroChevron, styles.heroChevronLeft]}
                    onPress={() =>
                      setImgIndex(
                        i => (i - 1 + galleryUrls.length) % galleryUrls.length,
                      )
                    }
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Icon name="chevron-back" size={28} color="#000000" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.heroChevron, styles.heroChevronRight]}
                    onPress={() =>
                      setImgIndex(i => (i + 1) % galleryUrls.length)
                    }
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Icon name="chevron-forward" size={28} color="#000000" />
                  </TouchableOpacity>
                </>
              ) : null}
            </>
          ) : (
            <View style={[styles.heroImg, styles.heroImgPlaceholder]}>
              <Icon name="image-outline" size={56} color="#BDBDBD" />
            </View>
          )}
        </View>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {title}
            </Text>
            <View style={styles.titleActions}>
              {/* MVP: wishlist — disabled
              <TouchableOpacity
                style={styles.iconCircle}
                onPress={() => setSaved((s) => !s)}
                accessibilityLabel={saved ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Icon name={saved ? 'heart' : 'heart-outline'} size={22} color="#000000" />
              </TouchableOpacity>
              */}
              <TouchableOpacity
                style={styles.iconCircle}
                accessibilityLabel="Share"
              >
                <Icon name="share-outline" size={22} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.price}>{priceDisplayLabel}</Text>
              {hasVariants && !selectedVariant ? (
                <Text style={styles.variantPriceRangeHint} numberOfLines={2}>
                  Choose an option [variant] to see the exact price
                </Text>
              ) : null}
            </View>
            <View style={styles.priceReviewsCol}>
              <RatingRow
                rating={reviewStats.avg}
                count={reviewStats.count}
                starSize={15}
                activeColor="#E8C547"
                emptyColor="#CCCCCC"
                countColor="#444444"
                countSize={12}
              />
            </View>
          </View>
          {hasVariants && attrKeys.length ? (
            <View style={styles.variantPickersBlock}>
              <Text style={styles.variantPickersTitle}>Options (variant)</Text>
              <ProductVariantCardPicker
                attrKeys={attrKeys}
                variants={variantsForUi}
                selectedVariant={selectedVariant}
                onSelect={applyVariantPick}
              />
              {/* {variantSummaryText ? (
                <Text style={styles.variantCurrent} numberOfLines={3}>
                  {`Selection: ${variantSummaryText}`}
                </Text>
              ) : null} */}
            </View>
          ) : null}
        </View>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.qtyPill}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => bumpQty(-1)}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Icon name="remove" size={22} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => bumpQty(1)}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Icon name="add" size={22} color="#000000" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.addCart,
            selectedLineInCart && styles.addCartOutlined,
            cartToggleBusy && styles.addCartBusy,
          ]}
          activeOpacity={cartToggleBusy ? 1 : 0.88}
          disabled={cartToggleBusy}
          onPress={() => {
            if (!ensureReadyForCartOrCheckout()) return;
            if (selectedLineInCart) {
              void performRemoveFromCart();
            } else {
              void performAddToCart(selectedInventoryId);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={
            selectedLineInCart ? 'Remove from cart' : 'Add to cart'
          }
        >
          <Text
            style={[
              styles.addCartText,
              selectedLineInCart && styles.addCartTextOutlined,
            ]}
          >
            {selectedLineInCart ? 'Remove from cart' : 'Add to cart'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buyNow}
          activeOpacity={0.88}
          disabled={cartToggleBusy}
          onPress={() => {
            void handleBuyNow();
          }}
          accessibilityRole="button"
          accessibilityLabel="Buy now and go to checkout"
        >
          <Text style={styles.buyNowText}>Buy now</Text>
          <Icon
            name="bag-check-outline"
            size={22}
            color="#FFFFFF"
            style={styles.buyNowIcon}
          />
        </TouchableOpacity>
        <Text style={styles.sectionHeading}>Description</Text>
        <Text style={styles.descriptionBody}>
          {typeof product?.description === 'string' &&
          product.description.trim()
            ? product.description.trim()
            : 'No description provided for this product.'}
        </Text>
        <TouchableOpacity style={styles.visitPill} activeOpacity={0.88} onPress={e => navigation.navigate("Vendor", {
          vendor: vendor
        })}>
          <Icon name="link-outline" size={18} color="#000000" />
          <Text style={styles.visitPillText}>{`Visit ${shopName}`}</Text>
        </TouchableOpacity>
        <ProductReviewsSection
          reviews={productReviews}
          reviewMetrics={reviewMetrics}
          loading={detailLoading}
        />
      </ScrollView>
      <ShopPolicyViewerModal
        visible={deliveryPolicyModalVisible}
        onClose={() => setDeliveryPolicyModalVisible(false)}
        title={`${shopName} — Delivery policy`}
        clauses={policySections.delivery}
        emptyMessage="This vendor has not published a delivery policy on Deedyte yet."
      />
      <ShopOverflowMenu
        visible={overflowMenuOpen}
        onClose={() => setOverflowMenuOpen(false)}
        title={title}
        subtitle={`${priceDisplayLabel} · ${shopName}`}
        headerImageUri={
          galleryUrls[0] ||
          (typeof product?.uri === 'string' ? product.uri.trim() : '')
        }
        fallbackLetter={title.charAt(0).toUpperCase() || 'P'}
        onDeliveryPolicy={() => {
          setOverflowMenuOpen(false);
          setDeliveryPolicyModalVisible(true);
        }}
        onVisitShop={() => {
          setOverflowMenuOpen(false);
          navigation.navigate('vendor', { vendor, category });
        }}
        onFollow={() => {
          setOverflowMenuOpen(false);
          Alert.alert(
            'Deedyte',
            'Following shops will be available in a future update.',
          );
        }}
        onNotInterested={() => {
          setOverflowMenuOpen(false);
          Alert.alert('Thanks', 'We will tune your recommendations over time.');
        }}
        onReport={() => {
          setOverflowMenuOpen(false);
          Alert.alert(
            'Report product',
            'Thanks for the report. Our team will review it.',
          );
        }}
        reportLabel="Report product"
      />
      {toastVisible ? (
        <View
          style={[
            styles.toastWrap,
            { paddingBottom: Math.max(insets.bottom, 12) + 8 },
          ]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.toastPill, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        </View>
      ) : null}
     
    </View>
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
            zIndex: 1000,
          }}
        >
          <ActivityIndicator size="large" color="green" />
        </View>
      </>
    );
  }

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: PAD,
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerBack: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    marginRight: 4,
    marginLeft: -4,
  },
  vendorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  vendorTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  vendorName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },
  vendorRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  vendorRatingNum: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  detailFailBanner: {
    marginHorizontal: PAD,
    marginBottom: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#E8D4A8',
  },
  detailFailTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5C4A10',
    marginBottom: 6,
  },
  detailFailText: {
    fontSize: 14,
    color: '#6B5B20',
    lineHeight: 20,
    marginBottom: 10,
  },
  detailFailRetry: {
    alignSelf: 'flex-start',
    backgroundColor: PURPLE,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  detailFailRetryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  vendorStar: {
    marginLeft: 4,
  },
  vendorRatingParen: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  headerCartHit: {
    padding: 4,
    marginRight: 4,
  },
  headerLoginHit: {
    borderRadius: 10,
    backgroundColor: '#00926e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  headerLoginText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  moreHit: {
    padding: 4,
  },
  heroWrap: {
    width: WINDOW_W - PAD * 2,
    alignSelf: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    marginBottom: 16,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroImgPlaceholder: {
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChevron: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChevronLeft: {
    left: 8,
  },
  heroChevronRight: {
    right: 8,
  },
  titleBlock: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  productTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    lineHeight: 26,
    paddingRight: 8,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D8D8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGap: {
    marginLeft: 10,
  },
  ratingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingsLabel: {
    marginLeft: 10,
    fontSize: 14,
    color: '#555',
  },
  socialPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
  },
  socialPillText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111',
    flexShrink: 1,
  },
  variantPriceRangeHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    maxWidth: 220,
  },
  priceReviewsCol: {
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  ratingsCount: {
    marginTop: 4,
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  variantPickersBlock: {
    marginTop: 14,
    marginBottom: 4,
  },
  variantPickersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  variantCurrent: {
    marginTop: 10,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginTop: 20,
    marginBottom: 10,
  },
  qtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  qtyBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    minWidth: 32,
    textAlign: 'center',
  },
  addCart: {
    backgroundColor: PURPLE,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  addCartText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  addCartBusy: {
    opacity: 0.75,
  },
  addCartOutlined: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: PURPLE,
  },
  addCartTextOutlined: {
    color: PURPLE,
  },
  toastWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toastPill: {
    maxWidth: 360,
    backgroundColor: 'rgba(33,33,33,0.94)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
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
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  descriptionBody: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 14,
  },
  visitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    marginBottom: 8,
  },
  visitPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginLeft: 8,
  },
  reviewsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bigRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigRating: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111',
  },
  bigRatingStarIcon: {
    marginLeft: 6,
    marginTop: 2,
  },
  reviewCountMuted: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  histoWrap: {
    flex: 1,
    maxWidth: WINDOW_W * 0.48,
    marginLeft: 8,
  },
  histoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  histoLabel: {
    width: 14,
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginRight: 6,
  },
  histoTrack: {
    flex: 1,
    height: 8,
    borderRadius: 10,
    backgroundColor: '#EEEEEE',
    overflow: 'hidden',
  },
  histoFill: {
    height: '100%',
    backgroundColor: '#C4C4C4',
    borderRadius: 10,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 10,
    padding: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  reviewCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  reviewCardBody: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 10,
  },
  reviewMeta: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  viewAllPill: {
    backgroundColor: '#F2F2F2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  fallbackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PURPLE,
  },
  fallbackBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
