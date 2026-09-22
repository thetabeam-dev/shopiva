import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNaira } from '../../utils/formatNaira';
import { deleteBuyerCartLine, fetchBuyerCart, fetchBuyerCartProductShopId, patchBuyerCartLine } from '../../api/buyer';

const BG = '#F8F8F8';
const TEAL = '#00926e';
const BORDER = '#E0E0E0';
const SUB = '#757575';

/** @typedef {{ id: string; cartItemId: number; inventoryId?: number; productId?: number; title: string; image: string; size: string; colorHex: string; unitPrice: number; qty: number }} CartLine */

/** Compact total in header bar (e.g. ₦18.2k). */
function formatNairaTotalBar(n) {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1);
    return `₦${s.replace(/\.0$/, '')}k`;
  }
  return formatNaira(n);
}

function CartLineCard({
  item,
  onInc,
  onDec,
  onRemove,
}) {
  const lineTotal = item.unitPrice * item.qty;

  return (
    <View style={styles.card}>
      <Pressable
        hitSlop={12}
        onPress={onRemove}
        style={styles.cardDelete}
        accessibilityRole="button"
        accessibilityLabel="Remove item"
      >
        <Icon name="trash-outline" size={20} color="#000000" />
      </Pressable>

      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePh]}>
          <Icon name="image-outline" size={28} color="#9E9E9E" />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.attrRow}>
          <Text style={styles.attrText}>
            Size {item.size} <Text style={styles.attrSep}>|</Text> Colour{' '}
          </Text>
          <View style={[styles.colorDot, { backgroundColor: item.colorHex }]} />
        </View>
        <Text style={styles.cardPrice}>{formatNaira(lineTotal)}</Text>
      </View>

      <View style={styles.qtyWrap}>
        <Pressable
          onPress={onDec}
          style={styles.qtyBtn}
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
        >
          <Icon name="remove" size={18} color="#000000" />
        </Pressable>
        <Text style={styles.qtyVal}>{item.qty}</Text>
        <Pressable
          onPress={onInc}
          style={styles.qtyBtn}
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
        >
          <Icon name="add" size={18} color="#000000" />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>> }} props
 */
export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [lines, setLines] = useState(/** @type {CartLine[]} */ ([]));
  const [cartLoading, setCartLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setCartLoading(true);
        try {
          const { lines: raw } = await fetchBuyerCart();
          if (cancelled) return;
            const mapped = (Array.isArray(raw) ? raw : []).map((l) => {
            const row = /** @type {Record<string, unknown>} */ (l);
            const inventoryIdNum = Number(row.inventoryId ?? row.inventory_id);
            const productIdNum = Number(row.productId ?? row.product_id);
            return {
              id: String(row.id ?? ''),
              cartItemId: Number(row.cartItemId),
              inventoryId: Number.isFinite(inventoryIdNum) && inventoryIdNum > 0 ? inventoryIdNum : undefined,
              productId: Number.isFinite(productIdNum) && productIdNum > 0 ? productIdNum : undefined,
              title: String(row.title ?? 'Item'),
              image: String(row.image ?? '').trim(),
              size: row.sku != null && String(row.sku).trim() ? String(row.sku) : '—',
              colorHex: '#9E9E9E',
              unitPrice: Number(row.unitPrice) || 0,
              qty: Number(row.qty) || 1,
            };
          });
          setLines(mapped);
        } catch {
          if (!cancelled) setLines([]);
        } finally {
          if (!cancelled) setCartLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0),
    [lines],
  );

  const bump = useCallback(async (id, delta) => {
    const line = lines.find((l) => l.id === id);
    if (!line || !Number.isFinite(line.cartItemId)) return;
    const nextQty = Math.min(99, Math.max(1, line.qty + delta));
    try {
      await patchBuyerCartLine(line.cartItemId, nextQty);
      setLines((prev) => prev.map((l) => (l.id !== id ? l : { ...l, qty: nextQty })));
    } catch {
      /* keep server qty on failure */
    }
  }, [lines]);

  const remove = useCallback(async (id) => {
    const line = lines.find((l) => l.id === id);
    if (line && Number.isFinite(line.cartItemId)) {
      try {
        await deleteBuyerCartLine(line.cartItemId);
      } catch {
        /* still remove locally */
      }
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, [lines]);

  const showBack =
    navigation.canGoBack() ||
    Boolean(navigation.getParent()?.canGoBack?.());

  const onHeaderBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent();
    if (parent?.canGoBack?.()) {
      parent.goBack();
      return;
    }
    navigation.navigate('home');
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {
        loading &&  
        <View style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center" 
        }}>
          <ActivityIndicator size={"large"} color={"green"} />
        </View>
      }
      

      {!loading && 
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 130 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {cartLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyHint}>Loading your cart…</Text>
              </View>
            ) : lines.length === 0 ? (
              <View style={styles.empty}>
                <Icon name="cart-outline" size={56} color="#000000" />
                <Text style={styles.emptyTitle}>Your cart is empty</Text>
                <Text style={styles.emptyHint}>Browse vendors and add items to continue.</Text>
              </View>
            ) : (
              lines.map((item) => (
                <CartLineCard
                  key={item.id}
                  item={item}
                  onInc={() => bump(item.id, 1)}
                  onDec={() => bump(item.id, -1)}
                  onRemove={() => remove(item.id)}
                />
              ))
            )}
          </ScrollView>

          {lines.length > 0 ? (
            <View style={[styles.checkoutBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View>
                <Text style={styles.totalLabel}>Total Price</Text>
                <Text style={styles.totalValue}>{formatNairaTotalBar(total)}</Text>
              </View>
              <Pressable
                style={styles.checkoutBtn}
                onPress={async() => {
                    setLoading(true);
                    const list = await Promise.all(lines.map(async(l) => {
                      let {
                        shop_id
                      } = await fetchBuyerCartProductShopId(l.productId);
                      return({
                        key: l.id,
                        cartItemId: l.cartItemId,
                        inventoryId: l.inventoryId,
                        productId: l.productId,
                        title: l.title,
                        image: l.image,
                        unitPrice: l.unitPrice,
                        qty: l.qty,
                        shop_id,
                        variantLabel: l.size && l.size !== '—' ? l.size : '',
                      })
                    }));
                    navigation.navigate('Cart-checkout', {
                      checkoutSource: 'cart',
                      checkoutLines: list,
                    })
                  }
                }
                accessibilityRole="button"
                accessibilityLabel="Go to checkout"
              >
                <Text style={styles.checkoutBtnText}>Go To Checkout</Text>
                <Icon name="arrow-forward" size={20} color="#000000" />
              </Pressable>
            </View>
          ) : null}
        </>
      }
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerSide: {
    width: 44,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingTop: 16,
  },
  card: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    paddingRight: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  cardDelete: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    padding: 4,
  },
  cardImage: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: '#EEE',
  },
  cardImagePh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 36,
    justifyContent: 'center',
    minHeight: 88,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  attrText: {
    fontSize: 13,
    color: SUB,
  },
  attrSep: {
    color: BORDER,
    marginHorizontal: 4,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  qtyWrap: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyVal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    minWidth: 22,
    textAlign: 'center',
  },
  checkoutBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 12 },
    }),
  },
  totalLabel: {
    fontSize: 12,
    color: SUB,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TEAL,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  emptyHint: {
    marginTop: 8,
    fontSize: 14,
    color: SUB,
    textAlign: 'center',
  },
});
