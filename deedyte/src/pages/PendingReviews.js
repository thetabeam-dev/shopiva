import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchBuyerProductPendingReviews } from '../api/buyer';

const BRAND = '#0D9488';
const BG = '#F4F5F7';
const CARD = '#FFFFFF';
const MUTED = '#6B7280';
const TEXT = '#111111';

function OrderReviewCard({ item, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        {item?.productImage ? (
          <Image
            source={{ uri: item.productImage }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>★</Text>
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.orderId}>ORD-{item.orderId}</Text>
          <Text style={styles.meta}>
            {item?.productName || 'Product'} •{' '}
            {item?.quantity ? `Qty ${item.quantity}` : '1 item'}
          </Text>
        </View>
        <Text style={styles.actionText}>Rate this product</Text>
      </View>
      <Text style={styles.shopName} numberOfLines={1}>
        {item?.shopName || 'Shop'}
      </Text>
    </Pressable>
  );
}

export default function PendingReviewsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const fetchPendingReviews = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchBuyerProductPendingReviews();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to load pending reviews',
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingReviews();
    }, [fetchPendingReviews]),
  );

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  const list = useMemo(() => items, [items]);

  const renderItem = useCallback(
    ({ item }) => (
      <OrderReviewCard
        item={item}
        onPress={() =>
          navigation.navigate('ProductReview', {
            shop: {
              id: item?.shopId,
              name: item?.shopName || 'Shop',
            },
            order: {
              id: item?.orderId,
              customer_id: item?.customerId,
            },
            orderItemId: item?.orderItemId,
            order_item_id: item?.orderItemId,
            productId: item?.productId,
            product_id: item?.productId,
            productName: item?.productName,
          })
        }
      />
    ),
    [navigation],
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: 15 }]}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={styles.loadingText}>Loading pending reviews…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          { paddingTop: 15, paddingHorizontal: 24 },
        ]}
      >
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: 15 }]}>
      <FlatList
        data={list}
        keyExtractor={item => String(item?.orderItemId ?? item?.id ?? item?.order_id ?? Math.random())}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No pending reviews</Text>
            <Text style={styles.emptyText}>
              Orders you have received will show up here once they are marked
              delivered.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 14,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 6,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    color: BRAND,
    fontSize: 20,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  shopName: {
    marginTop: 12,
    fontSize: 12,
    color: MUTED,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: BRAND,
    // textTransform: 'capitalize',
  },
  meta: {
    marginTop: 5,
    fontSize: 13,
    color: "#333333",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MUTED,
  },
  errorText: {
    fontSize: 14,
    color: '#c62828',
    textAlign: 'center',
  },
  emptyState: {
    marginTop: 40,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
});
