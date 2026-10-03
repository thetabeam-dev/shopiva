import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const BRAND = '#00926e';
const EMPTY = '#D1D5DB';
const MUTED = '#6B7280';
const TEXT = '#111111';

const RATING_LABELS = {
  0: 'Tap a star to rate',
  1: 'Terrible',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Excellent',
};

/**
 * Large, touch-friendly star rating selector for write-review screens.
 *
 * @param {{
 *   value: number;
 *   onChange: (next: number) => void;
 *   disabled?: boolean;
 *   starSize?: number;
 *   activeColor?: string;
 * }} props
 */
export default function ReviewStarSelector({
  value = 0,
  onChange,
  disabled = false,
  starSize = 44,
  activeColor = BRAND,
}) {
  const safe = Number.isFinite(Number(value))
    ? Math.min(5, Math.max(0, Math.round(Number(value))))
    : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => {
              if (!disabled) onChange?.(star);
            }}
            activeOpacity={0.75}
            disabled={disabled}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} out of 5 stars`}
            accessibilityState={{ selected: star <= safe }}
            style={styles.starHit}
          >
            <Ionicons
              name={star <= safe ? 'star' : 'star-outline'}
              size={starSize}
              color={star <= safe ? activeColor : EMPTY}
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.label, safe > 0 && styles.labelActive]}>
        {RATING_LABELS[safe] || RATING_LABELS[0]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starHit: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '600',
    color: MUTED,
  },
  labelActive: {
    color: TEXT,
  },
});
