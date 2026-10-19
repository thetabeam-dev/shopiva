import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { formatNaira } from '../utils/formatNaira';
import { fetchWallet, fetchWalletTransactions } from '../api/user';
import { connectChatSocket } from '../socket/chatSocket';

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
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const balanceKobo = Number(wallet?.balance_kobo);
  const balance = Number.isFinite(balanceKobo) ? balanceKobo / 100 : 0;
  const address = String(wallet?.address ?? '').trim();

  const loadWallet = useCallback(() => {
    setRefreshing(true);
    return Promise.all([fetchWallet(), fetchWalletTransactions()])
      .then(([row, list]) => {
        setWallet(row);
        setTransactions(list);
      })
      .catch(() => {
        setWallet(null);
        setTransactions([]);
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    let alive = true;
    let socket = null;
    const onWalletCredited = payload => {
      const kobo = Number(payload?.balance_kobo);
      if (Number.isFinite(kobo)) {
        setWallet(current => ({ ...(current ?? {}), balance_kobo: kobo }));
      }
      if (Array.isArray(payload?.transactions)) setTransactions(payload.transactions);
    };
    void connectChatSocket().then(next => {
      if (!alive || !next) return;
      socket = next;
      next.on('wallet_credited', onWalletCredited);
    });
    return () => {
      alive = false;
      socket?.off('wallet_credited', onWalletCredited);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setRefreshing(true);
      Promise.all([fetchWallet(), fetchWalletTransactions()])
        .then(([row, list]) => {
          if (cancelled) return;
          setWallet(row);
          setTransactions(list);
        })
        .catch(() => {
          if (cancelled) return;
          setWallet(null);
          setTransactions([]);
        })
        .finally(() => {
          if (!cancelled) setRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <View style={styles.balanceTop}>
          <Text style={styles.balanceLabel}>Available balance</Text>
          <View style={styles.balanceActions}>
            <Pressable
              onPress={() => {
                void loadWallet();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Refresh wallet"
            >
              {refreshing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Icon name="refresh" size={22} color="#FFFFFF" />
              )}
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Wallet-settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Wallet settings"
            >
              <Icon name="settings-outline" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
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
      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="time-outline" size={22} color={TEAL} />
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.muted}>Top ups and transfers will show up here.</Text>
          </View>
        </View>
      ) : (
        transactions.slice(0, 5).map(item => (
          <View key={String(item.id)} style={styles.txRow}>
            <Text style={styles.emptyTitle}>{item.type}</Text>
            <Text style={styles.value}>{formatNaira(Number(item.amount_kobo) / 100)}</Text>
          </View>
        ))
      )}
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
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
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
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
});
