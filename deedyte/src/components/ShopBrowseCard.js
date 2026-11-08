import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { shopCover, shopLogo, shopPlace } from '../utils/exploreMap';

/**
 * Shop tile used on Explore and Explore Map: banner cover with logo on the bottom left.
 * @param {{
 *   item: object;
 *   onPress: () => void;
 *   width: number;
 * }} props
 */
export default function ShopBrowseCard({ item, onPress, width }) {
  const cover = shopCover(item);
  const logo = shopLogo(item);
  const place = shopPlace(item);
  const letter = String(item?.name || 'S').trim().charAt(0).toUpperCase();
  return (
    <TouchableOpacity style={[styles.card, { width }]} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.coverWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverLetter}>{letter}</Text>
          </View>
        )}
        <View style={styles.logoRing}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logoImage} />
          ) : (
            <View style={[styles.logoImage, styles.logoFallback]}>
              <Text style={styles.logoLetter}>{letter}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{item?.name || 'Shop'}</Text>
      {place ? <Text style={styles.cardSub} numberOfLines={1}>{place}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 10,
  },
  coverWrap: {
    marginBottom: 20,
  },
  cover: {
    width: '100%',
    height: 168,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F1' },
  coverLetter: { fontSize: 36, fontWeight: '700', color: '#00926E' },
  logoRing: {
    position: 'absolute',
    left: 10,
    bottom: -18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F6EF',
  },
  logoLetter: { fontSize: 18, fontWeight: '700', color: '#00926E' },
  cardTitle: { marginTop: 8, fontSize: 15, fontWeight: '600', color: '#111111' },
  cardSub: { marginTop: 2, fontSize: 13, color: '#6B7280' },
});
