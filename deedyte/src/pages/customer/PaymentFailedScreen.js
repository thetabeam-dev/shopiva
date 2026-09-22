import { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatNaira } from '../../utils/formatNaira';

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<Record<string, object | undefined>>; route: { params?: Record<string, unknown> } }} props
 */
export default function PaymentFailedScreen({ navigation, route }) {
  const subtotal = normalizeAmount(route?.params?.subtotal);
  const shipping = normalizeAmount(route?.params?.shipping);
  const total = normalizeAmount(route?.params?.total || subtotal + shipping);
  const reason = String(route?.params?.reason || 'Your payment could not be completed.').trim();

  const totalLabel = useMemo(() => formatNaira(total), [total]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlow}>
            <View style={styles.iconCircle}>
              <Icon name="close-outline" size={44} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.subtitle}>We could not process {totalLabel}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What happened</Text>
          <Text style={styles.reasonText}>{reason}</Text>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Item price</Text>
            <Text style={styles.value}>{formatNaira(subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Shipping</Text>
            <Text style={styles.value}>{shipping > 0 ? formatNaira(shipping) : 'Free'}</Text>
          </View>
          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Grand total</Text>
            <Text style={styles.totalValue}>{totalLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.failedPill}>
              <Text style={styles.failedPillText}>Failed</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('home')} accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>Back Home</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 28,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  heroGlow: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#FDE9EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 33,
    fontWeight: '800',
    color: '#101828',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 18,
    color: '#667085',
    marginBottom: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEDEE',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#ECEDEE',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    marginTop: 4,
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  failedPill: {
    borderWidth: 1,
    borderColor: '#F04438',
    backgroundColor: '#FFF1F0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  failedPillText: {
    color: '#CF1322',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#F58220',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  secondaryBtnText: {
    color: '#344054',
    fontSize: 17,
    fontWeight: '700',
  },
});
