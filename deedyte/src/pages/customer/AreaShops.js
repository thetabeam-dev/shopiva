import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { normalizeVendorState, vendorStateRaw } from './Vendors';

function shopCover(vendor) {
  return String(vendor?.logo ?? '').trim();
}

function shopPlace(vendor) {
  const city = String(vendor?.city ?? '').trim();
  const state = normalizeVendorState(vendorStateRaw(vendor));
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return String(vendor?.address ?? '').trim();
}

export default function AreaShopsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const shops = Array.isArray(route.params?.shops) ? route.params.shops : [];

  return (
    <FlatList
      data={shops}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={shops.length === 0 ? styles.emptyWrap : styles.list}
      ListEmptyComponent={<Text style={styles.empty}>No shops in this part of the map.</Text>}
      renderItem={({ item }) => {
        const cover = shopCover(item);
        const place = shopPlace(item);
        return (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Vendor', { vendor: item, category: '__all__' })}
          >
            {cover ? (
              <Image source={{ uri: cover }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Text style={styles.coverLetter}>
                  {String(item.name || 'S').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.copy}>
              <Text style={styles.title} numberOfLines={1}>{item.name || 'Shop'}</Text>
              {place ? <Text style={styles.place} numberOfLines={1}>{place}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { color: '#6B7280', fontSize: 15, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 7,
    padding: 10,
  },
  cover: {
    width: 72,
    height: 72,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F1' },
  coverLetter: { fontSize: 24, fontWeight: '700', color: '#00926E' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', color: '#111111' },
  place: { marginTop: 4, fontSize: 13, color: '#6B7280' },
});
