import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const TEAL = '#00926e';
const MINT = '#E8F8F3';

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: MINT,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryScore: {
    fontSize: 28,
    fontWeight: '800',
    color: TEAL,
    marginBottom: 8,
  },
  summaryStars: {
    marginBottom: 8,
  },
  summaryMeta: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
    marginBottom: 14,
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  commentsVerifiedNote: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  reviewCard: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEE',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginTop: 6,
    marginBottom: 4,
  },
  reviewBody: {
    fontSize: 15,
    color: '#222',
    lineHeight: 22,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  reviewFooterLeft: {
    flex: 1,
    minWidth: 0,
  },
  reviewMeta: {
    fontSize: 12,
    color: '#888',
  },
  verifiedBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
    flexShrink: 0,
    paddingTop: 2,
  },
  emptyComments: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});

/**
 * @param {number} rating 0–5
 * @param {number} size
 * @param {string} color
 * @param {string} emptyColor
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} style
 */
export function RatingStars({ rating, size = 18, color = TEAL, emptyColor = '#D0D0D0', style }) {
  const r = Math.min(5, Math.max(0, Number(rating) || 0));
  const nodes = [];
  for (let i = 1; i <= 5; i += 1) {
    if (r + 1e-6 >= i) {
      nodes.push(<Icon key={i} name="star" size={size} color={color} />);
    } else if (r + 1e-6 >= i - 0.5) {
      nodes.push(<Icon key={i} name="star-half" size={size} color={color} />);
    } else {
      nodes.push(<Icon key={i} name="star-outline" size={size} color={emptyColor} />);
    }
  }
  return <View style={[styles.starRow, style]}>{nodes}</View>;
}

/**
 * @param {unknown} row
 */
function normalizeReview(row) {
  const o = row && typeof row === 'object' ? /** @type {Record<string, unknown>} */ (row) : {};
  const nameRaw = o.reviewer_name ?? o.reviewerName;
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  const titleRaw = o.title ?? o.review_tag ?? o.reviewTag;
  const rating = Number(o.rating) || 0;
  const fallbackTitle = rating >= 5 ? 'Best' : rating >= 4 ? 'Good' : rating >= 3 ? 'Average' : 'Poor';
  return {
    id: o.id,
    rating,
    title: typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : fallbackTitle,
    comment: typeof o.comment === 'string' ? o.comment.trim() : '',
    verified: Boolean(o.is_verified_purchase ?? o.isVerifiedPurchase),
    createdAt: String(o.created_at ?? o.createdAt ?? ''),
    reviewerName: name || 'Customer',
  };
}

/**
 * @param {unknown} m
 */
function parseMetrics(m) {
  if (!m || typeof m !== 'object') return { count: 0, avg: 0 };
  const rec = /** @type {Record<string, unknown>} */ (m);
  const count = Number(rec.review_count ?? rec.reviewCount ?? 0) || 0;
  const avg = Number(rec.average_rating ?? rec.averageRating ?? 0) || 0;
  return { count, avg };
}

/**
 * @param {{ reviews: unknown[]; reviewMetrics: unknown; loading: boolean }} props
 */
export default function ProductReviewsSection({ reviews, reviewMetrics, loading }) {
  const list = Array.isArray(reviews) ? reviews.map(normalizeReview) : [];
  const { count: mc, avg: ma } = parseMetrics(reviewMetrics);
  const listAvg = list.length > 0 ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;
  const displayCount = mc > 0 ? mc : list.length;
  const displayAvg =
    mc > 0 && ma > 0 ? ma : mc > 0 && list.length > 0 ? listAvg : list.length > 0 ? listAvg : 0;
  const verifiedInList = list.filter((r) => r.verified).length;

  return (
    <View style={sectionStyles.wrap}>
      <Text style={styles.sectionTitle}>Reviews</Text>
      <Text style={styles.subTitle}>Verified rating ({verifiedInList})</Text>

      {loading ? (
        <Text style={styles.loadingText}>Loading reviews…</Text>
      ) : null}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryScore}>
          {displayCount > 0 ? `${displayAvg.toFixed(1)}/5.0` : '—/5.0'}
        </Text>
        <RatingStars rating={displayAvg} size={22} color="#E8C547" emptyColor="#D0D0D0" style={styles.summaryStars} />
        <Text style={styles.summaryMeta}>
          {displayCount > 0
            ? `${displayCount} customer review${displayCount === 1 ? '' : 's'}`
            : 'No reviews yet'}
        </Text>
      </View>

      <View style={styles.divider} />
      <Text style={styles.commentsTitle}>
        Customer reviews ({list.length})
        {verifiedInList > 0 ? (
          <Text style={styles.commentsVerifiedNote}>
            {` · ${verifiedInList} verified purchase${verifiedInList === 1 ? '' : 's'}`}
          </Text>
        ) : null}
      </Text>

      {!loading && list.length === 0 ? (
        <Text style={styles.emptyComments}>
          When customers leave reviews for this shop, they will appear here.
        </Text>
      ) : null}

      {list.map((rev) => {
        const when =
          rev.createdAt && !Number.isNaN(Date.parse(rev.createdAt))
            ? new Date(rev.createdAt).toUTCString()
            : '';
        return (
          <View key={String(rev.id ?? `${rev.reviewerName}-${when}`)} style={styles.reviewCard}>
            <RatingStars rating={rev.rating} size={16} color="#E8C547" emptyColor="#D0D0D0" />
            {rev.title ? <Text style={styles.reviewTitle}>{rev.title}</Text> : null}
            {rev.comment ? <Text style={styles.reviewBody}>{rev.comment}</Text> : null}
            {!rev.title && !rev.comment ? (
              <Text style={styles.reviewBody}>(No written feedback)</Text>
            ) : null}
            <View style={styles.reviewFooter}>
              <View style={styles.reviewFooterLeft}>
                {when ? <Text style={styles.reviewMeta}>{when}</Text> : null}
                <Text style={[styles.reviewMeta, when ? { marginTop: 4 } : null]}>By {rev.reviewerName}</Text>
              </View>
              {rev.verified ? <Text style={styles.verifiedBadge}>Verified purchase</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
});
