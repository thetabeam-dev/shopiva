import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const BRAND = '#00926E';

/** Info icon that opens a short note of the product types in a category. */
export default function CategoryKnowMore({ label, productTypes }) {
  const [open, setOpen] = useState(false);
  const types = String(productTypes ?? '').trim();
  if (!types) return null;

  return (
    <>
      <Pressable
        hitSlop={10}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Product types in ${label}`}
      >
        <Icon name="information-circle-outline" size={18} color="#6B7280" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.root}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.card}>
            <Text style={styles.title}>{label}</Text>
            <Text style={styles.body}>{types}</Text>
            <Pressable style={styles.close} onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  close: {
    alignSelf: 'flex-end',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND,
  },
});
