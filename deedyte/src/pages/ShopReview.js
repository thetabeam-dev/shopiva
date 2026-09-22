import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createShopReview } from '../api';

const OPTIONS = [
  { id: 'poor', label: 'Poor', icon: 'sad-outline', color: '#e84118' },
  { id: 'average', label: 'Average', icon: 'remove-outline', color: '#fbc531' },
  { id: 'good', label: 'Good', icon: 'thumbs-up-outline', color: '#4cd137' },
  { id: 'best', label: 'Best', icon: 'heart-outline', color: '#00a8ff' },
];

export default function ShopReviewScreen({ navigation }) {
  const { shop, order } = useRoute()?.params ?? {};
  const [rating, setRating] = useState(0);
  const [reviewType, setReviewType] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!rating || !reviewType) {
      Alert.alert('Review incomplete', 'Please select a rating and review type.');
      return;
    }
    if (!shop?.id || !order?.id) {
      Alert.alert('Review details missing', 'This shop review cannot be submitted without an order reference.');
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
      navigation.goBack();
    } catch (error) {
      Alert.alert('Review failed', error instanceof Error ? error.message : 'Something went wrong while submitting your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Rate {shop?.name || 'this shop'}</Text>
        <Text style={styles.subheading}>How was your experience with the vendor?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map(value => (
            <TouchableOpacity key={value} onPress={() => setRating(value)} accessibilityRole="button" accessibilityLabel={`Rate ${value} out of 5 stars`}>
              <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={38} color={value <= rating ? '#0D9488' : '#C7C7CC'} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>{rating ? `${rating} / 5` : 'Tap stars to rate'}</Text>
        <View style={styles.options}>
          {OPTIONS.map(option => (
            <TouchableOpacity key={option.id} style={[styles.option, reviewType === option.id && { backgroundColor: option.color }]} onPress={() => setReviewType(option.id)}>
              <Ionicons name={option.icon} size={20} color={reviewType === option.id ? '#fff' : option.color} />
              <Text style={[styles.optionText, reviewType === option.id && styles.selectedText]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.comment}
          multiline
          placeholder="Share your experience with the shop (optional)"
          value={comment}
          onChangeText={setComment}
          textAlignVertical="top"
        />
        <TouchableOpacity style={styles.submit} onPress={submit} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Shop Review'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 20 },
  heading: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 8 },
  subheading: { fontSize: 16, color: '#666', marginBottom: 24 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  ratingText: { textAlign: 'center', color: '#666', marginTop: 10, marginBottom: 24 },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  option: { width: '48%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 4 },
  optionText: { marginLeft: 8, color: '#333' },
  selectedText: { color: '#fff', fontWeight: '600' },
  comment: { minHeight: 140, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6, padding: 14, marginTop: 8 },
  submit: { backgroundColor: '#0D9488', padding: 16, alignItems: 'center', borderRadius: 5, marginTop: 20 },
  submitText: { color: '#fff', fontWeight: '700' },
  cancel: { alignItems: 'center', padding: 16 },
  cancelText: { color: '#555' },
});
