import { useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { getStoredUser } from '../auth/session';
import dayjs from 'dayjs';
import { createProductReview } from '../api';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGE_BG = '#F5F5F5';
const WHITE = '#FFFFFF';
const BLACK = '#111111';
const MUTED = '#8E8E93';
const LIME = '#A4C639';
const LINK = '#1565C0';
const TEAL = '#0D9488';
const LINE_DONE = '#C5E075';
const LINE_PENDING = '#E0E0E0';
const DOT_PENDING = '#D8D8D8';

const ReviewSubmissionScreen = ({ navigation }) => {
  const [rating, setRating] = useState(0);
  const [reviewType, setReviewType] = useState('');
  const [comment, setComment] = useState('');
  // const [image_urls, set_image_urls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const routeParams = useRoute()?.params ?? {};
  const {
    shop,
    order,
    orderItemId,
    order_item_id,
    productId,
    product_id,
  } = routeParams;
  const user = getStoredUser();

  const resolvedOrderItemId =
    orderItemId ?? order_item_id ?? order?.order_item_id ?? order?.orderItemId ?? null;
  const resolvedProductId =
    productId ?? product_id ?? order?.product_id ?? order?.productId ?? null;

  const reviewOptions = [
    { id: 'poor', label: 'Poor', icon: 'sad-outline', color: '#e84118' },
    {
      id: 'average',
      label: 'Average',
      icon: 'remove-outline',
      color: '#fbc531',
    },
    { id: 'good', label: 'Good', icon: 'thumbs-up-outline', color: '#4cd137' },
    { id: 'best', label: 'Best', icon: 'heart-outline', color: '#00a8ff' },
  ];

  const handleSubmit = async () => {
    try {
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
        Alert.alert('Review item missing', 'This review cannot be submitted without an order item reference.');
        return;
      }

      setIsSubmitting(true);
      await createProductReview({
        order_id: order?.id,
        order_item_id: resolvedOrderItemId,
        product_id: resolvedProductId,
        rating,
        review_tag: reviewType,
        comment,
      });
      navigation.goBack();
    } catch (error) {
      console.log('error: ', error);
      Alert.alert(
        'Review failed',
        error instanceof Error ? error.message : 'Something went wrong while submitting your review.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedReviewOption = reviewOptions.find(
    option => option.id === reviewType,
  );

  const renderStars = () => (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(value => (
        <TouchableOpacity
          key={value}
          onPress={() => setRating(value)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${value} out of 5 stars`}
        >
          <Ionicons
            name={value <= rating ? 'star' : 'star-outline'}
            size={36}
            color={value <= rating ? '#0D9488' : '#C7C7CC'}
            style={styles.starIcon}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isSubmitting && (
          <View
            style={{
              flex: 1,
              width: Dimensions.get('window').width,
              height: Dimensions.get('window').height,
              justifyContent: 'center',
              alignItems: 'center',
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 100,
              backgroundColor: 'rgba(255, 251, 246, 0.2)', // Fully transparent
            }}
          >
            <ActivityIndicator size="large" color="#0D9488" />
          </View>
        )}
        <View style={styles.contentContainer}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: 'rgba(13, 148, 136, 0.25)',
                borderWidth: 1,
                borderColor: 'rgba(13, 148, 136, 0.25)',
                borderRadius: 5,
                padding: 14,
                marginVertical: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  marginRight: 8,
                }}
              >
                ℹ️
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  lineHeight: 20,
                  color: '#000',
                }}
              >
                Your feedback helps other buyers make informed decisions and helps
                vendors improve their services. Please rate your experience with
                this order.
              </Text>
            </View>
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>Overall Rating</Text>
              <View style={styles.starContainer}>
                {renderStars()}
                <Text style={styles.ratingText}>
                  {rating === 0 ? 'Tap stars to rate' : `${rating.toFixed(1)} / 5.0`}
                </Text>
              </View>
            </View>
            <View style={styles.reviewTypeSection}>
              <Text style={styles.sectionTitle}>How was your experience?</Text>
              <View style={styles.reviewOptions}>
                {reviewOptions.map(option => (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.reviewOption,
                      reviewType === option.id && styles.selectedReviewOption,
                      reviewType === option.id && {
                        backgroundColor: option.color,
                      },
                    ]}
                    onPress={() => setReviewType(option.id)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={reviewType === option.id ? '#fff' : option.color}
                    />
                    <Text
                      style={[
                        styles.reviewOptionText,
                        reviewType === option.id &&
                        styles.selectedReviewOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.commentSection}>
              <Text style={styles.sectionTitle}>
                Share your experience (Optional)
              </Text>
              <TextInput
                style={styles.commentInput}
                multiline
                numberOfLines={6}
                placeholder="What did you like or dislike? How was the product quality, delivery experience, etc.?"
                value={comment}
                onChangeText={setComment}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {comment.length}/500 characters
              </Text>
            </View>
          </ScrollView>
          {/* Fixed Submit Button at Bottom */}
          <View style={styles.fixedButtonContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Text style={styles.submitButtonText}>Submitting...</Text>
              ) : (
                <Text style={styles.submitButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelButton]}
              onPress={e => {
                navigation.navigate('Activities');
              }}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    flex: 1,
  },
  scrollContainer: {
    padding: 8,
    paddingBottom: 90, // Extra padding to account for fixed button
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BLACK,
    marginBottom: -10,
  },
  noteBody: {
    fontSize: 15,
    color: BLACK,
    lineHeight: 22,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
    // ...Platform.select({
    //   ios: {
    //     shadowColor: '#000',
    //     shadowOffset: { width: 0, height: 2 },
    //     shadowOpacity: 0.05,
    //     shadowRadius: 8,
    //   },
    //   android: { elevation: 2 },
    // }),
  },
  cardSpaced: {
    marginTop: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 12,
  },
  metaCell: {
    width: '47%',
    minWidth: '45%',
  },
  metaCaps: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaStrong: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
  },
  metaLink: {
    fontSize: 15,
    fontWeight: '700',
    color: LINK,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 16,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D9488',
  },
  ratingSection: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 20,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  starContainer: {
    alignItems: 'center',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: {
    marginHorizontal: 2,
  },
  ratingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  reviewTypeSection: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reviewOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    minWidth: '48%',
    justifyContent: 'center',
  },
  selectedReviewOption: {
    borderColor: 'transparent',
  },
  reviewOptionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  selectedReviewOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  commentSection: {
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    display: 'flex',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 5,
    padding: 0,
    width: '60%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '400',
  },
  cancelButton: {
    backgroundColor: 'grey',
    borderRadius: 5,
    width: '35%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonDisabled: {
    opacity: 0.7,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
});

export default ReviewSubmissionScreen;

// <View style={[styles.card, styles.cardSpaced]}>
//   <View style={styles.noteHeader}>
//     {
//       shop?.logo ?
//       ""
//       :
//       <Icon name={'storefront-outline'} size={25} color={MUTED} />
//     }
//     <Text style={styles.noteTitle}>{shop.name}</Text>
//   </View>
//   {/* <Text style={styles.noteBody}>{dispute.description}</Text> */}
// </View>
// <View style={styles.card}>
//   <View style={styles.metaGrid}>
//     <MetaCell
//       label="Joined "
//       value={dayjs().to(dayjs(shop?.createdat))}
//     />
//     <MetaCell
//       label="Total Reviews"
//       value={dayjs().to(dayjs(shop?.review_count))}
//     />
//     <MetaCell
//       label="Completed Order(s)"
//       value={shop?.order_count}
//       valueIsLink
//     />
//   </View>
// </View>
