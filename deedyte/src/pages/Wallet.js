import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatNaira } from '../utils/formatNaira';
import { fetchWallet } from '../api/user';

const TEAL = '#00926e';

const ACTIONS = [
  { key: 'Wallet-topup', label: 'Top up', icon: 'add' },
  { key: 'Wallet-send', label: 'Send', icon: 'arrow-up' },
  { key: 'Wallet-withdraw', label: 'Withdraw', icon: 'arrow-down' },
  { key: 'Wallet-history', label: 'History', icon: 'receipt-outline' },
];

export default function WalletScreen() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState(null);
  const balanceKobo = Number(wallet?.balance_kobo);
  const balance = Number.isFinite(balanceKobo) ? balanceKobo / 100 : 0;
  const address = String(wallet?.address ?? '').trim();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then(row => {
          if (!cancelled) setWallet(row);
        })
        .catch(() => {
          if (!cancelled) setWallet(null);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>{formatNaira(balance)}</Text>
        <Pressable
          style={styles.addressChip}
          onPress={() => {
            if (!address) return;
            Clipboard.setString(address);
            Alert.alert('Copied', 'Address copied to clipboard.');
          }}
          accessibilityRole="button"
          accessibilityLabel="Copy wallet address"
        >
          <Text style={styles.addressText} numberOfLines={1}>
            Address {address || 'Not available'}
          </Text>
          <Icon name="copy-outline" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.actions}>
        {ACTIONS.map(action => (
          <Pressable
            key={action.key}
            style={styles.action}
            onPress={() => navigation.navigate(action.key)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <View style={styles.actionIcon}>
              <Icon name={action.icon} size={22} color={TEAL} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Deedyte account</Text>
        <Text style={styles.muted}>Bank</Text>
        <Text style={styles.value}>{wallet?.bank_name || 'Not available yet'}</Text>
        <Text style={styles.muted}>Account name</Text>
        <Text style={styles.value}>{wallet?.account_name || 'Not available yet'}</Text>
        <Text style={styles.muted}>Account number</Text>
        <Text style={styles.value}>{wallet?.account_number || 'Not available yet'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Recent activity</Text>
      <Text style={styles.sectionHint}>Top ups, sends, and payments</Text>
      <View style={styles.empty}>
        <Icon name="time-outline" size={22} color={TEAL} />
        <View style={styles.emptyText}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.muted}>Top ups and transfers will show up here.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16, paddingBottom: 32 },
  balanceCard: {
    backgroundColor: TEAL,
    borderRadius: 7,
    padding: 18,
  },
  balanceLabel: { color: '#E8F6F1', fontSize: 13 },
  balanceValue: { marginTop: 8, color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  addressChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  addressText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', flexShrink: 1 },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingVertical: 14,
  },
  action: { flex: 1, alignItems: 'center' },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 7,
    backgroundColor: '#E8F6F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#111111' },
  card: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 12 },
  muted: { marginTop: 8, fontSize: 12, color: '#6B7280' },
  value: { marginTop: 2, fontSize: 15, fontWeight: '700', color: '#111111' },
  sectionTitle: { marginTop: 20, fontSize: 18, fontWeight: '800', color: '#111111' },
  sectionHint: { marginTop: 2, marginBottom: 12, fontSize: 13, color: '#6B7280' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyText: { flex: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111111' },
});
