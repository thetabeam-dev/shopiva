import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Entry for the Products tab: nested destinations + create product.
 */
export default function CatalogScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const goCatalog = useCallback(() => {
    navigation.navigate('ProductList');
  }, [navigation]);

  const goInventory = useCallback(() => {
    navigation.navigate('Inventory');
  }, [navigation]);

  const goCreate = useCallback(() => {
    navigation.navigate('AddProduct');
  }, [navigation]);

  const goShipping = useCallback(() => {
    navigation.navigate('Shipping');
  }, [navigation]);

  return (
    <View style={[styles.root, { paddingTop: 15 }]}>
  
      <TouchableOpacity style={styles.createPrimary} onPress={goCreate} activeOpacity={0.88}>
        <Icon name="add-circle" size={22} color="#FFFFFF" />
        <Text style={[styles.createPrimaryText, styles.createPrimaryTextSpacing]}>Create new product</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Go to</Text>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.optionRow} onPress={goCatalog} activeOpacity={0.85}>
          <View style={[styles.optionIcon, styles.optionIconOrange]}>
            <Icon name="pricetags-outline" size={22} color="#C2410C" />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Products</Text>
            <Text style={styles.optionDesc}>Table view, status, sales, and row actions</Text>
          </View>
          <Icon name="chevron-forward" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={goInventory} activeOpacity={0.85}>
          <View style={[styles.optionIcon, styles.optionIconGray]}>
            <Icon name="cube-outline" size={22} color="#374151" />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Inventory</Text>
            <Text style={styles.optionDesc}>Stock levels and availability</Text>
          </View>
          <Icon name="chevron-forward" size={22} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={goShipping} activeOpacity={0.85}>
          <View style={[styles.optionIcon, styles.optionIconBrand]}>
            <Icon name="car-outline" size={22} color="#00926e" />
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Shipping</Text>
            <Text style={styles.optionDesc}>Fee model, discounts, and delivery zones</Text>
          </View>
          <Icon name="chevron-forward" size={22} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F5F7',
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111111',
  },
  sub: {
    marginTop: 8,
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 20,
  },
  createPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 5,
    marginBottom: 28,
  },
  createPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  createPrimaryTextSpacing: {
    marginLeft: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  list: {},
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconOrange: {
    backgroundColor: '#FFEDD5',
  },
  optionIconGray: {
    backgroundColor: '#F3F4F6',
  },
  optionIconBrand: {
    backgroundColor: '#E8F6F1',
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  optionDesc: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
});
