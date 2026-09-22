import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function ProductImageThumb({ uri }) {
  const imageUri = typeof uri === 'string' && uri.trim() ? uri.trim() : null;
  return imageUri ? (
    <Image source={{ uri: imageUri }} style={styles.thumb} resizeMode="cover" />
  ) : (
    <View style={[styles.thumb, styles.placeholder]} />
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
