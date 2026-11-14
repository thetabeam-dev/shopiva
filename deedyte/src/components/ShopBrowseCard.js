import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { shopCover, shopLogo, shopPlace } from '../utils/exploreMap';

function shopRating(item) {
  const rating = Number(
    item?.average_rating ?? item?.averageRating ?? item?.ratingAverage ?? item?.rating ?? 0,
  );
  const count = Number(
    item?.review_count ?? item?.reviewCount ?? item?.ratingCount ?? 0,
  );
  return {
    rating: Number.isFinite(rating) && rating > 0 ? rating : 0,
    count: Number.isFinite(count) && count > 0 ? count : 0,
  };
}

/**
 * Shop tile used on Explore and Explore Map: banner cover with logo on the bottom left,
 * plus a fixed reviews + location strip on every photo.
 * @param {{
 *   item: object;
 *   onPress: () => void;
 *   width: number;
 * }} props
 */
export default function ShopBrowseCard({ item, onPress, width }) {
  const cover = shopCover(item);
  const logo = shopLogo(item);
  const place = shopPlace(item) || 'Location unavailable';
  const { rating, count } = shopRating(item);
  const letter = String(item?.name || 'S').trim().charAt(0).toUpperCase();
  const ratingLabel =
    rating > 0
      ? `${rating.toFixed(1)}${count > 0 ? ` (${count})` : ''}`
      : 'No reviews yet';

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

        <View style={styles.photoMeta} pointerEvents="none">
          <Icon
            name={rating > 0 ? 'star' : 'star-outline'}
            size={13}
            color={rating > 0 ? '#E8C547' : '#FFFFFF'}
          />
          <Text style={styles.photoMetaText} numberOfLines={1}>
            {ratingLabel}
          </Text>
        </View>

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
      <Text style={styles.cardSub} numberOfLines={1}>{place}</Text>
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
    marginBottom: 8,
  },
  cover: {
    width: '100%',
    height: 168,
    borderRadius: 7,
    backgroundColor: '#F3F4F6',
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F6F1' },
  coverLetter: { fontSize: 36, fontWeight: '700', color: '#00926E' },
  photoMeta: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  photoMetaText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  logoRing: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F6EF',
  },
  logoLetter: { fontSize: 16, fontWeight: '700', color: '#00926E' },
  cardTitle: { marginTop: 4, fontSize: 15, fontWeight: '600', color: '#111111' },
  cardSub: { marginTop: 2, fontSize: 13, color: '#6B7280' },
});
