/**
 * Shared rating row component — matches the VendorCard style:
 *   ★ ★ ★ ☆ ☆  N
 *
 * Props:
 *   rating      {number}  0–5 (float)
 *   count       {number}  review count (0 = omit count)
 *   starSize    {number}  default 13
 *   activeColor {string}  default '#E8C547'
 *   emptyColor  {string}  default '#CCCCCC'
 *   countColor  {string}  default '#111111'
 *   countSize   {number}  default 12
 *   style       {object}  wrapper style override
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const DEFAULT_ACTIVE = '#E8C547';
const DEFAULT_EMPTY  = '#CCCCCC';

export default function RatingRow({
  rating = 0,
  count = 0,
  starSize = 13,
  activeColor = DEFAULT_ACTIVE,
  emptyColor  = DEFAULT_EMPTY,
  countColor  = '#111111',
  countSize   = 12,
  style,
}) {
  const safeRating = Number.isFinite(Number(rating)) ? Math.min(5, Math.max(0, Number(rating))) : 0;
  const safeCount  = Number.isFinite(Number(count)) && Number(count) > 0 ? Math.round(Number(count)) : 0;

  function formatCount(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(n);
  }

  return (
    <View style={[styles.row, style]}>
      {[1, 2, 3, 4, 5].map(star => (
        <Icon
          key={star}
          name={star <= Math.round(safeRating) ? 'star' : 'star-outline'}
          size={starSize}
          color={star <= Math.round(safeRating) ? activeColor : emptyColor}
        />
      ))}
      {safeCount > 0 ? (
        <Text style={[styles.count, { color: countColor, fontSize: countSize }]}>
          {formatCount(safeCount)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  count: {
    marginLeft: 4,
    fontWeight: '500',
  },
});
