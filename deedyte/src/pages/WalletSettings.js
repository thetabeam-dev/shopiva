import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { fetchWallet } from '../api/user';

const TEAL = '#00926e';

export default function WalletSettingsScreen() {
  const navigation = useNavigation();
  const [hasPin, setHasPin] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchWallet()
        .then(row => {
          if (!cancelled) setHasPin(Boolean(row?.has_pin));
        })
        .catch(() => {
          if (!cancelled) setHasPin(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Wallet-pin')}
        disabled={hasPin}
        accessibilityRole="button"
        accessibilityLabel="Create new PIN"
      >
        <Text style={[styles.rowText, hasPin && styles.muted]}>Create new PIN</Text>
        <Icon name="chevron-forward" size={18} color={hasPin ? '#9CA3AF' : '#111111'} />
      </Pressable>
      <Text style={styles.hint}>
        {hasPin ? 'This wallet already has a PIN.' : 'Set a 4-digit PIN for sends and withdrawals.'}
      </Text>
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('Wallet-pin-change')}
        disabled={!hasPin}
        accessibilityRole="button"
        accessibilityLabel="Change PIN"
      >
        <Text style={[styles.rowText, !hasPin && styles.muted]}>Change PIN</Text>
        <Icon name="chevron-forward" size={18} color={!hasPin ? '#9CA3AF' : '#111111'} />
      </Pressable>
      <Text style={styles.hint}>
        {hasPin ? 'Enter the current PIN, then choose a new 4-digit PIN.' : 'Create a PIN before you can change it.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8', padding: 16 },
  row: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 16, fontWeight: '700', color: '#111111' },
  muted: { color: '#9CA3AF' },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18, color: TEAL },
});
