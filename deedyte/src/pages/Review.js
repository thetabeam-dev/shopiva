import { useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createProductReview } from '../api';
import ReviewStarSelector from '../components/ReviewStarSelector';

const BRAND = '#00926e';
const BG = '#F4F5F7';
const CARD = '#FFFFFF';
const TEXT = '#111111';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const COMMENT_MAX = 500;

const REVIEW_OPTIONS = [
  { id: 'poor', label: 'Poor', icon: 'sad-outline', color: '#DC2626' },
  { id: 'average', label: 'Average', icon: 'remove-outline', color: '#D97706' },
  { id: 'good', label: 'Good', icon: 'thumbs-up-outline', color: '#16A34A' },
  { id: 'best', label: 'Best', icon: 'heart-outline', color: '#2563EB' },
];

/**
 * Product review write screen — route: ProductReview
 * On successful submit → Activities stack root.
 */
export default function ReviewSubmissionScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const routeParams = useRoute()?.params ?? {};
  const {
    shop,
    order,
    orderItemId,
    order_item_id,
    productId,
    product_id,
    productName,
    productImage,
  } = routeParams;

  const [rating, setRating] = useState(0);
  const [reviewType, setReviewType] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedOrderItemId =
    orderItemId ??
    order_item_id ??
    order?.order_item_id ??
    order?.orderItemId ??
    null;
  const resolvedProductId =
    productId ?? product_id ?? order?.product_id ?? order?.productId ?? null;

  const displayName = useMemo(() => {
    const fromParam = String(productName ?? '').trim();
    if (fromParam) return fromParam;
    const fromOrder = String(
      order?.productName ?? order?.product_name ?? order?.name ?? '',
    ).trim();
    return fromOrder || 'Product';
  }, [productName, order]);

  const imageUri = useMemo(() => {
    const raw =
      productImage ??
      order?.productImage ??
      order?.product_image ??
      order?.image ??
      '';
    return String(raw || '').trim();
  }, [productImage, order]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert(
        'Rating Required',
        'Please provide a rating by selecting stars',
      );
      return;
    }
    if (!reviewType) {
      Alert.alert('Review Type Required', 'Please select a review type');
      return;
    }
    if (!resolvedOrderItemId) {
      Alert.alert(
        'Review item missing',
        'This review cannot be submitted without an order item reference.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await createProductReview({
        order_id: order?.id,
        order_item_id: resolvedOrderItemId,
        product_id: resolvedProductId,
        rating,
        review_tag: reviewType,
        comment,
      });
      // Success only — go to existing Activities screen
      navigation.navigate('Activities');
    } catch (error) {
      Alert.alert(
        'Review failed',
        error instanceof Error
          ? error.message
          : 'Something went wrong while submitting your review.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.productCard}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImageFallback}>
                <Ionicons name="cube-outline" size={28} color={MUTED} />
              </View>
            )}
            <View style={styles.productMeta}>
              <Text style={styles.eyebrow}>Write a review</Text>
              <Text style={styles.productName} numberOfLines={2}>
                {displayName}
              </Text>
              {shop?.name ? (
                <Text style={styles.shopLine} numberOfLines={1}>
                  From {shop.name}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How would you rate this product?</Text>
            <ReviewStarSelector
              value={rating}
              onChange={setRating}
              disabled={isSubmitting}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How was your experience?</Text>
            <View style={styles.tagGrid}>
              {REVIEW_OPTIONS.map((option) => {
                const selected = reviewType === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.tagChip,
                      selected && {
                        backgroundColor: option.color,
                        borderColor: option.color,
                      },
                    ]}
                    onPress={() => setReviewType(option.id)}
                    disabled={isSubmitting}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={18}
                      color={selected ? '#FFFFFF' : option.color}
                    />
                    <Text
                      style={[
                        styles.tagText,
                        selected && styles.tagTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your review</Text>
            <Text style={styles.cardHint}>Optional — help other shoppers</Text>
            <TextInput
              style={styles.commentInput}
              multiline
              maxLength={COMMENT_MAX}
              placeholder="What did you like or dislike? Quality, delivery, packaging…"
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
            <Text style={styles.charCount}>
              {comment.length}/{COMMENT_MAX}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (isSubmitting || rating === 0 || !reviewType) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.9}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Review</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => navigation.navigate('Activities')}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.skipText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {isSubmitting ? (
        <View style={styles.busyOverlay} pointerEvents="none">
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={BRAND} />
            <Text style={styles.busyText}>Submitting review…</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#EEF2F0',
  },
  productImageFallback: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#EEF2F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMeta: {
    flex: 1,
    marginLeft: 14,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  productName: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    lineHeight: 22,
  },
  shopLine: {
    marginTop: 4,
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 14,
    textAlign: 'center',
  },
  cardHint: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tagChip: {
    width: '48%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  tagText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },
  tagTextSelected: {
    color: '#FFFFFF',
  },
  commentInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
    backgroundColor: '#FAFAFA',
  },
  charCount: {
    marginTop: 8,
    fontSize: 12,
    color: MUTED,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },
  submitBtn: {
    backgroundColor: BRAND,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  skipBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: 4,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: MUTED,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 245, 247, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyCard: {
    backgroundColor: CARD,
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  busyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
  },
});
