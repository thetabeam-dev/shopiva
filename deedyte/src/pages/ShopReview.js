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
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createShopReview } from '../api';
import ReviewStarSelector from '../components/ReviewStarSelector';

const BRAND = '#00926e';
const BG = '#F4F5F7';
const CARD = '#FFFFFF';
const TEXT = '#111111';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';
const COMMENT_MAX = 500;

const OPTIONS = [
  { id: 'poor', label: 'Poor', icon: 'sad-outline', color: '#DC2626' },
  { id: 'average', label: 'Average', icon: 'remove-outline', color: '#D97706' },
  { id: 'good', label: 'Good', icon: 'thumbs-up-outline', color: '#16A34A' },
  { id: 'best', label: 'Best', icon: 'heart-outline', color: '#2563EB' },
];

function pickShopLogo(shop) {
  if (!shop || typeof shop !== 'object') return '';
  const raw =
    shop.logo ??
    shop.Logo ??
    shop.logoUrl ??
    shop.logo_url ??
    shop.image ??
    shop.avatar ??
    '';
  return String(raw || '').trim();
}

/**
 * Shop / vendor review after order confirmation — route: ShopReview
 */
export default function ShopReviewScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { shop, order } = useRoute()?.params ?? {};
  const [rating, setRating] = useState(0);
  const [reviewType, setReviewType] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const shopName = String(shop?.name ?? shop?.Name ?? 'this shop').trim() || 'this shop';
  const logoUri = useMemo(() => pickShopLogo(shop), [shop]);

  const submit = async () => {
    if (!rating || !reviewType) {
      Alert.alert(
        'Review incomplete',
        'Please select a rating and review type.',
      );
      return;
    }
    if (!shop?.id || !order?.id) {
      Alert.alert(
        'Review details missing',
        'This shop review cannot be submitted without an order reference.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await createShopReview({
        shop_id: shop.id,
        order_id: order.id,
        rating,
        review_tag: reviewType,
        comment,
      });
      navigation.pop(2);
    } catch (error) {
      Alert.alert(
        'Review failed',
        error instanceof Error
          ? error.message
          : 'Something went wrong while submitting your review.',
      );
    } finally {
      setSubmitting(false);
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
          <View style={styles.heroCard}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoFallback}>
                <Ionicons name="storefront-outline" size={32} color={BRAND} />
              </View>
            )}
            <Text style={styles.heroEyebrow}>How was your experience?</Text>
            <Text style={styles.shopName} numberOfLines={2}>
              {shopName}
            </Text>
            <Text style={styles.heroSub}>
              Rate your experience with this shop
            </Text>
          </View>

          <View style={styles.card}>
            <ReviewStarSelector
              value={rating}
              onChange={setRating}
              disabled={submitting}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How was it overall?</Text>
            <View style={styles.tagGrid}>
              {OPTIONS.map((option) => {
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
                    disabled={submitting}
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
            <Text style={styles.cardTitle}>Tell us about your experience</Text>
            <Text style={styles.cardHint}>Optional</Text>
            <TextInput
              style={styles.comment}
              multiline
              maxLength={COMMENT_MAX}
              placeholder="Delivery, packaging, communication, quality…"
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              textAlignVertical="top"
              editable={!submitting}
            />
            <Text style={styles.charCount}>
              {comment.length}/{COMMENT_MAX}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submit,
              (submitting || !rating || !reviewType) && styles.submitDisabled,
            ]}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit Review</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skip}
            onPress={() => navigation.goBack()}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {submitting ? (
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
    paddingTop: 8,
    paddingBottom: 24,
  },

  heroCard: {
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 6,
  },

  logo: {
    width: 76,
    height: 76,
    borderRadius: 50,
    backgroundColor: '#EEF2F0',
    marginBottom: 14,
  },

  logoFallback: {
    width: 76,
    height: 76,
    borderRadius: 50,
    backgroundColor: '#E8F6F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  heroEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  shopName: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 6,
  },

  heroSub: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 21,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 6,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 12,
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

  comment: {
    minHeight: 130,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
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

  submit: {
    backgroundColor: BRAND,
    borderRadius: 8,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitDisabled: {
    opacity: 0.55,
  },

  submitText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  skip: {
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