import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Modal,
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
import { ProductCardMedia } from '../../components/ProductCardMedia';
import {
  MIN_VENDOR_ORDER_AMOUNT,
  clearVendorOrder,
  getVendorOrder,
  lineKey,
  lineTotal,
  orderSubtotal,
  removeVendorOrderLine,
  setVendorOrderQty,
} from '../../utils/vendorOrderCart';

const TEAL = '#00926e';

/**
 * @param {{
 *   route: { params?: { shopId?: number; shopName?: string; vendor?: object } };
 *   navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>>;
 * }} props
 */
export default function VendorOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const shopId = Number(route.params?.shopId) || 0;
  const shopName = String(route.params?.shopName ?? 'Vendor').trim() || 'Vendor';
  const vendor = route.params?.vendor;
  const [lines, setLines] = useState(/** @type {import('../../utils/vendorOrderCart').VendorOrderLine[]} */ ([]));
  const [minOrderOpen, setMinOrderOpen] = useState(false);

  const reload = useCallback(async () => {
    setLines(await getVendorOrder(shopId));
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const subtotal = orderSubtotal(lines);
  const shortfall = Math.max(0, MIN_VENDOR_ORDER_AMOUNT - subtotal);
  const canStart = subtotal >= MIN_VENDOR_ORDER_AMOUNT && lines.length > 0;

  const startPurchase = async () => {
    if (!canStart) {
      setMinOrderOpen(true);
      return;
    }
    let fromDb = lines;
    try {
      fromDb = await getVendorOrder(shopId);
      setLines(fromDb);
    } catch {
      Alert.alert('Could not load this vendor’s order', 'Try again in a moment.');
      return;
    }
    if (!fromDb.length || orderSubtotal(fromDb) < MIN_VENDOR_ORDER_AMOUNT) {
      setMinOrderOpen(true);
      return;
    }
    const first = fromDb[0];
    navigation.navigate('Inbox', {
      chat: {
        shopId,
        name: shopName,
        orderLines: fromDb,
        productId: first?.productId,
        itemTitle: fromDb.length === 1 ? first.title : `${fromDb.length} items from ${shopName}`,
        itemImage: first?.image,
        itemAmount: first?.unitPrice,
        variantId: first?.variantId,
      },
    });
    void clearVendorOrder(shopId);
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.kicker}>{shopName}</Text>
        <Text style={styles.lead}>
          Items from this vendor only. Shipping is set once, after you start the purchase.
        </Text>
        {lines.length ? (
          lines.map((line) => (
            <View key={lineKey(line)} style={styles.card}>
              <ProductCardMedia uri={line.image} style={styles.thumb} />
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>{line.title}</Text>
                {line.variantLabel ? (
                  <Text style={styles.meta} numberOfLines={1}>{line.variantLabel}</Text>
                ) : null}
                <Text style={styles.price}>{formatNaira(lineTotal(line))}</Text>
                <View style={styles.qtyRow}>
                  <Pressable
                    onPress={() => {
                      void setVendorOrderQty(shopId, lineKey(line), line.qty - 1).then(setLines);
                    }}
                    style={styles.qtyBtn}
                  >
                    <Icon name="remove" size={18} color="#111" />
                  </Pressable>
                  <Text style={styles.qtyVal}>{line.qty}</Text>
                  <Pressable
                    onPress={() => {
                      void setVendorOrderQty(shopId, lineKey(line), line.qty + 1).then(setLines);
                    }}
                    style={styles.qtyBtn}
                  >
                    <Icon name="add" size={18} color="#111" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void removeVendorOrderLine(shopId, lineKey(line)).then(setLines);
                    }}
                    hitSlop={10}
                  >
                    <Icon name="trash-outline" size={18} color="#9e4039" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No items yet. Add products from this vendor.</Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal (before shipping)</Text>
          <Text style={styles.totalValue}>{formatNaira(subtotal)}</Text>
        </View>
        {shortfall > 0 ? (
          <Text style={styles.hint}>
            Add {formatNaira(shortfall)} more to reach the {formatNaira(MIN_VENDOR_ORDER_AMOUNT)}{' '}
            minimum, or increase the quantity.
          </Text>
        ) : null}
        <Pressable
          style={styles.browseBtn}
          onPress={() => navigation.navigate('Vendor', { vendor, shop_id: shopId })}
        >
          <Text style={styles.browseText}>Add more from this vendor</Text>
        </Pressable>
        <Pressable
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={startPurchase}
        >
          <Text style={styles.startText}>Start Purchase</Text>
        </Pressable>
      </View>
      <Modal
        visible={minOrderOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMinOrderOpen(false)}
      >
        <View style={styles.minOrderRoot}>
          <Pressable style={styles.minOrderBackdrop} onPress={() => setMinOrderOpen(false)} />
          <View style={[styles.minOrderSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.minOrderHandle} />
            <Text style={styles.minOrderTitle}>Add more to this order</Text>
            <Text style={styles.minOrderBody}>
              This order is {formatNaira(subtotal)} before shipping. The minimum is{' '}
              {formatNaira(MIN_VENDOR_ORDER_AMOUNT)}. Add more quantity or more items from{' '}
              {shopName}'s catalog.
            </Text>
            <Pressable
              style={styles.browseBtn}
              onPress={() => {
                setMinOrderOpen(false);
                navigation.navigate('Vendor', { vendor, shop_id: shopId });
              }}
            >
              <Text style={styles.browseText}>Browse shop</Text>
            </Pressable>
            <Pressable style={styles.minOrderGhost} onPress={() => setMinOrderOpen(false)}>
              <Text style={styles.hint}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  list: { padding: 16, paddingBottom: 24 },
  kicker: { fontSize: 13, fontWeight: '700', color: TEAL, marginBottom: 4 },
  lead: { fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 7,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  thumb: { width: 72, height: 72, borderRadius: 7, backgroundColor: '#eee' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '600', color: '#111' },
  meta: { marginTop: 2, fontSize: 12, color: '#757575' },
  price: { marginTop: 6, fontSize: 15, fontWeight: '700', color: '#111' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyVal: { minWidth: 20, textAlign: 'center', fontWeight: '700' },
  empty: { color: '#757575', fontSize: 15, paddingVertical: 24 },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { color: '#555', fontSize: 13 },
  totalValue: { fontWeight: '800', fontSize: 16, color: '#111' },
  hint: { color: '#9e4039', fontSize: 13, marginBottom: 10 },
  browseBtn: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  browseText: { fontWeight: '700', color: '#111' },
  startBtn: {
    backgroundColor: '#F3F3F3',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  startBtnDisabled: { opacity: 0.45 },
  startText: { fontWeight: '700', color: '#111' },
  minOrderRoot: { flex: 1, justifyContent: 'flex-end' },
  minOrderBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  minOrderSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  minOrderHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D0D0D0',
    marginBottom: 14,
  },
  minOrderTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 8 },
  minOrderBody: { fontSize: 14, lineHeight: 21, color: '#555', marginBottom: 16 },
  minOrderGhost: { paddingVertical: 12, alignItems: 'center' },
});
