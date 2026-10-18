import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const BRAND = '#00926E';

function splitProductTypes(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

/** Info icon that opens a readable list of the product types in a category. */
export default function CategoryKnowMore({ label, productTypes }) {
  const [open, setOpen] = useState(false);
  const types = useMemo(() => splitProductTypes(productTypes), [productTypes]);
  if (!types.length) return null;

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
            <Text style={styles.subtitle}>
              {types.length} product {types.length === 1 ? 'type' : 'types'} in this category
            </Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator>
              {types.map(type => (
                <View key={type} style={styles.row}>
                  <View style={styles.dot} />
                  <Text style={styles.type}>{type}</Text>
                </View>
              ))}
            </ScrollView>
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
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 10,
    maxHeight: '78%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: '#6B7280',
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 10,
    backgroundColor: BRAND,
  },
  type: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: '#111827',
  },
  close: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND,
  },
});
