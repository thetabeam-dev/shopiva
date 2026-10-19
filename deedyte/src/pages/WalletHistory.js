import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchWalletTransactions } from '../api/user';
import { formatNaira } from '../utils/formatNaira';
import { connectChatSocket } from '../socket/chatSocket';

const TEAL = '#00926e';

export default function WalletHistoryScreen() {
  const [transactions, setTransactions] = useState([]);

  const load = useCallback(() => {
    fetchWalletTransactions()
      .then(setTransactions)
      .catch(() => setTransactions([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    let alive = true;
    let socket = null;
    const onWalletCredited = payload => {
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

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyRoot}>
        <Icon name="time-outline" size={28} color={TEAL} />
        <Text style={styles.title}>No activity yet</Text>
        <Text style={styles.hint}>Top ups, sends, withdrawals, and payments will show up here.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {transactions.map(item => (
        <View key={String(item.id)} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.title}>{item.description || item.type}</Text>
            <Text style={styles.hint}>{item.status}</Text>
          </View>
          <Text style={styles.amount}>{formatNaira(Number(item.amount_kobo) / 100)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  content: { padding: 16, paddingBottom: 32 },
  emptyRoot: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    padding: 14,
    marginBottom: 8,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#111111' },
  hint: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  amount: { fontSize: 15, fontWeight: '800', color: '#111111' },
});
